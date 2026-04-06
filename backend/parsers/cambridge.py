"""
Cambridge Enbridge CNG invoice parser.

PDF format: EngageOne Generate — text-extractable, GS commercial format.
Page 1 contains all charge data (charge table + consumption total).

IMPORTANT: Cambridge invoices do NOT show an explicit billing period start date.
The parser extracts billing_period (first of month) and end_date (from DateRendered),
and emits a warning that start_date must be entered manually by the user.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

import pdfplumber

from backend.schemas.cambridge import CambridgeInvoiceSchema
from backend.schemas.common import ValidationSeverity, ValidationWarning


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _parse_dollar(s: str) -> float:
    """Convert a dollar string to float.
    Handles:  '$6,396.42' → 6396.42
              '($196.84)' → -196.84
              '-$1,599.55' → -1599.55
    """
    s = s.strip()
    negative = s.startswith("(") or s.startswith("-")
    s = re.sub(r"[()$,\s]", "", s).lstrip("-")
    return -float(s) if negative else float(s)


def _last_dollar(line: str) -> Optional[float]:
    """Return the last dollar amount found in a text line, or None."""
    # Matches both positive $X,XXX.XX and negative ($X,XXX.XX)
    hits = re.findall(r"\(?\$[\d,]+\.?\d*\)?", line)
    if not hits:
        return None
    return _parse_dollar(hits[-1])


def _quarter_label(dt: date) -> str:
    """'Q1 2026' etc. — standard Jan-Mar Q1, Apr-Jun Q2, Jul-Sep Q3, Oct-Dec Q4."""
    return f"Q{(dt.month - 1) // 3 + 1} {dt.year}"


# ─────────────────────────────────────────────────────────────
# Main parser
# ─────────────────────────────────────────────────────────────

def parse_cambridge(
    pdf_path: str,
    source_filename: Optional[str] = None,
) -> tuple[list[CambridgeInvoiceSchema], list[ValidationWarning]]:
    """
    Parse a Cambridge Enbridge CNG invoice PDF.

    Returns:
        (rows, warnings)  — rows is always length 1 for Cambridge.
    """
    warnings: list[ValidationWarning] = []

    with pdfplumber.open(pdf_path) as pdf:
        p1_text = pdf.pages[0].extract_text() or ""

    lines = p1_text.split("\n")

    # ── Billing period month ("BillingPeriod February2026") ──────
    # Appears on line like: 'POBox2001,50KeilDriveNorth BillingPeriod February2026'
    billing_period: Optional[date] = None
    m = re.search(r"BillingPeriod\s+(\w+)\s*(\d{4})", p1_text, re.IGNORECASE)
    if m:
        try:
            billing_period = datetime.strptime(
                f"01 {m.group(1)} {m.group(2)}", "%d %B %Y"
            ).date()
        except ValueError:
            pass

    if billing_period is None:
        warnings.append(ValidationWarning(
            field="billing_period",
            message="Could not parse billing period month from PDF.",
            severity=ValidationSeverity.WARNING,
        ))

    # ── End date ("DateRendered March2,2026") ────────────────────
    end_date: Optional[date] = None
    m = re.search(r"DateRendered\s+(\w+)\s*(\d{1,2}),?\s*(\d{4})", p1_text, re.IGNORECASE)
    if m:
        try:
            end_date = datetime.strptime(
                f"{m.group(2)} {m.group(1)} {m.group(3)}", "%d %B %Y"
            ).date()
        except ValueError:
            pass

    if end_date is None:
        warnings.append(ValidationWarning(
            field="end_date",
            message="Could not parse end date from 'Date Rendered' field.",
            severity=ValidationSeverity.WARNING,
        ))

    # ── Start date: NOT present on Cambridge PDFs ─────────────────
    warnings.append(ValidationWarning(
        field="start_date",
        message=(
            "Cambridge invoices do not show a billing period start date. "
            "Enter the start date manually (it is the day after the previous invoice's end date)."
        ),
        severity=ValidationSeverity.WARNING,
    ))

    # ── Quarter reference ─────────────────────────────────────────
    enbridge_qtr_reference = _quarter_label(billing_period) if billing_period else ""

    # ── Total consumption ("TotalConsumption =16,819.7m3") ───────
    gas_consumption: Optional[float] = None
    m = re.search(r"TotalConsumption\s*=\s*([\d,\.]+)\s*m3", p1_text, re.IGNORECASE)
    if m:
        gas_consumption = float(m.group(1).replace(",", ""))

    if gas_consumption is None:
        warnings.append(ValidationWarning(
            field="gas_consumption",
            message="Could not extract Total Consumption from PDF.",
            severity=ValidationSeverity.ERROR,
        ))

    # ── Charge line items ─────────────────────────────────────────
    # Process line by line. Strips spaces from line for keyword matching,
    # but uses original line for dollar extraction.
    # GasSupply-Transportation wraps across two lines — handled with lookahead.

    cd: Optional[float] = None
    demand_charge: Optional[float] = None
    delivery_charge: Optional[float] = None
    monthly_charge_interruptible: Optional[float] = None
    gas_supply_commodity: Optional[float] = None
    gas_supply_transportation: Optional[float] = None
    commodity_fuel_price_adjustment: Optional[float] = None
    enbridge_invoice_cost_excl_hst: Optional[float] = None

    for idx, line in enumerate(lines):
        ns = line.replace(" ", "")  # no-space version for keyword matching

        if "DemandCharge" in ns and ("8,450" in ns or "8450" in ns):
            # "DemandCharge-First8,450m3ofCD 8,000.0 m3 $0.7995530 * $6,396.42"
            demand_charge = _last_dollar(line)
            # CD quantity: the number immediately after "ofCD" keyword
            mc = re.search(r"ofCD\s*([\d,\.]+)\s*m3", line, re.IGNORECASE)
            if mc:
                cd = float(mc.group(1).replace(",", ""))

        elif "DeliveryCharge" in ns or (
            "Delivery" in ns and "422" in ns
        ):
            # "DeliveryCharge-First 422,250m3 16,819.7 m3 $0.0233020 * $391.93"
            delivery_charge = _last_dollar(line)

        elif "MonthlyCharge" in ns and "Interruptible" in ns:
            # "MonthlyCharge-Interruptible $837.79"
            monthly_charge_interruptible = _last_dollar(line)

        elif (
            "GasSupply-Commodity" in ns
            and "Transportation" not in ns
            and "Fuel" not in ns
            and "Price" not in ns
            and "Adjustment" not in ns
        ):
            # "GasSupply-Commodity 16.819.7 m3 $0.2040370 $3,431.84"
            gas_supply_commodity = _last_dollar(line)

        elif "GasSupply-Transportation" in ns:
            # This charge wraps: the dollar amount is on the NEXT line.
            # "GasSupply-Transportation"
            # "16.819.7 m3 $0.0000000 * $0.00"
            val = _last_dollar(line)
            if val is None and idx + 1 < len(lines):
                val = _last_dollar(lines[idx + 1])
            gas_supply_transportation = val

        elif "PriceAdjustment" in ns or (
            "Commodity&Fuel" in ns and "Adjustment" in ns
        ):
            # "GasSupply-Commodity&Fuel-PriceAdjustment 16.819.7 m3 ($0.0117030) * ($196.84)"
            commodity_fuel_price_adjustment = _last_dollar(line)

        elif "CurrentMonthChargesSubtotal" in ns:
            # "CurrentMonthChargesSubtotal^ $10,861.14"
            enbridge_invoice_cost_excl_hst = _last_dollar(line)

    # Fallback: "Total Charges This Month" if subtotal line wasn't found
    if enbridge_invoice_cost_excl_hst is None:
        for line in lines:
            if "TotalChargesThisMonth" in line.replace(" ", ""):
                enbridge_invoice_cost_excl_hst = _last_dollar(line)
                break

    # ── Validation warnings for missing mandatory fields ──────────
    mandatory = {
        "demand_charge": demand_charge,
        "delivery_charge": delivery_charge,
        "monthly_charge_interruptible": monthly_charge_interruptible,
        "gas_supply_commodity": gas_supply_commodity,
        "gas_supply_transportation": gas_supply_transportation,
        "commodity_fuel_price_adjustment": commodity_fuel_price_adjustment,
        "enbridge_invoice_cost_excl_hst": enbridge_invoice_cost_excl_hst,
    }
    for field_name, val in mandatory.items():
        if val is None:
            warnings.append(ValidationWarning(
                field=field_name,
                message=f"Could not extract '{field_name}' from PDF.",
                severity=ValidationSeverity.ERROR,
            ))

    row = CambridgeInvoiceSchema(
        enbridge_qtr_reference=enbridge_qtr_reference,
        start_date=None,
        end_date=end_date,
        billing_period=billing_period,
        cd=cd,
        gas_consumption=gas_consumption,
        split_volumes=None,
        demand_charge=demand_charge,
        delivery_charge=delivery_charge,
        monthly_charge_interruptible=monthly_charge_interruptible,
        gas_supply_commodity=gas_supply_commodity,
        gas_supply_transportation=gas_supply_transportation,
        commodity_fuel_price_adjustment=commodity_fuel_price_adjustment,
        miscellaneous_charges=None,
        enbridge_invoice_cost_excl_hst=enbridge_invoice_cost_excl_hst or 0.0,
        source_pdf_filename=source_filename,
    )

    return [row], warnings

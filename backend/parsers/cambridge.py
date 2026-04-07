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
    hits = re.findall(r"\(?\$[\d,]+\.?\d*\)?", line)
    if not hits:
        return None
    return _parse_dollar(hits[-1])


def _quarter_label(dt: date) -> str:
    """'Q1 2026' etc. — standard Jan-Mar Q1, Apr-Jun Q2, Jul-Sep Q3, Oct-Dec Q4."""
    return f"Q{(dt.month - 1) // 3 + 1} {dt.year}"


def _parse_date_rendered(text: str) -> Optional[date]:
    """Parse 'DateRendered March2,2026' → date."""
    m = re.search(r"DateRendered\s+(\w+)\s*(\d{1,2}),?\s*(\d{4})", text, re.IGNORECASE)
    if m:
        try:
            return datetime.strptime(
                f"{m.group(2)} {m.group(1)} {m.group(3)}", "%d %B %Y"
            ).date()
        except ValueError:
            pass
    return None


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

    # ── Invoice number ("Invoice # 1209362") ──────────────────────
    invoice_number: Optional[str] = None
    m = re.search(r"Invoice\s*#\s*(\d+)", p1_text, re.IGNORECASE)
    if not m:
        # Try no-space version: "InvoiceNo1209362" or "InvoiceNumber1209362"
        m = re.search(r"Invoice(?:No|Number|#)\s*(\d+)", p1_text.replace(" ", ""), re.IGNORECASE)
    if m:
        invoice_number = m.group(1)

    # ── Billing period month ("BillingPeriod February2026") ──────
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

    # ── Bill date = Date Rendered ("DateRendered March2,2026") ────
    bill_date: Optional[date] = _parse_date_rendered(p1_text)
    end_date: Optional[date] = bill_date   # Cambridge end_date is the DateRendered date

    if end_date is None:
        warnings.append(ValidationWarning(
            field="end_date",
            message="Could not parse end date from 'Date Rendered' field.",
            severity=ValidationSeverity.WARNING,
        ))

    # ── Due date (late payment effective date) ────────────────────
    due_date: Optional[date] = None
    m = re.search(
        r"(?:LatePayment|EffectiveDate|LateFee|DueDate)\s+(\w+)\s*(\d{1,2}),?\s*(\d{4})",
        p1_text.replace(" ", ""),
        re.IGNORECASE,
    )
    if m:
        try:
            due_date = datetime.strptime(
                f"{m.group(2)} {m.group(1)} {m.group(3)}", "%d %B %Y"
            ).date()
        except ValueError:
            pass

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
    cd: Optional[float] = None
    demand_charge: Optional[float] = None
    delivery_charge: Optional[float] = None
    monthly_charge_interruptible: Optional[float] = None
    gas_supply_commodity: Optional[float] = None
    gas_supply_transportation: Optional[float] = None
    commodity_fuel_price_adjustment: Optional[float] = None
    enbridge_invoice_cost_excl_hst: Optional[float] = None
    hst_amount: Optional[float] = None
    balance_forward: Optional[float] = None
    late_payment_charge: Optional[float] = None

    for idx, line in enumerate(lines):
        ns = line.replace(" ", "")  # no-space version for keyword matching

        if "DemandCharge" in ns and ("8,450" in ns or "8450" in ns):
            demand_charge = _last_dollar(line)
            mc = re.search(r"ofCD\s*([\d,\.]+)\s*m3", line, re.IGNORECASE)
            if mc:
                cd = float(mc.group(1).replace(",", ""))

        elif "DeliveryCharge" in ns or (
            "Delivery" in ns and "422" in ns
        ):
            delivery_charge = _last_dollar(line)

        elif "MonthlyCharge" in ns and "Interruptible" in ns:
            monthly_charge_interruptible = _last_dollar(line)

        elif (
            "GasSupply-Commodity" in ns
            and "Transportation" not in ns
            and "Fuel" not in ns
            and "Price" not in ns
            and "Adjustment" not in ns
        ):
            gas_supply_commodity = _last_dollar(line)

        elif "GasSupply-Transportation" in ns:
            val = _last_dollar(line)
            if val is None and idx + 1 < len(lines):
                val = _last_dollar(lines[idx + 1])
            gas_supply_transportation = val

        elif "PriceAdjustment" in ns or (
            "Commodity&Fuel" in ns and "Adjustment" in ns
        ):
            commodity_fuel_price_adjustment = _last_dollar(line)

        elif "CurrentMonthChargesSubtotal" in ns:
            enbridge_invoice_cost_excl_hst = _last_dollar(line)

        elif "HarmonizedSalesTax" in ns or ("HST" in ns and "%" in ns):
            hst_amount = _last_dollar(line)

        elif "BalanceForward" in ns:
            balance_forward = _last_dollar(line)

        elif "LatePaymentCharge" in ns:
            late_payment_charge = _last_dollar(line)

    # Fallback for cost excl HST
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
        invoice_number=invoice_number,
        bill_date=bill_date,
        due_date=due_date,
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
        hst_amount=hst_amount,
        balance_forward=balance_forward,
        late_payment_charge=late_payment_charge,
        source_pdf_filename=source_filename,
    )

    return [row], warnings

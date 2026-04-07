"""
Pickering Elexicon electricity invoice parser.

PDF format: Idoxs Development Team / PDFlib — text-extractable, 2-page bill.
  Page 1: Distribution Charges + Other Charges (all dollar amounts)
  Page 2: Electricity Consumption table (meter, period, days, kWh, demand data)

Key quirks:
  - Page 1 text has two columns interleaved (charge data on left, service info on right).
    Each charge line is still distinguishable by its label prefix.
  - 'Global Adjustment' line contains the free-text kWh@rate descriptor AND the dollar amount.
    'Disposition of Global Adjustment' is the separate positive adjustment.
  - Electricity rate $/kWh appears in the 'Electricity' line as "$0.123796/kWh".
  - bill_period (month name) is derived from the read period end date.
  - All consumption data (kWh, demand, days) comes from the page 2 data row.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

import pdfplumber

from schemas.elexicon import PickeringElexiconInvoiceSchema
from schemas.common import ValidationSeverity, ValidationWarning


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _parse_dollar(s: str) -> float:
    s = s.strip()
    negative = s.startswith("(") or s.startswith("-")
    s = re.sub(r"[()$,\s]", "", s).lstrip("-")
    return -float(s) if negative else float(s)


def _last_dollar(line: str) -> Optional[float]:
    """Return the last dollar amount on a line (handles negatives and parentheses)."""
    hits = re.findall(r"-?\(?\$[\d,]+\.?\d*\)?", line)
    if not hits:
        return None
    return _parse_dollar(hits[-1])


def _month_name(date_str: str) -> Optional[str]:
    """
    Extract the month name from the END date of a read period string.
    'Jan 31 - Feb 28, 2026' → 'February'
    """
    m = re.search(
        r"-\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+,?\s*(\d{4})",
        date_str,
        re.IGNORECASE,
    )
    if m:
        try:
            dt = datetime.strptime(f"1 {m.group(1)} {m.group(2)}", "%d %b %Y")
            return dt.strftime("%B")   # full month name
        except ValueError:
            pass
    return None


# ─────────────────────────────────────────────────────────────
# Main parser
# ─────────────────────────────────────────────────────────────

def parse_elexicon(
    pdf_path: str,
    source_filename: Optional[str] = None,
) -> tuple[list[PickeringElexiconInvoiceSchema], list[ValidationWarning]]:
    """
    Parse a Pickering Elexicon electricity invoice PDF.

    Returns:
        (rows, warnings)  — rows is always length 1 for Elexicon.
    """
    warnings: list[ValidationWarning] = []

    with pdfplumber.open(pdf_path) as pdf:
        p1_text = pdf.pages[0].extract_text() or ""
        p2_text = pdf.pages[1].extract_text() or ""

    p1_lines = p1_text.split("\n")

    # ── Read period & bill period ─────────────────────────────────
    # Line 14 (0-indexed): 'Jan 31 - Feb 28, 2026'
    # Preceded by 'READ PERIOD:' on line 12.
    read_period: Optional[str] = None
    bill_period: Optional[str] = None

    read_period_next = False
    for line in p1_lines:
        stripped = line.strip()
        if "READ PERIOD" in stripped:
            read_period_next = True
            continue
        if read_period_next and re.search(r"\w+ \d+ - \w+ \d+", stripped):
            read_period = stripped
            bill_period = _month_name(stripped)
            read_period_next = False
            break

    if read_period is None:
        warnings.append(ValidationWarning(
            field="read_period",
            message="Could not find READ PERIOD date range on page 1.",
            severity=ValidationSeverity.ERROR,
        ))

    # ── Page 2: consumption data row ─────────────────────────────
    # Line 4: 'VC00245185 Jan 31 - Feb 28, 2026 28 28,193.70 253.00 0.84 142.01 0.82'
    days: Optional[int] = None
    kwh_used: Optional[float] = None
    monthly_demand_kw: Optional[float] = None
    meter_number: Optional[str] = None

    p2_lines = p2_text.split("\n")
    for line in p2_lines:
        # The data row starts with a meter number (alphanumeric, no spaces) followed by
        # a billing period date range and numeric values.
        m = re.match(
            r"^(\w+)\s+"                        # meter number
            r"(\w+ \d+ - \w+ \d+,\s*\d{4})\s+"  # billing period
            r"(\d+)\s+"                          # days
            r"([\d,\.]+)\s+"                     # kWh used
            r"([\d\.]+)",                        # monthly demand kW
            line.strip(),
        )
        if m:
            meter_number = m.group(1)
            days = int(m.group(3))
            kwh_used = float(m.group(4).replace(",", ""))
            monthly_demand_kw = float(m.group(5))
            break

    if kwh_used is None:
        warnings.append(ValidationWarning(
            field="kwh_used",
            message="Could not parse consumption data from page 2.",
            severity=ValidationSeverity.ERROR,
        ))

    # ── Page 1: charge line items ─────────────────────────────────
    # Process lines by label prefix. The two-column interleaving means some lines
    # have right-column text appended, but _last_dollar() always gets the correct
    # charge amount (last $ on the line).

    electricity_rate: Optional[float] = None
    delivery_charge: Optional[float] = None
    customer_charge: Optional[float] = None
    sss_admin_charge: Optional[float] = None
    electricity_cost: Optional[float] = None
    global_adjuster: Optional[str] = None
    global_adjustment_recovery: Optional[float] = None
    global_adjustment: Optional[float] = None   # "Disposition of Global Adjustment"
    transmission_network: Optional[float] = None
    transmission_connection: Optional[float] = None
    wholesale_market_services: Optional[float] = None
    hst: Optional[float] = None
    total_charge: Optional[float] = None
    new_account_setup: Optional[float] = None
    interest_overdue_charge: Optional[float] = None

    for line in p1_lines:
        stripped = line.strip()

        if stripped.startswith("Delivery Charge"):
            # "Delivery Charge $5.3901/kW $1,363.70 Miller Waste Systems Inc"
            delivery_charge = _last_dollar(line)

        elif stripped.startswith("Customer Charge"):
            # "Customer Charge $138.41 SERVICE ADDRESS:"
            customer_charge = _last_dollar(line)

        elif stripped.startswith("New Account Setup") or "New Account" in stripped:
            new_account_setup = _last_dollar(line)

        elif stripped.startswith("SSS Admin"):
            sss_admin_charge = _last_dollar(line)

        elif stripped.startswith("Electricity ") and "/kWh" in stripped:
            # "Electricity $0.123796/kWh $3,658.50"
            electricity_cost = _last_dollar(line)
            rm = re.search(r"\$([\d\.]+)/kWh", stripped)
            if rm:
                electricity_rate = float(rm.group(1))

        elif stripped.startswith("Global Adjustment") and "Disposition" not in stripped:
            # "Global Adjustment 29,552.64kWh@$-0.00292 -$86.30"
            # Extract the descriptor text between the label and the final $ amount.
            global_adjustment_recovery = _last_dollar(line)
            dm = re.search(
                r"Global Adjustment\s+([\d,\.]+kWh@\$[\d\.\-]+)",
                stripped,
                re.IGNORECASE,
            )
            if dm:
                global_adjuster = dm.group(1)

        elif "Disposition of Global Adjustment" in stripped:
            # "Disposition of Global Adjustment $279.12"
            global_adjustment = _last_dollar(line)

        elif stripped.startswith("Transmission Network"):
            transmission_network = _last_dollar(line)

        elif stripped.startswith("Transmission Connection"):
            transmission_connection = _last_dollar(line)

        elif stripped.startswith("Wholesale Market"):
            wholesale_market_services = _last_dollar(line)

        elif stripped.startswith("H.S.T.") or stripped.startswith("HST"):
            hst = _last_dollar(line)

        elif stripped.startswith("CURRENT CHARGES"):
            total_charge = _last_dollar(line)

        elif "Interest" in stripped and "Overdue" in stripped:
            interest_overdue_charge = _last_dollar(line)

    # ── Derived fields ────────────────────────────────────────────
    # total_charge_excl_hst_interest = total_charge - hst - interest_overdue_charge
    total_charge_excl_hst_interest: Optional[float] = None
    if total_charge is not None and hst is not None:
        excl = total_charge - hst
        if interest_overdue_charge is not None:
            excl -= interest_overdue_charge
        total_charge_excl_hst_interest = round(excl, 2)

    # ── Validation ────────────────────────────────────────────────
    mandatory = {
        "delivery_charge": delivery_charge,
        "customer_charge": customer_charge,
        "electricity_cost": electricity_cost,
        "global_adjustment": global_adjustment,
        "transmission_network": transmission_network,
        "transmission_connection": transmission_connection,
        "wholesale_market_services": wholesale_market_services,
        "hst": hst,
        "total_charge": total_charge,
    }
    for field_name, val in mandatory.items():
        if val is None:
            warnings.append(ValidationWarning(
                field=field_name,
                message=f"Could not extract '{field_name}' from page 1.",
                severity=ValidationSeverity.ERROR,
            ))

    row = PickeringElexiconInvoiceSchema(
        bill_period=bill_period or "",
        read_period=read_period or "",
        account_number="97066317-00",
        service_type="GS > 50 kW",
        days=days,
        kwh_used=kwh_used,
        monthly_demand_kw=monthly_demand_kw,
        electricity_rate=electricity_rate,
        global_adjuster=global_adjuster,
        new_account_setup=new_account_setup,
        delivery_charge=delivery_charge,
        customer_charge=customer_charge,
        interest_overdue_charge=interest_overdue_charge,
        sss_admin_charge=sss_admin_charge,
        electricity_cost=electricity_cost,
        global_adjustment=global_adjustment,
        global_adjustment_recovery=global_adjustment_recovery,
        transmission_network=transmission_network,
        transmission_connection=transmission_connection,
        wholesale_market_services=wholesale_market_services,
        hst=hst,
        total_charge=total_charge or 0.0,
        total_charge_excl_hst_interest=total_charge_excl_hst_interest,
        source_pdf_filename=source_filename,
    )

    return [row], warnings

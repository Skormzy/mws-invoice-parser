"""
Pickering Enbridge CNG invoice parser.

PDF format: Kubra Data Transfer / PDFlib — text-extractable, LBA consumer format.
  Page 1: billing period dates, meter readings, total consumption
  Page 2: CHARGES FOR NATURAL GAS section (all charge line items)

CRITICAL edge cases handled:
  - Two Contract Demand Charge tiers (e.g. "8,000 m³ $3,396.61" + "2,000 m³ $849.15"):
      → cd = "8000 & 2000", cd_1 = tier-1 $, cd_2 = tier-2 $
  - Split billing periods crossing quarter boundaries:
      → Two Gas Supply Charge lines → gas_supply_charge_2, split_volumes populated
      → Compound enbridge_qtr_reference ("Q3 & Q4 2024")
  - Federal Carbon Charge (2024 invoices only) → federal_carbon_charge
  - Previous Bill Charge (mid-2024 invoices only) → previous_bill_charge
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Optional

import pdfplumber

from backend.schemas.pickering_enbridge import PickeringCngInvoiceSchema
from backend.schemas.common import ValidationSeverity, ValidationWarning


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _parse_dollar(s: str) -> float:
    s = s.strip()
    negative = s.startswith("(") or s.startswith("-")
    s = re.sub(r"[()$,\s]", "", s).lstrip("-")
    return -float(s) if negative else float(s)


def _last_dollar(line: str) -> Optional[float]:
    hits = re.findall(r"-?\(?\$[\d,]+\.?\d*\)?", line)
    if not hits:
        return None
    return _parse_dollar(hits[-1])


def _parse_date(s: str) -> Optional[date]:
    """Parse 'Oct 08, 2025' or 'Oct 8, 2025' → date."""
    s = s.strip()
    for fmt in ("%b %d, %Y", "%b %d %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _quarter(dt: date) -> tuple[int, int]:
    """Return (quarter_number, year)."""
    return (dt.month - 1) // 3 + 1, dt.year


def _quarter_label(start: date, end: date) -> str:
    """
    'Q4 2025' for same-quarter periods.
    'Q3 & Q4 2025' for periods crossing a quarter boundary (same year).
    'Q4 2025 & Q1 2026' for periods crossing year-end.
    """
    qs, ys = _quarter(start)
    qe, ye = _quarter(end)
    if (qs, ys) == (qe, ye):
        return f"Q{qs} {ys}"
    if ys == ye:
        return f"Q{qs} & Q{qe} {ys}"
    return f"Q{qs} {ys} & Q{qe} {ye}"


# ─────────────────────────────────────────────────────────────
# Main parser
# ─────────────────────────────────────────────────────────────

def parse_pickering_enbridge(
    pdf_path: str,
    source_filename: Optional[str] = None,
) -> tuple[list[PickeringCngInvoiceSchema], list[ValidationWarning]]:
    """
    Parse a Pickering Enbridge CNG invoice PDF.

    Returns:
        (rows, warnings)  — rows is always length 1 (single billing period per invoice).
    """
    warnings: list[ValidationWarning] = []

    with pdfplumber.open(pdf_path) as pdf:
        p1_text = pdf.pages[0].extract_text() or ""
        p2_text = pdf.pages[1].extract_text() or ""

    p1_lines = p1_text.split("\n")
    p2_lines = p2_text.split("\n")

    # ── Page 1: billing period dates ──────────────────────────────
    # "Billing Period Oct 08, 2025 - Nov 06, 2025"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    m = re.search(
        r"Billing Period\s+(\w+ \d+, \d+)\s*-\s*(\w+ \d+, \d+)",
        p1_text,
    )
    if m:
        start_date = _parse_date(m.group(1))
        end_date = _parse_date(m.group(2))

    if start_date is None or end_date is None:
        warnings.append(ValidationWarning(
            field="start_date",
            message="Could not parse billing period dates from page 1.",
            severity=ValidationSeverity.ERROR,
        ))

    billing_period = (end_date - start_date).days if (start_date and end_date) else None
    enbridge_qtr_reference = _quarter_label(start_date, end_date) if (start_date and end_date) else ""

    # ── Page 1: meter readings ────────────────────────────────────
    meter_actual: Optional[float] = None
    meter_previous: Optional[float] = None
    for line in p1_lines:
        if line.strip().startswith("Actual:"):
            m2 = re.search(r"Actual:\s*([\d,]+)", line)
            if m2:
                meter_actual = float(m2.group(1).replace(",", ""))
        elif line.strip().startswith("Previous:"):
            m2 = re.search(r"Previous:\s*([\d,]+)", line)
            if m2:
                meter_previous = float(m2.group(1).replace(",", ""))

    # ── Page 1: gas consumption ("71,896m³") ─────────────────────
    gas_consumption: Optional[float] = None
    m = re.search(r"([\d,]+)\s*m³", p1_text)
    if m:
        gas_consumption = float(m.group(1).replace(",", ""))

    if gas_consumption is None:
        warnings.append(ValidationWarning(
            field="gas_consumption",
            message="Could not extract gas consumption from page 1.",
            severity=ValidationSeverity.ERROR,
        ))

    # ── CF-to-m³ conversion (derived from meter readings) ────────
    # formula confirmed from tracker: consumption / ((actual - previous) × 100)
    cf_to_m3_conversion: Optional[float] = None
    if (
        meter_actual is not None
        and meter_previous is not None
        and meter_actual != meter_previous
        and gas_consumption is not None
    ):
        diff = meter_actual - meter_previous
        if diff > 0:
            cf_to_m3_conversion = gas_consumption / (diff * 100)

    # ── Page 2: CHARGES FOR NATURAL GAS section ──────────────────
    # Find the section start; parse charge lines within it.
    in_charges = False

    customer_charge: Optional[float] = None
    cd_volumes: list[int] = []          # m³ values of CD tiers
    cd_charges: list[float] = []        # $ amounts of CD tiers
    in_cd_block = False                  # True while reading CD tier lines
    delivery_to_you: Optional[float] = None
    load_balancing: Optional[float] = None
    transportation: Optional[float] = None
    federal_carbon_charge: Optional[float] = None
    gas_supply_charges: list[float] = []  # accumulated; split periods have 2
    gas_supply_vols: list[str] = []       # volume strings from "(X m³ @ rate)" lines
    cost_adjustment: Optional[float] = None
    previous_bill_charge: Optional[float] = None
    enbridge_invoice_cost_excl_hst: Optional[float] = None

    for idx, line in enumerate(p2_lines):
        stripped = line.strip()
        ns = stripped.replace(" ", "")

        # Enter the charges section
        if stripped == "CHARGES FOR NATURAL GAS":
            in_charges = True
            continue

        if not in_charges:
            continue

        # Stop at HST line — everything after is totals we don't need
        if stripped.startswith("HST"):
            break

        # ── Contract Demand Charge block ─────────────────────────
        # "Contract Demand Charge" header line has no dollar amount
        if "ContractDemandCharge" in ns and not re.search(r"\$[\d]", stripped):
            in_cd_block = True
            continue

        # Lines in CD block look like "8,000 m³ $3,396.61"
        if in_cd_block:
            cd_m = re.match(r"^([\d,]+)\s*m³?\s*\$([\d,\.]+)", stripped)
            if cd_m:
                cd_volumes.append(int(cd_m.group(1).replace(",", "")))
                cd_charges.append(float(cd_m.group(2).replace(",", "")))
                continue
            else:
                in_cd_block = False  # next non-matching line ends the CD block

        # ── Customer Charge ───────────────────────────────────────
        if stripped.startswith("Customer Charge"):
            customer_charge = _last_dollar(line)

        # ── Delivery to You ───────────────────────────────────────
        elif stripped.startswith("Delivery to You"):
            delivery_to_you = _last_dollar(line)

        # ── Load Balancing ────────────────────────────────────────
        elif stripped.startswith("Load Balancing"):
            load_balancing = _last_dollar(line)

        # ── Transportation to Enbridge ────────────────────────────
        elif stripped.startswith("Transportation to Enbridge"):
            transportation = _last_dollar(line)

        # ── Federal Carbon Charge (2024 invoices) ────────────────
        elif "Federal Carbon" in stripped or "Carbon Charge" in stripped:
            federal_carbon_charge = _last_dollar(line)

        # ── Gas Supply Charge (one or two lines for split periods) ─
        elif stripped.startswith("Gas Supply Charge"):
            val = _last_dollar(line)
            if val is not None:
                gas_supply_charges.append(val)

        # ── Volume annotation "(71,896 m³ @ 12.3008¢/m³)" ────────
        elif stripped.startswith("(") and "m³" in stripped and "@" in stripped:
            # extract volume string for split_volumes field
            vm = re.search(r"\(([\d,]+)\s*m³", stripped)
            if vm:
                gas_supply_vols.append(vm.group(1))

        # ── Cost Adjustment ───────────────────────────────────────
        elif stripped.startswith("Cost Adjustment"):
            cost_adjustment = _last_dollar(line)

        # ── Previous Bill Charge (mid-2024 invoices) ─────────────
        elif "Previous Bill" in stripped:
            previous_bill_charge = _last_dollar(line)

        # ── Charges for Natural Gas (= total excl HST) ───────────
        elif stripped.startswith("Charges for Natural Gas") and "$" in stripped:
            enbridge_invoice_cost_excl_hst = _last_dollar(line)

    # ── Derive CD fields ─────────────────────────────────────────
    if len(cd_charges) == 1:
        cd_1 = cd_charges[0]
        cd_2 = None
        cd_str = str(cd_volumes[0]) if cd_volumes else None
    elif len(cd_charges) == 2:
        cd_1 = cd_charges[0]
        cd_2 = cd_charges[1]
        cd_str = f"{cd_volumes[0]} & {cd_volumes[1]}" if len(cd_volumes) == 2 else None
    else:
        cd_1 = None
        cd_2 = None
        cd_str = None
        warnings.append(ValidationWarning(
            field="cd",
            message="Could not find Contract Demand Charge lines on page 2.",
            severity=ValidationSeverity.ERROR,
        ))

    # ── Derive Gas Supply fields ─────────────────────────────────
    if len(gas_supply_charges) >= 2:
        gas_supply_charge_1 = gas_supply_charges[0]
        gas_supply_charge_2 = gas_supply_charges[1]
        # Split volumes: annotated from the "(vol @ rate)" lines
        if len(gas_supply_vols) >= 2:
            split_volumes = f"{gas_supply_vols[0]} & {gas_supply_vols[1]}"
        else:
            split_volumes = None
            warnings.append(ValidationWarning(
                field="split_volumes",
                message="Two gas supply charges found but could not parse split volumes.",
                severity=ValidationSeverity.WARNING,
            ))
    elif len(gas_supply_charges) == 1:
        gas_supply_charge_1 = gas_supply_charges[0]
        gas_supply_charge_2 = None
        split_volumes = "N/A"
    else:
        gas_supply_charge_1 = None
        gas_supply_charge_2 = None
        split_volumes = None
        warnings.append(ValidationWarning(
            field="gas_supply_charge_1",
            message="Could not find Gas Supply Charge on page 2.",
            severity=ValidationSeverity.ERROR,
        ))

    # ── Validation for missing fields ─────────────────────────────
    mandatory = {
        "customer_charge": customer_charge,
        "delivery_to_you": delivery_to_you,
        "load_balancing": load_balancing,
        "transportation": transportation,
        "cost_adjustment": cost_adjustment,
        "enbridge_invoice_cost_excl_hst": enbridge_invoice_cost_excl_hst,
    }
    for field_name, val in mandatory.items():
        if val is None:
            warnings.append(ValidationWarning(
                field=field_name,
                message=f"Could not extract '{field_name}' from page 2.",
                severity=ValidationSeverity.ERROR,
            ))

    row = PickeringCngInvoiceSchema(
        enbridge_qtr_reference=enbridge_qtr_reference,
        start_date=start_date,
        end_date=end_date,
        billing_period=billing_period,
        meter_reading_previous=meter_previous,
        meter_reading_actual=meter_actual,
        cf_to_m3_conversion=cf_to_m3_conversion,
        cd=cd_str,
        gas_consumption=gas_consumption or 0.0,
        split_volumes=split_volumes,
        customer_charge=customer_charge,
        cd_1=cd_1,
        cd_2=cd_2,
        delivery_to_you=delivery_to_you,
        load_balancing=load_balancing,
        transportation=transportation,
        federal_carbon_charge=federal_carbon_charge,
        gas_supply_charge_1=gas_supply_charge_1,
        gas_supply_charge_2=gas_supply_charge_2,
        cost_adjustment=cost_adjustment,
        previous_bill_charge=previous_bill_charge,
        enbridge_invoice_cost_excl_hst=enbridge_invoice_cost_excl_hst or 0.0,
        source_pdf_filename=source_filename,
    )

    return [row], warnings

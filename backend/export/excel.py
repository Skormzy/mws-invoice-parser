"""
Excel export — replicates Melissa's tracker format exactly.

Enbridge trackers (Cambridge, Pickering CNG, Walgreen):
  Row 1 : site title (merged across all cols)
  Row 2 : Address
  Row 3 : Account Number
  Row 4 : Bill Number  (+  col B note for Cambridge/Pickering)
  Row 5 : Rate description
  Rows 6-7: empty (Walgreen row 7 has a note)
  Row 8 : column headers
  Row 9+: data

Elexicon tracker:
  Row 1 : group labels ("Distribution Charges" at col 10, "Other Charges" at col 14)
  Row 2 : column headers
  Row 3+: data
"""

from __future__ import annotations

import io
from datetime import date
from typing import Any

from openpyxl import Workbook


# ─────────────────────────────────────────────────────────────
# Site metadata (mirrors sites table seed data)
# ─────────────────────────────────────────────────────────────
_ENBRIDGE_META: dict[str, dict[str, Any]] = {
    "cambridge": {
        "sheet_name": "Cambridge CNG Invoice Tracking",
        "title": "Cambridge Enbridge CNG Invoice Tracking",
        "address": "Address: 2138 EAGLEST N, CAMBRIDGE ON N3H0A1",
        "account": "Account Number: 1183991",
        "bill": "Bill Number: BA4297",
        "bill_note": "<< in Sage",
        "rate": (
            "Rate:\n"
            " - Rate M4 Firm Industrial and Commercial (Contracted Demand= 30,500.0 m3)\n"
            " - Rate M5 Interruptible"
        ),
        "row7_note": None,
    },
    "pickering_cng": {
        "sheet_name": "Enbridge Invoice Comparison",
        "title": "Enbridge Invoice - Pickering",
        "address": "Address: 1250 SQUIRES BEACH RD CNG STATION PICKERING ON L1L 1L1",
        "account": "Account Number: 930610223601",
        "bill": "Bill Number: 107000512616",
        "bill_note": "<< bill number in sage (include private check box)",
        "rate": "Rate: Rate 100",
        "row7_note": None,
    },
    "walgreen": {
        "sheet_name": "Walgreen CNG Invoice Tracking",
        "title": "Walgreen Enbridge CNG Invoice Tracking",
        "address": "Address: 145 WALGREEN ROAD, CARP, ON K0A 1L0",
        "account": "Account Number: TBD",
        "bill": "Bill Number: TBD",
        "bill_note": None,
        "rate": (
            "Rate:\n"
            " - Rate 110 Firm - CD = 10,577 m3\n"
            " - Rate 145 Interruptible - CD = 10,577 m3"
        ),
        "row7_note": (
            "Will need to update the table below once an invoice is received for walgreen"
        ),
    },
}

# ─────────────────────────────────────────────────────────────
# Column header → schema field mappings (order = tracker column order)
# ─────────────────────────────────────────────────────────────
_CAMBRIDGE_COLS: list[tuple[str, str]] = [
    ("Enbridge Qtr Handbook Rate Reference", "enbridge_qtr_reference"),
    ("Start Date", "start_date"),
    ("End Date", "end_date"),
    ("Billing Period", "billing_period"),
    ("CD", "cd"),
    ("Gas Consumption", "gas_consumption"),
    ("Split Volumes", "split_volumes"),
    ("Demand Charge (First 8,450 m3 of CD", "demand_charge"),
    ("Delivery Charge - First 422,250 m3", "delivery_charge"),
    ("Monthly Charge - Interruptible", "monthly_charge_interruptible"),
    ("Gas Supply - Commodity", "gas_supply_commodity"),
    ("Gas Supply - Transportation", "gas_supply_transportation"),
    ("Commodity & Fuel - Price Adjustment", "commodity_fuel_price_adjustment"),
    ("Miscellaneous Charges", "miscellaneous_charges"),
    ("Enbridge Invoice Cost (Excluding HST)", "enbridge_invoice_cost_excl_hst"),
    ("$/m3", "cost_per_m3"),
]

_PICKERING_CNG_COLS: list[tuple[str, str]] = [
    ("Enbridge Qtr Handbook Rate Reference", "enbridge_qtr_reference"),
    ("Start Date", "start_date"),
    ("End Date", "end_date"),
    ("Billing Period", "billing_period"),
    ("Meter Reading Previous", "meter_reading_previous"),
    ("Meter Reading Actual", "meter_reading_actual"),
    ("CF to M3 Conversion", "cf_to_m3_conversion"),
    ("CD", "cd"),
    ("Gas Consumption", "gas_consumption"),
    ("Split Volumes", "split_volumes"),
    ("Customer Charge", "customer_charge"),
    ("CD _1", "cd_1"),
    ("CD_2", "cd_2"),
    ("Delivery To You", "delivery_to_you"),
    ("Load Balancing", "load_balancing"),
    ("Transportation", "transportation"),
    ("Federal Carbon Charge", "federal_carbon_charge"),
    ("Gas Supply Charge_1", "gas_supply_charge_1"),
    ("Gas Supply Charge_2", "gas_supply_charge_2"),
    ("Cost Adjustment", "cost_adjustment"),
    ("Previous Bill charge", "previous_bill_charge"),
    ("Enbridge Invoice Cost (Excluding HST)", "enbridge_invoice_cost_excl_hst"),
    ("$/m3", "cost_per_m3"),
]

_WALGREEN_COLS: list[tuple[str, str]] = [
    ("Enbridge Qtr Handbook Rate Reference", "enbridge_qtr_reference"),
    ("Rate", "rate"),
    ("Start Date", "start_date"),
    ("End Date", "end_date"),
    ("Days", "days"),
    ("CD_1", "cd_1"),
    ("CD_2", "cd_2"),
    ("Gas Consumption_1", "gas_consumption_1"),
    ("Gas Consumption_2", "gas_consumption_2"),
    ("Total Gas Consumption", "total_gas_consumption"),
    ("Customer Monthly Charge", "customer_monthly_charge"),
    ("Demand Charge", "demand_charge"),
    ("Demand Charge 2", "demand_charge_2"),
    ("Delivery Charge", "delivery_charge"),
    ("Loading Balance Charge", "load_balancing_charge"),
    ("Transportation", "transportation"),
    ("Gas Supply - Commodity", "gas_supply_commodity"),
    ("Gas Supply - Commodity_2", "gas_supply_commodity_2"),
    ("Cost Adjustment", "cost_adjustment"),
    ("Enbridge Invoice Cost (Excluding HST)", "enbridge_invoice_cost_excl_hst"),
    ("$/m3", "cost_per_m3"),
]

_ELEXICON_COLS: list[tuple[str, str]] = [
    ("Bill Period", "bill_period"),
    ("Read Period", "read_period"),
    ("Account Number", "account_number"),
    ("Service Type", "service_type"),
    ("Days", "days"),
    ("kWh used", "kwh_used"),
    ("Monthly Demand (kW)", "monthly_demand_kw"),
    ("Electricity ($/kWh)", "electricity_rate"),
    ("Global Adjuster ($)", "global_adjuster"),
    ("New Account Setup", "new_account_setup"),
    ("Delivery Charge", "delivery_charge"),
    ("Customer Charge", "customer_charge"),
    ("Interest Overdue Charge", "interest_overdue_charge"),
    ("SSS admin charge", "sss_admin_charge"),
    ("Electriciy", "electricity_cost"),          # tracker typo preserved
    ("Global Adjustment", "global_adjustment"),
    ("Global Adjustment Recovery", "global_adjustment_recovery"),
    ("Transmission Network Charge", "transmission_network"),
    ("Transmission Connection", "transmission_connection"),
    ("Wholesale Market Services", "wholesale_market_services"),
    ("H.S.T", "hst"),
    ("Total Charge", "total_charge"),
    ("Total Charge (Excluding HST & Overdue Interest Charges)", "total_charge_excl_hst_interest"),
    ("$/kWh", "cost_per_kwh"),
]

_DATE_FIELDS = {"start_date", "end_date", "billing_period"}

_SITE_COLS = {
    "cambridge": _CAMBRIDGE_COLS,
    "pickering_cng": _PICKERING_CNG_COLS,
    "walgreen": _WALGREEN_COLS,
    "pickering_elexicon": _ELEXICON_COLS,
}


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def export_to_excel(site_id: str, records: list[dict[str, Any]]) -> bytes:
    """Return raw bytes of an .xlsx workbook matching Melissa's tracker format."""
    wb = Workbook()
    ws = wb.active

    if site_id == "pickering_elexicon":
        _write_elexicon(ws, records)
    else:
        _write_enbridge(ws, site_id, records)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _coerce(field: str, val: Any) -> Any:
    """Convert ISO date strings to date objects for Excel date formatting."""
    if val is None:
        return None
    if field in _DATE_FIELDS and isinstance(val, str):
        try:
            return date.fromisoformat(val)
        except ValueError:
            return val
    return val


def _write_enbridge(ws, site_id: str, records: list[dict[str, Any]]) -> None:
    meta = _ENBRIDGE_META[site_id]
    cols = _SITE_COLS[site_id]
    ws.title = meta["sheet_name"]

    # Rows 1–5: site metadata
    ws.cell(row=1, column=1, value=meta["title"])
    ws.cell(row=2, column=1, value=meta["address"])
    ws.cell(row=3, column=1, value=meta["account"])
    ws.cell(row=4, column=1, value=meta["bill"])
    if meta["bill_note"]:
        ws.cell(row=4, column=2, value=meta["bill_note"])
    ws.cell(row=5, column=1, value=meta["rate"])
    # Row 7 note (Walgreen only)
    if meta["row7_note"]:
        ws.cell(row=7, column=1, value=meta["row7_note"])
    # Row 8: column headers
    for col_i, (header, _) in enumerate(cols, 1):
        ws.cell(row=8, column=col_i, value=header)
    # Rows 9+: data
    for row_i, record in enumerate(records, 9):
        for col_i, (_, field) in enumerate(cols, 1):
            ws.cell(row=row_i, column=col_i, value=_coerce(field, record.get(field)))


def _write_elexicon(ws, records: list[dict[str, Any]]) -> None:
    cols = _ELEXICON_COLS
    ws.title = "Past Elexicon Bill"
    # Row 1: group labels
    ws.cell(row=1, column=10, value="Distribution Charges")
    ws.cell(row=1, column=14, value="Other Charges")
    # Row 2: column headers
    for col_i, (header, _) in enumerate(cols, 1):
        ws.cell(row=2, column=col_i, value=header)
    # Rows 3+: data
    for row_i, record in enumerate(records, 3):
        for col_i, (_, field) in enumerate(cols, 1):
            ws.cell(row=row_i, column=col_i, value=record.get(field))

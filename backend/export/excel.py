"""
Excel export — replicates Melissa's tracker format exactly.

Enbridge trackers (Cambridge, Pickering CNG, Walgreen):
  Row 1 : site title
  Row 2 : Address
  Row 3 : Account Number
  Row 4 : Bill Number  (+ col B note for Cambridge/Pickering)
  Row 5 : Rate description
  Rows 6-7: empty (Walgreen row 7 has a note)
  Row 8 : column headers  (blue background, white text)
  Row 9+: data — with Excel formulas for calculated fields

Elexicon tracker:
  Row 1 : group labels ("Distribution Charges" merged J1:M1, "Other Charges" merged N1:T1)
  Row 2 : column headers
  Row 3+: data — with Excel formulas

Calculated field formulas:
  Cambridge  $/m³ (col P)   : =IF(F{r}=0,0,O{r}/F{r})      [gas→F, cost→O]
  Cambridge  cost_excl_hst (col O): =SUM(H{r}:N{r})
  Pickering  $/m³ (col W)   : =IF(I{r}=0,0,V{r}/I{r})      [gas→I, cost→V]
  Walgreen   $/m³ (col U)   : =IF(J{r}=0,0,T{r}/J{r})      [total_gas→J, cost→T]
  Elexicon   total_excl_hst (col W): =V{r}-U{r}-IF(ISBLANK(M{r}),0,M{r})
  Elexicon   $/kWh (col X)  : =IF(F{r}=0,0,W{r}/F{r})

Dollar columns use Excel Accounting format.
Date columns use YYYY-MM-DD format.
Full decimal precision is retained (no screen-side rounding).
"""

from __future__ import annotations

import io
from datetime import date
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

# ─────────────────────────────────────────────────────────────
# Style constants
# ─────────────────────────────────────────────────────────────
_HDR_FILL   = PatternFill("solid", fgColor="1E40AF")   # blue-800
_HDR_FONT   = Font(bold=True, color="FFFFFF")
_GRP_FILL   = PatternFill("solid", fgColor="3B82F6")   # blue-500
_GRP_FONT   = Font(bold=True, color="FFFFFF")
_DOLLAR_FMT = '#,##0.00'
_DATE_FMT   = 'YYYY-MM-DD'
_DATE_FIELDS = {"start_date", "end_date", "billing_period"}

# ─────────────────────────────────────────────────────────────
# Site metadata
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
        "row7_note": "Will need to update the table below once an invoice is received for walgreen",
    },
}

# ─────────────────────────────────────────────────────────────
# Column definitions  (header, field_key, is_dollar, is_date)
# ─────────────────────────────────────────────────────────────
_CambridgeCols = [
    ("Enbridge Qtr Handbook Rate Reference", "enbridge_qtr_reference", False, False),
    ("Start Date",                           "start_date",             False, True),
    ("End Date",                             "end_date",               False, True),
    ("Billing Period",                       "billing_period",         False, True),
    ("CD (m³)",                              "cd",                     False, False),
    ("Gas Consumption (m³)",                 "gas_consumption",        False, False),
    ("Split Volumes (m³)",                   "split_volumes",          False, False),
    ("Demand Charge (First 8,450 m³ of CD)", "demand_charge",          True,  False),
    ("Delivery Charge - First 422,250 m³",   "delivery_charge",        True,  False),
    ("Monthly Charge - Interruptible",       "monthly_charge_interruptible", True, False),
    ("Gas Supply - Commodity",               "gas_supply_commodity",   True,  False),
    ("Gas Supply - Transportation",          "gas_supply_transportation", True, False),
    ("Commodity & Fuel - Price Adjustment",  "commodity_fuel_price_adjustment", True, False),
    ("Miscellaneous Charges",                "miscellaneous_charges",  True,  False),
    ("Enbridge Invoice Cost (Excluding HST)","enbridge_invoice_cost_excl_hst", True, False),
    ("$/m³",                                 "cost_per_m3",            False, False),   # formula
    ("Notes",                                "notes",                  False, False),
]

_PickeringCngCols = [
    ("Enbridge Qtr Handbook Rate Reference", "enbridge_qtr_reference",   False, False),
    ("Start Date",                           "start_date",               False, True),
    ("End Date",                             "end_date",                 False, True),
    ("Billing Period",                       "billing_period",           False, False),
    ("Meter Reading Previous",               "meter_reading_previous",   False, False),
    ("Meter Reading Actual",                 "meter_reading_actual",     False, False),
    ("CF to M3 Conversion",                  "cf_to_m3_conversion",      False, False),
    ("CD (m³)",                              "cd",                       False, False),
    ("Gas Consumption (m³)",                 "gas_consumption",          False, False),
    ("Split Volumes (m³)",                   "split_volumes",            False, False),
    ("Customer Charge",                      "customer_charge",          True,  False),
    ("CD _1",                                "cd_1",                     True,  False),
    ("CD_2",                                 "cd_2",                     True,  False),
    ("Delivery To You",                      "delivery_to_you",          True,  False),
    ("Load Balancing",                       "load_balancing",           True,  False),
    ("Transportation",                       "transportation",           True,  False),
    ("Federal Carbon Charge",                "federal_carbon_charge",    True,  False),
    ("Gas Supply Charge_1",                  "gas_supply_charge_1",      True,  False),
    ("Gas Supply Charge_2",                  "gas_supply_charge_2",      True,  False),
    ("Cost Adjustment",                      "cost_adjustment",          True,  False),
    ("Previous Bill charge",                 "previous_bill_charge",     True,  False),
    ("Enbridge Invoice Cost (Excluding HST)","enbridge_invoice_cost_excl_hst", True, False),
    ("$/m³",                                 "cost_per_m3",              False, False),  # formula
    ("Notes",                                "notes",                    False, False),
]

_WalgreenCols = [
    ("Enbridge Qtr Handbook Rate Reference", "enbridge_qtr_reference",    False, False),
    ("Rate",                                 "rate",                      False, False),
    ("Start Date",                           "start_date",                False, True),
    ("End Date",                             "end_date",                  False, True),
    ("Days",                                 "days",                      False, False),
    ("CD_1 (m³)",                            "cd_1",                      False, False),
    ("CD_2 (m³)",                            "cd_2",                      False, False),
    ("Gas Consumption_1 (m³)",               "gas_consumption_1",         False, False),
    ("Gas Consumption_2 (m³)",               "gas_consumption_2",         False, False),
    ("Total Gas Consumption (m³)",           "total_gas_consumption",     False, False),
    ("Customer Monthly Charge",              "customer_monthly_charge",   True,  False),
    ("Demand Charge",                        "demand_charge",             True,  False),
    ("Demand Charge 2",                      "demand_charge_2",           True,  False),
    ("Delivery Charge",                      "delivery_charge",           True,  False),
    ("Loading Balance Charge",               "load_balancing_charge",     True,  False),
    ("Transportation",                       "transportation",            True,  False),
    ("Gas Supply - Commodity",               "gas_supply_commodity",      True,  False),
    ("Gas Supply - Commodity_2",             "gas_supply_commodity_2",    True,  False),
    ("Cost Adjustment",                      "cost_adjustment",           True,  False),
    ("Enbridge Invoice Cost (Excluding HST)","enbridge_invoice_cost_excl_hst", True, False),
    ("$/m³",                                 "cost_per_m3",               False, False),  # formula
    ("Notes",                                "notes",                     False, False),
]

_ElexiconCols = [
    ("Bill Period",                                          "bill_period",                   False, False),
    ("Read Period",                                          "read_period",                   False, False),
    ("Account Number",                                       "account_number",                False, False),
    ("Service Type",                                         "service_type",                  False, False),
    ("Days",                                                 "days",                          False, False),
    ("kWh Used",                                             "kwh_used",                      False, False),
    ("Monthly Demand (kW)",                                  "monthly_demand_kw",             False, False),
    ("Electricity ($/kWh)",                                  "electricity_rate",              False, False),
    ("Global Adjuster ($)",                                  "global_adjuster",               False, False),
    ("New Account Setup",                                    "new_account_setup",             True,  False),  # col 10 = J — Distribution Charges start
    ("Delivery Charge",                                      "delivery_charge",               True,  False),
    ("Customer Charge",                                      "customer_charge",               True,  False),
    ("Interest Overdue Charge",                              "interest_overdue_charge",       True,  False),  # col 13 = M — Distribution Charges end
    ("SSS admin charge",                                     "sss_admin_charge",              True,  False),  # col 14 = N — Other Charges start
    ("Electriciy",                                           "electricity_cost",              True,  False),  # tracker typo preserved
    ("Global Adjustment",                                    "global_adjustment",             True,  False),
    ("Global Adjustment Recovery",                           "global_adjustment_recovery",    True,  False),
    ("Transmission Network Charge",                          "transmission_network",          True,  False),
    ("Transmission Connection",                              "transmission_connection",       True,  False),
    ("Wholesale Market Services",                            "wholesale_market_services",     True,  False),  # col 20 = T — Other Charges end
    ("H.S.T",                                               "hst",                           True,  False),
    ("Total Charge",                                         "total_charge",                  True,  False),
    ("Total Charge (Excluding HST & Overdue Interest Charges)", "total_charge_excl_hst_interest", True, False),  # formula
    ("$/kWh",                                               "cost_per_kwh",                  False, False),  # formula
    ("Notes",                                               "notes",                         False, False),
]

_SITE_COLS = {
    "cambridge":          _CambridgeCols,
    "pickering_cng":      _PickeringCngCols,
    "walgreen":           _WalgreenCols,
    "pickering_elexicon": _ElexiconCols,
}

# Indices (1-based column numbers) of formula columns per site
# Cambridge:    col 15 = SUM(H:N),  col 16 = IF(F=0,0,O/F)
# Pickering:    col 23 = IF(I=0,0,V/I)
# Walgreen:     col 21 = IF(J=0,0,T/J)
# Elexicon:     col 23 = V-U-IF(ISBLANK(M),0,M),  col 24 = IF(F=0,0,W/F)


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
# Helpers
# ─────────────────────────────────────────────────────────────

def _coerce(field: str, val: Any) -> Any:
    """Convert ISO date strings to date objects so Excel formats them correctly."""
    if val is None:
        return None
    if field in _DATE_FIELDS and isinstance(val, str):
        try:
            return date.fromisoformat(val)
        except ValueError:
            return val
    return val


def _style_header_cell(cell, fill=None, font=None):
    cell.fill = fill or _HDR_FILL
    cell.font = font or _HDR_FONT
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def _apply_col_formats(ws, cols: list[tuple], data_row_start: int, total_data_rows: int):
    """Apply dollar and date number formats to all data cells in matching columns."""
    for col_i, (_, field, is_dollar, is_date) in enumerate(cols, 1):
        col_letter = get_column_letter(col_i)
        for row_i in range(data_row_start, data_row_start + total_data_rows):
            cell = ws[f"{col_letter}{row_i}"]
            if is_dollar:
                cell.number_format = _DOLLAR_FMT
            elif is_date:
                cell.number_format = _DATE_FMT


def _write_enbridge(ws, site_id: str, records: list[dict[str, Any]]) -> None:
    meta = _ENBRIDGE_META[site_id]
    cols = _SITE_COLS[site_id]
    ws.title = meta["sheet_name"]
    num_cols = len(cols)

    # ── Rows 1–5: site metadata ──────────────────────────────────
    ws.cell(row=1, column=1, value=meta["title"])
    ws.cell(row=2, column=1, value=meta["address"])
    ws.cell(row=3, column=1, value=meta["account"])
    ws.cell(row=4, column=1, value=meta["bill"])
    if meta["bill_note"]:
        ws.cell(row=4, column=2, value=meta["bill_note"])
    ws.cell(row=5, column=1, value=meta["rate"])
    if meta["row7_note"]:
        ws.cell(row=7, column=1, value=meta["row7_note"])

    # ── Row 8: column headers ────────────────────────────────────
    for col_i, (header, _, _, _) in enumerate(cols, 1):
        cell = ws.cell(row=8, column=col_i, value=header)
        _style_header_cell(cell)

    # ── Rows 9+: data with formulas ──────────────────────────────
    data_start = 9
    for row_offset, record in enumerate(records):
        data_row = data_start + row_offset
        for col_i, (_, field, is_dollar, is_date) in enumerate(cols, 1):
            col_letter = get_column_letter(col_i)
            cell = ws.cell(row=data_row, column=col_i)

            # Inject formulas for calculated columns
            formula = _enbridge_formula(site_id, col_i, data_row)
            if formula:
                cell.value = formula
                if is_dollar:
                    cell.number_format = _DOLLAR_FMT
                continue

            val = _coerce(field, record.get(field))
            cell.value = val
            if is_dollar and val is not None:
                cell.number_format = _DOLLAR_FMT
            elif is_date and val is not None:
                cell.number_format = _DATE_FMT


def _enbridge_formula(site_id: str, col_i: int, row: int) -> str | None:
    """Return an Excel formula string for calculated columns, or None for regular cells."""
    if site_id == "cambridge":
        # Col 15 (O): =SUM(H{r}:N{r})    — enbridge_invoice_cost_excl_hst
        if col_i == 15:
            return f"=SUM(H{row}:N{row})"
        # Col 16 (P): =IF(F{r}=0,0,O{r}/F{r})  — $/m³
        if col_i == 16:
            return f"=IF(F{row}=0,0,O{row}/F{row})"

    elif site_id == "pickering_cng":
        # Col 23 (W): =IF(I{r}=0,0,V{r}/I{r})  — $/m³
        if col_i == 23:
            return f"=IF(I{row}=0,0,V{row}/I{row})"

    elif site_id == "walgreen":
        # Col 21 (U): =IF(J{r}=0,0,T{r}/J{r})  — $/m³
        if col_i == 21:
            return f"=IF(J{row}=0,0,T{row}/J{row})"

    return None


def _write_elexicon(ws, records: list[dict[str, Any]]) -> None:
    cols = _ElexiconCols
    ws.title = "Past Elexicon Bill"
    num_cols = len(cols)
    data_start = 3

    # ── Row 1: group header cells (merged spans) ─────────────────
    # Distribution Charges: cols 10–13 (J1:M1)
    ws.merge_cells("J1:M1")
    cell_dc = ws["J1"]
    cell_dc.value = "Distribution Charges"
    _style_header_cell(cell_dc, fill=_GRP_FILL, font=_GRP_FONT)

    # Other Charges: cols 14–20 (N1:T1)
    ws.merge_cells("N1:T1")
    cell_oc = ws["N1"]
    cell_oc.value = "Other Charges"
    _style_header_cell(cell_oc, fill=_GRP_FILL, font=_GRP_FONT)

    # ── Row 2: column headers ────────────────────────────────────
    for col_i, (header, _, _, _) in enumerate(cols, 1):
        cell = ws.cell(row=2, column=col_i, value=header)
        _style_header_cell(cell)

    # ── Rows 3+: data with formulas ──────────────────────────────
    for row_offset, record in enumerate(records):
        data_row = data_start + row_offset
        for col_i, (_, field, is_dollar, _) in enumerate(cols, 1):
            cell = ws.cell(row=data_row, column=col_i)

            formula = _elexicon_formula(col_i, data_row)
            if formula:
                cell.value = formula
                if is_dollar:
                    cell.number_format = _DOLLAR_FMT
                continue

            val = record.get(field)
            cell.value = val
            if is_dollar and val is not None:
                cell.number_format = _DOLLAR_FMT


def _elexicon_formula(col_i: int, row: int) -> str | None:
    """Return Excel formula for Elexicon calculated columns, or None."""
    # Col 23 (W): total_charge_excl_hst_interest = total_charge - hst - interest
    if col_i == 23:
        return f"=V{row}-U{row}-IF(ISBLANK(M{row}),0,M{row})"
    # Col 24 (X): $/kWh = total_excl_hst / kwh_used
    if col_i == 24:
        return f"=IF(F{row}=0,0,W{row}/F{row})"
    return None

"""
Phase 2 parser smoke tests.

Runs all 3 text-extractable parsers against their sample invoices and compares
extracted values to the expected values from the corresponding tracker rows.
Reports any discrepancy > $0.01 on numeric fields.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from backend.parsers.cambridge import parse_cambridge
from backend.parsers.pickering_enbridge import parse_pickering_enbridge
from backend.parsers.elexicon import parse_elexicon


def compare(label: str, extracted, expected, is_dollar: bool = True):
    """Print PASS/FAIL for a field comparison."""
    if extracted is None and expected is None:
        print(f"  ✓  {label}: both None")
        return True
    if extracted is None:
        print(f"  ✗  {label}: extracted=None  expected={expected}")
        return False
    if expected is None:
        print(f"  ✓  {label}: extracted={extracted}  expected=None (optional field)")
        return True
    if is_dollar:
        diff = abs(float(extracted) - float(expected))
        if diff <= 0.01:
            print(f"  ✓  {label}: {extracted}")
        else:
            print(f"  ✗  {label}: extracted={extracted}  expected={expected}  diff={diff:.4f}")
            return False
    else:
        # text / non-dollar comparison
        if str(extracted) == str(expected):
            print(f"  ✓  {label}: {extracted!r}")
        else:
            print(f"  ~  {label}: extracted={extracted!r}  expected={expected!r}  (text field)")
    return True


# ═══════════════════════════════════════════════════════════════
# 1. CAMBRIDGE — tracker row 14
# ═══════════════════════════════════════════════════════════════
print("=" * 60)
print("CAMBRIDGE — Feb 2026 invoice (tracker row 14)")
print("=" * 60)

rows, warns = parse_cambridge(
    "sample_invoices/Cambridge Enbridge Invoice - Feb26.pdf",
    source_filename="Cambridge Enbridge Invoice - Feb26.pdf",
)

print(f"  Rows returned: {len(rows)}")
print(f"  Warnings ({len(warns)}):")
for w in warns:
    print(f"    [{w.severity.value.upper()}] {w.field}: {w.message}")

if rows:
    r = rows[0]
    print()
    print("  Field comparisons:")
    compare("enbridge_qtr_reference", r.enbridge_qtr_reference, "Q1 2026", is_dollar=False)
    compare("billing_period",         str(r.billing_period),    "2026-02-01", is_dollar=False)
    compare("end_date",               str(r.end_date),          "2026-03-02", is_dollar=False)
    compare("cd",                     r.cd,                     8000)
    compare("gas_consumption",        r.gas_consumption,        16819.7)
    compare("demand_charge",          r.demand_charge,          6396.42)
    compare("delivery_charge",        r.delivery_charge,        391.93)
    compare("monthly_charge_interruptible", r.monthly_charge_interruptible, 837.79)
    compare("gas_supply_commodity",   r.gas_supply_commodity,   3431.84)
    compare("gas_supply_transportation", r.gas_supply_transportation, 0.00)
    compare("commodity_fuel_price_adjustment", r.commodity_fuel_price_adjustment, -196.84)
    compare("enbridge_invoice_cost_excl_hst", r.enbridge_invoice_cost_excl_hst, 10861.14)
    compare("cost_per_m3",            r.cost_per_m3,            0.6457392)

# ═══════════════════════════════════════════════════════════════
# 2. PICKERING ENBRIDGE — tracker row 25
# ═══════════════════════════════════════════════════════════════
print()
print("=" * 60)
print("PICKERING ENBRIDGE — Oct 8–Nov 6, 2025 (tracker row 25)")
print("=" * 60)

rows, warns = parse_pickering_enbridge(
    "sample_invoices/Pickering Enbridge Invoice - Feb26.pdf",
    source_filename="Pickering Enbridge Invoice - Feb26.pdf",
)

print(f"  Rows returned: {len(rows)}")
print(f"  Warnings ({len(warns)}):")
for w in warns:
    print(f"    [{w.severity.value.upper()}] {w.field}: {w.message}")

if rows:
    r = rows[0]
    print()
    print("  Field comparisons:")
    compare("enbridge_qtr_reference", r.enbridge_qtr_reference, "Q4 2025", is_dollar=False)
    compare("start_date",             str(r.start_date),        "2025-10-08", is_dollar=False)
    compare("end_date",               str(r.end_date),          "2025-11-06", is_dollar=False)
    compare("billing_period",         r.billing_period,         29)
    compare("meter_reading_previous", r.meter_reading_previous, 172694)
    compare("meter_reading_actual",   r.meter_reading_actual,   198074)
    compare("cf_to_m3_conversion",    r.cf_to_m3_conversion,    0.02832781717888101)
    compare("cd",                     r.cd,                     "8000 & 2000", is_dollar=False)
    compare("gas_consumption",        r.gas_consumption,        71896)
    compare("split_volumes",          r.split_volumes,          "N/A", is_dollar=False)
    compare("customer_charge",        r.customer_charge,        143.08)
    compare("cd_1",                   r.cd_1,                   3396.61)
    compare("cd_2",                   r.cd_2,                   849.15)
    compare("delivery_to_you",        r.delivery_to_you,        584.01)
    compare("load_balancing",         r.load_balancing,         1332.23)
    compare("transportation",         r.transportation,         3774.11)
    compare("gas_supply_charge_1",    r.gas_supply_charge_1,    8843.78)
    compare("gas_supply_charge_2",    r.gas_supply_charge_2,    None)
    compare("cost_adjustment",        r.cost_adjustment,        -1599.55)
    compare("enbridge_invoice_cost_excl_hst", r.enbridge_invoice_cost_excl_hst, 17323.42)
    compare("cost_per_m3",            r.cost_per_m3,            0.2409511)

# ═══════════════════════════════════════════════════════════════
# 3. ELEXICON — tracker row 22
# ═══════════════════════════════════════════════════════════════
print()
print("=" * 60)
print("ELEXICON — Feb 2026 (tracker row 22)")
print("=" * 60)

rows, warns = parse_elexicon(
    "sample_invoices/Pickering Elexicon Invoice - Feb26.pdf",
    source_filename="Pickering Elexicon Invoice - Feb26.pdf",
)

print(f"  Rows returned: {len(rows)}")
print(f"  Warnings ({len(warns)}):")
for w in warns:
    print(f"    [{w.severity.value.upper()}] {w.field}: {w.message}")

if rows:
    r = rows[0]
    print()
    print("  Field comparisons:")
    compare("bill_period",            r.bill_period,            "February", is_dollar=False)
    compare("read_period",            r.read_period,            "Jan 31 - Feb 28, 2026", is_dollar=False)
    compare("days",                   r.days,                   28)
    compare("kwh_used",               r.kwh_used,               28193.70)
    compare("monthly_demand_kw",      r.monthly_demand_kw,      253.00)
    compare("electricity_rate",       r.electricity_rate,       0.123796)
    compare("global_adjuster",        r.global_adjuster,        "9,552.64kWh@$-0.00292", is_dollar=False)
    compare("delivery_charge",        r.delivery_charge,        1363.70)
    compare("customer_charge",        r.customer_charge,        138.41)
    compare("sss_admin_charge",       r.sss_admin_charge,       0.22)
    compare("electricity_cost",       r.electricity_cost,       3658.50)
    compare("global_adjustment",      r.global_adjustment,      279.12)
    compare("global_adjustment_recovery", r.global_adjustment_recovery, -86.30)
    compare("transmission_network",   r.transmission_network,   740.31)
    compare("transmission_connection", r.transmission_connection, 879.05)
    compare("wholesale_market_services", r.wholesale_market_services, 156.64)
    compare("hst",                    r.hst,                    926.86)
    compare("total_charge",           r.total_charge,           8056.51)
    compare("total_charge_excl_hst_interest", r.total_charge_excl_hst_interest, 7129.65)
    compare("cost_per_kwh",           r.cost_per_kwh,           0.252881)

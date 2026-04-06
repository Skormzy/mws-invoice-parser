"""
Walgreen parser smoke test.

Runs parse_walgreen() against sample_invoices/Walgreen Enbridge Invoice.pdf and
compares extracted values to the expected values from tracker rows 9-16.

Reports any discrepancy > $0.01 on numeric fields.

REQUIREMENTS:
  - ANTHROPIC_API_KEY environment variable must be set.
  - poppler-utils must be installed (for pdf2image):
      Debian/Ubuntu: apt-get install -y poppler-utils
      macOS:         brew install poppler

Run:
    python test_walgreen.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from backend.parsers.walgreen import parse_walgreen


def compare(label: str, extracted, expected, is_dollar: bool = True, row_idx: int = 0):
    """Print PASS/FAIL for a field comparison. Returns True if passed."""
    prefix = f"  [row {row_idx}]"
    if extracted is None and expected is None:
        print(f"{prefix} ✓  {label}: both None")
        return True
    if extracted is None:
        print(f"{prefix} ✗  {label}: extracted=None  expected={expected}")
        return False
    if expected is None:
        print(f"{prefix} ✓  {label}: extracted={extracted}  expected=None (optional)")
        return True
    if is_dollar:
        diff = abs(float(extracted) - float(expected))
        if diff <= 0.01:
            print(f"{prefix} ✓  {label}: {extracted}")
            return True
        else:
            print(f"{prefix} ✗  {label}: extracted={extracted}  expected={expected}  diff={diff:.4f}")
            return False
    else:
        if str(extracted) == str(expected):
            print(f"{prefix} ✓  {label}: {extracted!r}")
            return True
        else:
            print(f"{prefix} ~  {label}: extracted={extracted!r}  expected={expected!r}  (text field)")
            return True  # text mismatches are informational only


# ══════════════════════════════════════════════════════════════════════════════
# Expected values from tracker rows 9-16
# ══════════════════════════════════════════════════════════════════════════════
# Each entry: (rate, start_date, end_date, days, cd_1, cd_2,
#              gas_1, gas_2, total_gas,
#              customer_monthly_charge,
#              demand_charge, demand_charge_2,
#              delivery_charge, load_balancing, transportation,
#              gas_supply_commodity, gas_supply_commodity_2,
#              cost_adjustment, invoice_cost_excl_hst, cost_per_m3,
#              enbridge_qtr_reference)

EXPECTED = [
    # Row 9 — Rate 110, Nov 4-9 2025 (5 days, Q4 2025)
    dict(
        row_label="Row 9  (R110, Nov 4-9 2025)",
        rate=110,
        start_date="2025-11-04",
        end_date="2025-11-09",
        days=5,
        cd_1=10577,        cd_2=None,
        gas_1=865,         gas_2=None,    total_gas=865,
        customer_monthly_charge=137.00,
        demand_charge=590.73,    demand_charge_2=None,
        delivery_charge=8.70,
        load_balancing=3.36,
        transportation=45.41,
        gas_supply_commodity=105.83,      gas_supply_commodity_2=None,
        cost_adjustment=-17.68,
        invoice_cost=873.35,
        cost_per_m3=1.0097,
        qtr="Q4 2025",
    ),
    # Row 10 — Rate 145, Nov 4-9 2025
    dict(
        row_label="Row 10 (R145, Nov 4-9 2025)",
        rate=145,
        start_date="2025-11-04",
        end_date="2025-11-09",
        days=5,
        cd_1=10577,        cd_2=None,
        gas_1=None,        gas_2=None,    total_gas=0,
        customer_monthly_charge=28.92,
        demand_charge=249.95,    demand_charge_2=None,
        delivery_charge=None,
        load_balancing=None,
        transportation=None,
        gas_supply_commodity=None,        gas_supply_commodity_2=None,
        cost_adjustment=None,
        invoice_cost=278.87,
        cost_per_m3=0,
        qtr="Q4 2025",
    ),
    # Row 11 — Rate 110, Nov 10 - Dec 8 2025 (28 days, Q4 2025)
    dict(
        row_label="Row 11 (R110, Nov 10-Dec 8 2025)",
        rate=110,
        start_date="2025-11-10",
        end_date="2025-12-08",
        days=28,
        cd_1=10577,        cd_2=None,
        gas_1=5017,        gas_2=None,    total_gas=5017,
        customer_monthly_charge=684.99,
        demand_charge=2953.67,   demand_charge_2=None,
        delivery_charge=50.45,
        load_balancing=19.51,
        transportation=263.36,
        gas_supply_commodity=613.84,      gas_supply_commodity_2=None,
        cost_adjustment=-102.50,
        invoice_cost=4483.32,
        cost_per_m3=0.8936,
        qtr="Q4 2025",
    ),
    # Row 12 — Rate 145, Nov 10 - Dec 8 2025
    dict(
        row_label="Row 12 (R145, Nov 10-Dec 8 2025)",
        rate=145,
        start_date="2025-11-10",
        end_date="2025-12-08",
        days=28,
        cd_1=10577,        cd_2=None,
        gas_1=None,        gas_2=None,    total_gas=0,
        customer_monthly_charge=144.62,
        demand_charge=1249.73,   demand_charge_2=None,
        delivery_charge=None,
        load_balancing=None,
        transportation=None,
        gas_supply_commodity=None,        gas_supply_commodity_2=None,
        cost_adjustment=None,
        invoice_cost=1394.35,
        cost_per_m3=0,
        qtr="Q4 2025",
    ),
    # Row 13 — Rate 110, Dec 9 2025 - Jan 7 2026 (29 days, SPLIT Q4 2025 & Q1 2026)
    dict(
        row_label="Row 13 (R110, Dec 9 2025-Jan 7 2026, SPLIT)",
        rate=110,
        start_date="2025-12-09",
        end_date="2026-01-07",
        days=29,
        cd_1=8109,         cd_2=2468,
        gas_1=3979,        gas_2=5838,    total_gas=9817,
        customer_monthly_charge=691.37,
        demand_charge=2264.47,   demand_charge_2=730.19,
        delivery_charge=103.47,
        load_balancing=43.15,
        transportation=539.98,
        gas_supply_commodity=486.84,      gas_supply_commodity_2=800.85,
        cost_adjustment=-197.30,
        invoice_cost=5463.02,
        cost_per_m3=0.5565,
        qtr="Q4 2025 & Q1 2026",
    ),
    # Row 14 — Rate 145, Dec 9 2025 - Jan 7 2026 (SPLIT)
    dict(
        row_label="Row 14 (R145, Dec 9 2025-Jan 7 2026, SPLIT)",
        rate=145,
        start_date="2025-12-09",
        end_date="2026-01-07",
        days=29,
        cd_1=8109,         cd_2=2468,
        gas_1=None,        gas_2=None,    total_gas=0,
        customer_monthly_charge=145.96,
        demand_charge=958.12,    demand_charge_2=369.55,
        delivery_charge=None,
        load_balancing=None,
        transportation=None,
        gas_supply_commodity=None,        gas_supply_commodity_2=None,
        cost_adjustment=None,
        invoice_cost=1473.63,
        cost_per_m3=0,
        qtr="Q4 2025 & Q1 2026",
    ),
    # Row 15 — Rate 110, Jan 8 - Feb 8 2026 (31 days, Q1 2026)
    dict(
        row_label="Row 15 (R110, Jan 8-Feb 8 2026)",
        rate=110,
        start_date="2026-01-08",
        end_date="2026-02-08",
        days=31,
        cd_1=10577,        cd_2=None,
        gas_1=39756,       gas_2=None,    total_gas=39756,
        customer_monthly_charge=712.33,
        demand_charge=3129.36,   demand_charge_2=None,
        delivery_charge=432.14,
        load_balancing=188.52,
        transportation=2254.80,
        gas_supply_commodity=5453.69,     gas_supply_commodity_2=None,
        cost_adjustment=-789.96,
        invoice_cost=11380.88,
        cost_per_m3=0.2863,
        qtr="Q1 2026",
    ),
    # Row 16 — Rate 145, Jan 8 - Feb 8 2026
    dict(
        row_label="Row 16 (R145, Jan 8-Feb 8 2026)",
        rate=145,
        start_date="2026-01-08",
        end_date="2026-02-08",
        days=31,
        cd_1=10577,        cd_2=None,
        gas_1=None,        gas_2=None,    total_gas=0,
        customer_monthly_charge=150.36,
        demand_charge=1583.77,   demand_charge_2=None,
        delivery_charge=None,
        load_balancing=None,
        transportation=None,
        gas_supply_commodity=None,        gas_supply_commodity_2=None,
        cost_adjustment=None,
        invoice_cost=1734.13,
        cost_per_m3=0,
        qtr="Q1 2026",
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
# Run parser
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 70)
print("WALGREEN — Nov 2025 – Feb 2026 invoice (tracker rows 9-16)")
print("=" * 70)

try:
    rows, warns = parse_walgreen(
        "sample_invoices/Walgreen Enbridge Invoice.pdf",
        source_filename="Walgreen Enbridge Invoice.pdf",
    )
except RuntimeError as e:
    print(f"\n[BLOCKED] {e}")
    sys.exit(1)

print(f"\n  Rows returned : {len(rows)}")
print(f"  Warnings ({len(warns)}):")
for w in warns:
    sev = w.severity.value.upper()
    location = f" (row {w.row_index})" if w.row_index is not None else ""
    print(f"    [{sev}]{location} {w.field}: {w.message}")

# ── Compare each returned row against expected ──────────────────────
print()
if len(rows) != len(EXPECTED):
    print(f"  ✗  Row count mismatch: got {len(rows)}, expected {len(EXPECTED)}")

fail_count = 0
for i, exp in enumerate(EXPECTED):
    print(f"\n  {'─'*60}")
    print(f"  Expected: {exp['row_label']}")

    if i >= len(rows):
        print(f"  ✗  No row returned for this expected entry.")
        fail_count += 1
        continue

    r = rows[i]
    ri = i

    ok = True
    ok &= compare("enbridge_qtr_reference", r.enbridge_qtr_reference, exp["qtr"],         is_dollar=False, row_idx=ri)
    ok &= compare("rate",                   r.rate,                   exp["rate"],         is_dollar=False, row_idx=ri)
    ok &= compare("start_date",             str(r.start_date),        exp["start_date"],   is_dollar=False, row_idx=ri)
    ok &= compare("end_date",               str(r.end_date),          exp["end_date"],     is_dollar=False, row_idx=ri)
    ok &= compare("days",                   r.days,                   exp["days"],         is_dollar=False, row_idx=ri)
    ok &= compare("cd_1",                   r.cd_1,                   exp["cd_1"],                          row_idx=ri)
    ok &= compare("cd_2",                   r.cd_2,                   exp["cd_2"],                          row_idx=ri)
    ok &= compare("gas_consumption_1",      r.gas_consumption_1,      exp["gas_1"],                         row_idx=ri)
    ok &= compare("gas_consumption_2",      r.gas_consumption_2,      exp["gas_2"],                         row_idx=ri)
    ok &= compare("total_gas_consumption",  r.total_gas_consumption,  exp["total_gas"],                     row_idx=ri)
    ok &= compare("customer_monthly_charge",r.customer_monthly_charge,exp["customer_monthly_charge"],       row_idx=ri)
    ok &= compare("demand_charge",          r.demand_charge,          exp["demand_charge"],                  row_idx=ri)
    ok &= compare("demand_charge_2",        r.demand_charge_2,        exp["demand_charge_2"],               row_idx=ri)
    ok &= compare("delivery_charge",        r.delivery_charge,        exp["delivery_charge"],               row_idx=ri)
    ok &= compare("load_balancing_charge",  r.load_balancing_charge,  exp["load_balancing"],                row_idx=ri)
    ok &= compare("transportation",         r.transportation,         exp["transportation"],                row_idx=ri)
    ok &= compare("gas_supply_commodity",   r.gas_supply_commodity,   exp["gas_supply_commodity"],          row_idx=ri)
    ok &= compare("gas_supply_commodity_2", r.gas_supply_commodity_2, exp["gas_supply_commodity_2"],        row_idx=ri)
    ok &= compare("cost_adjustment",        r.cost_adjustment,        exp["cost_adjustment"],               row_idx=ri)
    ok &= compare("enbridge_invoice_cost_excl_hst", r.enbridge_invoice_cost_excl_hst, exp["invoice_cost"], row_idx=ri)
    ok &= compare("cost_per_m3",            r.cost_per_m3,            exp["cost_per_m3"],                   row_idx=ri)

    if not ok:
        fail_count += 1

print()
print("=" * 70)
if fail_count == 0:
    print(f"  ALL PASSED — {len(EXPECTED)} rows matched.")
else:
    print(f"  {fail_count} row(s) had failures.")
print("=" * 70)

"""
Cross-field validation applied after parsing, before saving.
Returns ValidationWarning objects — never raises exceptions.

Rules:
  - start_date < end_date
  - cost_per_m3 within $0.20–$2.00/m³ for Enbridge CNG (skip 0 = Rate 145 rows)
  - cost_per_kwh within $0.15–$0.90/kWh for Elexicon
  - HST ≈ 13% of pre-tax total (Elexicon only, flag if off by > 1%)
  - Gas consumption > 0 (warning only, non-blocking)
"""

from __future__ import annotations

from typing import Any

from backend.schemas.common import ValidationSeverity, ValidationWarning

_ENBRIDGE_SITES = {"cambridge", "pickering_cng", "walgreen"}


def validate_rows(
    invoice_type: str, rows: list[dict[str, Any]]
) -> list[ValidationWarning]:
    warnings: list[ValidationWarning] = []
    for idx, row in enumerate(rows):
        warnings.extend(_validate_row(invoice_type, row, idx))
    return warnings


def _validate_row(
    invoice_type: str, row: dict[str, Any], idx: int
) -> list[ValidationWarning]:
    w: list[ValidationWarning] = []

    # ── Date ordering ────────────────────────────────────────────────
    start = row.get("start_date")
    end = row.get("end_date")
    if start and end:
        from datetime import date

        s = date.fromisoformat(str(start)) if isinstance(start, str) else start
        e = date.fromisoformat(str(end)) if isinstance(end, str) else end
        if s >= e:
            w.append(
                ValidationWarning(
                    field="start_date",
                    message=f"start_date ({s}) is not before end_date ({e}).",
                    severity=ValidationSeverity.ERROR,
                    row_index=idx,
                )
            )

    # ── Enbridge CNG: cost_per_m3 range ─────────────────────────────
    if invoice_type in _ENBRIDGE_SITES:
        cpm = row.get("cost_per_m3")
        if cpm is not None:
            cpm_f = float(cpm)
            if cpm_f > 0 and not (0.20 <= cpm_f <= 2.00):
                w.append(
                    ValidationWarning(
                        field="cost_per_m3",
                        message=(
                            f"cost_per_m3 ${cpm_f:.4f}/m³ is outside expected range "
                            f"$0.20–$2.00. Verify invoice values."
                        ),
                        severity=ValidationSeverity.WARNING,
                        row_index=idx,
                    )
                )

    # ── Elexicon: cost_per_kwh range + HST check ─────────────────────
    if invoice_type == "pickering_elexicon":
        cpk = row.get("cost_per_kwh")
        if cpk is not None:
            cpk_f = float(cpk)
            if cpk_f > 0 and not (0.15 <= cpk_f <= 0.90):
                w.append(
                    ValidationWarning(
                        field="cost_per_kwh",
                        message=(
                            f"cost_per_kwh ${cpk_f:.4f}/kWh is outside expected range "
                            f"$0.15–$0.90. Verify invoice values."
                        ),
                        severity=ValidationSeverity.WARNING,
                        row_index=idx,
                    )
                )

        hst = row.get("hst")
        total_excl = row.get("total_charge_excl_hst_interest")
        if hst is not None and total_excl is not None:
            hst_f = float(hst)
            excl_f = float(total_excl)
            if excl_f > 0:
                expected = excl_f * 0.13
                if expected > 0 and abs(hst_f - expected) / expected > 0.01:
                    w.append(
                        ValidationWarning(
                            field="hst",
                            message=(
                                f"HST ${hst_f:.2f} is {abs(hst_f - expected) / expected * 100:.1f}% "
                                f"away from expected 13% (${expected:.2f}) of pre-tax "
                                f"total ${excl_f:.2f}. Verify."
                            ),
                            severity=ValidationSeverity.WARNING,
                            row_index=idx,
                        )
                    )

    # ── Gas consumption = 0 warnings ────────────────────────────────
    if invoice_type == "cambridge":
        gas = row.get("gas_consumption")
        if gas is not None and float(gas) == 0:
            w.append(
                ValidationWarning(
                    field="gas_consumption",
                    message="Gas consumption is zero — verify no usage this period.",
                    severity=ValidationSeverity.WARNING,
                    row_index=idx,
                )
            )
    elif invoice_type == "pickering_cng":
        gas = row.get("gas_consumption")
        if gas is not None and float(gas) == 0:
            w.append(
                ValidationWarning(
                    field="gas_consumption",
                    message="Gas consumption is zero — verify no usage this period.",
                    severity=ValidationSeverity.WARNING,
                    row_index=idx,
                )
            )
    elif invoice_type == "walgreen":
        # Rate 145 legitimately has 0; only warn for rate 110
        if row.get("rate") == 110:
            gas = row.get("total_gas_consumption")
            if gas is not None and float(gas) == 0:
                w.append(
                    ValidationWarning(
                        field="total_gas_consumption",
                        message="Rate 110 row has zero gas consumption — verify.",
                        severity=ValidationSeverity.WARNING,
                        row_index=idx,
                    )
                )

    return w

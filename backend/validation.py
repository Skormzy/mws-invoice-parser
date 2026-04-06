"""
Cross-field validation rules applied after parsing, before saving.
Returns a list of ValidationWarning objects — never raises exceptions.

Rules (per BUILD_SCOPE.md section 4.5):
- Gas consumption > 0 for active billing periods (flag if 0, don't block)
- All dollar amounts numeric (handled by Pydantic schemas)
- Dates in chronological order (start_date < end_date)
- cost_per_m3 within $0.20–$2.00/m³ for Enbridge CNG
- cost_per_kwh within $0.15–$0.90/kWh for Elexicon
- HST ≈ 13% of pre-tax total (flag if off by more than 1%)
- Duplicate detection: warn if same site+period already exists in DB (checked at save time)
"""

# Implemented in Phase 3.

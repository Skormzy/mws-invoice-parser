"""
Pydantic schema for Pickering Elexicon electricity invoices.

Matches the "Past Elexicon Bill" Excel tracker (row 2 headers, 24 data columns).

Key notes:
- global_adjuster is a free-text string from the invoice, e.g. "9,552.64kWh@$-0.00292".
  Do NOT parse it into numeric fields.
- global_adjustment_recovery is a negative credit (nullable).
- interest_overdue_charge is nullable.
- new_account_setup is nullable (only appears on the first invoice).
- cost_per_kwh = total_charge_excl_hst_interest / kwh_used
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, model_validator


class PickeringElexiconInvoiceSchema(BaseModel):
    # ── Tracker columns (order matches row 2 headers) ──────────────
    bill_period: str = Field(..., description='Month name, e.g. "February"')
    read_period: str = Field(..., description='Meter read date range, e.g. "Jan 31 - Feb 28, 2026"')
    account_number: str = Field(default="97066317-00")
    service_type: str = Field(default="GS > 50 kW")
    days: Optional[int] = Field(None, description="Days in billing period")
    kwh_used: Optional[float] = Field(None, description="Total kWh consumed")
    monthly_demand_kw: Optional[float] = Field(None, description="Monthly demand in kW")
    electricity_rate: Optional[float] = Field(None, description="Electricity rate in $/kWh")
    global_adjuster: Optional[str] = Field(
        None,
        description='Free text from invoice, e.g. "9,552.64kWh@$-0.00292". Stored verbatim.',
    )

    # Distribution Charges
    new_account_setup: Optional[float] = Field(
        None, description="New Account Setup fee — only on first invoice"
    )
    delivery_charge: Optional[float] = Field(None, description="Distribution: Delivery Charge ($)")
    customer_charge: Optional[float] = Field(None, description="Distribution: Customer Charge ($)")
    interest_overdue_charge: Optional[float] = Field(
        None, description="Interest on Overdue Amount (nullable)"
    )

    # Other Charges
    sss_admin_charge: Optional[float] = None
    electricity_cost: Optional[float] = Field(None, description="Electricity charge ($)")
    global_adjustment: Optional[float] = Field(None, description="Global Adjustment amount ($)")
    global_adjustment_recovery: Optional[float] = Field(
        None, description="Global Adjustment Recovery — negative credit (nullable)"
    )
    transmission_network: Optional[float] = Field(
        None, description="Transmission Network Charge ($)"
    )
    transmission_connection: Optional[float] = Field(
        None, description="Transmission Connection ($)"
    )
    wholesale_market_services: Optional[float] = None
    hst: Optional[float] = Field(None, description="HST ($)")
    total_charge: float = Field(..., description="Total Charge including HST and overdue interest")
    total_charge_excl_hst_interest: Optional[float] = Field(
        None, description="Total Charge excluding HST and overdue interest"
    )
    cost_per_kwh: Optional[float] = Field(
        None, description="Calculated: total_charge_excl_hst_interest / kwh_used"
    )

    # ── Audit ───────────────────────────────────────────────────────
    source_pdf_filename: Optional[str] = None

    @model_validator(mode="after")
    def compute_cost_per_kwh(self) -> "PickeringElexiconInvoiceSchema":
        if self.cost_per_kwh is None:
            base = self.total_charge_excl_hst_interest
            kwh = self.kwh_used or 0.0
            if base is not None and kwh > 0:
                self.cost_per_kwh = round(base / kwh, 7)
            else:
                self.cost_per_kwh = 0.0
        return self

    model_config = {"populate_by_name": True}

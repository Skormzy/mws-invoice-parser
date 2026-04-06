"""
Pydantic schema for Cambridge Enbridge CNG invoices.

Matches the "Cambridge CNG Invoice Tracking" Excel tracker (row 8 headers, 16 data columns).
billing_period is a DATE (first of the billing month) — NOT the number of days.
cost_per_m3 is calculated by the backend before saving; 0 when gas_consumption is 0.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class CambridgeInvoiceSchema(BaseModel):
    # ── Tracker columns (order matches row 8 headers) ──────────────
    enbridge_qtr_reference: str = Field(
        ..., description='Enbridge quarterly rate reference, e.g. "Q1 2026"'
    )
    start_date: date
    end_date: date
    billing_period: date = Field(
        ..., description="First day of the billing month, e.g. 2026-01-01"
    )
    cd: Optional[float] = Field(
        None, description="Contracted Demand in m³, e.g. 8000"
    )
    gas_consumption: Optional[float] = Field(
        None, description="Total gas consumed in m³; may be 0 for zero-consumption periods"
    )
    split_volumes: Optional[str] = Field(
        None, description='Split volume notation when crossing quarters, e.g. "40772 & 11,417"'
    )
    demand_charge: Optional[float] = Field(
        None, description="Demand Charge - First 8,450 m³ of CD"
    )
    delivery_charge: Optional[float] = Field(
        None, description="Delivery Charge - First 422,250 m³"
    )
    monthly_charge_interruptible: Optional[float] = Field(
        None, description="Monthly Charge - Interruptible"
    )
    gas_supply_commodity: Optional[float] = Field(
        None, description="Gas Supply - Commodity"
    )
    gas_supply_transportation: Optional[float] = Field(
        None, description="Gas Supply - Transportation"
    )
    commodity_fuel_price_adjustment: Optional[float] = Field(
        None, description="Commodity & Fuel - Price Adjustment (may be negative)"
    )
    miscellaneous_charges: Optional[float] = Field(
        None, description="Miscellaneous Charges (nullable)"
    )
    enbridge_invoice_cost_excl_hst: float = Field(
        ..., description="Total invoice cost excluding HST"
    )
    cost_per_m3: Optional[float] = Field(
        None, description="Calculated: enbridge_invoice_cost_excl_hst / gas_consumption; 0 when consumption is 0"
    )

    # ── Audit ───────────────────────────────────────────────────────
    source_pdf_filename: Optional[str] = None

    @model_validator(mode="after")
    def compute_cost_per_m3(self) -> "CambridgeInvoiceSchema":
        if self.cost_per_m3 is None:
            consumption = self.gas_consumption or 0.0
            if consumption > 0:
                self.cost_per_m3 = round(self.enbridge_invoice_cost_excl_hst / consumption, 7)
            else:
                self.cost_per_m3 = 0.0
        return self

    model_config = {"populate_by_name": True}

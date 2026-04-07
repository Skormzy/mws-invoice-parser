"""
Pydantic schema for Cambridge Enbridge CNG invoices.

Matches the "Cambridge CNG Invoice Tracking" Excel tracker (row 8 headers).
billing_period is a DATE (first of the billing month) — NOT the number of days.
cost_per_m3 is calculated by the backend before saving; 0 when gas_consumption is 0.
total_incl_hst = enbridge_invoice_cost_excl_hst + hst_amount (when hst_amount is known).
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class CambridgeInvoiceSchema(BaseModel):
    # ── Invoice metadata ────────────────────────────────────────────
    invoice_number: Optional[str] = Field(None, description='Invoice # from top of bill')
    bill_date: Optional[date] = Field(None, description='Date Rendered field')
    due_date: Optional[date] = Field(None, description='Late payment effective date')

    # ── Billing period ──────────────────────────────────────────────
    enbridge_qtr_reference: str = Field(
        ..., description='Enbridge quarterly rate reference, e.g. "Q1 2026"'
    )
    start_date: Optional[date] = Field(
        None,
        description="Cambridge invoices do not show an explicit start date — user must enter manually",
    )
    end_date: Optional[date] = None
    billing_period: Optional[date] = Field(
        ..., description="First day of the billing month, e.g. 2026-01-01"
    )

    # ── Consumption ─────────────────────────────────────────────────
    cd: Optional[float] = Field(None, description="Contracted Demand in m³, e.g. 8000")
    gas_consumption: Optional[float] = Field(
        None, description="Total gas consumed in m³; may be 0 for zero-consumption periods"
    )
    split_volumes: Optional[str] = Field(
        None, description='Split volume notation when crossing quarters, e.g. "40772 & 11,417"'
    )

    # ── Charges ─────────────────────────────────────────────────────
    demand_charge: Optional[float] = Field(None, description="Demand Charge - First 8,450 m³ of CD")
    delivery_charge: Optional[float] = Field(None, description="Delivery Charge - First 422,250 m³")
    monthly_charge_interruptible: Optional[float] = Field(None, description="Monthly Charge - Interruptible")
    gas_supply_commodity: Optional[float] = Field(None, description="Gas Supply - Commodity")
    gas_supply_transportation: Optional[float] = Field(None, description="Gas Supply - Transportation")
    commodity_fuel_price_adjustment: Optional[float] = Field(
        None, description="Commodity & Fuel - Price Adjustment (may be negative)"
    )
    miscellaneous_charges: Optional[float] = Field(None, description="Miscellaneous Charges (nullable)")
    enbridge_invoice_cost_excl_hst: float = Field(..., description="Total invoice cost excluding HST")

    # ── Totals ──────────────────────────────────────────────────────
    hst_amount: Optional[float] = Field(None, description="Harmonized Sales Tax amount")
    total_incl_hst: Optional[float] = Field(None, description="enbridge_invoice_cost_excl_hst + hst_amount")

    # ── Balance ─────────────────────────────────────────────────────
    balance_forward: Optional[float] = Field(None, description="Balance Forward from previous bill")
    late_payment_charge: Optional[float] = Field(None, description="Late Payment Charge (0 if none)")

    # ── Calculated ──────────────────────────────────────────────────
    cost_per_m3: Optional[float] = Field(
        None, description="Calculated: enbridge_invoice_cost_excl_hst / gas_consumption; 0 when consumption is 0"
    )

    # ── Audit ───────────────────────────────────────────────────────
    source_pdf_filename: Optional[str] = None
    source_pdf_path: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def compute_derived(self) -> "CambridgeInvoiceSchema":
        # Compute total_incl_hst
        if self.total_incl_hst is None and self.hst_amount is not None:
            self.total_incl_hst = round(self.enbridge_invoice_cost_excl_hst + self.hst_amount, 2)
        # Compute cost_per_m3
        if self.cost_per_m3 is None:
            consumption = self.gas_consumption or 0.0
            if consumption > 0 and self.enbridge_invoice_cost_excl_hst:
                self.cost_per_m3 = round(self.enbridge_invoice_cost_excl_hst / consumption, 7)
            else:
                self.cost_per_m3 = 0.0
        return self

    model_config = {"populate_by_name": True}

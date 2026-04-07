"""
Pydantic schema for Walgreen Enbridge CNG invoices.

Matches the "Walgreen CNG Invoice Tracking" Excel tracker (row 8 headers, 21 data columns).

CRITICAL RULES:
- This is a SCANNED PDF. Parser uses Claude API vision.
- Every billing period produces TWO rows: rate=110 and rate=145.
- Rate 145 rows typically have 0 consumption but still have customer_monthly_charge
  and demand_charge — do NOT skip them.
- cost_per_m3 = 0 when total_gas_consumption = 0 (standard for Rate 145 rows).
- Split billing periods crossing quarter boundaries produce dual cd_1/cd_2 values
  and dual gas/demand charge fields (_2 suffix).
"""

from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


WalgreenRate = Literal[110, 145]


class WalgreenInvoiceSchema(BaseModel):
    # ── Tracker columns (order matches row 8 headers) ──────────────
    enbridge_qtr_reference: str = Field(
        ..., description='"Q1 2026" or "Q4 2025 & Q1 2026" for split periods'
    )
    rate: WalgreenRate = Field(..., description="Rate code: 110 (Firm) or 145 (Interruptible)")
    start_date: date
    end_date: date
    days: Optional[int] = Field(None, description="Number of days in billing period")
    cd_1: Optional[float] = Field(None, description="Contracted Demand tier 1 in m³")
    cd_2: Optional[float] = Field(
        None, description="Contracted Demand tier 2 for split periods; null otherwise"
    )
    gas_consumption_1: Optional[float] = Field(
        None, description="Gas consumption at rate segment 1 in m³"
    )
    gas_consumption_2: Optional[float] = Field(
        None, description="Gas consumption at rate segment 2 in m³; 0 for non-split periods"
    )
    total_gas_consumption: Optional[float] = Field(
        None, description="Total gas consumed in m³; typically 0 for Rate 145 rows"
    )
    customer_monthly_charge: Optional[float] = None
    demand_charge: Optional[float] = Field(None, description="Primary demand charge ($)")
    demand_charge_2: Optional[float] = Field(
        None, description="Secondary demand charge for split periods ($); 0 otherwise"
    )
    delivery_charge: Optional[float] = None
    load_balancing_charge: Optional[float] = None
    transportation: Optional[float] = None
    gas_supply_commodity: Optional[float] = Field(
        None, description="Gas Supply - Commodity at primary rate ($)"
    )
    gas_supply_commodity_2: Optional[float] = Field(
        None, description="Gas Supply - Commodity at secondary rate for split periods ($); 0 otherwise"
    )
    cost_adjustment: Optional[float] = None
    enbridge_invoice_cost_excl_hst: float = Field(
        ..., description="Section subtotal excluding HST"
    )
    cost_per_m3: Optional[float] = Field(
        None,
        description="Calculated: enbridge_invoice_cost_excl_hst / total_gas_consumption; 0 when consumption is 0",
    )

    # ── Audit ───────────────────────────────────────────────────────
    source_pdf_filename: Optional[str] = None

    @model_validator(mode="after")
    def compute_cost_per_m3(self) -> "WalgreenInvoiceSchema":
        if self.cost_per_m3 is None:
            consumption = self.total_gas_consumption or 0.0
            if consumption > 0:
                self.cost_per_m3 = round(
                    self.enbridge_invoice_cost_excl_hst / consumption, 7
                )
            else:
                self.cost_per_m3 = 0.0
        return self

    model_config = {"populate_by_name": True}

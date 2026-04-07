"""
Pydantic schema for Pickering Enbridge CNG invoices.

Matches the "Enbridge Invoice Comparison" Excel tracker (row 8 headers, 23 data columns).

Key differences from Cambridge:
- billing_period is an INTEGER (number of days), NOT a date
- cd is a STRING because split periods store "8,462 & 1,538 m3"
- Supports split billing periods crossing quarter boundaries:
    dual CD values, dual gas supply charges, compound qtr labels ("Q3 & Q4 2024")
- federal_carbon_charge and previous_bill_charge are nullable (older invoices only)
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class PickeringCngInvoiceSchema(BaseModel):
    # ── Tracker columns (order matches row 8 headers) ──────────────
    enbridge_qtr_reference: str = Field(
        ..., description='"Q4 2025" for single-quarter, "Q3 & Q4 2024" for split periods'
    )
    start_date: date
    end_date: date
    billing_period: Optional[int] = Field(
        None, description="Number of days in billing period (integer, not a date)"
    )
    meter_reading_previous: Optional[float] = None
    meter_reading_actual: Optional[float] = None
    cf_to_m3_conversion: Optional[float] = None
    cd: Optional[str] = Field(
        None,
        description='Contracted Demand — string to support split values e.g. "8,462 & 1,538 m3"',
    )
    gas_consumption: float = Field(..., description="Total gas consumed in m³")
    split_volumes: Optional[str] = Field(
        None, description='"N/A" for non-split periods, or "40772 & 11,417" for split'
    )
    customer_charge: Optional[float] = None
    cd_1: Optional[float] = Field(None, description="Contract Demand Charge tier 1 ($)")
    cd_2: Optional[float] = Field(
        None, description="Contract Demand Charge tier 2 ($); 0 when single-tier"
    )
    delivery_to_you: Optional[float] = None
    load_balancing: Optional[float] = None
    transportation: Optional[float] = None
    federal_carbon_charge: Optional[float] = Field(
        None, description="Nullable — present in 2024 invoices only"
    )
    gas_supply_charge_1: Optional[float] = Field(None, description="Gas Supply Charge primary rate")
    gas_supply_charge_2: Optional[float] = Field(
        None, description="Gas Supply Charge secondary rate; 0 for non-split periods"
    )
    cost_adjustment: Optional[float] = None
    previous_bill_charge: Optional[float] = Field(
        None, description="Nullable — present in mid-2024 invoices only"
    )
    enbridge_invoice_cost_excl_hst: float = Field(
        ..., description="Total invoice cost excluding HST"
    )
    cost_per_m3: Optional[float] = Field(
        None, description="Calculated: enbridge_invoice_cost_excl_hst / gas_consumption"
    )

    # ── Audit ───────────────────────────────────────────────────────
    source_pdf_filename: Optional[str] = None

    @model_validator(mode="after")
    def compute_cost_per_m3(self) -> "PickeringCngInvoiceSchema":
        if self.cost_per_m3 is None:
            if self.gas_consumption > 0:
                self.cost_per_m3 = round(
                    self.enbridge_invoice_cost_excl_hst / self.gas_consumption, 7
                )
            else:
                self.cost_per_m3 = 0.0
        return self

    model_config = {"populate_by_name": True}

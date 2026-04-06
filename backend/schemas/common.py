from __future__ import annotations

from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel


SiteId = Literal["cambridge", "pickering_cng", "walgreen", "pickering_elexicon"]


class ValidationSeverity(str, Enum):
    WARNING = "warning"
    ERROR = "error"


class ValidationWarning(BaseModel):
    field: Optional[str] = None    # None = row-level warning
    message: str
    severity: ValidationSeverity
    row_index: Optional[int] = None  # for multi-row results (Walgreen)


class ParseResponse(BaseModel):
    invoice_type: SiteId
    rows: list                     # typed per-parser; union resolved at route level
    warnings: list[ValidationWarning]
    pdf_page_images: list[str]     # base64 PNG data URIs, one per PDF page

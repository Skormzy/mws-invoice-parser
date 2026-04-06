"""
Walgreen Enbridge CNG invoice parser.

PDF format: SCANNED — zero extractable text.
  - Convert each page to JPEG using pdf2image (requires poppler-utils).
  - Send each page image to Anthropic Claude vision API to extract charge data.
  - Skip page 1 (summary page — no detailed charges).
  - Pages 2–N contain rate sections (Rate 110 and Rate 145) for each billing period.

CRITICAL RULES:
  - Every billing period produces TWO WalgreenInvoiceSchema rows: rate=110 and rate=145.
  - Rate 145 rows always have 0 gas consumption.
  - Cross-quarter periods produce dual CD and dual gas/demand charge fields.
  - enbridge_qtr_reference derived from start_date/end_date.

ENVIRONMENT REQUIREMENTS:
  - ANTHROPIC_API_KEY environment variable must be set.
  - poppler-utils must be installed (for pdf2image):
      Debian/Ubuntu: apt-get install -y poppler-utils
      macOS:         brew install poppler
      Docker:        see backend/Dockerfile
"""

from __future__ import annotations

import base64
import json
import os
import re
from datetime import date, datetime
from io import BytesIO
from typing import Optional

import anthropic

from backend.schemas.walgreen import WalgreenInvoiceSchema
from backend.schemas.common import ValidationSeverity, ValidationWarning

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = (
    "You are a precise invoice data extractor. "
    "Return ONLY valid JSON with no markdown formatting, no backticks, no explanation."
)

PAGE_PROMPT = """This is a page from a scanned Enbridge CNG gas invoice for the Walgreen site.

The page may contain one or more billing period sections. Each section covers a specific
date range and is broken into two rate sub-sections: Rate 110 (Firm) and Rate 145 (Interruptible).

For EACH rate section found on this page, extract these fields and return a JSON array
where each element is one rate section:

{
  "rate": 110 or 145,
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "days": integer or null,
  "cd_1": number or null,
  "cd_2": number or null,
  "gas_consumption_1": number or null,
  "gas_consumption_2": number or null,
  "customer_monthly_charge": number or null,
  "demand_charge": number or null,
  "demand_charge_2": number or null,
  "delivery_charge": number or null,
  "load_balancing_charge": number or null,
  "transportation": number or null,
  "gas_supply_commodity": number or null,
  "gas_supply_commodity_2": number or null,
  "cost_adjustment": number or null,
  "enbridge_invoice_cost_excl_hst": number or null
}

Field extraction rules:
- cd_1: the primary Contract Demand value in m³ (e.g. 10,577 → 10577)
- cd_2: only present for cross-quarter periods with a second CD tier; null otherwise
- gas_consumption_1: primary gas volume billed (m³)
- gas_consumption_2: secondary volume for cross-quarter split; null otherwise
- demand_charge: the primary Demand Charge dollar amount (positive)
- demand_charge_2: secondary demand charge for split periods; null otherwise
- gas_supply_commodity: primary Gas Supply - Commodity dollar amount
- gas_supply_commodity_2: secondary Gas Supply - Commodity for split periods; null otherwise
- cost_adjustment: negative credit (e.g. -17.68); null if not shown
- enbridge_invoice_cost_excl_hst: the subtotal for this rate section excluding HST

Return an empty array [] if no rate sections are found on this page.
Return ONLY the JSON array — no other text."""


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _parse_date(s: str) -> Optional[date]:
    """Parse YYYY-MM-DD → date."""
    try:
        return datetime.strptime(s.strip(), "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        return None


def _quarter(dt: date) -> tuple[int, int]:
    return (dt.month - 1) // 3 + 1, dt.year


def _quarter_label(start: date, end: date) -> str:
    qs, ys = _quarter(start)
    qe, ye = _quarter(end)
    if (qs, ys) == (qe, ye):
        return f"Q{qs} {ys}"
    if ys == ye:
        return f"Q{qs} & Q{qe} {ys}"
    return f"Q{qs} {ys} & Q{qe} {ye}"


def _jpeg_to_base64(img) -> str:
    """Convert a PIL Image to a base64-encoded JPEG string."""
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.standard_b64encode(buf.getvalue()).decode("utf-8")


def _extract_sections_from_page(
    client: anthropic.Anthropic,
    b64_image: str,
    page_num: int,
    warnings: list[ValidationWarning],
) -> list[dict]:
    """
    Send one page image to Claude and return the parsed list of rate section dicts.
    Returns [] on failure (with a warning appended).
    """
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64_image,
                            },
                        },
                        {
                            "type": "text",
                            "text": PAGE_PROMPT,
                        },
                    ],
                }
            ],
        )
    except anthropic.APIError as exc:
        warnings.append(ValidationWarning(
            field=None,
            message=f"Page {page_num}: Anthropic API error — {exc}",
            severity=ValidationSeverity.ERROR,
        ))
        return []

    raw_text = response.content[0].text.strip()

    # Strip accidental markdown fences
    raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
    raw_text = re.sub(r"\n?```$", "", raw_text)

    try:
        sections = json.loads(raw_text)
        if not isinstance(sections, list):
            raise ValueError("Expected a JSON array")
        return sections
    except (json.JSONDecodeError, ValueError) as exc:
        warnings.append(ValidationWarning(
            field=None,
            message=(
                f"Page {page_num}: Claude returned non-JSON response — {exc}. "
                f"Raw: {raw_text[:300]}"
            ),
            severity=ValidationSeverity.ERROR,
        ))
        return []


def _safe_float(val) -> Optional[float]:
    """Coerce a value to float, returning None on failure."""
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


# ─────────────────────────────────────────────────────────────
# Main parser
# ─────────────────────────────────────────────────────────────

def parse_walgreen(
    pdf_path: str,
    source_filename: Optional[str] = None,
) -> tuple[list[WalgreenInvoiceSchema], list[ValidationWarning]]:
    """
    Parse a Walgreen Enbridge CNG invoice PDF (scanned — no extractable text).

    Requires:
      - ANTHROPIC_API_KEY env var
      - poppler-utils installed (for pdf2image)

    Returns:
        (rows, warnings)
        rows — one WalgreenInvoiceSchema per rate-section (typically 2 per billing period).
    """
    # Defer pdf2image import so the rest of the codebase works without poppler
    try:
        from pdf2image import convert_from_path  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError(
            "pdf2image is not installed or poppler-utils is missing. "
            "Install with: pip install pdf2image  AND  apt-get install poppler-utils"
        ) from exc

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY environment variable is not set. "
            "Export it before running the Walgreen parser."
        )

    warnings: list[ValidationWarning] = []
    client = anthropic.Anthropic(api_key=api_key)

    # ── Convert PDF pages to images ───────────────────────────────────
    # DPI 200 gives good legibility while keeping image size manageable.
    images = convert_from_path(pdf_path, dpi=200)

    # ── Collect rate sections from pages 2–N (skip page 1 = summary) ──
    all_sections: list[dict] = []
    for page_idx, img in enumerate(images):
        page_num = page_idx + 1
        if page_num == 1:
            continue  # summary page — no charge detail

        b64 = _jpeg_to_base64(img)
        sections = _extract_sections_from_page(client, b64, page_num, warnings)
        all_sections.extend(sections)

    if not all_sections:
        warnings.append(ValidationWarning(
            field=None,
            message="No rate sections were extracted from the invoice pages.",
            severity=ValidationSeverity.ERROR,
        ))
        return [], warnings

    # ── Build WalgreenInvoiceSchema rows from extracted dicts ──────────
    rows: list[WalgreenInvoiceSchema] = []
    for row_idx, sec in enumerate(all_sections):
        start_date = _parse_date(str(sec.get("start_date", "")))
        end_date = _parse_date(str(sec.get("end_date", "")))

        if start_date is None or end_date is None:
            warnings.append(ValidationWarning(
                field="start_date",
                message=(
                    f"Row {row_idx}: Could not parse dates — "
                    f"start_date={sec.get('start_date')!r}  end_date={sec.get('end_date')!r}"
                ),
                severity=ValidationSeverity.ERROR,
                row_index=row_idx,
            ))
            continue

        enbridge_qtr_reference = _quarter_label(start_date, end_date)

        rate_raw = sec.get("rate")
        if rate_raw not in (110, 145):
            warnings.append(ValidationWarning(
                field="rate",
                message=f"Row {row_idx}: Unexpected rate value {rate_raw!r}; skipping.",
                severity=ValidationSeverity.ERROR,
                row_index=row_idx,
            ))
            continue

        gas_1 = _safe_float(sec.get("gas_consumption_1")) or 0.0
        gas_2 = _safe_float(sec.get("gas_consumption_2")) or 0.0
        total_gas = gas_1 + gas_2

        cost_excl_hst = _safe_float(sec.get("enbridge_invoice_cost_excl_hst"))
        if cost_excl_hst is None:
            warnings.append(ValidationWarning(
                field="enbridge_invoice_cost_excl_hst",
                message=f"Row {row_idx} (rate={rate_raw}): Missing invoice subtotal.",
                severity=ValidationSeverity.ERROR,
                row_index=row_idx,
            ))
            cost_excl_hst = 0.0

        row = WalgreenInvoiceSchema(
            enbridge_qtr_reference=enbridge_qtr_reference,
            rate=rate_raw,
            start_date=start_date,
            end_date=end_date,
            days=_safe_int(sec.get("days")),
            cd_1=_safe_float(sec.get("cd_1")),
            cd_2=_safe_float(sec.get("cd_2")),
            gas_consumption_1=gas_1 if gas_1 > 0 else None,
            gas_consumption_2=gas_2 if gas_2 > 0 else None,
            total_gas_consumption=total_gas,
            customer_monthly_charge=_safe_float(sec.get("customer_monthly_charge")),
            demand_charge=_safe_float(sec.get("demand_charge")),
            demand_charge_2=_safe_float(sec.get("demand_charge_2")),
            delivery_charge=_safe_float(sec.get("delivery_charge")),
            load_balancing_charge=_safe_float(sec.get("load_balancing_charge")),
            transportation=_safe_float(sec.get("transportation")),
            gas_supply_commodity=_safe_float(sec.get("gas_supply_commodity")),
            gas_supply_commodity_2=_safe_float(sec.get("gas_supply_commodity_2")),
            cost_adjustment=_safe_float(sec.get("cost_adjustment")),
            enbridge_invoice_cost_excl_hst=cost_excl_hst,
            source_pdf_filename=source_filename,
        )
        rows.append(row)

    # ── Sort by start_date then rate for deterministic ordering ────────
    rows.sort(key=lambda r: (r.start_date, r.rate))

    return rows, warnings

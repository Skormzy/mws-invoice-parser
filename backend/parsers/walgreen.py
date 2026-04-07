"""
Walgreen Enbridge CNG invoice parser.

PDF format: SCANNED — zero extractable text.
  - Convert each page to JPEG using pdf2image (requires poppler-utils).
  - Page 1 (summary): extract invoice-level fields (invoice_number, bill_date, due_date,
    hst_amount, total_incl_hst) using Claude vision.
  - Pages 2–N contain rate sections (Rate 110 and Rate 145) for each billing period.

CRITICAL RULES:
  - Every billing period produces TWO WalgreenInvoiceSchema rows: rate=110 and rate=145.
  - Rate 145 rows always have 0 gas consumption.
  - hst_amount and total_incl_hst: stored only on the first Rate 110 row; null on all others.
  - invoice_number, bill_date, due_date: same for all rows from one invoice.

ENVIRONMENT REQUIREMENTS:
  - ANTHROPIC_API_KEY environment variable must be set.
  - poppler-utils must be installed (for pdf2image).
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

# Prompt for page 1 (summary / account info page)
PAGE1_PROMPT = """This is page 1 of a scanned Enbridge CNG invoice for the Walgreen site.
It is a summary/account overview page. Extract these invoice-level fields:

{
  "invoice_number": "string or null",
  "bill_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "hst_amount": number or null,
  "total_amount_due": number or null
}

Field notes:
- invoice_number: look for "Bill Number" value
- bill_date: look for "Bill Date" value
- due_date: look for "Due Date" value
- hst_amount: look for "HST" charge amount
- total_amount_due: look for "Total Amount Due" or "Total Charges"

Return ONLY the JSON object — no other text."""

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
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.standard_b64encode(buf.getvalue()).decode("utf-8")


def _call_claude(client: anthropic.Anthropic, b64_image: str, prompt: str) -> str:
    """Call Claude vision with a single image and prompt. Returns raw text."""
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
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    raw = response.content[0].text.strip()
    # Strip accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return raw


def _extract_invoice_fields(
    client: anthropic.Anthropic,
    b64_image: str,
    warnings: list[ValidationWarning],
) -> dict:
    """Extract invoice-level fields from page 1. Returns dict (empty on failure)."""
    try:
        raw = _call_claude(client, b64_image, PAGE1_PROMPT)
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception as exc:
        warnings.append(ValidationWarning(
            field=None,
            message=f"Page 1: Could not extract invoice fields — {exc}",
            severity=ValidationSeverity.WARNING,
        ))
    return {}


def _extract_sections_from_page(
    client: anthropic.Anthropic,
    b64_image: str,
    page_num: int,
    warnings: list[ValidationWarning],
) -> list[dict]:
    """Send one page image to Claude and return the parsed list of rate section dicts."""
    try:
        raw = _call_claude(client, b64_image, PAGE_PROMPT)
        sections = json.loads(raw)
        if not isinstance(sections, list):
            raise ValueError("Expected a JSON array")
        return sections
    except anthropic.APIError as exc:
        warnings.append(ValidationWarning(
            field=None,
            message=f"Page {page_num}: Anthropic API error — {exc}",
            severity=ValidationSeverity.ERROR,
        ))
        return []
    except (json.JSONDecodeError, ValueError) as exc:
        warnings.append(ValidationWarning(
            field=None,
            message=f"Page {page_num}: Claude returned non-JSON response — {exc}",
            severity=ValidationSeverity.ERROR,
        ))
        return []


def _safe_float(val) -> Optional[float]:
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
    """
    try:
        from pdf2image import convert_from_path  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError(
            "pdf2image is not installed or poppler-utils is missing."
        ) from exc

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set.")

    warnings: list[ValidationWarning] = []
    client = anthropic.Anthropic(api_key=api_key)

    images = convert_from_path(pdf_path, dpi=200)

    # ── Page 1: extract invoice-level fields ──────────────────────
    invoice_fields: dict = {}
    if images:
        b64_p1 = _jpeg_to_base64(images[0])
        invoice_fields = _extract_invoice_fields(client, b64_p1, warnings)

    invoice_number: Optional[str] = invoice_fields.get("invoice_number") or None
    bill_date: Optional[date] = _parse_date(str(invoice_fields.get("bill_date") or ""))
    due_date: Optional[date] = _parse_date(str(invoice_fields.get("due_date") or ""))
    hst_amount: Optional[float] = _safe_float(invoice_fields.get("hst_amount"))
    total_amount_due: Optional[float] = _safe_float(invoice_fields.get("total_amount_due"))

    # ── Pages 2–N: collect rate sections ─────────────────────────
    all_sections: list[dict] = []
    for page_idx, img in enumerate(images):
        page_num = page_idx + 1
        if page_num == 1:
            continue  # summary page — charge detail on pages 2+

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

    # ── Build WalgreenInvoiceSchema rows ──────────────────────────
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
            invoice_number=invoice_number,
            bill_date=bill_date,
            due_date=due_date,
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
            # hst_amount and total_incl_hst: only on first Rate 110 row
            hst_amount=None,
            total_incl_hst=None,
            source_pdf_filename=source_filename,
        )
        rows.append(row)

    # Sort by start_date then rate for deterministic ordering
    rows.sort(key=lambda r: (r.start_date, r.rate))

    # Stamp hst_amount and total_incl_hst on the first Rate 110 row only
    for row in rows:
        if row.rate == 110:
            row.hst_amount = hst_amount
            row.total_incl_hst = total_amount_due
            break

    return rows, warnings

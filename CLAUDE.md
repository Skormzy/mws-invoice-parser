# MWS Invoice Parser

## Project Context
Web app for Miller Waste Systems FP&A team to parse PDF utility invoices (Enbridge CNG gas + Elexicon electricity) and populate a database matching existing Excel tracker structures. Full spec is in docs/BUILD_SCOPE.md — always refer to it.

## Tech Stack
- React + TypeScript frontend (Vite)
- Supabase (Postgres + Auth + Storage)
- Python backend API (FastAPI) for PDF parsing
- pdfplumber for text-extractable PDFs (Cambridge, Pickering Enbridge, Elexicon)
- Anthropic Claude API with vision for scanned PDFs (Walgreen) — send page images as base64, get structured JSON back
- Tailwind CSS

## Critical Rules
- Walgreen Enbridge invoices are SCANNED (zero extractable text). Must convert pages to images and use Claude API vision to extract data.
- Walgreen has dual rates (110 + 145) per billing period. Each period produces 2 database rows.
- Pickering Enbridge has split billing periods crossing quarter boundaries with dual CD values.
- All extracted data must be shown in an editable table for review before saving.
- Excel export must replicate Melissa's tracker format exactly (headers, column order, site metadata rows).

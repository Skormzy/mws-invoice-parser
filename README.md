# MWS Invoice Parser

Web app for Miller Waste Systems FP&A to parse PDF utility invoices (Enbridge CNG + Elexicon electricity) and save them to a Supabase database that mirrors the existing Excel tracker structures.

## Architecture

```
mws-invoice-parser/
├── backend/          FastAPI (Python) — PDF parsing + Supabase writes
├── frontend/         React + TypeScript + Vite + Tailwind CSS
└── supabase/
    └── migrations/   001_initial_schema.sql — run once to set up tables
```

## Supported invoice types

| Type | Site | Parser method |
|---|---|---|
| Cambridge Enbridge CNG | Cambridge | pdfplumber (text-extractable) |
| Pickering Enbridge CNG | Pickering CNG | pdfplumber (text-extractable) |
| Walgreen Enbridge CNG | Walgreen | pdf2image + Claude vision (scanned) |
| Pickering Elexicon | Pickering | pdfplumber (text-extractable) |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- `poppler-utils` (required by pdf2image for PDF→image conversion)

### Install poppler-utils

**Debian / Ubuntu:**
```bash
sudo apt-get install -y poppler-utils
```

**macOS:**
```bash
brew install poppler
```

**Docker:** already included in `backend/Dockerfile`.

---

## Database setup

Run the migration once against your Supabase project:

1. Open the Supabase SQL editor for your project.
2. Paste and run the contents of `supabase/migrations/001_initial_schema.sql`.

This creates the five tables (`sites`, `cambridge_invoices`, `pickering_cng_invoices`, `walgreen_invoices`, `pickering_elexicon_invoices`) and seeds the `sites` lookup table.

---

## Backend setup

```bash
cd backend
```

### 1. Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate      # macOS / Linux
# .venv\Scripts\activate       # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `backend/.env` with your actual values:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>

# Required only for Walgreen invoices (scanned PDF — uses Claude vision)
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### 4. Run the dev server

```bash
uvicorn backend.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Health check: `GET http://localhost:8000/health`

---

## Frontend setup

```bash
cd frontend
```

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Run the dev server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

> The Vite dev server proxies `/api/*` requests to `http://localhost:8000` automatically — no CORS issues in development.

---

## Running both together

Open two terminal tabs:

**Tab 1 — backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

**Tab 2 — frontend:**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173`.

---

## Usage

### Uploading an invoice

1. Navigate to the **Upload** tab.
2. Select the invoice type from the dropdown.
3. Drag-and-drop (or click to browse) the PDF file.
4. The app parses the invoice and shows a side-by-side review view:
   - **Left panel** — rendered PDF pages (scrollable).
   - **Right panel** — editable table with the extracted values.
   - Cells with **yellow** background have warnings; **red** have errors.
5. Correct any values as needed, then click **Save to Database**.

> Walgreen invoices are scanned — parsing requires `ANTHROPIC_API_KEY` and takes ~15–30 seconds per page.

### Dashboard

- Switch between sites using the tab bar.
- Filter by date range using the From / To inputs.
- Click **↓ Export Excel** to download a `.xlsx` file in Melissa's exact tracker format.

---

## API reference

All routes are mounted at the root. The frontend Vite proxy maps `/api/*` → `/*` on the backend.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/parse` | Parse a PDF. Form fields: `invoice_type` (string) + `file` (PDF). Returns `{ rows, warnings, pdf_page_images }` |
| `POST` | `/save` | Save rows to Supabase. Body: `{ invoice_type, rows }` |
| `GET` | `/records/{site_id}` | Fetch saved records. Query params: `start_date`, `end_date` (ISO dates) |
| `GET` | `/export/{site_id}` | Download `.xlsx` tracker in Melissa's format |

**`site_id` values:** `cambridge` | `pickering_cng` | `walgreen` | `pickering_elexicon`

---

## Building for production

**Frontend:**
```bash
cd frontend
npm run build          # outputs to frontend/dist/
```

**Backend:**
Use the provided `backend/Dockerfile` or deploy via any WSGI host:
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 2
```

---

## Project structure

```
backend/
├── main.py                 API routes (parse, save, records, export)
├── validation.py           Cross-field validation rules
├── parsers/
│   ├── cambridge.py        Cambridge Enbridge CNG (pdfplumber)
│   ├── pickering_enbridge.py   Pickering CNG (pdfplumber)
│   ├── walgreen.py         Walgreen CNG (pdf2image + Claude vision)
│   └── elexicon.py         Pickering Elexicon (pdfplumber)
├── schemas/
│   ├── cambridge.py        Pydantic models
│   ├── pickering_enbridge.py
│   ├── walgreen.py
│   ├── elexicon.py
│   └── common.py           ValidationWarning, ParseResponse
├── export/
│   └── excel.py            Excel export (replicates Melissa's tracker format)
├── requirements.txt
├── Dockerfile
└── .env.example

frontend/
├── src/
│   ├── App.tsx             Page router + Toaster
│   ├── pages/
│   │   ├── UploadPage.tsx  Upload + review flow
│   │   └── DashboardPage.tsx  Records table + export
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── FileDropzone.tsx
│   │   ├── PdfViewer.tsx
│   │   └── ReviewTable.tsx  Editable table with warning highlighting
│   ├── lib/
│   │   ├── api.ts          Fetch wrappers for backend routes
│   │   ├── columns.ts      Column definitions for all 4 invoice types
│   │   └── supabase.ts     Supabase client (typed)
│   └── types/index.ts      TypeScript interfaces for all invoice types
└── .env.example
```

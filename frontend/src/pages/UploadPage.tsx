import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { SiteId, ParseResponse } from '../types'
import { parseInvoice, saveInvoice, getRecords } from '../lib/api'
import { SITE_LABELS } from '../lib/columns'
import FileDropzone from '../components/FileDropzone'
import PdfViewer from '../components/PdfViewer'
import ReviewTable from '../components/ReviewTable'

const SITE_IDS: SiteId[] = ['cambridge', 'pickering_cng', 'walgreen', 'pickering_elexicon']

type State = 'idle' | 'parsing' | 'review'

/** Add 1 day to an ISO date string: "2026-01-07" → "2026-01-08" */
function nextDay(isoDate: string): string {
  const d = new Date(isoDate)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Apply suggested start_date to any rows where start_date is null/missing. */
function applyStartDate(
  rows: Record<string, unknown>[],
  suggested: string,
): Record<string, unknown>[] {
  return rows.map((row) => {
    if (row.start_date == null) {
      return { ...row, start_date: suggested }
    }
    return row
  })
}

export default function UploadPage() {
  const [invoiceType, setInvoiceType] = useState<SiteId>('cambridge')
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<ParseResponse | null>(null)
  const fileRef = useRef<File | null>(null)  // retain original File for PDF storage on save
  const [suggestedStartDate, setSuggestedStartDate] = useState<string | null>(null)

  // Auto-fetch the most recent end_date for the selected site whenever invoiceType changes.
  useEffect(() => {
    setSuggestedStartDate(null)
    getRecords(invoiceType, undefined, undefined, 1)
      .then((records) => {
        const last = records[records.length - 1]   // ascending order → last = most recent
        const endDate = last?.end_date
        if (typeof endDate === 'string' && endDate) {
          setSuggestedStartDate(nextDay(endDate))
        }
      })
      .catch(() => { /* Supabase not configured in dev — silently ignore */ })
  }, [invoiceType])

  const handleFile = async (file: File) => {
    fileRef.current = file
    setState('parsing')
    try {
      const data: ParseResponse = await parseInvoice(invoiceType, file)

      // Apply suggested start_date to rows where it is missing
      const rows = suggestedStartDate
        ? applyStartDate(data.rows as Record<string, unknown>[], suggestedStartDate)
        : (data.rows as Record<string, unknown>[])

      setResult({ ...data, rows })
      setState('review')

      const errCount  = data.warnings.filter((w) => w.severity === 'error').length
      const warnCount = data.warnings.length - errCount
      if (errCount > 0 || warnCount > 0) {
        const parts = [
          errCount  > 0 ? `${errCount} error${errCount > 1 ? 's' : ''}` : '',
          warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? 's' : ''}` : '',
        ].filter(Boolean).join(', ')
        toast.warning(`Parsed with ${parts} — review highlighted cells.`)
      } else {
        toast.success(`Parsed ${data.rows.length} row${data.rows.length !== 1 ? 's' : ''} — review before saving.`)
      }
    } catch (err) {
      toast.error(`Parse failed: ${err instanceof Error ? err.message : String(err)}`)
      setState('idle')
    }
  }

  const handleSave = async (rows: Record<string, unknown>[]) => {
    try {
      const res = await saveInvoice(invoiceType, rows, fileRef.current)
      toast.success(`Saved ${res.inserted} row${res.inserted !== 1 ? 's' : ''} successfully.`)
      setState('idle')
      setResult(null)
      fileRef.current = null
      // Refresh suggested start_date for next upload
      setSuggestedStartDate(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
      throw err   // keep ReviewTable open
    }
  }

  const handleBack = () => {
    setState('idle')
    setResult(null)
    fileRef.current = null
  }

  // ── Review view ─────────────────────────────────────────────────
  if (state === 'review' && result) {
    return (
      <div className="flex" style={{ height: 'calc(100vh - 56px)' }}>
        <PdfViewer images={result.pdf_page_images} />
        <ReviewTable
          invoiceType={invoiceType}
          initialRows={result.rows as Record<string, unknown>[]}
          warnings={result.warnings}
          onSave={handleSave}
          onBack={handleBack}
        />
      </div>
    )
  }

  // ── Upload view ─────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-1">Upload Invoice</h1>
      <p className="text-gray-500 text-sm mb-8">
        Select the invoice type, then drop or browse for the PDF.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice type</label>
        <select
          value={invoiceType}
          onChange={(e) => setInvoiceType(e.target.value as SiteId)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {SITE_IDS.map((id) => (
            <option key={id} value={id}>{SITE_LABELS[id]}</option>
          ))}
        </select>

        {suggestedStartDate && (
          <p className="mt-1.5 text-xs text-blue-600">
            Next start date will default to <strong>{suggestedStartDate}</strong> (day after last saved record).
          </p>
        )}
      </div>

      {state === 'parsing' ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-gray-50">
          <div className="animate-spin text-3xl mb-3">⚙️</div>
          <p className="text-gray-600 font-medium">Parsing invoice…</p>
          {invoiceType === 'walgreen' && (
            <p className="text-gray-400 text-sm mt-1">
              Walgreen uses AI vision — this may take 15–30 s per page.
            </p>
          )}
        </div>
      ) : (
        <FileDropzone onFile={handleFile} />
      )}

      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>• Cambridge, Pickering Enbridge, and Elexicon PDFs are text-extractable.</p>
        <p>• Walgreen invoices are scanned — parsing requires the Anthropic API.</p>
        <p>• After parsing, review and edit the extracted values before saving.</p>
      </div>
    </div>
  )
}

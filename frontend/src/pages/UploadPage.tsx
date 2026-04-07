import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { SiteId, ParseResponse, DupCheckResponse } from '../types'
import { parseInvoice, saveInvoice, getRecords, checkDuplicate } from '../lib/api'
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

/** Build duplicate-check params from the first parsed row. */
function buildDupParams(
  siteId: SiteId,
  rows: Record<string, unknown>[],
): Parameters<typeof checkDuplicate>[1] {
  const first = rows[0] ?? {}
  if (siteId === 'pickering_elexicon') {
    return {
      readPeriod: (first.read_period as string | null) ?? null,
      totalCharge: (first.total_charge as number | null) ?? null,
    }
  }
  return {
    invoiceNumber: (first.invoice_number as string | null) ?? null,
    endDate: (first.end_date as string | null) ?? null,
    cost: (first.enbridge_invoice_cost_excl_hst as number | null) ?? null,
  }
}

/** Format a date string from an existing record for display. */
function fmtExistingDate(rec: Record<string, unknown>): string {
  const d = rec.created_at ?? rec.start_date ?? ''
  if (!d) return ''
  return String(d).slice(0, 10)
}

// ── Duplicate banner ─────────────────────────────────────────────────────────

interface DupBannerProps {
  dup: DupCheckResponse
  fuzzyAcknowledged: boolean
  onAcknowledge: () => void
}

function DupBanner({ dup, fuzzyAcknowledged, onAcknowledge }: DupBannerProps) {
  if (dup.duplicate === 'none') return null

  if (dup.duplicate === 'exact') {
    const inv = (dup.existing?.invoice_number as string | null) ?? ''
    const dt = fmtExistingDate(dup.existing ?? {})
    return (
      <div className="mb-4 rounded-lg border border-red-400 bg-red-50 px-4 py-3">
        <p className="font-semibold text-red-700">
          DUPLICATE INVOICE: Invoice #{inv} has already been processed
          {dt ? ` on ${dt}` : ''}.
        </p>
        <p className="mt-1 text-sm text-red-600">
          Saving is disabled. Delete the existing record first if you need to re-import.
        </p>
        {dup.existing && (
          <details className="mt-2 text-xs text-red-600">
            <summary className="cursor-pointer select-none font-medium">
              Show existing record
            </summary>
            <pre className="mt-1 overflow-auto rounded bg-red-100 p-2">
              {JSON.stringify(dup.existing, null, 2)}
            </pre>
          </details>
        )}
      </div>
    )
  }

  // fuzzy
  return (
    <div className="mb-4 rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-3">
      <p className="font-semibold text-yellow-800">
        Possible duplicate: a record with the same end date and total cost already exists.
        Please verify before saving.
      </p>
      {!fuzzyAcknowledged && (
        <button
          onClick={onAcknowledge}
          className="mt-2 rounded bg-yellow-500 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-600"
        >
          I've verified — proceed to save
        </button>
      )}
      {fuzzyAcknowledged && (
        <p className="mt-1 text-xs font-medium text-yellow-700">
          Acknowledged. You may now save.
        </p>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function UploadPage() {
  const [invoiceType, setInvoiceType] = useState<SiteId>('cambridge')
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<ParseResponse | null>(null)
  const fileRef = useRef<File | null>(null)
  const [suggestedStartDate, setSuggestedStartDate] = useState<string | null>(null)

  // Duplicate detection state
  const [dupResult, setDupResult] = useState<DupCheckResponse>({ duplicate: 'none' })
  const [fuzzyAcknowledged, setFuzzyAcknowledged] = useState(false)

  // Auto-fetch the most recent end_date whenever invoiceType changes
  useEffect(() => {
    setSuggestedStartDate(null)
    getRecords(invoiceType, undefined, undefined, 1)
      .then((records) => {
        const last = records[records.length - 1]
        const endDate = last?.end_date
        if (typeof endDate === 'string' && endDate) {
          setSuggestedStartDate(nextDay(endDate as string))
        }
      })
      .catch(() => { /* silently ignore — Supabase may not be configured in dev */ })
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

      // ── Duplicate check ─────────────────────────────────────────
      const dupParams = buildDupParams(invoiceType, rows)
      const dup = await checkDuplicate(invoiceType, dupParams).catch(() => ({ duplicate: 'none' as const }))

      setDupResult(dup)
      setFuzzyAcknowledged(false)

      // Warn about start > end date
      for (const row of rows) {
        const s = row.start_date as string | null
        const e = row.end_date as string | null
        if (s && e && s > e) {
          toast.warning('Start date is after end date — possible missing invoice.')
          break
        }
      }

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
        toast.success(`Parsed ${rows.length} row${rows.length !== 1 ? 's' : ''} — review before saving.`)
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
      setDupResult({ duplicate: 'none' })
      fileRef.current = null
      setSuggestedStartDate(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
      throw err  // keep ReviewTable open
    }
  }

  const handleBack = () => {
    setState('idle')
    setResult(null)
    setDupResult({ duplicate: 'none' })
    fileRef.current = null
  }

  // Save is disabled on exact duplicate; requires acknowledgment on fuzzy
  const saveDisabled =
    dupResult.duplicate === 'exact' ||
    (dupResult.duplicate === 'fuzzy' && !fuzzyAcknowledged)

  // ── Review view ───────────────────────────────────────────────────────────
  if (state === 'review' && result) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
        {/* Duplicate banner — full width above the split */}
        {dupResult.duplicate !== 'none' && (
          <div className="px-6 pt-4 pb-0">
            <DupBanner
              dup={dupResult}
              fuzzyAcknowledged={fuzzyAcknowledged}
              onAcknowledge={() => setFuzzyAcknowledged(true)}
            />
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <PdfViewer images={result.pdf_page_images} />
          <ReviewTable
            invoiceType={invoiceType}
            initialRows={result.rows as Record<string, unknown>[]}
            warnings={result.warnings}
            onSave={handleSave}
            onBack={handleBack}
            saveDisabled={saveDisabled}
          />
        </div>
      </div>
    )
  }

  // ── Upload view ───────────────────────────────────────────────────────────
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

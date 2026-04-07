import { useState } from 'react'
import { toast } from 'sonner'
import type { SiteId, ParseResponse } from '../types'
import { parseInvoice, saveInvoice } from '../lib/api'
import { SITE_LABELS } from '../lib/columns'
import FileDropzone from '../components/FileDropzone'
import PdfViewer from '../components/PdfViewer'
import ReviewTable from '../components/ReviewTable'

const SITE_IDS: SiteId[] = ['cambridge', 'pickering_cng', 'walgreen', 'pickering_elexicon']

type State = 'idle' | 'parsing' | 'review'

export default function UploadPage() {
  const [invoiceType, setInvoiceType] = useState<SiteId>('cambridge')
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<ParseResponse | null>(null)

  const handleFile = async (file: File) => {
    setState('parsing')
    try {
      const data: ParseResponse = await parseInvoice(invoiceType, file)
      setResult(data)
      setState('review')
      if (data.warnings.length > 0) {
        const errCount = data.warnings.filter((w) => w.severity === 'error').length
        const warnCount = data.warnings.length - errCount
        const parts = [
          errCount > 0 ? `${errCount} error${errCount > 1 ? 's' : ''}` : '',
          warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? 's' : ''}` : '',
        ]
          .filter(Boolean)
          .join(', ')
        toast.warning(`Parsed with ${parts} — review highlighted cells.`)
      } else {
        toast.success(`Parsed ${data.rows.length} row${data.rows.length !== 1 ? 's' : ''} — review before saving.`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Parse failed: ${msg}`)
      setState('idle')
    }
  }

  const handleSave = async (rows: Record<string, unknown>[]) => {
    try {
      const res = await saveInvoice(invoiceType, rows)
      toast.success(`Saved ${res.inserted} row${res.inserted !== 1 ? 's' : ''} successfully.`)
      setState('idle')
      setResult(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Re-throw so ReviewTable stays open and shows the error
      toast.error(msg)
      throw err
    }
  }

  const handleBack = () => {
    setState('idle')
    setResult(null)
  }

  // ── Review view ───────────────────────────────────────────────────
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

  // ── Upload view ───────────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-1">Upload Invoice</h1>
      <p className="text-gray-500 text-sm mb-8">
        Select the invoice type, then drop or browse for the PDF.
      </p>

      {/* Invoice type selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Invoice type
        </label>
        <select
          value={invoiceType}
          onChange={(e) => setInvoiceType(e.target.value as SiteId)}
          disabled={state === 'parsing'}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {SITE_IDS.map((id) => (
            <option key={id} value={id}>
              {SITE_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      {/* Dropzone */}
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

      {/* Hints */}
      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>• Cambridge, Pickering Enbridge, and Elexicon PDFs are text-extractable.</p>
        <p>• Walgreen invoices are scanned — parsing requires the Anthropic API.</p>
        <p>• After parsing, review and edit the extracted values before saving.</p>
      </div>
    </div>
  )
}

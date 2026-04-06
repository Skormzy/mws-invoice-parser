import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { SiteId } from '../types'
import { getRecords, exportExcel } from '../lib/api'
import { SITE_COLS, SITE_LABELS } from '../lib/columns'

const SITES: SiteId[] = ['cambridge', 'pickering_cng', 'walgreen', 'pickering_elexicon']

function fmt(val: unknown, key: string): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    // High-precision rate fields
    if (key === 'cost_per_m3' || key === 'cost_per_kwh') return val.toFixed(4)
    if (key === 'cf_to_m3_conversion' || key === 'electricity_rate') return val.toFixed(6)
    // Dollar amounts
    if (
      key.includes('charge') || key.includes('cost') || key.includes('commodity') ||
      key.includes('transportation') || key.includes('adjustment') || key.includes('delivery') ||
      key.includes('balancing') || key.includes('hst') || key.includes('total') ||
      key.includes('setup') || key.includes('admin') || key.includes('network') ||
      key.includes('connection') || key.includes('services') || key.includes('electricity') ||
      key.includes('demand') || key.includes('monthly') || key.includes('recovery') ||
      key.includes('adjustment') || key === 'transportation'
    ) {
      return `$${val.toFixed(2)}`
    }
    return String(val)
  }
  return String(val)
}

export default function DashboardPage() {
  const [siteId, setSiteId] = useState<SiteId>('cambridge')
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRecords(siteId, startDate || undefined, endDate || undefined)
      setRecords(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to load records: ${msg}`)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [siteId, startDate, endDate])

  useEffect(() => {
    void fetchRecords()
  }, [fetchRecords])

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportExcel(siteId, SITE_LABELS[siteId].replace(/\s+/g, '_'))
      toast.success('Excel file downloaded.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Export failed: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  const cols = SITE_COLS[siteId]

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Top toolbar */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex flex-wrap items-center gap-4">
        {/* Site tabs */}
        <div className="flex gap-1">
          {SITES.map((id) => (
            <button
              key={id}
              onClick={() => setSiteId(id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                id === siteId
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {SITE_LABELS[id]}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate('') }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          {exporting ? 'Exporting…' : '↓ Export Excel'}
        </button>
      </div>

      {/* Record count */}
      <div className="px-6 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
        {loading
          ? 'Loading…'
          : `${records.length} record${records.length !== 1 ? 's' : ''} for ${SITE_LABELS[siteId]}`}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {records.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            No records found. Upload an invoice to get started.
          </div>
        ) : (
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-gray-100 sticky top-0 z-10">
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap ${col.width ?? ''}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rec, i) => (
                <tr
                  key={String(rec.id ?? i)}
                  className="hover:bg-blue-50 transition-colors"
                >
                  {cols.map((col) => (
                    <td
                      key={col.key}
                      className="border border-gray-200 px-2 py-1 whitespace-nowrap text-gray-700"
                    >
                      {fmt(rec[col.key], col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

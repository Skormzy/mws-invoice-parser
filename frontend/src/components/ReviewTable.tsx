import { useMemo, useState } from 'react'
import type { SiteId, ValidationWarning } from '../types'
import { SITE_COLS } from '../lib/columns'

interface Props {
  invoiceType: SiteId
  initialRows: Record<string, unknown>[]
  warnings: ValidationWarning[]
  onSave: (rows: Record<string, unknown>[]) => Promise<void>
  onBack: () => void
}

export default function ReviewTable({
  invoiceType,
  initialRows,
  warnings,
  onSave,
  onBack,
}: Props) {
  const cols = SITE_COLS[invoiceType]
  const [rows, setRows] = useState<Record<string, unknown>[]>(
    () => initialRows.map((r) => ({ ...r }))
  )
  const [saving, setSaving] = useState(false)

  // Build a Set of "rowIdx-fieldKey" for O(1) warning lookups
  const warnSet = useMemo(() => {
    const s = new Set<string>()
    warnings.forEach((w) => {
      if (w.field && w.row_index !== undefined) {
        s.add(`${w.row_index}-${w.field}`)
      }
    })
    return s
  }, [warnings])

  const errSet = useMemo(() => {
    const s = new Set<string>()
    warnings.forEach((w) => {
      if (w.severity === 'error' && w.field && w.row_index !== undefined) {
        s.add(`${w.row_index}-${w.field}`)
      }
    })
    return s
  }, [warnings])

  // Row-level warnings (no field attached)
  const rowWarnings = useMemo(() => {
    const map = new Map<number, ValidationWarning[]>()
    warnings.forEach((w) => {
      if (!w.field && w.row_index !== undefined) {
        const arr = map.get(w.row_index) ?? []
        arr.push(w)
        map.set(w.row_index, arr)
      }
    })
    return map
  }, [warnings])

  const globalWarnings = warnings.filter((w) => w.row_index === undefined)

  const updateCell = (rowIdx: number, key: string, raw: string) => {
    setRows((prev) => {
      const next = [...prev]
      const col = cols.find((c) => c.key === key)
      let val: unknown = raw
      if (raw === '' || raw === null) {
        val = null
      } else if (col?.type === 'number') {
        const n = parseFloat(raw)
        val = isNaN(n) ? raw : n
      } else if (col?.type === 'integer') {
        const n = parseInt(raw, 10)
        val = isNaN(n) ? raw : n
      }
      next[rowIdx] = { ...next[rowIdx], [key]: val }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(rows)
    } finally {
      setSaving(false)
    }
  }

  const cellBg = (rowIdx: number, key: string) => {
    if (errSet.has(`${rowIdx}-${key}`)) return 'bg-red-100'
    if (warnSet.has(`${rowIdx}-${key}`)) return 'bg-yellow-100'
    return ''
  }

  const fmtVal = (val: unknown, type: string) => {
    if (val === null || val === undefined) return ''
    if (type === 'date' && typeof val === 'string') return val.slice(0, 10)
    return String(val)
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-14 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← Back
          </button>
          <span className="text-sm font-medium text-gray-700">
            Review & Edit — {rows.length} row{rows.length !== 1 ? 's' : ''} extracted
          </span>
          {warnings.length > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-medium">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-1.5 rounded text-sm font-medium transition-colors"
        >
          {saving ? 'Saving…' : 'Save to Database'}
        </button>
      </div>

      {/* Global warnings */}
      {globalWarnings.length > 0 && (
        <div className="mx-4 mt-3 space-y-1">
          {globalWarnings.map((w, i) => (
            <div
              key={i}
              className={`text-sm px-3 py-2 rounded ${
                w.severity === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              }`}
            >
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-100 sticky top-0 z-10">
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 min-w-10">
                #
              </th>
              {cols.map((col) => (
                <th
                  key={col.key}
                  className={`border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap ${col.width ?? ''}`}
                >
                  {col.label}
                  {col.readOnly && (
                    <span className="ml-1 text-gray-400 font-normal">(calc)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <>
                {rowWarnings.get(rowIdx)?.map((w, wi) => (
                  <tr key={`warn-${rowIdx}-${wi}`}>
                    <td
                      colSpan={cols.length + 1}
                      className={`px-3 py-1 text-xs ${
                        w.severity === 'error'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-800'
                      }`}
                    >
                      Row {rowIdx + 1}: {w.message}
                    </td>
                  </tr>
                ))}
                <tr key={rowIdx} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-2 py-1 text-gray-400 text-center">
                    {rowIdx + 1}
                  </td>
                  {cols.map((col) => {
                    const bg = cellBg(rowIdx, col.key)
                    const val = fmtVal(row[col.key], col.type)
                    return (
                      <td
                        key={col.key}
                        className={`border border-gray-200 p-0 ${bg}`}
                      >
                        {col.readOnly ? (
                          <span className="block px-2 py-1 text-gray-500 bg-gray-50">
                            {val}
                          </span>
                        ) : (
                          <input
                            type={col.type === 'date' ? 'date' : 'text'}
                            value={val}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            className={`w-full px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-inset ${bg}`}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

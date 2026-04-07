import { useMemo, useState } from 'react'
import type { SiteId, ValidationWarning } from '../types'
import { SITE_COLS, SITE_GROUPS, buildGroupHeaderSpec } from '../lib/columns'
import { fmtCell } from '../lib/format'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  invoiceType: SiteId
  initialRows: Record<string, unknown>[]
  warnings: ValidationWarning[]
  onSave: (rows: Record<string, unknown>[]) => Promise<void>
  onBack: () => void
  saveDisabled?: boolean  // true when exact duplicate detected
}

export default function ReviewTable({
  invoiceType, initialRows, warnings, onSave, onBack, saveDisabled = false,
}: Props) {
  const cols = SITE_COLS[invoiceType]
  const groups = SITE_GROUPS[invoiceType]
  const groupSpec = useMemo(() => buildGroupHeaderSpec(cols, groups, true), [cols, groups])
  const hasGroups = groupSpec.length > 0

  const [rows, setRows] = useState<Record<string, unknown>[]>(
    () => initialRows.map((r) => ({ ...r })),
  )
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Warning lookup sets: "rowIdx-fieldKey"
  const warnSet = useMemo(() => {
    const s = new Set<string>()
    warnings.forEach((w) => {
      if (w.field && w.row_index != null) s.add(`${w.row_index}-${w.field}`)
    })
    return s
  }, [warnings])

  const errSet = useMemo(() => {
    const s = new Set<string>()
    warnings.forEach((w) => {
      if (w.severity === 'error' && w.field && w.row_index != null)
        s.add(`${w.row_index}-${w.field}`)
    })
    return s
  }, [warnings])

  const rowWarnings = useMemo(() => {
    const map = new Map<number, ValidationWarning[]>()
    warnings.forEach((w) => {
      if (!w.field && w.row_index != null) {
        const arr = map.get(w.row_index) ?? []
        arr.push(w)
        map.set(w.row_index, arr)
      }
    })
    return map
  }, [warnings])

  const globalWarnings = warnings.filter((w) => w.row_index == null)
  const errorCount = warnings.filter((w) => w.severity === 'error').length
  const warnCount = warnings.filter((w) => w.severity === 'warning').length

  const updateCell = (rowIdx: number, key: string, raw: string) => {
    setRows((prev) => {
      const next = [...prev]
      const col = cols.find((c) => c.key === key)
      let val: unknown = raw === '' ? null : raw
      if (raw !== '' && col) {
        if (col.type === 'number') {
          const n = parseFloat(raw.replace(/[$,]/g, ''))
          val = isNaN(n) ? raw : n
        } else if (col.type === 'integer') {
          const n = parseInt(raw.replace(/,/g, ''), 10)
          val = isNaN(n) ? raw : n
        }
      }
      next[rowIdx] = { ...next[rowIdx], [key]: val }
      return next
    })
  }

  const handleConfirmedSave = async () => {
    setShowConfirm(false)
    setSaving(true)
    try {
      await onSave(rows)
    } finally {
      setSaving(false)
    }
  }

  const cellCls = (rowIdx: number, key: string) => {
    if (errSet.has(`${rowIdx}-${key}`)) return 'bg-red-100'
    if (warnSet.has(`${rowIdx}-${key}`)) return 'bg-yellow-100'
    return ''
  }

  const rowBg = (rowIdx: number) => (rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50')

  // Sticky left offset for frozen cols (row# = 40px, first data frozen col = 40px)
  const frozenOffset = (colIdx: number): string => {
    const frozenBefore = cols.slice(0, colIdx).filter((c) => c.frozen).length
    // row# col = 40px, each frozen data col ≈ 112px (min-w-28)
    const base = 40 + frozenBefore * 112
    return `${base}px`
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-white">
      {/* ── Header bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-gray-700">
            Review &amp; Edit — {rows.length} row{rows.length !== 1 ? 's' : ''} extracted
          </span>
          {errorCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
          {warnCount > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-medium">
              {warnCount} warning{warnCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={saving || saveDisabled}
          title={saveDisabled ? 'Duplicate invoice detected — save disabled' : undefined}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Saving…' : saveDisabled ? 'Save Disabled (Duplicate)' : 'Save to Database'}
        </button>
      </div>

      {/* ── Global warnings ─────────────────────────────────────── */}
      {globalWarnings.length > 0 && (
        <div className="px-4 pt-2 space-y-1">
          {globalWarnings.map((w, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-1.5 rounded ${
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

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs border-separate border-spacing-0 w-full">
          <thead>
            {/* Group header row (Elexicon only) */}
            {hasGroups && (
              <tr>
                {groupSpec.map((seg, i) => (
                  <th
                    key={i}
                    colSpan={seg.span}
                    className={`
                      sticky top-0 z-30 border-b border-gray-200 px-2 py-1.5 text-center text-xs font-bold
                      ${seg.isGroup
                        ? 'bg-blue-500 text-white border-l border-r border-blue-400'
                        : 'bg-white'}
                    `}
                  >
                    {seg.isGroup ? seg.label : ''}
                  </th>
                ))}
              </tr>
            )}

            {/* Column header row */}
            <tr>
              {/* Row number */}
              <th
                className={`
                  sticky left-0 z-30 border-b border-r border-gray-300 bg-blue-800
                  text-white text-center px-2 py-2 font-semibold w-10 min-w-10
                  ${hasGroups ? 'top-8' : 'top-0'}
                `}
              >
                #
              </th>
              {cols.map((col, colIdx) => (
                <th
                  key={col.key}
                  className={`
                    border-b border-r border-gray-300 bg-blue-800 text-white
                    px-2 py-2 font-semibold whitespace-nowrap text-xs
                    ${col.frozen ? `sticky z-30` : ''}
                    ${col.rightAlign ? 'text-right' : 'text-left'}
                    ${col.width ?? ''}
                    ${hasGroups ? 'top-8' : 'sticky top-0'}
                  `}
                  style={col.frozen ? { left: frozenOffset(colIdx) } : undefined}
                >
                  {col.label}
                  {col.readOnly && (
                    <span className="ml-1 text-blue-300 font-normal text-xs">(calc)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIdx) => (
              <>
                {/* Row-level warning banner */}
                {rowWarnings.get(rowIdx)?.map((w, wi) => (
                  <tr key={`warn-${rowIdx}-${wi}`}>
                    <td
                      colSpan={cols.length + 1}
                      className={`px-3 py-1 text-xs ${
                        w.severity === 'error'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      Row {rowIdx + 1}: {w.message}
                    </td>
                  </tr>
                ))}

                <tr key={rowIdx} className={`${rowBg(rowIdx)} hover:bg-blue-50 transition-colors`}>
                  {/* Sticky row number */}
                  <td
                    className={`sticky left-0 z-10 border-b border-r border-gray-200 text-center text-gray-400 font-medium px-2 py-1 ${rowBg(rowIdx)}`}
                  >
                    {rowIdx + 1}
                  </td>

                  {cols.map((col, colIdx) => {
                    const bg = cellCls(rowIdx, col.key)
                    const rawVal = row[col.key]

                    return (
                      <td
                        key={col.key}
                        className={`
                          border-b border-r border-gray-200 p-0
                          ${col.frozen ? `sticky z-10 ${rowBg(rowIdx)}` : ''}
                          ${bg}
                        `}
                        style={col.frozen ? { left: frozenOffset(colIdx) } : undefined}
                      >
                        {col.readOnly ? (
                          <span
                            className={`block px-2 py-1 text-gray-500 bg-gray-50 ${col.rightAlign ? 'text-right' : ''}`}
                          >
                            {fmtCell(rawVal, col.fmt)}
                          </span>
                        ) : (
                          <input
                            type={col.type === 'date' ? 'date' : 'text'}
                            defaultValue={
                              col.type === 'date' && typeof rawVal === 'string'
                                ? rawVal.slice(0, 10)
                                : rawVal != null ? String(rawVal) : ''
                            }
                            onBlur={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            className={`
                              w-full px-2 py-1 bg-transparent focus:outline-none
                              focus:ring-1 focus:ring-inset focus:ring-blue-400
                              ${bg}
                              ${col.rightAlign ? 'text-right' : ''}
                            `}
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

      {/* ── Save confirmation dialog ─────────────────────────── */}
      <ConfirmDialog
        open={showConfirm}
        title={`Save ${rows.length} record${rows.length !== 1 ? 's' : ''}?`}
        body={
          <div className="space-y-1">
            <p>
              Save <strong>{rows.length}</strong> record
              {rows.length !== 1 ? 's' : ''} to the database?
            </p>
            {errorCount > 0 && (
              <p className="text-red-600 text-xs">
                ⚠ {errorCount} validation error{errorCount > 1 ? 's' : ''} detected — review before saving.
              </p>
            )}
          </div>
        }
        confirmLabel="Save"
        onConfirm={handleConfirmedSave}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

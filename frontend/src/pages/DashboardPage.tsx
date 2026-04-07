import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { SiteId } from '../types'
import {
  getRecords, updateRecord, deleteRecord,
  getSite, updateSite, getPdfUrl, exportExcel,
} from '../lib/api'
import {
  SITE_COLS, SITE_GROUPS, SITE_LABELS,
  buildGroupHeaderSpec, type ColDef,
} from '../lib/columns'
import { fmtCell } from '../lib/format'
import ConfirmDialog from '../components/ConfirmDialog'

const SITES: SiteId[] = ['cambridge', 'pickering_cng', 'walgreen', 'pickering_elexicon']

// ── Site metadata card ──────────────────────────────────────────────

interface SiteCardProps { siteId: SiteId }

function SiteCard({ siteId }: SiteCardProps) {
  const [site, setSite] = useState<Record<string, unknown> | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    getSite(siteId).then(setSite).catch(() => setSite(null))
  }, [siteId])

  if (!site) return null

  const startEdit = () => {
    setDraft({
      display_name:    String(site.display_name   ?? ''),
      address:         String(site.address         ?? ''),
      account_number:  String(site.account_number  ?? ''),
      bill_number:     String(site.bill_number      ?? ''),
      rate_description: String(site.rate_description ?? ''),
      sage_notes:      String(site.sage_notes       ?? ''),
    })
    setEditing(true)
  }

  const handleConfirmedSave = async () => {
    setShowConfirm(false)
    try {
      const updated = await updateSite(siteId, draft)
      setSite(updated)
      setEditing(false)
      toast.success('Site information updated.')
    } catch (err) {
      toast.error(`Update failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const changedFields = editing
    ? Object.keys(draft).filter((k) => draft[k] !== String(site[k] ?? ''))
    : []

  const Field = ({ label, field }: { label: string; field: string }) =>
    editing ? (
      <div>
        <label className="text-xs font-medium text-gray-500">{label}</label>
        <input
          value={draft[field] ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
          className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
    ) : (
      <div>
        <span className="text-xs font-medium text-gray-500">{label}: </span>
        <span className="text-sm text-gray-800">{String(site[field] ?? '—')}</span>
      </div>
    )

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-2">
          <Field label="Display name"    field="display_name" />
          <Field label="Address"         field="address" />
          <Field label="Account #"       field="account_number" />
          <Field label="Bill #"          field="bill_number" />
          <Field label="Rate"            field="rate_description" />
          <Field label="Sage notes"      field="sage_notes" />
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={changedFields.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
              >
                Save changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
            >
              ✏ Edit
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={`Update site information for ${SITE_LABELS[siteId]}?`}
        body={
          changedFields.length > 0
            ? <p>Changed fields: <strong>{changedFields.join(', ')}</strong></p>
            : 'No changes to save.'
        }
        confirmLabel="Update"
        onConfirm={handleConfirmedSave}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

// ── Dashboard table cell ────────────────────────────────────────────

interface CellProps {
  col: ColDef
  value: unknown
  editing: boolean
  onChange: (val: string) => void
}

function DashCell({ col, value, editing, onChange }: CellProps) {
  const align = col.rightAlign ? 'text-right' : 'text-left'
  if (editing && !col.readOnly) {
    return (
      <input
        type={col.type === 'date' ? 'date' : 'text'}
        defaultValue={
          col.type === 'date' && typeof value === 'string'
            ? value.slice(0, 10)
            : value != null ? String(value) : ''
        }
        onBlur={(e) => onChange(e.target.value)}
        className={`w-full px-1.5 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50 ${align}`}
      />
    )
  }
  return (
    <span className={`block ${align} ${col.readOnly && editing ? 'text-gray-400' : ''}`}>
      {value == null ? '—' : fmtCell(value, col.fmt)}
    </span>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Build tab-separated clipboard text using raw values (dates as YYYY-MM-DD, numbers as plain numerics). */
function buildClipboardText(cols: ColDef[], records: Record<string, unknown>[]): string {
  const header = cols.map((c) => c.label).join('\t')
  const rows = records.map((rec) =>
    cols.map((c) => {
      const v = rec[c.key]
      if (v == null) return ''
      if (typeof v === 'string') return v  // dates already YYYY-MM-DD
      return String(v)                     // numbers as plain numerics
    }).join('\t')
  )
  return [header, ...rows].join('\n')
}

// ── Main dashboard page ─────────────────────────────────────────────

interface DashboardPageProps {
  defaultSiteId?: SiteId
}

export default function DashboardPage({ defaultSiteId }: DashboardPageProps) {
  const [siteId, setSiteId] = useState<SiteId>(defaultSiteId ?? 'cambridge')
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  // Edit/delete state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBuffer, setEditBuffer] = useState<Record<string, unknown>>({})
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState('')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  const cols   = SITE_COLS[siteId]
  const groups = SITE_GROUPS[siteId]
  const groupSpec = buildGroupHeaderSpec(cols, groups, false)
  const hasGroups = groupSpec.length > 0

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setEditingId(null)
    setSelectedIds(new Set())
    try {
      const data = await getRecords(siteId, startDate || undefined, endDate || undefined)
      setRecords(data)
    } catch (err) {
      toast.error(`Failed to load records: ${err instanceof Error ? err.message : String(err)}`)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [siteId, startDate, endDate])

  // Reload whenever site or either date filter changes (dynamic filtering)
  useEffect(() => { void fetchRecords() }, [fetchRecords])

  // ── Edit handlers ─────────────────────────────────────────────
  const startEdit = (record: Record<string, unknown>) => {
    setEditingId(String(record.id))
    setEditBuffer({ ...record })
  }

  const updateEditCell = (key: string, raw: string) => {
    const col = cols.find((c) => c.key === key)
    let val: unknown = raw === '' ? null : raw
    if (raw !== '' && col) {
      if (col.type === 'number') {
        const n = parseFloat(raw.replace(/[$,]/g, ''))
        if (!isNaN(n)) val = n
      } else if (col.type === 'integer') {
        const n = parseInt(raw.replace(/,/g, ''), 10)
        if (!isNaN(n)) val = n
      }
    }
    setEditBuffer((b) => ({ ...b, [key]: val }))
  }

  const changedFields = editingId
    ? cols
        .filter((c) => !c.readOnly)
        .filter((c) => {
          const original = records.find((r) => String(r.id) === editingId)?.[c.key]
          const edited   = editBuffer[c.key]
          return String(original ?? '') !== String(edited ?? '')
        })
        .map((c) => c.label)
    : []

  const handleConfirmedEdit = async () => {
    setShowEditConfirm(false)
    if (!editingId) return
    try {
      const updated = await updateRecord(siteId, editingId, editBuffer)
      setRecords((prev) => prev.map((r) => String(r.id) === editingId ? updated : r))
      setEditingId(null)
      toast.success('Record updated.')
    } catch (err) {
      toast.error(`Update failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Delete handlers ───────────────────────────────────────────
  const requestDelete = (record: Record<string, unknown>) => {
    setPendingDeleteId(String(record.id))
    const label = String(
      record.start_date
        ? `${record.start_date} – ${record.end_date}`
        : record.bill_period ?? record.id,
    )
    setPendingDeleteLabel(label)
    setShowDeleteConfirm(true)
  }

  const handleConfirmedDelete = async () => {
    setShowDeleteConfirm(false)
    if (!pendingDeleteId) return
    try {
      await deleteRecord(siteId, pendingDeleteId)
      setRecords((prev) => prev.filter((r) => String(r.id) !== pendingDeleteId))
      if (editingId === pendingDeleteId) setEditingId(null)
      toast.success('Record deleted.')
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Bulk delete ───────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setShowBulkDeleteConfirm(false)
    const ids = [...selectedIds]
    let deleted = 0
    for (const id of ids) {
      try {
        await deleteRecord(siteId, id)
        deleted++
      } catch {
        // continue with remaining
      }
    }
    setRecords((prev) => prev.filter((r) => !selectedIds.has(String(r.id))))
    if (editingId && selectedIds.has(editingId)) setEditingId(null)
    setSelectedIds(new Set())
    toast.success(`Deleted ${deleted} record${deleted !== 1 ? 's' : ''}.`)
  }

  // ── PDF viewer ────────────────────────────────────────────────
  const handleViewPdf = async (recordId: string) => {
    try {
      const url = await getPdfUrl(siteId, recordId)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toast.error(`No PDF available: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Export ────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true)
    try {
      await exportExcel(siteId, SITE_LABELS[siteId].replace(/\s+/g, '_'))
      toast.success('Excel file downloaded.')
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }

  // ── Copy table to clipboard ───────────────────────────────────
  const handleCopyTable = async () => {
    const text = buildClipboardText(cols, records)
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Table copied to clipboard (${records.length} row${records.length !== 1 ? 's' : ''})`)
    } catch {
      toast.error('Could not copy to clipboard.')
    }
  }

  // Frozen left offset: 32px checkbox + 96px actions + 112px per frozen data col before this one
  const frozenOffset = (colIdx: number): string => {
    const frozenBefore = cols.slice(0, colIdx).filter((c) => c.frozen).length
    return `${128 + frozenBefore * 112}px`
  }

  const rowBg = (i: number) => (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center gap-3 sticky top-0 z-40">
        {/* Site tabs */}
        <div className="flex gap-1">
          {SITES.map((id) => (
            <button
              key={id}
              onClick={() => setSiteId(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                id === siteId
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {SITE_LABELS[id]}
            </button>
          ))}
        </div>

        {/* Date range filter — dynamically re-fetches on change */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-500">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
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

        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            Delete Selected ({selectedIds.size})
          </button>
        )}

        <button
          onClick={handleCopyTable}
          disabled={records.length === 0}
          className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          ⎘ Copy Table
        </button>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          {exporting ? 'Exporting…' : '↓ Export Excel'}
        </button>
      </div>

      {/* ── Site metadata card ─────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0">
        <SiteCard siteId={siteId} />
      </div>

      {/* ── Record count bar ───────────────────────────────────── */}
      <div className="px-6 py-1.5 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
        {loading
          ? 'Loading…'
          : `${records.length} record${records.length !== 1 ? 's' : ''} · ${SITE_LABELS[siteId]}`}
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {records.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            No records found. Upload an invoice to get started.
          </div>
        ) : (
          <table className="text-xs border-separate border-spacing-0 w-full">
            <thead>
              {/* Group header row */}
              {hasGroups && (
                <tr>
                  {/* Checkbox + Actions placeholders */}
                  <th className="sticky top-0 z-30 bg-white border-b border-gray-200 w-8 min-w-8" />
                  <th className="sticky top-0 z-30 bg-white border-b border-gray-200 w-24 min-w-24" />
                  {groupSpec.map((seg, i) => (
                    <th
                      key={i}
                      colSpan={seg.span}
                      className={`
                        sticky top-0 z-30 border-b border-gray-200 px-2 py-1.5
                        text-center text-xs font-bold
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
                {/* Select All checkbox */}
                <th
                  className={`
                    sticky left-0 z-30 bg-blue-800
                    border-b border-r border-gray-300
                    w-8 min-w-8 text-center
                    ${hasGroups ? 'top-8' : 'top-0'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.size === records.length && records.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(records.map((r) => String(r.id))))
                      else setSelectedIds(new Set())
                    }}
                    className="cursor-pointer accent-white"
                    title={selectedIds.size === records.length && records.length > 0 ? 'Deselect all' : 'Select all'}
                  />
                </th>
                {/* Actions */}
                <th
                  className={`
                    sticky left-8 z-30 bg-blue-800 text-white
                    border-b border-r border-gray-300
                    px-2 py-2 w-24 min-w-24 text-center font-semibold
                    ${hasGroups ? 'top-8' : 'top-0'}
                  `}
                >
                  Actions
                </th>
                {cols.map((col, colIdx) => (
                  <th
                    key={col.key}
                    className={`
                      border-b border-r border-gray-300 bg-blue-800 text-white
                      px-2 py-2 font-semibold whitespace-nowrap text-xs
                      ${col.frozen ? 'sticky z-30' : hasGroups ? 'top-8' : 'sticky top-0'}
                      ${col.rightAlign ? 'text-right' : 'text-left'}
                      ${col.width ?? ''}
                    `}
                    style={col.frozen ? { top: hasGroups ? '32px' : '0', left: frozenOffset(colIdx) } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {records.map((record, rowIdx) => {
                const id = String(record.id)
                const isEditing = editingId === id
                const displayRow = isEditing ? editBuffer : record
                const bg = rowBg(rowIdx)

                return (
                  <tr
                    key={id}
                    className={`${isEditing ? 'bg-blue-50 ring-1 ring-blue-300 ring-inset' : `${bg} hover:bg-blue-50`} transition-colors`}
                  >
                    {/* Checkbox cell */}
                    <td
                      className={`sticky left-0 z-10 border-b border-r border-gray-200 text-center px-1 py-1 w-8 min-w-8 ${isEditing ? 'bg-blue-50' : bg}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(id) : next.delete(id)
                            return next
                          })
                        }}
                        className="cursor-pointer"
                      />
                    </td>

                    {/* Actions cell */}
                    <td
                      className={`sticky left-8 z-10 border-b border-r border-gray-200 px-1.5 py-1 ${isEditing ? 'bg-blue-50' : bg}`}
                    >
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => {
                                if (changedFields.length === 0) {
                                  setEditingId(null)
                                } else {
                                  setShowEditConfirm(true)
                                }
                              }}
                              className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(record)}
                              title="Edit row"
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                            >
                              ✏
                            </button>
                            <button
                              onClick={() => requestDelete(record)}
                              title="Delete row"
                              className="px-2 py-0.5 text-xs bg-red-50 text-red-500 rounded hover:bg-red-100"
                            >
                              🗑
                            </button>
                            {record.source_pdf_path && (
                              <button
                                onClick={() => handleViewPdf(id)}
                                title="View PDF"
                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                              >
                                📄
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Data cells */}
                    {cols.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`
                          border-b border-r border-gray-200 px-2 py-1 whitespace-nowrap
                          ${col.frozen ? `sticky z-10 ${isEditing ? 'bg-blue-50' : bg}` : ''}
                        `}
                        style={col.frozen ? { left: frozenOffset(colIdx) } : undefined}
                      >
                        <DashCell
                          col={col}
                          value={displayRow[col.key]}
                          editing={isEditing}
                          onChange={(v) => updateEditCell(col.key, v)}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit confirmation ─────────────────────────────────── */}
      <ConfirmDialog
        open={showEditConfirm}
        title="Update this record?"
        body={
          changedFields.length > 0
            ? <p>Changed fields: <strong>{changedFields.join(', ')}</strong></p>
            : 'No changes.'
        }
        confirmLabel="Update"
        onConfirm={handleConfirmedEdit}
        onCancel={() => setShowEditConfirm(false)}
      />

      {/* ── Delete confirmation ───────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete record?"
        body={
          <p>
            Delete record for <strong>{pendingDeleteLabel}</strong>?{' '}
            <span className="text-red-600">This cannot be undone.</span>
          </p>
        }
        confirmLabel="Delete"
        danger
        onConfirm={handleConfirmedDelete}
        onCancel={() => { setShowDeleteConfirm(false); setPendingDeleteId(null) }}
      />

      {/* ── Bulk delete confirmation ──────────────────────────── */}
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} record${selectedIds.size !== 1 ? 's' : ''}?`}
        body={
          <p>
            Permanently delete <strong>{selectedIds.size}</strong> selected record
            {selectedIds.size !== 1 ? 's' : ''}?{' '}
            <span className="text-red-600">This cannot be undone.</span>
          </p>
        }
        confirmLabel="Delete All"
        danger
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </div>
  )
}

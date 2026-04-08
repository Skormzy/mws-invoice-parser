import type { SiteId, DupCheckResponse } from '../types'

const BASE = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')
  : '/api'

// ── Parse ──────────────────────────────────────────────────────────
export async function parseInvoice(invoiceType: SiteId, file: File) {
  const form = new FormData()
  form.append('invoice_type', invoiceType)
  form.append('file', file)

  const res = await fetch(`${BASE}/parse`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Parse failed')
  }
  return res.json()
}

// ── Save (multipart — rows as JSON string + optional PDF) ──────────
export async function saveInvoice(
  invoiceType: SiteId,
  rows: Record<string, unknown>[],
  file?: File | null,
) {
  const form = new FormData()
  form.append('invoice_type', invoiceType)
  form.append('rows', JSON.stringify(rows))
  if (file) form.append('file', file)

  const res = await fetch(`${BASE}/save`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Save failed')
  }
  return res.json()
}

// ── Records ────────────────────────────────────────────────────────
export async function getRecords(
  siteId: SiteId,
  startDate?: string,
  endDate?: string,
  limit?: number,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()

  const res = await fetch(`${BASE}/records/${siteId}${qs ? `?${qs}` : ''}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Failed to load records')
  }
  return res.json()
}

export async function updateRecord(
  siteId: SiteId,
  recordId: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/records/${siteId}/${recordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Update failed')
  }
  return res.json()
}

export async function deleteRecord(siteId: SiteId, recordId: string): Promise<void> {
  const res = await fetch(`${BASE}/records/${siteId}/${recordId}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Delete failed')
  }
}

// ── Duplicate check ────────────────────────────────────────────────
export async function checkDuplicate(
  siteId: SiteId,
  opts: {
    invoiceNumber?: string | null
    endDate?: string | null
    cost?: number | null
    readPeriod?: string | null
    totalCharge?: number | null
  },
): Promise<DupCheckResponse> {
  const params = new URLSearchParams()
  if (opts.invoiceNumber) params.set('invoice_number', opts.invoiceNumber)
  if (opts.endDate) params.set('end_date', opts.endDate)
  if (opts.cost != null) params.set('cost', String(opts.cost))
  if (opts.readPeriod) params.set('read_period', opts.readPeriod)
  if (opts.totalCharge != null) params.set('total_charge', String(opts.totalCharge))

  const res = await fetch(`${BASE}/check-duplicate/${siteId}?${params.toString()}`)
  if (!res.ok) {
    // Silently return 'none' on error — duplicate check is non-blocking
    return { duplicate: 'none' }
  }
  return res.json()
}

// ── Sites ──────────────────────────────────────────────────────────
export async function getSite(siteId: SiteId): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/sites/${siteId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Failed to load site')
  }
  return res.json()
}

export async function updateSite(
  siteId: SiteId,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/sites/${siteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Site update failed')
  }
  return res.json()
}

// ── PDF signed URL ─────────────────────────────────────────────────
export async function getPdfUrl(siteId: SiteId, recordId: string): Promise<string> {
  const res = await fetch(`${BASE}/pdf/${siteId}/${recordId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Could not retrieve PDF URL')
  }
  const data = await res.json()
  return data.url as string
}

// ── Export ─────────────────────────────────────────────────────────
export async function exportExcel(siteId: SiteId, label: string) {
  const res = await fetch(`${BASE}/export/${siteId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Export failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${label}_Invoice_Tracker.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

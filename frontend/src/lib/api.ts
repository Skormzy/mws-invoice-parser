import type { SiteId } from '../types'

const BASE = '/api'

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

// ── Save ───────────────────────────────────────────────────────────
export async function saveInvoice(
  invoiceType: SiteId,
  rows: Record<string, unknown>[]
) {
  const res = await fetch(`${BASE}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_type: invoiceType, rows }),
  })
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
  endDate?: string
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  const qs = params.toString()

  const res = await fetch(`${BASE}/records/${siteId}${qs ? `?${qs}` : ''}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? 'Failed to load records')
  }
  return res.json()
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

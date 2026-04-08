import type { SiteId, DupCheckResponse } from '../types'

const PROXY_BASE = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')
  : `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')}/functions/v1/proxy/api`

// Supabase Edge Function gateway requires both apikey and Authorization headers
async function getHeaders(isFormData = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY as string}`,
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Parse ──────────────────────────────────────────────────────────
export async function parseInvoice(invoiceType: SiteId, file: File) {
  const form = new FormData()
  form.append('invoice_type', invoiceType)
  form.append('file', file)

  const res = await fetch(`${PROXY_BASE}/parse`, {
    method: 'POST',
    headers: await getHeaders(true),
    body: form,
  })
  return handleResponse(res)
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

  const res = await fetch(`${PROXY_BASE}/save`, {
    method: 'POST',
    headers: await getHeaders(true),
    body: form,
  })
  return handleResponse(res)
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

  const res = await fetch(`${PROXY_BASE}/records/${siteId}${qs ? `?${qs}` : ''}`, {
    headers: await getHeaders(false),
  })
  return handleResponse(res)
}

export async function updateRecord(
  siteId: SiteId,
  recordId: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${PROXY_BASE}/records/${siteId}/${recordId}`, {
    method: 'PUT',
    headers: await getHeaders(false),
    body: JSON.stringify(row),
  })
  return handleResponse(res)
}

export async function deleteRecord(siteId: SiteId, recordId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/records/${siteId}/${recordId}`, {
    method: 'DELETE',
    headers: await getHeaders(false),
  })
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

  const res = await fetch(
    `${PROXY_BASE}/check-duplicate/${siteId}?${params.toString()}`,
    { headers: await getHeaders(false) },
  )
  if (!res.ok) return { duplicate: 'none' }  // non-blocking
  return res.json()
}

// ── Sites ──────────────────────────────────────────────────────────
export async function getSite(siteId: SiteId): Promise<Record<string, unknown>> {
  const res = await fetch(`${PROXY_BASE}/sites/${siteId}`, {
    headers: await getHeaders(false),
  })
  return handleResponse(res)
}

export async function updateSite(
  siteId: SiteId,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${PROXY_BASE}/sites/${siteId}`, {
    method: 'PUT',
    headers: await getHeaders(false),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

// ── PDF signed URL ─────────────────────────────────────────────────
export async function getPdfUrl(siteId: SiteId, recordId: string): Promise<string> {
  const res = await fetch(`${PROXY_BASE}/pdf/${siteId}/${recordId}`, {
    headers: await getHeaders(false),
  })
  const data = await handleResponse(res)
  return data.url as string
}

// ── Export ─────────────────────────────────────────────────────────
export async function exportExcel(siteId: SiteId, label: string) {
  const res = await fetch(`${PROXY_BASE}/export/${siteId}`, {
    headers: await getHeaders(false),
  })
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

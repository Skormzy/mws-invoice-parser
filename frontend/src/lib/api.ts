import { supabase } from './supabase'
import type { SiteId, DupCheckResponse } from '../types'

const PROXY_BASE = `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')}/functions/v1/proxy/api`

function extractErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback
  const detail = (err as Record<string, unknown>).detail
  if (Array.isArray(detail)) {
    // FastAPI 422 returns [{loc, msg, type}]
    return detail.map((e) => {
      if (e && typeof e === 'object') {
        const loc = (e as Record<string, unknown>).loc
        const msg = (e as Record<string, unknown>).msg
        const locStr = Array.isArray(loc) ? loc.join('.') : String(loc ?? '')
        return locStr ? `${locStr}: ${msg}` : String(msg)
      }
      return String(e)
    }).join('; ')
  }
  return String(detail || fallback)
}

async function proxyHeaders(): Promise<Record<string, string>> {
  return {
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY as string}`,
    'Content-Type': 'application/json',
  }
}

// ── Parse ──────────────────────────────────────────────────────────
export async function parseInvoice(invoiceType: SiteId, file: File) {
  // Step 1: Upload PDF to Supabase Storage (avoids multipart through edge function gateway)
  const storagePath = `temp/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(storagePath, file, { contentType: 'application/pdf' })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  // Step 2: Call edge function with just the path (small JSON payload)
  const resp = await fetch(`${PROXY_BASE}/parse`, {
    method: 'POST',
    headers: await proxyHeaders(),
    body: JSON.stringify({ invoice_type: invoiceType, storage_path: storagePath }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Parse failed'))
  }
  const parsed = await resp.json()
  // Include storage_path so UploadPage can forward it to saveInvoice
  return { ...parsed, storage_path: storagePath }
}

// ── Save ───────────────────────────────────────────────────────────
export async function saveInvoice(
  invoiceType: SiteId,
  rows: Record<string, unknown>[],
  storagePath?: string | null,
) {
  const resp = await fetch(`${PROXY_BASE}/save`, {
    method: 'POST',
    headers: await proxyHeaders(),
    body: JSON.stringify({ invoice_type: invoiceType, rows, storage_path: storagePath ?? null }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Save failed'))
  }
  return resp.json()
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

  const resp = await fetch(`${PROXY_BASE}/records/${siteId}${qs ? `?${qs}` : ''}`, {
    headers: await proxyHeaders(),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Fetch failed'))
  }
  return resp.json()
}

export async function updateRecord(
  siteId: SiteId,
  recordId: string,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${PROXY_BASE}/records/${siteId}/${recordId}`, {
    method: 'PUT',
    headers: await proxyHeaders(),
    body: JSON.stringify(row),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Update failed'))
  }
  return resp.json()
}

export async function deleteRecord(siteId: SiteId, recordId: string): Promise<void> {
  const resp = await fetch(`${PROXY_BASE}/records/${siteId}/${recordId}`, {
    method: 'DELETE',
    headers: await proxyHeaders(),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Delete failed'))
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

  const resp = await fetch(
    `${PROXY_BASE}/check-duplicate/${siteId}?${params.toString()}`,
    { headers: await proxyHeaders() },
  )
  if (!resp.ok) return { duplicate: 'none' }  // non-blocking
  return resp.json()
}

// ── Sites ──────────────────────────────────────────────────────────
export async function getSite(siteId: SiteId): Promise<Record<string, unknown>> {
  const resp = await fetch(`${PROXY_BASE}/sites/${siteId}`, {
    headers: await proxyHeaders(),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Fetch site failed'))
  }
  return resp.json()
}

export async function updateSite(
  siteId: SiteId,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${PROXY_BASE}/sites/${siteId}`, {
    method: 'PUT',
    headers: await proxyHeaders(),
    body: JSON.stringify(data),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Update site failed'))
  }
  return resp.json()
}

// ── PDF signed URL ─────────────────────────────────────────────────
export async function getPdfUrl(siteId: SiteId, recordId: string): Promise<string> {
  const resp = await fetch(`${PROXY_BASE}/pdf/${siteId}/${recordId}`, {
    headers: await proxyHeaders(),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Fetch PDF URL failed'))
  }
  const data = await resp.json()
  return data.url as string
}

// ── Export ─────────────────────────────────────────────────────────
export async function exportExcel(siteId: SiteId, label: string) {
  const resp = await fetch(`${PROXY_BASE}/export/${siteId}`, {
    headers: await proxyHeaders(),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(extractErrorMessage(err, 'Export failed'))
  }
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${label}_Invoice_Tracker.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

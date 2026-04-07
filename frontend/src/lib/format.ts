/**
 * Display-only number formatting helpers.
 * The raw numeric values stored in state and sent to the DB are never modified.
 */

/** Dollar amount with commas and 2 decimal places: 6396.42 → "$6,396.42" */
export function fmtDollar(val: number | null | undefined): string {
  if (val == null) return '—'
  return val.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace('CA$', '$')
}

/** Volume (m³, kWh, CD) with commas, no decimals for whole numbers: 16819 → "16,819" */
export function fmtVolume(val: number | null | undefined, decimals = 0): string {
  if (val == null) return '—'
  return val.toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

/**
 * $/m³ or $/kWh — screen display rounds to 2 decimal places.
 * Underlying precision is preserved in the DB.
 */
export function fmtRate(val: number | null | undefined): string {
  if (val == null) return '—'
  if (val === 0) return '$0.00'
  return `$${val.toFixed(2)}`
}

/** Generic cell formatter driven by the ColFmt tag in ColDef */
export function fmtCell(val: unknown, fmt: ColFmt): string {
  if (val == null) return '—'
  switch (fmt) {
    case 'dollar':
      return fmtDollar(typeof val === 'number' ? val : parseFloat(String(val)))
    case 'rate':
      return fmtRate(typeof val === 'number' ? val : parseFloat(String(val)))
    case 'volume':
      return fmtVolume(typeof val === 'number' ? val : parseFloat(String(val)))
    case 'integer':
      return typeof val === 'number'
        ? val.toLocaleString('en-CA', { maximumFractionDigits: 0 })
        : String(val)
    case 'date':
      return typeof val === 'string' ? val.slice(0, 10) : String(val)
    default:
      return String(val)
  }
}

export type ColFmt = 'dollar' | 'volume' | 'rate' | 'integer' | 'number' | 'date' | 'text'

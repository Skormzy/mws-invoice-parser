import type { ColFmt } from './format'
import type { SiteId } from '../types'

export type { ColFmt }

export interface ColDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'integer'
  fmt: ColFmt
  readOnly?: boolean
  frozen?: boolean
  width?: string
  rightAlign?: boolean
}

export interface ColGroup {
  label: string
  startIndex: number  // 0-based index into the ColDef array
  colSpan: number
}

// ── Cambridge (25 cols) ───────────────────────────────────────
// Order: invoice metadata | period | consumption | charges | totals | balance | calculated | audit | notes
export const CAMBRIDGE_COLS: ColDef[] = [
  // Invoice metadata
  { key: 'invoice_number',                   label: 'Invoice #',              type: 'text',    fmt: 'text',    frozen: true, width: 'min-w-28' },
  { key: 'bill_date',                        label: 'Bill Date',              type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'due_date',                         label: 'Due Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  // Period
  { key: 'enbridge_qtr_reference',           label: 'Qtr Ref',                type: 'text',    fmt: 'text',    width: 'min-w-24' },
  { key: 'start_date',                       label: 'Start Date',             type: 'date',    fmt: 'date',    frozen: true, width: 'min-w-28' },
  { key: 'end_date',                         label: 'End Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'billing_period',                   label: 'Billing Period',         type: 'date',    fmt: 'date',    width: 'min-w-28' },
  // Consumption
  { key: 'cd',                               label: 'CD (m³)',                type: 'number',  fmt: 'volume',  width: 'min-w-20', rightAlign: true },
  { key: 'gas_consumption',                  label: 'Gas Consumption (m³)',   type: 'number',  fmt: 'volume',  width: 'min-w-36', rightAlign: true },
  { key: 'split_volumes',                    label: 'Split Volumes (m³)',     type: 'text',    fmt: 'text',    width: 'min-w-28' },
  // Charges
  { key: 'demand_charge',                    label: 'Demand Charge',          type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'delivery_charge',                  label: 'Delivery Charge',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'monthly_charge_interruptible',     label: 'Monthly (Interrupt.)',   type: 'number',  fmt: 'dollar',  width: 'min-w-32', rightAlign: true },
  { key: 'gas_supply_commodity',             label: 'Gas Supply Commodity',   type: 'number',  fmt: 'dollar',  width: 'min-w-32', rightAlign: true },
  { key: 'gas_supply_transportation',        label: 'Gas Supply Transport',   type: 'number',  fmt: 'dollar',  width: 'min-w-32', rightAlign: true },
  { key: 'commodity_fuel_price_adjustment',  label: 'Commodity Adjust.',      type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'miscellaneous_charges',            label: 'Miscellaneous',          type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'enbridge_invoice_cost_excl_hst',   label: 'Cost Excl. HST',         type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  // Totals
  { key: 'hst_amount',                       label: 'HST',                    type: 'number',  fmt: 'dollar',  width: 'min-w-20', rightAlign: true },
  { key: 'total_incl_hst',                   label: 'Total Incl. HST',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  // Balance
  { key: 'balance_forward',                  label: 'Balance Forward',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'late_payment_charge',              label: 'Late Payment',           type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  // Calculated
  { key: 'cost_per_m3',                      label: '$/m³',                   type: 'number',  fmt: 'rate',    width: 'min-w-20', rightAlign: true, readOnly: true },
  // Audit
  { key: 'source_pdf_filename',              label: 'Source PDF',             type: 'text',    fmt: 'text',    width: 'min-w-32' },
  // Notes
  { key: 'notes',                            label: 'Notes',                  type: 'text',    fmt: 'text',    width: 'min-w-40' },
]

// ── Pickering CNG (31 cols) ────────────────────────────────────
export const PICKERING_CNG_COLS: ColDef[] = [
  // Invoice metadata
  { key: 'invoice_number',              label: 'Invoice # (Bill #)',     type: 'text',    fmt: 'text',    frozen: true, width: 'min-w-32' },
  { key: 'bill_date',                   label: 'Bill Date',              type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'due_date',                    label: 'Due Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  // Period
  { key: 'enbridge_qtr_reference',      label: 'Qtr Ref',                type: 'text',    fmt: 'text',    width: 'min-w-24' },
  { key: 'start_date',                  label: 'Start Date',             type: 'date',    fmt: 'date',    frozen: true, width: 'min-w-28' },
  { key: 'end_date',                    label: 'End Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'billing_period',              label: 'Days',                   type: 'integer', fmt: 'integer', width: 'min-w-16', rightAlign: true },
  // Consumption
  { key: 'meter_reading_previous',      label: 'Meter Previous',         type: 'number',  fmt: 'volume',  width: 'min-w-28', rightAlign: true },
  { key: 'meter_reading_actual',        label: 'Meter Actual',           type: 'number',  fmt: 'volume',  width: 'min-w-24', rightAlign: true },
  { key: 'cf_to_m3_conversion',         label: 'CF→m³ Conv.',            type: 'number',  fmt: 'number',  width: 'min-w-24', rightAlign: true },
  { key: 'cd',                          label: 'CD (m³)',                type: 'text',    fmt: 'text',    width: 'min-w-28' },
  { key: 'gas_consumption',             label: 'Gas Consumption (m³)',   type: 'number',  fmt: 'volume',  width: 'min-w-36', rightAlign: true },
  { key: 'split_volumes',               label: 'Split Volumes (m³)',     type: 'text',    fmt: 'text',    width: 'min-w-28' },
  // Charges
  { key: 'customer_charge',             label: 'Customer Charge',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'cd_1',                        label: 'CD Charge 1',            type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'cd_2',                        label: 'CD Charge 2',            type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'delivery_to_you',             label: 'Delivery',               type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'load_balancing',              label: 'Load Balancing',         type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'transportation',              label: 'Transportation',          type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'federal_carbon_charge',       label: 'Fed. Carbon',            type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'gas_supply_charge_1',         label: 'Gas Supply 1',           type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'gas_supply_charge_2',         label: 'Gas Supply 2',           type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'cost_adjustment',             label: 'Cost Adjustment',        type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'previous_bill_charge',        label: 'Prev. Bill',             type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'enbridge_invoice_cost_excl_hst', label: 'Cost Excl. HST',      type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  // Totals
  { key: 'hst_amount',                  label: 'HST',                    type: 'number',  fmt: 'dollar',  width: 'min-w-20', rightAlign: true },
  { key: 'total_incl_hst',              label: 'Total Incl. HST',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  // Balance
  { key: 'balance_forward',             label: 'Balance Forward',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  // Calculated
  { key: 'cost_per_m3',                 label: '$/m³',                   type: 'number',  fmt: 'rate',    width: 'min-w-20', rightAlign: true, readOnly: true },
  // Audit
  { key: 'source_pdf_filename',         label: 'Source PDF',             type: 'text',    fmt: 'text',    width: 'min-w-32' },
  // Notes
  { key: 'notes',                       label: 'Notes',                  type: 'text',    fmt: 'text',    width: 'min-w-40' },
]

// ── Walgreen (28 cols) ────────────────────────────────────────
export const WALGREEN_COLS: ColDef[] = [
  // Invoice metadata
  { key: 'invoice_number',              label: 'Invoice # (Bill #)',     type: 'text',    fmt: 'text',    frozen: true, width: 'min-w-32' },
  { key: 'bill_date',                   label: 'Bill Date',              type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'due_date',                    label: 'Due Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  // Period
  { key: 'enbridge_qtr_reference',      label: 'Qtr Ref',                type: 'text',    fmt: 'text',    width: 'min-w-24' },
  { key: 'rate',                        label: 'Rate',                   type: 'integer', fmt: 'integer', width: 'min-w-16', rightAlign: true },
  { key: 'start_date',                  label: 'Start Date',             type: 'date',    fmt: 'date',    frozen: true, width: 'min-w-28' },
  { key: 'end_date',                    label: 'End Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'days',                        label: 'Days',                   type: 'integer', fmt: 'integer', width: 'min-w-16', rightAlign: true },
  // Consumption
  { key: 'cd_1',                        label: 'CD 1 (m³)',              type: 'number',  fmt: 'volume',  width: 'min-w-24', rightAlign: true },
  { key: 'cd_2',                        label: 'CD 2 (m³)',              type: 'number',  fmt: 'volume',  width: 'min-w-24', rightAlign: true },
  { key: 'gas_consumption_1',           label: 'Gas 1 (m³)',             type: 'number',  fmt: 'volume',  width: 'min-w-24', rightAlign: true },
  { key: 'gas_consumption_2',           label: 'Gas 2 (m³)',             type: 'number',  fmt: 'volume',  width: 'min-w-24', rightAlign: true },
  { key: 'total_gas_consumption',       label: 'Total Gas (m³)',         type: 'number',  fmt: 'volume',  width: 'min-w-28', rightAlign: true },
  // Charges
  { key: 'customer_monthly_charge',     label: 'Customer Monthly',       type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'demand_charge',               label: 'Demand Charge',          type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'demand_charge_2',             label: 'Demand Charge 2',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'delivery_charge',             label: 'Delivery',               type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'load_balancing_charge',       label: 'Load Balancing',         type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'transportation',              label: 'Transportation',          type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'gas_supply_commodity',        label: 'Gas Supply',             type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'gas_supply_commodity_2',      label: 'Gas Supply 2',           type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'cost_adjustment',             label: 'Cost Adjustment',        type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'enbridge_invoice_cost_excl_hst', label: 'Cost Excl. HST',      type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  // Totals
  { key: 'hst_amount',                  label: 'HST',                    type: 'number',  fmt: 'dollar',  width: 'min-w-20', rightAlign: true },
  { key: 'total_incl_hst',              label: 'Total Incl. HST',        type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  // Calculated
  { key: 'cost_per_m3',                 label: '$/m³',                   type: 'number',  fmt: 'rate',    width: 'min-w-20', rightAlign: true, readOnly: true },
  // Audit
  { key: 'source_pdf_filename',         label: 'Source PDF',             type: 'text',    fmt: 'text',    width: 'min-w-32' },
  // Notes
  { key: 'notes',                       label: 'Notes',                  type: 'text',    fmt: 'text',    width: 'min-w-40' },
]

// ── Elexicon (31 cols) ────────────────────────────────────────
// Distribution Charges group: indices 14–17 (new_account_setup … interest_overdue_charge)
// Other Charges group: indices 18–24 (sss_admin_charge … wholesale_market_services)
export const ELEXICON_COLS: ColDef[] = [
  // Invoice metadata
  { key: 'meter_number',                     label: 'Meter #',                type: 'text',    fmt: 'text',    frozen: true, width: 'min-w-28' },
  { key: 'bill_date',                        label: 'Bill Date',              type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'due_date',                         label: 'Due Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  // Period
  { key: 'bill_period',                      label: 'Bill Period',            type: 'text',    fmt: 'text',    width: 'min-w-24' },
  { key: 'read_period',                      label: 'Read Period',            type: 'text',    fmt: 'text',    frozen: true, width: 'min-w-40' },
  { key: 'start_date',                       label: 'Start Date',             type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'end_date',                         label: 'End Date',               type: 'date',    fmt: 'date',    width: 'min-w-28' },
  { key: 'account_number',                   label: 'Account',                type: 'text',    fmt: 'text',    width: 'min-w-28' },
  { key: 'service_type',                     label: 'Service Type',           type: 'text',    fmt: 'text',    width: 'min-w-24' },
  { key: 'days',                             label: 'Days',                   type: 'integer', fmt: 'integer', width: 'min-w-16', rightAlign: true },
  // Consumption
  { key: 'kwh_used',                         label: 'kWh Used',               type: 'number',  fmt: 'volume',  width: 'min-w-24', rightAlign: true },
  { key: 'monthly_demand_kw',                label: 'Monthly Demand (kW)',     type: 'number',  fmt: 'volume',  width: 'min-w-32', rightAlign: true },
  { key: 'electricity_rate',                 label: '$/kWh Rate',             type: 'number',  fmt: 'number',  width: 'min-w-24', rightAlign: true },
  { key: 'global_adjuster',                  label: 'Global Adjuster',        type: 'text',    fmt: 'text',    width: 'min-w-36' },
  // ← Distribution Charges group: startIndex=14, colSpan=4
  { key: 'new_account_setup',                label: 'New Acct Setup',         type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'delivery_charge',                  label: 'Delivery Charge',        type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'customer_charge',                  label: 'Customer Charge',        type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'interest_overdue_charge',          label: 'Interest Overdue',       type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  // ← Other Charges group: startIndex=18, colSpan=7
  { key: 'sss_admin_charge',                 label: 'SSS Admin',              type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'electricity_cost',                 label: 'Electricity Cost',       type: 'number',  fmt: 'dollar',  width: 'min-w-28', rightAlign: true },
  { key: 'global_adjustment',                label: 'Global Adjust.',         type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'global_adjustment_recovery',       label: 'GA Recovery',            type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'transmission_network',             label: 'Trans. Network',         type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'transmission_connection',          label: 'Trans. Connection',      type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'wholesale_market_services',        label: 'Wholesale Mkt',          type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  // Totals
  { key: 'hst',                              label: 'HST',                    type: 'number',  fmt: 'dollar',  width: 'min-w-20', rightAlign: true },
  { key: 'total_charge',                     label: 'Total Charge',           type: 'number',  fmt: 'dollar',  width: 'min-w-24', rightAlign: true },
  { key: 'total_charge_excl_hst_interest',   label: 'Total Excl. HST/Int.',   type: 'number',  fmt: 'dollar',  width: 'min-w-32', rightAlign: true, readOnly: true },
  // Calculated
  { key: 'cost_per_kwh',                     label: '$/kWh',                  type: 'number',  fmt: 'rate',    width: 'min-w-20', rightAlign: true, readOnly: true },
  // Audit
  { key: 'source_pdf_filename',              label: 'Source PDF',             type: 'text',    fmt: 'text',    width: 'min-w-32' },
  // Notes
  { key: 'notes',                            label: 'Notes',                  type: 'text',    fmt: 'text',    width: 'min-w-40' },
]

// Elexicon column groups (0-indexed)
export const ELEXICON_GROUPS: ColGroup[] = [
  { label: 'Distribution Charges', startIndex: 14, colSpan: 4 },
  { label: 'Other Charges',        startIndex: 18, colSpan: 7 },
]

export const SITE_COLS: Record<SiteId, ColDef[]> = {
  cambridge:           CAMBRIDGE_COLS,
  pickering_cng:       PICKERING_CNG_COLS,
  walgreen:            WALGREEN_COLS,
  pickering_elexicon:  ELEXICON_COLS,
}

export const SITE_GROUPS: Record<SiteId, ColGroup[]> = {
  cambridge:          [],
  pickering_cng:      [],
  walgreen:           [],
  pickering_elexicon: ELEXICON_GROUPS,
}

export const SITE_LABELS: Record<SiteId, string> = {
  cambridge:          'Cambridge Enbridge',
  pickering_cng:      'Pickering Enbridge',
  walgreen:           'Walgreen Enbridge',
  pickering_elexicon: 'Pickering Elexicon',
}

/**
 * Build the group-header row specification for a table.
 * Returns an array of { label, span, isGroup } that maps to <th> cells in the extra header row.
 * hasRowNum=true reserves one extra cell at the start for the row number column.
 */
export function buildGroupHeaderSpec(
  cols: ColDef[],
  groups: ColGroup[],
  hasRowNum: boolean,
): Array<{ label: string; span: number; isGroup: boolean }> {
  if (groups.length === 0) return []

  const spec: Array<{ label: string; span: number; isGroup: boolean }> = []
  if (hasRowNum) spec.push({ label: '', span: 1, isGroup: false })

  let i = 0
  while (i < cols.length) {
    const grp = groups.find((g) => g.startIndex === i)
    if (grp) {
      spec.push({ label: grp.label, span: grp.colSpan, isGroup: true })
      i += grp.colSpan
    } else {
      const nextGrpStart = groups.find((g) => g.startIndex > i)?.startIndex ?? cols.length
      const span = nextGrpStart - i
      spec.push({ label: '', span, isGroup: false })
      i = nextGrpStart
    }
  }

  return spec
}

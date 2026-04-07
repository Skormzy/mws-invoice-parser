import type { SiteId } from '../types'

export type ColType = 'text' | 'number' | 'date' | 'integer'

export interface ColDef {
  key: string
  label: string
  type: ColType
  readOnly?: boolean   // computed fields — shown but not editable
  width?: string       // optional tailwind min-w class
}

// ── Cambridge (16 cols) ────────────────────────────────────────────
export const CAMBRIDGE_COLS: ColDef[] = [
  { key: 'enbridge_qtr_reference',          label: 'Qtr Ref',             type: 'text',    width: 'min-w-28' },
  { key: 'start_date',                      label: 'Start Date',           type: 'date',    width: 'min-w-32' },
  { key: 'end_date',                        label: 'End Date',             type: 'date',    width: 'min-w-32' },
  { key: 'billing_period',                  label: 'Billing Period',       type: 'date',    width: 'min-w-32' },
  { key: 'cd',                              label: 'CD',                   type: 'number',  width: 'min-w-24' },
  { key: 'gas_consumption',                 label: 'Gas Consumption',      type: 'number',  width: 'min-w-28' },
  { key: 'split_volumes',                   label: 'Split Volumes',        type: 'text',    width: 'min-w-28' },
  { key: 'demand_charge',                   label: 'Demand Charge',        type: 'number',  width: 'min-w-28' },
  { key: 'delivery_charge',                 label: 'Delivery Charge',      type: 'number',  width: 'min-w-28' },
  { key: 'monthly_charge_interruptible',    label: 'Monthly (Interrupt.)', type: 'number',  width: 'min-w-32' },
  { key: 'gas_supply_commodity',            label: 'Gas Supply Commodity', type: 'number',  width: 'min-w-32' },
  { key: 'gas_supply_transportation',       label: 'Gas Supply Transport', type: 'number',  width: 'min-w-32' },
  { key: 'commodity_fuel_price_adjustment', label: 'Commodity Adjust.',    type: 'number',  width: 'min-w-28' },
  { key: 'miscellaneous_charges',           label: 'Miscellaneous',        type: 'number',  width: 'min-w-24' },
  { key: 'enbridge_invoice_cost_excl_hst',  label: 'Cost Excl. HST',       type: 'number',  width: 'min-w-28' },
  { key: 'cost_per_m3',                     label: '$/m³',                 type: 'number',  width: 'min-w-20', readOnly: true },
]

// ── Pickering CNG (23 cols) ────────────────────────────────────────
export const PICKERING_CNG_COLS: ColDef[] = [
  { key: 'enbridge_qtr_reference',     label: 'Qtr Ref',              type: 'text',    width: 'min-w-28' },
  { key: 'start_date',                 label: 'Start Date',            type: 'date',    width: 'min-w-32' },
  { key: 'end_date',                   label: 'End Date',              type: 'date',    width: 'min-w-32' },
  { key: 'billing_period',             label: 'Days',                  type: 'integer', width: 'min-w-16' },
  { key: 'meter_reading_previous',     label: 'Meter Previous',        type: 'number',  width: 'min-w-28' },
  { key: 'meter_reading_actual',       label: 'Meter Actual',          type: 'number',  width: 'min-w-24' },
  { key: 'cf_to_m3_conversion',        label: 'CF→m³ Conv.',           type: 'number',  width: 'min-w-24' },
  { key: 'cd',                         label: 'CD',                    type: 'text',    width: 'min-w-28' },
  { key: 'gas_consumption',            label: 'Gas Consumption',       type: 'number',  width: 'min-w-28' },
  { key: 'split_volumes',              label: 'Split Volumes',         type: 'text',    width: 'min-w-28' },
  { key: 'customer_charge',            label: 'Customer Charge',       type: 'number',  width: 'min-w-28' },
  { key: 'cd_1',                       label: 'CD Charge 1',           type: 'number',  width: 'min-w-24' },
  { key: 'cd_2',                       label: 'CD Charge 2',           type: 'number',  width: 'min-w-24' },
  { key: 'delivery_to_you',            label: 'Delivery',              type: 'number',  width: 'min-w-24' },
  { key: 'load_balancing',             label: 'Load Balancing',        type: 'number',  width: 'min-w-24' },
  { key: 'transportation',             label: 'Transportation',         type: 'number',  width: 'min-w-24' },
  { key: 'federal_carbon_charge',      label: 'Fed. Carbon',           type: 'number',  width: 'min-w-24' },
  { key: 'gas_supply_charge_1',        label: 'Gas Supply 1',          type: 'number',  width: 'min-w-24' },
  { key: 'gas_supply_charge_2',        label: 'Gas Supply 2',          type: 'number',  width: 'min-w-24' },
  { key: 'cost_adjustment',            label: 'Cost Adjustment',       type: 'number',  width: 'min-w-24' },
  { key: 'previous_bill_charge',       label: 'Prev. Bill',            type: 'number',  width: 'min-w-24' },
  { key: 'enbridge_invoice_cost_excl_hst', label: 'Cost Excl. HST',   type: 'number',  width: 'min-w-28' },
  { key: 'cost_per_m3',                label: '$/m³',                  type: 'number',  width: 'min-w-20', readOnly: true },
]

// ── Walgreen (21 cols) ─────────────────────────────────────────────
export const WALGREEN_COLS: ColDef[] = [
  { key: 'enbridge_qtr_reference',     label: 'Qtr Ref',              type: 'text',    width: 'min-w-32' },
  { key: 'rate',                        label: 'Rate',                  type: 'integer', width: 'min-w-16' },
  { key: 'start_date',                  label: 'Start Date',            type: 'date',    width: 'min-w-32' },
  { key: 'end_date',                    label: 'End Date',              type: 'date',    width: 'min-w-32' },
  { key: 'days',                        label: 'Days',                  type: 'integer', width: 'min-w-16' },
  { key: 'cd_1',                        label: 'CD 1',                  type: 'number',  width: 'min-w-24' },
  { key: 'cd_2',                        label: 'CD 2',                  type: 'number',  width: 'min-w-24' },
  { key: 'gas_consumption_1',           label: 'Gas 1',                 type: 'number',  width: 'min-w-24' },
  { key: 'gas_consumption_2',           label: 'Gas 2',                 type: 'number',  width: 'min-w-24' },
  { key: 'total_gas_consumption',       label: 'Total Gas',             type: 'number',  width: 'min-w-24' },
  { key: 'customer_monthly_charge',     label: 'Customer Monthly',      type: 'number',  width: 'min-w-28' },
  { key: 'demand_charge',               label: 'Demand Charge',         type: 'number',  width: 'min-w-28' },
  { key: 'demand_charge_2',             label: 'Demand Charge 2',       type: 'number',  width: 'min-w-28' },
  { key: 'delivery_charge',             label: 'Delivery',              type: 'number',  width: 'min-w-24' },
  { key: 'load_balancing_charge',       label: 'Load Balancing',        type: 'number',  width: 'min-w-24' },
  { key: 'transportation',              label: 'Transportation',         type: 'number',  width: 'min-w-24' },
  { key: 'gas_supply_commodity',        label: 'Gas Supply',            type: 'number',  width: 'min-w-24' },
  { key: 'gas_supply_commodity_2',      label: 'Gas Supply 2',          type: 'number',  width: 'min-w-24' },
  { key: 'cost_adjustment',             label: 'Cost Adjustment',       type: 'number',  width: 'min-w-24' },
  { key: 'enbridge_invoice_cost_excl_hst', label: 'Cost Excl. HST',    type: 'number',  width: 'min-w-28' },
  { key: 'cost_per_m3',                 label: '$/m³',                  type: 'number',  width: 'min-w-20', readOnly: true },
]

// ── Elexicon (24 cols) ─────────────────────────────────────────────
export const ELEXICON_COLS: ColDef[] = [
  { key: 'bill_period',                      label: 'Bill Period',         type: 'text',    width: 'min-w-24' },
  { key: 'read_period',                      label: 'Read Period',         type: 'text',    width: 'min-w-40' },
  { key: 'account_number',                   label: 'Account',             type: 'text',    width: 'min-w-28' },
  { key: 'service_type',                     label: 'Service Type',        type: 'text',    width: 'min-w-24' },
  { key: 'days',                             label: 'Days',                type: 'integer', width: 'min-w-16' },
  { key: 'kwh_used',                         label: 'kWh Used',            type: 'number',  width: 'min-w-24' },
  { key: 'monthly_demand_kw',                label: 'Demand (kW)',         type: 'number',  width: 'min-w-24' },
  { key: 'electricity_rate',                 label: '$/kWh Rate',          type: 'number',  width: 'min-w-24' },
  { key: 'global_adjuster',                  label: 'Global Adjuster',     type: 'text',    width: 'min-w-36' },
  { key: 'new_account_setup',                label: 'New Acct Setup',      type: 'number',  width: 'min-w-24' },
  { key: 'delivery_charge',                  label: 'Delivery',            type: 'number',  width: 'min-w-24' },
  { key: 'customer_charge',                  label: 'Customer Charge',     type: 'number',  width: 'min-w-24' },
  { key: 'interest_overdue_charge',          label: 'Interest Overdue',    type: 'number',  width: 'min-w-24' },
  { key: 'sss_admin_charge',                 label: 'SSS Admin',           type: 'number',  width: 'min-w-24' },
  { key: 'electricity_cost',                 label: 'Electricity Cost',    type: 'number',  width: 'min-w-28' },
  { key: 'global_adjustment',                label: 'Global Adjust.',      type: 'number',  width: 'min-w-24' },
  { key: 'global_adjustment_recovery',       label: 'GA Recovery',         type: 'number',  width: 'min-w-24' },
  { key: 'transmission_network',             label: 'Trans. Network',      type: 'number',  width: 'min-w-24' },
  { key: 'transmission_connection',          label: 'Trans. Connection',   type: 'number',  width: 'min-w-24' },
  { key: 'wholesale_market_services',        label: 'Wholesale Mkt',       type: 'number',  width: 'min-w-24' },
  { key: 'hst',                              label: 'HST',                 type: 'number',  width: 'min-w-20' },
  { key: 'total_charge',                     label: 'Total Charge',        type: 'number',  width: 'min-w-24' },
  { key: 'total_charge_excl_hst_interest',   label: 'Total Excl. HST/Int', type: 'number',  width: 'min-w-32', readOnly: true },
  { key: 'cost_per_kwh',                     label: '$/kWh',               type: 'number',  width: 'min-w-20', readOnly: true },
]

// ── Lookup ─────────────────────────────────────────────────────────
export const SITE_COLS: Record<SiteId, ColDef[]> = {
  cambridge: CAMBRIDGE_COLS,
  pickering_cng: PICKERING_CNG_COLS,
  walgreen: WALGREEN_COLS,
  pickering_elexicon: ELEXICON_COLS,
}

export const SITE_LABELS: Record<SiteId, string> = {
  cambridge: 'Cambridge Enbridge',
  pickering_cng: 'Pickering Enbridge',
  walgreen: 'Walgreen Enbridge',
  pickering_elexicon: 'Pickering Elexicon',
}

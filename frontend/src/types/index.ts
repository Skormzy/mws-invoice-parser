// ─────────────────────────────────────────────────────────────
// Invoice site identifiers
// ─────────────────────────────────────────────────────────────
export type SiteId =
  | 'cambridge'
  | 'pickering_cng'
  | 'walgreen'
  | 'pickering_elexicon'

// ─────────────────────────────────────────────────────────────
// Sites table
// ─────────────────────────────────────────────────────────────
export interface Site {
  id: SiteId
  display_name: string
  address: string | null
  account_number: string | null
  bill_number: string | null
  rate_description: string | null
  sage_notes: string | null
  updated_at: string
}

// ─────────────────────────────────────────────────────────────
// 3A. Cambridge CNG
// ─────────────────────────────────────────────────────────────
export interface CambridgeInvoice {
  id: string
  // Invoice metadata
  invoice_number: string | null
  bill_date: string | null
  due_date: string | null
  // Period
  enbridge_qtr_reference: string
  start_date: string | null
  end_date: string | null
  billing_period: string | null           // ISO date — first of billing month
  // Consumption
  cd: number | null
  gas_consumption: number | null
  split_volumes: string | null
  // Charges
  demand_charge: number | null
  delivery_charge: number | null
  monthly_charge_interruptible: number | null
  gas_supply_commodity: number | null
  gas_supply_transportation: number | null
  commodity_fuel_price_adjustment: number | null
  miscellaneous_charges: number | null
  enbridge_invoice_cost_excl_hst: number
  // Totals
  hst_amount: number | null
  total_incl_hst: number | null
  // Balance
  balance_forward: number | null
  late_payment_charge: number | null
  // Calculated
  cost_per_m3: number | null
  // Audit
  source_pdf_filename: string | null
  source_pdf_path: string | null
  notes: string | null
  created_at: string
}

export type CambridgeInvoiceInsert = Omit<CambridgeInvoice, 'id' | 'created_at'>

// ─────────────────────────────────────────────────────────────
// 3B. Pickering CNG
// ─────────────────────────────────────────────────────────────
export interface PickeringCngInvoice {
  id: string
  // Invoice metadata
  invoice_number: string | null
  bill_date: string | null
  due_date: string | null
  // Period
  enbridge_qtr_reference: string
  start_date: string
  end_date: string
  billing_period: number | null           // number of days
  // Consumption
  meter_reading_previous: number | null
  meter_reading_actual: number | null
  cf_to_m3_conversion: number | null
  cd: string | null
  gas_consumption: number
  split_volumes: string | null
  // Charges
  customer_charge: number | null
  cd_1: number | null
  cd_2: number | null
  delivery_to_you: number | null
  load_balancing: number | null
  transportation: number | null
  federal_carbon_charge: number | null
  gas_supply_charge_1: number | null
  gas_supply_charge_2: number | null
  cost_adjustment: number | null
  previous_bill_charge: number | null
  enbridge_invoice_cost_excl_hst: number
  // Totals
  hst_amount: number | null
  total_incl_hst: number | null
  // Balance
  balance_forward: number | null
  // Calculated
  cost_per_m3: number | null
  // Audit
  source_pdf_filename: string | null
  source_pdf_path: string | null
  notes: string | null
  created_at: string
}

export type PickeringCngInvoiceInsert = Omit<PickeringCngInvoice, 'id' | 'created_at'>

// ─────────────────────────────────────────────────────────────
// 3C. Walgreen CNG
// ─────────────────────────────────────────────────────────────
export type WalgreenRate = 110 | 145

export interface WalgreenInvoice {
  id: string
  // Invoice metadata
  invoice_number: string | null
  bill_date: string | null
  due_date: string | null
  // Period
  enbridge_qtr_reference: string
  rate: WalgreenRate
  start_date: string
  end_date: string
  days: number | null
  // Consumption
  cd_1: number | null
  cd_2: number | null
  gas_consumption_1: number | null
  gas_consumption_2: number | null
  total_gas_consumption: number | null
  // Charges
  customer_monthly_charge: number | null
  demand_charge: number | null
  demand_charge_2: number | null
  delivery_charge: number | null
  load_balancing_charge: number | null
  transportation: number | null
  gas_supply_commodity: number | null
  gas_supply_commodity_2: number | null
  cost_adjustment: number | null
  enbridge_invoice_cost_excl_hst: number
  // Totals (only on first Rate 110 row; null on others)
  hst_amount: number | null
  total_incl_hst: number | null
  // Calculated
  cost_per_m3: number | null
  // Audit
  source_pdf_filename: string | null
  source_pdf_path: string | null
  notes: string | null
  created_at: string
}

export type WalgreenInvoiceInsert = Omit<WalgreenInvoice, 'id' | 'created_at'>

export interface WalgreenInvoicePair {
  period_label: string
  rate_110: WalgreenInvoice | WalgreenInvoiceInsert
  rate_145: WalgreenInvoice | WalgreenInvoiceInsert
}

// ─────────────────────────────────────────────────────────────
// 3D. Pickering Elexicon
// ─────────────────────────────────────────────────────────────
export interface PickeringElexiconInvoice {
  id: string
  // Invoice metadata
  meter_number: string | null
  bill_date: string | null              // always null (not on Elexicon invoices)
  due_date: string | null               // always null
  // Period
  bill_period: string
  read_period: string
  start_date: string | null
  end_date: string | null
  account_number: string
  service_type: string
  days: number | null
  // Consumption
  kwh_used: number | null
  monthly_demand_kw: number | null
  electricity_rate: number | null
  global_adjuster: string | null
  // Distribution Charges
  new_account_setup: number | null
  delivery_charge: number | null
  customer_charge: number | null
  interest_overdue_charge: number | null
  // Other Charges
  sss_admin_charge: number | null
  electricity_cost: number | null
  global_adjustment: number | null
  global_adjustment_recovery: number | null
  transmission_network: number | null
  transmission_connection: number | null
  wholesale_market_services: number | null
  hst: number | null
  total_charge: number
  total_charge_excl_hst_interest: number | null
  // Calculated
  cost_per_kwh: number | null
  // Audit
  source_pdf_filename: string | null
  source_pdf_path: string | null
  notes: string | null
  created_at: string
}

export type PickeringElexiconInvoiceInsert = Omit<PickeringElexiconInvoice, 'id' | 'created_at'>

// ─────────────────────────────────────────────────────────────
// Union types for generic handling
// ─────────────────────────────────────────────────────────────
export type AnyInvoice =
  | CambridgeInvoice
  | PickeringCngInvoice
  | WalgreenInvoice
  | PickeringElexiconInvoice

export type AnyInvoiceInsert =
  | CambridgeInvoiceInsert
  | PickeringCngInvoiceInsert
  | WalgreenInvoiceInsert
  | PickeringElexiconInvoiceInsert

// ─────────────────────────────────────────────────────────────
// Parse API — request / response shapes
// ─────────────────────────────────────────────────────────────
export interface ParseRequest {
  invoice_type: SiteId
}

export type ValidationSeverity = 'warning' | 'error'

export interface ValidationWarning {
  field: string | null
  message: string
  severity: ValidationSeverity
  row_index?: number
}

export interface ParseResponse {
  invoice_type: SiteId
  rows: Record<string, unknown>[]
  warnings: ValidationWarning[]
  pdf_page_images: string[]
  storage_path?: string
}

// Duplicate check response
export type DupType = 'none' | 'exact' | 'fuzzy'
export interface DupCheckResponse {
  duplicate: DupType
  existing?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────
// Supabase Database type map (for createClient<Database>)
// ─────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site
        Insert: Omit<Site, 'updated_at'>
        Update: Partial<Omit<Site, 'id'>>
      }
      cambridge_invoices: {
        Row: CambridgeInvoice
        Insert: CambridgeInvoiceInsert
        Update: Partial<CambridgeInvoiceInsert>
      }
      pickering_cng_invoices: {
        Row: PickeringCngInvoice
        Insert: PickeringCngInvoiceInsert
        Update: Partial<PickeringCngInvoiceInsert>
      }
      walgreen_invoices: {
        Row: WalgreenInvoice
        Insert: WalgreenInvoiceInsert
        Update: Partial<WalgreenInvoiceInsert>
      }
      pickering_elexicon_invoices: {
        Row: PickeringElexiconInvoice
        Insert: PickeringElexiconInvoiceInsert
        Update: Partial<PickeringElexiconInvoiceInsert>
      }
    }
  }
}

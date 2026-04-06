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
// Tracker: "Cambridge CNG Invoice Tracking" — 16 data columns
// billing_period is a DATE (first of the billing month)
// ─────────────────────────────────────────────────────────────
export interface CambridgeInvoice {
  id: string
  enbridge_qtr_reference: string               // "Q1 2026"
  start_date: string                           // ISO date
  end_date: string                             // ISO date
  billing_period: string                       // ISO date — first of billing month
  cd: number | null                            // Contracted Demand m³
  gas_consumption: number | null               // m³; 0 for zero-consumption periods
  split_volumes: string | null
  demand_charge: number | null                 // Demand Charge - First 8,450 m³ of CD
  delivery_charge: number | null               // Delivery Charge - First 422,250 m³
  monthly_charge_interruptible: number | null  // Monthly Charge - Interruptible
  gas_supply_commodity: number | null          // Gas Supply - Commodity
  gas_supply_transportation: number | null     // Gas Supply - Transportation
  commodity_fuel_price_adjustment: number | null // Commodity & Fuel - Price Adjustment
  miscellaneous_charges: number | null
  enbridge_invoice_cost_excl_hst: number
  cost_per_m3: number | null                   // calculated; 0 when gas_consumption = 0
  source_pdf_filename: string | null
  created_at: string
}

export type CambridgeInvoiceInsert = Omit<CambridgeInvoice, 'id' | 'created_at'>

// ─────────────────────────────────────────────────────────────
// 3B. Pickering CNG
// Tracker: "Enbridge Invoice Comparison" — 23 data columns
// billing_period is an INTEGER (days), not a date
// cd is TEXT because split periods store "8,462 & 1,538 m3"
// ─────────────────────────────────────────────────────────────
export interface PickeringCngInvoice {
  id: string
  enbridge_qtr_reference: string               // "Q4 2025" or "Q3 & Q4 2024"
  start_date: string                           // ISO date
  end_date: string                             // ISO date
  billing_period: number | null                // number of days
  meter_reading_previous: number | null
  meter_reading_actual: number | null
  cf_to_m3_conversion: number | null
  cd: string | null                            // "10000" or "8,462 & 1,538 m3"
  gas_consumption: number
  split_volumes: string | null                 // "N/A" or "40772 & 11,417"
  customer_charge: number | null
  cd_1: number | null                          // Contract Demand Charge tier 1
  cd_2: number | null                          // tier 2; 0 when single-tier
  delivery_to_you: number | null
  load_balancing: number | null
  transportation: number | null
  federal_carbon_charge: number | null         // older invoices only
  gas_supply_charge_1: number | null
  gas_supply_charge_2: number | null           // 0 for non-split periods
  cost_adjustment: number | null
  previous_bill_charge: number | null          // older invoices only
  enbridge_invoice_cost_excl_hst: number
  cost_per_m3: number | null
  source_pdf_filename: string | null
  created_at: string
}

export type PickeringCngInvoiceInsert = Omit<PickeringCngInvoice, 'id' | 'created_at'>

// ─────────────────────────────────────────────────────────────
// 3C. Walgreen CNG
// Tracker: "Walgreen CNG Invoice Tracking" — 21 data columns
// CRITICAL: each billing period → 2 rows (rate 110 + rate 145)
// cost_per_m3 = 0 when total_gas_consumption = 0 (Rate 145 rows)
// ─────────────────────────────────────────────────────────────
export type WalgreenRate = 110 | 145

export interface WalgreenInvoice {
  id: string
  enbridge_qtr_reference: string               // "Q1 2026" or "Q4 2025 & Q1 2026"
  rate: WalgreenRate                           // 110 or 145
  start_date: string                           // ISO date
  end_date: string                             // ISO date
  days: number | null
  cd_1: number | null                          // Contracted Demand tier 1 m³
  cd_2: number | null                          // tier 2 for split periods; null otherwise
  gas_consumption_1: number | null             // m³ at rate segment 1
  gas_consumption_2: number | null             // m³ at rate segment 2; 0 for non-split
  total_gas_consumption: number | null
  customer_monthly_charge: number | null
  demand_charge: number | null                 // primary demand charge
  demand_charge_2: number | null               // secondary for split periods; 0 otherwise
  delivery_charge: number | null
  load_balancing_charge: number | null
  transportation: number | null
  gas_supply_commodity: number | null          // primary rate
  gas_supply_commodity_2: number | null        // secondary rate for split periods; 0 otherwise
  cost_adjustment: number | null
  enbridge_invoice_cost_excl_hst: number
  cost_per_m3: number | null                   // 0 when total_gas_consumption = 0
  source_pdf_filename: string | null
  created_at: string
}

export type WalgreenInvoiceInsert = Omit<WalgreenInvoice, 'id' | 'created_at'>

// Walgreen rows are always displayed in pairs; this groups them for the review UI
export interface WalgreenInvoicePair {
  period_label: string    // e.g. "Jan 8 – Feb 8, 2026"
  rate_110: WalgreenInvoice | WalgreenInvoiceInsert
  rate_145: WalgreenInvoice | WalgreenInvoiceInsert
}

// ─────────────────────────────────────────────────────────────
// 3D. Pickering Elexicon
// Tracker: "Past Elexicon Bill" — 24 data columns
// global_adjuster is free text e.g. "9,552.64kWh@$-0.00292"
// global_adjustment_recovery is a negative credit (nullable)
// ─────────────────────────────────────────────────────────────
export interface PickeringElexiconInvoice {
  id: string
  bill_period: string                          // "February"
  read_period: string                          // "Jan 31 - Feb 28, 2026"
  account_number: string                       // default "97066317-00"
  service_type: string                         // default "GS > 50 kW"
  days: number | null
  kwh_used: number | null
  monthly_demand_kw: number | null
  electricity_rate: number | null              // $/kWh
  global_adjuster: string | null              // free text from invoice
  new_account_setup: number | null             // first invoice only
  delivery_charge: number | null
  customer_charge: number | null
  interest_overdue_charge: number | null
  sss_admin_charge: number | null
  electricity_cost: number | null
  global_adjustment: number | null
  global_adjustment_recovery: number | null    // negative credit
  transmission_network: number | null
  transmission_connection: number | null
  wholesale_market_services: number | null
  hst: number | null
  total_charge: number
  total_charge_excl_hst_interest: number | null
  cost_per_kwh: number | null                  // calculated
  source_pdf_filename: string | null
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
  // PDF is sent as multipart/form-data
}

export type ValidationSeverity = 'warning' | 'error'

export interface ValidationWarning {
  field: string | null   // null = row-level warning
  message: string
  severity: ValidationSeverity
  row_index?: number     // for multi-row results (Walgreen)
}

export interface ParseResponse {
  invoice_type: SiteId
  rows: AnyInvoiceInsert[]
  warnings: ValidationWarning[]
  pdf_page_images: string[]  // base64 PNG data URIs, one per PDF page
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

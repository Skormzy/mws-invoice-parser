-- MWS Invoice Parser — Initial Schema
-- Mirrors Melissa's 4 Excel tracker structures exactly.
-- See docs/BUILD_SCOPE.md sections 3A–3D for column-level documentation.

-- ─────────────────────────────────────────────────────────────
-- SITES  (one row per invoice type / tracker)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sites (
  id                text PRIMARY KEY,  -- 'cambridge' | 'pickering_cng' | 'walgreen' | 'pickering_elexicon'
  display_name      text NOT NULL,
  address           text,
  account_number    text,
  bill_number       text,
  rate_description  text,
  sage_notes        text,
  updated_at        timestamptz DEFAULT now()
);

INSERT INTO sites (id, display_name, address, account_number, bill_number, rate_description, sage_notes) VALUES
  (
    'cambridge',
    'Cambridge Enbridge CNG',
    '2138 EAGLEST N, CAMBRIDGE ON N3H0A1',
    '1183991',
    'BA4297',
    E'Rate M4 Firm Industrial and Commercial (Contracted Demand= 30,500.0 m3)\nRate M5 Interruptible',
    'in Sage'
  ),
  (
    'pickering_cng',
    'Pickering Enbridge CNG',
    '1250 SQUIRES BEACH RD CNG STATION PICKERING ON L1L 1L1',
    '930610223601',
    '107000512616',
    'Rate 100',
    'bill number in sage (include private check box)'
  ),
  (
    'walgreen',
    'Walgreen Enbridge CNG',
    '145 WALGREEN ROAD, CARP, ON K0A 1L0',
    'TBD',
    'TBD',
    E'Rate 110 Firm - CD = 10,577 m3\nRate 145 Interruptible - CD = 10,577 m3',
    NULL
  ),
  (
    'pickering_elexicon',
    'Pickering Elexicon',
    '1220 B Squires Beach Rd, Pickering',
    '97066317-00',
    NULL,
    'GS > 50 kW',
    NULL
  );


-- ─────────────────────────────────────────────────────────────
-- 3A. CAMBRIDGE CNG
-- Tracker: "Cambridge CNG Invoice Tracking", headers at row 8, 16 columns
-- billing_period is the first-of-month date for the billing month
-- ─────────────────────────────────────────────────────────────
CREATE TABLE cambridge_invoices (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tracker columns (col order matches row 8 headers)
  enbridge_qtr_reference          text        NOT NULL,           -- "Q1 2026"
  start_date                      date        NOT NULL,
  end_date                        date        NOT NULL,
  billing_period                  date        NOT NULL,           -- first of billing month
  cd                              numeric(12,2),                  -- Contracted Demand m³
  gas_consumption                 numeric(12,4),                  -- m³; 0 for zero-consumption periods
  split_volumes                   text,                           -- null or e.g. "40772 & 11,417"
  demand_charge                   numeric(12,2),                  -- Demand Charge - First 8,450 m³ of CD
  delivery_charge                 numeric(12,2),                  -- Delivery Charge - First 422,250 m³
  monthly_charge_interruptible    numeric(12,2),                  -- Monthly Charge - Interruptible
  gas_supply_commodity            numeric(12,2),                  -- Gas Supply - Commodity
  gas_supply_transportation       numeric(12,2),                  -- Gas Supply - Transportation
  commodity_fuel_price_adjustment numeric(12,2),                  -- Commodity & Fuel - Price Adjustment
  miscellaneous_charges           numeric(12,2),                  -- nullable
  enbridge_invoice_cost_excl_hst  numeric(12,2) NOT NULL,
  cost_per_m3                     numeric(10,7),                  -- calculated; 0 when gas_consumption = 0

  -- Audit
  source_pdf_filename             text,
  created_at                      timestamptz DEFAULT now(),

  CONSTRAINT cambridge_invoices_period_unique UNIQUE (start_date, end_date)
);


-- ─────────────────────────────────────────────────────────────
-- 3B. PICKERING CNG
-- Tracker: "Enbridge Invoice Comparison", headers at row 8, 23 columns
-- billing_period is an INTEGER (number of days), not a date — matches tracker exactly
-- cd is TEXT because split periods store e.g. "8,462 & 1,538 m3"
-- ─────────────────────────────────────────────────────────────
CREATE TABLE pickering_cng_invoices (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  enbridge_qtr_reference          text        NOT NULL,           -- "Q4 2025" or "Q3 & Q4 2024"
  start_date                      date        NOT NULL,
  end_date                        date        NOT NULL,
  billing_period                  integer,                        -- number of days in period
  meter_reading_previous          numeric(12,4),
  meter_reading_actual            numeric(12,4),
  cf_to_m3_conversion             numeric(14,10),
  cd                              text,                           -- "10000" or "8,462 & 1,538 m3"
  gas_consumption                 numeric(12,2) NOT NULL,
  split_volumes                   text,                           -- "N/A" or "40772 & 11,417"
  customer_charge                 numeric(12,2),
  cd_1                            numeric(12,2),                  -- Contract Demand Charge tier 1
  cd_2                            numeric(12,2),                  -- tier 2; 0 when single-tier
  delivery_to_you                 numeric(12,2),
  load_balancing                  numeric(12,2),
  transportation                  numeric(12,2),
  federal_carbon_charge           numeric(12,2),                  -- nullable; older invoices only
  gas_supply_charge_1             numeric(12,2),
  gas_supply_charge_2             numeric(12,2),                  -- 0 for non-split periods
  cost_adjustment                 numeric(12,2),
  previous_bill_charge            numeric(12,2),                  -- nullable; older invoices only
  enbridge_invoice_cost_excl_hst  numeric(12,2) NOT NULL,
  cost_per_m3                     numeric(10,7),

  source_pdf_filename             text,
  created_at                      timestamptz DEFAULT now(),

  CONSTRAINT pickering_cng_invoices_period_unique UNIQUE (start_date, end_date)
);


-- ─────────────────────────────────────────────────────────────
-- 3C. WALGREEN CNG
-- Tracker: "Walgreen CNG Invoice Tracking", headers at row 8, 21 columns
-- CRITICAL: each billing period produces 2 rows — rate 110 AND rate 145
-- Uniqueness requires (start_date, end_date, rate)
-- cost_per_m3 = 0 when total_gas_consumption = 0 (Rate 145 rows typically)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE walgreen_invoices (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  enbridge_qtr_reference          text        NOT NULL,           -- "Q1 2026" or "Q4 2025 & Q1 2026"
  rate                            smallint    NOT NULL,           -- 110 or 145
  start_date                      date        NOT NULL,
  end_date                        date        NOT NULL,
  days                            integer,
  cd_1                            numeric(12,2),                  -- Contracted Demand tier 1 m³
  cd_2                            numeric(12,2),                  -- tier 2 for split periods; null otherwise
  gas_consumption_1               numeric(12,4),                  -- m³ at rate segment 1
  gas_consumption_2               numeric(12,4),                  -- m³ at rate segment 2; 0 for non-split
  total_gas_consumption           numeric(12,4),
  customer_monthly_charge         numeric(12,2),
  demand_charge                   numeric(12,2),                  -- primary demand charge
  demand_charge_2                 numeric(12,2),                  -- secondary for split periods; 0 otherwise
  delivery_charge                 numeric(12,2),
  load_balancing_charge           numeric(12,2),
  transportation                  numeric(12,2),
  gas_supply_commodity            numeric(12,2),                  -- primary rate
  gas_supply_commodity_2          numeric(12,2),                  -- secondary rate for split periods; 0 otherwise
  cost_adjustment                 numeric(12,2),
  enbridge_invoice_cost_excl_hst  numeric(12,2) NOT NULL,
  cost_per_m3                     numeric(10,7),                  -- 0 when total_gas_consumption = 0

  source_pdf_filename             text,
  created_at                      timestamptz DEFAULT now(),

  CONSTRAINT walgreen_invoices_period_rate_unique UNIQUE (start_date, end_date, rate),
  CONSTRAINT walgreen_invoices_rate_check CHECK (rate IN (110, 145))
);


-- ─────────────────────────────────────────────────────────────
-- 3D. PICKERING ELEXICON
-- Tracker: "Past Elexicon Bill", headers at row 2, 24 columns
-- global_adjuster is free text e.g. "9,552.64kWh@$-0.00292"
-- global_adjustment_recovery is a negative credit (nullable)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE pickering_elexicon_invoices (
  id                                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  bill_period                           text        NOT NULL,           -- "February"
  read_period                           text        NOT NULL,           -- "Jan 31 - Feb 28, 2026"
  account_number                        text        NOT NULL DEFAULT '97066317-00',
  service_type                          text        NOT NULL DEFAULT 'GS > 50 kW',
  days                                  integer,
  kwh_used                              numeric(12,4),
  monthly_demand_kw                     numeric(10,4),
  electricity_rate                      numeric(10,6),                  -- $/kWh e.g. 0.123796
  global_adjuster                       text,                           -- free text string from invoice
  new_account_setup                     numeric(12,2),                  -- nullable; first invoice only
  delivery_charge                       numeric(12,2),
  customer_charge                       numeric(12,2),
  interest_overdue_charge               numeric(12,2),                  -- nullable
  sss_admin_charge                      numeric(12,2),
  electricity_cost                      numeric(12,2),
  global_adjustment                     numeric(12,2),
  global_adjustment_recovery            numeric(12,2),                  -- nullable; negative credit
  transmission_network                  numeric(12,2),
  transmission_connection               numeric(12,2),
  wholesale_market_services             numeric(12,2),
  hst                                   numeric(12,2),
  total_charge                          numeric(12,2)       NOT NULL,
  total_charge_excl_hst_interest        numeric(12,2),
  cost_per_kwh                          numeric(10,7),                  -- calculated

  source_pdf_filename                   text,
  created_at                            timestamptz DEFAULT now(),

  CONSTRAINT pickering_elexicon_invoices_period_unique UNIQUE (bill_period, read_period)
);

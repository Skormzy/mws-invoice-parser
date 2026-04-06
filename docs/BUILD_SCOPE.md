# Build Scope: MWS CNG & Electricity Invoice Parser
**For:** Claude Code  
**Owner:** Seymour Korman, VP Finance, Miller Waste Systems  
**End User:** Melissa Woo, FP&A Analyst (melissa.woo@millerwaste.ca, ext. 5432)  
**Date:** April 6, 2026

---

## 1. Purpose

Build a web application that allows the FP&A team to upload PDF invoices from Enbridge (natural gas) and Elexicon (electricity), automatically extract the relevant data fields, and populate a persistent database matching Melissa's existing Excel tracker structure. The app replaces a fully manual process where Melissa receives scanned or digital PDFs, manually reads them, and types values into spreadsheets.

There are **4 invoice types** from **2 vendors** across **3 CNG stations and 1 electricity account**. Each has a different PDF format and a different tracker schema.

---

## 2. The Four Invoice Types

### 2A. Cambridge Enbridge (CNG Gas)
- **Vendor:** Enbridge Gas Inc.
- **Site:** 2138 Eagle St N, Cambridge ON N3H 0A1
- **Account Number:** 1183991
- **Billing Account:** BA4297
- **Contract:** SA036903
- **Rate:** Rate M4 Firm Industrial and Commercial (Contracted Demand = 30,500.0 m³) + Rate M5 Interruptible
- **PDF Format:** Digital PDF (text-extractable), produced by "EngageOne Generate 6.6.11.4072"
- **Pages:** Typically 3 pages:
  - Page 1: Charge summary (single page with all line items, balance forward, HST, total payment due)
  - Page 2: Dispersal Report (daily M4 Firm consumption by day of month)
  - Page 3: Daily Meter Consumption (uncorrected CCF, corrected m³, peak data, daily chart)
- **Key structural feature:** This is a **GS (General Service) commercial format** — NOT the consumer-facing "LBA" format. Charges appear as a simple table with Quantity, UOM, Rate, Charge columns on page 1.
- **Charge line items on page 1:**
  - Demand Charge - First 8,450 m³ of CD
  - Delivery Charge - First 422,250 m³
  - Monthly Charge - Interruptible
  - Gas Supply - Commodity
  - Gas Supply - Transportation
  - Gas Supply - Commodity & Fuel - Price Adjustment
  - Current Month Charges Subtotal
  - HST
  - Balance Forward, Late Payment Charge, Total Payment Now Due

### 2B. Pickering Enbridge (CNG Gas)
- **Vendor:** Enbridge Gas Inc.
- **Site:** 1250 Squires Beach Rd CNG Station, Pickering ON L1L 1L1
- **Account Number:** 930610223601 (also used as bill number in Sage, with "private" checkbox)
- **Bill Number:** varies per invoice (e.g., 546002577557)
- **Rate:** Rate 100
- **PDF Format:** Digital PDF (text-extractable), produced by "Kubra Data Transfer" / PDFlib
- **Pages:** 2 pages:
  - Page 1: Consumer-facing summary with "WHAT DO I OWE?" bubble (total amount, due date), "HOW MUCH GAS DID I USE?" section (meter readings, total m³, total cost)
  - Page 2: "WHAT AM I PAYING FOR?" (balance forward, payments, charges) + "CHARGES FOR NATURAL GAS" detailed breakdown + "NATURAL GAS SUPPLY" rate box
- **Key structural feature:** Consumer/LBA format. The detailed charge breakdown is on page 2 under "CHARGES FOR NATURAL GAS" with the rate and billing period.
- **Charge line items (page 2):**
  - Customer Charge
  - Contract Demand Charge (may have 1 or 2 CD tiers, e.g., "8,000 m³" and "2,000 m³")
  - Delivery to You
  - Load Balancing Charge
  - Transportation to Enbridge
  - Gas Supply Charge (with volume and rate shown, e.g., "71,896 m³ @ 12.3008¢/m³")
  - Cost Adjustment
  - Charges for Natural Gas subtotal
  - HST
  - Total Charges for Natural Gas
- **CRITICAL EDGE CASE — Split billing periods:** When a billing period crosses a quarter boundary, rates change mid-period. The invoice shows two separate CD values (e.g., "8,462 & 1,538 m³"), two separate gas supply charges, and split volumes. The tracker captures these splits in the "Split Volumes" and dual "CD" columns. The parser MUST detect split-period invoices and extract both rate segments.
- **Rate box (top right of page 2):** Shows "RATE 100", gas supply rate, gas cost adjustment with effective dates, and total effective rate. This is useful for validation.

### 2C. Walgreen Enbridge (CNG Gas)
- **Vendor:** Enbridge Gas Inc.
- **Site:** 145 Walgreen Rd, Carp ON K0A 1L0 (Ottawa West)
- **Account Number:** 930610254051
- **Bill Number:** varies (e.g., 107000590155)
- **Rate:** Rate 110 Firm (CD = 10,577 m³) AND Rate 145 Interruptible (CD = 10,577 m³) — dual rate, both appear on every invoice
- **PDF Format:** ⚠️ SCANNED PDF (no extractable text). Produced by TOSHIBA e-STUDIO3525AC scanner. OCR is REQUIRED.
- **Pages:** 5 pages (for a multi-period invoice):
  - Page 1: Consumer/LBA format summary (same layout as Pickering: "WHAT DO I OWE?" + "HOW MUCH GAS DID I USE?")
  - Page 2: "WHAT AM I PAYING FOR?" + first billing period charges (Rate 110 section, then Rate 145 section)
  - Pages 3-5: Additional billing periods, each with separate Rate 110 and Rate 145 sections
- **Key structural feature:** This is a **multi-period invoice** covering several months. Each billing period has TWO rate sections (Rate 110 and Rate 145). The Rate 145 Interruptible section typically shows 0 m³ consumption but still has Customer Charge and Contract Demand Charge.
- **Charge line items per Rate 110 section:**
  - Customer Charge
  - Contract Demand Charge (CD = 10,577 m³; may split across quarters with two CD values)
  - Delivery to You
  - Load Balancing Charge
  - Transportation to Enbridge
  - Gas Supply Charge (with volume and rate)
  - Gas Supply Charge #2 (when split across quarters, second rate applies)
  - Cost Adjustment
  - Section subtotal
- **Charge line items per Rate 145 section:**
  - Customer Charge
  - Contract Demand Charge
  - Section subtotal
- **CRITICAL:** Because this invoice is scanned, OCR accuracy will vary. The app should display the extracted values alongside the original PDF page image so Melissa can visually verify. Consider using Claude API vision for extraction rather than traditional OCR, given the structured but scanned nature.

### 2D. Pickering Elexicon (Electricity)
- **Vendor:** Elexicon Energy (elexiconenergy.com)
- **Site:** 1220 B Squires Beach Rd, Pickering (CNG station electricity)
- **Account Number:** 97066317-00
- **Service Type:** GS > 50 kW
- **PDF Format:** Digital PDF (text-extractable), produced by "Idoxs Development Team" / PDFlib
- **Pages:** 2 pages:
  - Page 1: Bill summary with Distribution Charges section and Other Charges section
  - Page 2: Electricity Consumption table (meter number, billing period, days, kWh, demand data) + Explanation of terms
- **Charge line items (page 1):**
  - **Distribution Charges:**
    - Delivery Charge (rate shown as $/kW)
    - Customer Charge
  - **Other Charges:**
    - SSS Admin Charge
    - Electricity (rate shown as $/kWh)
    - Global Adjustment (volume @ rate)
    - Disposition of Global Adjustment (or "Global Adjustment Recovery" in some periods)
    - Transmission Network Charge (rate shown as $/kW)
    - Transmission Connection (rate shown as $/kW)
    - Wholesale Market Services
    - HST
    - Total
- **Consumption data (page 2):**
  - Meter Number
  - Billing Period
  - Days
  - kWh Used
  - For Month: Demand (kW) and Power Factor
  - 7AM-7PM Weekdays: Demand (kW) and Power Factor

---

## 3. Target Database Schema (Matches Melissa's Excel Trackers)

Each invoice type has its own table/schema. The app must store extracted data in a structure that exactly mirrors what Melissa currently tracks.

### 3A. Cambridge CNG Tracker Schema

| Column | Data Type | Description | Example |
|---|---|---|---|
| enbridge_qtr_reference | string | Enbridge quarterly rate reference | "Q1 2026" |
| start_date | date | Billing period start | 2026-01-03 |
| end_date | date | Billing period end | 2026-02-02 |
| billing_period | date | Month of billing (first of month) | 2026-01-01 |
| cd | number | Contracted Demand (m³) | 8000 |
| gas_consumption | number | Total gas consumed (m³) | 7268.8 |
| split_volumes | string/null | Split volume notation if applicable | null |
| demand_charge | number ($) | Demand Charge - First 8,450 m³ of CD | 6396.42 |
| delivery_charge | number ($) | Delivery Charge - First 422,250 m³ | 169.37 |
| monthly_charge_interruptible | number ($) | Monthly Charge - Interruptible | 837.79 |
| gas_supply_commodity | number ($) | Gas Supply - Commodity | 1483.10 |
| gas_supply_transportation | number ($) | Gas Supply - Transportation | 0.00 |
| commodity_fuel_price_adjustment | number ($) | Commodity & Fuel - Price Adjustment | -85.07 |
| miscellaneous_charges | number ($)/null | Miscellaneous Charges | null |
| enbridge_invoice_cost_excl_hst | number ($) | Total invoice cost excluding HST | 8801.61 |
| cost_per_m3 | number ($/m³) | Calculated: enbridge_invoice_cost_excl_hst / gas_consumption | 1.2109 |

**Header metadata (stored once per site, updateable):**
- Site address: "2138 EAGLEST N, CAMBRIDGE ON N3H0A1"
- Account Number: 1183991
- Bill Number: BA4297 (in Sage)
- Rate description: "Rate M4 Firm Industrial and Commercial (Contracted Demand = 30,500.0 m³) + Rate M5 Interruptible"

### 3B. Pickering CNG Tracker Schema

| Column | Data Type | Description | Example |
|---|---|---|---|
| enbridge_qtr_reference | string | Enbridge quarterly rate reference | "Q4 2025" |
| start_date | date | Billing period start | 2025-10-08 |
| end_date | date | Billing period end | 2025-11-06 |
| billing_period | number | Number of days in billing period | 29 |
| meter_reading_previous | number/null | Previous meter reading | 172694 |
| meter_reading_actual | number/null | Actual meter reading | 198074 |
| cf_to_m3_conversion | number/null | Conversion factor | 0.02833 |
| cd | string | Contracted Demand — string because it can be split (e.g., "8,000 & 2,000") | "8000 & 2000" |
| gas_consumption | number | Total gas consumed (m³) | 71896 |
| split_volumes | string/null | Split volume notation when crossing quarters | "N/A" or "40772 & 11,417" |
| customer_charge | number ($) | Customer Charge | 143.08 |
| cd_1 | number ($) | Contract Demand Charge tier 1 | 3396.61 |
| cd_2 | number ($) | Contract Demand Charge tier 2 (0 if single tier) | 849.15 |
| delivery_to_you | number ($) | Delivery to You | 584.01 |
| load_balancing | number ($) | Load Balancing Charge | 1332.23 |
| transportation | number ($) | Transportation to Enbridge | 3774.11 |
| federal_carbon_charge | number ($)/null | Federal Carbon Charge (older invoices only) | null |
| gas_supply_charge_1 | number ($) | Gas Supply Charge (primary rate) | 8843.78 |
| gas_supply_charge_2 | number ($) | Gas Supply Charge (secondary rate, split periods only) | 0 |
| cost_adjustment | number ($) | Cost Adjustment | -1599.55 |
| previous_bill_charge | number ($)/null | Previous Bill Charge (appears in older invoices) | 0 |
| enbridge_invoice_cost_excl_hst | number ($) | Total excluding HST | 17323.42 |
| cost_per_m3 | number ($/m³) | Calculated | 0.2410 |

**Header metadata:**
- Site address: "1250 SQUIRES BEACH RD CNG STATION PICKERING ON L1L 1L1"
- Account Number: 930610223601 (bill number in Sage, include "private" checkbox note)
- Bill Number: 107000512616
- Rate: Rate 100

### 3C. Walgreen CNG Tracker Schema

| Column | Data Type | Description | Example |
|---|---|---|---|
| enbridge_qtr_reference | string | Enbridge quarterly rate reference | "Q1 2026" |
| rate | number | Rate code (110 or 145) | 110 |
| start_date | date | Billing period start | 2026-01-08 |
| end_date | date | Billing period end | 2026-02-08 |
| days | number | Number of days in billing period | 31 |
| cd_1 | number | Contracted Demand tier 1 (m³) | 10577 |
| cd_2 | number/null | Contracted Demand tier 2 (split periods only) | null |
| gas_consumption_1 | number | Gas consumption at rate 1 (m³) | 39756 |
| gas_consumption_2 | number | Gas consumption at rate 2 (split periods only) | 0 |
| total_gas_consumption | number | Total gas consumed (m³) | 39756 |
| customer_monthly_charge | number ($) | Customer Monthly Charge | 712.33 |
| demand_charge | number ($) | Demand Charge (primary) | 3129.36 |
| demand_charge_2 | number ($) | Demand Charge (secondary, split periods) | 0 |
| delivery_charge | number ($) | Delivery Charge | 432.14 |
| load_balancing_charge | number ($) | Load Balancing Charge | 188.52 |
| transportation | number ($) | Transportation | 2254.80 |
| gas_supply_commodity | number ($) | Gas Supply - Commodity (primary rate) | 5453.69 |
| gas_supply_commodity_2 | number ($) | Gas Supply - Commodity (secondary rate, split periods) | 0 |
| cost_adjustment | number ($) | Cost Adjustment | -789.96 |
| enbridge_invoice_cost_excl_hst | number ($) | Total excluding HST | 11380.88 |
| cost_per_m3 | number ($/m³) | Calculated: cost / total_gas_consumption | 0.2863 |

**CRITICAL:** Each billing period on a Walgreen invoice produces TWO rows in the tracker: one for Rate 110 and one for Rate 145. The Rate 145 rows typically have 0 consumption but nonzero Customer Charge and Demand Charge.

**Header metadata:**
- Site address: "145 WALGREEN ROAD, CARP, ON K0A 1L0"
- Account Number: TBD (new site)
- Bill Number: TBD
- Rate: "Rate 110 Firm (CD = 10,577 m³) + Rate 145 Interruptible (CD = 10,577 m³)"

### 3D. Pickering Elexicon Tracker Schema

| Column | Data Type | Description | Example |
|---|---|---|---|
| bill_period | string | Month name | "February" |
| read_period | string | Meter read date range | "Jan 31 - Feb 28, 2026" |
| account_number | string | Account number | "97066317-00" |
| service_type | string | Service type | "GS > 50 kW" |
| days | number | Days in billing period | 28 |
| kwh_used | number | Total kWh consumed | 28193.70 |
| monthly_demand_kw | number | Monthly demand in kW | 253.00 |
| electricity_rate | number ($/kWh) | Electricity rate | 0.123796 |
| global_adjuster | string | Global Adjustment description (volume@rate) | "9,552.64kWh@$-0.00292" |
| new_account_setup | number ($)/null | New Account Setup fee (only first invoice) | null |
| delivery_charge | number ($) | Distribution: Delivery Charge | 1363.70 |
| customer_charge | number ($) | Distribution: Customer Charge | 138.41 |
| interest_overdue_charge | number ($)/null | Interest on Overdue Amount | null |
| sss_admin_charge | number ($) | SSS Admin Charge | 0.22 |
| electricity_cost | number ($) | Electricity charge | 3658.50 |
| global_adjustment | number ($) | Global Adjustment amount | 279.12 |
| global_adjustment_recovery | number ($)/null | Global Adjustment Recovery (negative credit) | -86.30 |
| transmission_network | number ($) | Transmission Network Charge | 740.31 |
| transmission_connection | number ($) | Transmission Connection | 879.05 |
| wholesale_market_services | number ($) | Wholesale Market Services | 156.64 |
| hst | number ($) | HST | 926.86 |
| total_charge | number ($) | Total Charge (including HST and interest) | 8056.51 |
| total_charge_excl_hst_interest | number ($) | Total Charge excluding HST and overdue interest | 7129.65 |
| cost_per_kwh | number ($/kWh) | Calculated: total_excl_hst_interest / kwh_used | 0.2529 |

**Header metadata:**
- Account Number: 97066317-00
- Service Type: GS > 50 kW
- Site: 1220 B Squires Beach Rd, Pickering

---

## 4. Application Requirements

### 4.1 Core Workflow

1. User selects the invoice type (Cambridge Enbridge / Pickering Enbridge / Walgreen Enbridge / Pickering Elexicon)
2. User uploads one or more PDF files
3. App extracts data using the appropriate parser for that invoice type
4. Extracted data is displayed in an editable table matching the tracker schema
5. User reviews, corrects any OCR/extraction errors, and confirms
6. Confirmed data is saved to the persistent database
7. User can view, filter, and export the full history for any site

### 4.2 Extraction Approach

- **Cambridge Enbridge:** Text extraction (pdfplumber or similar). Parse the charge table on page 1. Extract total consumption from the "Total Consumption = X m³" line. Extract billing period from header.
- **Pickering Enbridge:** Text extraction. Parse the "CHARGES FOR NATURAL GAS" section on page 2. Extract meter readings and consumption from page 1. Handle split billing periods (detect dual CD values and dual gas supply charges).
- **Walgreen Enbridge:** **OCR required** (this is a scanned PDF). Recommended approach: use Claude API with vision to extract structured data from each page image. Alternative: Tesseract OCR + parsing. Each invoice contains multiple billing periods and each billing period has two rate sections (110 and 145). Show the original scanned page image alongside extracted data for visual verification.
- **Pickering Elexicon:** Text extraction. Parse the charge sections from page 1 (Distribution Charges and Other Charges). Extract consumption data from the table on page 2.

### 4.3 Multi-Period Invoice Handling

Walgreen invoices (and occasionally Pickering Enbridge) can contain charges for multiple billing periods in a single PDF. The parser must:
- Detect all billing period sections within the document
- Extract data for each period separately
- Create one database row per billing period per rate (Walgreen: 2 rows per period — Rate 110 + Rate 145)

### 4.4 Calculated Fields

- **cost_per_m3** (Enbridge): `enbridge_invoice_cost_excl_hst / gas_consumption` (handle division by zero when consumption is 0)
- **cost_per_kwh** (Elexicon): `total_charge_excl_hst_interest / kwh_used`

### 4.5 Validation Rules

- Gas consumption should be > 0 for active billing periods (flag but don't block if 0)
- All dollar amounts should be numeric (strip $ and comma formatting)
- Dates should be valid and in chronological order
- cost_per_m3 / cost_per_kwh should fall within reasonable ranges (flag outliers):
  - Enbridge CNG: typically $0.20 - $2.00 per m³
  - Elexicon: typically $0.15 - $0.90 per kWh
- HST should be approximately 13% of pre-tax total (flag if off by more than 1%)
- Duplicate detection: warn if an entry for the same site + billing period + rate already exists

### 4.6 Export

- Export to Excel (.xlsx) in the exact format matching Melissa's existing trackers (including header rows with site info, account numbers, and rate descriptions)
- Export all sites combined or individual site
- CSV export option

### 4.7 UI Requirements

- Clean, simple interface. This is for a non-technical FP&A analyst.
- Drag-and-drop PDF upload
- Side-by-side view: original PDF page on the left, extracted data table on the right (especially important for Walgreen scanned invoices)
- Editable cells in the extraction preview so Melissa can correct any parsing errors before saving
- Dashboard view showing all tracked invoices across all 4 sites, sortable by date
- Highlight any cells that failed validation in yellow

### 4.8 Technology Stack

- React frontend (single page app)
- Supabase backend (database + auth) — user has Supabase MCP connected
- PDF parsing: pdfplumber/PyMuPDF for text-extractable PDFs
- For Walgreen scanned PDFs: Claude API with vision (send page images, ask for structured extraction matching the schema)
- Deployed as a web app accessible to the FP&A team

---

## 5. Sample Files Included

All files are in the `scope_package/` directory:

### Sample Invoices (`sample_invoices/`)
| File | Type | Text-Extractable? | Pages |
|---|---|---|---|
| Cambridge Enbridge Invoice - Feb26.pdf | Cambridge CNG | Yes | 3 |
| Pickering Enbridge Invoice - Feb26.pdf | Pickering CNG | Yes | 2 |
| Walgreen Enbridge Invoice.pdf | Walgreen CNG | **No (scanned)** | 5 (multi-period) |
| Pickering Elexicon Invoice - Feb26.pdf | Pickering Electricity | Yes | 2 |

### Sample Trackers (`sample_trackers/`)
| File | Type | Sheet Name | Data Rows |
|---|---|---|---|
| Cambridge CNG Invoice Tracker.xlsx | Cambridge CNG | "Cambridge CNG Invoice Tracking" | 6 populated (rows 9-14) |
| Pickering CNG Invoice Tracker.xlsx | Pickering CNG | "Enbridge Invoice Comparison" | ~17 populated (rows 9-25) |
| Walgreen CNG Invoice Tracker.xlsx | Walgreen CNG | "Walgreen CNG Invoice Tracking" | 8 populated (rows 9-16, paired Rate 110/145) |
| Pickering Elexicon Invoice Tracker.xlsx | Pickering Electricity | "Past Elexicon Bill" | 20 populated (rows 3-22) |

These trackers ARE the ground truth for the database schema. Each column in the tracker becomes a column in the database. The header rows (rows 1-7 in Enbridge trackers, rows 1-2 in Elexicon) contain site metadata.

---

## 6. Edge Cases and Known Issues

1. **Walgreen is scanned.** Zero extractable text. OCR or vision-based extraction required. This is the hardest of the four parsers.

2. **Split billing periods crossing quarter boundaries.** Enbridge changes rates quarterly. When a billing period spans two quarters, charges are split at the rate change date. This produces dual CD values, dual gas supply charges, and split volumes in a single billing period entry. See Pickering tracker rows 9, 12, 18, 21, 24, 25 for examples.

3. **Walgreen dual-rate structure.** Every billing period produces TWO tracker rows: Rate 110 (with consumption) and Rate 145 (typically 0 consumption, but still has demand and customer charges). The parser must NOT skip the Rate 145 sections just because consumption is 0.

4. **Cambridge has no meter readings in the tracker.** Unlike Pickering, the Cambridge tracker does not capture meter readings — only consumption, charges, and the demand/delivery breakdown.

5. **Elexicon "Global Adjuster" column is a text field.** It contains a string like "9,552.64kWh@$-0.00292" — the full description from the invoice, not just a number.

6. **Zero-consumption periods.** Cambridge rows 9, 11 show 0 gas consumption with charges still present (demand and interruptible charges apply regardless of usage). The cost_per_m3 should be 0, not an error.

7. **Previous Bill Charge column.** Pickering tracker has a "Previous Bill Charge" column that appears in older invoices (mid-2024) but not in recent ones. The parser should extract it when present and leave null when absent.

8. **Federal Carbon Charge.** Appears in Pickering's older invoices (2024) but not in recent Rate 100 invoices. Handle gracefully.

9. **Enbridge rate reference labeling.** When a billing period crosses two quarters, the tracker uses compound labels like "Q3 & Q4 2024" or "Q4 2025 & Q1 2026". The parser should derive this from the billing dates and the known quarterly rate change schedule (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec).

10. **Pickering tracker row 17 date anomaly.** Row 17 shows start date 2026-02-06 but quarter reference "Q1 2025" — likely a data entry error in the tracker. The app should use invoice dates as the source of truth.

---

## 7. Success Criteria

1. Parse all 4 sample invoices correctly, producing output that matches the corresponding tracker data within $0.01 tolerance on all dollar amounts.
2. Handle multi-period Walgreen invoices, producing the correct number of rows (2 per billing period).
3. Handle split billing period invoices for Pickering.
4. Correctly calculate cost_per_m3 and cost_per_kwh, including 0-consumption edge cases.
5. Export to Excel matching Melissa's existing tracker format (headers, column order, formatting).
6. Walgreen scanned PDF extraction accuracy > 95% on dollar amounts (verified against manual entry).

---

## 8. Future Considerations (Not in Initial Build)

- Anomaly detection: flag significant jumps in cost_per_m3 or cost_per_kwh compared to prior period
- Automatic quarterly rate update tracking from Enbridge Handbook
- Integration with Sage Intacct for automatic journal entry posting
- Additional invoice types as Melissa identifies more manual tracking tasks
- Batch processing: upload all invoices for a quarter at once

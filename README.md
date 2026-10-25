# Handoff: Burosys Office Studio — Desking Configurator

## Overview
A sales/showroom configurator (iPad-first, also for burosys.com) for Burosys office furniture. The user configures **Workstations**, **Meeting tables**, **Cabins** and **Add ons** from the company price sheet, sees a live 3D model, picks finishes, adds lines to a **Basket** with volume-slab discounts and a per-line pricing **Working** breakdown, then **Books an order** which is saved as a numbered **Quote** (EST-CL1, EST-CL2…) and downloadable as an A4 quotation PDF matching the Zoho Books estimate format.

## About the design files
The files in this bundle are **design references built in HTML/JS** — a working prototype showing intended look and behaviour, not production code to ship as-is. Recreate it in the target codebase's environment (e.g. React/Next + three.js / react-three-fiber, with a real backend). If there is no existing environment, a good fit is **Next.js + react-three-fiber + a small DB (Supabase/Postgres) + object storage for models**.

The prototype runs fully client-side: `index.html` loads `app.bundle.js` (esbuild IIFE of `src/app.js` + vendored three.js). Source of truth for logic is `src/`.

## Fidelity
**High-fidelity.** Colours, type, spacing, layout and interactions are final. 3D geometry is procedural (parametric boxes/extrusions) and is a placeholder for real GLB models (see *3D*).

## Data model (from `data/PRICING STRUCTURE-2.xlsx`)
- **PRICELIST** (sheet 1) — the catalogue displayed. Header row 3, data from row 4. Columns used:
  - `I` SKU, `J` CATEGORY (WORKSTATION / MEETING / CABINS), `K` DESIGN/range (FLEXI, STARTEK, PANEL BASED, LOOP, ATHENA, FLUTED WOOD), `L` ASSEMBLY (LINEAR, L-SHAPED, …), `M` FORMATION (SHARING, NON SHARING, SINGLE, RESTING, FREESTANDING, TABLE ONLY…), `E` formation code (SH/NSH…), `F` top code, `G` size A (mm), `H` size B / screen code (F/G/X), `N` SIZE, `O` TOP material, `P` SCREEN, `Q` DESCRIPTION (used verbatim in PDF), `R` POPULAR, `S` 3D render ref.
  - Prices `T..X` = `[LIST, <10L slab, 10–20L, 20–40L, >40L]` in INR. Rows with empty/zero price are shown but cannot be added.
  - Rows 735–740 STORAGES: drawer pedestal prices (Mobile Pedestal = first row).
- **MASTER DATA** — rates and abbreviations (tops ₹/sqm, legs ₹/leg, electrification, risers, screens ₹/sqm, side units).
- **CALC \*** sheets (FLX WST, STK WST, PANEL WST, ECO MEETING, LUX MEETING, CABINS) — BOM blocks, 7 rows per SKU. Block for PRICELIST row r lives at row `(r − k) × 7` (k parsed from the `INDIRECT` formula in column T) or a direct cell ref. Within a block: row R−4 headers, R−3 rates, R−2/R−1 quantities (users, L, W…), R amounts; columns after `total` = per-user, margin multiplier (×2), rounded list price.
- `src/pricelist.js` is the pre-parsed result: each row `{sku, cat, range, asm, form, fc, tc, a, b, size, top, scr, desc, pop, render, p:[5], w}` where `w = {sh, users, L, W, lines:[[item, qty, unit, rate, amount]], total, per, mult, price}`. 625 priced rows reconcile exactly with LIST. **In production, parse the sheet server-side (or sync from Google Sheets) instead of shipping a generated JS file.**

## Discount slabs
Basket **net value at LIST** determines the slab for the whole basket: `<₹10L → col U`, `10–20L → V`, `20–40L → W`, `>40L → X`. Every line's unit net = its row price at that slab index; Add ons use LIST. The basket shows the current slab and the amount needed to reach the next slab.

## Screens

### Global header (all pages)
Full-width bar, `grid-template-columns: 1fr auto 1fr`, padding `10px 28px`, bg `--panel`, bottom border `1px --line`. Left: logo (`logo.png`) + wordmark "BUROSYS" / sub "OFFICE STUDIO". Centre: step tabs **Configure · Basket · Quotes** (width `min(520px, 50vw)`), active tab in `--accent`, basket tab shows line count.

### 1. Configure
50/50 split (`grid-template-columns: minmax(0,1fr) minmax(0,1fr)`), filling the viewport under the header, no page scroll on iPad (≥587px usable height).
- **Left panel** (`--panel`): category tabs **Workstations / Meeting / Cabins / Add ons**, then stepwise option groups as segmented button grids. Options that have no price in the sheet for the current path are disabled.
  - Workstations: Range → Layout (Linear / L-shaped…) → Type (Sharing/Non Sharing/Single…, with code chip SH/NSH) → Size (900/1200/1500 mm) → Screen (Fabric F / Glass G / None X) → Top (PLPB BSL, PLMDF, PoLMDF, LUVIH-MDF, LUVIH-PLY, Membrane).
  - Meeting & Cabins: Range → Formation → Size → Top (as available in sheet).
  - Add ons: **Mobile Pedestal** and **LHS 120×120 cm** only.
  - Finishes: Top colour, Frame colour, Screen colour swatches (`src/catalog.js`).
  - Bottom: price card (unit list and net at current slab), **Quantity** row with −/+ and a directly-typable numeric input (min 1), **Add to basket / Next** primary button.
- **Right panel**: three.js viewport, bg `--bg`. Top-right toolbar: **DIMS** (dimension lines) and **CHAIRS** toggles only. Caption bottom-left: product title + `SKU · W × D × H mm`. Orbit controls; camera auto-frames on change. Seats count follows the SKU's users.

### 2. Basket
Full page, everything visible without scrolling. Table columns: **Item · Working · SKU · Qty · Unit · Net · Line total · delete**.
- **Working cell**: button `₹{total} ÷ {users} × {mult}` + "VIEW/HIDE". Expands a panel under the row (border-top 2px `--accent`): component table (COMPONENT, QTY, UNIT, RATE, AMOUNT) and a summary column: Cost → ÷ users → × margin → List (rounded to 100) → **Net at {slab}%** (accent). Header shows calc sheet, cluster L×W m, users, "rates from MASTER DATA".
- Side summary: list total, slab %, discount, net (ex GST), next-slab hint.
- Primary button **Book Order** opens an inline form: **Project name** (text), **Sales person** (select: Hersh, Neil, Disha, Shturi, Bianca), **Client name** (text). All required; empty fields get red border `#E2552B` + 2px glow. Save → creates quote, clears basket, navigates to Quotes.

### 3. Quotes
Grid of cards, newest first: EST number + date, project, client · sales, lines · units · slab, net ex GST. Actions: **Download PDF**, **Open in basket** (copies lines back). **Quotes can never be deleted.** EST numbers are sequential `EST-CL{n}` and never reused (persisted counter).

### 4. Quotation details modal (before PDF)
"Fields from Zoho Books — fill in or skip": Billing address, Delivery address (textareas), Contact person, Phone, Email, Place of supply (default "Maharashtra (27)"), Expiry date (default quote date + 26 days), Transport/Labour ₹ (taxed at 18%), Subject (default "Delivery time - 5-6 weeks after PO+Advance+All finishes finalised"), per-line Notes. Buttons: Cancel · **Skip & download** · **Save & download** (persists fields on the quote).

### 5. Quotation PDF (A4, see `reference/EST-002705.pdf`)
Downloads directly as `{EST}.pdf` (no print dialog). Repeating page header "BUROSYS FURNITURE" (serif, letter-spaced, underlined) + "WORKSPACE & LIFESTYLE FURNITURE"; page number bottom-right. Body: company address/PAN/GSTIN/MSME/LUT + "QUOTATION"; meta (#, Estimate Date, Expiry Date, Reference# = project, Place of Supply, Project Manager = sales person); Billing/Delivery addresses; Subject; items table (#, **image placeholder** 12mm box, Item & Description from sheet DESCRIPTION + colour spec, Notes, Qty, Rate (net), Amount); totals (Sub Total, Transport/Labour, CGST 9%, SGST 9%, Total), total in words (Indian numbering, Lakh/Crore), warranty note, bank details, signature block, Terms & Conditions 1–8. Exact strings are in `buildQuoteSheet()` in `src/app.js`. In production, generate server-side (e.g. Puppeteer / a PDF lib) so text is selectable — the prototype rasterises via html2pdf.

## 3D
- `src/geometry.js` builds parametric clusters (sharing/non-sharing benches, meeting tables, cabins with side unit, pedestals) with named materials: `top`, `edge`, `frame`, `glass`, `fabricScr`, `ped`, `fascia`.
- `src/models.js`: optional real models. A PRICELIST `MODEL` column (or `S` 3D ref) maps to a file in `models/` (GLB preferred, OBJ+MTL supported). Loaded model replaces the procedural one; meshes/materials are recoloured by name keywords (see `models/README.md`); mm/cm auto-scaled to m; centred on floor.
- **Open item**: L-shaped workstations and 60mm panel-based workstations currently render as linear benches — needs proper models.

## State
Persisted in `localStorage` key `burosys.studio.v2`: `{ cat, selections per category, finishes {top, frame, screen}, qty, dims, chairs, basket:[{id,row,qty,fin,ex}], quotes:[{id, est, name, sales, client, date, basket, net, list, slab, slabIdx, zoho}], estSeq }`. On load, basket rows are refreshed from the current price list by SKU; quotes keep their snapshot. **Production must move quotes + EST counter to a server** (multi-device, non-deletable, audit trail).

## Design tokens
Colours: `--bg #141413`, `--panel #1B1B1A`, `--panel2 #222221`, `--line #2E2E2B`, `--ink #F2F0EC`, `--muted #8C8880`, `--dim #9C988F`, `--accent #E2552B` (hover `#F07A4E`), `--ok #8FAE7C`, error `#E2552B`.
Type: **Archivo** 400/500/600/700 (Google Fonts); base 15px; group labels 10px, letter-spacing .14em, uppercase, weight 600, `--dim`; inputs 16px/500.
Radius: `--rad 4px` (modals 6px). Min touch target 44–52px. Borders 1px `--line`; no shadows except form error glow.
PDF: Arial 7.6pt body, Georgia/Times for brand header, borders `#999`, header cells `#f2f2f2`.

## Assets
- `logo.png` — Burosys logo (user-supplied).
- `vendor/` — three.js r184 + loaders/exporters, html2pdf.js 0.10.1 (use npm packages in production).
- `data/PRICING STRUCTURE-2.xlsx` — price & BOM source.
- `reference/EST-002705.pdf` — Zoho Books quotation the PDF mirrors.

## Files
- `index.html` — markup + all CSS (open directly to run the prototype).
- `app.bundle.js` — built bundle loaded by index.html.
- `src/app.js` — UI, state, pricing/slabs, basket, quotes, Zoho modal, PDF.
- `src/geometry.js` — procedural 3D furniture + dimensions.
- `src/catalog.js` — finish swatches (tops, frames, screens).
- `src/pricelist.js` — parsed PRICELIST + working.
- `src/models.js` — GLB/OBJ loader and recolouring.
- `models/README.md` — guide for 3D modellers.

# Smiso Nzuza & Amantusi — Dual-Company Invoice CRM

Deployable single-page invoice and quotation application built from the supplied **20 Premium Designs** CRM file. It is self-contained: no backend, subscription or paid API required.

## Existing features retained

- Smiso Nzuza 90 Trading and Amantusi company switching, separate branded details and logos
- Invoices and quotations; gap-aware, collision-safe reference numbering
- 20 document designs and print layouts
- Line items, grouped packages, quantities, prices, VAT, discounts and overall totals
- CRM dashboard with saved records, customers, status and search
- Custom logos, stamps, signatures, banking, header symbols, layout and A4 placement
- Single-page A4 printing/PDF, PNG, JSON backups, and portable HTML with embedded data
- Phone-friendly desktop / Android / iOS controls, plus HTTPS install/offline support

## Run

Open `index.html` in your browser, or serve it locally using:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080. For installation/offline support serve it from HTTPS. This is a static web application: publish the repo to a static HTTPS host such as Cloudflare Pages with **no build command** and output directory `.`.

## Customer data and backup safety

The supplied full CRM HTML included historical invoice records. The committed app clears the **embedded invoice archive** so those historical records aren't seeded into the GitHub source. To restore archived data, use the app's JSON import or portable HTML workflow from the original upload. Original company profiles, logos and default banking information used for generated documents remain in code; review them before changing repository visibility or publishing.

Saved data remains in the browser's localStorage for **that origin/device only**. It does not automatically sync across devices. Export JSON and portable HTML backups regularly, especially before clearing browser data or changing domain. Do not upload invoices or saved HTML containing client details into public Git repositories.

File System Access and print/export support can vary between mobile browsers. The application shell caches offline after its first successful HTTPS load. PWA installation is not a centralized cloud database or an authentication system.

## Quality checks

```bash
python -m pip install pytest playwright
python -m playwright install chromium
pytest -q tests/
```

The included GitHub Actions workflow runs Chromium smoke checks on every push/PR. Passing CI is required before relying on the deployment for live invoices. A4 fit should be inspected on actual mobile print/PDF dialogs for complicated item groups.

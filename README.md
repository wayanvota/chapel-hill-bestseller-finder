# Bestseller Finder, Chapel Hill

Local independent prototype. No library credentials or Google Books API key required.

## Run

Use Node 26 (tested). Run `npm install` and `npm run dev` in this folder, then open http://127.0.0.1:4173/. The Node/Vite server supplies the local SQLite and live RSS endpoints. A static build alone does not provide those endpoints. Production deployment uses a static frontend at https://wayan.com/bestsellers/ and the Node API on Render.

## Data

- The starting collection preserves all 41 reviewed titles, original source cells and edition-specific catalog links in `data/seed.json` and `data/source-sheet.json`.
- `data/history/appearances.json` contains 7,830 ranked appearances from 261 consecutive Sunday issues, November 28, 2021 through November 22, 2026. Each issue has 15 Hardcover Fiction and 15 Hardcover Nonfiction entries. This is 522 individual lists, not all NYT categories.
- Source: Hawes Publications' secondary transcription, https://hawes.com/pastlist.htm . Original PDFs, extracted text, source URLs and SHA-256 hashes are retained under `data/history/`; about 20.4 MB total. They are not placed in the public assets directory.
- Run `npm run import:history` to rebuild the fixed five-year snapshot. Python 3 and Poppler `pdftotext` are required. Existing downloads are reused. Restart the app to ingest rebuilt JSON. There is no scheduled update.
- Import validation checks publication dates, list headings and each sequence of ranks 1 through 15. Source transcription errors remain possible. One explicit parser exception handles the missing “by” in the June 5, 2022 fiction rank 15 entry.
- SQLite deduplicates normalized title/first-author combinations. It reports the best rank within the selected period, breaking ties with the most recent date. Source spelling differences can leave duplicate works.
- Call numbers and original subject labels remain reviewed only for the original 41 titles. The full archive now has automatic subject suggestions as described below.

## Availability and book links

Google Books links search by title and author. Public BiblioCommons RSS checks run in batches of three, limited to the selected page (30 titles in archive mode). The original 41 titles require an exact reviewed record match. New titles require a unique matching standard-print result. Failed, missing, ambiguous or truncated responses stay unverified. An unmatched result is not proof of unavailability.

Live RSS responses are not persisted. Observations expire after five minutes in the UI. Shelf availability may change before arrival. Call numbers remain labeled as belonging to the reviewed edition. Set `RSS_ENABLED=false` to disable live checks.

## Verification, November 22, 2026

`npm test`: 12 passing checks, including all 261 weeks, rank sequences, seed parity, edition matching, malformed and truncated feeds, timeouts and rate limits. `npm run build`: passed TypeScript and production build. Browser checks: live 41-title scan completed with 41 available matches at test time, search narrowed to The Wager, no console errors observed, 390px mobile viewport had no horizontal overflow. Five-year nonfiction local query returned 956 deduplicated titles in 27.9ms in one local measurement. This is not a benchmark or a guarantee of RSS reliability.

## Full-archive subjects, November 22, 2026

The Subject filter covers all locally imported titles. New visits default to the full five-year collection; existing filter URLs remain valid. Use “Browse books without checking availability” for local-only filtering, or “Find available books” for the subsequent RSS check.

`data/subjects.json` contains 1,934 book records: 41 reviewed labels, 1,345 automatically tagged from cached archive summaries, and 548 general-category fallbacks (337 fiction and 211 nonfiction). There are 22 categories, including the two general categories. Tags can overlap. Counts describe stored work records; source spelling variants may still represent the same underlying work.

These are deterministic keyword-rule suggestions, not publisher metadata or library classifications. Short summaries omit topics, and ambiguous wording can yield incorrect tags. Specific subjects are therefore not exhaustive. Every automatic tag retains the matched terms and a dated source URL; expand “Tag evidence” in a row. General categories explicitly mean a specific category needs review. The original 41 reviewed History labels and edition links are preserved.

Rebuild with `npm run classify:subjects`, then restart the server. `npm run import:history` also rebuilds subject assignments after importing. Rules are in `scripts/classify-subjects.py`. No API calls or credentials are used for classification, and full summary prose is not copied into the subject index.

Verification: 16 tests pass, including coverage for every imported appearance, preservation of all 41 reviewed labels, overlapping filters and ambiguous-word regression examples. TypeScript and production build pass. Live local API checks returned History 116, Science & Nature 25, and Mystery & Suspense 273. Browser verified the 22-category dropdown, five-year scope, local-only browse button and 116 History results, with no console errors observed. Individual classification accuracy has not been comprehensively reviewed.

## Public-source enrichment, November 23, 2026

Supersedes the general-category counts in the November 22 section: all 548 former fallback records now have specific subject suggestions. 149 use matched Open Library catalog headings; 399 use AI-assisted readings of public descriptions. Thirty categories are available. Every new tag links to evidence, and the app distinguishes catalog mappings from AI-assisted description tags. No key or library contact is needed. The complete source and validation record is in [the enrichment report](data/subject-enrichment/REPORT.md), with [548 assignments](data/subject-enrichment/assignment-report.csv). All 20 tests and the production build passed.

## Production deployment

Original software is MIT licensed; see LICENSE and NOTICE.md for source-data attribution and exclusions.

Use Node 24 or later. `npm ci`, `npm test`, `npm run test:production`, and `APP_BASE_PATH=/bestsellers/ VITE_API_BASE=https://chapel-hill-bestseller-finder.onrender.com/ npm run build` prepare the frontend. Upload only `dist/client/` to the `/bestsellers/` directory on the website. Keep the rest of the application outside its public document root.

The Render service runs `npm ci --omit=dev` then `npm start`. Set `PUBLIC_ORIGIN=https://wayan.com`; `PORT` is provided by Render. `/healthz` confirms startup. The frontend calls the Render API over HTTPS. Cross-origin requests are allowed only from `PUBLIC_ORIGIN`. The local SQLite index is rebuilt from committed JSON on each new instance, so no persistent disk is required. Live library observations are not saved. The free Render service may pause when idle, delaying the first request.

Downloaded source PDFs, extracted text, and research caches stay local and are not published under the software license. Runtime JSON indexes are included. To regenerate source-dependent subject decisions, first rebuild the source archive and enrichment caches using the scripts and their documented inputs.

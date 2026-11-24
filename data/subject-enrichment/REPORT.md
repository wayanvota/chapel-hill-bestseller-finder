# Subject enrichment, November 23, 2026

All 548 former general-category records now have at least one specific subject suggestion. All original 41 reviewed labels and the other 1,345 rule-based assignments are unchanged. The resulting archive has 30 subject categories across 1,934 stored work records.

## Sources and method

149 records use public Open Library catalog subject headings, mapped into the app taxonomy. Search requests were batched in groups of ten titles, cached locally, and paced at least 1.1 seconds after completed downloads. The script follows the batch-search approach in https://openlibrary.org/developers/api and requires normalized title plus first-author agreement. Full franchise titles must match; a shared series prefix is insufficient. Search failures remain unmatched. No API key, private account, or library contact was used.

399 records use AI-assisted semantic readings of public descriptions. Most descriptions were already present in the retained Hawes weekly PDFs. Short descriptions that only named a series were supplemented with public publisher, author, Google Books, and review pages. The source URL and classification rationale are retained for every tag. Sixteen individual public-page decisions are preserved in external-decisions.tsv, including one stronger source for The Life of Chuck. No complete publisher descriptions are republished in the UI.

These are subject suggestions, not librarian-approved classifications. They mix genre and subject themes so that fiction can also be found by topics such as education, war or family relationships. Catalog headings may be broad or mistaken, and description-based readings remain interpretive. Complete coverage does not mean independently verified accuracy.

## Reproducibility

- targets.json freezes the original 548 records.
- Hashed JSON files cache successful Open Library search responses.
- openlibrary-overrides.json stores accepted matches, their returned author/title identities and the supporting headings.
- description-decisions.tsv and external-decisions.tsv store the semantic review decisions by position in the frozen targets list. build-description-subjects.py reconstructs their source-linked records; the source summary audit is in summary-review.json.
- assignment-report.csv lists the final 548 assignments and source URLs.
- Run npm run classify:subjects to rebuild offline. npm run enrich:subjects refreshes the cached batch lookup (retrying previously failed batches) and rebuilds. Existing cached requests are not fetched again. Restart Vite after changing the data index.
- This completed semantic review applies to the frozen target set. Future newly imported books can still remain general if no rule or persisted assignment covers them.

## Validation

20 tests passed: existing 16 application checks plus four enrichment tests for book identity, rejection of shared franchise prefixes, separation of social from natural science, and source-backed specific coverage for all 548 targets. TypeScript and production build passed. Live local API returned 30 categories and confirmed Project Hail Mary under Science Fiction, The Wish under Romance, and The Dawn of Everything under History. Rebuilding subjects offline reproduces the index. No exhaustive independent review of classification accuracy is claimed.

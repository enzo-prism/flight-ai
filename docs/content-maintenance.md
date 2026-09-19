# Product and release editing guide

## Source of truth

Edit `content/releases.json` for releases and `scripts/build-product-pages.py` for product copy/templates. Generated HTML is committed for dependency-free hosting. Do not edit generated pages by hand: regeneration replaces them.

## Add a release

1. Read the supplied release material and record its provenance in `docs/product-content-sources.md`.
2. Add a record to the JSON array. The generator sorts by `endDate` descending.
3. Use a unique lowercase, hyphen-separated `slug`. Once published, keep it stable.
4. Provide `title`, human-readable `period`, ISO `startDate`/`endDate`, `category`, `summary`, and `benefit`.
5. Use one of `Capabilities`, `Experience`, or `Reliability` for the category.
6. Add at least one highlight with `title`, `description`, and `benefit`. Add string lists for `fixes` and `foundation`, even when empty. Include positive PDF `sourcePages` numbers and update the source-map document. For a future non-PDF source, extend the provenance schema and validator explicitly rather than inventing page references.
7. Run generation and all checks from README. Review the article, index search, chronology, latest-update cards, and adjacent-release links in a browser.
8. Commit the JSON, any template/style changes, source notes, and generated HTML together.

The generator validates every record before writing any output. `--check` compares committed files against in-memory rendering without writing. It rejects unexpected files under `updates/` so renamed or removed records cannot silently leave orphaned public pages.

## Editorial rules

- State the customer benefit in terms of the documented behavior. Do not invent savings, percentages, response-time improvements, capabilities, or customer endorsements.
- The initial source identifies nine weekly coverage periods, not major version numbers or exact launch dates. Keep those articles labeled as release periods.
- AI usage costs are estimates, not invoices or guaranteed charges.
- Keep security claims scoped. Credential redaction is documented for diagnostics when integrations return no available actions; it is not evidence of universal secret protection.
- No new testimonial was derived from release notes. The existing Trace quote is separately attributed in the source map.
- The overview illustration is labeled as such. Demo links do not promise the full production platform.
- Specific provider names reproduce the source document. Confirm them with the product owner before changing them or describing broader model availability.

## Retire or rename an article

Keep published slugs where possible. For an approved rename, add a permanent redirect in `vercel.json` from the old clean URL to the new clean URL, update the data, and explicitly remove the exact retired generated file after review. For a removal, decide whether to retain an archive page or redirect before deleting. The generator intentionally does not perform destructive cleanup.

## Generated behavior

- The latest three records appear on the product page.
- The index shows all records newest first and derives its month/year coverage label from the date fields.
- Search includes title, period, summary, benefit, all highlight text, fixes, and foundation notes.
- Category and text filters combine. Empty results have an explicit message and a live result count.
- All content exists in HTML; JavaScript only enhances navigation/search. Without JavaScript, release controls remain hidden and mobile navigation links remain available.

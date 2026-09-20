# Product implementation verification

Verified September 19, 2026 on branch `codex/product-onboarding`.

## Implemented

The website's Get Started links now target a server-backed account journey: authentication, source authorization, Sales/Support configuration, and a private conversation workspace. Gmail, Microsoft 365, HubSpot Inbox/Help Desk, Zendesk, and Intercom US adapters implement read-only OAuth ingestion. Jev performs bounded typed evaluation with traceable evidence. Findings support ownership, saved drafts, review outcomes, source navigation, and derived analytics. The original fictional workspace remains separate at `/sample`.

A dedicated Supabase Free database was provisioned and migrations 001/002 were applied. All seven product tables have row-level security. Tokens use authenticated encryption; secrets and privileged mutations are server-only. A local production-target Vercel build bundles the API and an explicit public-asset allowlist.

## Passing checks

- 73 Node unit/regression tests, including authentication guards, provider normalization, evaluation validation, skipped records, reauthorization, and analytics consistency.
- Seven Python release-content tests; 13 generated pages current; 540 local references across 15 pages valid.
- Four browser suites: real-product UI with mocked providers plus the three isolated sample-workspace suites. Product accessibility scans passed on account, connectors, role, empty workspace, finding actions, mobile overview and sign-in. Browser mocks do not prove live OAuth or model calls.
- Actual Supabase sign-in and persisted workspace test with a temporary synthetic account: HttpOnly session, CSRF rejection, private empty workspace, unavailable-service gates, logout. The exact test user and its workspace were removed; no email was sent.
- Actual database transaction test: cross-account RLS isolation, denied secret reads, scan leases, atomic rollback, stale findings, skipped evaluations, preserved drafts/outcomes, and reopening on new source evidence. All synthetic database records were rolled back.
- Local Vercel production-target build passed. Inspected deployment output contains no environment, database-schema, or documentation files. Private static paths return 404; unauthenticated workspace API returns 401 with no-store caching.

## Not verified or live

The changed website/API have not been pushed to main or deployed. A successful local production-target build is not a production deployment.

The Supabase service reports email enabled, but public email delivery and confirmation/recovery redirects have not been verified. Google, Apple, and SSO are disabled. Connector OAuth credentials and the AI Gateway key are absent. No customer connector authorization, live source retrieval, or paid Jev evaluation has occurred. Provider accuracy, production account flows, and end-to-end customer onboarding remain unverified.

## Required to finish launch

Use the project-owned provider accounts to configure production email, Supabase redirect allowlisting and identity providers, the five source OAuth apps, the server token-encryption key, and AI Gateway. Source apps may require provider review before public use. SSO availability and any paid service usage require a separate account/budget decision. Never paste secrets into a task or commit them.

Follow [product onboarding setup](product-onboarding.md), [connector setup](connector-setup.md), and [Jev analysis](jev-analysis.md). Verify the complete journey with an authorized test source and an approved analysis budget before replacing the existing public entry. Record the final main SHA, deployment URL, and production readback separately.

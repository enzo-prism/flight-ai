# Real product onboarding and readiness

## Customer journey

1. **Get Started** opens `/app` account creation. Email/password uses Supabase; Google, Apple, and SSO are shown as available only when the authentication service reports them configured. Email confirmation and password recovery are real service flows, not simulated success.
2. Authorize sources on **Connect your tools**. The browser redirects to provider consent; a successful callback verifies the account and stores encrypted credentials on the server. Selecting a card alone does not create a connection.
3. Choose **Sales** or **Support**. The server stores the work type and applies the corresponding Jev evaluation signals. Work type cannot change once analysis has started, preserving the meaning of historical findings.
4. Review the initially empty workspace, then explicitly scan a connected source. Each scan imports a bounded batch and reports progress, errors, and whether more records remain. No sample records are inserted.
5. Inspect findings against original messages, assign ownership, edit/save/copy drafts, and record outcomes. These actions update Mach 1 only; there is no source-system message sending.

The separate `/sample` is a fictional preview. Its browser-local state, sample metrics, and Tower simulation are never imported into authenticated workspaces.

## Architecture and trust boundaries

`api/product.mjs` dispatches to `server/api.mjs`. Supabase verifies users server-side with HTTPOnly cookies. The service role accesses tenant-scoped database operations; connector secrets and OAuth states have no authenticated/anonymous read grants. OAuth state is random, expiring, single-use, and bound to the signed-in user and workspace. Connector tokens are AES-GCM encrypted with a deployment key and connection-specific context.

Each connector has a stable provider account identity. Reauthorization cannot swap another account into existing conversation history. Connection metadata and encrypted credentials are saved atomically; scan leases serialize conflicting operations. Analysis writes are atomic per conversation, preserving user drafts/outcomes/activity. Findings absent from the latest analysis become `analysis_current=false`, not automatically handled or customer-confirmed. New evidence can reopen a previously closed finding while retaining its earlier outcome and activity. Coverage reports distinguish evaluated conversations from records skipped because usable analysis was unavailable; skipped records are not counted as successfully reviewed.

Jev is an evaluation model, not a freeform chat generator. Application code validates bounded signal outputs and exact source evidence, derives timing/priority, and provides editable draft templates. The UI never receives the AI Gateway key or OAuth tokens. More records remaining, source truncation, and model/input limits must remain visible in coverage reporting.

## Required server configuration

Use the deployment secret store or ignored local `.env.local`; never paste secrets into documentation, chats, browser storage, or source files.

- `APP_ORIGIN`: exact production origin, `https://flight-ai-two.vercel.app`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), and `SUPABASE_SERVICE_ROLE_KEY`.
- `TOKEN_ENCRYPTION_KEY`: server encryption key in the format required by `server/crypto.mjs`. Preserve it for existing encrypted tokens; changing it without migration makes credentials unreadable.
- `AI_GATEWAY_API_KEY`: required for real Jev evaluations. Real scans can incur provider charges; do not make paid verification calls without authorized spend.
- The provider-specific client IDs/secrets in [connector setup](connector-setup.md).
- Google/Apple authentication applications and any SAML SSO configuration in Supabase. These are separate from mailbox/source connector OAuth apps.

Copy the names from `.env.example` when configuring environments; it contains placeholders only. `TOKEN_ENCRYPTION_KEY` must decode to exactly 32 random bytes.

Configure Supabase's site URL and redirect allowlist for `https://flight-ai-two.vercel.app/api/product?action=auth.callback`, including the recovery callback query variant used by the code. Add only intentional development origins. The current PKCE confirmation and password-recovery links must be opened in the same browser profile that requested them, because the verifier lives in its HTTPOnly cookie. Opening the link on another device/profile will fail safely; restart the request in the browser where you will open the email link. Do not describe cross-device recovery as verified.

Production email confirmation/recovery also require correctly configured email delivery; an enabled email provider alone does not verify deliverability.

Implementation-time readiness snapshot: Supabase email enabled; Google, Apple, and SSO disabled; all five connector OAuth credential pairs absent; AI Gateway key absent. Therefore the implemented sign-in/workspace path and deployed code must not be described as verified end-to-end connector intelligence. Recheck `GET /api/product?action=config`, provider consoles, and real authorized account behavior before announcing launch readiness.

## Database migration with verified TLS

Use a verified development or production project identity and the direct/non-pooling database connection where available. `scripts/migrate-product.mjs` applies the numbered `db/*.sql` migration sequence in order and records each version in `product_schema_migrations`; subsequent runs skip applied versions. The sequence begins with `001` for the tenant schema and `002` for scan coverage and renewed evidence behavior. Schema changes after deployment require a new migration, not silently editing the previously applied file.

Download the database's official root CA certificate from the Supabase project's **Database settings / SSL configuration** using the provider's own dashboard. Keep the certificate on local internal storage and set `POSTGRES_CA_PATH` to that file. The script deliberately uses `rejectUnauthorized: true`; never disable TLS certificate verification to work around a connection failure. Do not substitute an unverified certificate or credentials copied from another project.

```sh
POSTGRES_CA_PATH=/absolute/path/to/official-supabase-ca.crt \
  node --env-file=.env.local scripts/migrate-product.mjs
```

The environment file supplies `POSTGRES_URL_NON_POOLING` or `POSTGRES_URL`. Inspect the migration's printed table count and RLS result, then run the integration check below. A successful build does not apply the migration.

## Verification levels

`npm test` and `tests/browser/product.cjs` use mocks. They verify code behavior, not live credentials, provider approvals, email delivery, source ingestion, or paid model performance.

The database integration suite creates synthetic records inside a transaction and rolls them back. It verifies real SQL/RLS isolation, secret denial, scan locking, atomic rollback, and preserved outcomes. Run only against an explicitly selected development project:

```sh
POSTGRES_CA_PATH=/absolute/path/to/official-supabase-ca.crt \
  node --env-file=.env.local tests/product-database.integration.mjs
```

The auth integration suite creates one random `@example.invalid` user with the administrator API, confirms it without sending email, exercises the local authenticated server, then deletes that exact user and its workspace. It currently asserts that unconfigured Gmail and analysis remain unavailable, so run it in that isolated readiness state, not against a provider-enabled production account. Start the server with matching development credentials and origin first:

```sh
PORT=8093 node --env-file=.env.local scripts/dev-product.mjs
```

In a separate terminal:

```sh
PRODUCT_TEST_ORIGIN=http://127.0.0.1:8093 \
  node --env-file=.env.local tests/product-auth.integration.mjs
```

The auth suite has temporary external database effects and requires explicit test-project authorization; ordinary CI does not run it. Read its final cleanup result. None of these tests authorize live customer-data access or paid Jev requests.

For actual launch proof, use an authorized source account to verify consent/cancellation, account identity, token refresh, multiple ingestion pages, known messages, evidence integrity, persisted findings, and disconnection. Verify Google/Apple/SSO and confirmation/recovery delivery separately. Record dates and the exact deployed source SHA; never report mocks as live results.

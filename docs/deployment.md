# Deployment runbook

## Identity

| Surface | Expected value |
| --- | --- |
| GitHub | `enzo-prism/flight-ai` |
| Production branch | `main` |
| Public URL | `https://flight-ai-two.vercel.app` |
| Vercel project | `flight-ai` |
| Project ID | `prj_3jCZIflU86gc2YowdAgqz4PkdLMo` |
| Team ID | `team_NbogaPSGlnnTm8RNaeS0B4Pl` |
| Team scope | `enzo-design-prisms-projects` |
| Framework | Other; Node build, `public/` static output, Node API function |

`.vercel/project.json` is local, ignored metadata. Never infer a production target from the current directory name. Do not create a replacement project when linking fails.

## Before publishing

1. Confirm publication is authorized.
2. Fetch origin; verify source identity, branch, and working-tree changes. Integrate any upstream changes without overwriting other work.
3. Run `npm ci`, `npm run build`, `npm test`, the Python content checks, and all four browser suites in README. Inspect account entry, unavailable-provider handling, the isolated sample, and marketing/release navigation on desktop and mobile. Do not send test email or make paid model calls.
4. Confirm `.vercel/project.json` matches the IDs above, and inspect `vercel whoami`, `vercel project inspect flight-ai`, and `vercel inspect https://flight-ai-two.vercel.app`.
5. Check the target Supabase project, migration version, and server environment. Apply any authorized migration with `POSTGRES_CA_PATH` pointing to the official Supabase project CA certificate and verified TLS; see [product onboarding](product-onboarding.md). Never assume a code deploy migrates the database.
6. Record the current production deployment URL for rollback. Commit the reviewed code and docs, then push the intended commit to `main` without force. Inspect the GitHub-triggered deployment before creating an additional CLI deployment.

## Deploy

From the verified linked checkout:

```sh
vercel --prod --yes
```

`npm run build` runs `scripts/build-site.mjs` and stages public assets from an explicit allowlist into `public/`. The server entry `api/product.mjs` becomes a Vercel function. `.vercelignore` must retain `scripts/` because the build requires it; `outputDirectory: public` prevents build scripts and server/database source from becoming static assets. Environment files, review notes, tests, and generated local output are excluded from uploads. `cleanUrls: true` removes `.html`; `trailingSlash: false` preserves relative article assets.

Keep application secrets in Vercel environment settings, not generated files. The API needs Supabase configuration and an encryption key; connectors and analysis require their own credentials. Google/Apple/SSO must also be enabled in Supabase. The implementation-time snapshot had email enabled but those three sign-in methods, all source OAuth applications, and AI Gateway unavailable. Deploying the code alone does not remove these launch blockers.

Wait for Ready status and inspect the alias. If GitHub integration also triggers a deployment, identify which deployment owns the production alias and verify the intended source. Do not treat an uploaded URL as proof that the public alias changed.

## Live verification

- Fetch `/`, `/product`, `/updates`, `/sales`, `/app`, `/sample`, and every `/updates/<slug>` directly.
- Compare HTML and changed local CSS/JS against committed source bytes.
- Check `.html` redirects preserve nested release navigation. The trailing-slash route must not alter relative asset resolution.
- Verify all local links/assets resolve in production, search and category filters work, the mobile menu opens/closes, and there are no new browser runtime errors.
- Verify `/docs/deployment.md`, `/content/releases.json`, `/scripts/build-site.mjs`, `/server/api.mjs`, `/db/001_product.sql`, and `/.env.local` return 404.
- Read `/api/product?action=config` and record actual service/provider readiness. Anonymous `/api/product?action=session` must return a null user; private workspace endpoints must reject anonymous requests. Responses must not expose keys or connector tokens.
- Confirm Get Started reaches real authentication and that `/sample` remains visibly fictional. Without configured sources/model access, show honest unavailable states and empty data, not simulated successful scans.
- Provider consent, refresh, source ingestion, model evidence, email delivery, and Google/Apple/SSO require independent live verification after configuration. Mock browser success is not live-data proof.
- Confirm remote `main` equals the intended SHA and check the `Site checks` workflow result separately from deployment status.

Keep a dated live verification record with the source SHA, deployment ID/URL, alias, and results. Report local, GitHub/CI, and production status separately.

## Rollback

If the new production deployment fails verification, use the previously recorded production deployment:

```sh
vercel rollback <previous-production-deployment-url>
```

Confirm the alias and public pages afterward. A deployment rollback does not revert the database schema or rewrite GitHub main. Check schema compatibility before rolling back application code. Any source correction is a new commit; do not force-push history as a rollback shortcut.

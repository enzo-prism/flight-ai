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
| Framework | Other / static; output is project root |

`.vercel/project.json` is local, ignored metadata. Never infer a production target from the current directory name. Do not create a replacement project when linking fails.

## Before publishing

1. Confirm publication is authorized.
2. Fetch origin; verify source identity, branch, and working-tree changes. Integrate any upstream changes without overwriting other work.
3. Run all README checks and inspect product, updates, and a release page on desktop and mobile. Verify search terms found only in fixes, menu keyboard behavior, no-JavaScript navigation, and the sales draft state. Do not send test email.
4. Confirm `.vercel/project.json` matches the IDs above, and inspect `vercel whoami`, `vercel project inspect flight-ai`, and `vercel inspect https://flight-ai-two.vercel.app`.
5. Record the current production deployment URL for rollback. Commit the reviewed code and docs, then push the intended commit to `main` without force.

## Deploy

From the verified linked checkout:

```sh
vercel --prod --yes
```

No framework build is required. `.vercelignore` excludes authoring data, scripts, tests, docs, and asset README files from static hosting. It does not remove these files from GitHub.

Wait for Ready status and inspect the alias. If GitHub integration also triggers a deployment, identify which deployment owns the production alias and verify the intended source. Do not treat an uploaded URL as proof that the public alias changed.

## Live verification

- Fetch `/`, `/product`, `/updates`, `/sales`, and every `/updates/<slug>` directly.
- Compare HTML and changed local CSS/JS against committed source bytes.
- Check `.html` redirects preserve nested release navigation. The trailing-slash route must not alter relative asset resolution.
- Verify all local links/assets resolve in production, search and category filters work, the mobile menu opens/closes, and there are no new browser runtime errors.
- Verify `/docs/deployment.md`, `/content/releases.json`, and `/scripts/build-product-pages.py` return 404 so authoring files are not exposed.
- Confirm remote `main` equals the intended SHA and check the `Site checks` workflow result separately from deployment status.

Keep a dated live verification record with the source SHA, deployment ID/URL, alias, and results. Report local, GitHub/CI, and production status separately.

## Rollback

If the new production deployment fails verification, use the previously recorded production deployment:

```sh
vercel rollback <previous-production-deployment-url>
```

Confirm the alias and public pages afterward. A deployment rollback does not rewrite GitHub main. Any source correction is a new commit; do not force-push history as a rollback shortcut.

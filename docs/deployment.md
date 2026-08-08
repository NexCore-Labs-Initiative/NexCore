# Deployment ownership

Vercel is the sole canonical production host for `https://nexcorelabs.vercel.app`. GitHub Pages must remain disabled.

## Preview and production

- Pull requests create preview deployments through the Git integration.
- `main` is protected and production changes arrive through reviewed pull requests with required CI.
- Verify `.vercel/project.json`, `vercel whoami`, and the active team before using the CLI.
- Inventory environment-variable names with `vercel env ls`; never print values.
- Remove obsolete PayPal and unused AI secrets while their surfaces are paused. Rotate duplicated or uncertain secrets.

## v3.3 audit status (2026-08-08)

- The CLI is authenticated and this checkout is linked to `al-faris-mujahids-projects2025/nexcorelabs`.
- Vercel reports no project environment variables in production, preview, or development. Configure and verify the required Supabase server variables before promoting v3.3; do not copy uncertain local values.
- The current canonical production URL returns HTTP 200, while the latest production deployment predates v3.3.
- GitHub Pages was disabled after the canonical Vercel URL was verified.
- The temporary OIDC `.env.local` generated during CLI linking was removed after use.

Production verification covers clean route 200 responses, EN/AR pairing, desktop/mobile smoke tests, API response contracts, current version/cache markers, and Supabase access boundaries. A successful local build is not production proof.

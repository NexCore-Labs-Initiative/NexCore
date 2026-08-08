# Deployment ownership

Vercel is the sole canonical production host for `https://nexcorelabs.vercel.app`. GitHub Pages must remain disabled.

## Preview and production

- Pull requests create preview deployments through the Git integration.
- `main` is protected and production changes arrive through reviewed pull requests with required CI.
- Verify `.vercel/project.json`, `vercel whoami`, and the active team before using the CLI.
- Inventory environment-variable names with `vercel env ls`; never print values.
- Remove obsolete PayPal and unused AI secrets while their surfaces are paused. Rotate duplicated or uncertain secrets.

Production verification covers clean route 200 responses, EN/AR pairing, desktop/mobile smoke tests, API response contracts, current version/cache markers, and Supabase access boundaries. A successful local build is not production proof.

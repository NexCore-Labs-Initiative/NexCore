# Release process

1. Create the milestone and scoped issues with acceptance criteria, commands, rollback notes, dependencies, and exclusions.
2. Implement on a short-lived branch and keep English/Arabic changes paired.
3. Run `npm.cmd run shell:sync`, `npm.cmd run assets:build`, `npm.cmd run ci`, and `npm.cmd run browser:test`.
4. Run the Supabase access matrix and advisors for database releases.
5. Run `npm.cmd run release -- 3.3.0` only after release contents are final.
6. Confirm `version.js`, `package.json`, lockfile, service-worker cache, release data, changelogs, sitemap, and evidence agree.
7. Merge through protected `main`, verify Vercel production, and confirm GitHub Pages remains disabled.

Release gates are documented in [roadmap.md](roadmap.md). Claims without repository evidence fail `npm.cmd run release:evidence`.

# Contributing to NexCore Labs

Thanks for helping improve NexCore Labs. Keep changes focused, bilingual, privacy-conscious, and truthful about unfinished features.

## Workflow

1. Start from current `main` and create a short-lived branch such as `codex/fix-menu-focus`.
2. Make the smallest coherent change. Do not commit `.env` files, tokens, database dumps containing user data, or generated credentials.
3. Keep every public English route and message aligned with its Arabic pair.
4. Run `npm.cmd run shell:sync` after shared navigation or page-shell changes and `npm.cmd run assets:build` after shared JS/CSS changes.
5. Run `npm.cmd run ci`. For UI work, also run `npm.cmd run browser:test`.
6. Open a draft pull request using the repository template.

Database changes must be created with `supabase migration new <name>`, reviewed in `supabase/migrations`, and deployed using the sequence in `docs/database.md`. Never apply a restrictive policy before the compatible API/frontend is deployed and rollback evidence exists.

## Definition of done

- English and Arabic behavior match.
- No direct browser access is added to protected tables.
- API errors follow `{ "error": "code", "message"?: "safe text" }`.
- Tests, production dependency audit, route validation, release evidence, and relevant browser checks pass.
- Documentation and release notes describe what actually shipped.

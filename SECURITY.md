# Security policy

## Reporting

Do not disclose a vulnerability in a public issue. Use GitHub's private vulnerability reporting for this repository. Include the affected route or component, reproduction steps, impact, and any suggested mitigation. Avoid accessing data that is not yours.

The maintainers will acknowledge a valid report as soon as practical, assess severity, prepare a private fix, and coordinate disclosure after affected production systems are remediated.

## Supported release

Only the current production release on `main` is supported with security fixes. NexCore Labs uses Vercel as its canonical host; GitHub Pages copies and unofficial forks are outside the support boundary.

## Security expectations

- Service-role keys and provider secrets stay server-side.
- Every exposed Supabase table uses RLS and least-privilege grants.
- Privileged RPCs derive user identity from `auth.uid()` and have deliberate execution grants.
- Restrictive database releases require a backup, an access-matrix test, and a tested rollback procedure.

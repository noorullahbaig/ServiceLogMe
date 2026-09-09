# ServiceLOGME Implementation Plan

> Execute in this session using subagent-driven-development with independently owned files and controller integration.

**Goal:** Deliver the approved desktop and field Service Note application.
**Architecture:** Next.js presentation and authenticated server API; Supabase Auth, normalized PostgreSQL, private storage; shared domain rules and report projection.
**Tech Stack:** Next.js, React, TypeScript, Tailwind, Supabase, Decimal.js, Zod, React PDF, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-09-09-servicelogme-design.md

## Global constraints
- Only DRAFT and COMPLETED notes; ADMIN and EMPLOYEE roles; PAID and UNPAID payment.
- No production fixtures, authentication bypasses, fake controls, or automatically seeded data.
- Server authorization, organization isolation, immutable completion, decimal-safe totals.
- Desktop and independent field layouts; inspect all four required viewport sizes.

## Tasks and interfaces
- [ ] 1. Foundation and visual gate: src/components/{shell,note-editor,note-detail,report,signature}.tsx; src/app/globals.css. Components consume typed Profile, Organization, Customer, ServiceNote and callbacks; no network simulation in production. Verify seven surfaces in a development-only component harness outside production routes.
- [ ] 2. Domain: src/lib/{types,domain}.ts and tests/domain.test.ts. Export calculateTotals(input), completionErrors(note,hasSignature), canAccessNote(profile,note). Write failing decimal, payment, completeness, ownership, and snapshot tests, run `npm test -- tests/domain.test.ts`, implement and rerun.
- [ ] 3. Persistence: supabase/migrations/*.sql, tests/database.test.ts. Implement normalized schema, policies and atomic create/save/complete functions. Execute migration in PGlite with Supabase auth roles emulated only in tests. Assert persisted state, totals, snapshots, lock behavior, and organization isolation.
- [ ] 4. Auth and API: src/lib/server/*.ts, src/app/api/[...path]/route.ts, src/proxy.ts, src/app/auth/confirm/route.ts. Verify active membership on every operation; expose session, notes, customers, employees, settings, assets, signature and PDF operations. Use real Supabase invitations and private object storage.
- [ ] 5. Integrate screens: src/app/[[...path]]/page.tsx and src/components/application.tsx. Route to login, overview, lists, editor, detail/report, customer history, administration, and phone workflow. All visible operations call authenticated API and refresh persisted data. Guard routes server-side.
- [ ] 6. Reports/PWA: src/lib/server/pdf.tsx, public/sw.js, src/app/manifest.ts, icons. Shared report data, private asset retrieval, multi-page PDF, print CSS; cache static assets only.
- [ ] 7. Verification and operations: tests/e2e/*.spec.ts, playwright.config.ts, scripts/bootstrap.ts, README.md, .env.example. Exercise browser workflow against configured Supabase, inspect core screen harness independently if infrastructure unavailable, run test/typecheck/lint/build, record environmental limitations accurately.

## Contract
Types use snake_case database field names. ServiceNote nests labor, materials, charges, photos, signature; customer and employee snapshots are flat fields. Money inputs are decimal strings and persisted totals are decimal strings. APIs respond with JSON or a precise error and HTTP status; all errors preserve form data. The controller owns shared types and API integration; UI implementer owns components/styles; persistence implementer owns SQL/tests after the visual gate.

## Verification commands
```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## User scope revision
The user explicitly deferred Supabase/authentication/backend connectivity and will eventually connect Cloudflare. Implement UI, local development interactions, shared business rules, signature and report functionality now. Do not provision Supabase or claim production readiness. Use an isolated IndexedDB development adapter and fixtures; hosted builds fail closed unless a real backend adapter is supplied. Employee invitation and sign-in are absent until authentication exists. Employee directory editing may work as local profile data without claiming account creation. Keep clean backend contracts for later integration.

# ServiceLOGME

ServiceLOGME is a responsive field-service note workspace. It gives an office team and field employees one clear workflow for drafting service notes, capturing labor, materials, photos, payment details and customer acceptance, then producing a printable PDF report.

## Run locally

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:3000/dashboard](http://127.0.0.1:3000/dashboard). The development build uses a browser-local workspace stored in IndexedDB. It includes realistic fictional records only for local development and testing; it is not shared, authenticated or suitable for production records.

Useful routes include `/dashboard`, `/service-notes`, `/customers`, `/employees`, `/reports`, and the phone-focused `/field` workspace.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Current backend boundary

The UI and domain rules are complete for local development. The `WorkspaceRepository` interface in `src/lib/repository.ts` separates them from persistence. Before deployment, replace `LocalWorkspaceRepository` with the planned Cloudflare-backed implementation and add real authentication, organization-scoped authorization, private object storage, server-side completion transactions, audit logging and invitation delivery. The deployed app intentionally fails closed unless a backend is configured; it does not expose the local workspace by default.

The full product and implementation decisions are documented in `docs/master-product-plan.md` and `docs/superpowers/specs/2026-09-09-servicelogme-design.md`.

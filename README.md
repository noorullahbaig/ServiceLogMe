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

## Backend

Production uses the `WorkspaceRepository` interface with D1-backed authentication, organization-scoped authorization, private D1 media, server-side totals and completion transactions, and audit logging. IndexedDB remains development-only.

The full product and implementation decisions are documented in `docs/master-product-plan.md` and `docs/superpowers/specs/2026-09-09-servicelogme-design.md`.

## Cloudflare deployment

The production adapter uses Cloudflare Workers and D1. R2 is optional and is not required for the current deployment. The repository includes `wrangler.jsonc` and versioned migrations in `migrations/`.

The two D1 databases are already provisioned:

```sh
# remote staging database
npx wrangler d1 migrations apply servicelogme-staging --remote --env staging

# remote production database
npx wrangler d1 migrations apply servicelogme-production --remote

# seed each database once; this command never deletes existing records
npm run seed:d1 -- --database servicelogme-staging --env staging --remote
npm run seed:d1 -- --database servicelogme-production --remote
```

Build and deploy Workers locally with:

```sh
npm run build:vinext
npx @vinext/cloudflare deploy --env staging
npx @vinext/cloudflare deploy
```

Cloudflare’s current Next.js Workers workflow uses vinext; see the [official Next.js Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [D1 guide](https://developers.cloudflare.com/d1/get-started/).

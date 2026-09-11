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

## Cloudflare deployment

The production adapter uses Cloudflare Workers, D1, Cloudflare Access, and R2. The repository includes `wrangler.jsonc` and the first migration in `migrations/0001_initial_schema.sql`.

The two D1 databases are already provisioned:

```sh
# local staging database
npx wrangler d1 migrations apply servicelogme-staging --local --env staging

# remote staging database
npx wrangler d1 migrations apply servicelogme-staging --remote --env staging

# remote production database
npx wrangler d1 migrations apply servicelogme-production --remote
```

The Worker expects these Access secrets in each environment. Wrangler prompts for the values securely; do not put them in Git:

```sh
npx wrangler secret put CLOUDFLARE_ACCESS_ISSUER --env staging
npx wrangler secret put CLOUDFLARE_ACCESS_AUD --env staging
npx wrangler secret put CLOUDFLARE_ACCESS_ISSUER
npx wrangler secret put CLOUDFLARE_ACCESS_AUD
```

Create a Cloudflare Access self-hosted application for a Cloudflare-managed custom hostname, then use its team issuer URL and Application Audience (AUD) Tag for those secrets. Access should have an Allow policy for approved company emails or an identity-provider group.

R2 must be enabled once in the Cloudflare dashboard before the file bucket can be created. Then run:

```sh
npx wrangler r2 bucket create servicelogme-files
```

Add the returned bucket as the `FILES` R2 binding in `wrangler.jsonc` for both environments before using photo or signature uploads. Files are served only through the authenticated `/api/files` route; D1 stores metadata and object keys.

Build and deploy Workers locally with:

```sh
npm run build:vinext
npx @vinext/cloudflare deploy --env staging
npx @vinext/cloudflare deploy
```

Cloudflare’s current Next.js Workers workflow uses vinext; see the [official Next.js Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and [D1 guide](https://developers.cloudflare.com/d1/get-started/).

#!/bin/bash
set -e
export CI=true
echo "Applying migrations to staging..."
npx wrangler d1 migrations apply DB --env staging --remote
echo "Seeding staging database..."
npx tsx scripts/seed-d1.ts --database servicelogme-staging --env staging --remote
echo "Deploying to staging..."
npm run deploy:vinext:staging

echo "Applying migrations to production..."
npx wrangler d1 migrations apply DB --remote
echo "Seeding production database..."
npx tsx scripts/seed-d1.ts --database servicelogme-production --remote
echo "Deploying to production..."
npm run deploy:vinext

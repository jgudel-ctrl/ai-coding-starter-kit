#!/bin/bash
cd "$(dirname "$0")/.."
export SUPABASE_URL=$(grep '^SUPABASE_URL=' .env.production | cut -d= -f2-)
export SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.production | cut -d= -f2-)
export EASYBILL_API_KEY=$(grep '^EASYBILL_API_KEY=' .env.production | cut -d= -f2-)
npx tsx scripts/sync-test-small.ts

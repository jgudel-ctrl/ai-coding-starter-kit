#!/bin/bash
cd "$(dirname "$0")/.."

# Lade API-Key aus .env.production
export EASYBILL_API_KEY=$(grep "^EASYBILL_API_KEY=" .env.production | cut -d= -f2-)

# Starte Sync im Hintergrund
nohup node scripts/sync-full.js > scripts/sync-full.log 2>&1 &
echo "Sync gestartet (PID: $!)"
echo "Log: scripts/sync-full.log"

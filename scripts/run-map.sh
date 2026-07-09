#!/bin/bash
cd "$(dirname "$0")/.."

# Lese API Key aus .env.production
EAK=$(grep "^EASYBILL_API_KEY=" .env.production | sed 's/EASYBILL_API_KEY=//' | tr -d '\n')

export EASYBILL_API_KEY="$EAK"

# Zuerst zählen
echo "=== Zähle Easybill-Kunden ==="
node scripts/count-easybill-customers.js

echo ""
echo "=== Starte vollständiges Mapping ==="
node scripts/map-all-customers.js

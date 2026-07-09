/**
 * Echter Sync-Test — lädt max. 100 Dokumente ab 2023.
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=yyy EASYBILL_API_KEY=zzz npx tsx scripts/sync-test-small.ts
 */

import { syncInvoicesFromEasybill } from "../src/lib/easybill/sync";

async function main() {
  console.log("🚀 Starte kontrollierten Sync-Test (max. 1 Seite ≈ 100 Dokumente)...\n");
  
  const result = await syncInvoicesFromEasybill({
    maxPages: 1,
  });

  console.log("\n✅ Sync abgeschlossen!");
  console.log("   Geladen:", result.documentsFetched);
  console.log("   Gespeichert:", result.documentsInserted);
  console.log("   Aktualisiert:", result.documentsUpdated);
  console.log("   Positionen:", result.itemsInserted);
  console.log("   Zahlungen:", result.paymentsInserted);
  console.log("   Fehler:", result.errors.length);
  if (result.errors.length > 0) {
    console.log("   Erste Fehler:", result.errors.slice(0, 3));
  }
}

main().catch((e) => {
  console.error("❌ Fehler:", e.message);
  process.exit(1);
});

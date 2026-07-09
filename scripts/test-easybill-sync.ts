/**
 * Test-Script für Easybill Invoice-Sync
 * Führt einen kleinen Sync durch (2 Seiten) um die Verbindung zu testen.
 *
 * Usage (mit .env.local):
 *   EASYBILL_API_KEY=xxx npx tsx scripts/test-easybill-sync.ts
 */

import { syncInvoicesFromEasybill } from "../src/lib/easybill/sync";

async function main() {
  console.log("🚀 Teste Easybill Invoice-Sync...\n");

  try {
    const result = await syncInvoicesFromEasybill({ maxPages: 2 });

    console.log("\n✅ Sync-Test erfolgreich!");
    console.log(`   Dokumente geladen: ${result.documentsFetched}`);
    console.log(`   Neu eingefügt:     ${result.documentsInserted}`);
    console.log(`   Aktualisiert:      ${result.documentsUpdated}`);
    console.log(`   Positionen:        ${result.itemsInserted}`);
    console.log(`   Zahlungen:         ${result.paymentsInserted}`);
    console.log(`   Fehler:            ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log("\n⚠️  Fehler:");
      result.errors.forEach((e) => console.log(`   - ${e}`));
    }
  } catch (error) {
    console.error("❌ Sync-Test fehlgeschlagen:", error);
    process.exit(1);
  }
}

main();

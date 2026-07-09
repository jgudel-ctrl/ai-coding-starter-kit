/**
 * Zählt alle Easybill-Kunden
 */
const EAK = process.env.EASYBILL_API_KEY;
if (!EAK) throw new Error('EASYBILL_API_KEY fehlt');

async function main() {
  // Erste Seite = Metadaten
  const res = await fetch('https://api.easybill.de/rest/v1/customers?limit=1', {
    headers: { Authorization: `Bearer ${EAK}` },
  });
  const data = await res.json();
  console.log('Gesamt Kunden:', data.total);
  console.log('Seiten:', data.pages);
}

main().catch(console.error);

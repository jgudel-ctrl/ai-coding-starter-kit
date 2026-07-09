/**
 * Prüft die letzte Seite des Syncs
 */
const EAK = process.env.EASYBILL_API_KEY;

async function main() {
  const res = await fetch('https://api.easybill.de/rest/v1/documents?limit=1&page=141&is_draft=false&type=INVOICE,CREDIT,STORNO,STORNO_CREDIT', {
    headers: { Authorization: `Bearer ${EAK}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  console.log('Seite 141:', data.items?.length || 0, 'Dokumente');
  if (data.items?.[0]) console.log('Letztes:', data.items[0].id, data.items[0].number, data.items[0].document_date);
  console.log('Total pages:', data.pages);
}

main().catch(console.error);

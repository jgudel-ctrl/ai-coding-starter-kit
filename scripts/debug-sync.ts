const EASYBILL_KEY = process.env.EASYBILL_API_KEY;

async function debug() {
  // 1. Prüfe was Easybill als customer_id liefert
  const res = await fetch('https://api.easybill.de/rest/v1/documents?limit=1&page=1300&is_draft=false&type=INVOICE,CREDIT,STORNO,STORNO_CREDIT', {
    headers: { Authorization: 'Bearer ' + EASYBILL_KEY }
  });
  const data = await res.json();
  const doc = data.items[0];
  
  console.log('Dokument:');
  console.log('  id:', doc.id);
  console.log('  customer_id:', doc.customer_id);
  console.log('  customer_number:', doc.customer_number);
  console.log('  number:', doc.number);
  console.log();
  
  // 2. Prüfe Items-Endpoint
  console.log('Items-Endpoint test...');
  const itemsRes = await fetch(`https://api.easybill.de/rest/v1/documents/${doc.id}/items`, {
    headers: { Authorization: 'Bearer ' + EASYBILL_KEY }
  });
  console.log('  Status:', itemsRes.status);
  if (itemsRes.ok) {
    const items = await itemsRes.json();
    console.log('  Anzahl:', items.items?.length || 0);
  } else {
    console.log('  Fehler:', await itemsRes.text());
  }
  console.log();
  
  // 3. Prüfe Payments-Endpoint
  console.log('Payments-Endpoint test...');
  const payRes = await fetch(`https://api.easybill.de/rest/v1/documents/${doc.id}/payments`, {
    headers: { Authorization: 'Bearer ' + EASYBILL_KEY }
  });
  console.log('  Status:', payRes.status);
  if (payRes.ok) {
    const pays = await payRes.json();
    console.log('  Anzahl:', pays.items?.length || 0);
  } else {
    console.log('  Fehler:', await payRes.text());
  }
}

debug().catch(console.error);

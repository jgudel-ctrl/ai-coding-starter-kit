const EASYBILL_KEY = process.env.EASYBILL_API_KEY;

const types = 'INVOICE,CREDIT,STORNO,STORNO_CREDIT';

async function checkPage(page, label) {
  const res = await fetch(`https://api.easybill.de/rest/v1/documents?limit=5&page=${page}&is_draft=false&type=${types}`, {
    headers: { Authorization: 'Bearer ' + EASYBILL_KEY }
  });
  const data = await res.json();
  const docs2023 = data.items.filter(d => new Date(d.document_date).getFullYear() >= 2023);
  console.log(`${label} (Seite ${page}/${data.pages}): ${data.items.length} docs, ${docs2023.length} ab 2023`);
  data.items.forEach(d => {
    console.log(`  ${d.id} ${d.number} ${d.type} ${d.document_date}`);
  });
  return docs2023.length;
}

async function main() {
  // Erste Seite
  await checkPage(1, 'ANFANG');
  console.log();
  
  // Letzte Seite
  const res = await fetch(`https://api.easybill.de/rest/v1/documents?limit=5&page=1&is_draft=false&type=${types}`, {
    headers: { Authorization: 'Bearer ' + EASYBILL_KEY }
  });
  const data = await res.json();
  const lastPage = data.pages;
  
  await checkPage(lastPage, 'ENDE');
  console.log();
  
  // Mitte
  await checkPage(Math.floor(lastPage / 2), 'MITTE');
}

main().catch(console.error);

const EASYBILL_KEY = process.env.EASYBILL_API_KEY;

const types = 'INVOICE,CREDIT,STORNO,STORNO_CREDIT';

async function fetchAndShow(page) {
  const res = await fetch(`https://api.easybill.de/rest/v1/documents?limit=5&page=${page}&is_draft=false&type=${types}`, {
    headers: { Authorization: 'Bearer ' + EASYBILL_KEY }
  });
  const data = await res.json();
  console.log(`Seite ${page}/${data.pages}:`);
  data.items.forEach(d => {
    console.log(`  ${d.id} ${d.number} ${d.type} ${d.document_date} amount=${d.amount_net} paid=${d.paid_amount}`);
  });
}

fetchAndShow(1300).catch(console.error);

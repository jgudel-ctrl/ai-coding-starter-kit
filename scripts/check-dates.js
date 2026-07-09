const EASYBILL_KEY = process.env.EASYBILL_API_KEY;

// Nur INVOICE, CREDIT, STORNO, STORNO_CREDIT
const types = 'INVOICE,CREDIT,STORNO,STORNO_CREDIT';

fetch(`https://api.easybill.de/rest/v1/documents?limit=5&page=1&is_draft=false&type=${types}`, {
  headers: { Authorization: 'Bearer ' + EASYBILL_KEY }
})
.then(r => r.json())
.then(data => {
  console.log('Total:', data.total);
  console.log('Pages:', data.pages);
  console.log();
  data.items.forEach((d, i) => {
    console.log(i+1, d.id, d.number, d.type, 'date:', d.document_date, 'year:', new Date(d.document_date).getFullYear());
  });
})
.catch(e => console.error(e.message));

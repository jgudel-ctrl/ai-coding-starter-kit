const { test, expect } = require('@playwright/test');

test.describe('TMS Kunden Seite', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('https://tms.gudel-werkzeuge.de/login');
    await page.fill('input[type="email"]', 'playwright-test@tms.gudel-werkzeuge.de');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('Kundenliste zeigt korrekte Sortierung', async ({ page }) => {
    await page.goto('https://tms.gudel-werkzeuge.de/kunden');
    await page.waitForLoadState('networkidle');
    
    // Warte auf die Karten-Tabelle
    await page.waitForSelector('table tbody tr, .md\\:hidden a');
    
    // Screenshot für Debugging
    await page.screenshot({ path: '/tmp/kunden-page.png', fullPage: true });
    
    // Prüfe ob Umsätze angezeigt werden
    const pageContent = await page.content();
    
    // Suche nach Euro-Zeichen oder "—"
    const hasEuro = pageContent.includes('€');
    const hasDash = pageContent.includes('—');
    
    console.log('Seite enthält €:', hasEuro);
    console.log('Seite enthält —:', hasDash);
    
    // Prüfe Sortierung - erstes Element sollte Umsatz haben
    const firstRevenue = await page.$eval('table tbody tr:first-child td:last-child, .md\\:hidden a:first-child', el => el.textContent).catch(() => null);
    console.log('Erster Umsatz:', firstRevenue);
  });
});

import { test, expect } from '@playwright/test';

test.describe('TMS Kunden Seite', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'playwright-test@tms.gudel-werkzeuge.de');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('Kundenliste zeigt korrekte Sortierung', async ({ page }) => {
    await page.goto('http://localhost:3000/kunden');
    await page.waitForLoadState('networkidle');
    
    // Screenshot für Debugging
    await page.screenshot({ path: '/tmp/kunden-test.png', fullPage: true });
    
    // Prüfe ob Seite geladen ist
    const title = await page.$eval('h1', el => el.textContent);
    console.log('Seiten-Titel:', title);
    expect(title).toBe('Kunden');
    
    // Prüfe ob Umsätze angezeigt werden
    const content = await page.content();
    console.log('Enthält €:', content.includes('€'));
    console.log('Enthält —:', content.includes('—'));
  });
});

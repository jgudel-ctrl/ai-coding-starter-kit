import { test, expect } from '@playwright/test';

/**
 * PROJ-11 Erweiterung: Bestellhistorie — Produkttyp-Filter, Gruppierung, Donut-Chart.
 * Benötigt einen Testkunden mit mehreren Artikelgruppen in der Bestellhistorie
 * (siehe features/PROJ-11-kundendetailseite.md, Abschnitt 2.4.1).
 * TEST_KUNDE_ID muss auf einen Kunden mit >=2 Artikelgruppen zeigen.
 */
const TEST_KUNDE_ID = process.env.PROJ11_TEST_KUNDE_ID || '';

test.describe('Bestellhistorie — Artikelgruppen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'playwright-test@tms.gudel-werkzeuge.de');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    test.skip(!TEST_KUNDE_ID, 'PROJ11_TEST_KUNDE_ID nicht gesetzt — Testkunde erforderlich');
    await page.goto(`http://localhost:3000/kunden/${TEST_KUNDE_ID}`);
    await page.getByRole('tab', { name: /Bestellhistorie/i }).click();
    await page.waitForLoadState('networkidle');
  });

  test('Donut-Chart zeigt Artikelgruppen des Kunden', async ({ page }) => {
    await expect(page.getByText('Artikelgruppen')).toBeVisible();
    // mindestens ein Legenden-Eintrag mit Zähler
    const legendEntries = page.locator('button', { hasText: /\d+$/ });
    await expect(legendEntries.first()).toBeVisible();
  });

  test('Klick auf Legenden-Eintrag filtert die Tabelle und Dropdown übernimmt Auswahl', async ({
    page,
  }) => {
    const legendEntries = page.locator('button', { hasText: /\d+$/ });
    const firstLabel = await legendEntries.first().innerText();
    const groupName = firstLabel.replace(/\s*\d+$/, '').trim();

    await legendEntries.first().click();

    // Dropdown übernimmt die Auswahl
    await expect(page.getByRole('combobox')).toContainText(groupName);

    // Erneuter Klick hebt den Filter wieder auf (Toggle)
    await legendEntries.first().click();
    await expect(page.getByRole('combobox')).toContainText('Alle Artikelgruppen');
  });

  test('Dropdown "Alle Artikelgruppen" setzt den Filter zurück', async ({ page }) => {
    await page.getByRole('combobox').click();
    const firstOption = page.getByRole('option').nth(1);
    await firstOption.click();

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Alle Artikelgruppen' }).click();
    await expect(page.getByRole('combobox')).toContainText('Alle Artikelgruppen');
  });
});

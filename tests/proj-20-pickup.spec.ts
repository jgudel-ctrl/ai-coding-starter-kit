import { test, expect, type Page } from '@playwright/test';

/**
 * PROJ-20 Regressionstest: "Nächste Abholung" auf der Kundendetailseite.
 * Deckt den Bugfix vom 2026-07-16 ab (siehe features/PROJ-20-logistik-abholung.md):
 * status "geplan" -> "geplant" Tippfehler + falsche Spaltennamen beim Lesen der
 * Kunden-Defaults ließen "Abholung erstellen" fehlschlagen.
 *
 * Läuft gegen die echte Instanz (Login + Supabase erforderlich) — daher hier nicht
 * ausführbar, sondern für den Lauf auf dem Server/CI gedacht: `npm run test:e2e`.
 */

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'playwright-test@tms.gudel-werkzeuge.de');
  await page.fill('input[type="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function openLogistikTab(page: Page) {
  await page.getByRole('tab', { name: /Logistik/i }).click();
  await expect(page.getByText('Nächste Abholung')).toBeVisible();
}

/** Scoped auf die "Nächste Abholung"-Karte, da "Logistik-Defaults" (admin) daneben
 * eine eigene, gleich aufgebaute Karte mit ebenfalls betiteltem "Bearbeiten"-Button hat. */
function nextPickupCard(page: Page) {
  return page.locator('.rounded-lg.border.bg-card', { hasText: 'Nächste Abholung' });
}

test.describe('PROJ-20 — Nächste Abholung im Kunden-Detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Logistik-Tab lädt ohne Fehler und zeigt die Nächste-Abholung-Karte', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/kunden');
    await page.waitForLoadState('networkidle');
    await page.locator('a[href^="/kunden/"]').first().click();
    await page.waitForURL('**/kunden/**');

    await openLogistikTab(page);

    // Karte zeigt entweder eine geplante Abholung ODER den Leer-Zustand — beides ist ok,
    // solange kein Rendering-/Query-Fehler auftritt.
    const hasEmptyState = await page.getByText('Keine Abholung geplant').isVisible().catch(() => false);
    const hasStatusBadge = await page.getByText(/Geplant|Erledigt/i).isVisible().catch(() => false);
    expect(hasEmptyState || hasStatusBadge).toBeTruthy();

    expect(errors, `Console-/Page-Errors gefunden: ${errors.join(' | ')}`).toEqual([]);
  });

  test('Abholung erstellen speichert erfolgreich und erscheint in der Karte', async ({ page }) => {
    await page.goto('/kunden');
    await page.waitForLoadState('networkidle');

    const customerLinks = page.locator('a[href^="/kunden/"]');
    const count = await customerLinks.count();

    // Suche unter den ersten Kunden einen, bei dem "Abholung erstellen" sichtbar ist
    // (kein Abholservice konfiguriert oder bereits eine geplante Tour -> Button fehlt).
    let foundCreateButton = false;
    const maxToCheck = Math.min(count, 15);

    for (let i = 0; i < maxToCheck; i++) {
      await page.goto('/kunden');
      await page.waitForLoadState('networkidle');
      await customerLinks.nth(i).click();
      await page.waitForURL('**/kunden/**');
      await openLogistikTab(page);

      // Vor dem Öffnen des Modals ist der Trigger-Button die einzige Übereinstimmung.
      const createButton = nextPickupCard(page).getByRole('button', { name: 'Abholung erstellen' });
      if (await createButton.isVisible().catch(() => false)) {
        foundCreateButton = true;
        break;
      }
    }

    test.skip(!foundCreateButton, 'Kein Kunde mit Abholservice + ohne geplante Tour gefunden — Test übersprungen.');

    // Modal öffnen
    await nextPickupCard(page).getByRole('button', { name: 'Abholung erstellen' }).click();
    await expect(page.getByText('Neue Abholung erstellen')).toBeVisible();

    // Datum wird automatisch berechnet (calculateNextPickupDate) — warten bis Ladezustand vorbei ist
    await expect(page.getByText('Berechne optimales Datum…')).toBeHidden({ timeout: 10_000 });

    // Ersten verfügbaren Fahrer wählen
    await page.locator('select#driver').selectOption({ index: 1 });

    // Absenden — der Submit-Button steckt im <form>, der Trigger-Button nicht
    await page.locator('form').getByRole('button', { name: 'Abholung erstellen' }).click();

    // Erfolg: Toast statt Fehlermeldung
    await expect(page.getByText('Abholung erstellt')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/fehlgeschlagen|Fehler/i)).not.toBeVisible();

    // Karte zeigt jetzt die neue Abholung statt des Leer-Zustands
    await expect(page.getByText('Keine Abholung geplant')).not.toBeVisible();
    await expect(page.getByText('Geplant', { exact: false })).toBeVisible();

    // Aufräumen: gerade erstellte Test-Abholung wieder löschen, damit der Test wiederholbar bleibt
    page.on('dialog', (dialog) => dialog.accept());
    await nextPickupCard(page).getByRole('button', { name: 'Bearbeiten' }).click();
    await nextPickupCard(page).getByRole('button', { name: 'Abholung löschen' }).click();
    await expect(page.getByText('Keine Abholung geplant')).toBeVisible({ timeout: 10_000 });
  });
});

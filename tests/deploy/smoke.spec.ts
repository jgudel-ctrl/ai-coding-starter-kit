import { test, expect } from '@playwright/test'

/**
 * Post-Deploy Smoke-Test.
 *
 * Läuft NACH dem Deploy gegen die LIVE-URL (nicht gegen einen lokalen Dev-Server).
 * Die Ziel-URL kommt aus DEPLOY_BASE_URL (siehe playwright.deploy.config.ts) und
 * wird von scripts/deploy.sh gesetzt.
 *
 * Zweck: nachweisen, dass der frisch deployte Container wirklich erreichbar ist
 * UND die richtige App ausliefert (nicht nur "irgendeine" 200-Antwort von Traefik
 * oder eine Fehlerseite). Kein Login nötig — läuft ohne Secrets.
 *
 * Feature-spezifische Deploy-Tests kommen als weitere *.spec.ts in dieses
 * Verzeichnis (tests/deploy/). Sie werden automatisch mitgeprüft.
 */
test.describe('Post-Deploy Smoke', () => {
  test('Login-Seite ist erreichbar und liefert HTTP 200', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' })
    expect(response, 'Keine Antwort von /login erhalten').not.toBeNull()
    expect(response!.status(), 'Login-Seite antwortet nicht mit 200').toBe(200)
  })

  test('Es ist wirklich TMS 2.0 (nicht Fehler-/Fremdseite)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Der <title> ist in der Login-Seite fest verdrahtet — eindeutiger Fingerabdruck.
    await expect(page).toHaveTitle(/TMS 2\.0/)

    // Sichtbare Marken-/Kontext-Merkmale der echten App.
    await expect(
      page.getByText('Werkzeug-Management', { exact: false }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Anmelden' }),
    ).toBeVisible()
  })

  test('Login-Formular ist gerendert (App läuft, nicht nur Shell)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Beweist, dass die Client-Komponenten wirklich ausgeliefert und gemountet
    // wurden — eine kaputte Build-/Runtime würde hier ins Leere laufen.
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
})

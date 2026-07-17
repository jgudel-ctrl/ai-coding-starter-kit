import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright-Config NUR für Post-Deploy-Verifikation.
 *
 * Unterschied zur normalen playwright.config.ts:
 *  - kein `webServer` — es wird KEIN lokaler Dev-Server gestartet, sondern die
 *    echte, frisch deployte Live-URL geprüft.
 *  - baseURL kommt aus DEPLOY_BASE_URL (von scripts/deploy.sh gesetzt).
 *  - Screenshot + Trace bei Fehler → dienen als Beweis (siehe deploy.sh-Regel:
 *    "bei Fehler Stopp + Screenshot als Beweis").
 *
 * Aufruf: npm run test:deploy   (bzw. via scripts/deploy.sh)
 */
const baseURL = process.env.DEPLOY_BASE_URL ?? 'https://tms.gudel-werkzeuge.de'

export default defineConfig({
  testDir: './tests/deploy',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Wiederholungen steuert scripts/deploy.sh (max. 5 Anläufe) — hier 0, damit
  // ein Anlauf ein klares Ergebnis liefert.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-deploy' }]],
  outputDir: 'test-results-deploy',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Erlaubt einen system-/vorinstallierten Chromium (z.B. self-hosted CI):
        // PLAYWRIGHT_CHROMIUM_EXECUTABLE=/pfad/zu/chrome. Sonst Playwrights eigener.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
          : {}),
      },
    },
    // Terminal-/Mobile-Tauglichkeit ist ein Kern-Constraint (PRD) — mitprüfen.
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
})

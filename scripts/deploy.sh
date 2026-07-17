#!/usr/bin/env bash
#
# deploy.sh — Deploy + automatische Post-Deploy-Verifikation für TMS 2.0
#
# Aufruf:
#   ./scripts/deploy.sh PROJ-XX
#
# Ablauf:
#   1. Pre-Checks      : npm run lint + npm run build
#   2. Deploy          : docker compose build + up -d  (Traefik routet per Labels)
#   3. Verifikation    : Playwright-Smoke gegen die LIVE-URL, max. 5 Anläufe
#                        - Erfolg  -> "Deployed ✅"
#                        - Fehler  -> Stopp + Screenshot/Trace als Beweis
#
# Stellschrauben (Environment-Variablen, optional):
#   DEPLOY_TARGET        staging | production        (Default: production)
#   DEPLOY_BASE_URL      Ziel-URL für die Verifikation (Default: aus TARGET abgeleitet)
#   MAX_VERIFY_ATTEMPTS  Anzahl Verifikations-Anläufe (Default: 5)
#   SKIP_PRECHECKS=1     Pre-Checks überspringen (z.B. wenn CI sie schon lief)
#   SKIP_DEPLOY=1        Nur verifizieren, nicht neu deployen
#
set -euo pipefail

# --- kleine Helfer für lesbare Ausgabe --------------------------------------
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); RED=$(printf '\033[31m'); GREEN=$(printf '\033[32m')
  YELLOW=$(printf '\033[33m'); BLUE=$(printf '\033[34m'); RESET=$(printf '\033[0m')
else
  BOLD=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi
step()  { echo; echo "${BOLD}${BLUE}▶ $*${RESET}"; }
ok()    { echo "${GREEN}✓ $*${RESET}"; }
warn()  { echo "${YELLOW}! $*${RESET}"; }
fail()  { echo "${RED}✗ $*${RESET}" >&2; }

# --- Argumente prüfen -------------------------------------------------------
FEATURE_ID="${1:-}"
if [ -z "$FEATURE_ID" ]; then
  fail "Feature-ID fehlt. Aufruf: ./scripts/deploy.sh PROJ-XX"
  exit 2
fi
if ! echo "$FEATURE_ID" | grep -Eq '^PROJ-[0-9]+$'; then
  fail "Ungültige Feature-ID '$FEATURE_ID' (erwartet: PROJ-<Zahl>, z.B. PROJ-3)"
  exit 2
fi

# --- ins Projekt-Root wechseln (Skript liegt in scripts/) -------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- Ziel + Verifikations-URL bestimmen -------------------------------------
DEPLOY_TARGET="${DEPLOY_TARGET:-production}"
case "$DEPLOY_TARGET" in
  production) DEFAULT_URL="https://tms.gudel-werkzeuge.de" ;;
  staging)    DEFAULT_URL="https://tms-staging.gudel-werkzeuge.de" ;;
  *) fail "Unbekanntes DEPLOY_TARGET '$DEPLOY_TARGET' (erlaubt: staging|production)"; exit 2 ;;
esac
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:-$DEFAULT_URL}"
MAX_VERIFY_ATTEMPTS="${MAX_VERIFY_ATTEMPTS:-5}"

echo "${BOLD}Deploy $FEATURE_ID → $DEPLOY_TARGET${RESET}"
echo "Verifikations-URL: $DEPLOY_BASE_URL"
echo "Max. Verifikations-Anläufe: $MAX_VERIFY_ATTEMPTS"

# --- 1) Pre-Checks ----------------------------------------------------------
if [ "${SKIP_PRECHECKS:-0}" = "1" ]; then
  warn "Pre-Checks übersprungen (SKIP_PRECHECKS=1)"
else
  step "1/3 Pre-Checks: Lint + Build"
  npm run lint
  ok "Lint sauber"
  npm run build
  ok "Build erfolgreich"
fi

# --- 2) Deploy --------------------------------------------------------------
if [ "${SKIP_DEPLOY:-0}" = "1" ]; then
  warn "Deploy übersprungen (SKIP_DEPLOY=1) — es wird nur verifiziert"
else
  step "2/3 Deploy: Docker-Image bauen und starten"
  if ! command -v docker >/dev/null 2>&1; then
    fail "docker ist auf diesem Host nicht verfügbar — Deploy nur auf dem Hetzner-Host ausführen."
    exit 3
  fi
  docker compose build
  ok "Image gebaut"
  docker compose up -d
  ok "Container gestartet — Traefik routet $DEPLOY_TARGET per Labels"
fi

# --- 3) Post-Deploy-Verifikation (Playwright, max. N Anläufe) ---------------
step "3/3 Verifikation: Playwright-Smoke gegen $DEPLOY_BASE_URL"

attempt=1
verify_ok=0
while [ "$attempt" -le "$MAX_VERIFY_ATTEMPTS" ]; do
  echo
  echo "${BOLD}Anlauf $attempt/$MAX_VERIFY_ATTEMPTS${RESET}"
  if DEPLOY_BASE_URL="$DEPLOY_BASE_URL" npx playwright test --config=playwright.deploy.config.ts; then
    verify_ok=1
    break
  fi
  fail "Anlauf $attempt fehlgeschlagen"
  if [ "$attempt" -lt "$MAX_VERIFY_ATTEMPTS" ]; then
    backoff=$(( attempt * 5 ))
    warn "Warte ${backoff}s (Container läuft evtl. noch warm), dann erneuter Versuch…"
    sleep "$backoff"
  fi
  attempt=$(( attempt + 1 ))
done

echo
if [ "$verify_ok" = "1" ]; then
  ok "${BOLD}Deployed ✅  ($FEATURE_ID → $DEPLOY_TARGET, verifiziert nach $attempt Anlauf/Anläufen)${RESET}"
  echo "Report: playwright-report-deploy/index.html"
  exit 0
else
  fail "${BOLD}Deploy-Verifikation nach $MAX_VERIFY_ATTEMPTS Anläufen fehlgeschlagen — Stopp.${RESET}"
  echo "Beweise (Screenshots/Trace): ${BOLD}test-results-deploy/${RESET}"
  echo "HTML-Report:                 ${BOLD}playwright-report-deploy/index.html${RESET}"
  echo "Nächster Schritt: Fehler analysieren, ggf. per Rollback das letzte funktionierende Image reaktivieren (siehe deploy-Skill)."
  exit 1
fi

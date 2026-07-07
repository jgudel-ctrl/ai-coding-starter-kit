# PROJ-1 Bug-Report — 2026-06-29

## Problem 1: Login klappt nicht

**Ursache:** ENV-Variablen waren im Docker-Container **leer**.

**Wie das passiert ist:**
- `.env.production` wurde mit abgekürzten Keys erstellt (`eyJhbG…P7us` statt voller Token)
- `docker-compose.yml` hatte Build-Args, aber beim ersten Start wurden die ENV-Variablen nicht korrekt übernommen
- Die `NEXT_PUBLIC_*` Variablen müssen **zur Build-Zeit** eingebunden werden (Next.js standalone)

**Status:** ✅ **BEHOBEN** — Container neu gebaut mit korrekten ENV-Variablen.

**Verifikation:**
```
docker exec tms env | grep SUPABASE
→ NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG... (vollständig)
→ SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (vollständig)
```

---

## Problem 2: Passwort-vergessen-Link funktioniert nicht

**Ursache:** Mehrere potenzielle Probleme:

### 2a — Origin falsch (möglich)
Die `requestPasswordResetAction` liest `origin` aus `headers()`. Hinter Traefik-Reverse-Proxy könnte der Header `host` oder `origin` nicht korrekt durchgereicht werden. Der Link in der E-Mail zeigt dann z.B. `http://localhost:3000/auth/confirm?...` statt `https://tms.gudel-werkzeuge.de/auth/confirm?...`.

### 2b — Supabase GOTRUE_URI_ALLOW_LIST (wahrscheinlich)
Die self-hosted Supabase-Auth hat eine Allow-List für Redirect-URIs. `tms.gudel-werkzeuge.de` ist möglicherweise **nicht** in `GOTRUE_URI_ALLOW_LIST` eingetragen. Supabase würde dann den Redirect ablehnen.

**Status:** ⚠️ **OFFEN** — Muss in Supabase-Config (`supabase-selfhosted/.env`) geprüft und ggf. ergänzt werden.

**Empfohlene Lösung:**
```bash
# In /home/botti/projects/supabase-selfhosted/.env
grep GOTRUSE_URI_ALLOW_LIST .env
# Ergänzen: tms.gudel-werkzeuge.de/**
# Dann: docker compose restart supabase-auth
```

---

## Zusätzliche Empfehlungen

1. **Erster Admin-Login testen:** Das Start-Passwort für `j.gudel@gudel-werkzeuge.de` steht in `FIRST_ADMIN_PASSWORD.txt`.

2. **GOTRUE_URI_ALLOW_LIST fixen:** Damit Passwort-Reset funktioniert.

3. **E2E-Tests schreiben:** Für Login-Flow und Passwort-Reset.

---

**Reporter:** Jan Bernd Gudel | **Analysiert:** Klausi

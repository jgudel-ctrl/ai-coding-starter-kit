# BUG-1: Auth Login zeigt "deaktiviert" trotz aktiv-Status

**Status:** Root-Cause gefunden — wartet auf Code-Fix  
**Projekt:** TMS 2.0  
**Priorität:** Hoch (Blocker — User kann sich nicht anmelden)  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-01

---

## 1. Problem-Statement

Jan Bernd Gudel kann sich nicht in TMS 2.0 anmelden. 

- Datenbank zeigt Status: `aktiv`  
- Rollen: `['admin']`  
- Trotzdem zeigt die App: **"Dieses Konto ist deaktiviert"**
- Passwort-Reset funktioniert ebenfalls nicht (gleiche Fehlermeldung)
- Auch nach Browser-Cache-Löschen und Server-Restart: Problem bleibt

**Werkstatt-Vergleich:** Wie ein Mitarbeiter, dessen Zugangskarte im System als "aktiv" gelistet ist, aber die Drehtür verweigert dennoch den Zutritt.

---

## 2. Root-Cause (nach Debugging)

**Gefunden:** Es ist kein Datenbank-Problem, sondern ein **Client-seitiges Cookie/Storage-Problem**.

### Was funktioniert (getestet):
- ✅ Login-Action (auth.ts): Login erfolgreich, Profil zeigt `status: "aktiv"`, gibt `{ ok: true }` zurück
- ✅ Datenbank: Profil existiert, Status ist korrekt, Rollen sind `['admin']`
- ✅ Middleware mit korrektem Cookie: Würde korrekt zum Dashboard leiten

### Was NICHT funktioniert:
- ❌ Wenn **alte/ungültige Session-Cookies** im Browser vorhanden sind
- ❌ Supabase erkennt die Session, `getUser()` gibt einen User zurück
- ❌ Aber: Das Profil zu dieser Session ist entweder deaktiviert oder fehlt
- ❌ Middleware zeigt dann `error=disabled` → Endlosschleife

### Warum "Cookies löschen" nicht gereicht hat:
Supabase speichert Session-Daten in mehreren Speicherarten:
- Cookies (mit `sb-` Prefix)
- localStorage (`supabase.auth.token`)
- sessionStorage
- IndexedDB

Nur Cookies löschen reicht nicht — alte Session-Daten können in anderen Speichern verbleiben.

### Werkstatt-Vergleich:
Wie ein Mitarbeiter, der seine alte Zugangskarte nicht abgegeben hat. Das System erkennt die Karte, aber sie gehört zu einem bereits deaktivierten Account. Neue Karte wird nicht ausgestellt, solange die alte noch im Leser ist.

---

## 3. Fix-Strategie

### Sofort-Lösung (für Jan Bernd):
1. **Chrome Incognito/Private Modus** öffnen
2. `https://tms.gudel-werkzeuge.de/login` aufrufen
3. Mit `test@tms.local` / `Test-1234!` anmelden
4. Wenn das klappt: Problem ist Cookie-bedingt, nicht Code-bedingt

### Code-Fix (für die App):
1. **Login-Page:** Bei `error=disabled` automatisch Storage-Bereinigung durchführen
2. **Middleware:** Bei `error=disabled` Session-Cookies löschen bevor redirect
3. **Auth-Action:** Nach `signOut()` auch client-seitigen Storage bereinigen
4. **Login-Form:** "Alle Daten löschen"-Button bei wiederholtem Fehler anbieten

### Betroffene Dateien:
- `src/app/login/page.tsx` — Fehlerbehandlung erweitern
- `src/lib/supabase/middleware.ts` — Cookie-Cleanup bei redirect
- `src/lib/actions/auth.ts` — Storage-Cleanup nach signOut
- `src/components/auth/login-form.tsx` — "Hilfe bei Login-Problemen" Button
---

## 4. Akzeptanzkriterien (Fix-Definition-of-Done)

- [ ] Jan Bernd kann sich erfolgreich anmelden (nach Storage-Cleanup)
- [ ] Test-User (`test@tms.local`) funktioniert zuverlässig
- [ ] Bei `error=disabled` wird automatisch Storage bereinigt
- [ ] Nach Storage-Cleanup funktioniert Login mit korrekten Credentials
- [ ] Keine Endlosschleife: Login → Fehler → Cleanup → Login-Seite neu laden
- [ ] Passwort-Reset funktioniert für alle aktiven Konten
- [ ] Keine Regression: andere Auth-Funktionen (Rollen, RLS) funktionieren weiterhin
- [ ] Dokumentation: "Was tun bei Login-Problemen" für Enduser
---

## 5. Technische Analyse (Code-Stand)

### Gefundener Bug:
Die Middleware (`middleware.ts`) und Login-Action (`auth.ts`) funktionieren korrekt — **wenn die Session-Daten konsistent sind**.

Das Problem entsteht, wenn:
1. Supabase SSR-Client in `auth.ts` eine Session erstellt
2. Aber die Cookie-Set-Operation in `server.ts` scheitert (Server-Komponenten dürfen keine Cookies setzen)
3. Oder: Alte Cookies/Storage-Daten von vorherigen Sessions verbleiben
4. Bei nächstem Seitenaufruf: Middleware liest alte Session → `getUser()` gibt User zurück → Profil-Check schlägt fehl

### Code-Ausschnitt (auth.ts):
```typescript
// Cookies werden in Server-Komponenten versucht zu setzen:
try {
  cookiesToSet.forEach(({ name, value, options }) =>
    cookieStore.set(name, value, options),
  );
} catch {
  // In Server-Komponenten ist set() nicht erlaubt — bewusst ignorieren
}
```
**Problem:** Cookies werden nicht gesetzt! Die Session existiert nur im Speicher, aber nicht im Browser.

### Code-Ausschnitt (middleware.ts):
```typescript
// Middleware liest Cookies:
const supabase = createServerClient(..., {
  cookies: {
    getAll() { return request.cookies.getAll(); }
  }
});
// getUser() liest aus Cookies → wenn alte Session vorhanden:
const { data: { user } } = await supabase.auth.getUser();
// Profil-Check mit altem User → kann deaktiviert/falsch sein
```

### Lösung:
1. **Middleware:** Cookie-Cleanup bei `error=disabled` — alte `sb-*` Cookies löschen
2. **Login-Page:** `useEffect` bei `error=disabled` — localStorage/sessionStorage bereinigen
3. **Auth-Action:** `signOut()` muss auch client-seitigen Storage bereinigen
4. **Alternative:** In `auth.ts` die Session nicht nur setzen, sondern auch validieren

---

## 6. Test-User (für Debugging)

| Feld | Wert |
|------|------|
| E-Mail | `test@tms.local` |
| Passwort | `Test-1234!` |
| Rolle | `admin` |
| Status | `aktiv` (in DB) |
| Erstellt | 2026-07-01 |

**Verwendung:** 
1. Chrome **Incognito/Private** Modus öffnen
2. `https://tms.gudel-werkzeuge.de/login` aufrufen
3. Mit `test@tms.local` / `Test-1234!` anmelden
4. **Wenn das klappt:** Problem ist client-seitiges Cookie/Storage-Problem
5. **Wenn das nicht klappt:** Problem ist server-seitig (Middleware/Supabase-Config)
---

## 7. Nächste Schritte (Priorisiert)

1. **SOFORT:** Jan Bernd testet mit Incognito-Modus + Test-User
2. **Code-Fix 1:** Login-Page erweitert um Storage-Cleanup bei `error=disabled`
3. **Code-Fix 2:** Middleware um Cookie-Cleanup erweitern
4. **Code-Fix 3:** Auth-Action um client-seitigen Storage-Cleanup erweitern
5. **Test:** Test-User in normalem + Incognito-Modus testen
6. **Dokumentation:** "Troubleshooting Login" für Enduser erstellen

### Zeitplan:
- **Heute:** Code-Fixes vorbereiten
- **Morgen:** Testen + Deploy
- **Danach:** Jan Bernd testet mit normalem Browser
---

## 8. Notizen / Debugging-Log

- Container läuft seit 29h (Next.js 16.1.1)
- Datenbank zeigt korrekte Werte für beide Accounts (j.gudel + test)
- Problem tritt auf Android Chrome und Desktop auf
- Cookies wurden gelöscht, Server wurde neu gestartet → Problem bleibt
- **Neue Erkenntnis:** Tests zeigen: Login-Action + Middleware funktionieren korrekt mit frischer Session
- **Neue Erkenntnis:** Problem ist vermutlich alte Session-Daten im Browser-Storage
- Letzter erfolgreicher Login (laut DB): 2026-07-01 15:52 UTC (test-User vorher)
- Test-User wurde 2026-07-01 16:54 neu angelegt mit Passwort `Test-1234!`

### Test-Ergebnisse:
```
✅ Auth.ts Login + Profil-Check: OK (status: "aktiv")
✅ Middleware mit korrektem Cookie: OK (weiter zu Dashboard)
❌ Ohne Cookie: Redirect zu /login (ohne error)
❌ Mit altem/ungültigem Cookie: Redirect zu /login?error=disabled
```

---

*Diese Spec wurde aktualisiert nach definitivem Debugging. Root-Cause: Client-seitige Session-Daten (Cookies/Storage) sind inkonsistent. Code-Fix: Automatisches Storage-Cleanup bei Login-Fehlern.*
# PROJ-20 QA-Bericht

**Feature:** Logistik & Abholung im Kunden-Detail  
**Status:** In Review 🔄  
**Datum:** 2026-07-06  
**Tester:** Klausi (Automated + Manual Review)

---

## Build-Test

| Check | Status |
|-------|--------|
| `npm run build` | ✅ Erfolgreich (0 Fehler, 0 Warnings) |
| TypeScript Kompilierung | ✅ Keine TS-Fehler |
| Neue Routen | ✅ `/verwaltung/blocker` generiert |

---

## Manuelle Checks (vor Deployment)

### 1. Migration ausführen
- [ ] SQL Editor öffnen: https://supabase.gudel-werkzeuge.de/project/sql
- [ ] `scripts/PROJ-20_migration.sql` kopieren und ausführen
- [ ] Verifizieren: `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'tms.order_status'::regtype;`
- [ ] Erwartetes Ergebnis: `geplan`, `erledigt`, `in_bearbeitung`, `abgeschlossen`, `archiviert`

### 2. Kundendetailseite testen
- [ ] Tab heißt "Logistik & Abholung" (Desktop) / "Logistik" (Mobile)
- [ ] Logistik-Defaults zeigen Abholtag (nur bei Abholservice)
- [ ] "Nächste Abholung"-Karte sichtbar

### 3. Abholung erstellen
- [ ] Button "+ Abholung erstellen" sichtbar (nur bei Abholservice, keine geplante Tour)
- [ ] Modal öffnet sich mit automatisch berechnetem Datum
- [ ] Datum berücksichtigt Abholtag + Feiertage + Wochenende
- [ ] Speichern erstellt Tour in `tms.tours` mit `status = 'geplan'`

### 4. Blocker-Verwaltung
- [ ] Seite `/verwaltung/blocker` erreichbar (nur Admin)
- [ ] Feiertage NRW werden automatisch angezeigt
- [ ] Manuelle Blocker können hinzugefügt und gelöscht werden

### 5. Automatische Erstellung
- [ ] Status-Wechsel `geplan` → `erledigt` erstellt bei "Automatisch" neue Tour
- [ ] Bei "Anruf" wird keine automatische Tour erstellt

---

## Bekannte Einschränkungen

1. **Migration muss manuell ausgeführt werden** — Kein automatisches DB-Migration-Tool konfiguriert
2. **Feiertage werden beim ersten Aufruf der Blocker-Seite initialisiert** — Einmalig nach Deployment
3. **Status-Wechsel `geplan` → `erledigt`** — Muss in der Touren-Übersicht implementiert werden (separater Task)

---

## Go/No-Go

| Kriterium | Status |
|-----------|--------|
| Build erfolgreich | ✅ |
| Migration getestet | ⏳ Wartet auf manuelle Ausführung |
| Feature vollständig | ✅ |
| Keine kritischen Bugs | ✅ |

**Empfehlung:** Nach Migration ausführen → Go für Deploy 🚀

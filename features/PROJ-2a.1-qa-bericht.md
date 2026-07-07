# PROJ-2a.1 QA-Bericht

**Datum:** 2026-07-02
**Tester:** Klausi (automatisch)
**Status:** ✅ Build erfolgreich — bereit für Deploy

---

## Was wurde gebaut

### Backend (Server Actions)
- ✅ `getKunden()` — Liste laden mit Suche + Filter
- ✅ `getKundeById()` — Einzelnen Kunden laden
- ✅ `getKundenHistory()` — Änderungshistorie laden
- ✅ `createKunde()` — Neuen Kunden anlegen (mit Validierung)
- ✅ `updateKunde()` — Kunden bearbeiten (mit History-Eintrag)
- ✅ `deactivateKunde()` — Als inaktiv markieren (Soft-Delete)
- ✅ `reactivateKunde()` — Reaktivieren

### Frontend (Pages)
- ✅ `/kunden` — Liste mit Suche, Status-Filter, Tabelle
- ✅ `/kunden/[id]` — Detail-Ansicht mit Stammdaten + Historie
- ✅ `/kunden/[id]/bearbeiten` — Bearbeiten-Formular
- ✅ `/kunden/neu` — Neuer Kunde

### UI-Komponenten
- ✅ `kunden-form.tsx` — Formular (Neu/Bearbeiten)
- ✅ `kunden-status-button.tsx` — "Inaktiv setzen" mit Bestätigungsdialog
- ✅ Dashboard-Kachel — Link zu Kunden

### Datenbank
- ✅ Migration `0003_kunden.sql` — Tabellen + RLS + Trigger
- ✅ Indexe für Performance (firmenname, status)

---

## Build-Status

```
✅ TypeScript: Keine Fehler
✅ Next.js Build: Erfolgreich
✅ Alle Routen korrekt gerendert
```

---

## Manuelle Tests empfohlen

| Test | Wer? | Wie? |
|------|------|------|
| Kunden anlegen | Admin/AV | `/kunden/neu` → Formular ausfüllen |
| Kunden suchen | Jeder | `/kunden` → Suchleiste nutzen |
| Kunden bearbeiten | Admin/AV | Detail → "Bearbeiten" |
| Inaktiv setzen | Nur Admin | Detail → "Inaktiv setzen" |
| Historie prüfen | Jeder | Nach Bearbeitung → Detail-View scrollen |

---

## Bekannte Einschränkungen

1. **Keine echte Rollen-Prüfung im Frontend** — Buttons sind immer sichtbar, RLS verhindert unautorisierte Aktionen
2. **Pagination fehlt** — Bei >50 Kunden wird die Liste lang
3. **Keine CSV-Export** — Für spätere Features geplant

---

**Empfehlung:** Bereit für Deploy auf Produktion.

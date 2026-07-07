# PROJ-2a.1: Kunden-Stammdaten — Architektur

**Status:** Architektur geschrieben — wartet auf Review/Approval
**Datum:** 2026-07-02
**Autor:** Klausi

---

## 1. Tech Stack & Design-Entscheidungen

| Ebene | Technologie | Begründung |
|-------|-------------|------------|
| **Frontend** | Next.js 14 + React Server Components | Bestehendes Projekt, App Router |
| **Styling** | Tailwind CSS + shadcn/ui | Bestehend, konsistent mit PROJ-1 |
| **State** | React Server Actions (kein Client-State nötig) | Einfach, keine zusätzliche Bibliothek |
| **Datenbank** | Supabase PostgreSQL | Bestehend, RLS bereits konfiguriert |
| **API** | Supabase Client (Server Actions) | Direkte DB-Verbindung, type-safe |

---

## 2. Datenbank-Architektur

### Tabellen (bereits erstellt via Migration 0003)

```
public.kunden
├── id (UUID, PK)
├── firmenname (TEXT, NOT NULL)
├── ansprechpartner_name (TEXT)
├── ansprechpartner_telefon (TEXT)
├── ansprechpartner_email (TEXT)
├── rechnungsadresse_strasse (TEXT)
├── rechnungsadresse_plz (TEXT)
├── rechnungsadresse_ort (TEXT)
├── lieferadresse_strasse (TEXT)
├── lieferadresse_plz (TEXT)
├── lieferadresse_ort (TEXT)
├── notizen (TEXT)
├── status (TEXT, CHECK: aktiv|inaktiv)
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
├── created_by (UUID → profiles.id)
└── updated_by (UUID → profiles.id)

public.kunden_history
├── id (UUID, PK)
├── kunde_id (UUID → kunden.id, CASCADE)
├── feld (TEXT)
├── alter_wert (TEXT)
├── neuer_wert (TEXT)
├── geaendert_von (UUID → profiles.id)
└── geaendert_am (TIMESTAMPTZ)
```

### RLS Policies (bereicht aktiviert)

- **SELECT:** Jeder authentifizierte Nutzer
- **INSERT:** Nur Admin / Arbeitsvorbereitung
- **UPDATE:** Nur Admin / Arbeitsvorbereitung
- **History SELECT:** Jeder authentifizierte Nutzer

---

## 3. Frontend-Architektur

### Pages & Routen

```
/src/app/kunden/page.tsx                 → Kunden-Liste (Server Component)
/src/app/kunden/[id]/page.tsx            → Kunden-Detail (Server Component)
/src/app/kunden/[id]/bearbeiten/page.tsx → Kunden bearbeiten (Server Component)
/src/app/kunden/neu/page.tsx             → Neuer Kunde (Server Component)
```

### Komponenten

```
/src/components/kunden/
├── kunden-table.tsx          → Tabelle mit Sortierung, Filter
├── kunden-search.tsx         → Suchleiste (Client Component)
├── kunden-status-badge.tsx   → Status-Anzeige (aktiv/inaktiv)
├── kunden-form.tsx           → Formular (Neu/Bearbeiten)
├── kunden-detail-card.tsx    → Detail-Ansicht der Stammdaten
├── kunden-history.tsx        → Änderungshistorie
└── kunden-delete-dialog.tsx  → "Inaktiv setzen" Bestätigung
```

### Shared Components (wiederverwendbar)

- `address-display.tsx` → Rechnungs-/Lieferadresse formatiert anzeigen
- `contact-links.tsx` → Telefon (tel:) und E-Mail (mailto:) Links

---

## 4. Backend-Architektur

### Server Actions

```
/src/lib/actions/kunden.ts

├── createKunde(formData: KundeFormData)
│   → INSERT INTO kunden
│   → Setzt created_by = auth.uid()
│
├── updateKunde(id: UUID, formData: KundeFormData)
│   → UPDATE kunden
│   → Setzt updated_by = auth.uid()
│   → Schreibt kunden_history-Eintrag
│
├── setKundeInactive(id: UUID)
│   → UPDATE status = 'inaktiv'
│   → Nur Admin darf (Prüfung via Server Action)
│
├── getKundenList(search?: string, status?: 'aktiv'|'inaktiv'|'alle')
│   → SELECT mit Filter
│
├── getKundeById(id: UUID)
│   → SELECT + JOIN history
│
└── getKundenHistory(kundeId: UUID)
    → SELECT FROM kunden_history ORDER BY geaendert_am DESC
```

### Validierung

```
/src/lib/validations/kunde.ts

→ Zod-Schema für KundeFormData
→ Firmenname: min 1 Zeichen
→ E-Mail: optional, aber validiert falls vorhanden
→ PLZ: optional, nur Zahlen
```

---

## 5. Auth & Berechtigungen

| Aktion | Wer darf? | Wie geprüft? |
|--------|-----------|--------------|
| Kunden ansehen | Alle | RLS Policy (authenticated) |
| Kunden anlegen | Admin, AV | Server Action prüft Rolle |
| Kunden bearbeiten | Admin, AV | Server Action prüft Rolle |
| Kunden inaktiv setzen | Nur Admin | Server Action prüft Rolle |
| History sehen | Alle | RLS Policy (authenticated) |

**Wichtig:** Server Actions prüfen Rollen **zusätzlich** zu RLS (Double-Check).

---

## 6. UI/UX Details

### Kunden-Liste (`/kunden`)
- **Desktop:** Tabelle mit allen Spalten, Pagination
- **Mobile:** Karten-Ansicht (statt Tabelle)
- **Suchleiste:** Echtzeit-Filter nach Firmenname/Ansprechpartner
- **Filter-Tabs:** "Aktive", "Inaktive", "Alle"
- **CTA-Button:** "Neuen Kunden anlegen" (nur für Admin/AV sichtbar)

### Kunden-Detail (`/kunden/[id]`)
- **Karte 1:** Stammdaten (übersichtlich gruppiert)
- **Karte 2:** Rechnungsadresse + Lieferadresse (falls unterschiedlich)
- **Karte 3:** Notizen (mehrzeilig)
- **Karte 4:** Änderungshistorie (einklappbar)
- **Buttons:** "Bearbeiten" (Admin/AV), "Inaktiv setzen" (Admin)

### Formular (`/kunden/neu` und `/kunden/[id]/bearbeiten`)
- **Gruppierung:** Firmendaten | Ansprechpartner | Adressen | Notizen
- **Validierung:** Echtzeit (onBlur) für E-Mail, PLZ
- **Adressen:** Checkbox "Lieferadresse = Rechnungsadresse" (Auto-Fill)
- **Buttons:** Speichern, Abbrechen

---

## 7. Performance & Optimierung

| Maßnahme | Warum |
|----------|-------|
| Index auf `firmenname` | Schnelle Suche |
| Index auf `status` | Filterung nach Status |
| Server Components | Kein Client-State, schnelleres Rendering |
| Pagination (50 pro Seite) | Große Kundenlisten |
| Debounced Suche | Keine unnötigen DB-Queries |

---

## 8. Tests

### Unit Tests (Vitest)
- Validierung: Zod-Schema für gültige/ungültige Daten
- Server Actions: Mocked Supabase-Client

### E2E Tests (Playwright)
- Kunden anlegen (Admin)
- Kunden bearbeiten (Admin/AV)
- Kunden suchen (alle Rollen)
- Kunden inaktiv setzen (nur Admin)
- Validation-Fehler anzeigen

---

## 9. Datei-Struktur (Neue Dateien)

```
src/app/kunden/page.tsx
src/app/kunden/[id]/page.tsx
src/app/kunden/[id]/bearbeiten/page.tsx
src/app/kunden/neu/page.tsx
src/components/kunden/kunden-table.tsx
src/components/kunden/kunden-search.tsx
src/components/kunden/kunden-status-badge.tsx
src/components/kunden/kunden-form.tsx
src/components/kunden/kunden-detail-card.tsx
src/components/kunden/kunden-history.tsx
src/components/kunden/kunden-delete-dialog.tsx
src/components/ui/address-display.tsx
src/components/ui/contact-links.tsx
src/lib/actions/kunden.ts
src/lib/validations/kunde.ts
```

---

## 10. Risiken & Mitigation

| Risiko | Mitigation |
|--------|------------|
| RLS-Policy Konflikt | Double-Check: Server Actions + RLS |
| Mobile UX | Responsive Karten-Ansicht statt Tabelle |
| Historie wird riesig | Kein Problem (wenige Änderungen pro Kunde) |

---

*Diese Architektur folgt dem Workflow aus MEMORY.md: /init → /write-spec → approved → /architecture → User-Review → /frontend → /backend → /qa → /deploy*

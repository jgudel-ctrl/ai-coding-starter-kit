# PROJ-2a.1 Architektur: Kunden-Stammdaten

**Projekt:** TMS 2.0  
**Feature:** PROJ-2a.1 — Kunden-Stammdaten (CRUD + Adressen)  
**Datum:** 2026-07-01  
**Status:** Architektur vorbereitet — wartet auf Approval

---

## 1. Datenbank-Schema

### Neue Tabelle: `kunden`

```sql
CREATE TABLE IF NOT EXISTS public.kunden (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firmenname TEXT NOT NULL,
    ansprechpartner_name TEXT,
    ansprechpartner_telefon TEXT,
    ansprechpartner_email TEXT,
    rechnungsadresse_strasse TEXT,
    rechnungsadresse_plz TEXT,
    rechnungsadresse_ort TEXT,
    lieferadresse_strasse TEXT,
    lieferadresse_plz TEXT,
    lieferadresse_ort TEXT,
    notizen TEXT,
    status TEXT DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'inaktiv')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id)
);

-- Index für schnelle Suche
CREATE INDEX idx_kunden_firmenname ON public.kunden(firmenname);
CREATE INDEX idx_kunden_status ON public.kunden(status);
```

### Neue Tabelle: `kunden_history`

```sql
CREATE TABLE IF NOT EXISTS public.kunden_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kunde_id UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
    feld TEXT NOT NULL,
    alter_wert TEXT,
    neuer_wert TEXT,
    geaendert_von UUID REFERENCES profiles(id),
    geaendert_am TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### RLS (Row Level Security)

```sql
-- Jeder angemeldete Nutzer kann Kunden lesen
CREATE POLICY "Kunden lesen" ON public.kunden
    FOR SELECT USING (auth.role() = 'authenticated');

-- Nur Admin/AV können Kunden anlegen
CREATE POLICY "Kunden anlegen" ON public.kunden
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND roles && ARRAY['admin', 'arbeitsvorbereitung']::text[]
        )
    );

-- Nur Admin/AV können Kunden bearbeiten
CREATE POLICY "Kunden bearbeiten" ON public.kunden
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND roles && ARRAY['admin', 'arbeitsvorbereitung']::text[]
        )
    );

-- Historie: Jeder kann lesen, nur System schreibt
CREATE POLICY "Historie lesen" ON public.kunden_history
    FOR SELECT USING (auth.role() = 'authenticated');
```

---

## 2. API/Actions Design

### Server Actions: `src/lib/actions/kunden.ts`

```typescript
// CREATE
async function createKunde(formData: KundeFormData): Promise<{ ok: boolean; error?: string; id?: string }>

// READ (Liste mit Filter/Suche)
async function getKunden(search?: string, status?: 'aktiv' | 'inaktiv'): Promise<Kunde[]>

// READ (Einzeln)
async function getKundeById(id: string): Promise<Kunde | null>

// UPDATE
async function updateKunde(id: string, formData: KundeFormData): Promise<{ ok: boolean; error?: string }>

// SOFT DELETE (als inaktiv markieren)
async function deactivateKunde(id: string): Promise<{ ok: boolean; error?: string }>

// REACTIVATE (wieder aktivieren)
async function reactivateKunde(id: string): Promise<{ ok: boolean; error?: string }>
```

### Validation: `src/lib/validations/kunde.ts`

```typescript
const kundeSchema = z.object({
  firmenname: z.string().min(1, "Firmenname ist erforderlich").max(200),
  ansprechpartner_name: z.string().max(200).optional(),
  ansprechpartner_telefon: z.string().max(50).optional(),
  ansprechpartner_email: z.string().email().optional(),
  rechnungsadresse_strasse: z.string().max(300).optional(),
  rechnungsadresse_plz: z.string().max(20).optional(),
  rechnungsadresse_ort: z.string().max(200).optional(),
  lieferadresse_strasse: z.string().max(300).optional(),
  lieferadresse_plz: z.string().max(20).optional(),
  lieferadresse_ort: z.string().max(200).optional(),
  notizen: z.string().max(2000).optional(),
});
```

---

## 3. Frontend-Komponenten

### Seitenstruktur:

```
src/app/kunden/
├── page.tsx              # Kunden-Liste (Tabelle + Suche)
├── neu/
│   └── page.tsx          # Neuen Kunden anlegen
└── [id]/
    ├── page.tsx            # Detail-Ansicht (Karte mit Stammdaten)
    └── bearbeiten/
        └── page.tsx        # Kunden bearbeiten
```

### Komponenten:

- `KundenTable` — Tabelle mit Sortierung, Filter, Pagination
- `KundenForm` — Formular für Anlegen/Bearbeiten (alle Felder)
- `KundenDetailCard` — Karte mit Stammdaten auf Detail-Seite
- `KundenSearch` — Suchleiste mit Filter

---

## 4. Datenfluss

```
User öffnet /kunden
  → KundenTable lädt getKunden()
  → Server Action fragt Supabase (RLS prüft Rechte)
  → Tabelle zeigt Kunden an

User klickt "Neuen Kunden anlegen"
  → /kunden/neu
  → KundenForm mit leeren Feldern
  → Submit → createKunde()
  → Redirect zur Detail-Seite

User klickt auf Kunden-Zeile
  → /kunden/[id]
  → KundenDetailCard zeigt Stammdaten
  → Button "Bearbeiten" → /kunden/[id]/bearbeiten
```

---

## 5. Technische Entscheidungen

| Entscheidung | Begründung |
|-------------|-----------|
| **Soft-Delete** (status 'inaktiv') | Historische Aufträge bleiben erhalten, Kunde ist wiederherstellbar |
| **Separate Lieferadresse** | Oft anders als Rechnungsadresse bei Firmen |
| **RLS auf Profil-Rollen** | Nutzt bestehendes Rollensystem, keine neue Logik |
| **History-Tabelle** | Audit-Trail für Änderungen (wer hat wann was geändert) |
| **Server Actions** | Konsistent mit PROJ-1, kein separates API nötig |
| **Zod-Validierung** | Typsicher, gleiche Validierung auf Client + Server |

---

## 6. Risiken & Mitigation

| Risiko | Wahrscheinlichkeit | Lösung |
|--------|-------------------|--------|
| PLZ als String statt Zahl | Niedrig | Deutsche PLZ können mit "0" beginnen, String ist sicherer |
| Lange Firmennamen | Niedrig | Max 200 Zeichen, sollte für alle reichen |
| Performance bei vielen Kunden | Niedrig | Index auf firmenname + status, Pagination |

---

## 7. Nächste Schritte nach Approval

1. **Datenbank-Migration** erstellen (`supabase/migrations/0003_kunden.sql`)
2. **Backend:** Server Actions + Validation
3. **Frontend:** Seiten + Komponenten
4. **Tests:** CRUD-Operationen testen
5. **Deploy:** Auf Server ausrollen

---

**Warte auf Approval** — sag "approved", dann bauen wir! 🛠️

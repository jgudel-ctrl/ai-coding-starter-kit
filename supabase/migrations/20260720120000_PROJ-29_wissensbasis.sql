-- PROJ-29: Wissensbasis (KI-Content-Fundament)
-- Erstellt: 2026-07-20
-- 1) Rollen-Typ um 'redaktion' erweitern
-- 2) Kategorien-Tabelle (Werkzeugart / Material) + Seed
-- 3) Quell-Dokumente-Tabelle (hochgeladene PDFs)
-- 4) Wissens-Einträge-Tabelle
-- 5) RLS-Richtlinien (Redaktion + Admin)
-- 6) Storage-Bucket für die PDFs
--
-- Hinweis: `ALTER TYPE ... ADD VALUE` steht bewusst zuerst und wird in den
-- Policies NICHT als neues Enum-Literal verwendet (Vergleich über text[]),
-- damit die Migration auch in einer einzelnen Transaktion sicher durchläuft.

-- ============================================
-- 1) Rolle 'redaktion' zum user_role-Typ
-- ============================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'redaktion';

-- ============================================
-- 2) Kategorien (Werkzeugart / Material)
-- ============================================
CREATE TABLE IF NOT EXISTS tms.knowledge_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('werkzeugart', 'material')),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT knowledge_categories_kind_name_unique UNIQUE (kind, name)
);

INSERT INTO tms.knowledge_categories (kind, name) VALUES
    ('werkzeugart', 'Säge'),
    ('werkzeugart', 'Fräser'),
    ('werkzeugart', 'Bohrer'),
    ('material', 'Holz'),
    ('material', 'Kunststoff'),
    ('material', 'Aluminium')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================
-- 3) Quell-Dokumente (hochgeladene PDFs)
-- ============================================
CREATE TABLE IF NOT EXISTS tms.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4) Wissens-Einträge
-- ============================================
CREATE TABLE IF NOT EXISTS tms.knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    tool_type TEXT,                 -- Werkzeugart (Kategorie-Name)
    material TEXT,                  -- Material (Kategorie-Name)
    technical_values JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{label,value}]
    description TEXT NOT NULL DEFAULT '',        -- destilliert, eigene Worte
    verbatim_excerpt TEXT NOT NULL DEFAULT '',   -- Originaltext-Auszug (intern)
    source_manufacturer TEXT NOT NULL DEFAULT '',
    source_document TEXT NOT NULL DEFAULT '',
    source_page TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'geprueft')),
    document_id UUID REFERENCES tms.knowledge_documents(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_status ON tms.knowledge_entries(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_tool_type ON tms.knowledge_entries(tool_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_material ON tms.knowledge_entries(material);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_title ON tms.knowledge_entries(title);

-- ============================================
-- 5) RLS — nur Redaktion + Admin
-- ============================================
-- Rollen-Check als wiederverwendbare Helferfunktion (Vergleich über text[],
-- damit kein neues Enum-Literal in der selben Transaktion nötig ist).
CREATE OR REPLACE FUNCTION tms.is_content_manager()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND status = 'aktiv'
          AND (roles::text[] && ARRAY['admin', 'redaktion'])
    );
$$;

ALTER TABLE tms.knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.knowledge_entries ENABLE ROW LEVEL SECURITY;

-- Kategorien: Redaktion/Admin lesen; Admin schreibt (Taxonomie-Pflege)
DROP POLICY IF EXISTS "Kategorien lesen — Redaktion/Admin" ON tms.knowledge_categories;
CREATE POLICY "Kategorien lesen — Redaktion/Admin" ON tms.knowledge_categories
    FOR SELECT TO authenticated USING (tms.is_content_manager());
DROP POLICY IF EXISTS "Kategorien schreiben — Redaktion/Admin" ON tms.knowledge_categories;
CREATE POLICY "Kategorien schreiben — Redaktion/Admin" ON tms.knowledge_categories
    FOR ALL TO authenticated USING (tms.is_content_manager()) WITH CHECK (tms.is_content_manager());

-- Dokumente: Redaktion/Admin voller Zugriff
DROP POLICY IF EXISTS "Dokumente — Redaktion/Admin" ON tms.knowledge_documents;
CREATE POLICY "Dokumente — Redaktion/Admin" ON tms.knowledge_documents
    FOR ALL TO authenticated USING (tms.is_content_manager()) WITH CHECK (tms.is_content_manager());

-- Einträge: Redaktion/Admin voller Zugriff
DROP POLICY IF EXISTS "Einträge — Redaktion/Admin" ON tms.knowledge_entries;
CREATE POLICY "Einträge — Redaktion/Admin" ON tms.knowledge_entries
    FOR ALL TO authenticated USING (tms.is_content_manager()) WITH CHECK (tms.is_content_manager());

-- Server-Actions nutzen den service_role-Client (umgeht RLS) — Rechte sicherstellen.
GRANT ALL ON tms.knowledge_categories TO service_role;
GRANT ALL ON tms.knowledge_documents TO service_role;
GRANT ALL ON tms.knowledge_entries TO service_role;

-- ============================================
-- 6) Storage-Bucket für die Quell-PDFs (privat)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('wissensbasis', 'wissensbasis', false)
ON CONFLICT (id) DO NOTHING;

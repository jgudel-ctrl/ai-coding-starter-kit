-- Security-Fix: RLS für tms.products und tms.customer_groups aktivieren
-- Vorher: RLS deaktiviert + anon hatte volle SELECT/INSERT/UPDATE/DELETE/TRUNCATE-Rechte
-- (anon-Key ist öffentlich, im Frontend sichtbar -> ungeschützter Zugriff auf Produktivdaten)

-- 1) anon-Zugriff vollständig entziehen (kein Anwendungsfall für anonymen Zugriff)
REVOKE ALL ON tms.products FROM anon;
REVOKE ALL ON tms.customer_groups FROM anon;

-- 2) RLS aktivieren
ALTER TABLE tms.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.customer_groups ENABLE ROW LEVEL SECURITY;

-- 3) Alte/wirkungslose Policies bereinigen
DROP POLICY IF EXISTS "service_role_all_products" ON tms.products;
DROP POLICY IF EXISTS "customer_groups_select_all" ON tms.customer_groups;
DROP POLICY IF EXISTS "service_role_all_customer_groups" ON tms.customer_groups;

-- 4) tms.products: alle eingeloggten Nutzer lesen, nur Admin schreibt
CREATE POLICY "products_select_authenticated"
    ON tms.products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "products_write_admin"
    ON tms.products FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND 'admin'::user_role = ANY(roles)
            AND status = 'aktiv'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND 'admin'::user_role = ANY(roles)
            AND status = 'aktiv'
        )
    );

CREATE POLICY "products_service_role_all"
    ON tms.products FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5) tms.customer_groups: gleiche Logik wie products
CREATE POLICY "customer_groups_select_authenticated"
    ON tms.customer_groups FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "customer_groups_write_admin"
    ON tms.customer_groups FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND 'admin'::user_role = ANY(roles)
            AND status = 'aktiv'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND 'admin'::user_role = ANY(roles)
            AND status = 'aktiv'
        )
    );

CREATE POLICY "customer_groups_service_role_all"
    ON tms.customer_groups FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Security-Fix: Privilege-Escalation über user_metadata bei Partner-Tabellen
-- Vorher: admin_all_* Policies prüften user_metadata.role aus dem JWT.
-- user_metadata ist vom Nutzer selbst über auth.updateUser() änderbar ->
-- jeder eingeloggte Nutzer konnte sich selbst zu 'admin' befördern und
-- in tms.partners / partner_contacts / partner_addresses / partner_billing_settings schreiben.
-- Live gegen die Produktivdatenbank nachgewiesen und verifiziert.

-- Korrektur: Admin-Check auf serverseitige public.profiles.roles umstellen
-- (gleiches Muster wie tms.manufacturers, tms.products, tms.customer_groups)

DROP POLICY IF EXISTS "admin_all_partners" ON tms.partners;
CREATE POLICY "admin_all_partners"
    ON tms.partners FOR ALL
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

DROP POLICY IF EXISTS "admin_all_partner_contacts" ON tms.partner_contacts;
CREATE POLICY "admin_all_partner_contacts"
    ON tms.partner_contacts FOR ALL
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

DROP POLICY IF EXISTS "admin_all_partner_addresses" ON tms.partner_addresses;
CREATE POLICY "admin_all_partner_addresses"
    ON tms.partner_addresses FOR ALL
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

DROP POLICY IF EXISTS "admin_all_partner_billing" ON tms.partner_billing_settings;
CREATE POLICY "admin_all_partner_billing"
    ON tms.partner_billing_settings FOR ALL
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

-- Defense in Depth: unnötige anon-Grants entfernen (RLS blockiert anon zwar
-- schon über die Rollen-Zuordnung der Policies, aber die Tabellen-Grants
-- sollten trotzdem minimal sein, kein Anwendungsfall für anonymen Zugriff)
REVOKE ALL ON tms.partners FROM anon;
REVOKE ALL ON tms.partner_contacts FROM anon;
REVOKE ALL ON tms.partner_addresses FROM anon;
REVOKE ALL ON tms.partner_billing_settings FROM anon;

import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getCurrentProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { getManufacturers } from "@/lib/actions/manufacturers";
import { ManufacturerAdminPage } from "@/components/manufacturers/manufacturer-admin-page";

export const metadata: Metadata = {
  title: "Hersteller-Verwaltung — TMS 2.0",
};

export default async function HerstellerPage() {
  const profile = await getCurrentProfile();

  // Nur Admin darf zugreifen
  if (!profile?.roles || !isAdmin(profile.roles)) {
    redirect("/dashboard");
  }

  // Hersteller laden
  const result = await getManufacturers();
  const manufacturers = result.ok ? result.data : [];

  return <ManufacturerAdminPage initialManufacturers={manufacturers} />;
}

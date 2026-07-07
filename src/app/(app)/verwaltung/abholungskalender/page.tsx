import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getBlockedPeriods, initializeHolidays } from "@/lib/actions/blocked-days";
import { PickupCalendar } from "./components/pickup-calendar";

export const metadata = {
  title: "Abholungskalender — TMS 2.0",
};

export default async function AbholungskalenderPage() {
  const profile = await getCurrentProfile();

  // Nur Admin darf zugreifen
  if (!profile?.roles?.includes("admin")) {
    notFound();
  }

  // Initialisiere Feiertage (idempotent)
  await initializeHolidays();

  // Lade Blocker-Zeiträume
  const result = await getBlockedPeriods();
  const blockedPeriods = result.ok ? result.data : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Abholungskalender</h1>
        <p className="text-muted-foreground">
          Feiertage und blockierte Tage im Überblick.
        </p>
      </div>

      <PickupCalendar periods={blockedPeriods} />
    </div>
  );
}

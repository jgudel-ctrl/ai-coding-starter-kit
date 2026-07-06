import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { getBlockedPeriods, initializeHolidays } from "@/lib/actions/blocked-days";
import { BlockedDaysClient } from "./components/blocked-days-client";

export default async function BlockerPage() {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🚫 Blocker-Verwaltung</h1>
          <p className="text-muted-foreground">
            Feiertage und Urlaubstage verwalten — an diesen Tagen finden keine Abholungen statt.
          </p>
        </div>
      </div>

      <BlockedDaysClient initialPeriods={blockedPeriods} />
    </div>
  );
}

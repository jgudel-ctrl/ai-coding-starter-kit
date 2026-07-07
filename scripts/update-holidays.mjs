/**
 * Cron-Script: Feiertage NRW für die nächsten 12 Monate aktualisieren
 * Läuft monatlich via crontab auf dem Server
 * Idempotent: Überspringt bereits existierende Feiertage
 */

import { createClient } from "@supabase/supabase-js";

/* ─────────────── Konfiguration ────────────────────────────────────── */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.gudel-werkzeuge.de";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const SCHEMA = "tms";
const TABLE = "blocked_days";

/* ─────────────── Feiertags-Berechnung ───────────────────────────── */

function calculateEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatISODate(date) {
  return date.toISOString().split("T")[0];
}

function calculateHolidays(year) {
  const easter = calculateEasterSunday(year);

  return [
    { datum: new Date(year, 0, 1), name: "Neujahr" },
    { datum: addDays(easter, -2), name: "Karfreitag" },
    { datum: addDays(easter, 1), name: "Ostermontag" },
    { datum: new Date(year, 4, 1), name: "Tag der Arbeit" },
    { datum: addDays(easter, 39), name: "Christi Himmelfahrt" },
    { datum: addDays(easter, 50), name: "Pfingstmontag" },
    { datum: addDays(easter, 60), name: "Fronleichnam" },
    { datum: new Date(year, 9, 3), name: "Tag der Deutschen Einheit" },
    { datum: new Date(year, 10, 1), name: "Allerheiligen" },
    { datum: new Date(year, 11, 25), name: "1. Weihnachtstag" },
    { datum: new Date(year, 11, 26), name: "2. Weihnachtstag" },
  ];
}

/* ─────────────── Hauptlogik ───────────────────────────────────────── */

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY fehlt");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: SCHEMA },
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear + 1];

  let created = 0;
  let skipped = 0;

  for (const year of years) {
    const holidays = calculateHolidays(year);

    for (const holiday of holidays) {
      const dateStr = formatISODate(holiday.datum);

      // Prüfe ob bereits vorhanden
      const { data: existing } = await supabase
        .schema(SCHEMA)
        .from(TABLE)
        .select("id")
        .eq("von_datum", dateStr)
        .eq("typ", "feiertag")
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Erstelle Feiertag
      const { error } = await supabase
        .schema(SCHEMA)
        .from(TABLE)
        .insert({
          von_datum: dateStr,
          bis_datum: dateStr,
          grund: holiday.name,
          typ: "feiertag",
          erstellt_von: "00000000-0000-0000-0000-000000000000", // System-Cron
        });

      if (error) {
        console.error(`❌ Fehler bei ${dateStr} (${holiday.name}):`, error.message);
      } else {
        created++;
        console.log(`✅ ${dateStr}: ${holiday.name}`);
      }
    }
  }

  console.log(`\n📊 Zusammenfassung: ${created} neu, ${skipped} übersprungen`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});

import { headers } from "next/headers";

/**
 * Öffentliche Basis-URL der App (für Rücklinks in E-Mails, Redirects).
 *
 * Reihenfolge:
 *  1. `APP_URL` (server-seitige Laufzeit-Variable — bewusst NICHT `NEXT_PUBLIC_`,
 *     damit sie nicht zur Build-Zeit eingebacken/leer wird).
 *  2. `x-forwarded-proto`/`x-forwarded-host` (von Traefik gesetzt) — korrekt hinter Proxy.
 *  3. `host`-Header (lokale Entwicklung).
 *
 * So entsteht nie die container-interne Adresse `0.0.0.0:3000` als Rücklink.
 */
export async function getAppOrigin(): Promise<string> {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${proto}://${host}` : "";
}

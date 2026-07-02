"use client";

import { useEffect } from "react";

/**
 * Bereinigt Storage-Daten wenn ein Auth-Fehler aufgetreten ist.
 * Verhindert, dass alte Session-Cookies/Storage-Daten eine Endlosschleife erzeugen.
 */
export function AuthErrorCleanup() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (error === "disabled" || error === "reset_failed") {
      console.log("[AuthCleanup] Bereinige alte Session-Daten...");

      // 1. localStorage bereinigen (Supabase speichert hier Token)
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          localStorage.removeItem(key);
        }
      });

      // 2. sessionStorage bereinigen
      sessionStorage.clear();

      // 3. Cookies bereinigen (Supabase-Cookies mit sb- Prefix)
      document.cookie.split(";").forEach((cookie) => {
        const [name] = cookie.split("=");
        const trimmedName = name.trim();
        if (trimmedName.startsWith("sb-")) {
          // Cookie löschen durch Ablaufen lassen
          document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        }
      });

      console.log("[AuthCleanup] Storage bereinigt.");
    }
  }, []);

  return null;
}

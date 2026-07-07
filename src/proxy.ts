import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next 16: "proxy" ersetzt das frühere "middleware"-File.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Alle Pfade außer statischen Assets / Bildern. So läuft der Routenschutz
     * für jede Seite, ohne Next-Interna oder das Logo unnötig zu prüfen.
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

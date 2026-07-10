import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next 16: "proxy" ersetzt das frühere "middleware"-File.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Alle Pfade außer statischen Assets / Bildern / Webhooks.
     * Webhooks dürfen keine Auth-Prüfung durchlaufen.
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

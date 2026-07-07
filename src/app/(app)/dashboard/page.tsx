import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Wrench, Building2 } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rolesLabel, isAdmin } from "@/lib/roles";
import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Start — TMS 2.0",
};

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const firstName = (profile.full_name || profile.email).split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Willkommen, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Angemeldet als {rolesLabel(profile.roles)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAdmin(profile.roles) && (
          <Link href="/verwaltung/nutzer" className="group">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <CardTitle className="text-base">Nutzerverwaltung</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Mitarbeiter anlegen, Rollen vergeben und Konten verwalten.
              </CardContent>
            </Card>
          </Link>
        )}

        <Link href="/kunden" className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <CardTitle className="text-base">Kunden</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Kunden-Stammdaten verwalten, Ansprechpartner und Adressen pflegen.
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full border-dashed">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Wrench className="h-5 w-5" />
            </span>
            <CardTitle className="text-base text-muted-foreground">
              Werkzeug-Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Folgt in den nächsten Features (PROJ-2 / PROJ-3).
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

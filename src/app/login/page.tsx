import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { AuthErrorCleanup } from "@/components/auth/auth-error-cleanup";

export const metadata: Metadata = {
  title: "Anmelden — TMS 2.0",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <AuthErrorCleanup />
      <Card className="w-full max-w-md overflow-hidden border-border shadow-md">
        {/* Korallen-Markenfläche mit weißem Logo (design-system.md §6) */}
        <div className="flex flex-col items-center gap-3 bg-primary px-6 py-10 text-primary-foreground">
          <Image
            src="/logo.svg"
            alt="TMS 2.0"
            width={96}
            height={96}
            priority
            className="h-20 w-20"
          />
          <p className="text-sm font-medium tracking-wide text-primary-foreground/90">
            Werkzeug-Management
          </p>
        </div>

        <CardContent className="space-y-6 p-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold text-foreground">Anmelden</h1>
            <p className="text-sm text-muted-foreground">
              Mit deiner Firmen-E-Mail und deinem Passwort.
            </p>
          </div>
          {error === "disabled" && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              Dieses Konto ist deaktiviert. Bitte wende dich an deine Verwaltung.
            </p>
          )}
          {error === "reset_failed" && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              Der Link zum Zurücksetzen ist ungültig oder abgelaufen. Bitte fordere
              einen neuen an.
            </p>
          )}
          <LoginForm />
          <div className="space-y-2 text-center">
            <Link
              href="/passwort-vergessen"
              className="text-sm font-medium text-primary hover:underline"
            >
              Passwort vergessen?
            </Link>
            <p className="text-xs text-muted-foreground">
              Kein Zugang? Wende dich an deine Verwaltung — Konten werden zentral angelegt.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

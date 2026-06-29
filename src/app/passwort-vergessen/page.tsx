import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Passwort vergessen — TMS 2.0",
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Passwort vergessen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gib deine E-Mail ein — wir senden dir einen Link zum Zurücksetzen.
          </p>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}

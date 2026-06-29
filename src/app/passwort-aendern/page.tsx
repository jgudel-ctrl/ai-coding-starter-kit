import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = {
  title: "Passwort ändern — TMS 2.0",
};

export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Passwort ändern</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bitte lege ein eigenes Passwort fest, bevor es weitergeht.
          </p>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}

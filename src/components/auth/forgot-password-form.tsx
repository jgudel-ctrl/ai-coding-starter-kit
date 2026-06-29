"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { resetRequestSchema, type ResetRequestInput } from "@/lib/validations/auth";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetRequestInput) {
    setLoading(true);
    try {
      const result = await requestPasswordResetAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
    } catch {
      toast.error("Etwas ist schiefgelaufen. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-xl bg-secondary/10 px-4 py-3 text-sm text-foreground">
          Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum
          Zurücksetzen verschickt. Bitte prüfe dein Postfach.
        </p>
        <Button asChild variant="outline" className="h-12 w-full text-base">
          <Link href="/login">Zurück zur Anmeldung</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@gudel-werkzeuge.de"
                  className="h-12 text-base"
                  disabled={loading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Link zum Zurücksetzen senden
        </Button>
        <Button asChild variant="ghost" className="h-11 w-full">
          <Link href="/login">Zurück zur Anmeldung</Link>
        </Button>
      </form>
    </Form>
  );
}

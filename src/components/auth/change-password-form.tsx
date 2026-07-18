"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  changePasswordSchema,
  type ChangePasswordInput,
  PASSWORD_MIN,
} from "@/lib/validations/auth";
import { changePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    setLoading(true);
    try {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        toast.error(result.error);
        setLoading(false);
        return;
      }
      toast.success("Passwort gespeichert.");
      // Voller Reload (kein router.push), damit Session-Cookies greifen.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = "/dashboard";
    } catch {
      toast.error("Konnte das Passwort nicht ändern. Bitte erneut versuchen.");
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Neues Passwort</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className="h-12 text-base"
                  disabled={loading}
                  {...field}
                />
              </FormControl>
              <FormDescription>Mindestens {PASSWORD_MIN} Zeichen.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort wiederholen</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
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
          Passwort speichern
        </Button>
      </form>
    </Form>
  );
}

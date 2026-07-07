"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { createUserSchema, type CreateUserInput, PASSWORD_MIN } from "@/lib/validations/auth";
import { USER_ROLES, ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function CreateUserDialog({
  onCreate,
}: {
  onCreate: (values: CreateUserInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", fullName: "", roles: ["werker"], password: "" },
  });

  async function onSubmit(values: CreateUserInput) {
    setLoading(true);
    try {
      const res = await onCreate(values);
      if (res.ok) {
        form.reset();
        setOpen(false);
      } else if (res.error) {
        toast.error(res.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 gap-2">
          <UserPlus className="h-4 w-4" />
          Nutzer anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nutzer anlegen</DialogTitle>
          <DialogDescription>
            Konto mit Start-Passwort anlegen. Der Mitarbeiter ändert es beim ersten Login.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input className="h-11" disabled={loading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input type="email" className="h-11" disabled={loading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rollen</FormLabel>
                  <FormDescription>Mehrfachauswahl möglich.</FormDescription>
                  <div className="grid grid-cols-2 gap-2">
                    {USER_ROLES.map((role) => {
                      const checked = field.value?.includes(role);
                      return (
                        <label
                          key={role}
                          className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={loading}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c
                                  ? [...(field.value ?? []), role]
                                  : (field.value ?? []).filter((r) => r !== role),
                              )
                            }
                          />
                          {ROLE_LABELS[role]}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start-Passwort</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="off"
                      className="h-11"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Mindestens {PASSWORD_MIN} Zeichen. Dem Mitarbeiter persönlich übergeben.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Anlegen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

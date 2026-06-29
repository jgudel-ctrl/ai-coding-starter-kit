"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { USER_ROLES, ROLE_LABELS, type UserRole, type UserStatus } from "@/lib/roles";
import {
  createUserAction,
  updateRoleAction,
  toggleStatusAction,
  resetPasswordAction,
} from "@/lib/actions/users";
import type { CreateUserInput } from "@/lib/validations/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateUserDialog } from "@/components/users/create-user-dialog";

export interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
}

export function UserManagement({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resetInfo, setResetInfo] = useState<{ name: string; password: string } | null>(null);

  async function handleCreate(values: CreateUserInput) {
    const res = await createUserAction(values);
    if (res.ok) {
      toast.success(`${values.fullName} angelegt — Start-Passwort übergeben.`);
      router.refresh();
    }
    return res;
  }

  function handleRoleChange(userId: string, role: UserRole) {
    startTransition(async () => {
      const res = await updateRoleAction(userId, role);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function handleStatusToggle(userId: string) {
    startTransition(async () => {
      const res = await toggleStatusAction(userId);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function handleResetPassword(user: ManagedUser) {
    startTransition(async () => {
      const res = await resetPasswordAction(user.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResetInfo({ name: user.fullName, password: res.password });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Nutzerverwaltung</h1>
          <p className="text-sm text-muted-foreground">
            {initialUsers.length} Mitarbeiter · Konten werden hier zentral angelegt.
          </p>
        </div>
        <CreateUserDialog onCreate={handleCreate} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mitarbeiter</TableHead>
              <TableHead className="w-56">Rolle</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-12 text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialUsers.map((user) => {
              const deactivated = user.status === "deaktiviert";
              const isSelf = user.id === currentUserId;
              return (
                <TableRow key={user.id} className={cn(deactivated && "opacity-55")}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {user.fullName}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (du)
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                      {user.mustChangePassword && (
                        <Badge
                          variant="outline"
                          className="mt-1 w-fit border-secondary text-secondary"
                        >
                          Passwortwechsel offen
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      disabled={pending}
                      onValueChange={(v) => handleRoleChange(user.id, v as UserRole)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={user.status === "aktiv"}
                        disabled={pending}
                        onCheckedChange={() => handleStatusToggle(user.id)}
                        aria-label="Konto aktiv"
                      />
                      <span
                        className={cn(
                          "text-sm",
                          deactivated ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {deactivated ? "deaktiviert" : "aktiv"}
                      </span>
                    </label>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      title="Neues Start-Passwort setzen"
                      disabled={pending}
                      onClick={() => handleResetPassword(user)}
                    >
                      <KeyRound className="h-4 w-4" />
                      <span className="sr-only">Neues Start-Passwort setzen</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!resetInfo} onOpenChange={(o) => !o && setResetInfo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Start-Passwort</DialogTitle>
            <DialogDescription>
              Für {resetInfo?.name}. Persönlich übergeben — es wird nur einmal angezeigt.
              Der Mitarbeiter ändert es beim nächsten Login.
            </DialogDescription>
          </DialogHeader>
          <code className="block select-all rounded-xl bg-muted px-4 py-3 text-center text-lg font-semibold tracking-wide">
            {resetInfo?.password}
          </code>
        </DialogContent>
      </Dialog>
    </div>
  );
}

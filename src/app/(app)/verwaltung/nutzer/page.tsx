import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { UserManagement } from "@/components/users/user-management";
import type { ManagedUser } from "@/components/users/user-management";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { UserRole, UserStatus } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Nutzerverwaltung — TMS 2.0",
};

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  must_change_password: boolean;
}

export default async function UserAdminPage() {
  // Zugriffsschutz (Middleware schützt zusätzlich serverseitig).
  const me = await getCurrentProfile();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, must_change_password")
    .order("full_name", { ascending: true });

  const users: ManagedUser[] = ((data as ProfileRow[]) ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name || p.email,
    email: p.email,
    role: p.role,
    status: p.status,
    mustChangePassword: p.must_change_password,
  }));

  return <UserManagement initialUsers={users} currentUserId={me.id} />;
}

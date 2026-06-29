import { redirect } from "next/navigation";

import { AppHeader, type CurrentUser } from "@/components/app-header";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();
  // Doppelte Absicherung zusätzlich zur Middleware.
  if (!profile) redirect("/login");

  const user: CurrentUser = {
    fullName: profile.full_name || profile.email,
    email: profile.email,
    role: profile.role,
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

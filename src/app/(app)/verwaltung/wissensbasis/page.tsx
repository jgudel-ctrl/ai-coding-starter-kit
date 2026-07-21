import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getCurrentProfile } from "@/lib/supabase/server";
import { canManageContent } from "@/lib/roles";
import {
  getKnowledgeEntries,
  getKnowledgeCategories,
} from "@/lib/actions/wissensbasis";
import { WissensbasisAdminPage } from "@/components/wissensbasis/wissensbasis-admin-page";

export const metadata: Metadata = {
  title: "Wissensbasis — TMS 2.0",
};

export default async function WissensbasisPage() {
  const profile = await getCurrentProfile();

  // Nur Redaktion oder Admin dürfen zugreifen.
  if (!profile?.roles || !canManageContent(profile.roles)) {
    redirect("/dashboard");
  }

  const [entriesResult, categoriesResult] = await Promise.all([
    getKnowledgeEntries(),
    getKnowledgeCategories(),
  ]);

  return (
    <WissensbasisAdminPage
      initialEntries={entriesResult.ok ? entriesResult.data : []}
      categories={
        categoriesResult.ok
          ? categoriesResult.data
          : { toolTypes: [], materials: [] }
      }
    />
  );
}

import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getCurrentProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import {
  getProducts,
  getManufacturers,
  getPositionGroups,
  getProductStatsByType,
} from "@/lib/actions/manufacturers";
import { ProductOverviewPage } from "@/components/manufacturers/product-overview-page";

export const metadata: Metadata = {
  title: "Artikel-Übersicht — TMS 2.0",
};

export default async function ArtikelPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const isAdminUser = isAdmin(profile.roles);

  // Artikel laden
  const productsResult = await getProducts({ page: 1, pageSize: 50 });
  const products = productsResult.ok ? productsResult.data : [];
  const total = productsResult.ok ? productsResult.total : 0;

  // Hersteller laden (für Filter + Dropdowns)
  const manufacturersResult = await getManufacturers();
  const manufacturers = manufacturersResult.ok ? manufacturersResult.data : [];

  // Rabattgruppen laden
  const groupsResult = await getPositionGroups();
  const groups = groupsResult.ok ? groupsResult.data : [];

  // Statistik: Artikel vs Service
  const statsResult = await getProductStatsByType();
  const stats = statsResult.ok ? statsResult.data : [];

  return (
    <ProductOverviewPage
      initialProducts={products}
      initialTotal={total}
      initialManufacturers={manufacturers}
      initialGroups={groups}
      initialStats={stats}
      isAdmin={isAdminUser}
    />
  );
}

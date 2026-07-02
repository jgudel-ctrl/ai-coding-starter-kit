import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getPartnerById } from "@/lib/actions/partners";
import { getPartnerRevenue } from "@/lib/actions/revenue";
import { TabContainer } from "./components/tab-container";
import { AddressCard } from "./components/address-card";
import { ContactsList } from "./components/contacts-list";
import { RevenueChart } from "./components/revenue-chart";
import { RevenueSummary } from "./components/revenue-summary";
import { OrderHistoryTable } from "./components/order-history-table";

export default async function KundeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPartnerById(id);

  if (!result.ok) {
    notFound();
  }

  const { partner, addresses, contacts } = result;

  // Rechnungsadresse finden
  const rechnungsAdresse = addresses.find(
    (a) => a.address_type === "billing" || a.is_default
  );

  // Lieferadresse finden
  const lieferAdresse = addresses.find(
    (a) => a.address_type === "shipping"
  );

  // Umsatz-Daten laden (aktuelles Jahr)
  const currentYear = new Date().getFullYear();
  const revenueResult = await getPartnerRevenue(id, currentYear);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {partner.company_name || partner.display_name}
          </h1>
          <p className="text-muted-foreground">
            Status:{" "}
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                partner.is_active && !partner.is_archived
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {partner.is_active && !partner.is_archived ? "aktiv" : "inaktiv"}
            </span>
            {partner.partner_number && (
              <span className="ml-2 text-muted-foreground">
                Kunden-Nr.: {partner.partner_number}
              </span>
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/kunden">← Zurück zur Liste</Link>
        </Button>
      </div>

      {/* Tabs */}
      <TabContainer
        children={{
          overview: (
            <OverviewTab
              partner={partner}
              rechnungsAdresse={rechnungsAdresse}
              lieferAdresse={lieferAdresse}
              contacts={contacts}
              partnerId={id}
            />
          ),
          revenue: (
            <RevenueTab
              partnerId={id}
              revenueData={revenueResult.ok ? revenueResult.data : []}
            />
          ),
          orders: <OrderHistoryTab partnerId={id} />,
        }}
      />
    </div>
  );
}

/* ────────────────────── ÜBERSICHT TAB ────────────────────── */

function OverviewTab({
  partner,
  rechnungsAdresse,
  lieferAdresse,
  contacts,
  partnerId,
}: {
  partner: any;
  rechnungsAdresse: any;
  lieferAdresse: any;
  contacts: any[];
  partnerId: string;
}) {
  return (
    <div className="space-y-6">
      {/* Bento Grid — Obere Reihe: Stammdaten + Adressen */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Stammdaten */}
        <div className="md:col-span-1 rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">Stammdaten</h3>
          <div className="space-y-2 text-sm">
            {partner.company_name && partner.company_name !== partner.display_name && (
              <p>
                <span className="text-muted-foreground">Firma:</span>{" "}
                {partner.company_name}
              </p>
            )}
            {partner.first_name && (
              <p>
                <span className="text-muted-foreground">Vorname:</span>{" "}
                {partner.first_name}
              </p>
            )}
            {partner.last_name && (
              <p>
                <span className="text-muted-foreground">Nachname:</span>{" "}
                {partner.last_name}
              </p>
            )}
            {partner.vat_identifier && (
              <p>
                <span className="text-muted-foreground">USt-ID:</span>{" "}
                {partner.vat_identifier}
              </p>
            )}
            {partner.tax_number && (
              <p>
                <span className="text-muted-foreground">Steuernummer:</span>{" "}
                {partner.tax_number}
              </p>
            )}
            {partner.email && (
              <p>
                <span className="text-muted-foreground">E-Mail:</span>{" "}
                <a href={`mailto:${partner.email}`} className="text-primary hover:underline">
                  {partner.email}
                </a>
              </p>
            )}
            {partner.phone && (
              <p>
                <span className="text-muted-foreground">Telefon:</span>{" "}
                <a href={`tel:${partner.phone}`} className="text-primary hover:underline">
                  {partner.phone}
                </a>
              </p>
            )}
            {partner.mobile && (
              <p>
                <span className="text-muted-foreground">Mobil:</span>{" "}
                <a href={`tel:${partner.mobile}`} className="text-primary hover:underline">
                  {partner.mobile}
                </a>
              </p>
            )}
            {partner.website && (
              <p>
                <span className="text-muted-foreground">Web:</span>{" "}
                <a
                  href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {partner.website}
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Rechnungsadresse */}
        <AddressCard title="Rechnungsadresse" address={rechnungsAdresse} />

        {/* Lieferadresse */}
        <AddressCard title="Lieferadresse" address={lieferAdresse} />
      </div>

      {/* Bento Grid — Untere Reihe: Kontakte */}
      <ContactsList partnerId={partnerId} contacts={contacts} />
    </div>
  );
}

/* ────────────────────── UMSATZ TAB ────────────────────── */

function RevenueTab({
  partnerId,
  revenueData,
}: {
  partnerId: string;
  revenueData: any[];
}) {
  return (
    <div className="space-y-6">
      <RevenueSummary data={revenueData} />
      <RevenueChart partnerId={partnerId} />
    </div>
  );
}

/* ────────────────────── BESTELLHISTORIE TAB ────────────────────── */

function OrderHistoryTab({ partnerId }: { partnerId: string }) {
  return <OrderHistoryTable partnerId={partnerId} />;
}

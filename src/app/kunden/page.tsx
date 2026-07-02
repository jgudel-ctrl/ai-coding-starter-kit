import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPartners } from "@/lib/actions/partners";

export const metadata = {
  title: "Kunden — TMS 2.0",
  description: "Kunden-Verwaltung",
};

function StatusFilter({ current }: { current?: string }) {
  const filters = [
    { label: "Alle", value: undefined },
    { label: "Aktive", value: "aktiv" },
    { label: "Inaktive", value: "inaktiv" },
  ];

  return (
    <div className="flex gap-2">
      {filters.map((f) => (
        <Button
          key={f.label}
          asChild
          variant={current === f.value || (!current && !f.value) ? "default" : "outline"}
          size="sm"
        >
          <Link href={f.value ? `?status=${f.value}` : "/kunden"}>
            {f.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

export default async function KundenPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = typeof searchParams.search === "string" ? searchParams.search : undefined;
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;

  const result = await getPartners(search, status as "aktiv" | "inaktiv");

  if (!result.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive">Fehler beim Laden der Kunden: {result.error}</p>
      </div>
    );
  }

  const partners = result.data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kunden</h1>
          <p className="text-muted-foreground">
            {partners.length} von 2.590 Kunden angezeigt
          </p>
        </div>
      </div>

      {/* Filter + Suche */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <StatusFilter current={status} />
        <form className="flex gap-4" method="GET">
          {status && <input type="hidden" name="status" value={status} />}
          <Input
            name="search"
            defaultValue={search}
            placeholder="Nach Firmenname oder Ansprechpartner suchen..."
            className="max-w-md"
          />
          <Button type="submit" variant="secondary">
            Suchen
          </Button>
        </form>
      </div>

      {/* Tabelle */}
      {partners.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Keine Kunden gefunden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Kunden-Nr.</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Ansprechpartner</th>
                <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                <th className="px-4 py-3 text-left font-medium">Telefon</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {partners.map((partner) => (
                <tr
                  key={partner.id}
                  className="hover:bg-muted/50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {partner.easybill_customer_number || partner.partner_number || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/kunden/${partner.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {partner.company_name || partner.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {partner.first_name || partner.last_name
                      ? `${partner.first_name || ""} ${partner.last_name || ""}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {partner.email ? (
                      <a
                        href={`mailto:${partner.email}`}
                        className="text-primary hover:underline"
                      >
                        {partner.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {partner.phone || partner.mobile ? (
                      <a
                        href={`tel:${partner.phone || partner.mobile}`}
                        className="text-primary hover:underline"
                      >
                        {partner.phone || partner.mobile}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        partner.is_active && !partner.is_archived
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {partner.is_active && !partner.is_archived ? "aktiv" : "inaktiv"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

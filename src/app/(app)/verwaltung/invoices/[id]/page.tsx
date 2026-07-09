/**
 * Invoice Detail Page
 * Zeigt alle Details einer Rechnung: Kopfdaten, Positionen, Zahlungen.
 */

import { getInvoiceById } from "@/lib/actions/invoices";
import { notFound } from "next/navigation";
import { PaymentStatusBadge } from "../components/payment-status-badge";
import { formatCent } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const typeLabels: Record<string, string> = {
  INVOICE: "Rechnung",
  CREDIT: "Gutschrift",
  STORNO: "Storno",
  STORNO_CREDIT: "Storno-Gutschrift",
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("de-DE");
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getInvoiceById(Number(id));

  if (!result.ok) return notFound();
  const invoice = result.invoice;

  // Offener Betrag berechnen
  const openAmount = invoice.amount - invoice.paid_amount;

  return (
    <div className="space-y-6">
      {/* Zurück-Button */}
      <Button variant="outline" size="sm" asChild>
        <Link href="/verwaltung/invoices">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zur Übersicht
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {typeLabels[invoice.type] || invoice.type} {invoice.invoice_number}
          </h1>
          <p className="text-muted-foreground">
            {invoice.partner_id ? (
              <Link href={`/kunden/${invoice.partner_id}`} className="hover:underline text-primary">
                {invoice.partner_name || "Kunde anzeigen"}
              </Link>
            ) : invoice.partner_name ? (
              invoice.partner_name
            ) : (
              "Kein Kunde zugeordnet"
            )}
            {invoice.customer_id && (
              <span className="text-sm">
                {" "}
                (Easybill ID: {invoice.customer_id})
              </span>
            )}
          </p>
        </div>
        <PaymentStatusBadge status={invoice.payment_status} />
      </div>

      {/* Beträge */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Brutto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCent(invoice.amount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Netto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCent(invoice.amount_net)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bezahlt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCent(invoice.paid_amount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Offen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                openAmount > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {formatCent(openAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Linke Spalte: Rechnungsdaten */}
        <Card>
          <CardHeader>
            <CardTitle>Rechnungsdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rechnungsdatum:</span>
              <span>{formatDate(invoice.document_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fälligkeitsdatum:</span>
              <span>{formatDate(invoice.due_date)}</span>
            </div>
            {invoice.paid_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bezahlt am:</span>
                <span>{formatDate(invoice.paid_at)}</span>
              </div>
            )}
            {invoice.order_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bestellnummer:</span>
                <span>{invoice.order_number}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Währung:</span>
              <span>{invoice.currency}</span>
            </div>
          </CardContent>
        </Card>

        {/* Rechte Spalte: Kundenadresse */}
        <Card>
          <CardHeader>
            <CardTitle>Kunde</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.address ? (
              <div className="space-y-1">
                <p className="font-medium">
                  {invoice.address.company_name ||
                    `${invoice.address.first_name || ""} ${invoice.address.last_name || ""}`.trim()}
                </p>
                {invoice.address.street && <p>{invoice.address.street}</p>}
                {invoice.address.zip_code && invoice.address.city && (
                  <p>
                    {invoice.address.zip_code} {invoice.address.city}
                  </p>
                )}
                {invoice.address.country && <p>{invoice.address.country}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground">Keine Adresse hinterlegt.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Positionen */}
      <Card>
        <CardHeader>
          <CardTitle>Positionen ({invoice.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Pos</th>
                    <th className="text-left py-2 px-2">Artikelnr.</th>
                    <th className="text-left py-2 px-2">Beschreibung</th>
                    <th className="text-right py-2 px-2">Menge</th>
                    <th className="text-right py-2 px-2">Einzelpreis</th>
                    <th className="text-right py-2 px-2">Gesamt</th>
                    <th className="text-right py-2 px-2">MwSt.</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">{item.position}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {item.article_number || "—"}
                      </td>
                      <td className="py-2 px-2">{item.description}</td>
                      <td className="text-right py-2 px-2">
                        {item.quantity} {item.unit || ""}
                      </td>
                      <td className="text-right py-2 px-2">
                        {formatCent(item.single_price_net)}
                      </td>
                      <td className="text-right py-2 px-2 font-medium">
                        {formatCent(item.total_price_net)}
                      </td>
                      <td className="text-right py-2 px-2 text-muted-foreground">
                        {item.vat_percent ? `${item.vat_percent}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">Keine Positionen vorhanden.</p>
          )}
        </CardContent>
      </Card>

      {/* Zahlungen */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zahlungen ({invoice.payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Datum</th>
                    <th className="text-left py-2 px-2">Zahlungsart</th>
                    <th className="text-right py-2 px-2">Betrag</th>
                    <th className="text-left py-2 px-2">Referenz</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b hover:bg-muted/50"
                    >
                      <td className="py-2 px-2">
                        {formatDate(payment.payment_at)}
                      </td>
                      <td className="py-2 px-2">
                        {payment.payment_type || "—"}
                      </td>
                      <td className="text-right py-2 px-2 font-medium">
                        {formatCent(payment.amount)}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {payment.provider || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rechnungstext */}
      {invoice.text && (
        <Card>
          <CardHeader>
            <CardTitle>Rechnungstext</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-sm text-muted-foreground whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: invoice.text.replace(/\n/g, "<br />"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

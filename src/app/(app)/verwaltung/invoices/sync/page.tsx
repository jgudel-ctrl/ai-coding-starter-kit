/**
 * Sync-Status Page
 * Zeigt Sync-Status und erlaubt manuellen Sync-Start.
 */
"use client";

import { useState } from "react";
import { syncInvoicesNow, getSyncLog } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function SyncStatusPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    try {
      const result = await syncInvoicesNow();
      if (result.ok) {
        setLastResult(result.result);
        setSyncedAt(new Date());
      }
    } finally {
      setIsSyncing(false);
    }
  }

  const statusConfig: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    completed: { label: "Erfolgreich", variant: "default" },
    partial: { label: "Teilweise", variant: "secondary" },
    failed: { label: "Fehlgeschlagen", variant: "destructive" },
    running: { label: "Läuft...", variant: "outline" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Button variant="outline" size="sm" asChild>
        <Link href="/verwaltung/invoices">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zu Rechnungen
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Invoice-Sync</h1>
        <p className="text-muted-foreground">
          Manuelle Synchronisation mit Easybill
        </p>
      </div>

      {/* Sync-Button */}
      <Card>
        <CardHeader>
          <CardTitle>Manueller Sync</CardTitle>
          <CardDescription>
            Startet einen sofortigen Sync mit der Easybill API. Lädt alle
            Rechnungen, Positionen und Zahlungen ab dem 01.01.2023.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size="lg"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Synchronisiere...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Jetzt synchronisieren
                </>
              )}
            </Button>

            {lastResult && syncedAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Zuletzt synchronisiert: {syncedAt.toLocaleString("de-DE")}
              </div>
            )}
          </div>

          {/* Ergebnis */}
          {lastResult && (
            <div className="rounded-lg bg-muted p-4 space-y-3">
              <h3 className="font-semibold">Ergebnis</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Geladen</p>
                  <p className="text-xl font-bold">{lastResult.documentsFetched}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Neu</p>
                  <p className="text-xl font-bold text-green-600">
                    {lastResult.documentsInserted}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aktualisiert</p>
                  <p className="text-xl font-bold text-blue-600">
                    {lastResult.documentsUpdated}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Positionen</p>
                  <p className="text-xl font-bold">{lastResult.itemsInserted}</p>
                </div>
              </div>

              {lastResult.errors.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">
                      {lastResult.errors.length} Fehler aufgetreten
                    </p>
                    <ul className="text-sm text-red-700 mt-1 space-y-1">
                      {lastResult.errors.slice(0, 5).map((e: string, i: number) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>Automatischer Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ein täglicher Cronjob läuft automatisch um 02:00 Uhr (Europe/Berlin)
            und synchronisiert alle neuen und geänderten Rechnungen aus Easybill.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

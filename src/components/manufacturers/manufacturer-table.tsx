"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Edit, Trash2, Package, Import, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Manufacturer } from "@/lib/actions/manufacturers";

/* ═══════════════════════════════════════════
   Props
   ═══════════════════════════════════════════ */

type ManufacturerTableProps = {
  manufacturers: Manufacturer[];
  loading?: boolean;
  onEdit: (m: Manufacturer) => void;
  onDelete: (id: string, name: string) => void;
  onImport: () => void;
  onCreate: () => void;
};

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ManufacturerTable({
  manufacturers,
  loading,
  onEdit,
  onDelete,
  onImport,
  onCreate,
}: ManufacturerTableProps) {
  const [search, setSearch] = useState("");

  const filtered = manufacturers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button onClick={onCreate} variant="default" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Neuer Hersteller
          </Button>
          <Button onClick={onImport} variant="outline" size="sm">
            <Import className="h-4 w-4 mr-1" />
            Importieren
          </Button>
        </div>
        <Input
          placeholder="Hersteller suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{manufacturers.length} Hersteller</span>
        <span>·</span>
        <span>
          {manufacturers.reduce((sum, m) => sum + (m.product_count || 0), 0)} Artikel verknüpft
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-32 text-right">Artikel</TableHead>
              <TableHead className="w-32 text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading Skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-20 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  {search
                    ? `Kein Hersteller gefunden für "${search}"`
                    : "Noch keine Hersteller vorhanden. Klicke \"Importieren\" oder \"Neuer Hersteller\"."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={m.product_count > 0 ? "secondary" : "outline"}>
                      <Package className="h-3 w-3 mr-1" />
                      {m.product_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(m)}
                        title="Bearbeiten"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(m.id, m.name)}
                        disabled={m.product_count > 0}
                        title={
                          m.product_count > 0
                            ? "Löschen nicht möglich — Artikel verknüpft"
                            : "Löschen"
                        }
                      >
                        <Trash2
                          className={`h-4 w-4 ${
                            m.product_count > 0
                              ? "text-muted-foreground"
                              : "text-destructive"
                          }`}
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Manufacturer Modal (Create / Edit)
   ═══════════════════════════════════════════ */

type ManufacturerModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, notes: string) => void;
  manufacturer?: Manufacturer | null;
  loading?: boolean;
  error?: string | null;
};

export function ManufacturerModal({
  open,
  onClose,
  onSubmit,
  manufacturer,
  loading,
  error,
}: ManufacturerModalProps) {
  const [name, setName] = useState(manufacturer?.name || "");
  const [notes, setNotes] = useState(manufacturer?.notes || "");

  // Reset wenn sich manufacturer ändert
  useState(() => {
    setName(manufacturer?.name || "");
    setNotes(manufacturer?.notes || "");
  });

  const isEditing = !!manufacturer;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), notes.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Hersteller bearbeiten" : "Neuer Hersteller"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? `Ändere den Namen oder die Notizen für ${manufacturer?.name}.`
                : "Lege einen neuen Hersteller an."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name *
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. AKE, Stehle, Titmann"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notizen
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Interne Notizen zum Hersteller..."
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Speichert..." : isEditing ? "Speichern" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════
   Import Modal
   ═══════════════════════════════════════════ */

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  result?: {
    manufacturers_created: number;
    manufacturers_skipped: number;
    products_linked: number;
    products_without_manufacturer: number;
  } | null;
};

export function ImportModal({
  open,
  onClose,
  onConfirm,
  loading,
  result,
}: ImportModalProps) {
  const hasResult = !!result;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {hasResult ? "Import abgeschlossen" : "Hersteller importieren"}
          </DialogTitle>
          <DialogDescription>
            {hasResult
              ? "Die Hersteller wurden aus den Easybill-Daten importiert."
              : "Dieser Vorgang extrahiert alle Hersteller-Namen aus den vorhandenen Artikeldaten und verknüpft die Artikel automatisch."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {hasResult ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Neue Hersteller</span>
                <span className="font-medium">{result.manufacturers_created}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Übersprungen (existierten)</span>
                <span className="font-medium">{result.manufacturers_skipped}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Artikel verknüpft</span>
                <span className="font-medium">{result.products_linked}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Artikel ohne Hersteller</span>
                <span className="font-medium text-amber-600">
                  {result.products_without_manufacturer}
                </span>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Der Import liest das Feld "Note" aus den Easybill-Daten und ordnet
                jedem Artikel den passenden Hersteller zu. Bereits existierende
                Hersteller werden nicht doppelt angelegt.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {hasResult ? "Schließen" : "Abbrechen"}
          </Button>
          {!hasResult && (
            <Button onClick={onConfirm} disabled={loading}>
              {loading ? "Importiert..." : "Jetzt importieren"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════
   Delete Confirmation Dialog
   ═══════════════════════════════════════════ */

type DeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  manufacturerName: string;
  loading?: boolean;
};

export function DeleteManufacturerDialog({
  open,
  onClose,
  onConfirm,
  manufacturerName,
  loading,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hersteller löschen</DialogTitle>
          <DialogDescription>
            Bist du sicher, dass du <strong>{manufacturerName}</strong> löschen möchtest?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Löscht..." : "Löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

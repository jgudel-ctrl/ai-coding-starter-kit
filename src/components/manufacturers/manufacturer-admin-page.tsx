"use client";

import { useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import {
  ManufacturerTable,
  ManufacturerModal,
  ImportModal,
  DeleteManufacturerDialog,
} from "@/components/manufacturers/manufacturer-table";
import {
  getManufacturers,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
  importManufacturers,
  type Manufacturer,
  type ImportResult,
} from "@/lib/actions/manufacturers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory } from "lucide-react";

/* ═══════════════════════════════════════════
   Hersteller-Verwaltungsseite
   ═══════════════════════════════════════════ */

type ManufacturerAdminPageProps = {
  initialManufacturers: Manufacturer[];
};

export function ManufacturerAdminPage({
  initialManufacturers,
}: ManufacturerAdminPageProps) {
  const [manufacturers, setManufacturers] = useState(initialManufacturers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingManufacturer, setDeletingManufacturer] = useState<{ id: string; name: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await getManufacturers();
    if (result.ok) {
      setManufacturers(result.data);
    }
  }, []);

  const handleCreate = () => {
    setEditingManufacturer(null);
    setModalError(null);
    setModalOpen(true);
  };

  const handleEdit = (m: Manufacturer) => {
    setEditingManufacturer(m);
    setModalError(null);
    setModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeletingManufacturer({ id, name });
    setDeleteDialogOpen(true);
  };

  const handleModalSubmit = async (name: string, notes: string) => {
    setLoading(true);
    setModalError(null);

    if (editingManufacturer) {
      const result = await updateManufacturer(editingManufacturer.id, name, notes);
      if (result.ok) {
        toast.success(`Hersteller "${name}" aktualisiert.`);
        setModalOpen(false);
        await refresh();
      } else {
        setModalError(result.error);
      }
    } else {
      const result = await createManufacturer(name, notes);
      if (result.ok) {
        toast.success(`Hersteller "${name}" angelegt.`);
        setModalOpen(false);
        await refresh();
      } else {
        setModalError(result.error);
      }
    }

    setLoading(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingManufacturer) return;
    setLoading(true);

    const result = await deleteManufacturer(deletingManufacturer.id);
    if (result.ok) {
      toast.success(`Hersteller "${deletingManufacturer.name}" gelöscht.`);
      setDeleteDialogOpen(false);
      await refresh();
    } else {
      toast.error(result.error);
    }

    setLoading(false);
  };

  const handleImport = async () => {
    if (importResult) {
      // Ergebnis war schon da — Modal schließen und Reset
      setImportResult(null);
      setImportModalOpen(false);
      await refresh();
      return;
    }

    setLoading(true);
    const result = await importManufacturers();
    if (result.ok) {
      setImportResult(result.data);
      toast.success(
        `Import abgeschlossen: ${result.data.manufacturers_created} neue Hersteller, ${result.data.products_linked} Artikel verknüpft.`
      );
    } else {
      toast.error(result.error);
      setImportModalOpen(false);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" />
            <CardTitle>Hersteller-Verwaltung</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ManufacturerTable
            manufacturers={manufacturers}
            loading={isPending}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onImport={() => {
              setImportResult(null);
              setImportModalOpen(true);
            }}
            onCreate={handleCreate}
          />
        </CardContent>
      </Card>

      <ManufacturerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        manufacturer={editingManufacturer}
        loading={loading}
        error={modalError}
      />

      <ImportModal
        open={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportResult(null);
        }}
        onConfirm={handleImport}
        loading={loading}
        result={importResult}
      />

      {deletingManufacturer && (
        <DeleteManufacturerDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          manufacturerName={deletingManufacturer.name}
          loading={loading}
        />
      )}
    </div>
  );
}

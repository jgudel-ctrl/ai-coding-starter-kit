"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud } from "lucide-react";
import { uploadKnowledgeDocument } from "@/lib/actions/wissensbasis";

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
};

export function WissensbasisUploadDialog({ open, onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setBusy(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadKnowledgeDocument(formData);
    setBusy(false);
    if (res.ok) {
      toast.success(`${res.data.createdCount} Einträge als Entwurf erstellt.`);
      onUploaded();
      reset();
      onClose();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
          <DialogDescription>
            PDF/Dokument hochladen — die KI liest es und schlägt Wissens-Einträge (Status „Entwurf“) vor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="doc">Datei (PDF)</Label>
          <Input
            id="doc"
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {busy && (
            <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              KI liest das Dokument …
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
          >
            Abbrechen
          </Button>
          <Button onClick={handleUpload} disabled={!file || busy}>
            <UploadCloud className="h-4 w-4 mr-1" /> Hochladen & auslesen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

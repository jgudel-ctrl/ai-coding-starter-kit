"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import {
  saveKnowledgeEntry,
  setKnowledgeEntryStatus,
  deleteKnowledgeEntry,
  type KnowledgeEntry,
  type KnowledgeCategories,
  type TechnicalValue,
} from "@/lib/actions/wissensbasis";

type Props = {
  open: boolean;
  entry: KnowledgeEntry | null;
  categories: KnowledgeCategories;
  onClose: () => void;
  onChanged: () => void;
};

export function WissensbasisEntryModal({ open, entry, categories, onClose, onChanged }: Props) {
  const [draft, setDraft] = useState<KnowledgeEntry | null>(entry);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(entry);
  }, [entry]);

  if (!draft) return null;

  const set = (patch: Partial<KnowledgeEntry>) => setDraft({ ...draft, ...patch });
  const setSource = (patch: Partial<KnowledgeEntry["source"]>) =>
    setDraft({ ...draft, source: { ...draft.source, ...patch } });

  const setKennwert = (i: number, patch: Partial<TechnicalValue>) => {
    const next = draft.technical_values.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
    set({ technical_values: next });
  };
  const addKennwert = () =>
    set({ technical_values: [...draft.technical_values, { label: "", value: "" }] });
  const removeKennwert = (i: number) =>
    set({ technical_values: draft.technical_values.filter((_, idx) => idx !== i) });

  const handleSave = async () => {
    setSaving(true);
    const res = await saveKnowledgeEntry(draft);
    setSaving(false);
    if (res.ok) {
      toast.success("Eintrag gespeichert.");
      onChanged();
      onClose();
    } else {
      toast.error(res.error);
    }
  };

  const handleSetGeprueft = async () => {
    if (!draft.tool_type || !draft.material) {
      toast.error("Für „Geprüft“ müssen Werkzeugart und Material gesetzt sein.");
      return;
    }
    setSaving(true);
    const res = await setKnowledgeEntryStatus(draft.id, "geprueft");
    setSaving(false);
    if (res.ok) {
      toast.success("Eintrag als geprüft markiert.");
      onChanged();
      onClose();
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const res = await deleteKnowledgeEntry(draft.id);
    setSaving(false);
    if (res.ok) {
      toast.success("Eintrag verworfen.");
      onChanged();
      onClose();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wissens-Eintrag</DialogTitle>
          <DialogDescription>
            {draft.status === "geprueft"
              ? "Geprüfter Eintrag — verlässliche Basis."
              : "Entwurf — bitte prüfen und auf „Geprüft“ setzen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Titel / Begriff</Label>
            <Input id="title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Werkzeugart</Label>
              <Select value={draft.tool_type} onValueChange={(v) => set({ tool_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {categories.toolTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={draft.material} onValueChange={(v) => set({ material: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {categories.materials.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Technische Kennwerte</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addKennwert}>
                <Plus className="h-4 w-4 mr-1" /> Kennwert
              </Button>
            </div>
            {draft.technical_values.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Kennwerte.</p>
            )}
            {draft.technical_values.map((kv, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Bezeichnung"
                  value={kv.label}
                  onChange={(e) => setKennwert(i, { label: e.target.value })}
                />
                <Input
                  placeholder="Wert"
                  value={kv.value}
                  onChange={(e) => setKennwert(i, { value: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeKennwert(i)}
                  aria-label="Kennwert entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Beschreibung (eigene Worte)</Label>
            <Textarea
              id="desc"
              rows={3}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="verbatim">Originaltext-Auszug (intern)</Label>
            <Textarea
              id="verbatim"
              rows={2}
              value={draft.verbatim_excerpt}
              onChange={(e) => set({ verbatim_excerpt: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="src-doc">Quelle: Dokument</Label>
              <Input
                id="src-doc"
                value={draft.source.document}
                onChange={(e) => setSource({ document: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="src-page">Seite</Label>
              <Input
                id="src-page"
                value={draft.source.page}
                onChange={(e) => setSource({ page: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="src-man">Hersteller (intern)</Label>
              <Input
                id="src-man"
                value={draft.source.manufacturer}
                onChange={(e) => setSource({ manufacturer: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleDelete} disabled={saving}>
            <Trash2 className="h-4 w-4 mr-1" /> Verwerfen
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={handleSave} disabled={saving}>
              Speichern
            </Button>
            {draft.status !== "geprueft" && (
              <Button type="button" onClick={handleSetGeprueft} disabled={saving}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Auf „Geprüft“ setzen
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

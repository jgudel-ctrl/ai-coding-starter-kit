"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Search, UploadCloud } from "lucide-react";
import {
  getKnowledgeEntries,
  type KnowledgeEntry,
  type KnowledgeCategories,
  type KnowledgeFilters,
  type KnowledgeStatus,
} from "@/lib/actions/wissensbasis";
import { PageOverview, type Kpi } from "@/components/page-overview";
import { WissensbasisTable } from "./wissensbasis-table";
import { WissensbasisEntryModal } from "./wissensbasis-entry-modal";
import { WissensbasisUploadDialog } from "./wissensbasis-upload-dialog";

const ALL = "__all";

type Props = {
  initialEntries: KnowledgeEntry[];
  categories: KnowledgeCategories;
};

export function WissensbasisAdminPage({ initialEntries, categories }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [toolType, setToolType] = useState<string>(ALL);
  const [material, setMaterial] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<KnowledgeEntry | null>(null);

  const load = useCallback(async () => {
    const filters: KnowledgeFilters = {
      search: search || undefined,
      toolType: toolType === ALL ? undefined : toolType,
      material: material === ALL ? undefined : material,
      status: status === ALL ? undefined : (status as KnowledgeStatus),
    };
    const res = await getKnowledgeEntries(filters);
    if (res.ok) setEntries(res.data);
  }, [search, toolType, material, status]);

  useEffect(() => {
    // Daten bei Filter-Änderung neu laden; load() setzt State erst async nach await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const hasFilters = search || toolType !== ALL || material !== ALL || status !== ALL;

  // Übersicht (verbindlicher Seiten-Kopf): kompakte KPIs über den Gesamtbestand.
  const total = initialEntries.length;
  const geprueft = initialEntries.filter((e) => e.status === "geprueft").length;
  const entwurf = total - geprueft;
  const geprueftPct = total ? Math.round((geprueft / total) * 100) : 0;
  const kpis: Kpi[] = [
    { label: "Einträge gesamt", value: total },
    { label: "Geprüft", value: geprueft, accent: "#2FB344" },
    { label: "Entwurf", value: entwurf, accent: "#F59F00" },
  ];
  const pruefstandChart = (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Prüfstand</span>
        <span className="font-medium text-foreground">{geprueftPct}% geprüft</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="bg-[#2FB344]" style={{ width: `${geprueftPct}%` }} />
        <div className="bg-[#F59F00]" style={{ width: `${100 - geprueftPct}%` }} />
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#2FB344]" /> Geprüft
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#F59F00]" /> Entwurf
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Kopf */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-6 w-6 text-primary" />
            Wissensbasis
          </h1>
          <p className="text-muted-foreground">
            Geprüftes Fachwissen als Grundlage für Themen &amp; Content.
          </p>
        </div>
        <Button className="h-11" onClick={() => setUploadOpen(true)}>
          <UploadCloud className="h-4 w-4 mr-2" /> Dokument hochladen
        </Button>
      </div>

      {/* Übersicht (max. ~⅓, kompakt, animiert) */}
      <PageOverview kpis={kpis} chart={total > 0 ? pruefstandChart : undefined} />

      {/* Filter & Suche */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suchen (Titel, Beschreibung, Quelle) …"
              className="pl-9 h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={toolType} onValueChange={setToolType}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Werkzeugart" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Werkzeugarten</SelectItem>
                {categories.toolTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Materialien</SelectItem>
                {categories.materials.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Status</SelectItem>
                <SelectItem value="entwurf">Entwurf</SelectItem>
                <SelectItem value="geprueft">Geprüft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Einträge */}
      {entries.length > 0 ? (
        <WissensbasisTable entries={entries} onOpen={setSelected} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              {hasFilters ? "Keine Einträge für diese Filter" : "Noch keine Einträge"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? "Passe die Filter an oder setze sie zurück."
                : "Lade dein erstes Dokument hoch — die KI erstellt daraus Wissens-Einträge."}
            </p>
            {!hasFilters && (
              <Button onClick={() => setUploadOpen(true)}>
                <UploadCloud className="h-4 w-4 mr-2" /> Erstes Dokument hochladen
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <WissensbasisUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={load}
      />
      <WissensbasisEntryModal
        open={selected !== null}
        entry={selected}
        categories={categories}
        onClose={() => setSelected(null)}
        onChanged={load}
      />
    </div>
  );
}

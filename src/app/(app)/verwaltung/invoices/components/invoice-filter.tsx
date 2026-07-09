/**
 * InvoiceFilter — Filter für Rechnungsübersicht
 */
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export interface InvoiceFilters {
  paymentStatus: string;
  type: string;
  search: string;
}

interface InvoiceFilterProps {
  filters: InvoiceFilters;
  onChange: (filters: InvoiceFilters) => void;
}

export function InvoiceFilter({ filters, onChange }: InvoiceFilterProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);

  const hasFilters =
    filters.paymentStatus || filters.type || filters.search;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Suche */}
      <div className="flex gap-2">
        <Input
          placeholder="Rechnungsnr. oder Kunde..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange({ ...filters, search: localSearch });
            }
          }}
          className="w-[280px]"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange({ ...filters, search: localSearch })}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Bezahlstatus */}
      <Select
        value={filters.paymentStatus || "all"}
        onValueChange={(v) =>
          onChange({ ...filters, paymentStatus: v === "all" ? "" : v })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Bezahltstatus" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Status</SelectItem>
          <SelectItem value="paid">Bezahlt</SelectItem>
          <SelectItem value="partial">Teilweise</SelectItem>
          <SelectItem value="open">Offen</SelectItem>
          <SelectItem value="overdue">Überfällig</SelectItem>
        </SelectContent>
      </Select>

      {/* Dokumenttyp */}
      <Select
        value={filters.type || "all"}
        onValueChange={(v) =>
          onChange({ ...filters, type: v === "all" ? "" : v })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Dokumenttyp" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Typen</SelectItem>
          <SelectItem value="INVOICE">Rechnung</SelectItem>
          <SelectItem value="CREDIT">Gutschrift</SelectItem>
          <SelectItem value="STORNO">Storno</SelectItem>
          <SelectItem value="STORNO_CREDIT">Storno-Gutschrift</SelectItem>
        </SelectContent>
      </Select>

      {/* Zurücksetzen */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLocalSearch("");
            onChange({ paymentStatus: "", type: "", search: "" });
          }}
        >
          <X className="h-4 w-4 mr-1" />
          Zurücksetzen
        </Button>
      )}
    </div>
  );
}

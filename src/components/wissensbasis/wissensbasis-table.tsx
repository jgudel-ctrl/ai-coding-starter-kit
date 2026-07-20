"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { KnowledgeEntry, KnowledgeStatus } from "@/lib/actions/wissensbasis";

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  if (status === "geprueft") {
    return (
      <Badge className="bg-[#2FB344] hover:bg-[#2FB344] text-white">Geprüft</Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#F59F00] text-[#F59F00]">
      Entwurf
    </Badge>
  );
}

type WissensbasisTableProps = {
  entries: KnowledgeEntry[];
  onOpen: (entry: KnowledgeEntry) => void;
};

export function WissensbasisTable({ entries, onOpen }: WissensbasisTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>Werkzeugart</TableHead>
            <TableHead>Material</TableHead>
            <TableHead className="hidden sm:table-cell">Quelle</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow
              key={entry.id}
              className="cursor-pointer"
              onClick={() => onOpen(entry)}
            >
              <TableCell className="font-medium">{entry.title}</TableCell>
              <TableCell className="text-muted-foreground">{entry.tool_type}</TableCell>
              <TableCell className="text-muted-foreground">{entry.material}</TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                {entry.source.document}
                {entry.source.page ? `, S. ${entry.source.page}` : ""}
              </TableCell>
              <TableCell className="text-right">
                <StatusBadge status={entry.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

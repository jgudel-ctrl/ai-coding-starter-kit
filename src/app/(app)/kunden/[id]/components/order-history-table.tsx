"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getPartnerTradeOrders, getPartnerOrderGroupStats } from "@/lib/actions/orders";
import type { TradeOrderItem, OrderGroupStat } from "@/lib/actions/orders";
import { OrderDetailModal } from "./order-detail-modal";
import { OrderGroupChart } from "./order-group-chart";

interface OrderHistoryTableProps {
  partnerId: string;
}

export function OrderHistoryTable({ partnerId }: OrderHistoryTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<TradeOrderItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupStats, setGroupStats] = useState<OrderGroupStat[]>([]);
  const [isGroupStatsLoading, setIsGroupStatsLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true);
      const result = await getPartnerTradeOrders(
        partnerId,
        page,
        pageSize,
        search || undefined,
        activeGroupId ?? undefined
      );
      if (result.ok) {
        setOrders(result.items);
        setTotalCount(result.totalCount);
      }
      setIsLoading(false);
    }
    loadOrders();
  }, [partnerId, page, search, activeGroupId]);

  useEffect(() => {
    async function loadGroupStats() {
      setIsGroupStatsLoading(true);
      const result = await getPartnerOrderGroupStats(partnerId, search || undefined);
      if (result.ok) {
        setGroupStats(result.data);
      }
      setIsGroupStatsLoading(false);
    }
    loadGroupStats();
  }, [partnerId, search]);

  const handleSelectGroup = (groupId: number | null) => {
    setActiveGroupId(groupId);
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    return `€${value.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
  };

  const selectedOrder = selectedIndex !== null ? orders[selectedIndex] : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <OrderGroupChart
          stats={groupStats}
          activeGroupId={activeGroupId}
          onSelectGroup={handleSelectGroup}
          isLoading={isGroupStatsLoading}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border bg-card shadow-sm"
      >
        <div className="p-4 border-b">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="font-semibold text-lg">Bestellhistorie — Handelsware</h3>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select
                value={activeGroupId ? String(activeGroupId) : "all"}
                onValueChange={(value) => handleSelectGroup(value === "all" ? null : Number(value))}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Artikelgruppe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Artikelgruppen</SelectItem>
                  {groupStats.map((g) => (
                    <SelectItem key={g.group_id} value={String(g.group_id)}>
                      {g.group_name} ({g.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Artikel oder Artikelnr. suchen..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 w-full sm:w-[300px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Volle Tabelle */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Datum</TableHead>
                <TableHead>Rechnung</TableHead>
                <TableHead className="max-w-[200px]">Beschreibung</TableHead>
                <TableHead className="w-[100px]">Artikelnr.</TableHead>
                <TableHead className="text-right w-[80px]">Menge</TableHead>
                <TableHead className="text-right">Einzelpreis (netto)</TableHead>
                <TableHead className="text-right w-[80px]">Rabatt</TableHead>
                <TableHead className="text-right">Gesamt (netto)</TableHead>
                <TableHead className="text-right">EK-Preis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Lade Bestellhistorie...
                    </div>
                  </TableCell>
                </TableRow>
              ) : orders.length > 0 ? (
                orders.map((order, index) => (
                  <TableRow
                    key={index}
                    className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedIndex(index)}
                  >
                    <TableCell className="text-sm">{formatDate(order.document_date)}</TableCell>
                    <TableCell className="text-sm font-medium">{order.document_number}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{order.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{order.article_number || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{order.quantity}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(order.unit_price_net)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {order.discount_percent ? `${order.discount_percent}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(order.total_net)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(order.purchase_price)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Keine Bestellungen gefunden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: Karten-Liste (nur Beschreibung + Preis) */}
        <div className="md:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Lade Bestellhistorie...
            </div>
          ) : orders.length > 0 ? (
            <div className="divide-y">
              {orders.map((order, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 active:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedIndex(index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{order.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(order.document_date)} · {order.document_number}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(order.total_net)}</p>
                      <p className="text-xs text-muted-foreground">{order.quantity}×</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Keine Bestellungen gefunden
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Seite {page} von {totalPages} ({totalCount} Einträge)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            orders={orders}
            currentIndex={selectedIndex ?? 0}
            isOpen={selectedIndex !== null}
            onClose={() => setSelectedIndex(null)}
            onNavigate={(index) => setSelectedIndex(index)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getPartnerDiscounts, updatePartnerDiscount } from "@/lib/actions/discounts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Percent, Tag, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PartnerDiscountsProps {
  partnerId: string;
  isAdmin: boolean;
}

interface Discount {
  id: string;
  position_group_id: number | null;
  position_group_name: string | null;
  position_group_number: string | null;
  discount_percent: number | null;
  discount_type: string | null;
}

interface PositionGroup {
  id: number;
  name: string;
  display_name: string | null;
  number: string | null;
}

interface EditingState {
  id: string | null;
  value: string;
  isSaving: boolean;
}

export function PartnerDiscountsCard({ partnerId, isAdmin }: PartnerDiscountsProps) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [positionGroups, setPositionGroups] = useState<PositionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>({ id: null, value: "", isSaving: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getPartnerDiscounts(partnerId);

    if (result.ok && result.data) {
      setDiscounts(result.data.discounts);
      setPositionGroups(result.data.positionGroups);
    } else {
      setError(result.error || "Fehler beim Laden der Rabatte");
    }

    setLoading(false);
  }, [partnerId]);

  useEffect(() => {
    // Standard fetch-on-mount: loadDiscounts sets state async after the
    // effect body returns, not synchronously within it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDiscounts();
  }, [loadDiscounts]);

  // Fokus auf Input wenn Edit-Modus startet
  useEffect(() => {
    if (editing.id && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing.id]);

  // Map für Gruppenauflösung (Fallback wenn DB-Feld leer)
  const groupsMap = new Map(positionGroups.map((pg) => [pg.id, pg]));

  function getGroupName(discount: Discount): string {
    if (discount.position_group_name) return discount.position_group_name;
    const pg = groupsMap.get(discount.position_group_id || 0);
    return pg?.display_name || pg?.name || "Unbekannte Gruppe";
  }

  function getGroupNumber(discount: Discount): string {
    if (discount.position_group_number) return discount.position_group_number;
    const pg = groupsMap.get(discount.position_group_id || 0);
    return pg?.number || "-";
  }

  // Edit-Modus starten
  const startEdit = useCallback((discount: Discount) => {
    if (!isAdmin) return;
    setEditing({
      id: discount.id,
      value: String(discount.discount_percent || 0),
      isSaving: false,
    });
  }, [isAdmin]);

  // Speichern
  const saveEdit = useCallback(async () => {
    if (!editing.id || editing.isSaving) return;

    const newValue = parseInt(editing.value, 10);
    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      setError("Ungültiger Wert — bitte eine Zahl zwischen 0 und 100 eingeben.");
      return;
    }

    setEditing((prev) => ({ ...prev, isSaving: true }));
    setError(null);

    const result = await updatePartnerDiscount(partnerId, editing.id, newValue);

    if (result.ok) {
      // Lokale Liste aktualisieren
      setDiscounts((prev) =>
        prev.map((d) =>
          d.id === editing.id ? { ...d, discount_percent: newValue } : d
        )
      );
      setEditing({ id: null, value: "", isSaving: false });
    } else {
      setError(result.error || "Speichern fehlgeschlagen.");
      setEditing((prev) => ({ ...prev, isSaving: false }));
    }
  }, [editing.id, editing.value, editing.isSaving, partnerId]);

  // Abbrechen
  const cancelEdit = useCallback(() => {
    setEditing({ id: null, value: "", isSaving: false });
    setError(null);
  }, []);

  // Event-Handler für Input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveEdit();
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit]
  );

  const handleBlur = useCallback(() => {
    // Kurzes Delay, damit Klick auf andere Elemente nicht sofort speichert
    setTimeout(() => {
      if (editing.id) {
        saveEdit();
      }
    }, 150);
  }, [editing.id, saveEdit]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Lade Rabatte...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !editing.id) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (discounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tag className="h-5 w-5" />
            Kundenspezifische Rabatte
          </CardTitle>
          <CardDescription>
            Rabatte pro Produktgruppe aus Easybill
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Percent className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>Keine Rabatte für diesen Kunden hinterlegt.</p>
            <p className="text-sm mt-1">
              Rabatte werden automatisch aus Easybill importiert.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tag className="h-5 w-5" />
          Kundenspezifische Rabatte
        </CardTitle>
        <CardDescription>
          {discounts.length} Produktgruppe{discounts.length !== 1 ? "n" : ""} mit Rabatt
          {" "}<span className="text-xs text-muted-foreground">(aus Easybill)</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <p className="text-xs text-muted-foreground">
            💡 Als Admin kannst du auf einen Rabatt klicken, um ihn zu bearbeiten.
          </p>
        )}

        {/* Fehleranzeige während Edit */}
        {error && editing.id && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Rabatt-Liste */}
        <div className="space-y-3">
          {discounts.map((discount) => {
            const isEditing = editing.id === discount.id;

            return (
              <div
                key={discount.id}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  isAdmin ? "hover:bg-muted/50 cursor-pointer" : ""
                }`}
                onClick={() => {
                  if (isAdmin && !isEditing) startEdit(discount);
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {getGroupName(discount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gruppe #{getGroupNumber(discount)}
                  </p>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        ref={inputRef}
                        type="number"
                        min={0}
                        max={100}
                        value={editing.value}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            value: e.target.value,
                          }))
                        }
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        disabled={editing.isSaving}
                        className="w-16 h-8 text-sm text-center px-1"
                        autoFocus
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      {editing.isSaving && (
                        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  ) : (
                    <Badge
                      variant={
                        (discount.discount_percent || 0) > 20
                          ? "destructive"
                          : (discount.discount_percent || 0) > 10
                            ? "default"
                            : "secondary"
                      }
                      className="text-sm px-2 py-0.5"
                    >
                      {discount.discount_percent || 0}%
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Zusammenfassung */}
        {discounts.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Höchster Rabatt</span>
              <span className="font-medium">
                {Math.max(...discounts.map((d) => d.discount_percent || 0))}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Durchschnittlicher Rabatt</span>
              <span className="font-medium">
                {(
                  discounts.reduce((sum, d) => sum + (d.discount_percent || 0), 0) /
                  discounts.length
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        )}

        {/* Info */}
        <Alert className="mt-4" variant="default">
          <AlertDescription className="text-xs">
            Rabatte werden bei jedem Sync vollständig von Easybill übernommen.
            Änderungen hier haben keinen Einfluss auf die Rechnungsberechnung.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import { getPartnerDiscounts } from "@/lib/actions/discounts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Percent, Tag, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PartnerDiscountsProps {
  partnerId: string;
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

export function PartnerDiscountsCard({ partnerId }: PartnerDiscountsProps) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [positionGroups, setPositionGroups] = useState<PositionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDiscounts();
  }, [partnerId]);

  async function loadDiscounts() {
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
  }

  // Gruppen ohne Rabatte finden
  const groupsWithDiscount = new Set(discounts.map((d) => d.position_group_id));
  const groupsWithoutDiscount = positionGroups.filter(
    (pg) => !groupsWithDiscount.has(pg.id)
  );

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

  if (error) {
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
        {/* Rabatt-Liste */}
        <div className="space-y-3">
          {discounts.map((discount) => (
            <div
              key={discount.id}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {discount.position_group_name || "Unbekannte Gruppe"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Gruppe #{discount.position_group_number || "-"}
                </p>
              </div>

              <div className="flex items-center gap-3 ml-4">
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
              </div>
            </div>
          ))}
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

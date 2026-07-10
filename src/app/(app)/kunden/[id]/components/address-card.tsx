"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, AlertTriangle, CheckCircle, XCircle, MapPin } from "lucide-react";
import { updatePartnerAddress } from "@/lib/actions/addresses";

// Geoapify Status Badge (kleines Icon)
function GeoapifyBadge({ status }: { status?: string | null }) {
  if (!status || status === 'valid') return null;
  
  if (status === 'suggestion') {
    return (
      <span title="Adresse prüfen: Vorschlag verfügbar" className="cursor-help">
        🟡
      </span>
    );
  }
  
  if (status === 'invalid') {
    return (
      <span title="Adresse nicht gefunden" className="cursor-help">
        🔴
      </span>
    );
  }
  
  if (status === 'error') {
    return (
      <span title="Validierungsfehler" className="cursor-help">
        ⚪
      </span>
    );
  }
  
  return null;
}

interface Address {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  additional_line: string | null;
  postal_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  geoapify_status?: string | null;
  geoapify_confidence?: number | null;
  geoapify_suggested_street?: string | null;
  geoapify_suggested_postal_code?: string | null;
  geoapify_suggested_city?: string | null;
  geoapify_suggested_country?: string | null;
  geoapify_validated_at?: string | null;
}

interface AddressCardProps {
  title: string;
  address: Address | null;
}

export function AddressCard({ title, address }: AddressCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [formData, setFormData] = useState({
    company_name: address?.company_name || "",
    first_name: address?.first_name || "",
    last_name: address?.last_name || "",
    street: address?.street || "",
    additional_line: address?.additional_line || "",
    postal_code: address?.postal_code || "",
    city: address?.city || "",
    state: address?.state || "",
    country: address?.country || "",
  });

  const handleSave = async () => {
    if (!address) return;
    setIsSaving(true);
    const result = await updatePartnerAddress(address.id, {
      company_name: formData.company_name || undefined,
      first_name: formData.first_name || undefined,
      last_name: formData.last_name || undefined,
      street: formData.street || undefined,
      additional_line: formData.additional_line || undefined,
      postal_code: formData.postal_code || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      country: formData.country || undefined,
    });
    setIsSaving(false);
    if (result.ok) {
      setIsOpen(false);
      window.location.reload();
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
        transition={{ duration: 0.2 }}
        className="relative rounded-lg border bg-card p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-8 w-8 p-0"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {address ? (
          <div className="space-y-1 text-sm">
            {address.company_name && <p>{address.company_name}</p>}
            {(address.first_name || address.last_name) && (
              <p>{address.first_name} {address.last_name}</p>
            )}
            {address.street && (
              <div className="flex items-center gap-2">
                <p>{address.street}</p>
                <GeoapifyBadge status={address.geoapify_status} />
              </div>
            )}
            {address.additional_line && <p>{address.additional_line}</p>}
            {(address.postal_code || address.city) && (
              <p>{address.postal_code} {address.city}</p>
            )}
            {address.state && <p>{address.state}</p>}
            {address.country && <p>{address.country}</p>}
            
            {/* Geoapify Vorschlag anzeigen */}
            {address.geoapify_status === 'suggestion' && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center gap-2 text-xs text-yellow-800">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-medium">Adresse prüfen</span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Vorschlag: {address.geoapify_suggested_street}, {address.geoapify_suggested_postal_code} {address.geoapify_suggested_city}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs mt-1 p-0 text-yellow-700 hover:text-yellow-900"
                  onClick={() => setShowSuggestion(true)}
                >
                  Vergleich anzeigen →
                </Button>
              </div>
            )}
            
            {address.geoapify_status === 'invalid' && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-xs text-red-800">
                  <XCircle className="h-3 w-3" />
                  <span className="font-medium">Adresse nicht gefunden</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Keine Adresse hinterlegt</p>
        )}
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{title} bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Firma</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">Vorname</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Nachname</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="street">Straße</Label>
              <Input
                id="street"
                value={formData.street}
                onChange={(e) =>
                  setFormData({ ...formData, street: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">PLZ</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) =>
                    setFormData({ ...formData, postal_code: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ort</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">Bundesland</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional_line">Zusatz</Label>
              <Input
                id="additional_line"
                value={formData.additional_line}
                onChange={(e) =>
                  setFormData({ ...formData, additional_line: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Geoapify Vergleich-Dialog */}
      <Dialog open={showSuggestion} onOpenChange={setShowSuggestion}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>🟡 Adresse prüfen</DialogTitle>
            <DialogDescription>
              Geoapify hat einen anderen Vorschlag für diese Adresse gefunden.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Original */}
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-xs font-medium text-gray-500 mb-1">Aktuell gespeichert</p>
              <p className="text-sm">{address?.street}</p>
              <p className="text-sm">{address?.postal_code} {address?.city}</p>
              <p className="text-sm">{address?.country}</p>
            </div>

            {/* Vorschlag */}
            <div className="p-3 bg-green-50 rounded-md border border-green-200">
              <p className="text-xs font-medium text-green-600 mb-1">Vorschlag von Geoapify</p>
              <p className="text-sm font-medium">{address?.geoapify_suggested_street}</p>
              <p className="text-sm font-medium">
                {address?.geoapify_suggested_postal_code} {address?.geoapify_suggested_city}
              </p>
              <p className="text-sm font-medium">{address?.geoapify_suggested_country}</p>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setShowSuggestion(false)}>
              Ignorieren (aktuell beibehalten)
            </Button>
            <Button 
              onClick={async () => {
                if (!address) return;
                setIsSaving(true);
                const result = await updatePartnerAddress(address.id, {
                  street: address.geoapify_suggested_street || undefined,
                  postal_code: address.geoapify_suggested_postal_code || undefined,
                  city: address.geoapify_suggested_city || undefined,
                  country: address.geoapify_suggested_country || undefined,
                });
                setIsSaving(false);
                if (result.ok) {
                  setShowSuggestion(false);
                  window.location.reload();
                }
              }}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? "Übernehmen..." : "✅ Vorschlag übernehmen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

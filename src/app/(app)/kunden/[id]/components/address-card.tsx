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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { updatePartnerAddress } from "@/lib/actions/addresses";

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
}

interface AddressCardProps {
  title: string;
  address: Address | null;
}

export function AddressCard({ title, address }: AddressCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
            {address.street && <p>{address.street}</p>}
            {address.additional_line && <p>{address.additional_line}</p>}
            {(address.postal_code || address.city) && (
              <p>{address.postal_code} {address.city}</p>
            )}
            {address.state && <p>{address.state}</p>}
            {address.country && <p>{address.country}</p>}
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
    </>
  );
}

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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Mail, Phone, Building2 } from "lucide-react";
import { createPartnerContact } from "@/lib/actions/contacts";

interface Contact {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  role: string | null;
  notes: string | null;
}

interface ContactsListProps {
  partnerId: string;
  contacts: Contact[];
}

export function ContactsList({ partnerId, contacts }: ContactsListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    role: "",
    notes: "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    const result = await createPartnerContact(partnerId, {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      mobile: formData.mobile || undefined,
      role: formData.role || undefined,
      notes: formData.notes || undefined,
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
        className="rounded-lg border bg-card p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Kontakte</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-8 gap-1"
          >
            <Plus className="h-4 w-4" />
            Neuer Kontakt
          </Button>
        </div>

        {contacts.length > 0 ? (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-start gap-3 rounded-md border p-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {contact.display_name ||
                      `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                      "—"}
                  </p>
                  {contact.role && (
                    <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {contact.role}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    )}
                    {contact.mobile && (
                      <a
                        href={`tel:${contact.mobile}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {contact.mobile}
                      </a>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-muted-foreground text-xs mt-2">{contact.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Keine Kontakte hinterlegt
          </p>
        )}
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Neuen Kontakt hinzufügen</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_first_name">Vorname *</Label>
                <Input
                  id="contact_first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_last_name">Nachname *</Label>
                <Input
                  id="contact_last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">E-Mail</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefon</Label>
                <Input
                  id="contact_phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_mobile">Handynummer</Label>
                <Input
                  id="contact_mobile"
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_role">Position</Label>
                <Input
                  id="contact_role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  placeholder="z.B. Einkauf"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_notes">Notizen</Label>
              <Textarea
                id="contact_notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.first_name || !formData.last_name}
            >
              {isSaving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

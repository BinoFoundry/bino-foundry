import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ordersApi } from "@/services/api/orders";
import { isApiError } from "@/services/api/errors";
import type { CustomerCheckoutDetails } from "@bino-foundry/shared/types";

export interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designId: string | null;
  productLabel: string;
  totalAmount: number;
  currencyCode: string;
  defaultEmail?: string | null;
  defaultName?: string | null;
  onOrdered?: () => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  designId,
  productLabel,
  totalAmount,
  currencyCode,
  defaultEmail,
  defaultName,
  onOrdered,
}: CheckoutDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CustomerCheckoutDetails>({
    fullName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      fullName: defaultName?.trim() || prev.fullName,
      email: defaultEmail?.trim() || prev.email,
    }));
  }, [open, defaultEmail, defaultName]);

  const update = (key: keyof CustomerCheckoutDetails, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!designId) {
      toast.error("Save your design before checkout.");
      return;
    }

    setSubmitting(true);
    try {
      const order = await ordersApi.create({
        designId,
        customerDetails: form,
        notes: notes.trim() || undefined,
      });
      toast.success(`Order ${order.id} placed. We'll be in touch shortly.`);
      onOpenChange(false);
      onOrdered?.();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete your order</DialogTitle>
          <DialogDescription>
            {productLabel} · ${totalAmount.toFixed(2)} {currencyCode}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-name">Full name</Label>
              <Input
                id="checkout-name"
                required
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-email">Email</Label>
              <Input
                id="checkout-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-phone">Phone (optional)</Label>
              <Input
                id="checkout-phone"
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-address1">Address</Label>
              <Input
                id="checkout-address1"
                required
                value={form.addressLine1}
                onChange={(e) => update("addressLine1", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="checkout-address2">Apartment, suite, etc. (optional)</Label>
              <Input
                id="checkout-address2"
                value={form.addressLine2 ?? ""}
                onChange={(e) => update("addressLine2", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-city">City</Label>
              <Input
                id="checkout-city"
                required
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-state">State / region</Label>
              <Input
                id="checkout-state"
                value={form.state ?? ""}
                onChange={(e) => update("state", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-postal">Postal code</Label>
              <Input
                id="checkout-postal"
                required
                value={form.postalCode}
                onChange={(e) => update("postalCode", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-country">Country</Label>
              <Input
                id="checkout-country"
                required
                maxLength={2}
                value={form.country}
                onChange={(e) => update("country", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkout-notes">Order notes (optional)</Label>
            <Textarea
              id="checkout-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={submitting || !designId}>
            {submitting ? "Placing order…" : "Place order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { formatCurrency } from "@bino-foundry/shared/currency";
import { CUSTOMER_NAME_REQUIRED_MESSAGE } from "@bino-foundry/shared/constants";
import type {
  BraceletPreparationSelection,
  CustomerCheckoutDetails,
} from "@bino-foundry/shared/types";

import { getCustomerNameValidationError } from "@/lib/customer-name";
import { cn } from "@/lib/utils";
import { authApi } from "@/services/api/auth";
import { ordersApi } from "@/services/api/orders";
import { isApiError } from "@/services/api/errors";

const EMPTY_CHECKOUT: CustomerCheckoutDetails = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

type CheckoutField = keyof CustomerCheckoutDetails;
type FieldErrors = Partial<Record<CheckoutField, string>>;

const FIELD_ORDER: CheckoutField[] = [
  "fullName",
  "email",
  "phone",
  "addressLine1",
  "city",
  "postalCode",
  "country",
];

const FIELD_IDS: Record<CheckoutField, string> = {
  fullName: "checkout-name",
  email: "checkout-email",
  phone: "checkout-phone",
  addressLine1: "checkout-address1",
  addressLine2: "checkout-address2",
  city: "checkout-city",
  state: "checkout-state",
  postalCode: "checkout-postal",
  country: "checkout-country",
};

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

function hasShippingProfile(details: Partial<CustomerCheckoutDetails>): boolean {
  return Boolean(
    details.addressLine1?.trim() ||
      details.city?.trim() ||
      details.postalCode?.trim() ||
      details.country?.trim(),
  );
}

function validateCheckoutForm(form: CustomerCheckoutDetails): FieldErrors {
  const errors: FieldErrors = {};
  const nameError = getCustomerNameValidationError(form.fullName);
  if (nameError) errors.fullName = nameError;

  const email = form.email.trim();
  if (!email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";

  if (!form.phone.trim()) errors.phone = "Phone is required.";
  if (!form.addressLine1.trim()) errors.addressLine1 = "Address is required.";
  if (!form.city.trim()) errors.city = "City is required.";
  if (!form.postalCode.trim()) errors.postalCode = "Postal code is required.";
  if (!form.country.trim()) errors.country = "Country is required.";

  return errors;
}

export interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designId: string | null;
  productLabel: string;
  totalAmount: number;
  currencyCode: string;
  /** Bracelet How We Prepare selection frozen onto the order snapshot. */
  preparation?: BraceletPreparationSelection | null;
  onOrdered?: (orderId: string) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  designId,
  productLabel,
  totalAmount,
  currencyCode,
  preparation,
  onOrdered,
}: CheckoutDialogProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [form, setForm] = useState<CustomerCheckoutDetails>(EMPTY_CHECKOUT);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const defaultsLoadedForOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      defaultsLoadedForOpen.current = false;
      return;
    }
    if (defaultsLoadedForOpen.current) return;
    defaultsLoadedForOpen.current = true;

    setNotes("");
    setErrors({});
    setForm(EMPTY_CHECKOUT);
    setLoadingDefaults(true);

    void (async () => {
      try {
        const [me, orders] = await Promise.all([
          authApi.me().catch(() => null),
          ordersApi.list().catch(() => []),
        ]);

        const profile = me?.profile;
        const billing = (profile?.billingDetails ?? {}) as Partial<CustomerCheckoutDetails>;
        const latestOrder = orders[0];
        const fromOrder = (latestOrder?.customerDetails ?? {}) as Partial<CustomerCheckoutDetails>;

        const remembered = hasShippingProfile(fromOrder)
          ? {
              fullName: String(fromOrder.fullName ?? profile?.displayName ?? "").trim(),
              email: String(fromOrder.email ?? me?.user?.email ?? "").trim(),
              phone: String(fromOrder.phone ?? profile?.phone ?? "").trim(),
              addressLine1: String(fromOrder.addressLine1 ?? "").trim(),
              addressLine2: String(fromOrder.addressLine2 ?? "").trim(),
              city: String(fromOrder.city ?? "").trim(),
              state: String(fromOrder.state ?? "").trim(),
              postalCode: String(fromOrder.postalCode ?? "").trim(),
              country: String(fromOrder.country ?? "").trim(),
            }
          : hasShippingProfile(billing)
            ? {
                fullName: String(profile?.displayName ?? "").trim(),
                email: String(me?.user?.email ?? "").trim(),
                phone: String(profile?.phone ?? "").trim(),
                addressLine1: String(billing.addressLine1 ?? "").trim(),
                addressLine2: String(billing.addressLine2 ?? "").trim(),
                city: String(billing.city ?? "").trim(),
                state: String(billing.state ?? "").trim(),
                postalCode: String(billing.postalCode ?? "").trim(),
                country: String(billing.country ?? "").trim(),
              }
            : null;

        if (remembered) setForm(remembered);
        else setForm(EMPTY_CHECKOUT);
      } finally {
        setLoadingDefaults(false);
      }
    })();
  }, [open]);

  const update = (key: CheckoutField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!designId) {
      toast.error("Save your design before placing an order.");
      return;
    }

    const nextErrors = validateCheckoutForm(form);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      toast.error(
        firstInvalid === "fullName" ? CUSTOMER_NAME_REQUIRED_MESSAGE : "Please complete the required fields.",
      );
      window.requestAnimationFrame(() => {
        document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      });
      return;
    }

    setSubmitting(true);
    try {
      const customerDetails: CustomerCheckoutDetails = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2?.trim() || undefined,
        city: form.city.trim(),
        state: form.state?.trim() || undefined,
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
      };

      const order = await ordersApi.create({
        designId,
        customerDetails,
        notes: notes.trim() || undefined,
        preparation: preparation ?? undefined,
      });

      // Remember shipping for the next checkout.
      try {
        await authApi.updateProfile({
          displayName: customerDetails.fullName,
          phone: customerDetails.phone,
          billingDetails: {
            addressLine1: customerDetails.addressLine1,
            addressLine2: customerDetails.addressLine2,
            city: customerDetails.city,
            state: customerDetails.state,
            postalCode: customerDetails.postalCode,
            country: customerDetails.country,
          },
        });
      } catch {
        /* profile sync is best-effort */
      }

      toast.success(`Order ${order.id} submitted. We will review it shortly.`);
      onOpenChange(false);
      onOrdered?.(order.id);
      navigate(`/account/orders/${encodeURIComponent(order.id)}?placed=1`);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not submit order.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (field: CheckoutField) =>
    cn(errors[field] && "border-destructive focus-visible:ring-destructive/40");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit your order</DialogTitle>
          <DialogDescription>
            {productLabel} · {formatCurrency(totalAmount, currencyCode)}. We will review your order
            and contact you about payment and fulfilment — no payment is taken online yet.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={FIELD_IDS.fullName}>
                Full Name
                <RequiredMark />
              </Label>
              <Input
                id={FIELD_IDS.fullName}
                autoComplete="name"
                value={form.fullName}
                disabled={loadingDefaults}
                className={fieldClass("fullName")}
                aria-invalid={Boolean(errors.fullName)}
                onChange={(e) => update("fullName", e.target.value)}
              />
              {errors.fullName ? <p className="text-sm text-destructive">{errors.fullName}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={FIELD_IDS.email}>
                Email
                <RequiredMark />
              </Label>
              <Input
                id={FIELD_IDS.email}
                type="email"
                autoComplete="email"
                value={form.email}
                disabled={loadingDefaults}
                className={fieldClass("email")}
                aria-invalid={Boolean(errors.email)}
                onChange={(e) => update("email", e.target.value)}
              />
              {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={FIELD_IDS.phone}>
                Phone
                <RequiredMark />
              </Label>
              <Input
                id={FIELD_IDS.phone}
                type="tel"
                autoComplete="tel"
                value={form.phone}
                disabled={loadingDefaults}
                className={fieldClass("phone")}
                aria-invalid={Boolean(errors.phone)}
                onChange={(e) => update("phone", e.target.value)}
              />
              {errors.phone ? <p className="text-sm text-destructive">{errors.phone}</p> : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={FIELD_IDS.addressLine1}>
                Address
                <RequiredMark />
              </Label>
              <Input
                id={FIELD_IDS.addressLine1}
                autoComplete="address-line1"
                value={form.addressLine1}
                disabled={loadingDefaults}
                className={fieldClass("addressLine1")}
                aria-invalid={Boolean(errors.addressLine1)}
                onChange={(e) => update("addressLine1", e.target.value)}
              />
              {errors.addressLine1 ? (
                <p className="text-sm text-destructive">{errors.addressLine1}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={FIELD_IDS.addressLine2}>Apartment, suite, etc. (optional)</Label>
              <Input
                id={FIELD_IDS.addressLine2}
                autoComplete="address-line2"
                value={form.addressLine2 ?? ""}
                disabled={loadingDefaults}
                onChange={(e) => update("addressLine2", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={FIELD_IDS.city}>
                City
                <RequiredMark />
              </Label>
              <Input
                id={FIELD_IDS.city}
                autoComplete="address-level2"
                value={form.city}
                disabled={loadingDefaults}
                className={fieldClass("city")}
                aria-invalid={Boolean(errors.city)}
                onChange={(e) => update("city", e.target.value)}
              />
              {errors.city ? <p className="text-sm text-destructive">{errors.city}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={FIELD_IDS.state}>State / region (optional)</Label>
              <Input
                id={FIELD_IDS.state}
                autoComplete="address-level1"
                value={form.state ?? ""}
                disabled={loadingDefaults}
                onChange={(e) => update("state", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={FIELD_IDS.postalCode}>
                Postal code
                <RequiredMark />
              </Label>
              <Input
                id={FIELD_IDS.postalCode}
                autoComplete="postal-code"
                value={form.postalCode}
                disabled={loadingDefaults}
                className={fieldClass("postalCode")}
                aria-invalid={Boolean(errors.postalCode)}
                onChange={(e) => update("postalCode", e.target.value)}
              />
              {errors.postalCode ? (
                <p className="text-sm text-destructive">{errors.postalCode}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={FIELD_IDS.country}>
                Country
                <RequiredMark />
              </Label>
              <Input
                id={FIELD_IDS.country}
                autoComplete="country-name"
                placeholder="e.g. Singapore"
                value={form.country}
                disabled={loadingDefaults}
                className={fieldClass("country")}
                aria-invalid={Boolean(errors.country)}
                onChange={(e) => update("country", e.target.value)}
              />
              {errors.country ? <p className="text-sm text-destructive">{errors.country}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkout-notes">Order notes (optional)</Label>
            <Textarea
              id="checkout-notes"
              rows={3}
              value={notes}
              disabled={loadingDefaults}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || loadingDefaults || !designId}
          >
            {submitting ? "Submitting order…" : "Submit order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

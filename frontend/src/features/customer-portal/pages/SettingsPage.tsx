import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getCustomerNameValidationError } from "@/lib/customer-name";
import { authApi } from "@/services/api/auth";
import { isApiError } from "@/services/api/errors";
import { useAuth } from "@/state/auth/AuthProvider";
import type { BillingDetails } from "@bino-foundry/shared/types";

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ["auth-me"], queryFn: () => authApi.me() });

  const profile = meQuery.data?.profile;
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [phone, setPhone] = useState("");
  const [billing, setBilling] = useState<BillingDetails>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setPhone(profile.phone ?? "");
    setBilling((profile.billingDetails as BillingDetails) ?? {});
  }, [profile]);

  const updateBilling = (key: keyof BillingDetails, value: string) => {
    setBilling((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const nameError = getCustomerNameValidationError(displayName);
    if (nameError) {
      setDisplayNameError(nameError);
      return;
    }
    setSavingProfile(true);
    try {
      await authApi.updateProfile({
        displayName: displayName.trim(),
        phone,
        billingDetails: billing,
      });
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      toast.success("Account details updated.");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "Could not change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="portal-card space-y-4 p-6" onSubmit={(e) => void handleSaveProfile(e)}>
        <div>
          <h3 className="type-h3">Account details</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage your profile and billing information.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-email">Email</Label>
          <Input id="settings-email" value={user?.email ?? ""} disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-name">
            Customer Name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="settings-name"
            required
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (displayNameError) setDisplayNameError("");
            }}
          />
          {displayNameError ? <p className="text-sm text-destructive">{displayNameError}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-phone">Phone</Label>
          <Input id="settings-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <Separator />

        <p className="type-label text-muted-foreground">Billing address</p>
        <div className="space-y-2">
          <Label htmlFor="billing-line1">Address</Label>
          <Input
            id="billing-line1"
            value={billing.addressLine1 ?? ""}
            onChange={(e) => updateBilling("addressLine1", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-line2">Apartment, suite, etc.</Label>
          <Input
            id="billing-line2"
            value={billing.addressLine2 ?? ""}
            onChange={(e) => updateBilling("addressLine2", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billing-city">City</Label>
            <Input
              id="billing-city"
              value={billing.city ?? ""}
              onChange={(e) => updateBilling("city", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-state">State / region</Label>
            <Input
              id="billing-state"
              value={billing.state ?? ""}
              onChange={(e) => updateBilling("state", e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billing-postal">Postal code</Label>
            <Input
              id="billing-postal"
              value={billing.postalCode ?? ""}
              onChange={(e) => updateBilling("postalCode", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-country">Country</Label>
            <Input
              id="billing-country"
              autoComplete="country-name"
              placeholder="e.g. Singapore"
              value={billing.country ?? ""}
              onChange={(e) => updateBilling("country", e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save account details"}
        </Button>
      </form>

      <form className="portal-card space-y-4 p-6" onSubmit={(e) => void handleChangePassword(e)}>
        <div>
          <h3 className="type-h3">Password</h3>
          <p className="mt-1 text-sm text-muted-foreground">Update your sign-in password.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={savingPassword}>
          {savingPassword ? "Updating…" : "Change password"}
        </Button>
      </form>
    </div>
  );
}

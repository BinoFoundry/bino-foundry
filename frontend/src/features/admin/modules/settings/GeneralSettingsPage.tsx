import { useCallback, useRef } from "react";

import { AdminPage } from "../../components/AdminPage";
import { useAdminSectionRefresh } from "../../context/AdminSectionRefreshContext";
import { GeneralSettingsAdmin } from "./GeneralSettingsAdmin";
import { StrandRenderDefaultsAdmin } from "./StrandRenderDefaultsAdmin";
import { StrandRenderMigrationAdmin } from "./StrandRenderMigrationAdmin";
import { EmailDiagnosticsAdmin } from "./EmailDiagnosticsAdmin";
import { SmtpSettingsAdmin } from "./SmtpSettingsAdmin";

/** Site-wide settings (currency, SMTP, etc.). */
export function GeneralSettingsPage() {
  const reloadGeneralRef = useRef<(() => Promise<void>) | null>(null);
  const reloadSmtpRef = useRef<(() => Promise<void>) | null>(null);
  const reloadStrandRef = useRef<(() => Promise<void>) | null>(null);
  const reloadDiagnosticsRef = useRef<(() => Promise<void>) | null>(null);

  const reloadSettings = useCallback(async () => {
    await Promise.all([
      reloadGeneralRef.current?.() ?? Promise.resolve(),
      reloadSmtpRef.current?.() ?? Promise.resolve(),
      reloadDiagnosticsRef.current?.() ?? Promise.resolve(),
      reloadStrandRef.current?.() ?? Promise.resolve(),
    ]);
  }, []);

  const registerGeneralReload = useCallback((reload: () => Promise<void>) => {
    reloadGeneralRef.current = reload;
  }, []);

  const registerSmtpReload = useCallback((reload: () => Promise<void>) => {
    reloadSmtpRef.current = reload;
  }, []);

  const registerDiagnosticsReload = useCallback((reload: () => Promise<void>) => {
    reloadDiagnosticsRef.current = reload;
  }, []);

  const registerStrandReload = useCallback((reload: () => Promise<void>) => {
    reloadStrandRef.current = reload;
  }, []);

  useAdminSectionRefresh("Reload settings", reloadSettings);

  return (
    <AdminPage>
      <div className="mx-auto max-w-2xl space-y-8 pb-4">
        <GeneralSettingsAdmin embedded onRegisterReload={registerGeneralReload} />
        <StrandRenderDefaultsAdmin embedded onRegisterReload={registerStrandReload} />
        <StrandRenderMigrationAdmin embedded />
        <SmtpSettingsAdmin onRegisterReload={registerSmtpReload} />
        <EmailDiagnosticsAdmin onRegisterReload={registerDiagnosticsReload} />
      </div>
    </AdminPage>
  );
}

import { AdminPage } from "../../components/AdminPage";
import { GeneralSettingsAdmin } from "./GeneralSettingsAdmin";
import { SmtpSettingsAdmin } from "./SmtpSettingsAdmin";

/** Site-wide settings (currency, SMTP, etc.). */
export function GeneralSettingsPage() {
  return (
    <AdminPage>
      <div className="mx-auto max-w-2xl space-y-8 pb-4">
        <GeneralSettingsAdmin embedded />
        <SmtpSettingsAdmin />
      </div>
    </AdminPage>
  );
}

import { AdminPage } from "../../components/AdminPage";
import { GeneralSettingsAdmin } from "./GeneralSettingsAdmin";

/** Site-wide settings (currency, etc.). */
export function GeneralSettingsPage() {
  return (
    <AdminPage>
      <GeneralSettingsAdmin />
    </AdminPage>
  );
}

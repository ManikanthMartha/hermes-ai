import { ConnectionCenter } from "@/components/connections/connection-center";
import { AppShell } from "@/components/shell/app-shell";

export default function ConnectionsPage() {
  return (
    <AppShell>
      <ConnectionCenter />
    </AppShell>
  );
}

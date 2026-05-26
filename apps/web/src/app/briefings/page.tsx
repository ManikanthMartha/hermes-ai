import { NewspaperIcon } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function BriefingsPage() {
  return (
    <PlaceholderPage
      title="Briefings"
      label="morning operating view"
      icon={NewspaperIcon}
    >
      Manual and scheduled briefings will summarize calendar, action, connector,
      and freshness state after the connector watch foundation is live.
    </PlaceholderPage>
  );
}


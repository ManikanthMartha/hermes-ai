import { CalendarDaysIcon } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function MeetingsPage() {
  return (
    <PlaceholderPage
      title="Meetings"
      label="calendar and prep"
      icon={CalendarDaysIcon}
    >
      Calendar events and meeting prep briefs will land here once the Calendar
      vertical slice starts writing source-backed meeting records.
    </PlaceholderPage>
  );
}


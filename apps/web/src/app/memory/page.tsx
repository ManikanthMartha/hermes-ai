import { BrainIcon } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function MemoryPage() {
  return (
    <PlaceholderPage title="Memory is coming soon" label="workspace memory" icon={BrainIcon}>
      Hermes already uses conversation and action context behind the scenes.
      This page will become the place to inspect, edit, and forget saved
      preferences, decisions, people, and project facts.
    </PlaceholderPage>
  );
}

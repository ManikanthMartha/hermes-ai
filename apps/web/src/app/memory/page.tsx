import { BrainIcon } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function MemoryPage() {
  return (
    <PlaceholderPage title="Memory" label="personal context" icon={BrainIcon}>
      Basic explicit memory remains available through Ask. Source-backed
      operational memory hardening is deferred until connector-driven actions
      are working.
    </PlaceholderPage>
  );
}


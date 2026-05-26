import { Chat } from "@/components/chat/chat";
import { AppShell } from "@/components/shell/app-shell";

export default function AskPage() {
  return (
    <AppShell mainClassName="overflow-hidden">
      <Chat />
    </AppShell>
  );
}


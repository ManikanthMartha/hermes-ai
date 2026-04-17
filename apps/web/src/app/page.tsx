import { Button } from "@hermes/ui/components/button";

export default function Home() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-4 text-sm leading-loose">
        <h1 className="font-medium">Hermes AI</h1>
        <p className="text-muted-foreground">
          Multi-agent AI operations platform. Scaffold ready — agents, MCP
          servers, and memory come next.
        </p>
        <Button className="mt-2 w-fit">Get started</Button>
      </div>
    </div>
  );
}

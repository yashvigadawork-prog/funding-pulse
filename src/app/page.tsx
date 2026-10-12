import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <AppShell header={<TopBar />}>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">This week at a glance</h1>
        <p className="mt-2 text-muted-foreground">The dashboard appears here once the first digest has been built.</p>
      </div>
    </AppShell>
  );
}

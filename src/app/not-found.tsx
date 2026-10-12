import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState title="We could not find that page" action={<Button render={<Link href="/" />}>Back to the dashboard</Button>}>
        The link may be old or mistyped.
      </EmptyState>
    </div>
  );
}

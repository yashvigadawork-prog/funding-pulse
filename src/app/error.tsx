"use client";

import { ErrorRetry } from "@/components/common/states";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <ErrorRetry onRetry={reset} message="Something went wrong while showing this page. Your data is safe. Please try again." />
    </div>
  );
}

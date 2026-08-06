"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ensureDemoDocument } from "@/lib/demo";

export function DemoLauncher() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const doc = await ensureDemoDocument();
        router.replace(`/sheet/${doc.sheet.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build the demo roll.");
      }
    })();
  }, [router]);

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className="sprocket-rail w-40 animate-pulse opacity-40" aria-hidden="true" />
        <p className="mt-5 text-[15px] text-warm">
          {error ?? "Developing the demo roll…"}
        </p>
        <p className="mt-2 max-w-sm text-[13px] text-smoke">
          Thirty-six frames, generated in your browser — circled keepers, a couple of rejects,
          crop marks, a note and two pieces of tape.
        </p>
      </div>
    </div>
  );
}

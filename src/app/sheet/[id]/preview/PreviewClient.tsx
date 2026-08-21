"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SheetViewer } from "@/components/viewer/SheetViewer";
import { getStorage } from "@/lib/storage/local";
import { toSharedDocument } from "@/lib/document";
import type { SheetDocument } from "@/lib/types";

export function PreviewClient({ sheetId }: { sheetId: string }) {
  const [doc, setDoc] = useState<SheetDocument | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void (async () => {
      const found = await getStorage().loadDocument(sheetId);
      if (!found) setMissing(true);
      else setDoc(toSharedDocument(found));
    })();
  }, [sheetId]);

  if (missing) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-[15px] text-warm">That sheet isn’t on this device.</p>
          <Link href="/binder" className="label mt-3 inline-block hover:text-warm">
            ← All sheets
          </Link>
        </div>
      </div>
    );
  }

  if (!doc) return <div className="grid min-h-dvh place-items-center"><span className="label">Loading…</span></div>;
  return <SheetViewer doc={doc} mode="preview" allowComments={false} allowDownload />;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SheetViewer } from "@/components/viewer/SheetViewer";
import { Button, inputClass } from "@/components/ui/primitives";
import { toSharedDocument } from "@/lib/document";
import { verifyPassword } from "@/lib/share";
import { getStorage } from "@/lib/storage/local";
import type { SheetDocument } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "expired" }
  | { kind: "locked"; doc: SheetDocument; hash: string }
  | { kind: "ready"; doc: SheetDocument; canComment: boolean; canDownload: boolean };

export function ShareClient({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const doc = await getStorage().findByShareToken(token);
      if (!doc) return setState({ kind: "missing" });
      const link = doc.shareLinks.find((l) => l.token === token);
      if (!link) return setState({ kind: "missing" });
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) return setState({ kind: "expired" });
      if (link.passwordHash) return setState({ kind: "locked", doc, hash: link.passwordHash });
      setState({
        kind: "ready",
        doc: toSharedDocument(doc),
        canComment: link.permission === "comment" && doc.sheet.commentsEnabled,
        canDownload: doc.sheet.downloadsEnabled,
      });
    })();
  }, [token]);

  if (state.kind === "loading") {
    return <Centered>Opening the sheet…</Centered>;
  }

  if (state.kind === "missing") {
    return (
      <Centered>
        <p className="max-w-md text-center text-[14px] leading-relaxed text-bone">
          This link doesn’t resolve to a sheet in this browser. Share links in the local-storage
          build only open on the device that created them — connect Supabase for links that
          work anywhere.
        </p>
        <Link href="/" className="label mt-4 hover:text-warm">
          ← Film Contact Sheet
        </Link>
      </Centered>
    );
  }

  if (state.kind === "expired") {
    return <Centered>This share link has expired.</Centered>;
  }

  if (state.kind === "locked") {
    return (
      <Centered>
        <form
          className="w-full max-w-xs space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await verifyPassword(password, state.hash);
            if (!ok) return setError("That password doesn’t match.");
            const link = state.doc.shareLinks.find((l) => l.token === token)!;
            setState({
              kind: "ready",
              doc: toSharedDocument(state.doc),
              canComment: link.permission === "comment" && state.doc.sheet.commentsEnabled,
              canDownload: state.doc.sheet.downloadsEnabled,
            });
          }}
        >
          <p className="label text-center">Password required</p>
          <input
            type="password"
            className={inputClass}
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-[12px] text-darkroom">{error}</p> : null}
          <Button variant="primary" type="submit" className="w-full">
            Open sheet
          </Button>
        </form>
      </Centered>
    );
  }

  return (
    <SheetViewer
      doc={state.doc}
      mode="share"
      allowComments={state.canComment}
      allowDownload={state.canDownload}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center">
        <div className="sprocket-rail mb-5 w-32 opacity-30" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

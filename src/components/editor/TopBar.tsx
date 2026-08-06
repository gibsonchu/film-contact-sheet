"use client";

import Link from "next/link";
import { useEditor } from "@/lib/store/editor";
import { Button, IconButton, cx } from "@/components/ui/primitives";
import { IconDownload, IconRedo, IconShare, IconUndo } from "@/components/icons";

export function TopBar({
  onExport,
  onShare,
}: {
  onExport: () => void;
  onShare: () => void;
}) {
  const doc = useEditor((s) => s.doc);
  const saveState = useEditor((s) => s.saveState);
  const dirty = useEditor((s) => s.dirty);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const updateSheet = useEditor((s) => s.updateSheet);

  if (!doc) return null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 bg-charcoal px-3">
      <Link
        href="/projects"
        className="label shrink-0 hover:text-warm"
        aria-label="Back to all contact sheets"
      >
        ← Sheets
      </Link>

      <div className="h-6 w-px bg-white/10" aria-hidden="true" />

      <input
        value={doc.sheet.title}
        onChange={(e) => updateSheet({ title: e.target.value })}
        aria-label="Contact sheet title"
        className="min-w-0 flex-1 truncate border-none bg-transparent text-[15px] tracking-tight text-warm outline-none focus:bg-white/5 focus:px-2"
      />

      <SaveIndicator state={saveState} dirty={dirty} />

      <div className="hidden items-center gap-1 sm:flex">
        <IconButton label="Undo (⌘Z)" onClick={undo} disabled={past === 0}>
          <IconUndo className="h-4 w-4" />
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={future === 0}>
          <IconRedo className="h-4 w-4" />
        </IconButton>
      </div>

      <Link
        href={`/sheet/${doc.sheet.id}/preview`}
        className="label hidden hover:text-warm md:inline"
      >
        Preview
      </Link>
      <Link
        href={`/sheet/${doc.sheet.id}/postcard`}
        className="label hidden hover:text-warm md:inline"
      >
        Postcard
      </Link>

      <Button variant="ghost" size="sm" onClick={onShare}>
        <IconShare className="h-4 w-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      <Button variant="primary" size="sm" onClick={onExport}>
        <IconDownload className="h-4 w-4" />
        Export
      </Button>
    </header>
  );
}

function SaveIndicator({ state, dirty }: { state: string; dirty: boolean }) {
  const map: Record<string, { text: string; tone: string }> = {
    idle: { text: dirty ? "Unsaved" : "Saved", tone: "text-smoke" },
    saving: { text: "Saving…", tone: "text-grease" },
    saved: { text: "Saved", tone: "text-smoke" },
    offline: { text: "Offline — kept locally", tone: "text-grease" },
    error: { text: "Save failed", tone: "text-darkroom" },
  };
  const s = map[state] ?? map.idle;
  return (
    <span
      className={cx("label hidden shrink-0 sm:inline", s.tone)}
      role="status"
      aria-live="polite"
    >
      {s.text}
    </span>
  );
}

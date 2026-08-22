"use client";

import Link from "next/link";
import { useEditor } from "@/lib/store/editor";
import { Button, IconButton, cx } from "@/components/ui/primitives";
import { IconRedo, IconUndo } from "@/components/icons";

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
    <header className="hair-b flex h-9 shrink-0 items-center gap-4 px-3">
      <Link
        href="/sheets"
        className="label shrink-0 hover:text-warm"
        aria-label="Back to all contact sheets"
      >
        Sheets
      </Link>

      <input
        value={doc.sheet.title}
        onChange={(e) => updateSheet({ title: e.target.value })}
        aria-label="Contact sheet title"
        className="min-w-0 flex-1 truncate border-none bg-transparent text-[12px] text-warm outline-none placeholder:text-smoke"
      />

      <SaveIndicator state={saveState} dirty={dirty} />

      <div className="hidden items-center gap-0.5 sm:flex">
        <IconButton label="Undo (⌘Z)" onClick={undo} disabled={past === 0}>
          <IconUndo className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" onClick={redo} disabled={future === 0}>
          <IconRedo className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {/* The default arrangement, for getting back to it. */}
      <Link
        href={`/sheet/${doc.sheet.id}`}
        className="label hidden hover:text-warm md:inline"
        title="Back to the dock layout"
      >
        Dock layout
      </Link>
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

      <button type="button" onClick={onShare} className="label hover:text-warm">
        Share
      </button>
      <Button variant="primary" size="sm" onClick={onExport}>
        Export
      </Button>
    </header>
  );
}

function SaveIndicator({ state, dirty }: { state: string; dirty: boolean }) {
  const map: Record<string, { text: string; tone: string }> = {
    idle: { text: dirty ? "Unsaved" : "Saved", tone: "text-smoke" },
    saving: { text: "Saving", tone: "text-smoke" },
    saved: { text: "Saved", tone: "text-smoke" },
    offline: { text: "Offline", tone: "text-smoke" },
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

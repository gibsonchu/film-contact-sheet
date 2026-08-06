"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Segmented, cx, inputClass } from "@/components/ui/primitives";
import { ensureDemoDocument } from "@/lib/demo";
import { createDocument, uid } from "@/lib/document";
import { getStorage, summarize } from "@/lib/storage/local";
import { TEMPLATES } from "@/lib/templates";
import type { ProjectSummary, SheetDocument } from "@/lib/types";

type SortKey = "updated" | "created" | "title" | "photos";
type View = "active" | "archived" | "deleted";

export function ProjectLibrary() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<View>("active");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const storage = getStorage();
    const all = await storage.listProjects({ includeArchived: true, includeDeleted: true });
    setProjects(all);
    setLoading(false);
    const entries: [string, string][] = [];
    for (const p of all) {
      if (!p.coverThumb) continue;
      const url = await storage.getAssetUrl(p.coverThumb);
      if (url) entries.push([p.id, url]);
    }
    setThumbs(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    // Loading the library from IndexedDB is exactly the "subscribe to an
    // external system" case; the state update happens in the async callback.
    let cancelled = false;
    void (async () => {
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const visible = useMemo(() => {
    const filtered = projects.filter((p) => {
      if (view === "deleted") return Boolean(p.deletedAt);
      if (view === "archived") return Boolean(p.archivedAt) && !p.deletedAt;
      return !p.archivedAt && !p.deletedAt;
    });
    const q = query.trim().toLowerCase();
    const searched = q ? filtered.filter((p) => p.title.toLowerCase().includes(q)) : filtered;
    return [...searched].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "photos":
          return b.photoCount - a.photoCount;
        case "created":
          return b.createdAt.localeCompare(a.createdAt);
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
  }, [projects, view, query, sort]);

  async function mutate(id: string, fn: (doc: SheetDocument) => SheetDocument) {
    const storage = getStorage();
    const doc = await storage.loadDocument(id);
    if (!doc) return;
    await storage.saveDocument(fn(doc));
    await refresh();
  }

  async function duplicate(id: string) {
    const storage = getStorage();
    const doc = await storage.loadDocument(id);
    if (!doc) return;
    const newId = uid("sheet");
    const copy: SheetDocument = {
      ...doc,
      sheet: {
        ...doc.sheet,
        id: newId,
        title: `${doc.sheet.title} copy`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sharingMode: "private",
      },
      photos: doc.photos.map((p) => ({ ...p, contactSheetId: newId })),
      annotations: doc.annotations.map((a) => ({ ...a, contactSheetId: newId })),
      shareLinks: [],
      comments: [],
    };
    await storage.saveDocument(copy);
    await refresh();
  }

  async function blankSheet() {
    setBusy(true);
    const doc = createDocument({ title: "Untitled Roll" });
    await getStorage().saveDocument(doc);
    router.push(`/sheet/${doc.sheet.id}`);
  }

  async function openDemo() {
    setBusy(true);
    const doc = await ensureDemoDocument();
    router.push(`/sheet/${doc.sheet.id}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="label hover:text-warm">
            Film Contact Sheet
          </Link>
          <h1 className="mt-2 text-3xl tracking-tight text-warm">Contact sheets</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openDemo} disabled={busy}>
            Demo roll
          </Button>
          <Button onClick={blankSheet} disabled={busy}>
            Blank sheet
          </Button>
          <Link href="/new">
            <Button variant="primary">Upload photographs</Button>
          </Link>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sheets…"
          aria-label="Search sheets"
          className={`${inputClass} max-w-xs`}
        />
        <div className="w-56">
          <Segmented
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
              { value: "updated", label: "Edited" },
              { value: "created", label: "Created" },
              { value: "title", label: "Title" },
              { value: "photos", label: "Frames" },
            ]}
          />
        </div>
        <div className="w-52">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "deleted", label: "Deleted" },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <p className="label">Reading the shelf…</p>
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-white/12 px-6 py-16 text-center">
          <div className="sprocket-rail mx-auto mb-5 w-40 opacity-30" aria-hidden="true" />
          <p className="text-[15px] text-warm">
            {view === "active" ? "Nothing on the light table yet." : `No ${view} sheets.`}
          </p>
          {view === "active" ? (
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-smoke">
              Upload a shoot, or open the demo roll to see what a finished sheet looks like.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <li key={p.id} className="group border border-white/10 bg-charcoal/60">
              <Link href={`/sheet/${p.id}`} className="block">
                <div className="texture-noise aspect-[4/3] overflow-hidden border-b border-white/10 bg-black">
                  {thumbs[p.id] ? (
                    <img src={thumbs[p.id]} alt="" className="h-full w-full object-cover opacity-90" />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <span className="label">No frames</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h2 className="truncate text-[15px] tracking-tight text-warm">{p.title}</h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">
                    {p.photoCount} frames · {TEMPLATES[p.templateId]?.name ?? p.templateId} ·{" "}
                    {p.sharingMode === "private" ? "private" : "shared"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-smoke/70">
                    Edited {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
              <div className="flex flex-wrap gap-2 border-t border-white/8 px-3 py-2 text-[11px] text-smoke">
                <button type="button" className="hover:text-warm" onClick={() => duplicate(p.id)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="hover:text-warm"
                  onClick={() => {
                    const title = prompt("Rename sheet", p.title);
                    if (title) void mutate(p.id, (d) => ({ ...d, sheet: { ...d.sheet, title } }));
                  }}
                >
                  Rename
                </button>
                {p.deletedAt ? (
                  <>
                    <button
                      type="button"
                      className="hover:text-warm"
                      onClick={() => mutate(p.id, (d) => ({ ...d, sheet: { ...d.sheet, deletedAt: null } }))}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="text-darkroom hover:underline"
                      onClick={async () => {
                        if (!confirm(`Permanently delete “${p.title}” and its images?`)) return;
                        await getStorage().deleteDocument(p.id, { hard: true });
                        await refresh();
                      }}
                    >
                      Delete forever
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="hover:text-warm"
                      onClick={() =>
                        mutate(p.id, (d) => ({
                          ...d,
                          sheet: { ...d.sheet, archivedAt: p.archivedAt ? null : new Date().toISOString() },
                        }))
                      }
                    >
                      {p.archivedAt ? "Unarchive" : "Archive"}
                    </button>
                    <button
                      type="button"
                      className={cx("hover:text-darkroom")}
                      onClick={() => mutate(p.id, (d) => ({ ...d, sheet: { ...d.sheet, deletedAt: new Date().toISOString() } }))}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-[11px] text-smoke">
        Sheets are stored in this browser. Connect Supabase to sync them to an account —
        see the README for the migration and environment variables.
      </p>
    </div>
  );
}

export { summarize };

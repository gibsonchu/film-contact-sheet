"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteMark } from "@/components/SiteMark";
import { Button, Segmented, cx } from "@/components/ui/primitives";
import { ensureDemoDocument } from "@/lib/demo";
import { uid } from "@/lib/document";
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

  async function openDemo() {
    setBusy(true);
    const doc = await ensureDemoDocument();
    router.push(`/sheet/${doc.sheet.id}`);
  }

  return (
    <div className="min-h-dvh">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <button type="button" onClick={openDemo} disabled={busy} className="label hover:text-warm">
            Demo
          </button>
          <Link href="/new">
            <Button variant="primary" size="sm">
              New Sheet
            </Button>
          </Link>
        </div>
      </header>

      <div className="hair-b">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-3 py-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search sheets"
            className="w-56 border border-[var(--line)] bg-transparent px-2.5 py-1.5 text-[12px] text-warm outline-none placeholder:text-smoke focus:border-warm"
          />

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="label shrink-0">Sort By</span>
              <Segmented
                label="Sort by"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "updated", label: "Last Edited" },
                  { value: "created", label: "Created" },
                  { value: "title", label: "Title" },
                ]}
              />
            </div>

            <span className="h-5 w-px bg-[var(--line)]" aria-hidden="true" />

            <div className="flex items-center gap-2">
              <span className="label shrink-0">Filter By</span>
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
        </div>
      </div>

      {loading ? (
        <p className="label px-3 py-4">Reading the shelf…</p>
      ) : visible.length === 0 ? (
        <div className="mx-auto max-w-4xl px-3 py-20 text-center">
          <p className="text-[12px] text-warm">
            {view === "active" ? "Nothing on the light table yet." : `No ${view} sheets.`}
          </p>
          {view === "active" ? (
            <p className="label mx-auto mt-1 max-w-xs">
              Upload a shoot, or open the demo roll to see what a finished sheet looks like.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-x-4 gap-y-4 px-3 py-5 sm:grid-cols-3">
          {visible.map((p) => (
            <li key={p.id} className="group">
              <Link href={`/sheet/${p.id}`} className="block">
                <div className="flex aspect-[4/3] items-end justify-center overflow-hidden">
                  {thumbs[p.id] ? (
                    <img src={thumbs[p.id]} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="label m-auto">Empty</span>
                  )}
                </div>
                <div className="mt-1.5 leading-[1.35]">
                  <p className="truncate text-[11px] text-warm">{p.title}</p>
                  <p className="label truncate">
                    {p.photoCount} fr · {TEMPLATES[p.templateId]?.name ?? p.templateId}
                  </p>
                  <p className="label truncate opacity-70">
                    {new Date(p.updatedAt).toLocaleDateString()}
                    {p.sharingMode === "private" ? "" : " · shared"}
                  </p>
                </div>
              </Link>
              <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-smoke opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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

      <p className="label mx-auto max-w-4xl px-3 pb-6">
        Sheets are only stored locally on this browser. Download your contact sheets to share with friends and family.
      </p>
    </div>
  );
}

export { summarize };

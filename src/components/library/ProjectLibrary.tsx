"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Segmented, cx } from "@/components/ui/primitives";
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
    <div className="min-h-dvh">
      <header className="hair-b flex h-9 items-center gap-4 px-3">
        <Link href="/" className="text-[12px] text-warm">
          Film Contact Sheet
        </Link>
        <span className="label">Sheets</span>
        <div className="flex-1" />
        <button type="button" onClick={openDemo} disabled={busy} className="label hover:text-warm">
          Demo roll
        </button>
        <button type="button" onClick={blankSheet} disabled={busy} className="label hover:text-warm">
          Blank sheet
        </button>
        <Link href="/new">
          <Button variant="primary" size="sm">
            Upload
          </Button>
        </Link>
      </header>

      <div className="hair-b flex flex-wrap items-center gap-3 px-3 py-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search sheets"
          className="w-40 border-none bg-transparent text-[12px] text-warm outline-none placeholder:text-smoke"
        />
        <div className="w-52">
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
        <div className="w-48">
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
        <p className="label px-3 py-4">Reading the shelf…</p>
      ) : visible.length === 0 ? (
        <div className="px-3 py-20 text-center">
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
        <ul className="grid grid-cols-2 gap-x-4 gap-y-7 px-3 py-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
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

      <p className="label px-3 pb-6">
        Sheets are stored in this browser. Connect Supabase to sync them to an account.
      </p>
    </div>
  );
}

export { summarize };

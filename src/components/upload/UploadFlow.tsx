"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { SiteMark } from "@/components/SiteMark";
import { Button, Field, cx, inputClass } from "@/components/ui/primitives";
import { chunkForSheets, createDocument, createPhoto, renumber, sheetTitleForChunk } from "@/lib/document";
import { ACCEPT_ATTR, formatBytes, processImage, validateFile } from "@/lib/images";
import { filesFromDrop, pathOf, sortFiles } from "@/lib/upload";
import { getStorage } from "@/lib/storage/local";
import { MAX_PHOTOS_PER_SHEET } from "@/lib/types";

interface Candidate {
  id: string;
  file: File;
  previewUrl: string;
  error: string | null;
}

export function UploadFlow() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [meta, setMeta] = useState({
    title: "",
    rollNumber: "",
    dateShot: "",
    photographer: "",
    location: "",
    filmStock: "",
    camera: "",
    description: "",
  });

  const addFiles = useCallback((files: File[]) => {
    // A folder pick arrives unsorted and full of junk; keep only photographs,
    // in the order they sit in the folder.
    const next: Candidate[] = sortFiles(files.filter((f) => !/^\./.test(f.name))).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      error: validateFile(file),
    }));
    setCandidates((prev) => [...prev, ...next]);
  }, []);

  const valid = candidates.filter((c) => !c.error);
  const sheetCount = Math.max(1, Math.ceil(valid.length / MAX_PHOTOS_PER_SHEET));

  async function create() {
    if (valid.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: valid.length });
    const storage = getStorage();
    const batches = chunkForSheets(valid, MAX_PHOTOS_PER_SHEET);
    const baseTitle = meta.title.trim() || "Untitled Roll";
    const ids: string[] = [];
    let done = 0;

    try {
      for (const [batchIndex, batch] of batches.entries()) {
        // New sheets start on the default template; it is switched from the
        // editor's inspector, where the change can be seen on the sheet.
        const doc = createDocument({
          ...meta,
          title: sheetTitleForChunk(baseTitle, batchIndex, batches.length),
        });
        for (const [i, candidate] of batch.entries()) {
          const processed = await processImage(candidate.file);
          const storagePath = `${doc.sheet.id}/${i}-${candidate.file.name}`;
          const thumbPath = `${doc.sheet.id}/${i}-thumb.jpg`;
          await storage.putAsset(storagePath, processed.preview);
          await storage.putAsset(thumbPath, processed.thumb);
          doc.photos.push(
            createPhoto(doc.sheet.id, {
              storagePath,
              thumbPath,
              originalFilename: processed.originalFilename,
              mimeType: processed.mimeType,
              width: processed.width,
              height: processed.height,
              fileSize: processed.fileSize,
              position: i,
              frameNumber: i + 1,
            }),
          );
          done += 1;
          setProgress({ done, total: valid.length });
        }
        doc.photos = renumber(doc.photos);
        await storage.saveDocument(doc);
        ids.push(doc.sheet.id);
      }
      router.push(`/sheet/${ids[0]}`);
    } catch (err) {
      console.error(err);
      setBusy(false);
      alert(err instanceof Error ? err.message : "Something went wrong while building the sheet.");
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() {
    setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void (async () => {
      // Folders are walked recursively; a plain multi-file drop is unaffected.
      setScanning(true);
      try {
        addFiles(await filesFromDrop(e.dataTransfer));
      } finally {
        setScanning(false);
      }
    })();
  }

  return (
    <div className="min-h-dvh">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <Link href="/projects" className="label hover:text-warm">
            All sheets
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-3 py-5">
        <section>
          <h2 className="mb-2 text-[13px] text-warm">Photographs</h2>

          {candidates.length === 0 ? (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cx(
                "flex flex-col items-center justify-center border px-6 py-16 text-center transition-colors",
                dragging ? "border-warm" : "border-[var(--line)]",
              )}
            >
              <p className="text-[12px] text-warm">Drop photographs or a folder here</p>
              <p className="label mt-1">
                JPG, PNG, WebP or HEIC · up to {MAX_PHOTOS_PER_SHEET} frames per sheet
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button onClick={() => inputRef.current?.click()}>Choose files</Button>
                <Button variant="ghost" onClick={() => folderRef.current?.click()}>
                  Choose a folder
                </Button>
              </div>
              {scanning ? (
                <p className="label mt-3" role="status">
                  Reading folder…
                </p>
              ) : null}
            </div>
          ) : (
            // Once there are photographs, the panel shows them — a big empty
            // dropzone sitting above a full roll reads as if nothing had
            // loaded. The whole area still accepts a drop.
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cx(
                "border p-3 transition-colors",
                dragging ? "border-warm" : "border-[var(--line)]",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] text-warm">
                  {valid.length} frame{valid.length === 1 ? "" : "s"} ready
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                    Add photos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => folderRef.current?.click()}>
                    Add folder
                  </Button>
                </div>
              </div>
              {scanning ? (
                <p className="label mt-2" role="status">
                  Reading folder…
                </p>
              ) : null}
              <ul className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
                {candidates.map((c) => (
                  <li key={c.id} className="relative">
                    <img
                      src={c.previewUrl}
                      alt=""
                      className={cx("aspect-[3/2] w-full bg-[#151515] object-cover", c.error && "opacity-25")}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(c.previewUrl);
                        setCandidates((prev) => prev.filter((x) => x.id !== c.id));
                      }}
                      aria-label={`Remove ${c.file.name}`}
                      className="absolute right-0 top-0 grid h-4 w-4 place-items-center bg-black/80 text-[10px] text-bone hover:text-darkroom"
                    >
                      ✕
                    </button>
                    <p className="mt-0.5 truncate text-[9px] text-smoke" title={pathOf(c.file)}>
                      {c.error ?? formatBytes(c.file.size)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          {/* webkitdirectory is the only way to pick a folder; it is
              non-standard but supported everywhere this app runs. */}
          <input
            ref={folderRef}
            type="file"
            multiple
            className="sr-only"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />

          {valid.length > MAX_PHOTOS_PER_SHEET ? (
            <p className="mt-3 border border-[var(--line)] p-2 text-[11px] text-bone">
              {valid.length} frames is more than one 35mm roll. They’ll be split into{" "}
              <strong>{sheetCount} contact sheets</strong> of up to {MAX_PHOTOS_PER_SHEET} frames
              each — you’ll land on the first one, and the rest are in your library.
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="mb-2 text-[13px] text-warm">Roll details</h2>
          <div className="space-y-3">
              <Field label="Title">
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    placeholder="Harbour Road, Winter"
                    value={meta.title}
                    onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Roll number">
                  {(id) => (
                    <input
                      id={id}
                      className={inputClass}
                      value={meta.rollNumber}
                      onChange={(e) => setMeta({ ...meta, rollNumber: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="Date">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      className={inputClass}
                      value={meta.dateShot}
                      onChange={(e) => setMeta({ ...meta, dateShot: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              <Field label="Photographer">
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    value={meta.photographer}
                    onChange={(e) => setMeta({ ...meta, photographer: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Location">
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    value={meta.location}
                    onChange={(e) => setMeta({ ...meta, location: e.target.value })}
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Film stock">
                  {(id) => (
                    <input
                      id={id}
                      className={inputClass}
                      placeholder="Generic Pan 400"
                      value={meta.filmStock}
                      onChange={(e) => setMeta({ ...meta, filmStock: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="Camera">
                  {(id) => (
                    <input
                      id={id}
                      className={inputClass}
                      value={meta.camera}
                      onChange={(e) => setMeta({ ...meta, camera: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              <Field label="Description">
                {(id) => (
                  <textarea
                    id={id}
                    rows={2}
                    className={inputClass}
                    value={meta.description}
                    onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                  />
                )}
              </Field>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={create} disabled={busy || valid.length === 0}>
            {busy ? `Building… ${progress.done}/${progress.total}` : `Build ${sheetCount > 1 ? `${sheetCount} sheets` : "the sheet"}`}
          </Button>
          {busy ? (
            <div className="h-px flex-1 bg-white/15" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
              <div
                className="h-full bg-warm transition-[width]"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

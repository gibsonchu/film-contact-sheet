"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Button, Field, Panel, cx, inputClass } from "@/components/ui/primitives";
import { chunkForSheets, createDocument, createPhoto, renumber, sheetTitleForChunk } from "@/lib/document";
import { ACCEPT_ATTR, formatBytes, processImage, validateFile } from "@/lib/images";
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
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dragging, setDragging] = useState(false);
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: Candidate[] = Array.from(files).map((file) => ({
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
        // New sheets start on Classic 35mm; the template is switched from the
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-3xl tracking-tight text-warm">New Contact Sheet</h1>
        <Link href="/projects" className="label hover:text-warm">
          ← All sheets
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cx(
              "texture-noise flex flex-col items-center justify-center border-2 border-dashed px-6 py-14 text-center transition-colors",
              dragging ? "border-grease bg-grease/5" : "border-white/15",
            )}
          >
            <div className="sprocket-rail mb-5 w-40 opacity-40" aria-hidden="true" />
            <p className="text-[15px] text-warm">Drop photographs here</p>
            <p className="mt-1 text-[13px] text-smoke">
              JPG, PNG, WebP or HEIC · up to {MAX_PHOTOS_PER_SHEET} frames per sheet
            </p>
            <Button className="mt-5" onClick={() => inputRef.current?.click()}>
              Choose files
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {valid.length > MAX_PHOTOS_PER_SHEET ? (
            <p className="border border-grease/40 bg-grease/8 p-3 text-[13px] text-grease">
              {valid.length} frames is more than one 35mm roll. They’ll be split into{" "}
              <strong>{sheetCount} contact sheets</strong> of up to {MAX_PHOTOS_PER_SHEET} frames
              each — you’ll land on the first one, and the rest are in your library.
            </p>
          ) : null}

          {candidates.length > 0 ? (
            <Panel title={`${valid.length} frame${valid.length === 1 ? "" : "s"} ready`}>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {candidates.map((c) => (
                  <li key={c.id} className="relative">
                    <img
                      src={c.previewUrl}
                      alt=""
                      className={cx(
                        "aspect-[3/2] w-full border border-white/10 object-cover",
                        c.error && "opacity-30",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(c.previewUrl);
                        setCandidates((prev) => prev.filter((x) => x.id !== c.id));
                      }}
                      aria-label={`Remove ${c.file.name}`}
                      className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-black/80 text-[11px] text-bone hover:text-darkroom"
                    >
                      ✕
                    </button>
                    <p className="mt-1 truncate font-mono text-[9px] text-smoke" title={c.file.name}>
                      {c.error ?? formatBytes(c.file.size)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Roll details">
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
          </Panel>

          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={create} disabled={busy || valid.length === 0}>
              {busy ? `Building… ${progress.done}/${progress.total}` : `Build ${sheetCount > 1 ? `${sheetCount} sheets` : "the sheet"}`}
            </Button>
            {busy ? (
              <div className="h-1 flex-1 bg-white/10" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total}>
                <div
                  className="h-full bg-grease transition-[width]"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

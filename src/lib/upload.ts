"use client";

import { validateFile } from "./images";

/**
 * Collecting photographs from a folder.
 *
 * Two routes reach the same place: the directory picker (`webkitdirectory`,
 * which hands back a flat FileList with `webkitRelativePath` set) and dropping
 * a folder onto the page (which needs the entry API walked by hand). Both end
 * up sorted the way a photographer expects — the order the files appear in the
 * folder, with numbers compared as numbers so IMG_9 precedes IMG_10.
 */

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** macOS, Windows and Lightroom all leave debris in photo folders. */
function isJunk(file: File): boolean {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const name = file.name;
  if (name.startsWith(".")) return true;
  if (/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i.test(path)) return true;
  return false;
}

export function pathOf(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export function sortFiles(files: File[]): File[] {
  return [...files].sort((a, b) => collator.compare(pathOf(a), pathOf(b)));
}

/** Drops junk and anything that isn't an image we accept. */
export function keepImages(files: File[]): File[] {
  return files.filter((file) => !isJunk(file) && validateFile(file) === null);
}

/**
 * Everything dropped, including the contents of any folders. Falls back to the
 * plain file list on browsers without the directory entry API.
 */
export async function filesFromDrop(transfer: DataTransfer): Promise<File[]> {
  const items = Array.from(transfer.items ?? []);
  const entries = items
    .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length === 0) return sortFiles(Array.from(transfer.files));

  const out: File[] = [];
  for (const entry of entries) await walkEntry(entry, out);
  return sortFiles(out);
}

async function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) =>
      (entry as FileSystemFileEntry).file(
        (f) => resolve(f),
        () => resolve(null),
      ),
    );
    if (file) out.push(file);
    return;
  }
  if (!entry.isDirectory) return;

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries yields at most 100 at a time and must be called until it
  // returns an empty batch, or large folders come back truncated.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) =>
      reader.readEntries(
        (results) => resolve(results),
        () => resolve([]),
      ),
    );
    if (batch.length === 0) break;
    for (const child of batch) await walkEntry(child, out);
  }
}

/** True when the drag carries at least one directory. */
export function dragHasFolder(transfer: DataTransfer): boolean {
  return Array.from(transfer.items ?? []).some(
    (item) => typeof item.webkitGetAsEntry === "function" && item.webkitGetAsEntry()?.isDirectory,
  );
}

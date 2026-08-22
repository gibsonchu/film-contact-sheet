"use client";

import { cloudAdapter } from "./storage/cloud";
import { localAdapter } from "./storage/local";
import type { SheetDocument } from "./types";

/**
 * A sheet is "Saved Online" exactly when its local copy's userId is set —
 * the same id doubles as the cloud row's primary key (both adapters use
 * doc.sheet.id), so there's no separate mapping table to keep in sync.
 */
export function isSavedOnline(doc: SheetDocument): boolean {
  return Boolean(doc.sheet.userId);
}

/**
 * Copies a local-only sheet's photos, thumbs and rows into Supabase. Purely
 * the cloud side — callers are responsible for also marking the local copy
 * linked (stamping sheet.userId) through whatever local-save path is
 * appropriate for where they're calling from: the live editor store has its
 * own autosave, so it should go through that rather than writing to
 * IndexedDB directly and racing it. Returns the document as saved, with
 * userId set, for the caller to persist locally itself.
 */
export async function saveSheetOnline(doc: SheetDocument, userId: string): Promise<SheetDocument> {
  for (const photo of doc.photos) {
    for (const key of [photo.storagePath, photo.thumbPath]) {
      if (!key) continue;
      const blob = await localAdapter.getAssetBlob(key);
      if (blob) await cloudAdapter.putAsset(key, blob);
    }
  }

  const linked: SheetDocument = { ...doc, sheet: { ...doc.sheet, userId } };
  await cloudAdapter.saveDocument(linked);
  return linked;
}

/** Removes the cloud copy only. The local sheet is untouched — callers mark
 *  it Local Only again by clearing sheet.userId through their own local
 *  save path, same as saveSheetOnline. */
export async function deleteCloudCopy(sheetId: string): Promise<void> {
  await cloudAdapter.deleteDocument(sheetId, { hard: true });
}

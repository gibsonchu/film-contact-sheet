"use client";

import { clear, createStore, del, get, keys, set } from "idb-keyval";
import { migrateDocument } from "../document";
import type { ProjectSummary, SheetDocument } from "../types";
import type { StorageAdapter } from "./adapter";

const docStore = createStore("fcs-documents", "documents");
const assetStore = createStore("fcs-assets", "assets");

const urlCache = new Map<string, string>();

/**
 * Local-first adapter. Documents (JSON) and image blobs live in two separate
 * IndexedDB databases so a document can be read cheaply without pulling any
 * image bytes into memory.
 */
class LocalAdapter implements StorageAdapter {
  readonly mode = "local" as const;

  async listProjects(opts?: { includeArchived?: boolean; includeDeleted?: boolean }): Promise<ProjectSummary[]> {
    const ids = (await keys(docStore)) as string[];
    const out: ProjectSummary[] = [];
    for (const id of ids) {
      const doc = (await get<SheetDocument>(id, docStore)) ?? null;
      if (!doc) continue;
      if (doc.sheet.deletedAt && !opts?.includeDeleted) continue;
      if (doc.sheet.archivedAt && !opts?.includeArchived) continue;
      out.push(summarize(doc));
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async loadDocument(id: string): Promise<SheetDocument | null> {
    const doc = (await get<SheetDocument>(id, docStore)) ?? null;
    return doc ? migrateDocument(doc) : null;
  }

  async saveDocument(doc: SheetDocument): Promise<void> {
    await set(doc.sheet.id, doc, docStore);
  }

  async deleteDocument(id: string, opts?: { hard?: boolean }): Promise<void> {
    if (opts?.hard) {
      const doc = await this.loadDocument(id);
      if (doc) await this.removeAssets(doc.photos.flatMap((p) => [p.storagePath, p.thumbPath]));
      await del(id, docStore);
      return;
    }
    const doc = await this.loadDocument(id);
    if (!doc) return;
    doc.sheet.deletedAt = new Date().toISOString();
    await this.saveDocument(doc);
  }

  async putAsset(key: string, blob: Blob): Promise<string> {
    await set(key, blob, assetStore);
    return key;
  }

  async getAssetBlob(key: string): Promise<Blob | null> {
    return (await get<Blob>(key, assetStore)) ?? null;
  }

  async getAssetUrl(key: string): Promise<string | null> {
    if (!key) return null;
    const cached = urlCache.get(key);
    if (cached) return cached;
    const blob = await this.getAssetBlob(key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(key, url);
    return url;
  }

  async removeAssets(keys_: string[]): Promise<void> {
    await Promise.all(
      keys_.filter(Boolean).map(async (k) => {
        const url = urlCache.get(k);
        if (url) {
          URL.revokeObjectURL(url);
          urlCache.delete(k);
        }
        await del(k, assetStore);
      }),
    );
  }

  async findByShareToken(token: string): Promise<SheetDocument | null> {
    const ids = (await keys(docStore)) as string[];
    for (const id of ids) {
      const doc = await this.loadDocument(id);
      if (doc?.shareLinks.some((l) => l.token === token)) return doc;
    }
    return null;
  }

  async wipe(): Promise<void> {
    await clear(docStore);
    await clear(assetStore);
  }
}

export function summarize(doc: SheetDocument): ProjectSummary {
  return {
    id: doc.sheet.id,
    title: doc.sheet.title,
    photoCount: doc.photos.length,
    templateId: doc.sheet.templateId,
    sharingMode: doc.sheet.sharingMode,
    coverThumb: doc.photos[0]?.thumbPath ?? null,
    createdAt: doc.sheet.createdAt,
    updatedAt: doc.sheet.updatedAt,
    archivedAt: doc.sheet.archivedAt,
    deletedAt: doc.sheet.deletedAt,
  };
}

export const localAdapter = new LocalAdapter();

let active: StorageAdapter = localAdapter;

export function getStorage(): StorageAdapter {
  return active;
}

/** Phase 2 hook: swap in the Supabase adapter once credentials are present. */
export function setStorage(adapter: StorageAdapter): void {
  active = adapter;
}

import type { ProjectSummary, SheetDocument } from "../types";

/**
 * Persistence boundary.
 *
 * Phase 1 ships the local adapter (IndexedDB) so the whole app works with no
 * backend at all. Phase 2 drops in a Supabase adapter behind the same
 * interface; nothing in the editor imports a storage implementation directly.
 */
export interface StorageAdapter {
  readonly mode: "local" | "cloud";
  listProjects(opts?: { includeArchived?: boolean; includeDeleted?: boolean }): Promise<ProjectSummary[]>;
  loadDocument(id: string): Promise<SheetDocument | null>;
  saveDocument(doc: SheetDocument): Promise<void>;
  deleteDocument(id: string, opts?: { hard?: boolean }): Promise<void>;
  /** Store binary asset, returns the storage key. */
  putAsset(key: string, blob: Blob): Promise<string>;
  getAssetBlob(key: string): Promise<Blob | null>;
  /** A URL usable in <img>/<image>; object URL locally, signed URL in cloud. */
  getAssetUrl(key: string): Promise<string | null>;
  removeAssets(keys: string[]): Promise<void>;
  findByShareToken(token: string): Promise<SheetDocument | null>;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

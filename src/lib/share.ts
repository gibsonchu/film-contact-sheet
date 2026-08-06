import { nowIso, uid } from "./document";
import type { ShareLink, SheetDocument, SharingMode } from "./types";

export function makeToken(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 of the password. In local mode this only gates the client-side
 * viewer — it is not a security boundary. The cloud adapter must verify
 * server-side before returning the document.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return `plain:${password}`;
  const data = new TextEncoder().encode(`fcs:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return true;
  return (await hashPassword(password)) === hash;
}

export interface ShareOptions {
  mode: SharingMode;
  password?: string;
  expiresAt?: string | null;
}

export async function ensureShareLink(
  doc: SheetDocument,
  { mode, password, expiresAt = null }: ShareOptions,
): Promise<{ doc: SheetDocument; link: ShareLink | null }> {
  if (mode === "private") {
    return {
      doc: { ...doc, sheet: { ...doc.sheet, sharingMode: "private" }, shareLinks: [] },
      link: null,
    };
  }

  const permission = mode === "link-comment" ? "comment" : "view";
  const existing = doc.shareLinks[0];
  const link: ShareLink = {
    id: existing?.id ?? uid("share"),
    contactSheetId: doc.sheet.id,
    token: existing?.token ?? makeToken(),
    passwordHash: mode === "password" && password ? await hashPassword(password) : existing?.passwordHash ?? null,
    permission,
    expiresAt,
    createdAt: existing?.createdAt ?? nowIso(),
  };

  return {
    doc: {
      ...doc,
      sheet: { ...doc.sheet, sharingMode: mode, commentsEnabled: mode === "link-comment" },
      shareLinks: [link],
    },
    link,
  };
}

export function shareUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/share/${token}`;
}

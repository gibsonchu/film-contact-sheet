"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicFields } from "@/lib/publish";
import { DEFAULT_PUBLIC_FIELDS } from "@/lib/publish";

/** A public sheet, already redacted to the fields its creator chose to
 *  publish — every field here is either the real value or null, never a
 *  private one leaking through. */
export interface PublicSheetCard {
  id: string;
  coverThumb: string | null;
  title: string | null;
  photographer: string | null;
  description: string | null;
  filmStock: string | null;
  camera: string | null;
  dateShot: string | null;
  location: string | null;
  publishedAt: string;
  likeCount: number;
  /** Whether the creator published with markup / frame notes at all — a
   *  detail view uses these to decide what to fetch and render, since RLS
   *  is row-level (any public sheet's rows are readable) and can't itself
   *  hide one field of an otherwise-public row the way get_shared_sheet's
   *  RPC does for share links. */
  showAnnotations: boolean;
  showNotes: boolean;
}

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Supabase isn't configured.");
  return c;
}

function redact(row: Record<string, unknown>): PublicSheetCard {
  const fields: PublicFields = { ...DEFAULT_PUBLIC_FIELDS, ...(row.public_fields as Partial<PublicFields>) };
  return {
    id: row.id as string,
    coverThumb: (row.cover_thumb as string) ?? null,
    title: fields.title ? (row.title as string) : null,
    photographer: fields.photographer ? (row.photographer as string) : null,
    description: fields.description ? (row.description as string) : null,
    filmStock: fields.filmStock ? (row.film_stock as string) : null,
    camera: fields.camera ? (row.camera as string) : null,
    dateShot: fields.dateShot ? (row.date_shot as string) : null,
    location: fields.location ? (row.location as string) : null,
    publishedAt: row.published_at as string,
    likeCount: (row.like_count as number) ?? 0,
    showAnnotations: fields.annotations,
    showNotes: fields.notes,
  };
}

async function coverFor(client_: ReturnType<typeof client>, sheetId: string) {
  const { data } = await client_
    .from("photos")
    .select("thumb_path")
    .eq("contact_sheet_id", sheetId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.thumb_path ?? null;
}

/** Ordered by recency alone for now — published_at desc. A future
 *  follow-based feed is a different query against the same table, not a
 *  schema change. */
export async function listPublicSheets(limit = 30): Promise<PublicSheetCard[]> {
  const supa = client();
  const { data } = await supa
    .from("contact_sheets")
    .select("id,title,photographer,description,film_stock,camera,date_shot,location,public_fields,published_at")
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (!data) return [];

  const cards: PublicSheetCard[] = [];
  for (const row of data) {
    const [coverThumb, { count }] = await Promise.all([
      coverFor(supa, row.id),
      supa.from("likes").select("id", { count: "exact", head: true }).eq("contact_sheet_id", row.id),
    ]);
    cards.push(redact({ ...row, cover_thumb: coverThumb, like_count: count ?? 0 }));
  }
  return cards;
}

export async function getPublicSheet(id: string): Promise<PublicSheetCard | null> {
  const supa = client();
  const { data } = await supa
    .from("contact_sheets")
    .select("id,title,photographer,description,film_stock,camera,date_shot,location,public_fields,published_at")
    .eq("id", id)
    .eq("visibility", "public")
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const [coverThumb, { count }] = await Promise.all([
    coverFor(supa, id),
    supa.from("likes").select("id", { count: "exact", head: true }).eq("contact_sheet_id", id),
  ]);
  return redact({ ...data, cover_thumb: coverThumb, like_count: count ?? 0 });
}

export interface SearchResults {
  sheets: PublicSheetCard[];
  people: { id: string; displayName: string | null; avatarUrl: string | null }[];
}

/** Sheets and people today; Public Binders join this once binders can be
 *  published — same shape, one more section. */
export async function searchCommunity(query: string): Promise<SearchResults> {
  const supa = client();
  const q = query.trim();
  if (!q) return { sheets: [], people: [] };

  const [{ data: sheetRows }, { data: peopleRows }] = await Promise.all([
    supa
      .from("contact_sheets")
      .select("id,title,photographer,description,film_stock,camera,date_shot,location,public_fields,published_at")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .or(`title.ilike.%${q}%,photographer.ilike.%${q}%`)
      .order("published_at", { ascending: false })
      .limit(20),
    supa.from("profiles").select("id,display_name,avatar_url").ilike("display_name", `%${q}%`).limit(20),
  ]);

  const sheets: PublicSheetCard[] = [];
  for (const row of sheetRows ?? []) {
    const coverThumb = await coverFor(supa, row.id);
    sheets.push(redact({ ...row, cover_thumb: coverThumb, like_count: 0 }));
  }

  return {
    sheets,
    people: (peopleRows ?? []).map((p) => ({ id: p.id, displayName: p.display_name, avatarUrl: p.avatar_url })),
  };
}

export async function isLiked(sheetId: string, userId: string): Promise<boolean> {
  const { data } = await client()
    .from("likes")
    .select("id")
    .eq("contact_sheet_id", sheetId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function toggleLike(sheetId: string, userId: string, liked: boolean): Promise<void> {
  const supa = client();
  if (liked) await supa.from("likes").insert({ contact_sheet_id: sheetId, user_id: userId });
  else await supa.from("likes").delete().eq("contact_sheet_id", sheetId).eq("user_id", userId);
}

export async function isBookmarked(sheetId: string, userId: string): Promise<boolean> {
  const { data } = await client()
    .from("bookmarks")
    .select("id")
    .eq("contact_sheet_id", sheetId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function toggleBookmark(sheetId: string, userId: string, saved: boolean): Promise<void> {
  const supa = client();
  if (saved) await supa.from("bookmarks").insert({ contact_sheet_id: sheetId, user_id: userId });
  else await supa.from("bookmarks").delete().eq("contact_sheet_id", sheetId).eq("user_id", userId);
}

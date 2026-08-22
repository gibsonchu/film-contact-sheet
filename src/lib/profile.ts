"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PublicSheetCard } from "@/lib/explore";

export interface PublicProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Supabase isn't configured.");
  return c;
}

export async function getProfile(id: string): Promise<PublicProfile | null> {
  const { data } = await client().from("profiles").select("id,display_name,avatar_url").eq("id", id).maybeSingle();
  if (!data) return null;
  return { id: data.id, displayName: data.display_name, avatarUrl: data.avatar_url };
}

/** A profile's Published tab — public sheets are readable by anyone per RLS,
 *  filtered here to just this one user's. */
export async function listPublishedSheets(userId: string): Promise<PublicSheetCard[]> {
  const supa = client();
  const { data } = await supa
    .from("contact_sheets")
    .select("id,title,photographer,description,film_stock,camera,date_shot,location,public_fields,published_at")
    .eq("user_id", userId)
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("published_at", { ascending: false });
  if (!data) return [];

  const cards: PublicSheetCard[] = [];
  for (const row of data) {
    const { data: cover } = await supa
      .from("photos")
      .select("thumb_path")
      .eq("contact_sheet_id", row.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { count } = await supa.from("likes").select("id", { count: "exact", head: true }).eq("contact_sheet_id", row.id);
    const fields = { ...row };
    cards.push({
      id: row.id,
      coverThumb: cover?.thumb_path ?? null,
      title: row.title,
      photographer: row.photographer,
      description: row.description,
      filmStock: row.film_stock,
      camera: row.camera,
      dateShot: row.date_shot,
      location: row.location,
      publishedAt: row.published_at,
      likeCount: count ?? 0,
      showAnnotations: Boolean((fields.public_fields as { annotations?: boolean } | null)?.annotations),
      showNotes: Boolean((fields.public_fields as { notes?: boolean } | null)?.notes),
    });
  }
  return cards;
}

/** Saved tab — only ever call this for the signed-in user's own id; RLS has
 *  no public read policy on bookmarks at all, so a call for anyone else's
 *  id just returns nothing rather than another person's private saves. */
export async function listSavedSheets(userId: string): Promise<PublicSheetCard[]> {
  const supa = client();
  const { data } = await supa
    .from("bookmarks")
    .select("contact_sheet_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (!data) return [];

  const cards: PublicSheetCard[] = [];
  for (const row of data) {
    const { data: sheet } = await supa
      .from("contact_sheets")
      .select("id,title,photographer,description,film_stock,camera,date_shot,location,public_fields,published_at")
      .eq("id", row.contact_sheet_id)
      .maybeSingle();
    if (!sheet) continue;
    const { data: cover } = await supa
      .from("photos")
      .select("thumb_path")
      .eq("contact_sheet_id", sheet.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { count } = await supa.from("likes").select("id", { count: "exact", head: true }).eq("contact_sheet_id", sheet.id);
    cards.push({
      id: sheet.id,
      coverThumb: cover?.thumb_path ?? null,
      title: sheet.title,
      photographer: sheet.photographer,
      description: sheet.description,
      filmStock: sheet.film_stock,
      camera: sheet.camera,
      dateShot: sheet.date_shot,
      location: sheet.location,
      publishedAt: sheet.published_at,
      likeCount: count ?? 0,
      showAnnotations: Boolean((sheet.public_fields as { annotations?: boolean } | null)?.annotations),
      showNotes: Boolean((sheet.public_fields as { notes?: boolean } | null)?.notes),
    });
  }
  return cards;
}

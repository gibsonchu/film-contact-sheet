"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface BinderSummary {
  id: string;
  title: string;
  sourceSheetId: string | null;
  sourceSheetTitle: string | null;
  sourceCoverThumb: string | null;
  /** True when the signed-in user owns this binder; false when they're only
   *  a member (they remixed the source sheet, the owner is someone else). */
  isOwner: boolean;
  sheetCount: number;
  updatedAt: string;
}

export interface BinderDetail extends BinderSummary {
  sheets: { id: string; title: string; coverThumb: string | null; addedAt: string }[];
}

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Supabase isn't configured.");
  return c;
}

async function coverFor(sheetId: string) {
  const { data } = await client()
    .from("photos")
    .select("thumb_path")
    .eq("contact_sheet_id", sheetId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.thumb_path ?? null;
}

/** Every binder the signed-in user owns, plus every markup binder they're a
 *  member of (they remixed that binder's source sheet) — a creator and a
 *  remixer both see the binder their collaboration lands in. */
export async function listMyBinders(): Promise<BinderSummary[]> {
  const supa = client();
  const { data: userData } = await supa.auth.getUser();
  if (!userData.user) return [];
  const userId = userData.user.id;

  const { data: owned } = await supa
    .from("binders")
    .select("id,title,source_sheet_id,updated_at")
    .eq("user_id", userId);
  const { data: memberRows } = await supa.from("binder_members").select("binder_id").eq("user_id", userId);
  const memberIds = (memberRows ?? []).map((r) => r.binder_id);
  const { data: memberBinders } =
    memberIds.length > 0
      ? await supa.from("binders").select("id,title,source_sheet_id,updated_at,user_id").in("id", memberIds)
      : { data: [] as { id: string; title: string; source_sheet_id: string | null; updated_at: string; user_id: string }[] };

  const byId = new Map<string, { id: string; title: string; source_sheet_id: string | null; updated_at: string; owned: boolean }>();
  for (const b of owned ?? []) byId.set(b.id, { ...b, owned: true });
  for (const b of memberBinders ?? []) if (!byId.has(b.id)) byId.set(b.id, { ...b, owned: b.user_id === userId });

  const out: BinderSummary[] = [];
  for (const b of byId.values()) {
    let sourceSheetTitle: string | null = null;
    let sourceCoverThumb: string | null = null;
    if (b.source_sheet_id) {
      const { data: source } = await supa.from("contact_sheets").select("title").eq("id", b.source_sheet_id).maybeSingle();
      sourceSheetTitle = source?.title ?? null;
      sourceCoverThumb = await coverFor(b.source_sheet_id);
    }
    const { count } = await supa.from("binder_sheets").select("contact_sheet_id", { count: "exact", head: true }).eq("binder_id", b.id);
    out.push({
      id: b.id,
      title: b.title,
      sourceSheetId: b.source_sheet_id,
      sourceSheetTitle,
      sourceCoverThumb,
      isOwner: b.owned,
      sheetCount: count ?? 0,
      updatedAt: b.updated_at,
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createBinder(title: string): Promise<string> {
  const supa = client();
  const { data: userData } = await supa.auth.getUser();
  if (!userData.user) throw new Error("Sign in required.");
  const { data, error } = await supa
    .from("binders")
    .insert({ user_id: userData.user.id, title })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getBinder(id: string): Promise<BinderDetail | null> {
  const supa = client();
  const { data: binder } = await supa.from("binders").select("*").eq("id", id).maybeSingle();
  if (!binder) return null;
  const { data: userData } = await supa.auth.getUser();

  let sourceSheetTitle: string | null = null;
  let sourceCoverThumb: string | null = null;
  if (binder.source_sheet_id) {
    const { data: source } = await supa.from("contact_sheets").select("title").eq("id", binder.source_sheet_id).maybeSingle();
    sourceSheetTitle = source?.title ?? null;
    sourceCoverThumb = await coverFor(binder.source_sheet_id);
  }

  const { data: memberRows } = await supa.from("binder_sheets").select("contact_sheet_id,added_at").eq("binder_id", id);
  const sheets: BinderDetail["sheets"] = [];
  for (const row of memberRows ?? []) {
    const { data: sheet } = await supa.from("contact_sheets").select("title").eq("id", row.contact_sheet_id).maybeSingle();
    if (!sheet) continue;
    sheets.push({
      id: row.contact_sheet_id,
      title: sheet.title,
      coverThumb: await coverFor(row.contact_sheet_id),
      addedAt: row.added_at,
    });
  }

  return {
    id: binder.id,
    title: binder.title,
    sourceSheetId: binder.source_sheet_id,
    sourceSheetTitle,
    sourceCoverThumb,
    isOwner: binder.user_id === userData.user?.id,
    sheetCount: sheets.length,
    updatedAt: binder.updated_at,
    sheets: sheets.sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  };
}

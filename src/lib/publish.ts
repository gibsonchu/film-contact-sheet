"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Which sheet fields a viewer of the public/unlisted view gets to see.
 *  "Notes" means each frame's publicNote — privateNote is never public,
 *  publish or not. "Annotations" gates the creator's markup itself. */
export interface PublicFields {
  title: boolean;
  photographer: boolean;
  description: boolean;
  filmStock: boolean;
  camera: boolean;
  dateShot: boolean;
  location: boolean;
  annotations: boolean;
  notes: boolean;
}

export const DEFAULT_PUBLIC_FIELDS: PublicFields = {
  title: true,
  photographer: true,
  description: true,
  filmStock: true,
  camera: true,
  dateShot: true,
  location: true,
  annotations: true,
  notes: false,
};

export type Visibility = "private" | "unlisted" | "public";

export interface PublishState {
  visibility: Visibility;
  publicFields: PublicFields;
  publishedAt: string | null;
}

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Supabase isn't configured.");
  return c;
}

export async function getPublishState(sheetId: string): Promise<PublishState | null> {
  const { data } = await client()
    .from("contact_sheets")
    .select("visibility,public_fields,published_at")
    .eq("id", sheetId)
    .maybeSingle();
  if (!data) return null;
  return {
    visibility: (data.visibility as Visibility) ?? "private",
    publicFields: { ...DEFAULT_PUBLIC_FIELDS, ...(data.public_fields as Partial<PublicFields>) },
    publishedAt: data.published_at,
  };
}

/** Publishing and sharing are separate concepts, but both live on the same
 *  visibility column — publish always wins over whatever a share link's
 *  private/unlisted setting was, since public is the more open of the two. */
export async function publishSheet(sheetId: string, fields: PublicFields): Promise<void> {
  await client()
    .from("contact_sheets")
    .update({ visibility: "public", public_fields: fields, published_at: new Date().toISOString() })
    .eq("id", sheetId);
}

/** Un-publishing drops back to whatever the share link implies (unlisted if
 *  one is active and enabled, private otherwise) — it never has to guess,
 *  since the caller already knows whether a share link exists. */
export async function unpublishSheet(sheetId: string, fallbackVisibility: "private" | "unlisted"): Promise<void> {
  await client().from("contact_sheets").update({ visibility: fallbackVisibility, published_at: null }).eq("id", sheetId);
}

/** Share's own visibility nudge: raises private -> unlisted (or drops back)
 *  without ever downgrading a sheet that's been published public — that
 *  only unpublishSheet is allowed to do. */
export async function setUnlistedVisibility(sheetId: string, unlisted: boolean): Promise<void> {
  const current = await getPublishState(sheetId);
  if (current?.visibility === "public") return;
  await client()
    .from("contact_sheets")
    .update({ visibility: unlisted ? "unlisted" : "private" })
    .eq("id", sheetId);
}

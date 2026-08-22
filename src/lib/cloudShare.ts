"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** The three flags that only exist on a cloud share link — not part of the
 *  local ShareLink type, since local sharing can't host a remix at all. */
export interface CloudShareFlags {
  allowMarkup: boolean;
  allowDownload: boolean;
  disabled: boolean;
}

function client() {
  const c = getSupabaseBrowserClient();
  if (!c) throw new Error("Supabase isn't configured.");
  return c;
}

export async function getCloudShareFlags(contactSheetId: string): Promise<CloudShareFlags | null> {
  const { data } = await client()
    .from("share_links")
    .select("allow_markup,allow_download,disabled")
    .eq("contact_sheet_id", contactSheetId)
    .maybeSingle();
  if (!data) return null;
  return { allowMarkup: data.allow_markup, allowDownload: data.allow_download, disabled: data.disabled };
}

export async function updateCloudShareFlags(
  contactSheetId: string,
  patch: Partial<{ allow_markup: boolean; allow_download: boolean; disabled: boolean }>,
): Promise<void> {
  await client().from("share_links").update(patch).eq("contact_sheet_id", contactSheetId);
}

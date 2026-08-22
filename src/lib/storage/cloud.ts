"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Annotation,
  Comment,
  ContactSheet,
  Photo,
  ProjectSummary,
  SharingMode,
  ShareLink,
  SheetDocument,
  TemplateId,
} from "../types";
import { SCHEMA_VERSION } from "../types";
import type { StorageAdapter } from "./adapter";

const BUCKET = "contact-sheets";

/**
 * Cloud adapter — the Supabase-backed twin of LocalAdapter, behind the same
 * StorageAdapter interface. Row-to-object mapping is explicit rather than
 * relying on any ORM: the DB columns are snake_case, the app types are
 * camelCase, and this is the one place that difference is bridged.
 */
class CloudAdapter implements StorageAdapter {
  readonly mode = "cloud" as const;

  private client() {
    const c = getSupabaseBrowserClient();
    if (!c) throw new Error("Supabase isn't configured.");
    return c;
  }

  async listProjects(opts?: { includeArchived?: boolean; includeDeleted?: boolean }): Promise<ProjectSummary[]> {
    const client = this.client();
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) return [];

    let query = client
      .from("contact_sheets")
      .select("id,title,template_id,sharing_mode,user_id,created_at,updated_at,archived_at,deleted_at")
      .eq("user_id", userData.user.id)
      .order("updated_at", { ascending: false });
    if (!opts?.includeDeleted) query = query.is("deleted_at", null);
    if (!opts?.includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query;
    if (error || !data) return [];

    const summaries: ProjectSummary[] = [];
    for (const row of data) {
      const { count } = await client
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("contact_sheet_id", row.id);
      const { data: cover } = await client
        .from("photos")
        .select("thumb_path")
        .eq("contact_sheet_id", row.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      summaries.push({
        id: row.id,
        title: row.title,
        photoCount: count ?? 0,
        templateId: row.template_id as TemplateId,
        sharingMode: row.sharing_mode as SharingMode,
        coverThumb: cover?.thumb_path ?? null,
        userId: row.user_id as string,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at,
        deletedAt: row.deleted_at,
      });
    }
    return summaries;
  }

  async loadDocument(id: string): Promise<SheetDocument | null> {
    const client = this.client();
    const { data: sheetRow } = await client.from("contact_sheets").select("*").eq("id", id).maybeSingle();
    if (!sheetRow) return null;

    const [{ data: photoRows }, { data: annotationRows }, { data: linkRows }] = await Promise.all([
      client.from("photos").select("*").eq("contact_sheet_id", id).order("position"),
      client.from("annotations").select("*").eq("contact_sheet_id", id).order("z_index"),
      client.from("share_links").select("*").eq("contact_sheet_id", id),
    ]);

    return {
      schemaVersion: SCHEMA_VERSION,
      sheet: sheetFromRow(sheetRow),
      photos: (photoRows ?? []).map(photoFromRow),
      annotations: (annotationRows ?? []).map(annotationFromRow),
      comments: [] as Comment[],
      shareLinks: (linkRows ?? []).map(shareLinkFromRow),
    };
  }

  async saveDocument(doc: SheetDocument): Promise<void> {
    const client = this.client();
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) throw new Error("Sign in to save online.");

    await client.from("contact_sheets").upsert(sheetToRow(doc.sheet, userData.user.id));

    // Whole-document overwrite, same contract LocalAdapter makes: replace
    // every child row rather than diffing, since the editor always sends
    // the complete current state.
    await client.from("photos").delete().eq("contact_sheet_id", doc.sheet.id);
    if (doc.photos.length) {
      await client.from("photos").insert(doc.photos.map(photoToRow));
    }
    await client.from("annotations").delete().eq("contact_sheet_id", doc.sheet.id);
    if (doc.annotations.length) {
      await client.from("annotations").insert(doc.annotations.map(annotationToRow));
    }

    // Share links: local ShareLink only knows token/passwordHash/permission
    // — allow_markup/allow_download/disabled are cloud-only flags a visitor
    // to /binders sets directly (see cloudShare.ts), so this must never
    // stomp them back to their defaults on every autosave. Rows the local
    // side no longer has (sharing turned off) are removed; everything else
    // is an update of only the columns the local model actually tracks.
    const keepIds = doc.shareLinks.map((l) => l.id);
    let deleteQuery = client.from("share_links").delete().eq("contact_sheet_id", doc.sheet.id);
    if (keepIds.length) deleteQuery = deleteQuery.not("id", "in", `(${keepIds.join(",")})`);
    await deleteQuery;
    for (const link of doc.shareLinks) {
      await client
        .from("share_links")
        .upsert(
          {
            id: link.id,
            contact_sheet_id: doc.sheet.id,
            token: link.token,
            password_hash: link.passwordHash,
            permission: link.permission,
            expires_at: link.expiresAt,
          },
          { onConflict: "id", ignoreDuplicates: false },
        );
    }
  }

  async deleteDocument(id: string, opts?: { hard?: boolean }): Promise<void> {
    const client = this.client();
    if (opts?.hard) {
      const doc = await this.loadDocument(id);
      if (doc) await this.removeAssets(doc.photos.flatMap((p) => [p.storagePath, p.thumbPath]));
      await client.from("contact_sheets").delete().eq("id", id);
      return;
    }
    await client.from("contact_sheets").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  }

  async putAsset(key: string, blob: Blob): Promise<string> {
    const client = this.client();
    const { error } = await client.storage.from(BUCKET).upload(key, blob, { upsert: true });
    if (error) throw error;
    return key;
  }

  async getAssetBlob(key: string): Promise<Blob | null> {
    const client = this.client();
    const { data } = await client.storage.from(BUCKET).download(key);
    return data ?? null;
  }

  async getAssetUrl(key: string): Promise<string | null> {
    if (!key) return null;
    const client = this.client();
    // An hour is generous for a single editing session; the URL is
    // re-requested (not cached across reloads) so an expired link never
    // lingers.
    const { data } = await client.storage.from(BUCKET).createSignedUrl(key, 60 * 60);
    return data?.signedUrl ?? null;
  }

  async removeAssets(keys: string[]): Promise<void> {
    const client = this.client();
    const clean = keys.filter(Boolean);
    if (clean.length) await client.storage.from(BUCKET).remove(clean);
  }

  async findByShareToken(token: string): Promise<SheetDocument | null> {
    const client = this.client();
    const { data, error } = await client.rpc("get_shared_sheet", { share_token: token });
    if (error || !data || data.error) return null;
    return sharedRpcResultToDocument(data);
  }
}

export const cloudAdapter = new CloudAdapter();

/* ---------------------------------------------------------- row <-> object */

function sheetFromRow(row: Record<string, unknown>): ContactSheet {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    title: row.title as string,
    subtitle: row.subtitle as string,
    description: row.description as string,
    rollNumber: row.roll_number as string,
    dateShot: row.date_shot as string,
    photographer: row.photographer as string,
    location: row.location as string,
    camera: row.camera as string,
    filmStock: row.film_stock as string,
    templateId: row.template_id as TemplateId,
    templateSettings: (row.template_settings as ContactSheet["templateSettings"]) ?? {},
    orientation: (row.orientation as ContactSheet["orientation"]) ?? "landscape",
    sharingMode: row.sharing_mode as SharingMode,
    commentsEnabled: Boolean(row.comments_enabled),
    downloadsEnabled: Boolean(row.downloads_enabled),
    postcard: (row.postcard as ContactSheet["postcard"]) ?? {
      message: "",
      senderName: "",
      senderAddress: "",
      recipientName: "",
      recipientAddress: "",
      stampNote: "",
    },
    pickMark: (row.pick_mark as ContactSheet["pickMark"]) ?? "circle",
    autoAdvance: Boolean(row.auto_advance),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    archivedAt: (row.archived_at as string) ?? null,
    deletedAt: (row.deleted_at as string) ?? null,
  };
}

function sheetToRow(sheet: ContactSheet, userId: string) {
  return {
    id: sheet.id,
    user_id: userId,
    title: sheet.title,
    subtitle: sheet.subtitle,
    description: sheet.description,
    roll_number: sheet.rollNumber,
    date_shot: sheet.dateShot,
    photographer: sheet.photographer,
    location: sheet.location,
    camera: sheet.camera,
    film_stock: sheet.filmStock,
    template_id: sheet.templateId,
    template_settings: sheet.templateSettings,
    orientation: sheet.orientation,
    sharing_mode: sheet.sharingMode,
    comments_enabled: sheet.commentsEnabled,
    downloads_enabled: sheet.downloadsEnabled,
    postcard: sheet.postcard,
    pick_mark: sheet.pickMark,
    auto_advance: sheet.autoAdvance,
    updated_at: sheet.updatedAt,
    archived_at: sheet.archivedAt,
    deleted_at: sheet.deletedAt,
  };
}

function photoFromRow(row: Record<string, unknown>): Photo {
  return {
    id: row.id as string,
    contactSheetId: row.contact_sheet_id as string,
    storagePath: row.storage_path as string,
    thumbPath: row.thumb_path as string,
    originalFilename: row.original_filename as string,
    mimeType: row.mime_type as string,
    width: row.width as number,
    height: row.height as number,
    fileSize: Number(row.file_size),
    position: row.position as number,
    frameNumber: row.frame_number as number,
    title: row.title as string,
    caption: row.caption as string,
    privateNote: row.private_note as string,
    publicNote: row.public_note as string,
    status: row.status as Photo["status"],
    rotation: row.rotation as Photo["rotation"],
    cropData: (row.crop_data as Photo["cropData"]) ?? null,
    fit: row.fit as Photo["fit"],
    exifData: (row.exif_data as Photo["exifData"]) ?? null,
    hidden: Boolean(row.hidden),
    blank: Boolean(row.blank),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function photoToRow(photo: Photo) {
  return {
    id: photo.id,
    contact_sheet_id: photo.contactSheetId,
    storage_path: photo.storagePath,
    thumb_path: photo.thumbPath,
    original_filename: photo.originalFilename,
    mime_type: photo.mimeType,
    width: photo.width,
    height: photo.height,
    file_size: photo.fileSize,
    position: photo.position,
    frame_number: photo.frameNumber,
    title: photo.title,
    caption: photo.caption,
    private_note: photo.privateNote,
    public_note: photo.publicNote,
    status: photo.status,
    rotation: photo.rotation,
    fit: photo.fit,
    crop_data: photo.cropData,
    exif_data: photo.exifData,
    hidden: photo.hidden,
    blank: Boolean(photo.blank),
    updated_at: photo.updatedAt,
  };
}

function annotationFromRow(row: Record<string, unknown>): Annotation {
  return {
    id: row.id as string,
    contactSheetId: row.contact_sheet_id as string,
    photoId: (row.photo_id as string) ?? null,
    anchor: (row.anchor as Annotation["anchor"]) ?? null,
    type: row.type as Annotation["type"],
    tool: row.tool as Annotation["tool"],
    color: row.color as string,
    strokeWidth: row.stroke_width as number,
    opacity: row.opacity as number,
    geometry: row.geometry as Annotation["geometry"],
    text: (row.text as string) ?? null,
    tapeKind: (row.tape_kind as Annotation["tapeKind"]) ?? undefined,
    font: (row.font as Annotation["font"]) ?? undefined,
    zIndex: row.z_index as number,
    locked: Boolean(row.locked),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function annotationToRow(a: Annotation) {
  return {
    id: a.id,
    contact_sheet_id: a.contactSheetId,
    photo_id: a.photoId,
    anchor: a.anchor,
    type: a.type,
    tool: a.tool,
    color: a.color,
    stroke_width: a.strokeWidth,
    opacity: a.opacity,
    geometry: a.geometry,
    text: a.text,
    tape_kind: a.tapeKind ?? null,
    font: a.font ?? null,
    z_index: a.zIndex,
    locked: a.locked,
    updated_at: a.updatedAt,
  };
}

function shareLinkFromRow(row: Record<string, unknown>): ShareLink {
  return {
    id: row.id as string,
    contactSheetId: row.contact_sheet_id as string,
    token: row.token as string,
    passwordHash: (row.password_hash as string) ?? null,
    permission: row.permission as ShareLink["permission"],
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Shapes the `get_shared_sheet` RPC's redacted JSON back into a document —
 *  it already strips user_id and private fields server-side (see
 *  0002_sharing.sql), so this is a straight camelCase remap, not a second
 *  redaction pass. */
function sharedRpcResultToDocument(data: Record<string, unknown>): SheetDocument | null {
  const sheet = data.sheet as Record<string, unknown> | undefined;
  if (!sheet) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    sheet: sheetFromRow({ ...sheet, user_id: null }),
    photos: ((data.photos as Record<string, unknown>[]) ?? []).map(photoFromRow),
    annotations: ((data.annotations as Record<string, unknown>[]) ?? []).map(annotationFromRow),
    comments: ((data.comments as Record<string, unknown>[]) ?? []).map((c) => ({
      id: c.id as string,
      contactSheetId: c.contact_sheet_id as string,
      photoId: (c.photo_id as string) ?? null,
      authorName: c.author_name as string,
      authorEmail: null,
      body: c.body as string,
      createdAt: c.created_at as string,
      resolvedAt: (c.resolved_at as string) ?? null,
    })),
    shareLinks: [],
  };
}

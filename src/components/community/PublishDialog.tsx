"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Toggle } from "@/components/ui/primitives";
import { isSavedOnline, saveSheetOnline } from "@/lib/cloudSync";
import {
  DEFAULT_PUBLIC_FIELDS,
  getPublishState,
  publishSheet,
  unpublishSheet,
  type PublicFields,
  type Visibility,
} from "@/lib/publish";
import type { SheetDocument } from "@/lib/types";

const FIELD_LABELS: { key: keyof PublicFields; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "photographer", label: "Photographer" },
  { key: "description", label: "Description" },
  { key: "filmStock", label: "Film stock" },
  { key: "camera", label: "Camera" },
  { key: "dateShot", label: "Date" },
  { key: "location", label: "Location" },
  { key: "annotations", label: "Annotations" },
  { key: "notes", label: "Notes" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  doc: SheetDocument;
  userId: string | null;
  /** Called after a successful publish/unpublish with the doc as it now
   *  stands locally — saveSheetOnline may have stamped userId if this sheet
   *  wasn't cloud-saved yet. */
  onChange?: (doc: SheetDocument) => void;
}

/**
 * Publishing and sharing are separate concepts: this only ever touches the
 * cloud row's visibility/public_fields, never the local ShareLink/
 * sharingMode a visitor with a link sees.
 */
export function PublishDialog({ open, onClose, doc, userId, onChange }: Props) {
  const [fields, setFields] = useState<PublicFields>(DEFAULT_PUBLIC_FIELDS);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      if (!isSavedOnline(doc)) return;
      const state = await getPublishState(doc.sheet.id);
      if (!cancelled && state) {
        setFields(state.publicFields);
        setVisibility(state.visibility);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, doc]);

  async function publish() {
    if (!userId) {
      setError("Sign in to publish.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let target = doc;
      if (!isSavedOnline(target)) target = await saveSheetOnline(target, userId);
      await publishSheet(target.sheet.id, fields);
      setVisibility("public");
      onChange?.(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      const fallback = doc.sheet.sharingMode === "private" ? "private" : "unlisted";
      await unpublishSheet(doc.sheet.id, fallback);
      setVisibility(fallback);
      onChange?.(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Publish to Explore"
      description="Choose what's public. Everything else — private notes, anything unchecked below — stays yours."
    >
      <div className="space-y-4">
        <div className="space-y-0.5">
          {FIELD_LABELS.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={fields[key]}
              onChange={(v) => setFields((f) => ({ ...f, [key]: v }))}
            />
          ))}
        </div>

        {error ? <p className="text-[12px] text-darkroom">{error}</p> : null}

        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3">
          <p className="label">
            {visibility === "public" ? "Live on Explore" : "Not published"}
          </p>
          <div className="flex gap-2">
            {visibility === "public" ? (
              <Button variant="outline" onClick={unpublish} disabled={busy}>
                Unpublish
              </Button>
            ) : null}
            <Button variant="primary" onClick={publish} disabled={busy}>
              {busy ? "Publishing…" : visibility === "public" ? "Update" : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, Field, Segmented, Toggle, inputClass } from "@/components/ui/primitives";
import { ensureShareLink, shareUrl } from "@/lib/share";
import { getStorage } from "@/lib/storage/local";
import { cloudAdapter } from "@/lib/storage/cloud";
import { isSavedOnline } from "@/lib/cloudSync";
import { getCloudShareFlags, updateCloudShareFlags, type CloudShareFlags } from "@/lib/cloudShare";
import { useEditor } from "@/lib/store/editor";
import type { SharingMode } from "@/lib/types";

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [cloudFlags, setCloudFlags] = useState<CloudShareFlags | null>(null);

  const online = doc ? isSavedOnline(doc) : false;
  const linkId = doc?.shareLinks[0]?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!online || !doc || doc.sheet.sharingMode === "private") {
        if (!cancelled) setCloudFlags(null);
        return;
      }
      const flags = await getCloudShareFlags(doc.sheet.id);
      if (!cancelled) setCloudFlags(flags);
    })();
    return () => {
      cancelled = true;
    };
    // linkId changes when a link is (re)created, which is when the cloud
    // row is worth re-reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, doc?.sheet.id, doc?.sheet.sharingMode, linkId]);

  if (!doc) return null;
  const mode = doc.sheet.sharingMode;
  const token = doc.shareLinks[0]?.token ?? null;
  const url = token ? shareUrl(token) : "";

  async function applyMode(next: SharingMode) {
    const current = useEditor.getState().doc;
    if (!current) return;
    const { doc: updated } = await ensureShareLink(current, { mode: next, password });
    useEditor.setState({ doc: updated, dirty: true });
    await getStorage().saveDocument(updated);
    if (isSavedOnline(updated)) {
      await cloudAdapter.saveDocument(updated);
      // The effect keyed on linkId already re-fetches on the next render,
      // but that render happened before this cloud write landed — fetch
      // once more directly so a brand-new link's flags show immediately
      // instead of only after the next state change.
      setCloudFlags(await getCloudShareFlags(updated.sheet.id));
    }
  }

  async function toggleAllowMarkup(value: boolean) {
    if (!doc) return;
    setCloudFlags((f) => (f ? { ...f, allowMarkup: value } : f));
    await updateCloudShareFlags(doc.sheet.id, { allow_markup: value });
  }
  async function toggleAllowDownload(value: boolean) {
    if (!doc) return;
    setCloudFlags((f) => (f ? { ...f, allowDownload: value } : f));
    await updateCloudShareFlags(doc.sheet.id, { allow_download: value });
  }
  async function toggleLinkDisabled(value: boolean) {
    if (!doc) return;
    setCloudFlags((f) => (f ? { ...f, disabled: value } : f));
    await updateCloudShareFlags(doc.sheet.id, { disabled: value });
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function sendEmail() {
    setSending(true);
    setEmailNote(null);
    try {
      const response = await fetch("/api/share/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipients
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
          message,
          sheetTitle: doc!.sheet.title,
          url,
          fromName: doc!.sheet.photographer || "A photographer",
        }),
      });
      const data = (await response.json()) as { detail?: string; error?: string };
      setEmailNote(data.detail ?? data.error ?? "Done.");
    } catch (err) {
      setEmailNote(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Share this sheet" description="Viewers can browse and comment — never edit.">
      <div className="space-y-4">
        <Segmented
          label="Sharing mode"
          value={mode}
          onChange={(v) => void applyMode(v)}
          options={[
            { value: "private", label: "Private" },
            { value: "link-view", label: "Link · view" },
            { value: "link-comment", label: "Link · comment" },
            { value: "password", label: "Password" },
          ]}
        />

        {mode === "password" ? (
          <Field label="Password" hint="Set before copying the link. Local mode checks this in the browser only.">
            {(id) => (
              <div className="flex gap-2">
                <input
                  id={id}
                  type="text"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button size="sm" onClick={() => void applyMode("password")}>
                  Set
                </Button>
              </div>
            )}
          </Field>
        ) : null}

        {mode !== "private" ? (
          <>
            <Field label="Share link">
              {(id) => (
                <div className="flex gap-2">
                  <input id={id} readOnly value={url} className={`${inputClass} font-sans text-[12px]`} />
                  <Button size="sm" onClick={copyLink}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              )}
            </Field>

            <div className="space-y-0.5">
              <Toggle
                label="Allow downloading the export"
                checked={doc.sheet.downloadsEnabled}
                onChange={(v) => {
                  useEditor.getState().updateSheet({ downloadsEnabled: v });
                  if (online) void toggleAllowDownload(v);
                }}
              />
              <Toggle
                label="Allow frame comments"
                checked={doc.sheet.commentsEnabled}
                onChange={(v) => useEditor.getState().updateSheet({ commentsEnabled: v })}
              />
            </div>

            {online && cloudFlags ? (
              <div className="space-y-0.5 border-t border-white/8 pt-3">
                <Toggle
                  label="Link enabled"
                  checked={!cloudFlags.disabled}
                  onChange={(v) => void toggleLinkDisabled(!v)}
                  hint="Turn off to stop anyone new from opening it — the link keeps its address for when you turn it back on."
                />
                <Toggle
                  label="Allow markup / remixing"
                  checked={cloudFlags.allowMarkup}
                  onChange={(v) => void toggleAllowMarkup(v)}
                  hint="Viewers can make their own marked-up copy, shared back to you in a Binder."
                />
              </div>
            ) : null}

            <div className="space-y-2 border-t border-white/8 pt-3">
              <Field label="Send by email">
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    placeholder="someone@example.com, another@example.com"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                  />
                )}
              </Field>
              <textarea
                rows={2}
                className={inputClass}
                placeholder="A short message…"
                aria-label="Email message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-smoke">{emailNote}</p>
                <Button size="sm" onClick={sendEmail} disabled={sending || !recipients.trim()}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>

            <p className="border-t border-white/8 pt-3 text-[11px] leading-relaxed text-smoke">
              This build stores sheets in your browser, so a share link opens the sheet on
              <em> this device</em> only. Configure Supabase to make links work for anyone.
              Private notes are never included in a shared view.
            </p>
          </>
        ) : (
          <p className="text-[13px] text-smoke">Only you can see this sheet.</p>
        )}
      </div>
    </Dialog>
  );
}

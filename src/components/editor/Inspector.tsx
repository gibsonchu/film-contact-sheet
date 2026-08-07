"use client";

import { useState } from "react";
import { IconEye, IconEyeOff, IconLayers, IconLock, IconRotate, IconTrash } from "@/components/icons";
import { Button, Field, IconButton, Panel, Segmented, Toggle, cx, inputClass } from "@/components/ui/primitives";
import { INK_COLORS, STROKE_SIZES, TAPE_KINDS } from "@/lib/palette";
import { TEMPLATE_LIST } from "@/lib/templates";
import { useEditor } from "@/lib/store/editor";
import type { ReviewStatus, TemplateId } from "@/lib/types";

const STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: "unreviewed", label: "—" },
  { value: "favorite", label: "Fav" },
  { value: "selected", label: "Sel" },
  { value: "maybe", label: "Maybe" },
  { value: "rejected", label: "Rej" },
];

export function Inspector() {
  const doc = useEditor((s) => s.doc);
  const selectedPhotoId = useEditor((s) => s.selectedPhotoId);
  const selectedAnnotationId = useEditor((s) => s.selectedAnnotationId);

  if (!doc) return null;

  const photo = doc.photos.find((p) => p.id === selectedPhotoId) ?? null;
  const annotation = doc.annotations.find((a) => a.id === selectedAnnotationId) ?? null;

  return (
    <aside
      className="hidden h-full w-[290px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/8 bg-charcoal p-3 lg:flex"
      aria-label="Inspector"
    >
      {annotation ? <AnnotationInspector /> : photo ? <PhotoInspector /> : <SheetInspector />}
    </aside>
  );
}

/* ------------------------------------------------------------- photo */

export function PhotoInspector() {
  const doc = useEditor((s) => s.doc);
  const selectedPhotoId = useEditor((s) => s.selectedPhotoId);
  const updatePhoto = useEditor((s) => s.updatePhoto);
  const rotatePhoto = useEditor((s) => s.rotatePhoto);
  const toggleHidden = useEditor((s) => s.toggleHidden);
  const removePhoto = useEditor((s) => s.removePhoto);
  const setStatus = useEditor((s) => s.setStatus);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const photo = doc?.photos.find((p) => p.id === selectedPhotoId);
  if (!photo) return null;
  const crop = photo.cropData ?? { x: 0, y: 0, width: 1, height: 1 };

  return (
    <>
      <Panel title={`Frame ${photo.frameNumber || "—"}`}>
        <div className="space-y-3">
          <Field label="Title">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                value={photo.title}
                placeholder="Untitled frame"
                onChange={(e) => updatePhoto(photo.id, { title: e.target.value })}
              />
            )}
          </Field>
          <Field label="Caption">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                value={photo.caption}
                onChange={(e) => updatePhoto(photo.id, { caption: e.target.value })}
              />
            )}
          </Field>
          <Field label="Public note" hint="Visible to anyone with the share link.">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                className={inputClass}
                value={photo.publicNote}
                onChange={(e) => updatePhoto(photo.id, { publicNote: e.target.value })}
              />
            )}
          </Field>
          <Field label="Private note" hint="Never leaves this sheet — excluded from shares and exports.">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                className={inputClass}
                value={photo.privateNote}
                onChange={(e) => updatePhoto(photo.id, { privateNote: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Panel>

      <Panel title="Review">
        <Segmented
          label="Review status"
          value={photo.status}
          onChange={(v) => setStatus(photo.id, v)}
          options={STATUS_OPTIONS}
        />
      </Panel>

      <Panel title="Frame">
        <div className="space-y-3">
          <Segmented
            label="Fit mode"
            value={photo.fit}
            onChange={(v) => updatePhoto(photo.id, { fit: v })}
            options={[
              { value: "fit", label: "Fit" },
              { value: "fill", label: "Fill" },
              { value: "original", label: "Orig" },
            ]}
          />
          <div className="flex items-center gap-2">
            <IconButton label="Rotate left" onClick={() => rotatePhoto(photo.id, -90)}>
              <IconRotate className="h-4 w-4 -scale-x-100" />
            </IconButton>
            <IconButton label="Rotate right" onClick={() => rotatePhoto(photo.id, 90)}>
              <IconRotate className="h-4 w-4" />
            </IconButton>
            <span className="label">{photo.rotation}°</span>
            <div className="flex-1" />
            <IconButton
              label={photo.hidden ? "Show frame" : "Hide frame"}
              active={photo.hidden}
              onClick={() => toggleHidden(photo.id)}
            >
              {photo.hidden ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            </IconButton>
          </div>

          <div className="space-y-2">
            <span className="label">Crop within frame</span>
            {(
              [
                ["x", "Left"],
                ["y", "Top"],
                ["width", "Width"],
                ["height", "Height"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[11px] text-smoke">
                <span className="w-12">{label}</span>
                <input
                  type="range"
                  min={key === "width" || key === "height" ? 0.1 : 0}
                  max={1}
                  step={0.01}
                  value={crop[key]}
                  onChange={(e) =>
                    updatePhoto(photo.id, {
                      cropData: { ...crop, [key]: Number(e.target.value) },
                    })
                  }
                  className="flex-1 accent-[#f2c218]"
                />
              </label>
            ))}
            {photo.cropData ? (
              <button
                type="button"
                className="label hover:text-warm"
                onClick={() => updatePhoto(photo.id, { cropData: null })}
              >
                Reset crop
              </button>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel title="Metadata">
        <dl className="space-y-1 font-mono text-[11px] text-smoke">
          <Row label="File" value={photo.originalFilename || "—"} />
          <Row label="Pixels" value={`${photo.width}×${photo.height}`} />
          {photo.exifData?.model ? <Row label="Camera" value={photo.exifData.model} /> : null}
          {photo.exifData?.focalLength ? <Row label="Focal" value={photo.exifData.focalLength} /> : null}
          {photo.exifData?.aperture ? <Row label="Aperture" value={photo.exifData.aperture} /> : null}
          {photo.exifData?.shutterSpeed ? <Row label="Shutter" value={photo.exifData.shutterSpeed} /> : null}
          {photo.exifData?.iso ? <Row label="ISO" value={photo.exifData.iso} /> : null}
        </dl>
      </Panel>

      <div className="pb-4">
        {confirmDelete ? (
          <div className="space-y-2 border border-darkroom/50 p-3">
            <p className="text-[13px] text-bone">Remove this frame from the sheet? This can’t be undone from here.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={() => removePhoto(photo.id)}>
                Remove frame
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
            <IconTrash className="h-4 w-4" />
            Remove frame
          </Button>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="uppercase tracking-wider">{label}</dt>
      <dd className="truncate text-bone">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------- annotation */

export function AnnotationInspector() {
  const doc = useEditor((s) => s.doc);
  const id = useEditor((s) => s.selectedAnnotationId);
  const update = useEditor((s) => s.updateAnnotation);
  const remove = useEditor((s) => s.deleteAnnotation);
  const forward = useEditor((s) => s.bringForward);
  const backward = useEditor((s) => s.sendBackward);

  const a = doc?.annotations.find((x) => x.id === id);
  if (!a) return null;
  const rotation = a.geometry.kind === "box" ? (a.geometry.rotation ?? 0) : 0;

  return (
    <>
      <Panel title={`${a.tool} annotation`}>
        <div className="space-y-3">
          <div>
            <span className="label mb-1.5 block">Colour</span>
            <div className="flex flex-wrap gap-2">
              {INK_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.label}
                  title={c.label}
                  aria-pressed={a.color === c.hex}
                  onClick={() => update(a.id, { color: c.hex })}
                  className={cx(
                    "h-5 w-5 rounded-full border",
                    a.color === c.hex ? "scale-110 border-warm" : "border-white/25",
                  )}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>

          <Segmented
            label="Stroke size"
            value={String(a.strokeWidth)}
            onChange={(v) => update(a.id, { strokeWidth: Number(v) })}
            options={STROKE_SIZES.map((s) => ({ value: String(s.value), label: s.label.slice(0, 5) }))}
          />

          <Field label={`Opacity — ${Math.round(a.opacity * 100)}%`}>
            {(fid) => (
              <input
                id={fid}
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={a.opacity}
                onChange={(e) => update(a.id, { opacity: Number(e.target.value) })}
                className="w-full accent-[#f2c218]"
              />
            )}
          </Field>

          {a.type === "tape" || a.type === "sticker" || a.type === "text" ? (
            <Field label="Label">
              {(fid) => (
                <input
                  id={fid}
                  className={inputClass}
                  value={a.text ?? ""}
                  onChange={(e) => update(a.id, { text: e.target.value })}
                />
              )}
            </Field>
          ) : null}

          {a.type === "tape" ? (
            <div>
              <span className="label mb-1.5 block">Tape</span>
              <div className="flex flex-wrap gap-1.5">
                {TAPE_KINDS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={a.tapeKind === t.id}
                    onClick={() => update(a.id, { tapeKind: t.id })}
                    className={cx("h-5 w-10 border", a.tapeKind === t.id ? "border-grease" : "border-white/15")}
                    style={{ background: t.fill, opacity: t.id === "transparent" ? 0.5 : 1 }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {a.geometry.kind === "box" ? (
            <Field label={`Rotation — ${Math.round(rotation)}°`}>
              {(fid) => (
                <input
                  id={fid}
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={rotation}
                  onChange={(e) =>
                    update(a.id, {
                      geometry: { ...a.geometry, rotation: Number(e.target.value) } as typeof a.geometry,
                    })
                  }
                  className="w-full accent-[#f2c218]"
                />
              )}
            </Field>
          ) : null}
        </div>
      </Panel>

      <Panel title="Arrange">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => forward(a.id)}>
            <IconLayers className="h-4 w-4" />
            Forward
          </Button>
          <Button size="sm" variant="ghost" onClick={() => backward(a.id)}>
            <IconLayers className="h-4 w-4 rotate-180" />
            Back
          </Button>
          <IconButton
            label={a.locked ? "Unlock annotation" : "Lock annotation"}
            active={a.locked}
            onClick={() => update(a.id, { locked: !a.locked })}
          >
            <IconLock className="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete annotation" onClick={() => remove(a.id)}>
            <IconTrash className="h-4 w-4" />
          </IconButton>
        </div>
        {a.photoId ? (
          <p className="mt-2 text-[11px] text-smoke">
            Anchored to a frame — it follows that photograph when you switch templates.
          </p>
        ) : null}
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------- sheet */

export function SheetInspector() {
  const doc = useEditor((s) => s.doc);
  const updateSheet = useEditor((s) => s.updateSheet);
  const setTemplate = useEditor((s) => s.setTemplate);
  const updateTemplateSettings = useEditor((s) => s.updateTemplateSettings);
  const showGrain = useEditor((s) => s.showGrain);
  const toggleGrain = useEditor((s) => s.toggleGrain);

  if (!doc) return null;
  const sheet = doc.sheet;
  const ts = sheet.templateSettings;
  const template = TEMPLATE_LIST.find((t) => t.id === sheet.templateId) ?? TEMPLATE_LIST[0];
  const get = <K extends keyof typeof template.defaults>(key: K) =>
    (ts[key as keyof typeof ts] as (typeof template.defaults)[K] | undefined) ?? template.defaults[key];

  return (
    <>
      <Panel title="Template">
        <div className="space-y-2">
          <Field label="Sheet template">
            {(id) => (
              <select
                id={id}
                className={cx(inputClass, "appearance-none pr-7")}
                value={sheet.templateId}
                onChange={(e) => setTemplate(e.target.value as TemplateId)}
              >
                {TEMPLATE_LIST.map((t) => (
                  <option key={t.id} value={t.id} className="bg-charcoal">
                    {t.name} · {t.format}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <p className="text-[11px] leading-snug text-smoke">{template.blurb}</p>
          <p className="pt-1 text-[11px] text-smoke">
            Switching keeps order, titles, statuses, notes, annotations and tape.
          </p>
        </div>
      </Panel>

      <Panel title="Layout">
        <div className="space-y-2.5">
          <Field label={`Columns — ${get("columns")}`}>
            {(id) => (
              <input
                id={id}
                type="range"
                min={2}
                max={10}
                value={get("columns")}
                onChange={(e) => updateTemplateSettings({ columns: Number(e.target.value) })}
                className="w-full accent-[#f2c218]"
              />
            )}
          </Field>
          <Field label={`Frame gap — ${get("frameGap")}`}>
            {(id) => (
              <input
                id={id}
                type="range"
                min={0}
                max={60}
                value={get("frameGap")}
                onChange={(e) => updateTemplateSettings({ frameGap: Number(e.target.value) })}
                className="w-full accent-[#f2c218]"
              />
            )}
          </Field>
          <Field label={`Row gap — ${get("stripGap")}`}>
            {(id) => (
              <input
                id={id}
                type="range"
                min={0}
                max={80}
                value={get("stripGap")}
                onChange={(e) => updateTemplateSettings({ stripGap: Number(e.target.value) })}
                className="w-full accent-[#f2c218]"
              />
            )}
          </Field>
          <Field label={`Outer margin — ${get("margin")}`}>
            {(id) => (
              <input
                id={id}
                type="range"
                min={24}
                max={180}
                value={get("margin")}
                onChange={(e) => updateTemplateSettings({ margin: Number(e.target.value) })}
                className="w-full accent-[#f2c218]"
              />
            )}
          </Field>
          <Field label="Background">
            {(id) => (
              <div className="flex items-center gap-2">
                <input
                  id={id}
                  type="color"
                  value={ts.background ?? template.palette.paper}
                  onChange={(e) => updateTemplateSettings({ background: e.target.value })}
                  className="h-8 w-12 border border-white/12 bg-transparent"
                />
                <button
                  type="button"
                  className="label hover:text-warm"
                  onClick={() => updateTemplateSettings({ background: undefined })}
                >
                  Reset
                </button>
              </div>
            )}
          </Field>
          <Field label="Edge label">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                value={get("edgeLabel")}
                onChange={(e) => updateTemplateSettings({ edgeLabel: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Panel>

      <Panel title="Show">
        <Toggle label="Sprocket holes" checked={get("showSprockets")} onChange={(v) => updateTemplateSettings({ showSprockets: v })} />
        <Toggle label="Frame numbers" checked={get("showFrameNumbers")} onChange={(v) => updateTemplateSettings({ showFrameNumbers: v })} />
        <Toggle label="Frame titles" checked={get("showTitles")} onChange={(v) => updateTemplateSettings({ showTitles: v })} />
        <Toggle label="Filenames" checked={get("showFilenames")} onChange={(v) => updateTemplateSettings({ showFilenames: v })} />
        <Toggle label="Roll metadata" checked={get("showMetadata")} onChange={(v) => updateTemplateSettings({ showMetadata: v })} />
        <Toggle label="Edge printing" checked={get("showEdgeLabel")} onChange={(v) => updateTemplateSettings({ showEdgeLabel: v })} />
        <Toggle label="Film grain" checked={showGrain} onChange={toggleGrain} hint="Preview only — export follows the sheet setting." />
      </Panel>

      <Panel title="Roll details" className="mb-4">
        <div className="space-y-2.5">
          {(
            [
              ["subtitle", "Subtitle"],
              ["rollNumber", "Roll number"],
              ["dateShot", "Date"],
              ["photographer", "Photographer"],
              ["location", "Location"],
              ["camera", "Camera"],
              ["filmStock", "Film stock"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              {(id) => (
                <input
                  id={id}
                  className={inputClass}
                  value={sheet[key]}
                  onChange={(e) => updateSheet({ [key]: e.target.value })}
                />
              )}
            </Field>
          ))}
          <Field label="Description">
            {(id) => (
              <textarea
                id={id}
                rows={3}
                className={inputClass}
                value={sheet.description}
                onChange={(e) => updateSheet({ description: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Panel>
    </>
  );
}

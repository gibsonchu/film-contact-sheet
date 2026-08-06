"use client";

import { useMemo, useRef, useState } from "react";
import { AnnotationView } from "@/components/annotations/AnnotationView";
import { PostcardBack } from "@/components/sheet/PostcardBack";
import { SheetSvg } from "@/components/sheet/SheetSvg";
import { Button, Dialog, Segmented, Toggle } from "@/components/ui/primitives";
import { exportPostcardPdf, exportSheetPdf } from "@/lib/export/pdf";
import { downloadBlob, rasterizeSvg, scaleForDpi, slugify } from "@/lib/export/render";
import { computeLayout } from "@/lib/layout";
import { useEditor } from "@/lib/store/editor";
import { formatBytes } from "@/lib/images";
import type { ExportFormat } from "@/lib/types";

const RESOLUTIONS = [
  { value: "1", label: "Screen" },
  { value: "2", label: "Print 2×" },
  { value: String(scaleForDpi(300)), label: "300 DPI" },
];

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const urls = useEditor((s) => s.urls);

  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState(String(scaleForDpi(300)));
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [includeTitles, setIncludeTitles] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [transparent, setTransparent] = useState(false);
  const [trimMarks, setTrimMarks] = useState(false);
  const [bleed, setBleed] = useState(3);
  const [bothSides, setBothSides] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const frontRef = useRef<SVGSVGElement>(null);
  const backRef = useRef<SVGSVGElement>(null);

  const isPostcard = format === "postcard-pdf";

  const layout = useMemo(() => {
    if (!doc) return null;
    return computeLayout({
      templateId: isPostcard ? "postcard" : doc.sheet.templateId,
      templateSettings: doc.sheet.templateSettings,
      photos: doc.photos,
      overrides: { showTitles: includeTitles, showMetadata: includeMetadata },
    });
  }, [doc, isPostcard, includeTitles, includeMetadata]);

  if (!doc || !layout) return null;

  const numericScale = Number(scale);
  const outWidth = Math.round(layout.width * numericScale);
  const outHeight = Math.round(layout.height * numericScale);

  async function run() {
    const svg = frontRef.current;
    if (!svg) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const base = slugify(doc!.sheet.title);
      const background = transparent && format === "png" ? null : layout!.background;
      let blob: Blob;
      let filename: string;

      if (format === "png" || format === "jpeg") {
        blob = await rasterizeSvg(svg, {
          scale: numericScale,
          mime: format === "png" ? "image/png" : "image/jpeg",
          quality: 0.94,
          background: format === "jpeg" ? layout!.background : background,
        });
        filename = `${base}.${format === "png" ? "png" : "jpg"}`;
      } else if (format === "pdf") {
        blob = await exportSheetPdf(svg, {
          scale: numericScale,
          bleedMm: bleed,
          trimMarks,
          background: layout!.background,
        });
        filename = `${base}.pdf`;
      } else {
        blob = await exportPostcardPdf(svg, bothSides ? backRef.current : null, {
          scale: numericScale,
          bleedMm: bleed,
          trimMarks,
          background: layout!.background,
        });
        filename = `${base}-postcard.pdf`;
      }

      downloadBlob(blob, filename);
      setResult(`${filename} · ${formatBytes(blob.size)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export contact sheet"
      description="Rendered from the same vector description you see in the editor — not a screenshot."
    >
      <div className="space-y-4">
        <div>
          <span className="label mb-1.5 block">Format</span>
          <Segmented
            label="Export format"
            value={format}
            onChange={(v) => setFormat(v as ExportFormat)}
            options={[
              { value: "png", label: "PNG" },
              { value: "jpeg", label: "JPEG" },
              { value: "pdf", label: "PDF" },
              { value: "postcard-pdf", label: "Postcard" },
            ]}
          />
        </div>

        <div>
          <span className="label mb-1.5 block">Resolution</span>
          <Segmented label="Resolution" value={scale} onChange={setScale} options={RESOLUTIONS} />
          <p className="mt-1.5 font-mono text-[11px] text-smoke">
            {outWidth} × {outHeight} px
            {numericScale > 4 ? "  ·  300 dpi print" : ""}
          </p>
        </div>

        <div className="space-y-0.5 border-t border-white/8 pt-3">
          <Toggle label="Include annotations" checked={includeAnnotations} onChange={setIncludeAnnotations} />
          <Toggle label="Include frame titles" checked={includeTitles} onChange={setIncludeTitles} />
          <Toggle label="Include roll metadata" checked={includeMetadata} onChange={setIncludeMetadata} />
          {format === "png" ? (
            <Toggle label="Transparent background" checked={transparent} onChange={setTransparent} />
          ) : null}
          {format === "pdf" || isPostcard ? (
            <>
              <Toggle label="Trim marks" checked={trimMarks} onChange={setTrimMarks} />
              <label className="flex items-center justify-between gap-3 py-1 text-[13px] text-bone">
                Bleed
                <span className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={1}
                    value={bleed}
                    onChange={(e) => setBleed(Number(e.target.value))}
                    className="w-28 accent-[#f2c218]"
                    aria-label="Bleed in millimetres"
                  />
                  <span className="label w-8">{bleed}mm</span>
                </span>
              </label>
            </>
          ) : null}
          {isPostcard ? (
            <Toggle label="Include the back (message + address)" checked={bothSides} onChange={setBothSides} />
          ) : null}
        </div>

        {error ? <p className="text-[13px] text-darkroom">{error}</p> : null}
        {result ? <p className="text-[13px] text-bone">Saved {result}</p> : null}

        <div className="flex items-center justify-end gap-2 border-t border-white/8 pt-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy ? "Rendering…" : "Export"}
          </Button>
        </div>
      </div>

      {/* Off-screen render target: the exact sheet, with export options applied. */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", left: -99999, top: 0, width: layout.width, pointerEvents: "none" }}
      >
        <SheetSvg
          doc={doc}
          layout={layout}
          urls={urls}
          svgRef={frontRef}
          options={{
            includeAnnotations,
            includeTitles,
            includeMetadata,
            includeStatusMarks: true,
            transparentBackground: transparent && format === "png",
            grain: true,
          }}
        >
          <g>
            {[...doc.annotations]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((a) => (
                <AnnotationView key={a.id} annotation={a} />
              ))}
          </g>
        </SheetSvg>
        {isPostcard ? (
          <PostcardBack sheet={doc.sheet} width={layout.width} height={layout.height} svgRef={backRef} />
        ) : null}
      </div>
    </Dialog>
  );
}

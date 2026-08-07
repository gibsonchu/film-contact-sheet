"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationView } from "@/components/annotations/AnnotationView";
import { PostcardBack } from "@/components/sheet/PostcardBack";
import { SheetSvg } from "@/components/sheet/SheetSvg";
import { Button, Field, Panel, Segmented, inputClass } from "@/components/ui/primitives";
import { exportPostcardPdf } from "@/lib/export/pdf";
import { downloadBlob, scaleForDpi, slugify } from "@/lib/export/render";
import { computeLayout } from "@/lib/layout";
import { formatCents, type PrintFormat, type PrintQuote } from "@/lib/print/provider";
import { getStorage } from "@/lib/storage/local";
import { useEditor } from "@/lib/store/editor";
import type { SheetDocument } from "@/lib/types";

const FORMATS: { value: PrintFormat; label: string }[] = [
  { value: "postcard-6x4", label: "6×4 card" },
  { value: "postcard-7x5", label: "7×5 card" },
  { value: "print-8x10", label: "8×10 print" },
];

export function PostcardClient({ sheetId }: { sheetId: string }) {
  const [doc, setDoc] = useState<SheetDocument | null>(null);
  const urls = useEditor((s) => s.urls);
  const [side, setSide] = useState<"front" | "back">("front");
  const [format, setFormat] = useState<PrintFormat>("postcard-6x4");
  const [quote, setQuote] = useState<PrintQuote | null>(null);
  const [orderNote, setOrderNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const frontRef = useRef<SVGSVGElement>(null);
  const backRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    void (async () => {
      const found = await getStorage().loadDocument(sheetId);
      if (found) {
        setDoc(found);
        await useEditor.getState().adoptDocument(found, { readOnly: false });
      }
    })();
  }, [sheetId]);

  const layout = useMemo(() => {
    if (!doc) return null;
    return computeLayout({
      templateId: "postcard",
      templateSettings: doc.sheet.templateSettings,
      photos: doc.photos,
    });
  }, [doc]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/print/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, quantity: 1, destinationCountry: "US" }),
      });
      if (res.ok) setQuote((await res.json()) as PrintQuote);
    })();
  }, [format]);

  if (!doc || !layout) {
    return <div className="grid min-h-dvh place-items-center"><span className="label">Loading…</span></div>;
  }

  const p = doc.sheet.postcard;
  const setPostcard = (patch: Partial<typeof p>) => {
    const next = { ...doc.sheet, postcard: { ...p, ...patch } };
    const updated = { ...doc, sheet: next };
    setDoc(updated);
    useEditor.getState().updateSheet({ postcard: next.postcard });
  };

  async function exportPdf() {
    if (!frontRef.current) return;
    setExporting(true);
    try {
      const blob = await exportPostcardPdf(frontRef.current, backRef.current, {
        scale: scaleForDpi(300),
        bleedMm: 3,
        trimMarks: true,
        background: layout!.background,
      });
      downloadBlob(blob, `${slugify(doc!.sheet.title)}-postcard.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3">
        <Link href={`/sheet/${sheetId}`} className="label hover:text-warm">
          ← Editor
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg tracking-tight text-warm">
          Postcard — {doc.sheet.title}
        </h1>
        <div className="w-44">
          <Segmented
            label="Side"
            value={side}
            onChange={setSide}
            options={[
              { value: "front", label: "Front" },
              { value: "back", label: "Back" },
            ]}
          />
        </div>
        <Button variant="primary" size="sm" onClick={exportPdf} disabled={exporting}>
          {exporting ? "Rendering…" : "Print-ready PDF"}
        </Button>
      </header>

      <main id="main" className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="texture-noise shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
            <div style={{ display: side === "front" ? "block" : "none" }}>
              <SheetSvg
                doc={doc}
                layout={layout}
                urls={urls}
                svgRef={frontRef}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                <g>
                  {[...doc.annotations]
                    .sort((a, b) => a.zIndex - b.zIndex)
                    .map((a) => (
                      <AnnotationView key={a.id} annotation={a} />
                    ))}
                </g>
              </SheetSvg>
            </div>
            <div style={{ display: side === "back" ? "block" : "none" }}>
              <PostcardBack
                sheet={doc.sheet}
                width={layout.width}
                height={layout.height}
                svgRef={backRef}
                className="block h-auto w-full"
              />
            </div>
          </div>
          <p className="text-[12px] text-smoke">
            Trim size {format === "postcard-6x4" ? "6 × 4 in" : format === "postcard-7x5" ? "7 × 5 in" : "8 × 10 in"} ·
            exported at 300 DPI with 3 mm bleed and trim marks.
          </p>
        </div>

        <div className="space-y-4">
          <Panel title="Message">
            <div className="space-y-3">
              <Field label="Note">
                {(id) => (
                  <textarea
                    id={id}
                    rows={5}
                    className={inputClass}
                    value={p.message}
                    onChange={(e) => setPostcard({ message: e.target.value })}
                  />
                )}
              </Field>
              <Field label="From">
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    value={p.senderName}
                    onChange={(e) => setPostcard({ senderName: e.target.value })}
                  />
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Recipient">
            <div className="space-y-3">
              <Field label="Name">
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    value={p.recipientName}
                    onChange={(e) => setPostcard({ recipientName: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Address" hint="One line per row — street, city, postcode, country.">
                {(id) => (
                  <textarea
                    id={id}
                    rows={4}
                    className={inputClass}
                    value={p.recipientAddress}
                    onChange={(e) => setPostcard({ recipientAddress: e.target.value })}
                  />
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Print & mail">
            <div className="space-y-3">
              <Segmented label="Format" value={format} onChange={setFormat} options={FORMATS} />
              {quote ? (
                <dl className="space-y-1 font-sans text-[11px] text-smoke">
                  <div className="flex justify-between">
                    <dt>PRINT</dt>
                    <dd>{formatCents(quote.printCents, quote.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>POSTAGE</dt>
                    <dd>{formatCents(quote.postageCents, quote.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-bone">
                    <dt>TOTAL</dt>
                    <dd>{formatCents(quote.totalCents, quote.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>DELIVERY</dt>
                    <dd>
                      {quote.estimatedDeliveryDays[0]}–{quote.estimatedDeliveryDays[1]} days
                    </dd>
                  </div>
                </dl>
              ) : null}
              <Button
                className="w-full"
                onClick={async () => {
                  const res = await fetch("/api/print/order", { method: "POST" });
                  const data = (await res.json()) as { error?: string };
                  setOrderNote(data.error ?? "Order placed.");
                }}
              >
                Order and mail it
              </Button>
              <p className="text-[11px] leading-relaxed text-smoke">
                {orderNote ??
                  "Physical mailing is unavailable on this deployment — no print provider or payment processor is configured. Prices shown are indicative. Download the print-ready PDF instead."}
              </p>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}

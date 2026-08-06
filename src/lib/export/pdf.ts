"use client";

import { jsPDF } from "jspdf";
import { rasterizeToCanvas } from "./render";

const MM_PER_INCH = 25.4;

export interface PdfOptions {
  scale: number;
  /** Extra bleed in millimetres added on every edge. */
  bleedMm: number;
  trimMarks: boolean;
  background: string | null;
  orientation?: "portrait" | "landscape";
}

/**
 * PDFs embed the same rasterisation used for PNG export, placed on a page whose
 * physical size is derived from the sheet's aspect ratio at 300dpi. That keeps
 * the printed artifact identical to the on-screen sheet, with real page
 * dimensions, optional bleed and trim marks for a print shop.
 */
export async function exportSheetPdf(
  svg: SVGSVGElement,
  { scale, bleedMm, trimMarks, background }: PdfOptions,
): Promise<Blob> {
  const canvas = await rasterizeToCanvas(svg, { scale, background });
  const pxPerMm = (scale * 72) / MM_PER_INCH;
  const artWidthMm = canvas.width / pxPerMm;
  const artHeightMm = canvas.height / pxPerMm;
  const pageWidth = artWidthMm + bleedMm * 2;
  const pageHeight = artHeightMm + bleedMm * 2;

  const pdf = new jsPDF({
    unit: "mm",
    format: [pageWidth, pageHeight],
    orientation: pageWidth > pageHeight ? "landscape" : "portrait",
    compress: true,
  });

  pdf.addImage(
    canvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    bleedMm,
    bleedMm,
    artWidthMm,
    artHeightMm,
    undefined,
    "FAST",
  );

  if (trimMarks && bleedMm > 0) drawTrimMarks(pdf, pageWidth, pageHeight, bleedMm);

  return pdf.output("blob");
}

/** Postcard: contact sheet on the front, message + address block on the back. */
export async function exportPostcardPdf(
  front: SVGSVGElement,
  back: SVGSVGElement | null,
  { scale, bleedMm, trimMarks, background }: PdfOptions,
): Promise<Blob> {
  const frontCanvas = await rasterizeToCanvas(front, { scale, background });
  const pxPerMm = (scale * 72) / MM_PER_INCH;
  const artWidthMm = frontCanvas.width / pxPerMm;
  const artHeightMm = frontCanvas.height / pxPerMm;
  const pageWidth = artWidthMm + bleedMm * 2;
  const pageHeight = artHeightMm + bleedMm * 2;

  const pdf = new jsPDF({
    unit: "mm",
    format: [pageWidth, pageHeight],
    orientation: pageWidth > pageHeight ? "landscape" : "portrait",
    compress: true,
  });

  pdf.addImage(
    frontCanvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    bleedMm,
    bleedMm,
    artWidthMm,
    artHeightMm,
    undefined,
    "FAST",
  );
  if (trimMarks && bleedMm > 0) drawTrimMarks(pdf, pageWidth, pageHeight, bleedMm);

  if (back) {
    const backCanvas = await rasterizeToCanvas(back, { scale, background: "#ffffff" });
    pdf.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? "landscape" : "portrait");
    pdf.addImage(
      backCanvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      bleedMm,
      bleedMm,
      backCanvas.width / pxPerMm,
      backCanvas.height / pxPerMm,
      undefined,
      "FAST",
    );
    if (trimMarks && bleedMm > 0) drawTrimMarks(pdf, pageWidth, pageHeight, bleedMm);
  }

  return pdf.output("blob");
}

function drawTrimMarks(pdf: jsPDF, pageWidth: number, pageHeight: number, bleed: number): void {
  const len = Math.min(bleed, 5);
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.15);
  const corners: [number, number, number, number][] = [
    [bleed, 0, bleed, len],
    [0, bleed, len, bleed],
    [pageWidth - bleed, 0, pageWidth - bleed, len],
    [pageWidth, bleed, pageWidth - len, bleed],
    [bleed, pageHeight, bleed, pageHeight - len],
    [0, pageHeight - bleed, len, pageHeight - bleed],
    [pageWidth - bleed, pageHeight, pageWidth - bleed, pageHeight - len],
    [pageWidth, pageHeight - bleed, pageWidth - len, pageHeight - bleed],
  ];
  for (const [x1, y1, x2, y2] of corners) pdf.line(x1, y1, x2, y2);
}

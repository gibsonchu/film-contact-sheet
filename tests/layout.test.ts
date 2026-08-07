import { describe, expect, it } from "vitest";
import { computeLayout, fitImage, frameHitTest, frameSlotAt } from "@/lib/layout";
import { createPhoto, renumber } from "@/lib/document";
import { TEMPLATE_LIST } from "@/lib/templates";
import type { Photo } from "@/lib/types";

function photos(n: number): Photo[] {
  return renumber(
    Array.from({ length: n }, (_, i) =>
      createPhoto("s", { id: `p${i}`, width: 1500, height: 1000, position: i }),
    ),
  );
}

describe("layout engine", () => {
  it("lays a 36-frame roll into six strips of six", () => {
    const layout = computeLayout({ templateId: "classic-35mm", photos: photos(36) });
    expect(layout.columns).toBe(6);
    expect(layout.rows).toBe(6);
    expect(layout.strips).toHaveLength(6);
    expect(layout.frames).toHaveLength(36);
    expect(layout.frames.map((f) => f.frameNumber).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("adds a partial final strip for 38 frames", () => {
    const layout = computeLayout({ templateId: "classic-35mm", photos: photos(38) });
    expect(layout.rows).toBe(7);
    expect(layout.frames).toHaveLength(38);
  });

  it("excludes hidden photos from the grid", () => {
    const list = photos(6);
    list[2] = { ...list[2], hidden: true };
    const layout = computeLayout({ templateId: "classic-35mm", photos: renumber(list) });
    expect(layout.frames.filter((f) => f.photoId)).toHaveLength(5);
  });

  it("honours per-sheet setting overrides", () => {
    const base = computeLayout({ templateId: "classic-35mm", photos: photos(12) });
    const wide = computeLayout({
      templateId: "classic-35mm",
      templateSettings: { columns: 4, margin: 120 },
      photos: photos(12),
    });
    expect(wide.columns).toBe(4);
    expect(wide.rows).toBe(3);
    expect(wide.width).not.toBe(base.width);
  });

  it("produces a valid sheet for every template", () => {
    for (const template of TEMPLATE_LIST) {
      const layout = computeLayout({ templateId: template.id, photos: photos(24) });
      expect(layout.width).toBeGreaterThan(200);
      expect(layout.height).toBeGreaterThan(200);
      expect(layout.frames.length).toBeGreaterThan(0);
      for (const frame of layout.frames) {
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.width).toBeLessThanOrEqual(layout.width + 1);
      }
    }
  });

  it("butts Eliz Digital thumbnails edge to edge with no gaps", () => {
    const layout = computeLayout({ templateId: "eliz-digital", photos: photos(36) });
    expect(layout.columns).toBe(8);
    expect(layout.settings.frameGap).toBe(0);
    expect(layout.settings.stripGap).toBe(0);
    expect(layout.template.numberStyle).toBe("chip");
    expect(layout.strips).toHaveLength(0);

    const [first, second] = layout.frames;
    expect(second.x).toBeCloseTo(first.x + first.width, 5);

    const secondRow = layout.frames[8];
    expect(secondRow.y).toBeCloseTo(first.y + first.height, 5);
  });

  it("hides the roll metadata footer on templates that don't print one", () => {
    expect(computeLayout({ templateId: "eliz-digital", photos: photos(8) }).settings.showMetadata).toBe(
      false,
    );
    expect(computeLayout({ templateId: "classic-35mm", photos: photos(8) }).settings.showMetadata).toBe(
      true,
    );
  });

  it("keeps the postcard at its fixed 6:4 card size whatever the frame count", () => {
    for (const n of [4, 12, 36, 38]) {
      const layout = computeLayout({ templateId: "postcard", photos: photos(n) });
      expect(layout.width / layout.height).toBeCloseTo(6 / 4, 2);
      expect(layout.width).toBe(1200);
      expect(layout.height).toBe(800);
    }
  });

  it("never lets a postcard grid spill outside the card", () => {
    for (const n of [1, 6, 20, 36, 38]) {
      const layout = computeLayout({ templateId: "postcard", photos: photos(n) });
      for (const frame of layout.frames) {
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.width).toBeLessThanOrEqual(layout.width);
        expect(frame.y + frame.height).toBeLessThanOrEqual(layout.height);
      }
    }
  });
});

describe("hit testing", () => {
  it("finds the frame under a point", () => {
    const layout = computeLayout({ templateId: "classic-35mm", photos: photos(12) });
    const target = layout.frames[7];
    const hit = frameHitTest(layout, target.x + 5, target.y + 5);
    expect(hit?.index).toBe(7);
    expect(frameHitTest(layout, 1, 1)).toBeNull();
  });

  it("snaps to the nearest slot when dragging into a gap", () => {
    const layout = computeLayout({ templateId: "classic-35mm", photos: photos(12) });
    const target = layout.frames[3];
    const slot = frameSlotAt(layout, target.x + target.width / 2, target.y + target.height / 2);
    expect(slot?.index).toBe(3);
  });
});

describe("image fitting", () => {
  const frame = { x: 0, y: 0, width: 300, height: 200 };

  it("letterboxes a portrait frame without cropping", () => {
    const rect = fitImage(frame, 1000, 1500, "fit");
    expect(rect.clip).toBe(false);
    expect(rect.height).toBeCloseTo(200);
    expect(rect.width).toBeCloseTo(133.33, 1);
    expect(rect.x).toBeCloseTo(83.33, 1);
  });

  it("fills and clips when asked to", () => {
    const rect = fitImage(frame, 1000, 1500, "fill");
    expect(rect.clip).toBe(true);
    expect(rect.width).toBeGreaterThanOrEqual(frame.width);
    expect(rect.height).toBeGreaterThanOrEqual(frame.height);
  });

  it("accounts for a 90° rotation when fitting", () => {
    const upright = fitImage(frame, 1500, 1000, "fit", 0);
    const turned = fitImage(frame, 1500, 1000, "fit", 90);
    expect(upright.width).toBeGreaterThan(turned.width);
  });
});

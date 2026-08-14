import { describe, expect, it } from "vitest";
import { annotationAt, annotationHitTest, distanceToSegment, textBoxOf } from "@/lib/hit";
import type { Annotation, AnnotationGeometry, AnnotationTool, Point } from "@/lib/types";

function annotation(
  tool: AnnotationTool,
  geometry: AnnotationGeometry,
  overrides: Partial<Annotation> = {},
): Annotation {
  return {
    id: overrides.id ?? "a1",
    contactSheetId: "s1",
    photoId: null,
    anchor: null,
    type:
      tool === "pen" ? "stroke" : tool === "tape" ? "tape" : tool === "sticker" ? "sticker" : "shape",
    tool,
    color: "#d81f26",
    strokeWidth: 5,
    opacity: 1,
    geometry,
    text: null,
    zIndex: 1,
    locked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A roughly horizontal pen stroke — the case whose bounding box is paper-thin. */
const stroke = annotation("pen", {
  kind: "points",
  points: Array.from({ length: 20 }, (_, i) => ({ x: 100 + i * 10, y: 200 })),
});

describe("eraser hit testing", () => {
  it("catches a stroke without demanding a pixel-exact click", () => {
    // Dead on.
    expect(annotationHitTest(stroke, { x: 200, y: 200 }, 13)).toBe(true);
    // A dozen units off — a normal human miss — still erases.
    expect(annotationHitTest(stroke, { x: 200, y: 210 }, 13)).toBe(true);
    expect(annotationHitTest(stroke, { x: 200, y: 188 }, 13)).toBe(true);
  });

  it("misses when the pointer is genuinely away from the ink", () => {
    expect(annotationHitTest(stroke, { x: 200, y: 260 }, 13)).toBe(false);
    expect(annotationHitTest(stroke, { x: 400, y: 200 }, 13)).toBe(false);
  });

  it("scales its reach with the radius it is given", () => {
    const p: Point = { x: 200, y: 240 };
    expect(annotationHitTest(stroke, p, 13)).toBe(false);
    // Zoomed out, the same 13 screen pixels are far more sheet units.
    expect(annotationHitTest(stroke, p, 13 / 0.3)).toBe(true);
  });

  it("erases a circle by its outline, not by the space it encloses", () => {
    const ring = annotation("ellipse", { kind: "box", x: 0, y: 0, width: 200, height: 100 });
    // On the ring.
    expect(annotationHitTest(ring, { x: 200, y: 50 }, 8)).toBe(true);
    expect(annotationHitTest(ring, { x: 100, y: 0 }, 8)).toBe(true);
    // The framed photograph in the middle must stay clickable.
    expect(annotationHitTest(ring, { x: 100, y: 50 }, 8)).toBe(false);
  });

  it("erases a rectangle by its border only", () => {
    const box = annotation("rect", { kind: "box", x: 0, y: 0, width: 200, height: 100 });
    expect(annotationHitTest(box, { x: 100, y: 2 }, 8)).toBe(true);
    expect(annotationHitTest(box, { x: 100, y: 50 }, 8)).toBe(false);
  });

  it("erases an X along its diagonals", () => {
    const cross = annotation("x", { kind: "box", x: 0, y: 0, width: 100, height: 100 });
    expect(annotationHitTest(cross, { x: 50, y: 50 }, 6)).toBe(true);
    expect(annotationHitTest(cross, { x: 90, y: 12 }, 6)).toBe(true);
    expect(annotationHitTest(cross, { x: 50, y: 6 }, 6)).toBe(false);
  });

  it("erases an arrow along its shaft", () => {
    const arrow = annotation("arrow", { kind: "segment", x1: 0, y1: 0, x2: 100, y2: 100 });
    expect(annotationHitTest(arrow, { x: 50, y: 52 }, 6)).toBe(true);
    expect(annotationHitTest(arrow, { x: 20, y: 80 }, 6)).toBe(false);
  });

  it("treats tape as a solid object", () => {
    const tape = annotation("tape", { kind: "box", x: 0, y: 0, width: 150, height: 40 });
    expect(annotationHitTest(tape, { x: 75, y: 20 }, 4)).toBe(true);
    expect(annotationHitTest(tape, { x: 75, y: 90 }, 4)).toBe(false);
  });

  it("erases crop marks at their corners, not across the middle", () => {
    const crop = annotation("crop", { kind: "box", x: 0, y: 0, width: 200, height: 100 });
    expect(annotationHitTest(crop, { x: 4, y: 4 }, 6)).toBe(true);
    expect(annotationHitTest(crop, { x: 100, y: 50 }, 6)).toBe(false);
  });

  it("hits text across its glyphs, not just at its anchor point", () => {
    // Text is stored as an anchor with no width; its extent is derived.
    const note = annotation("text", { kind: "box", x: 100, y: 200, width: 0, height: 0 }, {
      type: "text",
      text: "reprint warmer",
      strokeWidth: 5,
    });
    const box = textBoxOf(note);
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(20);

    // The anchor sits on the baseline: the glyphs are above and to the right.
    expect(annotationHitTest(note, { x: 100, y: 200 }, 4)).toBe(true);
    expect(annotationHitTest(note, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 4)).toBe(true);
    expect(annotationHitTest(note, { x: box.x + box.width + 60, y: 200 }, 4)).toBe(false);
  });

  it("grows the text box with longer content and more lines", () => {
    const one = annotation("text", { kind: "box", x: 0, y: 0, width: 0, height: 0 }, {
      type: "text",
      text: "short",
    });
    const many = annotation("text", { kind: "box", x: 0, y: 0, width: 0, height: 0 }, {
      type: "text",
      text: "a much longer line\nand a second one",
    });
    expect(textBoxOf(many).width).toBeGreaterThan(textBoxOf(one).width);
    expect(textBoxOf(many).height).toBeGreaterThan(textBoxOf(one).height);
  });

  it("never erases a locked annotation", () => {
    const locked = annotation("pen", stroke.geometry, { locked: true });
    expect(annotationAt([locked], { x: 200, y: 200 }, 13)).toBeNull();
  });

  it("takes the topmost annotation when several overlap", () => {
    const under = annotation("pen", stroke.geometry, { id: "under", zIndex: 1 });
    const over = annotation("pen", stroke.geometry, { id: "over", zIndex: 9 });
    expect(annotationAt([under, over], { x: 200, y: 200 }, 13)?.id).toBe("over");
  });

  it("returns nothing when the pointer is over empty sheet", () => {
    expect(annotationAt([stroke], { x: 900, y: 900 }, 13)).toBeNull();
  });
});

describe("distanceToSegment", () => {
  it("measures perpendicular distance inside the segment", () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it("clamps to the endpoints beyond the segment", () => {
    expect(distanceToSegment({ x: 14, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(4);
  });

  it("handles a zero-length segment", () => {
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

# Visual references

This folder is for the reference imagery used while designing the sheet
renderer — contact sheets, darkroom proofs, lab index prints and marked-up film
strips. **Drop those files in here as `01-*.jpg`, `02-*.jpg`, …**

They are development reference only:

- Nothing in this folder is imported, bundled or shipped.
- `references/*` is git-ignored apart from this file, so no third-party
  photograph ends up in the repository or on the deployed site.
- No reference is reproduced; the app's look is built from the shared visual
  language below, not from any single image.

## What was extracted from the references

**Film strip construction.** Frames sit on a continuous black carrier, not in
separate boxes. Sprocket holes run above and below in a regular pitch, punched
in the sheet's background colour so the strip reads as a physical object.
Frames are separated by a few millimetres of base, and the gap between strips is
larger than the gap between frames. → `src/lib/layout.ts`, `FilmStrip` in
`src/components/sheet/SheetSvg.tsx`.

**Frame numbering.** Small monospaced numerals in the carrier below each frame,
plus repeating edge printing (film stock name) along the sprocket band in a
tinted ink. Numbers belong to the film, not to a UI layer — so they render in
the sheet and appear in exports. Brand names are never used; the edge label is a
user-editable string defaulting to a generic "PAN 400".

**The marking vocabulary.** Everything an editor does to a proof is one of a
small set of gestures: a ring around a keeper (often overshooting, drawn in one
or one-and-a-bit laps), a hard X across a reject, a tick or a bracket for a
selection, corner marks for a crop, a scribble to kill a frame, an arrow with a
short handwritten instruction. These are implemented as *hand-drawn path
generators* seeded per annotation so no two are identical:
`src/lib/hand.ts`.

**Ink character.** Grease pencil is thick, chalky and slightly translucent, and
it varies with pressure. China marker is the same in white. Fine pen is thin and
even. Highlighter is wide and multiplies over what's beneath. Modelled as
per-tool stroke parameters over pressure-sampled points:
`TOOL_STYLE` in `src/lib/palette.ts` + `src/lib/stroke.ts`.

**Tape and labels.** Masking tape, red artist tape, yellow lab tape, white paper
tape, a numbered label, and adhesive dots. Ends are torn rather than cut, the
tape sits at a few degrees off square, it casts a small shadow, and it often
carries a handwritten roll number. → `Tape` in
`src/components/annotations/AnnotationView.tsx`.

**Margins are part of the sheet.** Notes, arrows, tape and roll data live in the
black space around the strips as much as on the frames themselves, so the
annotation layer spans the whole sheet, not just the images.

**Analog imperfection.** Frames are a fraction of a degree out of true, grain
sits over everything, and blacks are never pure. Deterministic per-photo tilt
(`frameTilt`) plus a tiling grain texture; both survive into the export.

**Restraint in the chrome.** The reference sheets are black, white and one ink
colour. The UI keeps to near-black, charcoal, warm white and paper cream, with
darkroom red and grease-pencil yellow used only for marks and state.

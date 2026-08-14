# Film Contact Sheet

A proofing table for photographs. Upload a roll, get a contact sheet that looks
like it came out of a darkroom, mark it up with grease pencil and tape, and
export something worth printing.

- **Live:** https://film-contact-sheet.vercel.app
- **Demo roll:** `/demo` — 36 procedurally generated frames, already marked up.
  No account, no upload, nothing to install.

---

## What it does

**Build a sheet.** Drop up to 38 photographs — or a whole folder, walked
recursively and sorted the way you numbered them (JPG, PNG, WebP, HEIC where
the browser can decode it). Photographs can be added to a sheet later from the
filmstrip, files or folder. More than 38 — one 35mm roll — and the upload is split
into additional sheets, with the split explained on screen. RAW is rejected with
a readable message rather than a silent failure.

**Read the roll.** Seven templates, all driven by one geometry engine: Eliz
Digital (the default — a scanning-lab index print with thumbnails butted edge to
edge, a notes bar and an order slip), Classic 35mm (sprocket holes, edge
printing, six frames to a strip), Darkroom Proof, Photographer Edit, Archival
Sheet, Lab Print index, and a 6×4 Postcard.
Switching templates keeps order, titles, statuses, notes, annotations and tape;
frame-anchored annotations are re-expressed against the new frame geometry.

**Mark it up.** One pen and an eraser; circle, X, check, arrow, rectangle, line,
crop marks and text; masking / artist / lab / paper / transparent tape, numbered
labels and sticker dots. Six inks, four
stroke weights, opacity, undo/redo, layer order, lock. Strokes are
pressure-sampled and re-outlined at render time, so nothing is baked into a
bitmap — a mark drawn on screen is still a crisp vector at 300 DPI. You can draw
in the black margins as well as over the frames.

**Review it.** Favourite / selected / maybe / rejected / unreviewed, rendered as
hand-drawn editorial marks rather than badges, with a filter bar over the sheet
and a filmstrip for jumping about. The enlarged viewer has zoom, pan,
fullscreen, keyboard navigation (`←/→`, `F` `S` `M` `X` `U`, `+`/`−`, `0`,
space to pan, `Esc`).

**Send it on.** 300 DPI PNG/JPEG, PDF with bleed and trim marks, a print-ready
postcard PDF with the sheet on the front and a message/address block on the
back, a clean preview page, share links (view / comment / password) and an
email hand-off.

---

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required — the app is
local-first and stores everything in the browser.

```bash
npm run check      # typecheck + lint + unit tests
npm run test       # vitest
npm run test:e2e   # playwright (starts a dev server if one isn't running)
npm run build      # production build
```

### Optional configuration

Copy `.env.example` to `.env.local`. Everything in it is optional:

| Variable | Turns on |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts, cloud storage, share links that work on other devices |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending a share link by email |
| `PRINT_PROVIDER`, `PRINT_PROVIDER_API_KEY` | Ordering a physical postcard (see limitations) |

With Supabase configured, run the migrations in `supabase/migrations/` in order
(`supabase db push`, or paste them into the SQL editor).

### Deploying

The app is a standard Next.js project and deploys to Vercel with no
configuration:

```bash
vercel --prod
```

Set any of the optional variables above in the Vercel project settings; without
them the deployment still works in local-first mode.

---

## Architecture

```
src/
  app/                    routes: /, /new, /projects, /sheet/[id](+preview,postcard),
                          /share/[token], /demo, /login, /signup, /api/*
  components/
    sheet/SheetSvg.tsx    the contact sheet itself (film chrome, frames, marks)
    annotations/          annotation rendering + geometry maths
    editor/               top bar, tool rail, canvas, inspector, filmstrip,
                          lightbox, export and share dialogs
    viewer/               read-only presentation shared by preview and /share
  lib/
    types.ts              domain model (mirrors the SQL schema)
    templates.ts          template definitions — pure data
    layout.ts             geometry engine: template + photos -> boxes
    hand.ts               seeded hand-drawn path generators
    fonts.ts              the single Helvetica stack, shared by screen and export
    stroke.ts             pressure-sampled freehand outlines
    store/editor.ts       zustand editor state, history, autosave
    storage/              persistence boundary (local IndexedDB adapter today)
    export/               rasteriser and PDF writer
    demo.ts               procedurally generated demo roll
    email/, print/        provider abstractions
supabase/migrations/      Postgres schema + RLS + shared-read RPCs
e2e/, tests/              Playwright flows and Vitest unit tests
```

### Decisions worth explaining

**The sheet is one SVG, and that SVG is the export.** The renderer emits the
whole sheet — film base, sprockets, frame numbers, photographs, status marks,
annotations, tape — as a single resolution-independent SVG in "sheet units". The
exporter clones that live element, inlines each image as a data URI, stamps on
print dimensions and rasterises it through a canvas. So the 300 DPI PNG is a
re-render of exactly what is on screen, not an upscaled screenshot, and there is
no second drawing code path to keep in sync. It also needs no server, which is
what makes export work in the local-first build.

**Layout is a pure function.** `computeLayout(template, settings, photos)`
returns boxes; everything else (rendering, hit testing, drag targets,
annotation remapping, export) consumes that one result. Adding 120 film, 6×6,
Polaroid grids or slide mounts means adding a record to `templates.ts`.

**Marks are generated, not drawn.** Every circle, X, tick, crop mark and
rectangle goes through seeded path generators in `lib/hand.ts`, so nothing looks
like a vector primitive, and a given mark redraws identically on screen and in
export. Freehand strokes keep their raw pressure samples and are outlined at
render time by `perfect-freehand`.

**Annotations are objects, anchored where it matters.** They are stored as JSON
with a discriminated-union geometry, never composited into the photographs. A
mark made over a frame records that frame's id and a normalised anchor, so it
travels with the photograph when the template changes; a mark in the margin
scales with the sheet.

**Persistence is behind an adapter.** `StorageAdapter` has one implementation
today (IndexedDB: documents in one database, image blobs in another, so a
document can be listed without pulling image bytes into memory). The Supabase
adapter drops into the same interface — no editor code imports a storage
implementation.

**Deviations from the suggested stack.** dnd-kit and Fabric/Konva were left out.
Frame reordering and annotation editing both happen inside the SVG coordinate
space, and mixing a DOM drag library or a second canvas scene graph into that
would have meant maintaining two coordinate systems and, worse, a second render
path that the exporter could not reuse. Reordering is implemented directly on
pointer events (~60 lines, including double-tap to enlarge and shift-to-swap);
annotations are plain SVG driven by the same layout. Everything else follows the
brief: Next.js App Router, TypeScript, Tailwind, Zustand, React Hook Form + Zod,
Resend, Vercel.

---

## Known limitations

- **Sharing is device-local until Supabase is configured.** Sheets live in the
  browser, so a `/share/<token>` link only resolves on the device that created
  it. The UI says so where the link is generated. Password protection is
  likewise a client-side gate in this mode — the migration in
  `0002_sharing.sql` moves both to security-definer RPCs that check
  server-side.
- **Accounts are not wired up.** `/login` and `/signup` validate properly and
  then tell you accounts need Supabase credentials, rather than pretending.
- **Physical mail is off.** The postcard designer, preview, address form and
  indicative pricing are all real; `POST /api/print/order` returns 501 until a
  `PrintProvider` and a payment processor are configured. No payment details are
  collected or stored anywhere in this app.
- **HEIC depends on the browser.** Decoding is attempted through
  `createImageBitmap` and an `<img>` fallback; browsers without HEIC support
  report a clear error instead of a broken frame. No RAW support.
- **EXIF is read only as far as orientation.** The browser applies orientation
  during decode; camera/lens/exposure fields exist in the model and render when
  present, but nothing parses them out of the file yet (the demo roll populates
  them).
- **Export is client-side, so it is bounded by the tab.** A 38-frame sheet at
  300 DPI is roughly 6250 × 7400 px and takes a few seconds; the canvas is
  clamped to 16384 px on the long edge.
- **Comments are stored with the sheet locally,** so in local-first mode a
  visitor's comment lands in the same browser profile as the sheet.
- **One undo history, in memory.** It is not persisted across a reload, and it
  covers document changes (order, statuses, text, annotations), not view state.

---

## What I'd build next, in order

1. **Supabase adapter + auth** — the single change that turns share links,
   accounts and the project library into real multi-device features. Schema,
   RLS and the shared-read RPCs are already written and reviewed.
2. **Server-side export worker** — the same SVG, rendered by a headless browser
   on demand, so a share link can offer a print-quality download without the
   viewer's tab doing the work, and so exports can be stored (`exports` table
   already exists).
3. **Crop by direct manipulation** — dragging the crop box on the frame instead
   of four sliders in the inspector.
4. **120 / 6×6 / Polaroid / slide-mount templates** — mostly data entry against
   the existing template records, plus per-format sprocket and border art.
5. **Frame comments with resolution** — pin a comment to a frame in the shared
   view, resolve it in the editor; the data model supports it already.
6. **Real EXIF parsing** — populate camera, lens, exposure and date from the
   file, and offer them as an optional caption line.
7. **Print-and-mail integration** — a Lob or Gelato implementation of
   `PrintProvider`, behind a real checkout.
8. **Collaborative review** — multiple reviewers marking the same sheet, each
   with their own ink colour.

---

## Testing

```bash
npm run test       # 34 unit tests
npm run test:e2e   # 11 end-to-end flows
```

Unit tests cover the state transformations that everything else depends on:
frame renumbering after reorder/remove/hide, swapping, the 38-frame roll split,
template switching preserving data, annotation remapping between layouts, the
layout engine across all six templates, image fitting, undo/redo, read-only
enforcement, and the guarantee that a shared document never carries private
notes.

End-to-end tests cover the real flows: the demo roll rendering 36 frames, drag
reordering with renumbering, drawing then undoing and redoing an annotation,
review status persisting across a reload, template switching, the enlarged
viewer's keyboard navigation, the 38-frame limit and the split beyond it, RAW
rejection, a shared view being read-only with private notes absent from the
page source, and a 300 DPI PNG export downloading.

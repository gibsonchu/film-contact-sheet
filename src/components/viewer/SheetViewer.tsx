"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnnotationView } from "@/components/annotations/AnnotationView";
import { SheetSvg } from "@/components/sheet/SheetSvg";
import { Button, cx, inputClass } from "@/components/ui/primitives";
import { downloadBlob, rasterizeSvg, scaleForDpi, slugify } from "@/lib/export/render";
import { computeLayout } from "@/lib/layout";
import { getStorage } from "@/lib/storage/local";
import { useEditor } from "@/lib/store/editor";
import { uid } from "@/lib/document";
import type { Comment, SheetDocument } from "@/lib/types";

interface Props {
  doc: SheetDocument;
  /** Preview shows the owner's chrome; share shows the visitor's. */
  mode: "preview" | "share";
  allowComments?: boolean;
  allowDownload?: boolean;
}

/**
 * Read-only presentation of a sheet, shared by /sheet/[id]/preview and
 * /share/[token]. Private notes are never rendered here.
 */
export function SheetViewer({ doc, mode, allowComments = false, allowDownload = true }: Props) {
  const urls = useEditor((s) => s.urls);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [comments, setComments] = useState<Comment[]>(doc.comments);

  useEffect(() => {
    void useEditor.getState().adoptDocument(doc, { readOnly: true });
  }, [doc]);

  const layout = useMemo(
    () =>
      computeLayout({
        templateId: doc.sheet.templateId,
        templateSettings: doc.sheet.templateSettings,
        photos: doc.photos,
      }),
    [doc],
  );

  const selectedPhotoId = useEditor((s) => s.selectedPhotoId);
  const selectedPhoto = doc.photos.find((p) => p.id === selectedPhotoId) ?? null;

  async function download() {
    if (!svgEl) return;
    setExporting(true);
    try {
      const blob = await rasterizeSvg(svgEl, {
        scale: scaleForDpi(300),
        mime: "image/png",
        background: layout.background,
      });
      downloadBlob(blob, `${slugify(doc.sheet.title)}.png`);
    } finally {
      setExporting(false);
    }
  }

  async function addComment(body: string, authorName: string) {
    const storage = getStorage();
    const fresh = await storage.loadDocument(doc.sheet.id);
    if (!fresh) return;
    const comment: Comment = {
      id: uid("comment"),
      contactSheetId: doc.sheet.id,
      photoId: selectedPhotoId,
      authorName: authorName || "Anonymous",
      authorEmail: null,
      body,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    fresh.comments = [...fresh.comments, comment];
    await storage.saveDocument(fresh);
    setComments(fresh.comments);
  }

  return (
    <div className="min-h-dvh bg-noir">
      <header className="hair-b flex h-9 flex-wrap items-center gap-4 px-3">
        <h1 className="truncate text-[12px] text-warm">{doc.sheet.title}</h1>
        <p className="label min-w-0 flex-1 truncate">
          {mode === "share" ? "Shared contact sheet" : "Preview"}
          {doc.sheet.photographer ? ` · ${doc.sheet.photographer}` : ""}
        </p>
        {mode === "preview" ? (
          <Link href={`/sheet/${doc.sheet.id}`} className="label hover:text-warm">
            Editor
          </Link>
        ) : null}
        {allowDownload ? (
          <Button size="sm" onClick={download} disabled={exporting}>
            {exporting ? "Rendering…" : "Download PNG"}
          </Button>
        ) : null}
      </header>

      <main id="main" className="mx-auto max-w-[1500px] px-4 py-8">
        <div className="mx-auto w-full max-w-[1100px]">
          <SheetSvg
            doc={doc}
            layout={layout}
            urls={urls}
            svgRef={setSvgEl}
            interactive
            style={{ width: "100%", height: "auto", display: "block" }}
            selectedPhotoId={selectedPhotoId}
            onFramePointerDown={(frame) => {
              if (frame.photoId) useEditor.getState().selectPhoto(frame.photoId);
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
        </div>

        {doc.sheet.description ? (
          <p className="mx-auto mt-6 max-w-xl text-center text-[12px] leading-relaxed text-bone">
            {doc.sheet.description}
          </p>
        ) : null}

        <section className="mx-auto mt-10 grid max-w-3xl gap-8 md:grid-cols-2">
          <div>
            <h2 className="label hair-b mb-2 pb-1">Frames</h2>
            <ul>
              {doc.photos
                .filter((p) => !p.hidden && (p.title || p.publicNote || p.caption))
                .map((p) => (
                  <li key={p.id} className="row">
                    <span className="label">
                      {String(p.frameNumber).padStart(2, "0")}
                    </span>
                    <span className="text-[11px] text-bone">
                      {p.title || p.originalFilename}
                      {p.caption ? <span className="text-smoke"> — {p.caption}</span> : null}
                      {p.publicNote ? (
                        <span className="mt-0.5 block text-[11px] text-smoke">{p.publicNote}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {allowComments ? (
            <CommentPanel
              comments={comments}
              onSubmit={addComment}
              frameLabel={selectedPhoto ? `frame ${selectedPhoto.frameNumber}` : "the whole sheet"}
              photos={doc.photos}
            />
          ) : null}
        </section>
      </main>

    </div>
  );
}

function CommentPanel({
  comments,
  onSubmit,
  frameLabel,
  photos,
}: {
  comments: Comment[];
  onSubmit: (body: string, author: string) => Promise<void>;
  frameLabel: string;
  photos: SheetDocument["photos"];
}) {
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div>
      <h2 className="label hair-b mb-2 pb-1">Comments</h2>
      <ul className="mb-3 space-y-2">
        {comments.map((c) => {
          const photo = photos.find((p) => p.id === c.photoId);
          return (
            <li key={c.id} className="hair-b py-2">
              <p className="text-[11px] text-bone">{c.body}</p>
              <p className="label mt-0.5">
                {c.authorName}
                {photo ? ` · frame ${photo.frameNumber}` : " · sheet"}
              </p>
            </li>
          );
        })}
        {comments.length === 0 ? <li className="label py-1">No comments yet.</li> : null}
      </ul>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setSending(true);
          await onSubmit(body.trim(), author.trim());
          setBody("");
          setSending(false);
        }}
      >
        <p className="label">Commenting on {frameLabel} — click a frame to change that.</p>
        <input
          className={inputClass}
          placeholder="Your name"
          aria-label="Your name"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <textarea
          className={cx(inputClass, "min-h-[70px]")}
          placeholder="Leave a note…"
          aria-label="Comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button size="sm" type="submit" disabled={sending || !body.trim()}>
          {sending ? "Posting…" : "Post comment"}
        </Button>
      </form>
    </div>
  );
}

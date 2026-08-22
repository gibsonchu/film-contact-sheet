"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnnotationView } from "@/components/annotations/AnnotationView";
import { SheetSvg } from "@/components/sheet/SheetSvg";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IconBookmark, IconHeart } from "@/components/icons";
import { Button, IconButton, cx } from "@/components/ui/primitives";
import { computeLayout } from "@/lib/layout";
import { cloudAdapter } from "@/lib/storage/cloud";
import { getPublicSheet, isBookmarked, isLiked, toggleBookmark, toggleLike, type PublicSheetCard } from "@/lib/explore";
import { useAuth } from "@/lib/store/auth";
import type { SheetDocument } from "@/lib/types";

/**
 * A visitor's view of a published sheet: redacted to whatever public_fields
 * the creator chose, rendered from the same preview-resolution asset
 * (PREVIEW_MAX_EDGE in lib/images.ts, ~1800px) the editor itself uses — not
 * the never-uploaded original, and never a permanent public URL (getAssetUrl
 * signs a fresh one). Enough to appreciate the print, not to lift a
 * full-resolution file from.
 */
export function ExploreDetail({ id }: { id: string }) {
  const user = useAuth((s) => s.user);
  const [card, setCard] = useState<PublicSheetCard | null | undefined>(undefined);
  const [doc, setDoc] = useState<SheetDocument | null>(null);
  const [showMarkup, setShowMarkup] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const c = await getPublicSheet(id);
      if (cancelled) return;
      setCard(c);
      if (!c) return;
      setLikeCount(c.likeCount);
      const full = await cloudAdapter.loadDocument(id);
      if (!cancelled) setDoc(full);
      if (user) {
        const [l, b] = await Promise.all([isLiked(id, user.id), isBookmarked(id, user.id)]);
        if (!cancelled) {
          setLiked(l);
          setSaved(b);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void (async () => {
      const entries: [string, string][] = [];
      for (const p of doc.photos) {
        for (const key of [p.storagePath, p.thumbPath]) {
          if (!key) continue;
          const url = await cloudAdapter.getAssetUrl(key);
          if (url) entries.push([key, url]);
        }
      }
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const layout = useMemo(() => {
    if (!doc) return null;
    return computeLayout({
      templateId: doc.sheet.templateId,
      templateSettings: doc.sheet.templateSettings,
      orientation: doc.sheet.orientation,
      photos: doc.photos,
    });
  }, [doc]);

  async function like() {
    if (!user || !card) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    await toggleLike(card.id, user.id, next);
  }
  async function bookmark() {
    if (!user || !card) return;
    const next = !saved;
    setSaved(next);
    await toggleBookmark(card.id, user.id, next);
  }

  if (card === undefined || (card && !doc)) {
    return <Centered>Reading the shelf…</Centered>;
  }
  if (card === null) {
    return (
      <Centered>
        <p className="mb-4 text-[12px] text-bone">This sheet isn’t public, or doesn’t exist.</p>
        <Link href="/explore">
          <Button variant="primary">Back to Explore</Button>
        </Link>
      </Centered>
    );
  }
  if (!doc || !layout) return null;

  const publicDoc: SheetDocument = {
    ...doc,
    sheet: {
      ...doc.sheet,
      title: card.title ?? "",
      photographer: card.photographer ?? "",
      description: card.description ?? "",
      filmStock: card.filmStock ?? "",
      camera: card.camera ?? "",
      dateShot: card.dateShot ?? "",
      location: card.location ?? "",
    },
    // privateNote is never public regardless of publish settings; publicNote
    // follows the creator's Notes toggle specifically.
    photos: doc.photos.map((p) => ({ ...p, privateNote: "", publicNote: card.showNotes ? p.publicNote : "" })),
    annotations: card.showAnnotations ? doc.annotations : [],
  };
  const hasAnnotations = card.showAnnotations && doc.annotations.length > 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <Link href="/explore" className="label hover:text-warm">
            ‹ Explore
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-3 py-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            {card.title ? <p className="text-[13px] text-warm">{card.title}</p> : null}
            {card.photographer ? <p className="label">{card.photographer}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {hasAnnotations ? (
              <Button variant="outline" size="sm" onClick={() => setShowMarkup((v) => !v)}>
                {showMarkup ? "Hide markup" : "Show markup"}
              </Button>
            ) : null}
            <IconButton label={liked ? "Unlike" : "Like"} active={liked} onClick={like} disabled={!user}>
              <IconHeart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
            </IconButton>
            <span className="label -ml-1">{likeCount}</span>
            <IconButton label={saved ? "Remove bookmark" : "Bookmark"} active={saved} onClick={bookmark} disabled={!user}>
              <IconBookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
            </IconButton>
          </div>
        </div>

        {/* Pan by scrolling, zoom with pinch/ctrl-scroll — the browser's own
            native image handling, not a bespoke canvas viewer. */}
        <div className="max-h-[75vh] overflow-auto border border-[var(--line)]">
          <SheetSvg
            doc={publicDoc}
            layout={layout}
            urls={urls}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            {showMarkup ? (
              <g>
                {[...publicDoc.annotations]
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map((a) => (
                    <AnnotationView key={a.id} annotation={a} />
                  ))}
              </g>
            ) : null}
          </SheetSvg>
        </div>

        {card.filmStock || card.camera || card.dateShot || card.location ? (
          <p className="label mt-3">
            {[card.filmStock, card.camera, card.dateShot, card.location].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {!user ? <p className="label mt-3">Sign in to like or bookmark this sheet.</p> : null}
      </main>

      <SiteFooter />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className={cx("flex h-dvh flex-col items-center justify-center gap-3 bg-noir p-6 text-center")}>
      {children}
    </div>
  );
}

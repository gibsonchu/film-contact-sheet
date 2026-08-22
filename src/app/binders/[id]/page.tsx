"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getBinder, type BinderDetail } from "@/lib/binders";
import { useAuth } from "@/lib/store/auth";

export default function BinderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [binder, setBinder] = useState<BinderDetail | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const b = await getBinder(id);
      if (!cancelled) setBinder(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <Link href="/binders" className="label hover:text-warm">
            ‹ Binders
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-3 py-10">
        {authLoading ? null : !user ? (
          <p className="label max-w-sm leading-relaxed">
            <Link href="/login" className="hover:text-warm">
              Sign in
            </Link>{" "}
            to view this binder.
          </p>
        ) : binder === undefined ? (
          <p className="label">Reading the shelf…</p>
        ) : binder === null ? (
          <p className="label max-w-sm leading-relaxed">
            This binder doesn’t exist, or you don’t have access to it.
          </p>
        ) : (
          <>
            <h1 className="mb-1 text-[13px] text-warm">{binder.title}</h1>
            <p className="label mb-6">
              {binder.sheetCount} sheet{binder.sheetCount === 1 ? "" : "s"}
              {binder.sourceSheetTitle ? ` · marked up from ${binder.sourceSheetTitle}` : ""}
            </p>

            {binder.sourceSheetId ? (
              <div className="mb-8">
                <span className="label mb-2 block">Source sheet</span>
                <Link href={`/sheet/${binder.sourceSheetId}`} className="block w-40">
                  <div className="flex aspect-[4/3] items-end justify-center overflow-hidden border border-[var(--line)] bg-charcoal">
                    {binder.sourceCoverThumb ? (
                      <img src={binder.sourceCoverThumb} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="label m-auto">Empty</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-warm">{binder.sourceSheetTitle}</p>
                </Link>
              </div>
            ) : null}

            {binder.sheets.length === 0 ? (
              <p className="label">No sheets in this binder yet.</p>
            ) : (
              <>
                <span className="label mb-2 block">
                  {binder.sourceSheetId ? "Marked up by" : "Sheets"}
                </span>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
                  {binder.sheets.map((s) => (
                    <li key={s.id}>
                      <Link href={`/sheet/${s.id}`} className="block">
                        <div className="flex aspect-[4/3] items-end justify-center overflow-hidden border border-[var(--line)] bg-charcoal">
                          {s.coverThumb ? (
                            <img src={s.coverThumb} alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="label m-auto">Empty</span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[11px] text-warm">{s.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

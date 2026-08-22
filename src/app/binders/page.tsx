"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BinderCard } from "@/components/binders/BinderCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/primitives";
import { createBinder, listMyBinders, type BinderSummary } from "@/lib/binders";
import { isSupabaseConfigured } from "@/lib/storage/adapter";
import { useAuth } from "@/lib/store/auth";

export default function BindersPage() {
  const configured = isSupabaseConfigured();
  const { user, loading: authLoading } = useAuth();
  const [binders, setBinders] = useState<BinderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!configured || !user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const list = await listMyBinders();
      if (!cancelled) {
        setBinders(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, user]);

  async function newBinder() {
    const title = prompt("Binder name", "Untitled Binder");
    if (!title) return;
    setBusy(true);
    try {
      await createBinder(title);
      setBinders(await listMyBinders());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <Link href="/about" className="label hover:text-warm">
            About
          </Link>
          <Link href="/sheets" className="label hover:text-warm">
            Sheets
          </Link>
          {configured && user ? (
            <Button variant="primary" size="sm" onClick={newBinder} disabled={busy}>
              New Binder
            </Button>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-3 py-10">
        {!configured || (!authLoading && !user) ? (
          <div className="max-w-sm">
            <h1 className="mb-2 text-[13px] text-warm">Binders</h1>
            <p className="label leading-relaxed">
              {configured ? (
                <>
                  <Link href="/login" className="hover:text-warm">
                    Sign in
                  </Link>{" "}
                  to keep binders — folders for your own sheets, and a place to see everyone’s markup on a sheet
                  you’ve shared.
                </>
              ) : (
                "Binders need cloud storage, which isn't set up on this deployment yet."
              )}
            </p>
          </div>
        ) : loading || authLoading ? (
          <p className="label">Reading the shelf…</p>
        ) : binders.length === 0 ? (
          <div className="max-w-sm">
            <h1 className="mb-2 text-[13px] text-warm">Binders</h1>
            <p className="label leading-relaxed">
              Nothing here yet. Binders collect a sheet’s markup copies once you enable it in Share, or hold a
              folder of your own sheets you create yourself.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mb-4 text-[13px] text-warm">Binders</h1>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
              {binders.map((b) => (
                <li key={b.id}>
                  <BinderCard binder={b} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

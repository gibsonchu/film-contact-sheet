"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExploreCard } from "@/components/community/ExploreCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/primitives";
import { listPublicSheets, searchCommunity, type PublicSheetCard, type SearchResults } from "@/lib/explore";
import { isSupabaseConfigured } from "@/lib/storage/adapter";

export function ExplorePage() {
  const configured = isSupabaseConfigured();
  const [sheets, setSheets] = useState<PublicSheetCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!configured) {
        if (!cancelled) setLoading(false);
        return;
      }
      const list = await listPublicSheets();
      if (!cancelled) {
        setSheets(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const q = query.trim();
    const timer = setTimeout(
      () => {
        if (!q) {
          if (!cancelled) setResults(null);
          return;
        }
        void searchCommunity(q).then((r) => {
          if (!cancelled) setResults(r);
        });
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, configured]);

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
          <Link href="/new">
            <Button variant="primary" size="sm">
              New Sheet
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {configured ? (
        <div className="hair-b">
          <div className="mx-auto max-w-4xl px-3 py-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sheets and people"
              aria-label="Search the community"
              className="w-full max-w-sm border border-[var(--line)] bg-transparent px-2.5 py-1.5 text-[12px] text-warm outline-none placeholder:text-smoke focus:border-warm sm:w-72"
            />
          </div>
        </div>
      ) : null}

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-3 py-8">
        {!configured ? (
          <div className="max-w-sm">
            <h1 className="mb-2 text-[13px] text-warm">Explore</h1>
            <p className="label leading-relaxed">
              Explore needs cloud storage, which isn’t set up on this deployment yet.
            </p>
          </div>
        ) : results ? (
          <SearchResultsView results={results} query={query} />
        ) : loading ? (
          <p className="label">Reading the shelf…</p>
        ) : sheets.length === 0 ? (
          <div className="max-w-sm">
            <h1 className="mb-2 text-[13px] text-warm">Explore</h1>
            <p className="label leading-relaxed">Nothing published yet. Be the first — publish a sheet from its Share menu.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {sheets.map((s) => (
              <li key={s.id}>
                <ExploreCard sheet={s} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function SearchResultsView({ results, query }: { results: SearchResults; query: string }) {
  if (results.sheets.length === 0 && results.people.length === 0) {
    return <p className="label">No results for “{query}”.</p>;
  }
  return (
    <div className="space-y-8">
      {results.sheets.length > 0 ? (
        <div>
          <h2 className="label mb-2">Sheets</h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {results.sheets.map((s) => (
              <li key={s.id}>
                <ExploreCard sheet={s} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {results.people.length > 0 ? (
        <div>
          <h2 className="label mb-2">People</h2>
          <ul className="space-y-2">
            {results.people.map((p) => (
              <li key={p.id}>
                <Link href={`/u/${p.id}`} className="text-[12px] text-warm hover:underline">
                  {p.displayName ?? "Someone"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

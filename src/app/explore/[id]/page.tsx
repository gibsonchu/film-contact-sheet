"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ExploreDetail } from "@/components/community/ExploreDetail";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isSupabaseConfigured } from "@/lib/storage/adapter";

export default function ExploreDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!isSupabaseConfigured()) {
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
        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-3 py-10">
          <p className="label max-w-sm leading-relaxed">
            Explore needs cloud storage, which isn’t set up on this deployment yet.
          </p>
        </main>
      </div>
    );
  }

  return <ExploreDetail id={id} />;
}

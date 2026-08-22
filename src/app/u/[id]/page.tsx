"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/community/Avatar";
import { ExploreCard } from "@/components/community/ExploreCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Segmented } from "@/components/ui/primitives";
import { getProfile, listPublishedSheets, listSavedSheets, type PublicProfile } from "@/lib/profile";
import type { PublicSheetCard } from "@/lib/explore";
import { isSupabaseConfigured } from "@/lib/storage/adapter";
import { useAuth } from "@/lib/store/auth";

type Tab = "published" | "saved";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const user = useAuth((s) => s.user);
  const isOwnProfile = user?.id === id;

  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("published");
  const [published, setPublished] = useState<PublicSheetCard[]>([]);
  const [saved, setSaved] = useState<PublicSheetCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void (async () => {
      const [p, pub] = await Promise.all([getProfile(id), listPublishedSheets(id)]);
      if (cancelled) return;
      setProfile(p);
      setPublished(pub);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, configured]);

  useEffect(() => {
    if (!configured || !isOwnProfile || tab !== "saved") return;
    let cancelled = false;
    void listSavedSheets(id).then((s) => {
      if (!cancelled) setSaved(s);
    });
    return () => {
      cancelled = true;
    };
  }, [id, tab, isOwnProfile, configured]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <Link href="/explore" className="label hover:text-warm">
            Explore
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-3 py-8">
        {!configured ? (
          <p className="label max-w-sm leading-relaxed">
            Profiles need cloud storage, which isn’t set up on this deployment yet.
          </p>
        ) : loading ? (
          <p className="label">Reading the shelf…</p>
        ) : profile === null ? (
          <p className="label">No one here.</p>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <Avatar displayName={profile?.displayName ?? null} avatarUrl={profile?.avatarUrl ?? null} size="lg" />
              <div>
                <p className="text-[15px] text-warm">{profile?.displayName ?? "Someone"}</p>
                <p className="label">
                  {published.length} published sheet{published.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {isOwnProfile ? (
              <div className="mb-4">
                <Segmented
                  label="View"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "published", label: "Published" },
                    { value: "saved", label: "Saved" },
                  ]}
                />
              </div>
            ) : null}

            {(tab === "published" ? published : saved).length === 0 ? (
              <p className="label">
                {tab === "published" ? "Nothing published yet." : "Nothing saved yet."}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
                {(tab === "published" ? published : saved).map((s) => (
                  <li key={s.id}>
                    <ExploreCard sheet={s} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

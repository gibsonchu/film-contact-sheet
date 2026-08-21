import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Community · Film Contact Sheet" };

export default function CommunityPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <Link href="/about" className="label hover:text-warm">
            About
          </Link>
          <Link href="/binder" className="label hover:text-warm">
            Binder
          </Link>
          <Link href="/new">
            <Button variant="primary" size="sm">
              New Sheet
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-3 py-10">
        <h1 className="mb-4 text-[13px] text-warm">Community</h1>
        <div className="space-y-4 text-[13px] leading-relaxed text-bone">
          <p>Coming soon will be a place for people to publish their contact sheets and explore others.</p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

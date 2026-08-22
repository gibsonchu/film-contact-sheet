import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMark } from "@/components/SiteMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "About · Film Contact Sheet" };

export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="hair-b">
        <div className="mx-auto flex h-9 max-w-4xl items-center gap-4 px-3">
          <SiteMark />
          <div className="flex-1" />
          <Link href="/binders" className="label hover:text-warm">
            Binders
          </Link>
          <Link href="/sheets" className="label hover:text-warm">
            Sheets
          </Link>
          <Link href="/explore" className="label hover:text-warm">
            Explore
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
        <h1 className="mb-4 text-[13px] text-warm">About</h1>
        <div className="space-y-4 text-[13px] leading-relaxed text-bone">
          <p>
            In the past, contact sheets were the only way to record how someone approached taking photos. It,
            inadvertently, was an archive of one’s photography, providing an intimate lens into the working
            process, to see how one approached shooting photography.
          </p>
          <p>
            Contact sheets were also used religiously by photo editors and photographers to choose which photos
            they wanted to publish. The gritty wax pastels and sharp markers were drawn on these sheets to mark
            what needed improvements and which ones were selected. Now, with the ubiquity of digital photography,
            it hardly matters how many photos you take. And with the advent of AI, it’s hard to know what is even
            real anymore. We lost so much of what makes the art form of photography so beautiful, the
            intentionality and build up to when an artist chooses to snap a moment in time, lending authenticity
            to the final selected photo.
          </p>
          <p>
            My hope with this site is for one to take a moment to reflect on, not just the missed opportunities,
            but to see their photos as a collection of time, and not just about the perfect shot. I was deeply
            inspired by Magnum’s book, Contact Sheets, and highly recommend checking it out for yourself.
          </p>
          <p>
            I hope you find joy in creating your own film contact sheets and sharing with your friends and
            family, a window into how you approach photography, just as the many photographers of the past once
            did.
          </p>
          <p>
            If you do end of sharing this online, please tag me{" "}
            <a
              href="https://x.com/gibsontchu"
              target="_blank"
              rel="noreferrer"
              className="text-warm underline hover:no-underline"
            >
              @gibsontchu
            </a>{" "}
            so I can check it out. Or if you have any questions, feel free to reach out!
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

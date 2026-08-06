import Link from "next/link";
import { LandingSheet } from "@/components/marketing/LandingSheet";

const FEATURES: { title: string; body: string }[] = [
  {
    title: "Real film chrome",
    body: "Sprocket holes, edge printing, frame numbers that renumber themselves the moment you drag a frame somewhere else.",
  },
  {
    title: "Grease pencil, not vectors",
    body: "Pressure-varying strokes, wobbling circles, hand-drawn X marks. Every mark is an object you can move, recolour or erase.",
  },
  {
    title: "Tape and labels",
    body: "Masking, lab yellow, red artist tape, numbered labels and sticker dots — draggable, rotatable, torn at the ends.",
  },
  {
    title: "Six templates",
    body: "Classic 35mm, darkroom proof, photographer edit, archival, lab index print and a postcard. Switch without losing a thing.",
  },
  {
    title: "Print-quality export",
    body: "300 DPI PNG, JPEG and PDF with bleed and trim marks — rendered from the same vector sheet you see on screen.",
  },
  {
    title: "Made to hand over",
    body: "A clean preview, a share link, frame comments, and a postcard back with a message and an address block.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-bone">
          Film Contact Sheet
        </span>
        <nav className="flex items-center gap-5 text-[13px]">
          <Link href="/demo" className="text-smoke hover:text-warm">
            Demo roll
          </Link>
          <Link href="/projects" className="text-smoke hover:text-warm">
            My sheets
          </Link>
          <Link
            href="/new"
            className="bg-warm px-3 py-1.5 text-[13px] font-medium text-noir hover:bg-white"
          >
            Create a contact sheet
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
          <div>
            <p className="label mb-5">36 exposures · 35mm · proof</p>
            <h1 className="text-[clamp(2.6rem,6vw,4.6rem)] font-medium leading-[0.95] tracking-[-0.03em] text-warm">
              Lay the whole roll
              <br />
              on the light table.
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-bone">
              Upload a shoot, get a contact sheet that looks like it came out of a darkroom —
              then circle the keepers, cross out the misses, tape a note in the margin and
              export something worth printing.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/new"
                className="bg-warm px-5 py-3 text-sm font-medium text-noir transition-colors hover:bg-white"
              >
                Create a contact sheet
              </Link>
              <Link
                href="/demo"
                className="border border-white/20 px-5 py-3 text-sm text-bone transition-colors hover:border-white/50 hover:text-warm"
              >
                Open the demo roll
              </Link>
            </div>
            <p className="mt-4 text-[12px] text-smoke">
              No account needed. Your photographs stay in this browser until you connect storage.
            </p>
          </div>

          <LandingSheet />
        </section>

        <section className="border-y border-white/8 bg-charcoal/40">
          <div className="mx-auto grid max-w-6xl gap-px px-5 py-px sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="border border-white/6 p-6">
                <h2 className="text-[15px] tracking-tight text-warm">{f.title}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-smoke">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="sprocket-rail mb-10 opacity-25" aria-hidden="true" />
          <div className="grid gap-10 md:grid-cols-3">
            {[
              ["01", "Upload the roll", "Drop up to 38 frames. More than that and we split the shoot into extra sheets, the way a lab would."],
              ["02", "Read it, mark it", "Enlarge any frame, favourite it, reject it, draw straight over the film — including the black margins."],
              ["03", "Send it on", "Export at 300 DPI, share a link, or lay it out as a postcard with a message on the back."],
            ].map(([n, title, body]) => (
              <div key={n}>
                <span className="font-mono text-[11px] tracking-[0.3em] text-darkroom">{n}</span>
                <h3 className="mt-3 text-lg tracking-tight text-warm">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-smoke">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12px] text-smoke">
          <span>Film Contact Sheet — a proofing table for photographs.</span>
          <span className="flex gap-4">
            <Link href="/login" className="hover:text-warm">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-warm">
              Create account
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

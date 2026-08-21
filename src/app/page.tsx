import { HandDrawnCTA } from "@/components/landing/HandDrawnCTA";

/**
 * A section-divider page, the way Magnum Contact Sheets breaks between
 * decades: a single field of red with nothing on it but a title and, here,
 * the two things worth doing next — each circled in wax the way a real
 * editor would mark a frame.
 */
export default function HomePage() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col px-6 py-8 sm:px-10 sm:py-10"
      style={{ background: "var(--color-darkroom)" }}
    >
      {/* Fixed colour, not the --color-warm token — see HandDrawnCTA for why. */}
      <h1
        className="text-[10vw] leading-none sm:text-5xl md:text-6xl"
        style={{ color: "#0b0b0b" }}
      >
        Film Contact Sheet
      </h1>

      <div className="mt-10 flex flex-1 flex-wrap content-center items-center justify-center gap-10 sm:mt-16 sm:gap-12">
        <HandDrawnCTA
          href="/new"
          label="Create a Contact Sheet"
          word="New"
          src="/mark-new.png"
          width={400}
          height={266}
        />
        <HandDrawnCTA
          href="/binder"
          label="Binder"
          word="Binder"
          src="/mark-past.png"
          width={297}
          height={275}
        />
      </div>
    </main>
  );
}

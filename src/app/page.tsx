import { HandDrawnCTA } from "@/components/landing/HandDrawnCTA";
import { PlaceholderCTA } from "@/components/landing/PlaceholderCTA";

/**
 * A section-divider page, the way Magnum Contact Sheets breaks between
 * decades: a single field of red with nothing on it but a title and, here,
 * the four things worth doing next — each circled in wax the way a real
 * editor would mark a frame. New/Binders share a column, Sheets/Explore
 * share the other, primary action on top and its secondary companion below.
 */
export default function HomePage() {
  return (
    <main
      id="main"
      className="relative flex min-h-dvh flex-col px-6 py-8 sm:px-10 sm:py-10"
      style={{ background: "var(--color-darkroom)" }}
    >
      {/* Fixed colour, not the --color-warm token — see HandDrawnCTA for why. */}
      <h1
        className="text-[10vw] leading-none sm:text-5xl md:text-6xl"
        style={{ color: "#0b0b0b" }}
      >
        Film Contact Sheet
      </h1>

      {/* A real grid, not two independent columns: New and Sheets aren't the
          same aspect ratio, so stacking each column with its own flex flow
          would leave Binders and Explore misaligned with each other. Below
          `sm`, the two primary marks alone are too wide to sit side by side
          (each at least 240px), so there's no explicit grid-cols here — one
          implicit column stacks all four in reading order until `sm` opens
          up the two-column, two-row arrangement. */}
      <div className="mt-10 grid flex-1 items-center justify-items-center gap-8 sm:mt-16 sm:grid-cols-2 sm:grid-rows-2 sm:gap-x-12 sm:gap-y-8">
        <HandDrawnCTA
          href="/new"
          label="Create a Contact Sheet"
          word="New"
          src="/mark-new.png"
          width={400}
          height={266}
        />
        <HandDrawnCTA
          href="/sheets"
          label="Sheets"
          word="Sheets"
          src="/mark-past.png"
          width={297}
          height={275}
        />
        <PlaceholderCTA href="/binders" label="Binders" word="Binders" />
        <HandDrawnCTA
          href="/explore"
          label="Explore"
          word="Explore"
          src="/mark-community.png"
          width={485}
          height={350}
          size="sm"
          // The drawn grid's crossing lines aren't centred on the canvas —
          // this is the middle of the open cell they actually form.
          wordCenter={{ x: "51%", y: "42%" }}
        />
      </div>
    </main>
  );
}

/**
 * Wax on paper. Three things make a crayon read as one: the edge crumbles
 * instead of cutting clean, the stick only touches the high points of
 * whatever it's drawn on so the ground shows through in flecks, and being
 * dragged smears those flecks into streaks along the direction of travel.
 *
 * The first turbulence ruffles the outline. The second is stretched along x,
 * hardened into coarse speckle, and punched out of the deposit — coarse
 * enough to see, not so coarse it eats the stroke.
 *
 * Built from noise rather than an image, so it needs nothing loaded and
 * works at any scale. Shared by the pastel drawing instrument and anywhere
 * else in the product that wants the same hand, e.g. the hand-drawn marks on
 * the landing page.
 */
export function CrayonFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-14%" y="-14%" width="128%" height="128%" primitiveUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="3" seed="7" result="edge" />
      <feDisplacementMap
        in="SourceGraphic"
        in2="edge"
        scale="3.4"
        xChannelSelector="R"
        yChannelSelector="G"
        result="ragged"
      />
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.14 0.44"
        numOctaves="3"
        seed="19"
        result="tooth"
      />
      <feColorMatrix in="tooth" type="luminanceToAlpha" result="toothLum" />
      <feComponentTransfer in="toothLum" result="toothMask">
        <feFuncA type="discrete" tableValues="1 1 0 0 0 0 0" />
      </feComponentTransfer>
      <feComposite in="ragged" in2="toothMask" operator="out" />
    </filter>
  );
}

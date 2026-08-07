/**
 * One face throughout: Helvetica.
 *
 * The sheet declares its font on each SVG element rather than inheriting it
 * from CSS, because the exporter serialises the sheet into a standalone SVG
 * document where only the font stack written on the element survives. Keeping
 * the stack here — matching `--font-sans` in globals.css — is what makes the
 * exported PNG and PDF set in the same type as the screen.
 */
export const SHEET_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Homepage copy is painted onto the art, so it has to scale with the art.
 *
 * The art always spans the viewport width, so a size authored at ART_REF_W
 * becomes a share of the art width: text keeps the same size, line breaks, and position
 * relative to the painting at every desktop/tablet width.
 *
 * Below PHONE_MAX that would get too small to read, so blocks switch to a
 * phone layout (readable fixed sizes, re-placed where the art is clear).
 */
export const ART_REF_W = 1440
export const PHONE_MAX = 519

/**
 * Measured art width, set on the homepage root. Falls back to 100vw before
 * hydration; the real value excludes the scrollbar, which vw does not.
 */
export const ART_WIDTH_VAR = "--art-w"

/** Pixels at the 1440px reference → the same share of the art width. */
export const artPx = px =>
  `calc(var(${ART_WIDTH_VAR}, 100vw) * ${+(px / ART_REF_W).toFixed(6)})`

/** Smallest art-locked text (px); only the smallest copy (hints) ever hits it. */
const ART_FONT_MIN_PX = 11

/** Art-locked font size (px at the 1440px reference), floored for readability. */
export const artFont = px =>
  `font-size: max(${ART_FONT_MIN_PX}px, ${artPx(px)});`

export const phone = `@media (max-width: ${PHONE_MAX}px)`

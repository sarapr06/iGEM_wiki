import styled, { css, keyframes } from "styled-components"

/** Nine-frame PETABITE logo loop (same slot + idle float as the old static logo). */
const LOGO_FRAME_COUNT = 9
/** Base hold for frames 1–7. */
const LOGO_FRAME_MS = 170
/** Longer hold for frame 8. */
const LOGO_PENULTIMATE_FRAME_MS = 650
/** Longest hold for the completed PETABITE title (frame 9). */
const LOGO_LAST_FRAME_MS = 1300
export const LOGO_FRAMES = Array.from(
  { length: LOGO_FRAME_COUNT },
  (_, i) =>
    `https://static.igem.wiki/teams/6187/wiki/homepage-components/logo-animation-files/untitled-artwork-${i + 1}.avif`,
)

/** Per-frame visibility windows so the last two frames linger, last longest. */
export const LOGO_FRAME_TIMING = (() => {
  const durations = Array.from({ length: LOGO_FRAME_COUNT }, (_, i) => {
    if (i === LOGO_FRAME_COUNT - 1) return LOGO_LAST_FRAME_MS
    if (i === LOGO_FRAME_COUNT - 2) return LOGO_PENULTIMATE_FRAME_MS
    return LOGO_FRAME_MS
  })
  const cycleMs = durations.reduce((sum, ms) => sum + ms, 0)
  let acc = 0
  const windows = durations.map(ms => {
    const start = acc / cycleMs
    acc += ms
    return { start, end: acc / cycleMs }
  })
  return { cycleMs, windows }
})()

export const LOGO_FRAME_KEYFRAMES = LOGO_FRAME_TIMING.windows.map(({ start, end }) => {
  const s = start * 100
  const e = end * 100
  if (start <= 0) {
    return keyframes`
      0%,
      ${e}% {
        opacity: 1;
      }
      ${e + 0.001}%,
      100% {
        opacity: 0;
      }
    `
  }
  return keyframes`
    0%,
    ${Math.max(0, s - 0.001)}% {
      opacity: 0;
    }
    ${s}%,
    ${e}% {
      opacity: 1;
    }
    ${e + 0.001}%,
    100% {
      opacity: 0;
    }
  `
})

/** Pixel size of each frame plate. */
export const LOGO_PLATE = { w: 2360, h: 1640 }
/** Painted area across all frames (plate px), padded. */
export const LOGO_BOX = { x: 180, y: 420, w: 2180, h: 848 }

/** One frame of the loop; frame 0 sizes the stack, the rest sit on top. */
export const LogoFrame = styled.img`
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  user-select: none;
  pointer-events: none;
  opacity: 0;
  animation-name: ${({ $index }) =>
    LOGO_FRAME_KEYFRAMES[$index] || LOGO_FRAME_KEYFRAMES[0]};
  animation-duration: ${LOGO_FRAME_TIMING.cycleMs}ms;
  animation-timing-function: steps(1, end);
  animation-iteration-count: infinite;

  ${({ $index }) =>
    $index > 0 &&
    css`
      position: absolute;
      left: 0;
      top: 0;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: ${({ $index }) => ($index === 0 ? 1 : 0)};
  }
`

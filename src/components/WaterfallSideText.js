import React, { useLayoutEffect, useRef } from "react"
import styled, { css, keyframes } from "styled-components"
import { ExplainTerm } from "./ExplainTermPopover.js"
import { artFont, artPx, inputCopyCss, phone } from "./artScale.js"

/** Used for popover accessibility; visible copy lives in the textbox image asset. */
export const PETASE_EXPLANATION =
  "PETase breaks the chemical bonds in PET to free a compound called MHET. A second enzyme, MHETase, then cleaves this into environmentally friendly products (ethylene glycol and terephthalic acid)."

/** Used for popover accessibility; visible copy lives in the textbox image asset. */
const CANCER_TEXTBOX_IMG =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/text-boxes/text-box-3-1.avif"

const CANCER_EXPLANATION =
  "Microplastics can damage cells and trigger cancer-associated mechanisms."

const EXCLAMATION_SRC =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/exclamation.avif"

/** Horizontal offset from the left edge of the mockup composition (%). */
export const WATERFALL_TEXT_LEFT_PCT = 5

/** Vertical offset from the top of the waterfall band (%). */
export const WATERFALL_TEXT_TOP_PCT = 52

/** Vertical offset for right-side copy (hint + bang sit above the sentence). */
export const WATERFALL_TEXT_RIGHT_TOP_PCT = 61

/**
 * Preferred width as % of mockup composition (left column).
 * Right column uses left→right edge fill instead of a fixed %.
 */
export const WATERFALL_TEXT_WIDTH_PCT = 30

/**
 * Type scales with viewport width. Floors are low so mid/narrow windows shrink;
 * maxes keep the current desktop look.
 */
export const WATERFALL_BODY_PX = 29.52
const WATERFALL_BANG_WIDTH = artPx(68)

/** Viewport px from top where faded copy reaches full opacity. */
export const WATERFALL_TEXT_FADE_FULL_AT_PX = 150

/** Viewport px from top where fade begins (0 = screen top; raise to sit below nav). */
export const WATERFALL_TEXT_FADE_START_AT_PX = 0

/** Mask alpha at the top of the fade band (0–1). */
export const WATERFALL_TEXT_FADE_MIN_ALPHA = 0.28

function clearViewportTopFade(el) {
  el.style.maskImage = ""
  el.style.webkitMaskImage = ""
}

/** Opacity at a viewport Y inside the fade band (used for mask gradient stops). */
function viewportFadeAlpha(viewportY, fadeStartVp, fadeEndVp, minA) {
  if (viewportY >= fadeEndVp) return 1
  if (viewportY <= fadeStartVp) return minA
  const t = (viewportY - fadeStartVp) / (fadeEndVp - fadeStartVp)
  return minA + (1 - minA) * t
}

function applyViewportTopFade(el) {
  const rect = el.getBoundingClientRect()
  const fadeStartVp = WATERFALL_TEXT_FADE_START_AT_PX
  const fadeEndVp = WATERFALL_TEXT_FADE_FULL_AT_PX
  const minA = WATERFALL_TEXT_FADE_MIN_ALPHA

  if (rect.bottom <= 0 || rect.top >= fadeEndVp) {
    clearViewportTopFade(el)
    return
  }

  const topAlpha = viewportFadeAlpha(rect.top, fadeStartVp, fadeEndVp, minA)
  const localFadeEnd = fadeEndVp - rect.top

  if (topAlpha >= 0.995 || localFadeEnd <= 0) {
    clearViewportTopFade(el)
    return
  }

  const mask = `linear-gradient(to bottom, rgba(0,0,0,${topAlpha}) 0px, rgba(0,0,0,1) ${localFadeEnd}px)`
  el.style.maskImage = mask
  el.style.webkitMaskImage = mask
}

function useViewportTopFade(mountRef) {
  useLayoutEffect(() => {
    const el = mountRef.current
    if (!el || typeof window === "undefined") return undefined

    const motionMq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null
    if (motionMq?.matches) return undefined

    let raf = 0
    const update = () => {
      raf = 0
      applyViewportTopFade(el)
    }
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", schedule, { passive: true, capture: true })
    window.addEventListener("resize", schedule, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("scroll", schedule, { capture: true })
      window.removeEventListener("resize", schedule)
      clearViewportTopFade(el)
    }
  }, [mountRef])
}

/**
 * Waterfall-band copy on the home scroll mockup (left + right of the fall).
 * Positioning is percentage-based so it tracks the waterfall ArtBand on resize.
 */
export function WaterfallSideText() {
  const leftRef = useRef(null)
  const rightRef = useRef(null)
  useViewportTopFade(leftRef)
  useViewportTopFade(rightRef)

  return (
    <>
      <TextMount ref={leftRef} $side="left">
        <Body>
          The world produces over 400 million tonnes of plastic each year, and as they degrade, it
          breaks down into microplastics that can infiltrate our bodies.
        </Body>
      </TextMount>

      <TextMount ref={rightRef} $side="right">
        <PopupHint>
          <BangHover aria-hidden>
            <BangImg src={EXCLAMATION_SRC} alt="" />
          </BangHover>
          <HintText>
            <span className="hover-copy">
              Hover red underlined words for a popup, click to pin it open /
              close.
            </span>
            <span className="touch-copy">
              Tap red underlined words for a popup, tap again to close.
            </span>
          </HintText>
        </PopupHint>
        <Body $side="right">
          These microplastics damage cells and cause{" "}
          <ExplainTerm
            term="cancer-associated mechanisms"
            explanation={CANCER_EXPLANATION}
            imageSrc={CANCER_TEXTBOX_IMG}
            imageAlt="cancer-associated mechanisms"
          />
          .
        </Body>
      </TextMount>
    </>
  )
}

export default WaterfallSideText

const TextMount = styled.div`
  position: absolute;
  top: ${({ $side }) =>
    $side === "right" ? WATERFALL_TEXT_RIGHT_TOP_PCT : WATERFALL_TEXT_TOP_PCT}%;
  box-sizing: border-box;
  container-type: inline-size;
  pointer-events: auto;
  z-index: 1;
  overflow: visible;
  mask-size: 100% 100%;
  -webkit-mask-size: 100% 100%;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;

  ${({ $side }) =>
    $side === "left"
      ? css`
          left: ${WATERFALL_TEXT_LEFT_PCT}%;
          width: ${WATERFALL_TEXT_WIDTH_PCT}%;
          max-width: 100%;
          padding-right: 2%;
          padding-left: 2%;

          /* Phones: fits the left bank, clear of the falls. */
          ${phone} {
            width: 36%;
          }
        `
      : css`
          /* Compact column on the right bank — not full remaining width. */
          left: auto;
          right: 3%;
          width: ${artPx(416)};

          /* Narrow enough to stay on the bank, clear of the stream. */
          ${phone} {
            top: ${WATERFALL_TEXT_RIGHT_TOP_PCT - 1}%;
            width: 37%;
            right: 1%;
          }
          padding-left: 2%;
          padding-right: 0;
          text-align: center;
        `}
`

const Body = styled.p`
  margin: ${({ $spaced }) => ($spaced ? "0.75em 0 0" : "0")};
  color: rgba(255, 255, 255, 0.92);
  font-family: var(--font-body);
  ${artFont(WATERFALL_BODY_PX)}
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: break-word;
  overflow: visible;

  ${phone} {
    font-size: 0.7rem;
  }
`

const bangHover = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -5px, 0);
  }
`

const bangHoverStrong = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -8px, 0);
  }
`

const PopupHint = styled.span`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: ${artPx(7.2)};
  margin: 0 auto ${artPx(8.8)};
  width: 100%;
  max-width: 100%;
`

const BangHover = styled.span`
  flex: 0 0 auto;
  display: block;
  animation: ${bangHover} 2.4s ease-in-out infinite;

  ${PopupHint}:hover & {
    animation-name: ${bangHoverStrong};
    animation-duration: 1.6s;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const BangImg = styled.img`
  display: block;
  width: ${WATERFALL_BANG_WIDTH};
  height: auto;
  user-select: none;
  pointer-events: none;
`

const HintText = styled.span`
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  color: #e63946;
  font-family: var(--font-body);
  ${artFont(18)}
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: break-word;

  ${phone} {
    font-size: 0.6rem;
  }

  ${inputCopyCss}
`

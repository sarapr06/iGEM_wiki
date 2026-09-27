import React, { useEffect, useRef, useState } from "react"
import styled from "styled-components"
import {
  LOGO_BOX,
  LOGO_FRAMES,
  LOGO_FRAME_TIMING,
  LOGO_PLATE,
  LogoFrame,
} from "./logoFrames.js"

/** Give up waiting on slow images after this long. */
const LOADER_TIMEOUT_MS = 7000
/** Fill (clip) transition; the exit waits for it to reach the top. */
const FILL_MS = 380
const FADE_MS = 480
const BOUNCE_MS = 320
const SPRING_MS = 760
/** Overshoots a little, then settles — the "spring" into the hero slot. */
const SPRING_EASING = "cubic-bezier(0.34, 1.32, 0.52, 1)"

/** Set once any loader has finished, so tab-to-tab navigation skips it. */
let siteLoadedOnce = false

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** Current point in the logo loop (ms), read off the first frame's animation. */
function loopPhase(root) {
  const anim = root?.querySelector("img")?.getAnimations?.()[0]
  const t = anim?.currentTime
  return typeof t === "number" ? t % LOGO_FRAME_TIMING.cycleMs : 0
}

function LogoFrames() {
  return (
    <FramesWindow>
      {LOGO_FRAMES.map((src, i) => (
        <LogoFrame key={src} src={src} alt="" $index={i} />
      ))}
    </FramesWindow>
  )
}

/**
 * Full-screen loader: the PETABITE logo loop, filled in from the bottom as the
 * page's images load, then faded out.
 *
 * `handoff` (homepage): a function returning `{ getRect, onLand }` for the
 * hero logo. Instead of fading, the loader logo freezes, bounces, and springs
 * into `getRect()` (the hero's painted logo box, viewport px); `onLand(phaseMs)`
 * then lets the hero take over from the frozen frame.
 * `always`: show even after the first page load (client-side navigation).
 */
export function SiteLoader({ handoff, always = false }) {
  const [state, setState] = useState(() =>
    always || !siteLoadedOnce ? "loading" : "done"
  )
  const [progress, setProgress] = useState(0)
  const overlayRef = useRef(null)
  const backdropRef = useRef(null)
  const logoRef = useRef(null)
  const handoffRef = useRef(handoff)
  handoffRef.current = handoff
  const mountedRef = useRef(true)
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    []
  )

  // Progress = share of the page's images that have loaded.
  useEffect(() => {
    if (state !== "loading") return undefined
    const imgs = [...document.images]
    const total = Math.max(1, imgs.length)
    let loaded = imgs.filter(img => img.complete).length
    setProgress(loaded / total)
    const mark = () => {
      loaded += 1
      setProgress(Math.min(1, loaded / total))
    }
    const pending = imgs.filter(img => !img.complete)
    pending.forEach(img => {
      img.addEventListener("load", mark, { once: true })
      img.addEventListener("error", mark, { once: true })
    })
    const timer = window.setTimeout(() => setProgress(1), LOADER_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
      pending.forEach(img => {
        img.removeEventListener("load", mark)
        img.removeEventListener("error", mark)
      })
    }
  }, [state])

  // Once full (and the fill has visibly reached the top), leave.
  useEffect(() => {
    if (state !== "loading" || progress < 1) return undefined
    // Only the pending timer is cancellable; once the exit starts it runs to
    // the end (setting "leaving" below re-runs this effect's cleanup).
    const timer = window.setTimeout(async () => {
      setState("leaving")
      siteLoadedOnce = true
      const overlay = overlayRef.current
      const backdrop = backdropRef.current
      const logo = logoRef.current
      const target = handoffRef.current?.()
      const reduce = prefersReducedMotion()

      const fadeOut = async () => {
        await overlay?.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: reduce ? 0 : FADE_MS,
          easing: "ease",
          fill: "forwards",
        }).finished
      }

      if (!target || !logo || !backdrop) {
        await fadeOut()
        target?.onLand(0)
      } else {
        // Freeze on the current frame; the hero picks up from here.
        logo.dataset.frozen = "1"
        const phase = loopPhase(logo)
        const rect = target.getRect()
        const visible = rect && rect.bottom > 0 && rect.top < window.innerHeight
        if (reduce || !visible) {
          await fadeOut()
          target.onLand(phase)
        } else {
          await logo.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(0.9)", offset: 0.45 },
              { transform: "scale(1.04)", offset: 0.8 },
              { transform: "scale(1)" },
            ],
            { duration: BOUNCE_MS, easing: "ease-in-out" }
          ).finished
          const from = logo.getBoundingClientRect()
          const to = target.getRect()
          const k = to.width / Math.max(1, from.width)
          logo.style.transformOrigin = "0 0"
          backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: SPRING_MS * 0.7,
            easing: "ease-out",
            fill: "forwards",
          })
          await logo.animate(
            [
              { transform: "translate(0, 0) scale(1)" },
              {
                transform: `translate(${to.left - from.left}px, ${
                  to.top - from.top
                }px) scale(${k})`,
              },
            ],
            { duration: SPRING_MS, easing: SPRING_EASING, fill: "forwards" }
          ).finished
          target.onLand(phase)
        }
      }
      if (mountedRef.current) setState("done")
    }, FILL_MS)
    return () => window.clearTimeout(timer)
  }, [state, progress])

  if (state === "done") return null

  return (
    <Overlay
      ref={overlayRef}
      aria-hidden={state !== "loading"}
      role="progressbar"
      aria-label="Loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      $leaving={state === "leaving"}
    >
      <Backdrop ref={backdropRef} />
      <Logo ref={logoRef}>
        <Faint>
          <LogoFrames />
        </Faint>
        <Fill style={{ clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` }}>
          <LogoFrames />
        </Fill>
      </Logo>
    </Overlay>
  )
}

export default SiteLoader

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: ${({ $leaving }) => ($leaving ? "none" : "auto")};
`

/** Same off-white as the navbar; fades separately so the logo can fly out. */
const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  background: var(--color-bg);
`

const Logo = styled.div`
  position: relative;
  width: min(72vw, 40rem);
  aspect-ratio: ${LOGO_BOX.w} / ${LOGO_BOX.h};

  &[data-frozen="1"] img {
    animation-play-state: paused;
  }
`

const Faint = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0.16;
  filter: grayscale(1);
`

const Fill = styled.div`
  position: absolute;
  inset: 0;
  transition: clip-path ${FILL_MS}ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

/** Full frame plates offset so only LOGO_BOX shows. */
const FramesWindow = styled.div`
  position: absolute;
  left: ${(-LOGO_BOX.x / LOGO_BOX.w) * 100}%;
  top: ${(-LOGO_BOX.y / LOGO_BOX.h) * 100}%;
  width: ${(LOGO_PLATE.w / LOGO_BOX.w) * 100}%;
`

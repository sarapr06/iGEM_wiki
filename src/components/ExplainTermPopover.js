import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import styled, { keyframes } from "styled-components"

/** Combined textbox + copy (PETase / MHETase explanation) from team iGEM static assets. */
const MHETASE_TEXTBOX_IMG =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/mhetase-textbox.avif"

/**
 * Popover width scales with the window (like the art): POPOVER_WIDTH_SHARE of
 * it, between the min and max. POPOVER_WIDTH_PX is the pre-layout fallback.
 */
const POPOVER_WIDTH_SHARE = 0.45
const POPOVER_MAX_WIDTH_PX = 760
export const POPOVER_WIDTH_PX = 560

/** Smallest the popover gets (phones, or squeezed above a term near the top). */
const POPOVER_MIN_WIDTH_PX = 240

/** Below site chrome (`WikiTopBar` / home nav mount at 110); above mockup overlays (≤95). */
export const POPOVER_Z_INDEX = 100

export const POPOVER_GAP_PX = 12

/** Lightning-bolt tip: fraction in from the popover’s left edge (measured: ~0.40 in all three text-box images). */
const BOLT_TIP_X_FRAC = 0.4

/**
 * Popover art layout (all three text boxes): the black box spans ~40%–80% of
 * the height; the character pokes out above it and the bolt tail hangs below.
 * Below the term the art is cropped from 41% down (keeps the tilted first
 * line of text whole); BELOW_EXTRA_GAP_PX keeps what's left of the
 * character's feet off the term.
 */
const BOX_TOP_FRAC = 0.41
const BELOW_EXTRA_GAP_PX = 14
const BOX_BOTTOM_FRAC = 0.8
/** How far the painted bolt may miss the term (share of width) before a drawn pointer replaces it. */
const BOLT_SLACK_FRAC = 0.06
/** Drawn pointer size (px). */
const POINTER_H_PX = 18

/** Keep the popover inside the viewport with this padding (px). */
const POPOVER_EDGE_PAD_PX = 16

/** Approximate height ÷ width before the popover image loads (updated after onLoad). */
const SHELL_ASPECT = 0.62

const POPOVER_POP_MS = 420

const popoverPopIn = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.2) rotate(-8deg);
  }
  45% {
    opacity: 1;
    transform: scale(1.14) rotate(4deg);
  }
  70% {
    transform: scale(0.94) rotate(-3deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(-2deg);
  }
`

/** The term's box, plus its first/last line (a wrapped term spans two lines). */
function measureButton(el) {
  const r = el.getBoundingClientRect()
  const lines = el.getClientRects()
  const first = lines[0] || r
  const last = lines[lines.length - 1] || r
  return {
    top: r.top,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
    firstX: first.left + first.width / 2,
    lastX: last.left + last.width / 2,
  }
}

/** Popover width for the current window: a share of it, clamped, and never wider than fits. */
function computePopoverWidth() {
  if (typeof window === "undefined") return POPOVER_WIDTH_PX
  const available = window.innerWidth - POPOVER_EDGE_PAD_PX * 2
  const scaled = Math.min(
    POPOVER_MAX_WIDTH_PX,
    Math.max(POPOVER_MIN_WIDTH_PX, window.innerWidth * POPOVER_WIDTH_SHARE)
  )
  return Math.min(scaled, available)
}

/** Lowest y the popover may reach up to: below any fixed/sticky top bar. */
function topLimit() {
  if (typeof document === "undefined") return POPOVER_EDGE_PAD_PX
  const bar = document.querySelector("header")
  const barBottom = bar ? bar.getBoundingClientRect().bottom : 0
  return Math.max(POPOVER_EDGE_PAD_PX, barBottom + POPOVER_EDGE_PAD_PX / 2)
}

/**
 * Above the term, pointing down at it; if there isn't room above, shrink the
 * popover (down to POPOVER_MIN_WIDTH_PX) so it still fits above, and only if
 * even that won't fit, put it below. The painted bolt is kept when it lands on
 * the term; otherwise (popover nudged to stay on screen, or placed below) the
 * art is cropped to its box and a drawn pointer aims at the term instead.
 *
 * Returns { left, top, width, place: "above" | "below", pointer: null | x-share }.
 */
function layoutFromButton(btn, aspect, maxW) {
  const gap = POPOVER_GAP_PX
  const roomAbove = btn.top - gap - topLimit()
  let popW = Math.min(maxW, roomAbove / aspect)
  const place = popW >= POPOVER_MIN_WIDTH_PX ? "above" : "below"
  if (place === "below") popW = maxW
  const popH = popW * aspect
  const targetX = place === "above" ? btn.firstX : btn.lastX

  let left = targetX - popW * BOLT_TIP_X_FRAC
  if (typeof window !== "undefined") {
    const maxLeft = Math.max(POPOVER_EDGE_PAD_PX, window.innerWidth - popW - POPOVER_EDGE_PAD_PX)
    left = Math.min(Math.max(left, POPOVER_EDGE_PAD_PX), maxLeft)
  }
  const tip = (targetX - left) / popW
  const boltLands = Math.abs(tip - BOLT_TIP_X_FRAC) <= BOLT_SLACK_FRAC
  const pointer =
    place === "above" && boltLands ? null : Math.min(0.94, Math.max(0.06, tip))

  let top
  if (place === "below") {
    top = btn.bottom + POINTER_H_PX + BELOW_EXTRA_GAP_PX - popH * BOX_TOP_FRAC
  } else if (pointer == null) {
    top = btn.top - gap - popH
  } else {
    top = btn.top - POINTER_H_PX - 4 - popH * BOX_BOTTOM_FRAC
  }

  return { left, top, width: popW, place, pointer }
}

/**
 * Glossary term + fixed-size popover portaled to document.body so it is never
 * clipped by the mockup overlays. Position tracks the underlined word on scroll.
 */
export function ExplainTerm({
  term,
  explanation,
  imageSrc = MHETASE_TEXTBOX_IMG,
  imageAlt,
  className,
}) {
  const popoverId = useId()
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState(null)
  const coarsePointerRef = useRef(false)
  const pinnedRef = useRef(false)

  useEffect(() => {
    pinnedRef.current = pinned
  }, [pinned])

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const m = measureButton(btn)
    if (m.width <= 0 && m.height <= 0) return

    const popEl = popoverRef.current
    const aspect =
      popEl?.offsetHeight > 0 && popEl.offsetWidth > 0
        ? popEl.offsetHeight / popEl.offsetWidth
        : SHELL_ASPECT

    setPos(layoutFromButton(m, aspect, computePopoverWidth()))
  }, [])

  const show = useCallback(() => setOpen(true), [])
  const dismiss = useCallback(() => {
    setOpen(false)
    setPinned(false)
    setPos(null)
  }, [])
  const hideUnlessPinned = useCallback(() => {
    if (pinnedRef.current) return
    setOpen(false)
    setPos(null)
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePosition()
    const raf = requestAnimationFrame(updatePosition)
    window.addEventListener("scroll", updatePosition, { passive: true, capture: true })
    window.addEventListener("resize", updatePosition, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", updatePosition, { capture: true })
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, updatePosition])

  const onKeyDown = useCallback(
    (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault()
        dismiss()
        buttonRef.current?.blur()
      } else if (
        (ev.key === "Enter" || ev.key === " ") &&
        ev.target === buttonRef.current
      ) {
        // TermButton is a span (see below), so activate it like a button.
        ev.preventDefault()
        buttonRef.current.click()
      }
    },
    [dismiss]
  )

  /** Click pins the popover open; click again (or Escape) dismisses it. */
  const onTermClick = useCallback((ev) => {
    ev.stopPropagation()
    setPinned((wasPinned) => {
      if (wasPinned) {
        setOpen(false)
        setPos(null)
        return false
      }
      setOpen(true)
      return true
    })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined
    const mq = window.matchMedia("(pointer: coarse)")
    const sync = () => {
      coarsePointerRef.current = mq.matches
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    /* Pinned: click away to close. Touch: same when open (no hover preview). */
    if (!pinned && !coarsePointerRef.current) return undefined

    const onDocPointer = (ev) => {
      if (rootRef.current?.contains(ev.target)) return
      if (buttonRef.current?.contains(ev.target)) return
      dismiss()
    }
    document.addEventListener("pointerdown", onDocPointer)
    return () => document.removeEventListener("pointerdown", onDocPointer)
  }, [open, pinned, dismiss])

  return (
    <>
      <TermRoot
        ref={rootRef}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hideUnlessPinned}
        onFocus={show}
        onBlur={hideUnlessPinned}
        onKeyDown={onKeyDown}
      >
        <TermButton
          ref={buttonRef}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-pressed={pinned}
          aria-describedby={open ? popoverId : undefined}
          onClick={onTermClick}
        >
          {term}
        </TermButton>
      </TermRoot>
      {typeof document !== "undefined" &&
        open &&
        createPortal(
          <PopoverOuter
            ref={popoverRef}
            id={popoverId}
            role="tooltip"
            aria-label={explanation || undefined}
            style={
              pos
                ? {
                    left: pos.left,
                    top: pos.top,
                    width: pos.width,
                    bottom: "auto",
                    right: "auto",
                    visibility: "visible",
                  }
                : {
                    left: -9999,
                    top: -9999,
                    width: POPOVER_WIDTH_PX,
                    bottom: "auto",
                    right: "auto",
                    visibility: "hidden",
                  }
            }
          >
            <PopoverInner
              $below={pos?.place === "below"}
              style={{
                transformOrigin:
                  pos?.pointer == null
                    ? `${BOLT_TIP_X_FRAC * 100}% 100%`
                    : `${pos.pointer * 100}% ${
                        (pos.place === "below" ? BOX_TOP_FRAC : BOX_BOTTOM_FRAC) * 100
                      }%`,
              }}
            >
              {pos?.pointer != null && (
                <Pointer
                  aria-hidden="true"
                  $below={pos.place === "below"}
                  style={{ left: `${pos.pointer * 100}%` }}
                />
              )}
              <ShellWrap
                $crop={pos?.pointer != null}
                $below={pos?.place === "below"}
              >
                <ShellImg
                  src={imageSrc}
                  alt={imageAlt || explanation || term}
                  onLoad={updatePosition}
                />
              </ShellWrap>
            </PopoverInner>
          </PopoverOuter>,
          document.body
        )}
    </>
  )
}

const TermRoot = styled.span`
  display: inline;
  vertical-align: baseline;
`

/**
 * A span, not a <button>: buttons lay out as inline-blocks, so a term that
 * wraps turned into one wide box (full-width highlight, trailing punctuation
 * pushed to its own line). An inline span highlights line by line.
 */
const TermButton = styled.span`
  display: inline;
  margin: 0;
  padding: 0 0.12em;
  border: none;
  background: linear-gradient(
    to bottom,
    transparent 58%,
    #e63946 58%,
    #e63946 88%,
    transparent 88%
  );
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
  border-radius: 2px;

  &:focus-visible {
    outline: 2px solid var(--color-accent, #c92f3b);
    outline-offset: 3px;
  }
`

const PopoverOuter = styled.div`
  position: fixed;
  z-index: ${POPOVER_Z_INDEX};
  pointer-events: none;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.4));
`

/** transform-origin is set inline: the popover pops from whatever points at the term. */
const PopoverInner = styled.div`
  position: relative;
  width: 100%;
  animation: ${popoverPopIn} ${POPOVER_POP_MS}ms cubic-bezier(0.34, 1.45, 0.64, 1) forwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
    transform: rotate(-2deg);
  }
`

/**
 * With a drawn pointer, crop the art to its box: drop the bolt (it would point
 * elsewhere), and below the term also the character, so nothing covers the term.
 */
const ShellWrap = styled.div`
  position: relative;
  width: 100%;
  clip-path: ${({ $crop, $below }) =>
    !$crop
      ? "none"
      : `inset(${$below ? BOX_TOP_FRAC * 100 : 0}% 0 ${(1 - BOX_BOTTOM_FRAC) * 100}% 0)`};
`

/** Stands in for the painted bolt; `left` is set inline to aim at the term. */
const Pointer = styled.span`
  position: absolute;
  z-index: 1;
  top: ${({ $below }) => ($below ? BOX_TOP_FRAC : BOX_BOTTOM_FRAC) * 100}%;
  width: 0;
  height: 0;
  border-left: 11px solid transparent;
  border-right: 11px solid transparent;
  ${({ $below }) =>
    $below
      ? `border-bottom: ${POINTER_H_PX}px solid #000; transform: translate(-50%, -100%);`
      : `border-top: ${POINTER_H_PX}px solid #000; transform: translate(-50%, -2px);`}
`

const ShellImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
`

export default ExplainTerm

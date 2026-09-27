import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import styled, { keyframes } from "styled-components"

/** Combined textbox + copy (PETase / MHETase explanation) from team iGEM static assets. */
const MHETASE_TEXTBOX_IMG =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/mhetase-textbox.avif"

/** Fixed popover size (px) — the ceiling on desktop; shrinks to fit narrow viewports. */
export const POPOVER_WIDTH_PX = 560

/** Minimum popover width for smaller screen sizes. */
const POPOVER_MIN_WIDTH_PX = 220

/** Below site chrome (`WikiTopBar` / home nav mount at 110); above mockup overlays (≤95). */
export const POPOVER_Z_INDEX = 100

export const POPOVER_GAP_PX = 12

/** Lightning-bolt tip: fraction in from the popover’s left edge. */
const BOLT_TIP_X_FRAC = 0.22

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

function measureButton(el) {
  const r = el.getBoundingClientRect()
  return {
    centerX: r.left + r.width / 2,
    top: r.top,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  }
}

/** Popover width that actually fits the current viewport (desktop keeps the full 560px). */
function computePopoverWidth() {
  if (typeof window === "undefined") return POPOVER_WIDTH_PX
  const available = window.innerWidth - POPOVER_EDGE_PAD_PX * 2
  return Math.max(POPOVER_MIN_WIDTH_PX, Math.min(POPOVER_WIDTH_PX, available))
}

function layoutFromButton(btn, popHeight, popW) {
  const popH = popHeight
  const gap = POPOVER_GAP_PX
  const boltX = popW * BOLT_TIP_X_FRAC

  let left = btn.centerX - boltX
  let top = btn.top - gap - popH

  if (typeof window !== "undefined") {
    const maxLeft = Math.max(POPOVER_EDGE_PAD_PX, window.innerWidth - popW - POPOVER_EDGE_PAD_PX)
    left = Math.min(Math.max(left, POPOVER_EDGE_PAD_PX), maxLeft)

    // If there isn't room above the term (short viewport / term near the top),
    // flip the popover to sit below it instead of letting it run off-screen.
    if (top < POPOVER_EDGE_PAD_PX) {
      const belowTop = btn.bottom + gap
      if (belowTop + popH <= window.innerHeight - POPOVER_EDGE_PAD_PX) {
        top = belowTop
      } else {
        top = Math.max(POPOVER_EDGE_PAD_PX, top)
      }
    }
  }

  return { left, top, width: popW }
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

    const popW = computePopoverWidth()
    const popEl = popoverRef.current
    const popH =
      popEl?.offsetHeight > 0
        ? popEl.offsetHeight
        : Math.round(popW * SHELL_ASPECT)

    setPos(layoutFromButton(m, popH, popW))
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
            <PopoverInner>
              <ShellWrap>
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

const PopoverInner = styled.div`
  width: 100%;
  transform-origin: 50% 100%;
  animation: ${popoverPopIn} ${POPOVER_POP_MS}ms cubic-bezier(0.34, 1.45, 0.64, 1) forwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
    transform: rotate(-2deg);
  }
`

const ShellWrap = styled.div`
  position: relative;
  width: 100%;
`

const ShellImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
`

export default ExplainTerm

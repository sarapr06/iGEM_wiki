import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"
import {
  DESIGN_SKETCHBOOK_PAGES,
  DESIGN_SKETCHBOOK_SECTIONS,
  PAGE_FLIP_ATTRIBUTION,
  getSectionStartIndex,
  getTocSections,
} from "../../data/designSketchbookPages.js"

// import "page-flip/src/Style/stPageFlip.css"

const COVER_BOARD = "#4a3426"
const PAPER = "#f5f0e6"
/** How far the static hardcover peeks past the paper on each outer edge. */
const COVER_OVERHANG_PX = 14

const FLIP_SETTINGS = {
  // Tall page aspect: stretch sizes by width first, then height = width / (w/h).
  // Midway between the earlier short pages and the too-tall pass.
  width: 490,
  height: 950,
  size: "stretch",
  minWidth: 300,
  maxWidth: 800,
  minHeight: 580,
  maxHeight: 1500,
  showCover: true,
  drawShadow: true,
  flippingTime: 700,
  usePortrait: true,
  mobileScrollSupport: true,
  autoSize: true,
}

const FLIP_WAIT_MS = FLIP_SETTINGS.flippingTime + 80

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function SketchPageContent({ page }) {
  if (page.variant === "cover" || page.variant === "back") {
    return (
      <SketchPageInner $variant={page.variant}>
        <CoverPlate>
          {page.variant === "cover" && <SketchCoverMark aria-hidden>✎</SketchCoverMark>}
          <SketchTitle>{page.title}</SketchTitle>
          {page.subtitle && <SketchSubtitle>{page.subtitle}</SketchSubtitle>}
          {page.body && <SketchBody>{page.body}</SketchBody>}
        </CoverPlate>
      </SketchPageInner>
    )
  }

  if (page.variant === "toc") {
    const sections = getTocSections(page.tocHalf)
    return (
      <SketchPageInner $variant="toc">
        <SketchTitle>{page.title}</SketchTitle>
        {page.subtitle && <SketchSubtitle>{page.subtitle}</SketchSubtitle>}
        <TocList>
          {sections.map((section) => (
            <TocItem key={section.id}>
              <TocButton
                type="button"
                $color={section.color}
                data-toc-section={section.id}
              >
                <TocSwatch $color={section.color} aria-hidden />
                <TocText>
                  <TocLabel>{section.label}</TocLabel>
                  <TocProgress>{section.progress}</TocProgress>
                </TocText>
              </TocButton>
            </TocItem>
          ))}
        </TocList>
      </SketchPageInner>
    )
  }

  if (page.variant === "notes") {
    return (
      <SketchPageInner $variant="notes">
        <SketchTitle>{page.title}</SketchTitle>
        {page.body && <SketchBody>{page.body}</SketchBody>}
        <SketchPlaceholder aria-hidden={false}>
          <SketchPlaceholderLabel>Notes / image slot</SketchPlaceholderLabel>
        </SketchPlaceholder>
      </SketchPageInner>
    )
  }

  const showMedia = page.variant === "spread"
  return (
    <SketchPageInner $variant={page.variant}>
      <SketchTitle>{page.title}</SketchTitle>
      {page.subtitle && <SketchSubtitle>{page.subtitle}</SketchSubtitle>}
      {page.body && <SketchBody>{page.body}</SketchBody>}
      {showMedia && page.imageSrc && (
        <SketchFigure>
          <SketchImage src={page.imageSrc} alt={page.imageAlt || ""} />
          {page.caption && <SketchCaption>{page.caption}</SketchCaption>}
        </SketchFigure>
      )}
      {showMedia && !page.imageSrc && (
        <SketchPlaceholder aria-hidden={false}>
          <SketchPlaceholderLabel>
            {page.imagePlaceholder || "Image coming soon"}
          </SketchPlaceholderLabel>
        </SketchPlaceholder>
      )}
    </SketchPageInner>
  )
}

export function DesignSketchbook() {
  const bookHostRef = useRef(null)
  const bookStageRef = useRef(null)
  const pageFlipRef = useRef(null)
  const flipRunIdRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [pageCount, setPageCount] = useState(DESIGN_SKETCHBOOK_PAGES.length)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState(null)
  /** Pixel offsets from BookStage to the visible notebook face. */
  const [tabAnchor, setTabAnchor] = useState({
    top: 48,
    right: 0,
    left: 0,
    bookWidth: 0,
    faceTop: 48,
    faceHeight: 0,
  })

  const navigatingRef = useRef(false)
  const [flipState, setFlipState] = useState("read")
  /** 0 = forward/next, 1 = back/prev — matches StPageFlip FlipDirection. */
  const [flipDirection, setFlipDirection] = useState(null)
  const flipWaitersRef = useRef([])
  const flipStateRef = useRef("read")

  const measureTabAnchor = useCallback(() => {
    const stage = bookStageRef.current
    const host = bookHostRef.current
    if (!stage || !host) return
    // Corner-hover / fold temporarily reveals extra faces. Measuring then
    // stretches the static hardcover across the empty left half of the cover.
    if (flipStateRef.current !== "read") return

    const stageRect = stage.getBoundingClientRect()

    const isVisibleFace = (el) => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      const style = window.getComputedStyle(el)
      return style.display !== "none" && style.visibility !== "hidden"
    }

    let nodes = [...host.querySelectorAll(".stf__item.--simple")].filter(isVisibleFace)

    // Closed cover sits on the right; the back cover sits on the left. Never
    // union leftover hover faces into a two-page hardcover.
    const currentIndex = pageFlipRef.current?.getCurrentPageIndex?.() ?? 0
    const lastIndex = Math.max(0, (pageFlipRef.current?.getPageCount?.() ?? 1) - 1)
    if (currentIndex === 0) {
      const cover =
        nodes.find((el) => el.classList.contains("--right")) ||
        [...host.querySelectorAll(".stf__item.--right")].find(isVisibleFace) ||
        host.querySelector("[data-density='hard']")
      if (cover) nodes = [cover]
    } else if (currentIndex === lastIndex) {
      const back =
        nodes.find((el) => el.classList.contains("--left")) ||
        [...host.querySelectorAll(".stf__item.--left")].find(isVisibleFace)
      if (back) nodes = [back]
    } else if (!nodes.length) {
      nodes = [...host.querySelectorAll(".stf__item")].filter(isVisibleFace)
    }

    let bookLeft = Infinity
    let bookTop = Infinity
    let bookRight = -Infinity
    let bookBottom = -Infinity
    nodes.forEach((el) => {
      const r = el.getBoundingClientRect()
      bookLeft = Math.min(bookLeft, r.left)
      bookTop = Math.min(bookTop, r.top)
      bookRight = Math.max(bookRight, r.right)
      bookBottom = Math.max(bookBottom, r.bottom)
    })

    let useRect
    if (bookLeft < Infinity) {
      useRect = {
        left: bookLeft,
        top: bookTop,
        right: bookRight,
        bottom: bookBottom,
        height: bookBottom - bookTop,
        width: bookRight - bookLeft,
      }
    } else {
      const fallback = host.querySelector(".stf__wrapper") || host
      useRect = fallback.getBoundingClientRect()
    }

    if (useRect.height < 40) {
      useRect = host.getBoundingClientRect()
    }

    // Tabs start below the notebook top so the page edge leads the tab stack.
    const faceTop = Math.max(0, useRect.top - stageRect.top)
    const faceHeight = Math.max(0, useRect.height)
    const top = Math.max(12, faceTop + 28)
    const right = Math.max(0, stageRect.right - useRect.right)
    const left = Math.max(0, useRect.left - stageRect.left)
    const bookWidth = Math.max(0, useRect.width ?? useRect.right - useRect.left)
    setTabAnchor({ top, right, left, bookWidth, faceTop, faceHeight })

    const hardTop = pageFlipRef.current?.getBoundsRect?.()?.top
    if (typeof hardTop === "number") {
      host.style.setProperty("--sketch-hard-top", `${Math.max(0, hardTop)}px`)
    }
  }, [])

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
  }, [])

  useEffect(() => {
    if (!ready) return undefined
    measureTabAnchor()
    const raf = window.requestAnimationFrame(() => {
      measureTabAnchor()
      window.requestAnimationFrame(measureTabAnchor)
    })
    const onResize = () => measureTabAnchor()
    window.addEventListener("resize", onResize)
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measureTabAnchor())
        : null
    if (bookHostRef.current && ro) ro.observe(bookHostRef.current)
    if (bookStageRef.current && ro) ro.observe(bookStageRef.current)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      ro?.disconnect()
    }
  }, [ready, pageIndex, measureTabAnchor])

  const syncIndicesFromFlip = useCallback((flip) => {
    if (!flip) return
    const nextPage = flip.getCurrentPageIndex()
    setPageIndex(nextPage)
    const collection = flip.getPageCollection?.()
    if (collection) {
      setSpreadIndex(collection.getCurrentSpreadIndex())
    }
  }, [])

  const activeSectionId = useMemo(() => {
    if (selectedSectionId) return selectedSectionId
    return DESIGN_SKETCHBOOK_PAGES[pageIndex]?.sectionId || null
  }, [pageIndex, selectedSectionId])

  /** Landscape spread index for a section start page (cover=0, toc=1, sections from 2…). */
  const getSectionSpreadIndex = useCallback((sectionId) => {
    const start = getSectionStartIndex(sectionId)
    if (start < 0) return -1
    // With showCover: spread 0 = [0], then pairs [1,2], [3,4], …
    if (start === 0) return 0
    return Math.floor((start - 1) / 2) + 1
  }, [])

  const { rightSections, leftSections } = useMemo(() => {
    if (pageIndex === 0) {
      return { rightSections: DESIGN_SKETCHBOOK_SECTIONS, leftSections: [] }
    }
    const right = []
    const left = []
    for (const section of DESIGN_SKETCHBOOK_SECTIONS) {
      const sectionSpread = getSectionSpreadIndex(section.id)
      if (sectionSpread >= 0 && sectionSpread < spreadIndex) {
        left.push(section)
      } else {
        right.push(section)
      }
    }
    return { rightSections: right, leftSections: left }
  }, [getSectionSpreadIndex, pageIndex, spreadIndex])

  const waitForFlipSettle = useCallback((flipInstance, runId) => {
    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve()
      }

      flipWaitersRef.current.push(() => {
        if (flipRunIdRef.current !== runId) {
          finish()
          return
        }
        finish()
      })
      const timeout = window.setTimeout(finish, FLIP_WAIT_MS)
    })
  }, [])

  const isPageInCurrentSpread = useCallback((flip, targetIndex) => {
    const collection = flip.getPageCollection?.()
    if (!collection) return flip.getCurrentPageIndex() === targetIndex
    return (
      collection.getSpreadIndexByPage(targetIndex) === collection.getCurrentSpreadIndex()
    )
  }, [])

  const flipToPageAnimated = useCallback(
    async (targetIndex) => {
      if (targetIndex < 0) return

      if (reducedMotion) {
        const page = DESIGN_SKETCHBOOK_PAGES[targetIndex]
        if (page) {
          document.getElementById(`sketch-${page.id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
        setPageIndex(targetIndex)
        return
      }

      const flip = pageFlipRef.current
      if (!flip || !ready) return

      if (isPageInCurrentSpread(flip, targetIndex)) {
        syncIndicesFromFlip(flip)
        return
      }

      const runId = flipRunIdRef.current + 1
      flipRunIdRef.current = runId
      navigatingRef.current = true
      setNavigating(true)

      try {
        let guard = 0
        const maxSteps = Math.max(pageCount * 2, 24)

        while (!isPageInCurrentSpread(flip, targetIndex) && guard < maxSteps) {
          if (flipRunIdRef.current !== runId) return

          const current = flip.getCurrentPageIndex()
          if (current < targetIndex) {
            setFlipDirection(0)
            flip.flipNext("top")
          } else {
            setFlipDirection(1)
            flip.flipPrev("top")
          }

          await waitForFlipSettle(flip, runId)
          if (flipRunIdRef.current !== runId) return

          syncIndicesFromFlip(flip)
          guard += 1
        }
      } finally {
        if (flipRunIdRef.current === runId) {
          navigatingRef.current = false
          setNavigating(false)
          syncIndicesFromFlip(flip)
        }
      }
    },
    [isPageInCurrentSpread, pageCount, ready, reducedMotion, syncIndicesFromFlip, waitForFlipSettle]
  )

  const goToSection = useCallback(
    (sectionId) => {
      const index = getSectionStartIndex(sectionId)
      if (index < 0) return
      setSelectedSectionId(sectionId)
      flipToPageAnimated(index)
    },
    [flipToPageAnimated]
  )

  const sketchRootRef = useRef(null)
  const goToSectionRef = useRef(goToSection)
  goToSectionRef.current = goToSection

  // TOC buttons live inside page-flip's reparented DOM — use capture delegation.
  useEffect(() => {
    const root = sketchRootRef.current
    if (!root) return undefined

    const onTocClick = (event) => {
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest?.("[data-toc-section]")
      if (!button || !root.contains(button)) return
      event.preventDefault()
      event.stopPropagation()
      const sectionId = button.getAttribute("data-toc-section")
      if (sectionId) goToSectionRef.current(sectionId)
    }

    root.addEventListener("click", onTocClick, true)
    return () => root.removeEventListener("click", onTocClick, true)
  }, [])

  useEffect(() => {
    if (reducedMotion || typeof window === "undefined") return undefined

    let cancelled = false
    let flipInstance = null

    const init = async () => {
      const host = bookHostRef.current
      if (!host) return

      const pages = host.querySelectorAll("[data-sketch-page]")
      if (!pages.length) return

      try {
        const { PageFlip } = await import("page-flip")
        if (cancelled) return

        flipInstance = new PageFlip(host, FLIP_SETTINGS)
        pageFlipRef.current = flipInstance

        flipInstance.on("flip", (e) => {
          const nextIndex =
            typeof e.data === "number" ? e.data : flipInstance.getCurrentPageIndex()
          setPageIndex(nextIndex)
          const collection = flipInstance.getPageCollection?.()
          if (collection) setSpreadIndex(collection.getCurrentSpreadIndex())
          if (navigatingRef.current) return
          setSelectedSectionId(DESIGN_SKETCHBOOK_PAGES[nextIndex]?.sectionId || null)
        })

        flipInstance.on("changeState", (e) => {
          const prevState = flipStateRef.current
          flipStateRef.current = e.data
          setFlipState(e.data)
          if (
            e.data === "flipping" ||
            e.data === "user_fold" ||
            e.data === "fold_corner"
          ) {
            const dir = flipInstance.getRender?.()?.getDirection?.()
            if (dir === 0 || dir === 1) setFlipDirection(dir)
          }
          if (e.data === "read") {
            setFlipDirection(null)
            const waiters = flipWaitersRef.current
            flipWaitersRef.current = []
            waiters.forEach((fn) => fn())
            const idx = flipInstance.getCurrentPageIndex()
            const last = flipInstance.getPageCount() - 1
            // Cover-corner hover can leave a hard leaf drawn on the empty half.
            if (
              (prevState === "fold_corner" || prevState === "user_fold") &&
              (idx === 0 || idx === last)
            ) {
              flipInstance.update()
            }
            window.requestAnimationFrame(() => measureTabAnchor())
          }
        })

        flipInstance.loadFromHTML(pages)
        // Hover-fold on hard covers leaves a board drawn across the empty half.
        const origUserMove = flipInstance.userMove.bind(flipInstance)
        flipInstance.userMove = (pos, isTouch) => {
          const idx = flipInstance.getCurrentPageIndex()
          const last = flipInstance.getPageCount() - 1
          if (!isTouch && (idx === 0 || idx === last)) return
          origUserMove(pos, isTouch)
        }
        setPageCount(flipInstance.getPageCount())
        syncIndicesFromFlip(flipInstance)
        const hardTop = flipInstance.getBoundsRect?.()?.top
        if (typeof hardTop === "number") {
          host.style.setProperty("--sketch-hard-top", `${Math.max(0, hardTop)}px`)
        }
        setReady(true)
      } catch {
        setReady(false)
      }
    }

    const timer = window.setTimeout(init, 50)

    return () => {
      cancelled = true
      flipRunIdRef.current += 1
      navigatingRef.current = false
      window.clearTimeout(timer)
      flipWaitersRef.current = []
      if (pageFlipRef.current) {
        pageFlipRef.current.destroy()
        pageFlipRef.current = null
      }
      setReady(false)
      setNavigating(false)
      flipStateRef.current = "read"
      setFlipState("read")
      setFlipDirection(null)
    }
  }, [reducedMotion])

  const goPrev = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (navigating || !ready) return
    const flip = pageFlipRef.current
    if (!flip || flip.getCurrentPageIndex() <= 0) return
    flipRunIdRef.current += 1
    setSelectedSectionId(null)
    const before = flip.getCurrentPageIndex()
    setFlipDirection(1)
    flip.flipPrev("top")
    window.setTimeout(() => {
      if (pageFlipRef.current !== flip) return
      if (flip.getCurrentPageIndex() === before) {
        flip.turnToPrevPage()
        syncIndicesFromFlip(flip)
      }
    }, FLIP_WAIT_MS)
  }

  const goNext = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (navigating || !ready) return
    const flip = pageFlipRef.current
    if (!flip || flip.getCurrentPageIndex() >= pageCount - 1) return
    flipRunIdRef.current += 1
    setSelectedSectionId(null)
    const before = flip.getCurrentPageIndex()
    setFlipDirection(0)
    flip.flipNext("top")
    window.setTimeout(() => {
      if (pageFlipRef.current !== flip) return
      if (flip.getCurrentPageIndex() === before) {
        flip.turnToNextPage()
        syncIndicesFromFlip(flip)
      }
    }, FLIP_WAIT_MS)
  }

  const bookOpen = pageIndex > 0
  // Hide the static board only while the front or back cover itself is turning —
  // not on the inner flip immediately after (page 2) or before (near the back).
  const lastPage = Math.max(0, pageCount - 1)
  const isTurningCover =
    flipState === "flipping" ||
    flipState === "user_fold" ||
    flipState === "fold_corner"
  const flippingFrontCover =
    isTurningCover && (pageIndex === 0 || (pageIndex <= 2 && flipDirection === 1))
  const flippingBackCover =
    isTurningCover &&
    (pageIndex >= lastPage ||
      (pageIndex >= lastPage - 2 && pageIndex < lastPage && flipDirection === 0))
  const showHardcoverCase =
    tabAnchor.bookWidth > 0 &&
    tabAnchor.faceHeight > 0 &&
    !flippingFrontCover &&
    !flippingBackCover
  // Back cover: treat like a closed board so left stubs tuck under the brown.
  const onBackCover =
    DESIGN_SKETCHBOOK_PAGES[pageIndex]?.variant === "back" ||
    (pageIndex > 0 && pageIndex >= lastPage)

  const renderRightTabs = (mode, { embedded = false } = {}) => (
    <TabRail
      role="tablist"
      aria-label="Sketchbook sections"
      $side="right"
      $mode={mode}
      $embedded={embedded}
      $anchored={embedded ? tabAnchor.bookWidth > 0 : true}
    >
      {rightSections.map((section) => {
        const selected = activeSectionId === section.id
        return (
          <SectionTab
            key={section.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={section.progress}
            $color={section.color}
            $active={selected && mode === "open"}
            $mode={mode}
            $compact={false}
            disabled={!reducedMotion && !ready}
            onClick={() => goToSection(section.id)}
          >
            <SectionTabLabel $mode={mode}>{section.label}</SectionTabLabel>
            {mode === "open" && (
              <SectionTabProgress>{section.progress}</SectionTabProgress>
            )}
          </SectionTab>
        )
      })}
    </TabRail>
  )

  const renderLeftStubs = () => {
    if (!bookOpen || leftSections.length === 0) return null
    return (
      <TabRail
        role="tablist"
        aria-label="Previous sketchbook sections"
        $side="left"
        $mode={onBackCover ? "closed" : "open"}
        $embedded
        $anchored={tabAnchor.bookWidth > 0}
      >
        {leftSections.map((section) => (
          <SectionTab
            key={section.id}
            type="button"
            role="tab"
            aria-label={`Go back to ${section.label}`}
            title={`${section.label}: ${section.progress}`}
            $color={section.color}
            $active={false}
            $mode="open"
            $compact
            disabled={!ready}
            onClick={() => goToSection(section.id)}
          />
        ))}
      </TabRail>
    )
  }

  if (reducedMotion) {
    return (
      <SketchbookRoot ref={sketchRootRef}>
        {renderRightTabs("open")}
        <ReducedMotionList aria-label="Design sketchbook pages">
          {DESIGN_SKETCHBOOK_PAGES.map((page) => (
            <ReducedMotionPage
              key={page.id}
              id={`sketch-${page.id}`}
              $variant={page.variant}
            >
              <SketchPageContent page={page} />
            </ReducedMotionPage>
          ))}
        </ReducedMotionList>
        <AttributionFooter />
      </SketchbookRoot>
    )
  }

  return (
    <SketchbookRoot ref={sketchRootRef}>
      <BookStage
        ref={bookStageRef}
        style={{
          "--sketch-tab-top": `${tabAnchor.top}px`,
          "--sketch-tab-right": `${tabAnchor.right}px`,
          "--sketch-tab-left": `${tabAnchor.left}px`,
          "--sketch-tab-book-width": `${tabAnchor.bookWidth}px`,
          "--sketch-face-top": `${tabAnchor.faceTop}px`,
          "--sketch-face-height": `${tabAnchor.faceHeight}px`,
        }}
        aria-label="Design team sketchbook — drag corners or use controls to flip pages"
      >
        {renderLeftStubs()}
        {renderRightTabs(bookOpen ? "open" : "closed", { embedded: true })}
        <HardcoverCase
          aria-hidden
          $visible={showHardcoverCase}
          $closed={!bookOpen || onBackCover}
          $back={onBackCover}
        />
        {onBackCover && showHardcoverCase && <BackCoverEdgeMask aria-hidden />}
        <BookHost
          ref={bookHostRef}
          className="stf__parent"
          $closed={!bookOpen || onBackCover}
        >
          {DESIGN_SKETCHBOOK_PAGES.map((page) => (
            <SketchPage
              key={page.id}
              data-sketch-page
              data-density={page.density}
              $hard={page.density === "hard"}
              className="design-sketchbook-page"
            >
              <SketchPageContent page={page} />
            </SketchPage>
          ))}
        </BookHost>
      </BookStage>

      <Controls>
        <ControlButton
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={goPrev}
          disabled={!ready || navigating || pageIndex <= 0}
        >
          Previous
        </ControlButton>
        <PageIndicator aria-live="polite">
          {!ready
            ? "Loading sketchbook…"
            : navigating
              ? "Turning pages…"
              : `Page ${pageIndex + 1} of ${pageCount}`}
        </PageIndicator>
        <ControlButton
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={goNext}
          disabled={!ready || navigating || pageIndex >= pageCount - 1}
        >
          Next
        </ControlButton>
      </Controls>

      <Hint>
        Named tabs sit on the right. After you pass a section, its tab moves to the left as a
        color stub — tap to flip back. Open the cover for the table of contents.
      </Hint>

      <AttributionFooter />
    </SketchbookRoot>
  )
}

function AttributionFooter() {
  const { name, author, url, license, npmPackage } = PAGE_FLIP_ATTRIBUTION
  return (
    <Attribution>
      Page-turn effect by{" "}
      <a href={url} target="_blank" rel="noopener noreferrer">
        {name}
      </a>{" "}
      ({license}) — {author}, via{" "}
      <a
        href="https://www.npmjs.com/package/page-flip"
        target="_blank"
        rel="noopener noreferrer"
      >
        {npmPackage}
      </a>
      .
    </Attribution>
  )
}

export default DesignSketchbook

const SketchbookRoot = styled.div`
  width: 100%;
  max-width: none;
  margin: var(--space-lg) 0;
  overflow: visible;

  /*
   * Side PageTabs leave an ~11–14rem rail for the tab list. Pull the book into
   * that column so it can use the full article width (and grow taller with it).
   */
  @media (min-width: 721px) {
    width: calc(100% + 14rem + var(--space-xl));
    max-width: calc(100% + 14rem + var(--space-xl));
    margin-left: calc(-14rem - var(--space-xl));
    position: relative;
    z-index: 0;
  }
`

/* How far closed tabs tuck under the outer hardcover rim. */
const TAB_CLOSED_TUCK_PX = 10

const TabRail = styled.div`
  /* Closed front (right) + back cover (left): tabs sit under the brown board */
  z-index: ${({ $mode }) => ($mode === "closed" ? 1 : 4)};
  pointer-events: none;
  display: flex;
  flex-direction: column;
  transition: inset 0.2s ease, width 0.2s ease, opacity 0.15s ease, transform 0.2s ease;
  opacity: ${({ $anchored }) => ($anchored === false ? 0 : 1)};

  ${({ $embedded, $side, $mode }) =>
    $embedded
      ? $side === "left"
        ? `
    /* Flush with notebook left edge — stubs sit outside the page.
       On the back cover ($mode closed), tuck under the hardcover rim. */
    position: absolute;
    top: var(--sketch-tab-top, 18%);
    bottom: auto;
    left: calc(
      var(--sketch-tab-left, 0px)
      ${
        $mode === "closed"
          ? ` + ${TAB_CLOSED_TUCK_PX}px`
          : ""
      }
    );
    width: 1.1rem;
    height: auto;
    justify-content: flex-start;
    gap: 0.4rem;
    transform: translateX(-100%);
  `
        : `
    position: absolute;
    top: var(--sketch-tab-top, 12%);
    bottom: auto;
    left: calc(
      var(--sketch-tab-left, 0px) + var(--sketch-tab-book-width, 0px)
      ${
        $mode === "closed"
          ? ` + ${COVER_OVERHANG_PX - TAB_CLOSED_TUCK_PX}px`
          : ""
      }
    );
    right: auto;
    width: ${$mode === "open" ? "7.75rem" : "6.5rem"};
    height: auto;
    justify-content: flex-start;
    gap: 0.4rem;
    transform: none;
  `
      : `
    position: relative;
    width: 100%;
    margin: 0 0 0.5rem;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.35rem;
    transform: none;
  `}

  > * {
    pointer-events: auto;
  }

  @media (max-width: 720px) {
    ${({ $embedded, $side, $mode }) =>
      $embedded && $side === "right"
        ? `
      width: ${$mode === "open" ? "6.5rem" : "5.25rem"};
    `
        : $embedded && $side === "left"
          ? `
      width: 0.9rem;
    `
          : ""}
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const SectionTab = styled.button`
  appearance: none;
  border: 1px solid color-mix(in srgb, ${({ $color }) => $color} 55%, #222);
  background: ${({ $color, $active }) =>
    $active
      ? `color-mix(in srgb, ${$color} 90%, #fff)`
      : `color-mix(in srgb, ${$color} 74%, #f5f0e6)`};
  color: #1a1a1a;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 1px 2px rgba(34, 34, 34, 0.12);
  flex: 0 0 auto;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    padding 0.2s ease,
    width 0.2s ease;

  ${({ $compact, $mode }) =>
    $compact
      ? `
    /* Fixed mini stubs — never grow with the notebook */
    border-radius: 5px 0 0 5px;
    border-right: none;
    width: 100%;
    height: 1.35rem;
    min-height: 1.35rem;
    max-height: 1.35rem;
    padding: 0;
  `
      : `
    border-radius: 0 7px 7px 0;
    border-left: none;
    width: 100%;
    padding: ${$mode === "open" ? "0.35rem 0.45rem 0.4rem 0.4rem" : "0.35rem 0.5rem"};
    /* Fixed tab height — do not flex-grow with the stage */
    height: ${$mode === "open" ? "3.15rem" : "2.35rem"};
    min-height: ${$mode === "open" ? "3.15rem" : "2.35rem"};
    max-height: ${$mode === "open" ? "3.15rem" : "2.35rem"};
    overflow: hidden;
  `}

  /* Active section: tuck onto the page face; others stay flush at the edge */
  ${({ $active, $compact }) =>
    $active && !$compact
      ? `
    transform: translateX(-14px);
    z-index: 1;
    box-shadow: -2px 1px 0 rgba(34, 34, 34, 0.08);
  `
      : `
    transform: translateX(0);
  `}

  &:hover:not(:disabled) {
    background: color-mix(in srgb, ${({ $color }) => $color} 92%, #fff);
    ${({ $compact, $active, $mode }) =>
      $compact
        ? `transform: translateX(-3px);`
        : $mode === "closed"
          ? `transform: translateX(3px);`
          : `transform: translateX(${$active ? "-16px" : "-4px"});`}
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const SectionTabLabel = styled.span`
  display: block;
  font-family: var(--font-body);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
  font-size: ${({ $mode }) => ($mode === "closed" ? "0.68rem" : "0.72rem")};
  margin-bottom: ${({ $mode }) => ($mode === "closed" ? "0" : "0.15rem")};
`

const SectionTabProgress = styled.span`
  display: -webkit-box;
  font-family: var(--font-body);
  font-size: 0.58rem;
  line-height: 1.25;
  opacity: 0.88;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const BookStage = styled.div`
  position: relative;
  z-index: 1;
  isolation: isolate;
  width: 100%;
  /* Hug the page-flip aspect box so hard covers aren't vertically centered in empty space. */
  height: auto;
  min-height: 0;
  overflow: visible;
  /* Room for left overpassed stubs + right named tabs */
  padding-left: 3.25rem;
  padding-right: 5.5rem;
  box-sizing: border-box;

  @media (max-width: 720px) {
    padding-left: 2.25rem;
    padding-right: 4rem;
  }
`

const HardcoverCase = styled.div`
  position: absolute;
  z-index: ${({ $closed }) => ($closed ? 2 : 0)};
  pointer-events: none;
  left: calc(var(--sketch-tab-left, 0px) - ${COVER_OVERHANG_PX}px);
  top: calc(var(--sketch-face-top, 0px) - ${COVER_OVERHANG_PX}px);
  width: calc(var(--sketch-tab-book-width, 0px) + ${COVER_OVERHANG_PX * 2}px);
  height: calc(var(--sketch-face-height, 0px) + ${COVER_OVERHANG_PX * 2}px);
  /* Front cover rounds the right edge; back cover rounds the left. */
  border-radius: ${({ $back, $closed }) =>
    $back ? "7px 3px 3px 7px" : $closed ? "3px 7px 7px 3px" : "3px 7px 7px 3px"};
  box-shadow: 0 10px 24px rgba(34, 22, 14, 0.22);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.1), transparent 46%),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.035) 0 1px,
      transparent 1px 4px
    ),
    ${COVER_BOARD};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity ${({ $visible }) => ($visible ? "0.35s ease" : "0s")};
`


/* Narrow brown strip that always paints over tab overlaps on the back cover. */
const BackCoverEdgeMask = styled.div`
  position: absolute;
  z-index: 5;
  pointer-events: none;
  left: calc(var(--sketch-tab-left, 0px) - ${COVER_OVERHANG_PX}px);
  top: calc(var(--sketch-face-top, 0px) - ${COVER_OVERHANG_PX}px);
  width: calc(${COVER_OVERHANG_PX}px + 14px);
  height: calc(var(--sketch-face-height, 0px) + ${COVER_OVERHANG_PX * 2}px);
  border-radius: 7px 0 0 7px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.1), transparent 46%),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.035) 0 1px,
      transparent 1px 4px
    ),
    ${COVER_BOARD};
`

const BookHost = styled.div`
  position: relative;
  z-index: 3;
  width: 100%;
  height: auto;
  margin: 0 auto;
  max-width: 100%;
  overflow: hidden;
  /* Closed: let peeking tabs receive clicks past the cover. Open: keep page-flip drags. */
  pointer-events: ${({ $closed }) => ($closed ? "none" : "auto")};

  .stf__item {
    pointer-events: auto;
  }

  /*
   * StPageFlip hard covers:
   *  1. rewrite the leaf to top:0 while resting pages sit at getRect().top
   *  2. use transform-origin y=0, so perspective lifts the board during rotateY
   */
  .stf__item.--hard:not(.--simple) {
    top: var(--sketch-hard-top, 0px) !important;
  }

  .stf__item.--hard:not(.--simple).--right {
    transform-origin: 0 50% !important;
  }

  .stf__item.--hard:not(.--simple).--left {
    transform-origin: 100% 50% !important;
  }

  /* Default 2000px perspective makes rotateY boards balloon and lift. */
  .stf__block {
    perspective: 8000px !important;
  }
`

const SketchPage = styled.div`
  background: ${({ $hard }) => ($hard ? COVER_BOARD : PAPER)};
  border: 1px solid
    ${({ $hard }) =>
      $hard ? "rgba(34, 34, 34, 0.22)" : "rgba(34, 34, 34, 0.08)"};
  box-sizing: border-box;
  overflow: hidden;
`

const SketchPageInner = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: ${({ $variant }) =>
    $variant === "cover" || $variant === "back" ? "center" : "flex-start"};
  align-items: ${({ $variant }) =>
    $variant === "cover" || $variant === "back" ? "center" : "flex-start"};
  text-align: ${({ $variant }) =>
    $variant === "cover" || $variant === "back" ? "center" : "left"};
  box-sizing: border-box;
  padding: clamp(1.25rem, 4vw, 2rem);
  height: 100%;
  min-height: 100%;
  width: 100%;
  margin: 0;

  ${({ $variant }) =>
    $variant === "cover" || $variant === "back"
      ? `
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.1), transparent 46%),
      repeating-linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.035) 0 1px,
        transparent 1px 4px
      ),
      ${COVER_BOARD};
  `
      : `
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.35), transparent 55%),
      ${PAPER};
  `}
`

const CoverPlate = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: min(86%, 22rem);
  padding: 1.35rem 1.15rem 1.45rem;
  background: ${PAPER};
  border-radius: 3px;
  box-shadow:
    0 0 0 1px rgba(255, 248, 235, 0.35),
    0 8px 18px rgba(0, 0, 0, 0.22);
`

const SketchCoverMark = styled.span`
  font-size: 2.5rem;
  line-height: 1;
  margin-bottom: var(--space-sm);
  opacity: 0.45;
`

const SketchTitle = styled.h3`
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: 400;
  color: var(--color-text);
  margin: 0 0 var(--space-sm);
  line-height: 1.2;
`

const SketchSubtitle = styled.p`
  font-family: var(--font-body);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin: 0 0 var(--space-md);
`

const SketchBody = styled.p`
  font-family: var(--font-body);
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--color-muted);
  margin: 0;
  max-width: 36rem;
`

const TocList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
`

const TocItem = styled.li`
  margin: 0;
`

const TocButton = styled.button`
  appearance: none;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  border: 1px solid color-mix(in srgb, ${({ $color }) => $color} 40%, var(--color-border));
  border-left: 4px solid ${({ $color }) => $color};
  border-radius: 6px;
  padding: 0.55rem 0.65rem;
  background: color-mix(in srgb, ${({ $color }) => $color} 10%, #fff);
  cursor: pointer;
  text-align: left;
  pointer-events: auto;

  &:hover {
    background: color-mix(in srgb, ${({ $color }) => $color} 18%, #fff);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
`

const TocSwatch = styled.span`
  flex: 0 0 auto;
  width: 0.7rem;
  height: 0.7rem;
  margin-top: 0.2rem;
  border-radius: 2px;
  background: ${({ $color }) => $color};
`

const TocText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
`

const TocLabel = styled.span`
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text);
`

const TocProgress = styled.span`
  font-family: var(--font-body);
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-muted);
`

const SketchPlaceholder = styled.div`
  margin-top: var(--space-md);
  width: 100%;
  max-width: 28rem;
  min-height: 10rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  box-sizing: border-box;
  border: 1.5px dashed rgba(34, 34, 34, 0.2);
  border-radius: 4px;
  background: repeating-linear-gradient(
    -45deg,
    rgba(200, 240, 80, 0.08),
    rgba(200, 240, 80, 0.08) 6px,
    transparent 6px,
    transparent 12px
  );
`

const SketchPlaceholderLabel = styled.span`
  font-family: var(--font-body);
  font-size: 0.75rem;
  line-height: 1.4;
  text-align: center;
  color: var(--color-muted);
`

const SketchFigure = styled.figure`
  margin: var(--space-md) 0 0;
  width: 100%;
  max-width: 28rem;
`

const SketchImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: 4px;
  border: 1px solid rgba(34, 34, 34, 0.12);
`

const SketchCaption = styled.figcaption`
  margin-top: 0.4rem;
  font-family: var(--font-body);
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-muted);
`

const Controls = styled.div`
  position: relative;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-md);
  flex-wrap: wrap;
  pointer-events: auto;
`

const ControlButton = styled.button`
  appearance: none;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.45rem 1rem;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--color-accent);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
`

const PageIndicator = styled.p`
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-muted);
  margin: 0;
  min-width: 8rem;
  text-align: center;
`

const Hint = styled.p`
  position: relative;
  z-index: 6;
  font-size: 0.75rem;
  color: var(--color-muted);
  text-align: center;
  margin: var(--space-sm) 0 0;
`

const Attribution = styled.p`
  font-size: 0.7rem;
  color: var(--color-muted);
  text-align: center;
  margin: var(--space-md) 0 0;
  line-height: 1.5;

  a {
    color: var(--color-text);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`

const ReducedMotionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
`

const ReducedMotionPage = styled.div`
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  min-height: 10rem;
`

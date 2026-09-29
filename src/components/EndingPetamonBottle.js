import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import styled from "styled-components"
import { artFont, artPx, inputCopyCss, phone } from "./artScale.js"

const CDN =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/ending-petamon-eating-bottle"
/** Same bang as the waterfall's popup hint. */
const HINT_BANG_SRC =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/exclamation.avif"

/** Shared plate the pieces were painted on. */
const CANVAS = { w: 1440, h: 3831 }
/** Window around the assembled bottle, with room for the pop. */
const CROP = { x: 70, y: 1960, w: 1340, h: 1060 }
/** Padding (canvas px) around each painted box so edges never clip. */
const BOX_PAD = 6

/**
 * `piece` / `pet` are the painted boxes [x0, y0, x1, y1] in canvas px (union of
 * both states: hol + pop, petamon + monch). Only that window is rendered.
 * `hit` is the fallback hover box until the alpha masks load.
 *
 * `fly` is the assembly path: `from` is where the piece starts, as a fraction
 * of the viewport (outside the edges), `curve` bends the path sideways (share
 * of its length), `spin` is the starting rotation, `delay` staggers the start
 * (share of the assembly scroll).
 *
 * `burst` is each petamon's pop delay, as a share of BURST_STAGGER_MS.
 */
const PIECES = [
  {
    id: "drylab",
    label: "Dry lab",
    hol: "drylabyellowhol.avif",
    pop: "drylabyellow.avif",
    pet: "dlpetamon.avif",
    monch: "dlmonch.avif",
    hit: { x: 175, y: 2280, w: 418, h: 430 },
    piece: [175, 2387, 593, 2710],
    petBox: [177, 2280, 423, 2544],
    fly: { from: [-0.2, 0.6], curve: 0.25, spin: -70, delay: 0 },
    burst: 0.1,
  },
  {
    id: "hardware",
    label: "Hardware",
    hol: "hardwareorangehol.avif",
    pop: "hardwareorange.avif",
    pet: "hwpetamon.avif",
    monch: "hwmonch.avif",
    hit: { x: 356, y: 2183, w: 480, h: 338 },
    piece: [356, 2269, 836, 2517],
    petBox: [409, 2199, 673, 2384],
    fly: { from: [0.2, -0.25], curve: -0.3, spin: 55, delay: 0.06 },
    burst: 0,
  },
  {
    id: "human-practices",
    label: "Human practices",
    hol: "hpredhol.avif",
    pop: "hpred.avif",
    pet: "hppetamon.avif",
    monch: "hpmonch.avif",
    hit: { x: 992, y: 2065, w: 406, h: 335 },
    piece: [992, 2121, 1282, 2400],
    petBox: [1109, 2065, 1398, 2350],
    fly: { from: [1.2, 0.25], curve: 0.3, spin: 80, delay: 0.03 },
    burst: 0.22,
  },
  {
    id: "outreach",
    label: "Outreach",
    hol: "outreachpinkhol.avif",
    pop: "outreachpink.avif",
    pet: "orpetamon.avif",
    monch: "ormonch.avif",
    hit: { x: 714, y: 2059, w: 294, h: 360 },
    piece: [715, 2154, 1008, 2419],
    petBox: [738, 2060, 938, 2258],
    fly: { from: [0.75, -0.25], curve: 0.2, spin: -45, delay: 0.12 },
    burst: 0.05,
  },
  {
    id: "venture",
    label: "Venture",
    hol: "venturepurplehol.avif",
    pop: "venturepurple.avif",
    pet: "venpetamon.avif",
    monch: "venmonch.avif",
    hit: { x: 797, y: 2348, w: 412, h: 416 },
    piece: [797, 2348, 1208, 2641],
    petBox: [908, 2530, 1138, 2764],
    fly: { from: [1.2, 0.8], curve: -0.25, spin: -60, delay: 0.09 },
    burst: 0.28,
  },
  {
    id: "web",
    label: "Web",
    hol: "webgreenhol.avif",
    pop: "webgreen.avif",
    pet: "webpetamon.avif",
    monch: "webmonch.avif",
    hit: { x: 178, y: 2504, w: 414, h: 408 },
    piece: [215, 2504, 592, 2858],
    petBox: [179, 2704, 396, 2912],
    fly: { from: [0.1, 1.25], curve: -0.3, spin: 65, delay: 0.15 },
    burst: 0.15,
  },
  {
    id: "wetlab",
    label: "Wet lab",
    hol: "wetlabbluehol.avif",
    pop: "wetlabblue.avif",
    pet: "wlpetamon.avif",
    monch: "wlmonch.avif",
    hit: { x: 543, y: 2422, w: 332, h: 399 },
    piece: [543, 2422, 875, 2773],
    petBox: [605, 2638, 802, 2821],
    fly: { from: [0.55, 1.25], curve: 0.3, spin: -35, delay: 0.05 },
    burst: 0.32,
  },
]

/** Hover / pinned enlargement of a piece and its petamon. */
const POP_SCALE = 1.25
/** Longest fly-in delay; every piece still lands by assemble = 1. */
const FLY_DELAY_MAX = 0.15
/** Burst plays (real time) once the hold is this far in; resets below BURST_RESET_AT. */
const BURST_TRIGGER_AT = 0.04
const BURST_RESET_AT = 0.01
/** All petamons pop within this window (their `burst` delays scale to it). */
const BURST_STAGGER_MS = 1400
const POP_MS = 900
const SHINE_MS = 650
const JOLT_MS = 420

/** Masks are sampled at 1/MASK_STEP of canvas resolution. */
const MASK_STEP = 4
const MASK_W = Math.ceil(CROP.w / MASK_STEP)
const MASK_H = Math.ceil(CROP.h / MASK_STEP)
const ALPHA_MIN = 24

const clamp01 = v => Math.max(0, Math.min(1, v))
const easeOutSine = t => Math.sin((t * Math.PI) / 2)

/** [x0, y0, x1, y1] → padded { x, y, w, h } in canvas px. */
function padBox([x0, y0, x1, y1]) {
  return {
    x: x0 - BOX_PAD,
    y: y0 - BOX_PAD,
    w: x1 - x0 + BOX_PAD * 2,
    h: y1 - y0 + BOX_PAD * 2,
  }
}

const boxCenter = box => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 })

const LAYOUT = PIECES.map(piece => {
  const pieceBox = padBox(piece.piece)
  const petBox = padBox(piece.petBox)
  return {
    pieceBox,
    petBox,
    pieceCenter: boxCenter(pieceBox),
    petCenter: boxCenter(petBox),
  }
})

/** Window (on the canvas) showing one painted box. */
function windowStyle(box) {
  return {
    left: `${(box.x / CANVAS.w) * 100}%`,
    top: `${(box.y / CANVAS.h) * 100}%`,
    width: `${(box.w / CANVAS.w) * 100}%`,
    height: `${(box.h / CANVAS.h) * 100}%`,
  }
}

/** Full-canvas image offset so `box` fills its window. */
function windowImgStyle(box) {
  return {
    width: `${(CANVAS.w / box.w) * 100}%`,
    left: `${(-box.x / box.w) * 100}%`,
    top: `${(-box.y / box.h) * 100}%`,
  }
}

/** A canvas point as a transform-origin inside `box`'s window. */
function originIn(box, point) {
  return `${((point.x - box.x) / box.w) * 100}% ${
    ((point.y - box.y) / box.h) * 100
  }%`
}

function hitStyle(hit) {
  return {
    left: `${((hit.x - CROP.x) / CROP.w) * 100}%`,
    top: `${((hit.y - CROP.y) / CROP.h) * 100}%`,
    width: `${(hit.w / CROP.w) * 100}%`,
    height: `${(hit.h / CROP.h) * 100}%`,
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Opaque pixels of the piece + its petamon, cropped to CROP. */
async function buildMask(piece) {
  const imgs = await Promise.all(
    [piece.hol, piece.pet].map(name => loadImage(`${CDN}/${name}`))
  )
  const canvas = document.createElement("canvas")
  canvas.width = MASK_W
  canvas.height = MASK_H
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  for (const img of imgs) {
    ctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, MASK_W, MASK_H)
  }
  const { data } = ctx.getImageData(0, 0, MASK_W, MASK_H)
  const mask = new Uint8Array(MASK_W * MASK_H)
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > ALPHA_MIN
  return mask
}

/** Canvas-pixel point → piece id, by painted shape (or hit boxes until masks load). */
function pieceAt(masks, x, y) {
  if (masks) {
    const mx = Math.floor((x - CROP.x) / MASK_STEP)
    const my = Math.floor((y - CROP.y) / MASK_STEP)
    if (mx < 0 || my < 0 || mx >= MASK_W || my >= MASK_H) return null
    const hit = PIECES.find((_, i) => masks[i][my * MASK_W + mx])
    return hit ? hit.id : null
  }
  const hit = [...PIECES]
    .reverse()
    .find(
      ({ hit: h }) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h
    )
  return hit ? hit.id : null
}

/**
 * The ending bottle. The page drives it through the ref:
 * `update({ assemble, burst })`, both 0–1 — pieces fly in from the screen
 * edges as `assemble` rises, then petamons pop out from behind their pieces
 * as `burst` rises. Hover/pin only once both are done.
 */
const EndingPetamonBottle = forwardRef(function EndingPetamonBottle(_, ref) {
  const [pinned, setPinned] = useState(null)
  const [hover, setHover] = useState(null)
  const [ready, setReady] = useState(true)
  const masksRef = useRef(null)
  const frameRef = useRef(null)
  const flyRefs = useRef([])
  const backRefs = useRef([])
  const frontRefs = useRef([])
  const readyRef = useRef(true)
  const shineRefs = useRef([])
  const joltRefs = useRef([])
  const burstPlayingRef = useRef(false)
  const burstDoneRef = useRef(false)
  const burstAnimsRef = useRef([])
  const active = ready ? pinned ?? hover : null

  useImperativeHandle(ref, () => ({
    update({ assemble, burst }) {
      const frame = frameRef.current
      if (!frame) return
      const rect = frame.getBoundingClientRect()
      const sx = rect.width / CROP.w
      const sy = rect.height / CROP.h
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Pieces aim at where they'll sit once the bottle reaches mid-view (the
      // hold), so they fly across the screen instead of chasing the bottle
      // while it's still below the fold. At assemble = 1 this is 0.
      const arrivalShift = rect.top + rect.height / 2 - vh / 2

      PIECES.forEach((piece, i) => {
        const { pieceBox, pieceCenter } = LAYOUT[i]
        const fly = flyRefs.current[i]
        if (fly) {
          // Before the fly-in starts the pieces are parked off-screen; hide
          // them outright so none can peek in anywhere else on the page.
          fly.style.visibility = assemble > 0 ? "" : "hidden"
          const t = easeOutSine(
            clamp01((assemble - piece.fly.delay) / (1 - FLY_DELAY_MAX))
          )
          if (assemble >= 1) {
            fly.style.transform = ""
          } else {
            // Quadratic curve (viewport px) from an off-screen point to the
            // piece's arrival spot; the control point bends each path.
            const hx = rect.left + (pieceCenter.x - CROP.x) * sx
            const hy = rect.top + (pieceCenter.y - CROP.y) * sy
            const ax = hx
            const ay = hy - arrivalShift
            // Start fully outside the edge the piece comes from (its own
            // half-size, with room for the spin), not just its center.
            const reach = (Math.max(pieceBox.w * sx, pieceBox.h * sy) / 2) * 1.2
            const [fromX, fromY] = piece.fly.from
            const fx =
              fromX < 0 ? -reach : fromX > 1 ? vw + reach : fromX * vw
            const fy =
              fromY < 0 ? -reach : fromY > 1 ? vh + reach : fromY * vh
            const cx = (fx + ax) / 2 - (ay - fy) * piece.fly.curve
            const cy = (fy + ay) / 2 + (ax - fx) * piece.fly.curve
            const u = 1 - t
            const px = u * u * fx + 2 * u * t * cx + t * t * ax
            const py = u * u * fy + 2 * u * t * cy + t * t * ay
            fly.style.transform = `translate3d(${px - hx}px, ${
              py - hy
            }px, 0) rotate(${piece.fly.spin * u}deg)`
          }
        }
      })

      // Burst: one real-time show once the hold starts, so a fast scroll
      // can't skim past it; scrolling back above the hold rewinds it.
      if (!burstPlayingRef.current && assemble >= 1 && burst >= BURST_TRIGGER_AT) {
        burstPlayingRef.current = true
        playBurst(rect)
      } else if (burstPlayingRef.current && burst < BURST_RESET_AT) {
        burstPlayingRef.current = false
        resetBurst()
      }

      const nowReady = assemble >= 1 && burstDoneRef.current
      if (nowReady !== readyRef.current) {
        readyRef.current = nowReady
        setReady(nowReady)
        if (!nowReady) {
          setHover(null)
          setPinned(null)
        }
      }
    },
  }))

  /** Each petamon shoots out from behind its piece, overshoots, wobbles, settles. */
  function playBurst(rect) {
    const sx = rect.width / CROP.w
    const sy = rect.height / CROP.h
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const anims = []
    PIECES.forEach((piece, i) => {
      const { pieceCenter, petCenter } = LAYOUT[i]
      const delay = reduce ? 0 : piece.burst * BURST_STAGGER_MS
      const dx = (pieceCenter.x - petCenter.x) * sx
      const dy = (pieceCenter.y - petCenter.y) * sy
      const pop = reduce
        ? [{ transform: "none" }, { transform: "none" }]
        : [
            { transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(-25deg)`, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.2)" },
            { offset: 0.42, transform: `translate(${-dx * 0.18}px, ${-dy * 0.18}px) scale(1.4) rotate(14deg)`, easing: "ease-in-out" },
            { offset: 0.62, transform: `translate(${dx * 0.05}px, ${dy * 0.05}px) scale(0.86) rotate(-8deg)`, easing: "ease-in-out" },
            { offset: 0.8, transform: "translate(0, 0) scale(1.1) rotate(4deg)", easing: "ease-out" },
            { transform: "none" },
          ]
      const timing = { duration: reduce ? 1 : POP_MS, delay, fill: "both" }
      const back = backRefs.current[i]
      const front = frontRefs.current[i]
      if (back) {
        back.style.transformOrigin = "50% 50%"
        anims.push(back.animate(pop, timing))
        anims.push(
          back.animate(
            [{ opacity: 1 }, { offset: 0.45, opacity: 1 }, { offset: 0.62, opacity: 0 }, { opacity: 0 }],
            timing
          )
        )
      }
      if (front) {
        front.style.transformOrigin = "50% 50%"
        anims.push(front.animate(pop, timing))
        anims.push(
          front.animate(
            [{ opacity: 0 }, { offset: 0.42, opacity: 0 }, { offset: 0.6, opacity: 1 }, { opacity: 1 }],
            timing
          )
        )
      }
      if (reduce) return
      const shine = shineRefs.current[i]
      if (shine) {
        anims.push(
          shine.animate(
            [
              { transform: "scale(0.2)", opacity: 0 },
              { offset: 0.25, transform: "scale(1)", opacity: 1 },
              { transform: "scale(1.9)", opacity: 0 },
            ],
            { duration: SHINE_MS, delay, easing: "ease-out", fill: "both" }
          )
        )
      }
      const jolt = joltRefs.current[i]
      if (jolt) {
        anims.push(
          jolt.animate(
            [
              { transform: "none" },
              { offset: 0.3, transform: "scale(1.08) rotate(-3deg)" },
              { offset: 0.6, transform: "scale(0.97) rotate(2deg)" },
              { transform: "none" },
            ],
            { duration: JOLT_MS, delay, easing: "ease-out" }
          )
        )
      }
    })
    burstAnimsRef.current = anims
    Promise.all(anims.map(a => a.finished))
      .then(() => {
        if (!burstPlayingRef.current) return
        burstDoneRef.current = true
        if (!readyRef.current) {
          readyRef.current = true
          setReady(true)
        }
      })
      .catch(() => {})
  }

  function resetBurst() {
    burstAnimsRef.current.forEach(a => a.cancel())
    burstAnimsRef.current = []
    burstDoneRef.current = false
  }

  useEffect(() => {
    let cancelled = false
    Promise.all(PIECES.map(buildMask))
      .then(masks => {
        if (!cancelled) masksRef.current = masks
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const pieceFromEvent = event => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = CROP.x + ((event.clientX - rect.left) / rect.width) * CROP.w
    const y = CROP.y + ((event.clientY - rect.top) / rect.height) * CROP.h
    return pieceAt(masksRef.current, x, y)
  }

  return (
    <Root data-grown="">
      <Frame
        ref={frameRef}
        style={{ cursor: hover && ready ? "pointer" : undefined }}
        onPointerMove={event => {
          if (event.pointerType !== "mouse" || pinned || !ready) return
          setHover(pieceFromEvent(event))
        }}
        onPointerLeave={event => {
          if (event.pointerType !== "mouse") return
          setHover(null)
        }}
        onClick={event => {
          if (!ready) return
          // Keyboard activation targets the button; pointer clicks resolve by shape.
          const id =
            event.target.dataset?.piece ??
            (event.detail > 0 ? pieceFromEvent(event) : null)
          if (!id) return
          setHover(null)
          setPinned(current => (current === id ? null : id))
        }}
      >
        <Canvas aria-hidden="true">
          {PIECES.map((piece, i) => {
            const { petBox, pieceCenter } = LAYOUT[i]
            return (
              <Win
                key={`${piece.id}-back`}
                ref={el => (backRefs.current[i] = el)}
                $z={1}
                style={{
                  ...windowStyle(petBox),
                  opacity: 0,
                  transformOrigin: originIn(petBox, pieceCenter),
                }}
              >
                <Clip>
                  <WinImg src={`${CDN}/${piece.pet}`} alt="" style={windowImgStyle(petBox)} />
                </Clip>
              </Win>
            )
          })}
          {PIECES.map((piece, i) => {
            const { pieceBox, pieceCenter } = LAYOUT[i]
            const popped = active === piece.id
            return (
              <Win
                key={piece.id}
                ref={el => (flyRefs.current[i] = el)}
                $z={popped ? 5 : 2}
                style={windowStyle(pieceBox)}
              >
                <Pop
                  ref={el => (joltRefs.current[i] = el)}
                  $pop={popped}
                  style={{ transformOrigin: originIn(pieceBox, pieceCenter) }}
                >
                  <Clip>
                    <WinImg
                      $on={!popped}
                      src={`${CDN}/${piece.hol}`}
                      alt=""
                      style={windowImgStyle(pieceBox)}
                    />
                    <WinImg
                      $on={popped}
                      src={`${CDN}/${piece.pop}`}
                      alt=""
                      style={windowImgStyle(pieceBox)}
                    />
                  </Clip>
                </Pop>
              </Win>
            )
          })}
          {PIECES.map((piece, i) => (
            <Shine
              key={`${piece.id}-shine`}
              ref={el => (shineRefs.current[i] = el)}
              style={windowStyle(LAYOUT[i].petBox)}
            />
          ))}
          {PIECES.map((piece, i) => {
            const { petBox, pieceCenter } = LAYOUT[i]
            const popped = active === piece.id
            return (
              <Win
                key={`${piece.id}-pet`}
                ref={el => (frontRefs.current[i] = el)}
                $z={popped ? 6 : 4}
                style={{
                  ...windowStyle(petBox),
                  opacity: 0,
                  transformOrigin: originIn(petBox, pieceCenter),
                }}
              >
                <Pop $pop={popped} style={{ transformOrigin: originIn(petBox, pieceCenter) }}>
                  <Clip>
                    <WinImg
                      $on={!popped}
                      src={`${CDN}/${piece.pet}`}
                      alt=""
                      style={windowImgStyle(petBox)}
                    />
                    <WinImg
                      $on={popped}
                      src={`${CDN}/${piece.monch}`}
                      alt=""
                      style={windowImgStyle(petBox)}
                    />
                  </Clip>
                </Pop>
              </Win>
            )
          })}
        </Canvas>
        <Hint $show={ready} aria-hidden={!ready}>
          <HintBang src={HINT_BANG_SRC} alt="" />
          <span className="hover-copy">
            Hover over a piece to meet its petamon — click to keep it popped.
          </span>
          <span className="touch-copy">
            Tap a piece to meet its petamon — tap again to put it back.
          </span>
        </Hint>
        {PIECES.map(piece => (
          <Hit
            key={`${piece.id}-hit`}
            type="button"
            style={hitStyle(piece.hit)}
            aria-pressed={pinned === piece.id}
            aria-label={piece.label}
            data-piece={piece.id}
            disabled={!ready}
          />
        ))}
      </Frame>
    </Root>
  )
})

export default EndingPetamonBottle

const Root = styled.div`
  width: 100%;
  pointer-events: auto;
`

const Frame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: ${CROP.w} / ${CROP.h};
  overflow: visible;
`

const Canvas = styled.div`
  position: absolute;
  left: ${(-CROP.x / CROP.w) * 100}%;
  top: ${(-CROP.y / CROP.h) * 100}%;
  width: ${(CANVAS.w / CROP.w) * 100}%;
  height: ${(CANVAS.h / CROP.h) * 100}%;
  pointer-events: none;
`

/** One painted box, moved by `update` (fly-in / burst). */
const Win = styled.div`
  position: absolute;
  z-index: ${({ $z }) => $z};
  will-change: transform, opacity;
`

/** Crops the full-canvas image to its box; inside Pop so the pop isn't clipped. */
const Clip = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
`

/** Flash behind a petamon as it bursts out (animated in playBurst). */
const Shine = styled.div`
  position: absolute;
  z-index: 3;
  opacity: 0;
  pointer-events: none;
  background: radial-gradient(
    circle closest-side,
    rgba(255, 255, 235, 0.95) 0%,
    rgba(255, 226, 120, 0.7) 35%,
    rgba(255, 170, 90, 0.25) 65%,
    transparent 100%
  );
`

/** Shown once the burst is done: how to use the pieces. */
const Hint = styled.p`
  position: absolute;
  top: 100%;
  left: 50%;
  display: flex;
  align-items: center;
  gap: ${artPx(10)};
  width: max-content;
  max-width: 110%;
  margin: ${artPx(6)} 0 0;
  transform: translateX(-50%);
  color: #ff6b75;
  font-family: var(--font-body);
  ${artFont(22)}
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transition: opacity 500ms ease 200ms;
  pointer-events: none;

  ${phone} {
    font-size: 0.75rem;
    width: 90vw;
    justify-content: center;
  }

  ${inputCopyCss}
`

const HintBang = styled.img`
  width: ${artPx(40)};
  height: auto;
  flex: 0 0 auto;

  ${phone} {
    width: 1.4rem;
  }
`

/** Hover pop, separate from the scroll-driven transform on Win. */
const Pop = styled.div`
  position: absolute;
  inset: 0;
  transform: scale(${({ $pop }) => ($pop ? POP_SCALE : 1)});
  transition: transform 460ms cubic-bezier(0.34, 1.45, 0.48, 1);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const WinImg = styled.img`
  position: absolute;
  display: block;
  height: auto;
  max-width: none;
  opacity: ${({ $on }) => ($on === false ? 0 : 1)};
  transition: opacity 220ms ease;
  user-select: none;
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Hit = styled.button`
  position: absolute;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  /* Kept for keyboard focus; pointer hits are resolved on Frame by shape. */
  pointer-events: none;
`

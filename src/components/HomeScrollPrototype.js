import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { withPrefix } from "gatsby"
import styled, { css, keyframes } from "styled-components"
import { WikiTopBar, WIKI_TOP_BAR_Z_INDEX } from "./WikiTopBar.js"
import { WaterfallSideText, PETASE_EXPLANATION } from "./WaterfallSideText.js"
import { SwipeInBox } from "./SwipeInBox.js"
import { ExplainTerm } from "./ExplainTermPopover.js"
import EndingPetamonBottle from "./EndingPetamonBottle.js"
import { ART_REF_W, ART_WIDTH_VAR, artFont, artPx, phone } from "./artScale.js"
import { LOGO_BOX, LOGO_FRAMES, LOGO_PLATE, LogoFrame } from "./logoFrames.js"
import { SiteLoader } from "./SiteLoader.js"

/**
 * Homepage bottle stages (degradation journey).
 * `sky` is used for the waterfall; section1–5 are reserved for later sections.
 */
export const BOTTLE_STAGES = {
  sky: "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/sky.avif",
  section1:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/section1.avif",
  section2:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/section2.avif",
  section3:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/section3.avif",
  section4:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/section4.avif",
  section5:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/section5.avif",
  section6:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/section6.avif",
}

const ASSETS = {
  back: "https://static.igem.wiki/teams/6187/wiki/homepage-components/wiki-front-page-back.avif",
  /** Unified front plate: plaza + waterfall + river + map + forest. */
  front:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/wiki-front-page-top.avif",
  /** Foreground bushes — highest scenery layer (same 563×4000 canvas as front). */
  bush: "https://static.igem.wiki/teams/6187/wiki/homepage-components/wiki-front-page-bush.avif",
  /** Waterfall / sky section bottle (current homepage stage). */
  bottle: BOTTLE_STAGES.sky,
  /** Opaque puddle lip — sits over the bottle so it can tuck behind the water. */
  water: withPrefix("/wiki-mockup/wiki-front-water.png"),
}

/**
 * Unified front canvas (CDN `wiki-front-page-top.avif`).
 * Overlay bands are fractions of this image so a same-composition re-export
 * (e.g. 1440-wide) keeps placement. Measured on 563×4000:
 *   0–395 transparent sky hole (Toronto shows through)
 *   395–1380 plaza + waterfall (legacy 2440 plate)
 *   1380–2440 river / first sand (legacy shore)
 *   2440–2900 world map
 *   2900–3503 forest
 *   3503–4000 transparent pad
 */
const FRONT_ART_HEIGHT = 4000
const WATERFALL_BAND_TOP = 395 / FRONT_ART_HEIGHT
const WATERFALL_BAND_BOT = 1380 / FRONT_ART_HEIGHT
const SHORE_BAND_BOT = 2440 / FRONT_ART_HEIGHT
const WATERFALL_BAND_HEIGHT = WATERFALL_BAND_BOT - WATERFALL_BAND_TOP
const SHORE_BAND_TOP = WATERFALL_BAND_BOT
const SHORE_BAND_HEIGHT = SHORE_BAND_BOT - SHORE_BAND_TOP
/**
 * Painted continents in the front plate (under LOGAN copy).
 * The 2440–2900 comment is the whole map scene (cream + land + forest lip);
 * tan land is ~2644–2834. Overlay matches that box so Mercator outlines
 * can fill the painted continents instead of sitting in a squashed band.
 */
const WORLD_MAP_TOP = 2644 / FRONT_ART_HEIGHT
const WORLD_MAP_HEIGHT = (2834 - 2644) / FRONT_ART_HEIGHT
/** Under the world map, through the forest / just above the bushes. */
const FOREST_BAND_TOP = 2660 / FRONT_ART_HEIGHT
const FOREST_BAND_BOT = 3503 / FRONT_ART_HEIGHT
const FOREST_BAND_HEIGHT = FOREST_BAND_BOT - FOREST_BAND_TOP
const CREAM_PAD_TOP = FOREST_BAND_BOT
const CREAM_PAD_HEIGHT = 1 - CREAM_PAD_TOP

/**
 * Scroll-driven bottle: enter from left after shore float, descend the map→forest
 * band, swap+shrink at the topmost section-3 bird, park at the second-topmost crab
 * (above the industry line) during walk-sticky, then fall behind the bushes once
 * non-sticky scrolling resumes. Scroll-up reverses the same path.
 *
 * Landmark tops are % of this band, derived from section-3 painted centroids:
 *   bird-b (topmost bird) ≈ 36.3% of forest → ~49.5% of bottle band
 *   crab-b (2nd-top crab) ≈ 70.9% of forest → ~76.9% of bottle band
 */
const MAP_BOTTLE_BAND_TOP = SHORE_BAND_BOT
const MAP_BOTTLE_BAND_HEIGHT = FOREST_BAND_BOT - SHORE_BAND_BOT
/** Horizontal: slide in from off-left, then hold this % while descending. */
const MAP_BOTTLE_LEFT_ENTER = -16
const MAP_BOTTLE_LEFT_REST = 12
/** Progress (0–1) by which the left-enter finishes and downward travel dominates. */
const MAP_BOTTLE_ENTER_END = 0.12
/** Vertical keyframes within the bottle band (%). */
const MAP_BOTTLE_TOP_START = 8
/** Same Y as topmost section-3 bird — swap to section3 + begin shrink here. */
const MAP_BOTTLE_TOP_SWAP = 49.5
/** Reached as the walk begins (higher = smaller %). Above industry copy. */
const MAP_BOTTLE_TOP_HOLD = 73
/**
 * Comes to rest here, down in the bush line. Measured on the bush plate, its
 * leaves start at 82% of this band and are solid by 86.5%, so this drops the
 * bottle well inside them — only the cap shows through the thinning top edge,
 * and the bird has to dive in after the rest of it.
 */
const MAP_BOTTLE_TOP_BUSH = 86
/** Tuck fully behind bushes after walk sticky releases. */
const MAP_BOTTLE_TOP_EXIT = 98
/** Final scale once fully into the section3 stage (lerps SWAP → HOLD). */
const MAP_BOTTLE_FOREST_SCALE = 0.62

/** Map a band-top % onto 0–1 scroll progress along START → EXIT. */
function mapBottleProgressForTop(topPct) {
  return (
    (topPct - MAP_BOTTLE_TOP_START) /
    Math.max(1e-6, MAP_BOTTLE_TOP_EXIT - MAP_BOTTLE_TOP_START)
  )
}
const MAP_BOTTLE_HOLD_P = mapBottleProgressForTop(MAP_BOTTLE_TOP_HOLD)
const MAP_BOTTLE_BUSH_P = mapBottleProgressForTop(MAP_BOTTLE_TOP_BUSH)
const MAP_BOTTLE_FADE_P = mapBottleProgressForTop(96)
/** Share of the drop into the bushes that happens while he is still walking. */
const MAP_BOTTLE_WALK_FALL_SHARE = 0.85
/**
 * Walk progress by which that share is spent. The drop starts out in the
 * industry line's column, so it clears it in the first stretch of the walk
 * rather than creeping down behind the words.
 */
const MAP_BOTTLE_WALK_FALL_END = 0.4
/** Steal progress by which the bottle has finished settling in the leaves. */
const MAP_BOTTLE_SETTLE_END = 0.17

/**
 * Section4 bottle (after bushes): barrel-rolls in from the right as the cream-pad
 * “advisory lab” copy enters, sticks at viewport center, parks under “Some
 * applications include…”, then after a short hold tilts onto the WWTP ramp and
 * slides off down-left.
 */
const CREAM_BOTTLE_LEFT_ENTER = 120
const CREAM_BOTTLE_LEFT_CENTER = 50
/** Full Z rotations during the right→center approach. */
const CREAM_BOTTLE_ROLLS = 4
/** Gap from the apps lead bottom to the bottle top while parked (px). */
const CREAM_BOTTLE_PARK_GAP_PX = 28
/**
 * Cream-text top vs viewport height: roll starts / reaches center.
 * Wider gap (lower end frac) = slower approach to center.
 */
const CREAM_BOTTLE_ROLL_START_FRAC = 0.95
const CREAM_BOTTLE_ROLL_END_FRAC = 0.05
/**
 * Entry Y as a fraction down the cream-text box (1 = bottom edge).
 * Higher = farther below the advisory-lab copy.
 */
const CREAM_BOTTLE_ENTER_TEXT_FRAC = 1.55
/** Ease on horizontal travel — >1 keeps it right longer, then eases into center. */
const CREAM_BOTTLE_CENTER_EASE = 1.45
/** Extra scroll (vh) after park before the ramp exit begins. */
const CREAM_BOTTLE_RAMP_HOLD_VH = 0.08
/** Scroll span (vh) for tilt + slide off the WWTP ramp. */
const CREAM_BOTTLE_RAMP_SLIDE_VH = 0.9
/** Final lean onto the ramp (deg, CCW = negative). */
const CREAM_BOTTLE_RAMP_TILT_DEG = -45
/** Ramp slope from horizontal (deg) — down-left toward the tank. */
const CREAM_BOTTLE_RAMP_SLOPE_DEG = 20
/** Fraction of exit progress used to ease into the tilt (rest is slide). */
const CREAM_BOTTLE_RAMP_TILT_FRAC = 0.5
/** Travel distance as a fraction of viewport diagonal. */
const CREAM_BOTTLE_RAMP_DIST_FRAC = 1.05
/**
 * Shift the locked / ramp path up (px, negative = higher on screen) so the
 * bottle rides on top of the WWTP ramp instead of under it.
 */
const CREAM_BOTTLE_RAMP_Y_NUDGE_PX = -56
/** Scroll back above park capture (vh) before sticky/center can run again. */
const CREAM_BOTTLE_UNPARK_VH = 0.2

/**
 * Second WWTP bottle path, in % of the section-5 plate.
 *   X: 0 = left edge, 100 = right edge. >100 is off-right, <0 is off-left.
 *   Y: 0 = top of the plate, 100 = bottom. Higher = lower on the page.
 * Slope is the line between these two points — no separate angle to set.
 */
const RAMP2_START_X_PCT = 112
const RAMP2_START_Y_PCT = 15
const RAMP2_END_X_PCT = -14
const RAMP2_END_Y_PCT = 28.5
/**
 * When ramp 2 starts, as a fraction of bottle 1's slide (0 = bottle 1 just
 * leaves the park, 1 = bottle 1 is fully off the left edge).
 */
const RAMP2_ARM_AT = 0.28
/** Scroll span (see artScrollSpan) for the start → end traversal. Larger = slower. */
const RAMP2_SLIDE_VH = 0.9

/**
 * Section-5 chute bottle (stage 5): starts inside the WWTP pipe (behind layer
 * 7, in front of layer 6 so the pipe masks it), slides the water column at a
 * constant size, slams the pool (stretch/squash), then keeps scrolling with
 * the plate like the waterfall bottle. Coordinates are % of the 946×4000 plate.
 */
const CHUTE_SCROLL_VH = 0.72
/** Share of CHUTE_SCROLL_VH after impact over which the bottle eases to the middle column. */
const CHUTE_CENTER_SPAN = 0.7
/** After the splash the bottle sinks down the art at this share of the scroll (1 = stuck to the view). */
const CHUTE_SINK_RATE = 0.85
/** When the pipe mouth is this far down the viewport, progress is 0. */
const CHUTE_ARM_VIEW_Y = 0.46
/** Sandwich: water (7) < chute (8) < WWTP (9) so the pipe masks the bottle. */
const CHUTE_Z = 8
/** Swap to stage 6 once the bottle centroid reaches the fish sprites (~79–82%). */
const CHUTE_STAGE6_Y_PCT = 76.5
/** Foam bob as the bottle squash hits the splash. */
const CHUTE_FOAM_BOB_AT = 0.74
const CHUTE_FOAM_BOB_RESET = 0.6
/** Launch splash droplets as the foam compresses, just before the rebound. */
const CHUTE_SPLASH_LAUNCH_DELAY_MS = 110
const CHUTE_KEYS = [
  { t: 0, x: 40.5, y: 41.2, r: -36, sx: 1, sy: 1 },
  { t: 0.1, x: 43.5, y: 42.4, r: -18, sx: 1, sy: 1 },
  { t: 0.24, x: 48.1, y: 43.2, r: 10, sx: 1, sy: 1 },
  { t: 0.42, x: 53.6, y: 43.55, r: 20, sx: 1, sy: 1 },
  { t: 0.58, x: 55.8, y: 46.35, r: 8, sx: 1, sy: 1 },
  { t: 0.68, x: 57.4, y: 48.85, r: -8, sx: 0.78, sy: 1.2 },
  { t: 0.76, x: 56.8, y: 51.05, r: 16, sx: 1.24, sy: 0.56 },
  { t: 0.86, x: 55.4, y: 52.65, r: -4, sx: 1, sy: 1 },
  { t: 1, x: 54.2, y: 54.2, r: 4, sx: 1, sy: 1 },
]

function chuteLerpKey(a, b, u) {
  const ax = a.sx ?? a.s ?? 1
  const ay = a.sy ?? a.s ?? 1
  const bx = b.sx ?? b.s ?? 1
  const by = b.sy ?? b.s ?? 1
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    r: a.r + (b.r - a.r) * u,
    sx: ax + (bx - ax) * u,
    sy: ay + (by - ay) * u,
  }
}

function chutePoseAt(progress) {
  const t = clamp01(progress)
  const path = CHUTE_KEYS
  if (t <= path[0].t) return chuteLerpKey(path[0], path[0], 0)
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].t) {
      const a = path[i - 1]
      const b = path[i]
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return chuteLerpKey(a, b, u)
    }
  }
  return chuteLerpKey(path[path.length - 1], path[path.length - 1], 0)
}

/** Map linear scroll 0–1 onto path t: ease-in slide, linger on impact, ease-out sink. */
function chuteScrollToPath(p) {
  const t = clamp01(p)
  if (t <= 0.42) {
    const u = t / 0.42
    return 0.7 * (0.75 * u + 0.25 * u * u)
  }
  if (t <= 0.72) {
    const u = (t - 0.42) / 0.3
    return 0.7 + 0.1 * (u * u * (3 - 2 * u))
  }
  const u = (t - 0.72) / 0.28
  return 0.8 + 0.2 * (1 - (1 - u) * (1 - u))
}

const SECTION5_CDN =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/noorine-section-5-layers"

/** Hex field after the reef. Transparent top (~26%) fades into the honeycomb. */
const HEX_FIELD_SRC =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/bg-new-use-this.avif"
/** Plate % where the hex art starts, low enough to cover the bottom of the reef. */
const HEX_FIELD_TOP_PCT = 70.6
/**
 * Width-relative height of the hex image that sticks out past section 5.
 * hexH/W − (1 − topPct) × section5H/W
 */
const HEX_FIELD_BELOW_ASPECT = "1 / 1.417"
/** Hex art row (share of its height) where it turns fully opaque — below the reef. */
const HEX_OPAQUE_FROM = 1202 / 3831
/** Scroll (share of vh) the view holds on the ending bottle while petamons burst. */
const ENDING_HOLD_VH = 1.1

/** Tall underwater plate (946×4000), stacked back → front. */
const SECTION5_LAYERS = [
  { id: 1, file: "1-bg.avif", z: 1, sizer: true },
  { id: 2, file: "2-mid-trench.avif", z: 2 },
  { id: 3, file: "3-fore-trench.avif", z: 3 },
  { id: 4, file: "4-coral-texture.avif", z: 6 },
  { id: 5, file: "5-coral-blend.avif", z: 4 },
  { id: 6, file: "6-water-stream-gush-thing.avif", z: 7 },
  { id: 7, file: "7-wwtp.avif", z: 9 },
]

/** Splash foam — full plate, above scenery + chute bottle, below apps copy. */
const SECTION5_FOAM_SRC =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/bubbles-foam.avif"
const SECTION5_FOAM_Z = 11
/** Painted bubbles sit on the same 946×4000 plate; y% is the sprite centroid. */
const BUBBLE_CDN =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/bubbles"
const FOAM_BARRIER_Y_PCT = 51.2
/** Painted splash blobs on the same 946×4000 plate as the foam. */
const SPLASH_CDN =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/splash"
const SPLASH_Z = 11
/** Bottle squash / pool hit — droplets launch from here. */
const SPLASH_IMPACT = { x: 56.8, y: 50.9 }
/** Plate-% / ms². Positive y is down, so this pulls droplets back into the foam. */
const SPLASH_GRAVITY = 0.000074
/** Horizontal air drag (1/ms) so they fall more down than sideways after the apex. */
const SPLASH_DRAG = 0.00115
/**
 * `crop` is the painted box inside each full-plate sprite (plate %, padded).
 * Only that window is rendered, so the animated layer is a few hundred px
 * instead of a whole 946×4000 plate re-rastered every frame.
 */
const SPLASH_PLATES = [
  {
    id: 1, x: 52.55, y: 49.39, delay: 20, extraRise: 1.15,
    crop: { x: 45.2, y: 48.05, w: 17.4, h: 2.4 },
  },
  {
    id: 2, x: 84.38, y: 43.76, delay: 80, extraRise: 1.85,
    crop: { x: 80.9, y: 43.2, w: 7.5, h: 1.15 },
  },
  {
    id: 3, x: 44.86, y: 47.99, delay: 40, extraRise: 1.45,
    crop: { x: 42.2, y: 47.25, w: 5.2, h: 1.6 },
  },
  {
    id: 4, x: 54.1, y: 50.84, delay: 0, extraRise: 0.75,
    crop: { x: 49.1, y: 50.25, w: 10.4, h: 1.3 },
  },
  {
    id: 5, x: 56.86, y: 48.19, delay: 55, extraRise: 2.15,
    crop: { x: 54.05, y: 46.9, w: 6, h: 2.65 },
  },
]
/** Painted foam box, padded for the impact bob's scale. */
const FOAM_CROP = { x: 27.5, y: 46.4, w: 67.5, h: 8.4 }
/** Foam bob pivot on the plate (was `56% 51%` of the full plate). */
const FOAM_BOB_ORIGIN = { x: 56, y: 51 }

/** Window onto a full-plate sprite; see SPLASH_PLATES. */
function plateCropStyle(crop) {
  return {
    left: `${crop.x}%`,
    top: `${crop.y}%`,
    width: `${crop.w}%`,
    height: `${crop.h}%`,
  }
}

/** Full plate image offset so its `crop` box fills the window. */
function plateCropImgStyle(crop) {
  return {
    width: `${(100 / crop.w) * 100}%`,
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
  }
}

function splashLaunchFor(plate) {
  const rise = Math.max(0.35, SPLASH_IMPACT.y - plate.y) + plate.extraRise
  const vy = -Math.sqrt(Math.max(1e-8, 2 * SPLASH_GRAVITY * rise))
  const tApex = -vy / SPLASH_GRAVITY
  const dragSpan = (1 - Math.exp(-SPLASH_DRAG * tApex)) / SPLASH_DRAG
  const vx = (plate.x - SPLASH_IMPACT.x) / Math.max(1e-3, dragSpan)
  return { ...plate, vx, vy, tApex }
}

const SPLASH_LAUNCHES = SPLASH_PLATES.map(splashLaunchFor)

const BUBBLE_PLATES = {
  1: { x: 30.1, y: 80.4 },
  2: { x: 29.25, y: 78.85 },
  3: { x: 52.4, y: 78.1 },
  4: { x: 57.15, y: 79.1 },
  5: { x: 59.25, y: 77.9 },
  6: { x: 56.15, y: 76.8 },
  7: { x: 50.35, y: 74.3 },
  8: { x: 44.05, y: 74.5 },
  9: { x: 46.6, y: 73.1 },
  10: { x: 73.35, y: 75.8 },
  11: { x: 78.7, y: 76.0 },
  12: { x: 78.6, y: 77.2 },
  13: { x: 82.4, y: 74.35 },
}
/** Idle stream rising to the foam; `x` is the lane across the plate. */
const STREAM_BUBBLES = [
  { id: 1, x: 14 },
  { id: 3, x: 32 },
  { id: 8, x: 50 },
  { id: 10, x: 68 },
  { id: 13, x: 86 },
]
/** Cluster that rides under/around the sinking bottle. */
const COMPANION_BUBBLE_SPECS = [
  { id: 2, ox: -7.4, oy: 0.48, cushion: true, followMs: 520 },
  { id: 4, ox: 0.2, oy: 0.78, cushion: true, followMs: 640 },
  { id: 5, ox: 7.6, oy: 0.4, cushion: true, followMs: 480 },
  { id: 6, ox: -11.2, oy: -1.2, cushion: false, followMs: 360 },
  { id: 7, ox: 11.4, oy: -0.9, cushion: false, followMs: 560 },
  { id: 9, ox: -7.1, oy: 0.05, cushion: false, followMs: 300 },
  { id: 11, ox: 7.3, oy: 0.1, cushion: false, followMs: 440 },
  { id: 12, ox: -2.4, oy: -2.15, cushion: false, followMs: 400 },
]
const COMPANION_DETACH_MS = 3200
const COMPANION_RISE_MS = 2600
/** Plate-% distance at which a follower starts idling at the bottle. */
const COMPANION_ARRIVE_PCT = 0.7

/**
 * Layer 8 — sparse fish sprites near the bottom of the plate. Drift + bob on
 * top of the scenery (below apps copy). Not layer 5 (coral-blend is static).
 */
const SECTION5_FISHES = [
  {
    id: "fishes",
    src: `${SECTION5_CDN}/8-fishes-that-can-move-around.avif`,
    z: 10,
    driftMs: 52000,
    driftDelayMs: 1200,
    hoverDelayMs: 0,
  },
]

const SHORE_BOTTLE_IMG =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/bottle-stages/bottle-w-ripples.avif"

const CONDITION_CARD_IMAGES = [
  {
    src: "https://static.igem.wiki/teams/6187/wiki/homepage-components/condition-cards/ph.avif",
    alt: "pH",
  },
  {
    src: "https://static.igem.wiki/teams/6187/wiki/homepage-components/condition-cards/temp.avif",
    alt: "Temperature",
  },
  {
    src: "https://static.igem.wiki/teams/6187/wiki/homepage-components/condition-cards/surrounding-env.avif",
    alt: "Environment",
  },
]

const RNALAB_TEXTBOX_IMG =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/text-boxes/rnalab.avif"

const RNALAB_EXPLANATION =
  "RNAlab is our advisory lab partner that helped uncover 215.7 million high-quality plastic-degrading enzymes."

/** Delay + slide duration; the RNAlab term is not hoverable until this elapses. */
const RNALAB_REVEAL_MS = 740

/** Jump to the top on mount / HMR. Turn back on before shipping. */
const RESET_SCROLL_ON_MOUNT = false

/** Overlays inside a band (text above bottle). */
const Z = {
  logo: 2,
  bottle: 3,
  water: 4,
  text: 5,
}

/**
 * Shift painting-locked overlays up within the waterfall band (logo + birds stay).
 * Applied to copy, sky bottle, splash, and the sink lip so they stay in step.
 */
const LANDMARK_NUDGE_UP = 0.07

/**
 * Where the bottle sits in the legacy art band (0 = top, 1 = bottom).
 * Anchors into the waterfall rather than the sky.
 */
const BOTTLE_TOP_FRAC = 0.42 - LANDMARK_NUDGE_UP

/** Pixels scroll must move back above the captured TP1 scrollY before bottle unpins. */
const BOTTLE_PIN_SCROLL_UP_LEAVE = 40

/** FLIP duration (ms) for bottle pick-up / put-down when toggling sticky. */
const BOTTLE_FLIP_MS = 580

/** Back layer scroll speed vs foreground (lower = slower / more depth). */
const BACK_PARALLAX_SPEED = 0.7

/**
 * Full-bleed bird flap pairs (same canvas as the back art).
 * `speed` is parallax vs scroll (between back and foreground).
 * `flapMs` is one full A↔B cycle.
 */
const BIRDS = [
  {
    id: 1,
    a: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-1.avif",
    b: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-1-2.avif",
    speed: 0.82,
    flapMs: 980,
    delayMs: 0,
    depth: "back",
    driftMs: 32000,
    driftDelayMs: 2000,
  },
  {
    id: 2,
    a: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-2.avif",
    b: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-2-2.avif",
    speed: 0.88,
    flapMs: 480,
    delayMs: 140,
    depth: "front",
    z: 4,
  },
  {
    id: 3,
    a: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-3.avif",
    b: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-3-2.avif",
    speed: 0.78,
    flapMs: 1100,
    delayMs: 240,
    depth: "back",
    driftMs: 40000,
    driftDelayMs: 8000,
  },
  {
    id: 4,
    a: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-4.avif",
    b: "https://static.igem.wiki/teams/6187/wiki/homepage-components/birds/wiki-front-page-bird-4-2.avif",
    speed: 0.92,
    flapMs: 520,
    delayMs: 80,
    depth: "front",
  },
]

/**
 * Fraction of the waterfall band height where the puddle / ripple sits.
 * Tune against the unified front plate (lip ≈ 1380/4000).
 */
const WATER_RIPPLE_FRAC = 0.98 - LANDMARK_NUDGE_UP - 0.06

/**
 * Visible bottle band as a fraction of its layer height.
 * Higher fracs = fade finishes sooner (before deep water / shore overlap).
 */
const BOTTLE_SUBMERGE_TOP_FRAC = 0.45
const BOTTLE_SUBMERGE_BOT_FRAC = 0.5
/** Extra downward slide (px) as the bottle fades under the water. */
const BOTTLE_SINK_SLIDE_PX = 36
/** CSS splash duration (ms) when the bottle hits the water. */
const BOTTLE_SPLASH_MS = 920
/** Fire splash once the bottle is mostly faded (after fade starts, before full hide). */
const BOTTLE_SPLASH_TRIGGER_OPACITY = 0.35
/**
 * Shore-approach fade: start clearing the pinned sky bottle before the shore
 * enters the viewport so it never overlaps the second art section.
 * Values are shore-top as a fraction of viewport height.
 */
const BOTTLE_SHORE_FADE_START_VH = 0.75
const BOTTLE_SHORE_FADE_END_VH = 0.73
/** Splash anchor on the first (waterfall) art band — puddle / river start. */
const WATERFALL_SPLASH_TOP_PCT = 92 - LANDMARK_NUDGE_UP * 100 - 6
const WATERFALL_SPLASH_LEFT_PCT = 50
/** Opaque blob top in wiki-front-water.png (px 2235 / 2440). Shift so it sits on the splash lip. */
const PUDDLE_ART_TOP_FRAC = 2235 / 2440
const PUDDLE_SHIFT_Y_PCT =
  (PUDDLE_ART_TOP_FRAC - WATERFALL_SPLASH_TOP_PCT / 100) * -100
/** Second puddle copy, extra % of the waterfall band downward so the bottle cannot peek under the lip. */
const PUDDLE_UNDER_SHIFT_PCT = 4.5

/**
 * Shore-bottle rematch (section1). Same river path as before, but the drift
 * pauses at three evenly spaced checkpoints until the bottle sits above the
 * viewport midpoint — so it cannot float past the reader on its own.
 */
/** Shore top below this fraction of vh → start the drift (appear as shore peeks in). */
const SHORE_BOTTLE_TRIGGER_FRAC = 1.02
/** Shore top above this → reset so the drift can replay on the next pass. */
const SHORE_BOTTLE_RESET_FRAC = 1.08
/**
 * Travel time (ms) for the path at the 1440px-wide art; pauses at gates are
 * extra. Scaled with the art width so the on-screen speed is the same on
 * narrower views (never below SHORE_BOTTLE_DRIFT_MIN_SCALE of it).
 */
const SHORE_BOTTLE_DRIFT_MS = 8000
const SHORE_BOTTLE_DRIFT_MIN_SCALE = 0.5
/** Sky bottle treated as sunk once fade opacity drops below this. */
const SHORE_BOTTLE_SUNK_OPACITY = 0.2
/**
 * Waypoints as fractions of the drift (left/top % of the shore band).
 * Matches the old CSS keyframe path.
 */
const SHORE_BOTTLE_PATH = [
  { t: 0, left: 104, top: 10, opacity: 0 },
  { t: 0.04, left: 102, top: 14, opacity: 1 },
  { t: 0.45, left: 96, top: 42, opacity: 1 },
  { t: 0.68, left: 90, top: 64, opacity: 1 },
  { t: 0.82, left: 58, top: 74, opacity: 1 },
  { t: 1, left: -16, top: 82, opacity: 1 },
]
/** Pause the drift here until the bottle is above the viewport midpoint. */
const SHORE_BOTTLE_GATES = [0.25, 0.5, 0.75]
/** Bottle centroid must be above this fraction of the viewport to clear a gate. */
const SHORE_BOTTLE_GATE_VIEW_Y = 0.5

function shoreBottlePoseAt(progress) {
  const t = clamp01(progress)
  const path = SHORE_BOTTLE_PATH
  if (t <= path[0].t) return path[0]
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].t) {
      const a = path[i - 1]
      const b = path[i]
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return {
        left: a.left + (b.left - a.left) * u,
        top: a.top + (b.top - a.top) * u,
        opacity: a.opacity + (b.opacity - a.opacity) * u,
      }
    }
  }
  return path[path.length - 1]
}

const CRAB_CDN =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/section-2-animals"

/**
 * Section-2 crabs (shore / sand). Each pair is a full transparent plate
 * (2238×3132) with the crab painted in place — same flip idea as the birds.
 * Overlay is full-bleed on the shore band from the top; `xPct` / `yPct` are
 * extra translates (% of that plate) if you need to nudge one.
 *
 * Painted spots on the plate (left%, top% = bbox; also centroid):
 *   a  left 64.4  top 6.9   (centroid 68.5, 10.4)  — upper-right sand
 *   b  left 76.6  top 11.2  (centroid 79.5, 13.4)  — further right, a bit lower
 *   c  left 30.4  top 81.4  (centroid 36.4, 86.1)  — lower-left sand
 */
const CRABS = [
  {
    id: "a",
    a: `${CRAB_CDN}/crab-section-2-a.avif`,
    b: `${CRAB_CDN}/crab-section-2-a-2.avif`,
    xPct: -10,
    yPct: 12,
    originX: 68.5,
    originY: 10.4,
    flapMs: 860,
    delayMs: 0,
  },
  {
    id: "b",
    a: `${CRAB_CDN}/crab-section-2-b.avif`,
    b: `${CRAB_CDN}/crab-section-2-b-2.avif`,
    xPct: -50,
    yPct: 30,
    originX: 79.5,
    originY: 13.4,
    flapMs: 640,
    delayMs: 180,
  },
  {
    id: "c",
    a: `${CRAB_CDN}/crab-section-2-c.avif`,
    b: `${CRAB_CDN}/crab-section-2-c-2.avif`,
    xPct: 0,
    yPct: 0,
    originX: 36.4,
    originY: 86.1,
    flapMs: 980,
    delayMs: 320,
  },
]

const SECTION3_CDN =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/section-3-animals"

/**
 * Section-3 animals (under the map, above the bushes). Same 2238×3132 plates
 * and a↔a-2 flip as the shore crabs. Overlay is full-bleed from the forest
 * band top; `xPct` / `yPct` nudge (% of the plate).
 *
 * Painted spots (bbox left%, top% / centroid):
 *   background-axolotl  25.2, 67.0  (49.6, 71.3)  — wide mid-bottom, static
 *   axolotl             80.3, 64.2  (87.2, 68.4)  — lower right
 *   bird-a              69.1, 34.9  (72.7, 37.5)  — upper right
 *   bird-b              33.3, 33.7  (35.9, 36.3)  — upper left
 *   crab-a              24.5, 53.4  (26.5, 54.4)  — mid left
 *   crab-b              17.9, 69.4  (20.1, 70.9)  — lower left
 *   crab-c              77.3, 72.3  (79.5, 74.0)  — lower right
 */
const SECTION3_ANIMALS = [
  {
    id: "background-axolotl",
    static: true,
    src: `${SECTION3_CDN}/section-3-background-axolotl.avif`,
    xPct: 0,
    yPct: 10,
    revealOnArrive: true,
  },
  {
    id: "axolotl",
    a: `${SECTION3_CDN}/section-3-axolotl.avif`,
    b: `${SECTION3_CDN}/section-3-axolotl-2.avif`,
    xPct: 1,
    yPct: 10,
    flapMs: 1100,
    delayMs: 80,
    revealOnArrive: true,
  },
  {
    id: "bird-a",
    a: `${SECTION3_CDN}/section-3-bird-a.avif`,
    b: `${SECTION3_CDN}/section-3-bird-a-2.avif`,
    xPct: 10,
    yPct: 0,
    scale: 1.32,
    originX: 72.7,
    originY: 37.5,
    hover: true,
    /** Empty transparent column on the right of the plate — drop it so scale doesn't widen the page. */
    clipRightPct: 24,
    flapMs: 480,
    delayMs: 40,
  },
  {
    id: "bird-b",
    a: `${SECTION3_CDN}/section-3-bird-b.avif`,
    b: `${SECTION3_CDN}/section-3-bird-b-2.avif`,
    xPct: -15,
    yPct: 10,
    scale: 1.32,
    originX: 35.9,
    originY: 36.3,
    hover: true,
    flapMs: 720,
    delayMs: 160,
  },
  {
    id: "crab-a",
    a: `${SECTION3_CDN}/section-3-crab-a.avif`,
    b: `${SECTION3_CDN}/section-3-crab-a-2.avif`,
    xPct: -23,
    yPct: 25,
    originX: 26.5,
    originY: 54.4,
    flapMs: 820,
    delayMs: 0,
    revealOnArrive: true,
  },
  {
    id: "crab-b",
    a: `${SECTION3_CDN}/section-3-crab-b.avif`,
    b: `${SECTION3_CDN}/section-3-crab-b-2.avif`,
    xPct: -1,
    yPct: -8,
    originX: 20.1,
    originY: 70.9,
    flapMs: 700,
    delayMs: 220,
    revealOnArrive: true,
  },
  {
    id: "crab-c",
    a: `${SECTION3_CDN}/section-3-crab-c.avif`,
    b: `${SECTION3_CDN}/section-3-crab-c-2.avif`,
    xPct: 0,
    yPct: -10,
    originX: 79.5,
    originY: 74.0,
    flapMs: 940,
    delayMs: 360,
    revealOnArrive: true,
  },
]

/**
 * Section-3 human plate (2238×3132, same overlay as the forest animals).
 * Above the painting + animals, under the bush layer. Tweak `xPct` / `yPct`.
 * Painted bbox ≈ left 31.2% top 17% (centroid 61.5, 51.2).
 */
const HUMAN = {
  src: "https://static.igem.wiki/teams/6187/wiki/homepage-components/human/human-1.avif",
  srcArrived:
    "https://static.igem.wiki/teams/6187/wiki/homepage-components/human/human-2.avif",
  xPct: 20,
  yPct: 33,
  scale: 0.47,
  originX: 61.5,
  originY: 51.2,
}

/** Extra in-flow scroll while the forest frame is sticky; maps to walk progress. */
const WALK_TRACK_VH = 120
/**
 * Freeze after pose 2 + bang. Long enough to read the RNAlab reveal and scrub
 * the bird-steal beat before the forest unpins.
 */
const WALK_HOLD_VH = 300
/** Keep the figure centroid at this viewport Y while the forest is frozen. */
const HUMAN_PIN_VIEW_Y = 0.68
/**
 * Stop the figure centroid at this fraction of viewport width (was 0.5).
 * Just left of center so the RNAlab copy has room on his right.
 */
const HUMAN_PIN_VIEW_X = 0.43

/**
 * Bird steal beat, scrubbed by scroll through the arrival hold (0–1):
 * the rightmost forest bird swoops to the parked bottle, grabs it, and carries
 * it off frame. Windows are fractions of the hold.
 */
const STEAL_BIRD_ID = "bird-a"
const STEAL_APPROACH_START = 0.12
const STEAL_GRAB_AT = 0.54
const STEAL_EXIT_END = 0.97
/**
 * The bird's perch sits above the pinned viewport, so the flight starts just
 * off the top-right edge instead (fractions of the viewport).
 */
const STEAL_ENTRY_X_FRAC = 0.92
const STEAL_ENTRY_Y_FRAC = -0.12
/**
 * Dive bow (positive = dips below the straight line, so the bird drops into
 * frame early instead of skimming above it) and exit vector, as fractions of
 * the painting width. Exit runs up and to the left, away from the walker.
 */
const STEAL_ARC_FRAC = 0.07
const STEAL_EXIT_DX_FRAC = -0.28
const STEAL_EXIT_DY_FRAC = -0.38
/**
 * The bird dives all the way onto the bottle now that it lies in the leaves,
 * so it only rides a hair above the bottle at the grab.
 */
const STEAL_GRAB_LIFT_FRAC = 0.015
/**
 * The bottle trails this far behind the bird along the exit path, so the bird
 * climbs out of the bushes first and the bottle swings up after it.
 */
const STEAL_CARRY_LAG = 0.16
/** Fraction of the exit spent fading the bird + carried bottle out. */
const STEAL_FADE_FROM = 0.72
/** Hold fraction over which the "dataset of 200" line clears for the reveal. */
const STEAL_DATASET_FADE = 0.09

const STEAL_BIRD =
  SECTION3_ANIMALS.find(animal => animal.id === STEAL_BIRD_ID) || null

const clamp01 = v => Math.max(0, Math.min(1, v))

/**
 * Scroll length for a bottle following a painted path. `share` is tuned as a
 * share of a 900px-tall view at the 1440px-wide art; the length then scales
 * with the art (not the window height), so on narrow/tall windows the bottle
 * keeps pace with the painting instead of falling behind it.
 */
const artScrollSpan = (share, artW) =>
  Math.max(1, share * 900 * (artW / ART_REF_W))
const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2
const smoothstep = t => t * t * (3 - 2 * t)
/** Human / animal overlay plates are 2238×3132. */
const OVERLAY_PLATE_ASPECT = 3132 / 2238
/** Head on the human plate (%), for placing the bang behind it. */
const HUMAN_HEAD_X = 61.5
const HUMAN_HEAD_Y = 22
/** Bang centroid on the full-size exclamation plate (%). */
const EXCLAMATION_MARK_X = 55
const EXCLAMATION_MARK_Y = 30
const EXCLAMATION_SRC =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/human/exclamation.avif"

/** Sidestep distance (% of the overlay plate) and lean (deg) per hover scuttle. */
const CRAB_SCUTTLE_X_PCT = 4.5
const CRAB_SCUTTLE_THETA_DEG = 16
const CRAB_SCUTTLE_MS = 480

/**
 * Hover scuttle: first enter sidesteps left, the next right, then left again.
 * Rotation is about the plate normal (CSS rotate / z) from +θ to −θ while moving.
 */
function CrabScuttle({ originX = 50, originY = 50, label = "Crab", children }) {
  const [homeX, setHomeX] = useState(0)
  const [dir, setDir] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const busyRef = useRef(false)

  const onEnter = () => {
    if (busyRef.current) return
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      setHomeX(x => x + dir * CRAB_SCUTTLE_X_PCT)
      setDir(d => -d)
      return
    }
    busyRef.current = true
    setPlaying(true)
  }

  const onAnimEnd = event => {
    if (event.target !== event.currentTarget) return
    setHomeX(x => x + dir * CRAB_SCUTTLE_X_PCT)
    setDir(d => -d)
    setPlaying(false)
    busyRef.current = false
  }

  return (
    <CrabScuttleShell $homeX={homeX} $ox={originX} $oy={originY}>
      <CrabScuttleMotion
        $playing={playing}
        $dir={dir}
        $ox={originX}
        $oy={originY}
        onAnimationEnd={onAnimEnd}
      >
        {children}
        <CrabHitPad
          type="button"
          aria-label={label}
          $ox={originX}
          $oy={originY}
          onMouseEnter={onEnter}
        />
      </CrabScuttleMotion>
    </CrabScuttleShell>
  )
}

/**
 * Full-page wiki front compositing: Toronto parallax behind one tall front plate.
 *
 * Site nav uses scroll-driven `position: fixed` while the mockup is on-screen.
 *
 * Bottle touchpoints: (1) when the bottle midpoint crosses the viewport middle, capture scrollY
 * and pin the bottle centered; (2) stay pinned through the bottom of the page so it does not
 * vanish. Unpin only when the user scrolls back up past TP1 (`scrollY` below that capture minus slack).
 */
export function HomeScrollPrototype() {
  const stackRef = useRef(null)
  const bottleTouchRef = useRef(null)
  const bottleFlipRef = useRef(null)
  const bottleTouchPinnedRef = useRef(false)
  const bottlePinEnterScrollYRef = useRef(null)
  const flipUnpinFirstRef = useRef(null)
  const flipPinFirstRef = useRef(null)
  const flipCleanupRef = useRef(null)
  const parallaxBackRef = useRef(null)
  const birdParallaxRefs = useRef([])
  const waterRef = useRef(null)
  const shoreRef = useRef(null)
  const mapBottleBandRef = useRef(null)
  const mapBottleMountRef = useRef(null)
  const mapBottleImgRef = useRef(null)
  const mapBottleInForestRef = useRef(false)
  /** Band progress when forest walk begins — ease from here to the crab hold. */
  const mapBottleWalkStartPRef = useRef(null)
  const creamPadTextRef = useRef(null)
  const section5RootRef = useRef(null)
  const section5LeadRef = useRef(null)
  const creamBottleMountRef = useRef(null)
  const creamBottleParkedRef = useRef(false)
  /** scrollY when the bottle first parks under the apps lead. */
  const creamBottleParkScrollYRef = useRef(null)
  /** Document Y (scrollY + viewport top) frozen at lock — scrolls with the art. */
  const creamBottleParkDocYRef = useRef(null)
  const ramp2BottleMountRef = useRef(null)
  /** scrollY when ramp-2 bottle activates (first bottle fully exited). */
  const ramp2StartScrollYRef = useRef(null)
  const chuteBottleMountRef = useRef(null)
  const chuteBottleImgRef = useRef(null)
  const chuteBottleStage6Ref = useRef(false)
  const frontRootRef = useRef(null)
  const endingHoldTrackRef = useRef(null)
  const endingHoldStickyRef = useRef(null)
  const endingHoldSpacerRef = useRef(null)
  const hexOverlapRef = useRef(null)
  const endingSlotRef = useRef(null)
  const endingBottleRef = useRef(null)
  const endingReleasedRef = useRef(false)
  const section5FoamRef = useRef(null)
  const section5SplashLayerRef = useRef(null)
  const chuteFoamBobPlayedRef = useRef(false)
  const startChuteSplashRef = useRef(() => {})
  const resetChuteSplashRef = useRef(() => {})
  const companionBubbleLayerRef = useRef(null)
  const companionBubbleLastTsRef = useRef(0)
  const companionLastScrollYRef = useRef(0)
  const companionScrollActRef = useRef(0)
  const companionBubbleStateRef = useRef(
    COMPANION_BUBBLE_SPECS.map((spec, i) => ({
      ...spec,
      mode: "follow",
      x: null,
      y: null,
      arrived: false,
      riseT: 0,
      fromX: 0,
      fromY: 0,
      driftX: (i % 2 === 0 ? 1 : -1) * (1.15 + (i % 3) * 0.35),
      cooldown: 2200 + i * 1500,
      phase: i * 0.85,
      spawnT: 0,
    })),
  )
  const walkTrackRef = useRef(null)
  const compositionRef = useRef(null)
  const humanWalkRef = useRef(null)
  const humanBobRef = useRef(null)
  const forestDatasetRef = useRef(null)
  const birdStealRef = useRef(null)
  /** Last steal progress (0–1); persists past unpin so the bottle stays stolen. */
  const birdStealPRef = useRef(0)
  const walkArrivedRef = useRef(false)
  const walkLatchedRef = useRef(false)
  const walkReleasedRef = useRef(false)
  const shoreBottlePlayedRef = useRef(false)
  const shoreBottleMountRef = useRef(null)
  const shoreBottleProgressRef = useRef(0)
  const shoreBottleGateRef = useRef(0)
  /** True after the sky bottle finishes its waterfall sink (near-bottom unpin). */
  const skyBottleHasSunkRef = useRef(false)
  /** Keep the overlay bottle hidden after sink so it cannot reappear through the fall. */
  const skyBottleHiddenRef = useRef(false)
  /** Splash plays once per sink; reset when the sky bottle is restored. */
  const splashPlayedRef = useRef(false)
  const bottleSinkMotionRef = useRef(null)
  const bottleVisualRef = useRef(null)
  const [logoLanded, setLogoLanded] = useState(false)
  const heroLogoRef = useRef(null)
  const [navPinned, setNavPinned] = useState(false)
  const [bottleTouchPinned, setBottleTouchPinned] = useState(false)
  const [shoreBottlePlaying, setShoreBottlePlaying] = useState(false)
  const [splashPlaying, setSplashPlaying] = useState(false)
  const [walkArrived, setWalkArrived] = useState(false)
  const [rnalabInteractive, setRnalabInteractive] = useState(false)
  const reduceMotionParallaxRef = useRef(false)

  bottleTouchPinnedRef.current = bottleTouchPinned

  // Copy sizes (artPx) track the painted art's width, not the viewport's.
  useLayoutEffect(() => {
    const root = frontRootRef.current
    const art = compositionRef.current
    if (!root || !art) return undefined
    const sync = () => {
      root.style.setProperty(ART_WIDTH_VAR, `${art.getBoundingClientRect().width}px`)
    }
    sync()
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", sync)
      return () => window.removeEventListener("resize", sync)
    }
    const ro = new ResizeObserver(sync)
    ro.observe(art)
    return () => ro.disconnect()
  }, [])

  // Loader → hero handoff: the loader's logo springs into the hero's painted
  // logo box, then the hero loop resumes from the loader's frozen frame.
  const logoHandoff = useCallback(
    () => ({
      getRect: () => {
        const el = heroLogoRef.current
        if (!el) return null
        const r = el.getBoundingClientRect()
        const sx = r.width / LOGO_PLATE.w
        const sy = r.height / LOGO_PLATE.h
        return {
          left: r.left + LOGO_BOX.x * sx,
          top: r.top + LOGO_BOX.y * sy,
          width: LOGO_BOX.w * sx,
          height: LOGO_BOX.h * sy,
          bottom: r.top + (LOGO_BOX.y + LOGO_BOX.h) * sy,
        }
      },
      onLand: phaseMs => {
        heroLogoRef.current?.querySelectorAll("img").forEach(img => {
          img.style.animation = "none"
          void img.offsetWidth
          img.style.animation = ""
          img.style.animationDelay = `-${Math.round(phaseMs)}ms`
        })
        setLogoLanded(true)
      },
    }),
    [],
  )

  // RNAlab highlight is inert until the slide/fade-in has finished.
  useEffect(() => {
    if (!walkArrived) {
      setRnalabInteractive(false)
      return undefined
    }
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const delay = reduce ? 0 : RNALAB_REVEAL_MS
    const t = window.setTimeout(() => setRnalabInteractive(true), delay)
    return () => window.clearTimeout(t)
  }, [walkArrived])

  const applyBottleSinkVisual = useCallback(opacity => {
    const visual = bottleVisualRef.current
    const sink = bottleSinkMotionRef.current
    const op = Math.max(0, Math.min(1, opacity))
    if (visual) {
      visual.style.opacity = String(op)
    }
    if (sink) {
      const slide = (1 - op) * BOTTLE_SINK_SLIDE_PX
      sink.style.transform = slide > 0.1 ? `translate3d(0, ${slide}px, 0)` : ""
    }
  }, [])

  const triggerBottleSplash = useCallback(() => {
    if (splashPlayedRef.current) return
    splashPlayedRef.current = true
    setSplashPlaying(true)
  }, [])

  const hideSkyBottle = useCallback(() => {
    skyBottleHasSunkRef.current = true
    skyBottleHiddenRef.current = true
    applyBottleSinkVisual(0)
    triggerBottleSplash()
  }, [applyBottleSinkVisual, triggerBottleSplash])

  const restoreSkyBottle = useCallback(() => {
    skyBottleHasSunkRef.current = false
    skyBottleHiddenRef.current = false
    splashPlayedRef.current = false
    setSplashPlaying(false)
    applyBottleSinkVisual(1)
  }, [applyBottleSinkVisual])

  // Reset scroll before paint so a restored mid-page scroll cannot flash a pinned/sunk bottle.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    if (!RESET_SCROLL_ON_MOUNT) return
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
    window.scrollTo(0, 0)
    skyBottleHasSunkRef.current = false
    skyBottleHiddenRef.current = false
    splashPlayedRef.current = false
    bottleTouchPinnedRef.current = false
    bottlePinEnterScrollYRef.current = null
    applyBottleSinkVisual(1)
  }, [applyBottleSinkVisual])

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => {
      reduceMotionParallaxRef.current = mq.matches
      if (mq.matches) {
        if (parallaxBackRef.current) {
          parallaxBackRef.current.style.transform = "translate3d(0, 0, 0)"
          parallaxBackRef.current.style.willChange = "auto"
        }
        birdParallaxRefs.current.forEach(el => {
          if (!el) return
          el.style.transform = "translate3d(0, 0, 0)"
          el.style.willChange = "auto"
        })
      }
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useLayoutEffect(() => {
    const tick = () => {
      const stack = stackRef.current
      const bottleSpot = bottleTouchRef.current
      const y = window.scrollY

      // Use ScrollStack bottom to know where the mockup section is in the viewport
      const stackBottom = stack
        ? stack.getBoundingClientRect().bottom
        : window.innerHeight

      // Release the bottle when the ScrollStack bottom crosses 45% of viewport height
      const UNPIN_THRESHOLD = window.innerHeight * 0.45
      const nearBottom = stackBottom <= UNPIN_THRESHOLD

      if (bottleTouchPinnedRef.current && nearBottom) {
        const flip = bottleFlipRef.current
        if (flip) flipUnpinFirstRef.current = flip.getBoundingClientRect()
        else flipUnpinFirstRef.current = null
        hideSkyBottle()
        bottleTouchPinnedRef.current = false
        bottlePinEnterScrollYRef.current = null
        setBottleTouchPinned(false)
        // Fall through — still run parallax / shore rematch this frame.
      }

      if (stack) {
        const rect = stack.getBoundingClientRect()
        setNavPinned(rect.top < 0 && rect.bottom > 0)
      }

      const painting = compositionRef.current
      const track = walkTrackRef.current
      const walker = humanWalkRef.current
      const reduceWalk = reduceMotionParallaxRef.current
      const walkPx = reduceWalk ? 0 : window.innerHeight * (WALK_TRACK_VH / 100)
      const holdPx =
        reduceWalk || walkPx <= 0
          ? 0
          : window.innerHeight * (WALK_HOLD_VH / 100)
      const freezePx = walkPx + holdPx
      let walkProgress = 0
      /** Scroll through the arrival hold (0–1) — drives the bird steal. */
      let stealProgress = 0
      /** Offset + fade the bottle inherits once the bird has grabbed it. */
      let stealCarryDx = 0
      let stealCarryDy = 0
      let stealCarryFade = 1

      if (painting) {
        const artH = painting.offsetHeight
        const artW = painting.offsetWidth
        const plateH = artW * OVERLAY_PLATE_ASPECT
        const humanOriginY =
          FOREST_BAND_TOP * artH + ((HUMAN.originY + HUMAN.yPct) / 100) * plateH
        const forestPinY = Math.max(
          0,
          humanOriginY - window.innerHeight * HUMAN_PIN_VIEW_Y,
        )
        if (reduceWalk || freezePx <= 0) {
          if (track) {
            track.style.height = ""
            track.style.paddingBottom = "0px"
          }
          painting.style.position = "relative"
          painting.style.top = "0px"
          painting.style.left = ""
          painting.style.width = ""
        } else if (track) {
          track.style.paddingBottom = "0px"
          if (walkReleasedRef.current) {
            // The whole beat ran to completion before unpin — keep it that way,
            // so scrolling back up here is just an ordinary scroll.
            walkProgress = 1
            walkLatchedRef.current = true
            stealProgress = birdStealPRef.current
            track.style.height = `${artH}px`
            painting.style.position = "relative"
            painting.style.top = "0px"
            painting.style.left = ""
            painting.style.width = ""
          } else {
            track.style.height = `${artH + freezePx}px`
            const trackDocTop = track.getBoundingClientRect().top + y
            const pinAt = trackDocTop + forestPinY
            walkProgress = Math.max(
              0,
              Math.min(1, (y - pinAt) / Math.max(1, walkPx)),
            )
            // Tracks the scroll in both directions: backing out of the pin
            // before the beat is spent rewinds the walk, the reveal, and the
            // steal. Only clearing the pin entirely (below) locks it in.
            walkLatchedRef.current = walkProgress >= 0.995
            stealProgress =
              holdPx > 0
                ? clamp01((y - (pinAt + walkPx)) / holdPx)
                : 0
            birdStealPRef.current = stealProgress
            painting.style.left = "0px"
            painting.style.width = "100%"
            if (walkLatchedRef.current && y > pinAt + freezePx) {
              walkReleasedRef.current = true
              window.scrollTo({
                top: y - freezePx,
                left: 0,
                behavior: "instant",
              })
              track.style.height = `${artH}px`
              painting.style.position = "relative"
              painting.style.top = "0px"
              painting.style.left = ""
              painting.style.width = ""
            } else if (y < pinAt) {
              painting.style.position = "absolute"
              painting.style.top = "0px"
            } else if (y <= pinAt + freezePx) {
              painting.style.position = "fixed"
              painting.style.top = `${-forestPinY}px`
            } else {
              painting.style.position = "absolute"
              painting.style.top = `${freezePx}px`
            }
          }
        }
        if (walker) {
          const latched = walkLatchedRef.current
          const p = latched ? 1 : walkProgress
          const paintingLeft = painting.getBoundingClientRect().left
          const startX =
            ((HUMAN.originX + HUMAN.xPct) / 100) * painting.offsetWidth
          const extraXMax =
            window.innerWidth * HUMAN_PIN_VIEW_X - (paintingLeft + startX)
          const extraX = extraXMax * p
          walker.style.transform = extraX
            ? `translate3d(${extraX}px, 0, 0)`
            : ""
          walker.style.willChange =
            !latched && p > 0 && p < 1 ? "transform" : "auto"
          if (humanBobRef.current) {
            humanBobRef.current.dataset.walking =
              !latched && walkProgress > 0.02 && walkProgress < 0.995 ? "1" : ""
          }
          if (forestDatasetRef.current) {
            // Clears as the bang lands so the RNAlab line can take its place.
            const datasetFade = latched
              ? 1 - clamp01(stealProgress / STEAL_DATASET_FADE)
              : walkProgress
            forestDatasetRef.current.style.opacity = reduceWalk
              ? "1"
              : String(datasetFade)
          }
          if (latched !== walkArrivedRef.current) {
            walkArrivedRef.current = latched
            setWalkArrived(latched)
          }
        }

        // Bird steal: swoop from the perch to the parked bottle, then carry it
        // off frame. Both paths are painting-local so they track any art width.
        const stealBird = birdStealRef.current
        if (stealBird && STEAL_BIRD) {
          if (reduceWalk || stealProgress <= 0) {
            stealBird.style.transform = ""
            stealBird.style.opacity = ""
            stealBird.style.willChange = "auto"
          } else {
            const birdX =
              ((STEAL_BIRD.originX + STEAL_BIRD.xPct) / 100) * artW
            const birdY =
              FOREST_BAND_TOP * artH +
              ((STEAL_BIRD.originY + STEAL_BIRD.yPct) / 100) * plateH
            const bottleX = (MAP_BOTTLE_LEFT_REST / 100) * artW
            const bottleY =
              MAP_BOTTLE_BAND_TOP * artH +
              (MAP_BOTTLE_TOP_BUSH / 100) * (MAP_BOTTLE_BAND_HEIGHT * artH)

            const approach = smoothstep(
              clamp01(
                (stealProgress - STEAL_APPROACH_START) /
                  Math.max(1e-6, STEAL_GRAB_AT - STEAL_APPROACH_START),
              ),
            )
            const rawExit = clamp01(
              (stealProgress - STEAL_GRAB_AT) /
                Math.max(1e-6, STEAL_EXIT_END - STEAL_GRAB_AT),
            )
            const exit = smoothstep(rawExit)
            const carryExit = smoothstep(
              clamp01(
                (rawExit - STEAL_CARRY_LAG) /
                  Math.max(1e-6, 1 - STEAL_CARRY_LAG),
              ),
            )
            const exitDx = STEAL_EXIT_DX_FRAC * artW
            const exitDy = STEAL_EXIT_DY_FRAC * artW
            const fadeFor = e =>
              1 -
              clamp01(
                (e - STEAL_FADE_FROM) / Math.max(1e-6, 1 - STEAL_FADE_FROM),
              )
            const fade = fadeFor(exit)

            // Screen-space path: off-frame top-right → bottle → off-frame again.
            const paintRect = painting.getBoundingClientRect()
            const restX = paintRect.left + birdX
            const restY = paintRect.top + birdY
            const entryX = window.innerWidth * STEAL_ENTRY_X_FRAC
            const entryY = window.innerHeight * STEAL_ENTRY_Y_FRAC
            const grabX = paintRect.left + bottleX
            const grabY =
              paintRect.top + bottleY - STEAL_GRAB_LIFT_FRAC * artW

            const dx =
              entryX + (grabX - entryX) * approach - restX + exitDx * exit
            const dy =
              entryY +
              (grabY - entryY) * approach +
              STEAL_ARC_FRAC * artW * Math.sin(Math.PI * approach) -
              restY +
              exitDy * exit

            stealBird.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
            stealBird.style.opacity = String(fade)
            stealBird.style.willChange =
              exit < 1 ? "transform, opacity" : "auto"

            // Bottle rides along only once grabbed, trailing the bird.
            stealCarryDx = exitDx * carryExit
            stealCarryDy = exitDy * carryExit
            stealCarryFade = fadeFor(carryExit)
          }
        }
      }

      const paintingRect = painting ? painting.getBoundingClientRect() : null
      if (painting && paintingRect) {
        const scrolledInto = Math.max(0, -paintingRect.top)
        const offset = reduceMotionParallaxRef.current
          ? 0
          : scrolledInto * (1 - BACK_PARALLAX_SPEED)
        if (parallaxBackRef.current) {
          parallaxBackRef.current.style.transform = `translate3d(0, ${offset}px, 0)`
          parallaxBackRef.current.style.willChange =
            offset > 0 ? "transform" : "auto"
        }
        BIRDS.forEach((bird, i) => {
          const el = birdParallaxRefs.current[i]
          if (!el) return
          const birdOffset = reduceMotionParallaxRef.current
            ? 0
            : scrolledInto * (1 - bird.speed)
          el.style.transform = `translate3d(0, ${birdOffset}px, 0)`
          el.style.willChange = birdOffset > 0 ? "transform" : "auto"
        })
      }

      // Water surface (ripple) viewport position — the "barrier" the bottle sinks behind.
      const water = waterRef.current
      let rippleY = null
      if (water) {
        const wr = water.getBoundingClientRect()
        rippleY = wr.top + wr.height * WATER_RIPPLE_FRAC
      }

      // Clear the sky bottle before the shore (2nd section) overlaps the pinned bottle.
      let shoreApproachOp = 1
      const shoreEl = shoreRef.current
      if (shoreEl) {
        const shoreTop = shoreEl.getBoundingClientRect().top
        const vh = window.innerHeight
        const fadeStart = vh * BOTTLE_SHORE_FADE_START_VH
        const fadeEnd = vh * BOTTLE_SHORE_FADE_END_VH
        shoreApproachOp = Math.max(
          0,
          Math.min(1, (shoreTop - fadeEnd) / Math.max(1, fadeStart - fadeEnd)),
        )
      }

      if (bottleTouchPinnedRef.current) {
        const pin0 = bottlePinEnterScrollYRef.current
        if (pin0 != null && y < pin0 - BOTTLE_PIN_SCROLL_UP_LEAVE) {
          const flip = bottleFlipRef.current
          if (flip) {
            flipUnpinFirstRef.current = flip.getBoundingClientRect()
          } else {
            flipUnpinFirstRef.current = null
          }
          restoreSkyBottle()
          bottleTouchPinnedRef.current = false
          bottlePinEnterScrollYRef.current = null
          setBottleTouchPinned(false)
        } else {
          // Fade from water ripple + shore approach (whichever clears the bottle first).
          if (skyBottleHiddenRef.current) {
            applyBottleSinkVisual(0)
          } else {
            const flip = bottleFlipRef.current
            let rippleOp = 1
            if (flip && rippleY != null) {
              const fr = flip.getBoundingClientRect()
              const topY = fr.top + BOTTLE_SUBMERGE_TOP_FRAC * fr.height
              const botY = fr.top + BOTTLE_SUBMERGE_BOT_FRAC * fr.height
              const span = Math.max(1, botY - topY)
              rippleOp = Math.max(0, Math.min(1, (rippleY - topY) / span))
            }
            const op = Math.min(rippleOp, shoreApproachOp)
            applyBottleSinkVisual(op)
            // Splash after fade is underway, still on the waterfall section.
            if (op < BOTTLE_SPLASH_TRIGGER_OPACITY) {
              triggerBottleSplash()
            }
            if (op < SHORE_BOTTLE_SUNK_OPACITY) {
              hideSkyBottle()
            }
          }
        }
      } else if (bottleSpot) {
        const flip = bottleFlipRef.current
        const br = bottleSpot.getBoundingClientRect()
        const bottleMidY = br.top + br.height / 2
        const viewMidY = window.innerHeight / 2

        if (skyBottleHiddenRef.current) {
          // Stay hidden after sink. Restore only once scrolled back up past the pin zone.
          applyBottleSinkVisual(0)
          if (
            !nearBottom &&
            shoreApproachOp >= 0.98 &&
            (bottleMidY > viewMidY + 24 || y < 64)
          ) {
            restoreSkyBottle()
          }
        } else {
          if (flip && !skyBottleHiddenRef.current) {
            // Idle / pre-pin: fully visible (do not clear a mid-fade if somehow present).
            applyBottleSinkVisual(1)
          }
          if (!nearBottom && bottleMidY <= viewMidY && br.bottom > 32) {
            if (flip) flipPinFirstRef.current = flip.getBoundingClientRect()
            else flipPinFirstRef.current = null
            bottlePinEnterScrollYRef.current = y
            bottleTouchPinnedRef.current = true
            setBottleTouchPinned(true)
          }
        }
      }

      // Shore rematch: trigger a slow autonomous drift once the sky bottle has sunk
      // and the shore is just entering the viewport (earlier than a mid-shore scrub).
      const shore = shoreRef.current
      if (shore) {
        const rect = shore.getBoundingClientRect()
        const vh = window.innerHeight
        if (rect.top > vh * SHORE_BOTTLE_RESET_FRAC) {
          if (shoreBottlePlayedRef.current) {
            shoreBottlePlayedRef.current = false
            setShoreBottlePlaying(false)
          }
        } else if (
          skyBottleHasSunkRef.current &&
          !shoreBottlePlayedRef.current &&
          rect.top < vh * SHORE_BOTTLE_TRIGGER_FRAC
        ) {
          shoreBottlePlayedRef.current = true
          setShoreBottlePlaying(true)
        }
      }

      // Map→forest bottle: enter left → descend → swap/shrink at bird → park at
      // crab/industry during walk-sticky → fall behind bushes after release.
      // Scroll-up reverses the same progress (no latch freeze).
      const mapBand = mapBottleBandRef.current
      const mapMount = mapBottleMountRef.current
      if (mapBand && mapMount) {
        const rect = mapBand.getBoundingClientRect()
        const vh = window.innerHeight
        const span = Math.max(1, rect.height * 0.92)
        let p = Math.max(0, Math.min(1, (vh * 0.5 - rect.top) / span))

        // Until walk sticky releases: cap at the crab/industry hold. The band
        // itself stops advancing once the painting pins, so the walk and the
        // arrival hold drive the rest of the drop — it keeps falling while he
        // walks and settles into the leaves early in the hold. Scrolling back
        // up rewinds the same path.
        if (!walkReleasedRef.current) {
          if (walkProgress > 0.02) {
            if (mapBottleWalkStartPRef.current == null) {
              mapBottleWalkStartPRef.current = Math.min(p, MAP_BOTTLE_HOLD_P)
            }
            const startP = mapBottleWalkStartPRef.current
            // Front-loaded so it falls past the industry line at roughly the
            // pace of the scroll, then eases the last bit into the leaves.
            const walkFall =
              1 -
              Math.pow(
                1 -
                  clamp01(
                    (walkProgress - 0.02) /
                      Math.max(1e-6, MAP_BOTTLE_WALK_FALL_END - 0.02),
                  ),
                2.2,
              )
            const fallT = walkLatchedRef.current
              ? MAP_BOTTLE_WALK_FALL_SHARE +
                (1 - MAP_BOTTLE_WALK_FALL_SHARE) *
                  smoothstep(clamp01(stealProgress / MAP_BOTTLE_SETTLE_END))
              : MAP_BOTTLE_WALK_FALL_SHARE * walkFall
            p = startP + (MAP_BOTTLE_BUSH_P - startP) * fallT
          } else {
            mapBottleWalkStartPRef.current = null
            p = Math.min(p, MAP_BOTTLE_HOLD_P)
          }
        } else {
          mapBottleWalkStartPRef.current = null
        }

        let left = MAP_BOTTLE_LEFT_REST
        if (p < MAP_BOTTLE_ENTER_END) {
          const t = p / MAP_BOTTLE_ENTER_END
          left =
            MAP_BOTTLE_LEFT_ENTER +
            (MAP_BOTTLE_LEFT_REST - MAP_BOTTLE_LEFT_ENTER) * t
        }

        const top =
          MAP_BOTTLE_TOP_START +
          (MAP_BOTTLE_TOP_EXIT - MAP_BOTTLE_TOP_START) * p

        const inForest = top >= MAP_BOTTLE_TOP_SWAP
        if (inForest !== mapBottleInForestRef.current) {
          mapBottleInForestRef.current = inForest
          const img = mapBottleImgRef.current
          if (img) {
            img.src = inForest ? BOTTLE_STAGES.section3 : BOTTLE_STAGES.section2
          }
        }

        let scale = 1
        if (top >= MAP_BOTTLE_TOP_HOLD) {
          scale = MAP_BOTTLE_FOREST_SCALE
        } else if (top > MAP_BOTTLE_TOP_SWAP) {
          const t =
            (top - MAP_BOTTLE_TOP_SWAP) /
            Math.max(1e-6, MAP_BOTTLE_TOP_HOLD - MAP_BOTTLE_TOP_SWAP)
          scale = 1 + (MAP_BOTTLE_FOREST_SCALE - 1) * t
        }

        let opacity = 0
        if (p > 0.01) {
          if (p >= MAP_BOTTLE_FADE_P) {
            opacity = Math.max(
              0,
              1 - (p - MAP_BOTTLE_FADE_P) / Math.max(1e-6, 1 - MAP_BOTTLE_FADE_P),
            )
          } else {
            opacity = 1
          }
        }

        // Carried off by the bird once stolen; fades out with it.
        const carried =
          stealCarryDx !== 0 || stealCarryDy !== 0
            ? ` translate3d(${stealCarryDx}px, ${stealCarryDy}px, 0)`
            : ""
        opacity *= stealCarryFade

        mapMount.style.left = `${left}%`
        mapMount.style.top = `${top}%`
        mapMount.style.transform = `translate3d(-50%, -50%, 0)${carried} scale(${scale})`
        mapMount.style.opacity = String(opacity)
        mapMount.style.visibility = opacity > 0.02 ? "visible" : "hidden"
      }

      // Section4 bottle: barrel-roll in over advisory-lab copy → sticky center →
      // park under “Some applications include…” → hold → tilt + slide down WWTP ramp.
      const creamBottle = creamBottleMountRef.current
      const creamText = creamPadTextRef.current
      const appsLead = section5LeadRef.current
      if (creamBottle && creamText) {
        const vh = window.innerHeight
        const vw = window.innerWidth
        const cream = creamText.getBoundingClientRect()
        const startY = vh * CREAM_BOTTLE_ROLL_START_FRAC
        const endY = vh * CREAM_BOTTLE_ROLL_END_FRAC
        let rollP = (startY - cream.top) / Math.max(1, startY - endY)
        rollP = Math.max(0, Math.min(1, rollP))

        const lead = appsLead ? appsLead.getBoundingClientRect() : null
        const liveParkTop =
          lead != null ? lead.bottom + CREAM_BOTTLE_PARK_GAP_PX : null
        const parkLeft = vw * 0.5
        const baseRotate = CREAM_BOTTLE_ROLLS * 360

        // Once locked under the apps lead, freeze in document space (moves with
        // the WWTP art — no viewport sticky follow) until scroll-back unpark.
        if (creamBottleParkedRef.current) {
          const parkAt = creamBottleParkScrollYRef.current
          if (
            parkAt != null &&
            y < parkAt - vh * CREAM_BOTTLE_UNPARK_VH
          ) {
            creamBottleParkedRef.current = false
            creamBottleParkScrollYRef.current = null
            creamBottleParkDocYRef.current = null
            ramp2StartScrollYRef.current = null
          }
        } else if (
          rollP >= 1 &&
          liveParkTop != null &&
          liveParkTop <= vh * 0.5
        ) {
          creamBottleParkedRef.current = true
          creamBottleParkScrollYRef.current = y
          creamBottleParkDocYRef.current =
            y + liveParkTop + CREAM_BOTTLE_RAMP_Y_NUDGE_PX
        }

        let leftPx
        let topPx
        let rotateDeg = 0
        let opacity = 0
        let transformOrigin = "50% 50%"
        let firstExitP = 0

        if (creamBottleParkedRef.current) {
          if (creamBottleParkScrollYRef.current == null) {
            creamBottleParkScrollYRef.current = y
          }
          if (creamBottleParkDocYRef.current == null && liveParkTop != null) {
            creamBottleParkDocYRef.current =
              y + liveParkTop + CREAM_BOTTLE_RAMP_Y_NUDGE_PX
          }
          // Document-locked anchor → viewport. Stays put on the art as you scroll.
          const anchorTop =
            creamBottleParkDocYRef.current != null
              ? creamBottleParkDocYRef.current - y
              : liveParkTop != null
                ? liveParkTop + CREAM_BOTTLE_RAMP_Y_NUDGE_PX
                : vh * 0.22
          const holdPx = vh * CREAM_BOTTLE_RAMP_HOLD_VH
          const slidePx = Math.max(1, vh * CREAM_BOTTLE_RAMP_SLIDE_VH)
          const past = y - creamBottleParkScrollYRef.current
          firstExitP = Math.max(
            0,
            Math.min(1, (past - holdPx) / slidePx),
          )
          // Smoothstep for slide travel.
          const slideEase = firstExitP * firstExitP * (3 - 2 * firstExitP)
          const tiltP = Math.max(
            0,
            Math.min(
              1,
              firstExitP / Math.max(1e-6, CREAM_BOTTLE_RAMP_TILT_FRAC),
            ),
          )
          const tiltEase = tiltP * tiltP * (3 - 2 * tiltP)

          const slopeRad = (CREAM_BOTTLE_RAMP_SLOPE_DEG * Math.PI) / 180
          const dist =
            slideEase *
            Math.hypot(vw, vh) *
            CREAM_BOTTLE_RAMP_DIST_FRAC
          // Along the ramp: left (+ a little down from slope). Y stays art-locked.
          leftPx = parkLeft - Math.cos(slopeRad) * dist
          topPx = anchorTop + Math.sin(slopeRad) * dist
          rotateDeg = baseRotate + CREAM_BOTTLE_RAMP_TILT_DEG * tiltEase
          opacity =
            firstExitP >= 1
              ? 0
              : firstExitP > 0.88
                ? Math.max(0, 1 - (firstExitP - 0.88) / 0.12)
                : 1
          transformOrigin = "50% 40%"
          creamBottle.style.transform = `translate3d(-50%, 0, 0) rotate(${rotateDeg}deg)`
        } else if (rollP <= 0.001) {
          leftPx = (CREAM_BOTTLE_LEFT_ENTER / 100) * vw
          topPx = Math.min(
            vh * 0.82,
            cream.top + cream.height * CREAM_BOTTLE_ENTER_TEXT_FRAC,
          )
          opacity = 0
          creamBottle.style.transform = `translate3d(-50%, -50%, 0) rotate(0deg)`
        } else if (rollP < 1) {
          const easeP = Math.pow(rollP, CREAM_BOTTLE_CENTER_EASE)
          const leftPct =
            CREAM_BOTTLE_LEFT_ENTER +
            (CREAM_BOTTLE_LEFT_CENTER - CREAM_BOTTLE_LEFT_ENTER) * easeP
          leftPx = (leftPct / 100) * vw
          const fromTop = Math.min(
            vh * 0.82,
            cream.top + cream.height * CREAM_BOTTLE_ENTER_TEXT_FRAC,
          )
          topPx = fromTop + (vh * 0.5 - fromTop) * rollP
          rotateDeg = rollP * baseRotate
          opacity = Math.min(1, rollP / 0.1)
          creamBottle.style.transform = `translate3d(-50%, -50%, 0) rotate(${rotateDeg}deg)`
        } else {
          // Sticky at viewport center — only before the apps-lead lock.
          leftPx = (CREAM_BOTTLE_LEFT_CENTER / 100) * vw
          topPx = vh * 0.5
          rotateDeg = baseRotate
          opacity = 1
          creamBottle.style.transform = `translate3d(-50%, -50%, 0) rotate(${rotateDeg}deg)`
        }

        creamBottle.style.left = `${leftPx}px`
        creamBottle.style.top = `${topPx}px`
        creamBottle.style.opacity = String(opacity)
        creamBottle.style.visibility = opacity > 0.02 ? "visible" : "hidden"
        creamBottle.style.transformOrigin = transformOrigin

        // Ramp-2 bottle: same stage + slope as ramp 1. Arms the frame bottle 1
        // has left the screen; scrolling back rewinds it off the right, then
        // hands off to bottle 1 coming back from the left.
        const ramp2 = ramp2BottleMountRef.current
        const section5 = section5RootRef.current
        if (ramp2 && section5) {
          if (
            creamBottleParkedRef.current &&
            firstExitP >= RAMP2_ARM_AT &&
            ramp2StartScrollYRef.current == null
          ) {
            ramp2StartScrollYRef.current = y
          }

          const ramp2Start = ramp2StartScrollYRef.current
          const ramp2Span = artScrollSpan(
            RAMP2_SLIDE_VH,
            section5RootRef.current?.offsetWidth || window.innerWidth,
          )
          const ramp2P =
            ramp2Start == null ? 0 : (y - ramp2Start) / ramp2Span

          if (ramp2P <= 0 && firstExitP < RAMP2_ARM_AT) {
            ramp2StartScrollYRef.current = null
          }

          if (ramp2Start == null || ramp2P <= 0) {
            ramp2.style.opacity = "0"
            ramp2.style.visibility = "hidden"
          } else {
            const p = Math.max(0, Math.min(1, ramp2P))
            const slideEase = p * p * (3 - 2 * p)
            const tiltP = Math.max(
              0,
              Math.min(
                1,
                p / Math.max(1e-6, CREAM_BOTTLE_RAMP_TILT_FRAC),
              ),
            )
            const tiltEase = tiltP * tiltP * (3 - 2 * tiltP)
            const s5 = section5.getBoundingClientRect()
            const xPct =
              RAMP2_START_X_PCT +
              (RAMP2_END_X_PCT - RAMP2_START_X_PCT) * slideEase
            const yPct =
              RAMP2_START_Y_PCT +
              (RAMP2_END_Y_PCT - RAMP2_START_Y_PCT) * slideEase
            const r2Left = s5.left + (xPct / 100) * s5.width
            const r2Top = s5.top + (yPct / 100) * s5.height
            const r2Rot = CREAM_BOTTLE_RAMP_TILT_DEG * tiltEase
            let r2Op = 1
            if (p <= 0.06) r2Op = p / 0.06
            else if (p >= 0.88)
              r2Op = Math.max(0, 1 - (p - 0.88) / 0.12)

            ramp2.style.left = `${r2Left}px`
            ramp2.style.top = `${r2Top}px`
            ramp2.style.transform = `translate3d(-50%, -50%, 0) rotate(${r2Rot}deg)`
            ramp2.style.opacity = String(r2Op)
            ramp2.style.visibility = r2Op > 0.02 ? "visible" : "hidden"
            ramp2.style.transformOrigin = "50% 40%"
          }
        }
      }

      // Chute bottle: masked by WWTP, art-locked down the stream, then
      // viewport-locked after impact so it keeps following scroll (waterfall).
      const chute = chuteBottleMountRef.current
      const chutePlate = section5RootRef.current
      if (chute && chutePlate) {
        const vh = window.innerHeight
        const s5 = chutePlate.getBoundingClientRect()
        const mouthY = s5.top + (CHUTE_KEYS[0].y / 100) * s5.height
        const span = artScrollSpan(CHUTE_SCROLL_VH, s5.width)
        const rawP = (vh * CHUTE_ARM_VIEW_Y - mouthY) / span
        const p = clamp01(rawP)
        const reduce =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const pathT = reduce ? (rawP > 0.2 ? 1 : 0) : chuteScrollToPath(p)
        const pose = chutePoseAt(pathT)
        let xPct = pose.x
        let yPct = pose.y
        if (!reduce && rawP > 1) {
          const extra = rawP - 1
          // Sinks with the water: drifts down the art at a fraction of the
          // scroll, so it moves with the page instead of sticking to the view.
          yPct =
            pose.y +
            extra * CHUTE_SINK_RATE * (span / Math.max(1, s5.height)) * 100
          xPct = pose.x + Math.sin(extra * 1.35) * 1.15
        }
        let left = s5.left + (xPct / 100) * s5.width
        const top = s5.top + (yPct / 100) * s5.height
        if (!reduce && rawP > 1) {
          // After the splash, drift over to the middle column as it sinks
          // (the wobble carries over).
          const c = easeInOutSine(clamp01((rawP - 1) / CHUTE_CENTER_SPAN))
          const wobble = Math.sin((rawP - 1) * 1.35) * 0.0115 * s5.width
          left += (window.innerWidth / 2 + wobble - left) * c
        }
        const onPlate = yPct > -4 && yPct < 160
        const inBand = s5.bottom > -vh * 0.2 && s5.top < vh * 1.35
        const show = onPlate && inBand
        chute.style.left = `${left}px`
        chute.style.top = `${top}px`
        chute.style.transform = `translate3d(-50%, -50%, 0) rotate(${pose.r}deg) scale(${pose.sx}, ${pose.sy})`
        chute.style.opacity = show ? "1" : "0"
        chute.style.visibility = show ? "visible" : "hidden"
        chute.style.transformOrigin = "50% 45%"
        chute.dataset.sunk = pathT >= 0.86 ? "1" : ""

        const foam = section5FoamRef.current
        if (pathT < CHUTE_FOAM_BOB_RESET) {
          chuteFoamBobPlayedRef.current = false
          resetChuteSplashRef.current()
        } else if (
          !reduce &&
          show &&
          pathT >= CHUTE_FOAM_BOB_AT &&
          !chuteFoamBobPlayedRef.current
        ) {
          chuteFoamBobPlayedRef.current = true
          if (foam) {
            foam.dataset.impact = ""
            void foam.offsetWidth
            foam.dataset.impact = "1"
          }
          startChuteSplashRef.current()
        }

        const useStage6 = show && yPct >= CHUTE_STAGE6_Y_PCT
        if (useStage6 !== chuteBottleStage6Ref.current) {
          chuteBottleStage6Ref.current = useStage6
          const img = chuteBottleImgRef.current
          if (img) {
            img.src = useStage6
              ? BOTTLE_STAGES.section6
              : BOTTLE_STAGES.section5
          }
        }
      }

      // Ending bottle: pieces fly in as the hex field scrolls up, then the
      // sticky track holds the view (bottle centered) while petamons burst out.
      const holdTrack = endingHoldTrackRef.current
      const holdSticky = endingHoldStickyRef.current
      const holdSpacer = endingHoldSpacerRef.current
      const hexOverlap = hexOverlapRef.current
      const endingSlot = endingSlotRef.current
      const endingBottle = endingBottleRef.current
      if (holdTrack && holdSticky && holdSpacer && hexOverlap && endingSlot) {
        const vh = window.innerHeight
        const reduce = reduceMotionParallaxRef.current
        // Like the forest: once the whole beat has played and been scrolled
        // past, it stays done — no hold, bottle assembled, petamons out.
        const released = endingReleasedRef.current
        const holdPx = reduce || released ? 0 : Math.round(vh * ENDING_HOLD_VH)
        const hexOff = hexOverlap.offsetTop
        const bottleOff =
          hexOff + endingSlot.offsetTop + endingSlot.offsetHeight / 2
        const stickyTop = Math.round(vh / 2 - bottleOff)
        if (holdSticky.style.top !== `${stickyTop}px`) {
          holdSticky.style.top = `${stickyTop}px`
        }
        if (holdSpacer.style.height !== `${holdPx}px`) {
          holdSpacer.style.height = `${holdPx}px`
        }
        // Track top (un-stuck flow position): assembly runs from the reef
        // leaving the top of the view (hex art fully opaque there) to the
        // bottle reaching center.
        const trackTop = holdTrack.getBoundingClientRect().top
        const flyFrom = -(hexOff + HEX_OPAQUE_FROM * hexOverlap.offsetHeight)
        const assemble = reduce
          ? 1
          : clamp01((flyFrom - trackTop) / Math.max(1, flyFrom - stickyTop))
        const burst =
          reduce || released
            ? 1
            : clamp01((stickyTop - trackTop) / Math.max(1, holdPx))
        if (!released && !reduce && trackTop < stickyTop - holdPx) {
          // Past the end of the hold: drop its scroll length and pull the
          // scroll back by the same amount so nothing on screen moves.
          endingReleasedRef.current = true
          holdSpacer.style.height = "0px"
          window.scrollTo({ top: y - holdPx, left: 0, behavior: "instant" })
          endingBottle?.update({ assemble: 1, burst: 1 })
          return
        }
        endingBottle?.update({
          assemble: released ? 1 : assemble,
          burst,
        })
      }
    }

    tick()
    window.addEventListener("scroll", tick, { passive: true })
    window.addEventListener("resize", tick, { passive: true })
    const paintingEl = compositionRef.current
    const section5El = section5RootRef.current
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && (paintingEl || section5El)
        ? new ResizeObserver(() => tick())
        : null
    if (resizeObserver && paintingEl) resizeObserver.observe(paintingEl)
    if (resizeObserver && section5El) resizeObserver.observe(section5El)
    return () => {
      window.removeEventListener("scroll", tick)
      window.removeEventListener("resize", tick)
      if (resizeObserver) resizeObserver.disconnect()
    }
  }, [
    applyBottleSinkVisual,
    hideSkyBottle,
    restoreSkyBottle,
    triggerBottleSplash,
  ])

  // Splash droplets: ballistic burst from the pool hit, timed with the foam bob.
  useEffect(() => {
    if (typeof window === "undefined") return undefined
    let raf = 0
    let startAt = 0

    const nodes = () => {
      const layer = section5SplashLayerRef.current
      return layer ? layer.querySelectorAll("[data-splash]") : []
    }

    const hideAll = () => {
      nodes().forEach(el => {
        el.style.opacity = "0"
        el.style.visibility = "hidden"
      })
    }

    const stop = () => {
      if (raf) {
        window.cancelAnimationFrame(raf)
        raf = 0
      }
      startAt = 0
      hideAll()
    }

    const step = now => {
      raf = 0
      const layer = section5SplashLayerRef.current
      const plate = section5RootRef.current
      if (!layer || !startAt) return
      const s5 = plate ? plate.getBoundingClientRect() : null
      if (!s5 || s5.width < 1) {
        raf = window.requestAnimationFrame(step)
        return
      }
      const aspect = s5.height / s5.width
      let alive = false

      layer.querySelectorAll("[data-splash]").forEach(el => {
        const id = Number(el.getAttribute("data-splash"))
        const drop = SPLASH_LAUNCHES.find(item => item.id === id)
        if (!drop) return
        const t = now - startAt - CHUTE_SPLASH_LAUNCH_DELAY_MS - drop.delay
        if (t < 0) {
          el.style.opacity = "0"
          el.style.visibility = "hidden"
          alive = true
          return
        }
        const dragX = (1 - Math.exp(-SPLASH_DRAG * t)) / SPLASH_DRAG
        const x = SPLASH_IMPACT.x + drop.vx * dragX
        const y =
          SPLASH_IMPACT.y + drop.vy * t + 0.5 * SPLASH_GRAVITY * t * t
        const vyNow = drop.vy + SPLASH_GRAVITY * t
        const vxNow = drop.vx * Math.exp(-SPLASH_DRAG * t)
        const underFoam = y >= FOAM_BARRIER_Y_PCT + 0.2 && t > drop.tApex
        const done = underFoam || t > drop.tApex * 2.15 + 80
        if (done) {
          el.style.opacity = "0"
          el.style.visibility = "hidden"
          return
        }
        alive = true
        const appear = Math.min(1, t / 70)
        const fade =
          t > drop.tApex
            ? Math.max(0, 1 - (t - drop.tApex) / (drop.tApex * 1.05 + 40))
            : 1
        const angle =
          (Math.atan2(vyNow * aspect, vxNow) * 180) / Math.PI
        const speed = Math.hypot(vxNow, vyNow * aspect)
        const stretch = 1 + Math.min(0.28, speed * 9)
        const pop = t < 90 ? 0.62 + 0.38 * (t / 90) : 1
        el.style.opacity = String(appear * fade)
        el.style.visibility = "visible"
        const { crop } = drop
        el.style.transformOrigin = `${((drop.x - crop.x) / crop.w) * 100}% ${
          ((drop.y - crop.y) / crop.h) * 100
        }%`
        el.style.transform = `translate3d(${((x - drop.x) / 100) * s5.width}px, ${
          ((y - drop.y) / 100) * s5.height
        }px, 0) rotate(${angle}deg) scale(${pop * stretch}, ${
          pop / Math.sqrt(stretch)
        })`
      })

      if (alive) raf = window.requestAnimationFrame(step)
      else stop()
    }

    // Droplets stay hidden until impact, so decode them now rather than
    // on the impact frame.
    section5SplashLayerRef.current
      ?.querySelectorAll("img")
      .forEach(img => img.decode?.().catch(() => {}))

    startChuteSplashRef.current = () => {
      if (raf) window.cancelAnimationFrame(raf)
      startAt = performance.now()
      hideAll()
      raf = window.requestAnimationFrame(step)
    }
    resetChuteSplashRef.current = stop

    return () => {
      startChuteSplashRef.current = () => {}
      resetChuteSplashRef.current = () => {}
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  // Companion bubbles: cling under/around the chute bottle, idle-float, and
  // occasionally detach toward the foam, then respawn at the bottle.
  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    let running = true
    let active = false

    const step = now => {
      raf = 0
      if (!running || !active) return
      const chute = chuteBottleMountRef.current
      const plate = section5RootRef.current
      const layer = companionBubbleLayerRef.current
      const companions = companionBubbleStateRef.current
      if (!chute || !plate || !layer || !companions) {
        raf = window.requestAnimationFrame(step)
        return
      }

      const s5 = plate.getBoundingClientRect()

      const primed = companionBubbleLastTsRef.current !== 0
      const last = companionBubbleLastTsRef.current || now
      const dt = Math.min(64, Math.max(0, now - last))
      companionBubbleLastTsRef.current = now

      const scrollY = window.scrollY
      const prevScrollY = companionLastScrollYRef.current
      companionLastScrollYRef.current = scrollY
      const instSpeed = !primed
        ? 0
        : Math.abs(scrollY - prevScrollY) / Math.max(1, dt)
      let activity = companionScrollActRef.current
      if (instSpeed > 0.035) {
        activity = Math.min(1, activity + dt / 80)
      } else {
        activity = Math.max(0, activity - dt / 240)
      }
      companionScrollActRef.current = activity
      const detachRate = 0.42 + activity * 2.7
      const maxRising = activity > 0.3 ? 2 : 1

      const bottleRect = chute.getBoundingClientRect()
      const bottleCxPct =
        ((bottleRect.left + bottleRect.width * 0.5 - s5.left) /
          Math.max(1, s5.width)) *
        100
      const bottleCyPct =
        ((bottleRect.top + bottleRect.height * 0.5 - s5.top) /
          Math.max(1, s5.height)) *
        100
      const bottleBottomPct =
        ((bottleRect.bottom - s5.top) / Math.max(1, s5.height)) * 100
      const chuteVisible = chute.style.visibility !== "hidden"
      const inWater =
        chuteVisible &&
        bottleCyPct >= FOAM_BARRIER_Y_PCT + 0.8 &&
        bottleCyPct < 92

      if (bottleCyPct < 48) {
        companions.forEach((c, i) => {
          c.mode = "follow"
          c.x = null
          c.y = null
          c.arrived = false
          c.riseT = 0
          c.spawnT = 0
          c.cooldown = COMPANION_DETACH_MS + i * 1500
        })
      }

      let rising = companions.filter(c => c.mode === "rise").length
      if (inWater && !reduce) {
        for (const c of companions) {
          if (c.mode === "follow" && c.arrived && !c.cushion) {
            c.cooldown = (c.cooldown || 0) - dt * detachRate
          }
          if (
            c.mode === "follow" &&
            c.arrived &&
            !c.cushion &&
            c.cooldown <= 0 &&
            rising < maxRising
          ) {
            c.mode = "rise"
            c.arrived = false
            c.riseT = 0
            c.fromX = c.x
            c.fromY = c.y
            rising += 1
          }
        }
      }

      const nodes = layer.querySelectorAll("[data-companion]")
      nodes.forEach(el => {
        const id = Number(el.getAttribute("data-companion"))
        const c = companions.find(item => item.id === id)
        const painted = BUBBLE_PLATES[id]
        if (!c || !painted) return
        if (!inWater) {
          el.style.opacity = "0"
          el.style.visibility = "hidden"
          el.dataset.arrived = ""
          return
        }
        const targetX = bottleCxPct + c.ox
        const targetY =
          (c.cushion ? bottleBottomPct : bottleCyPct) + c.oy
        const wobX = reduce ? 0 : Math.sin(now / 640 + c.phase) * 0.42
        const wobY = reduce ? 0 : Math.cos(now / 780 + c.phase) * 0.28
        let tx
        let ty
        let opacity = 0.92
        if (c.mode === "rise" && !reduce) {
          c.riseT += dt
          const u = Math.min(1, c.riseT / COMPANION_RISE_MS)
          const ease = 1 - (1 - u) * (1 - u)
          tx = c.fromX + Math.sin(u * Math.PI) * c.driftX
          ty =
            c.fromY + (FOAM_BARRIER_Y_PCT - 0.35 - c.fromY) * ease
          c.x = tx
          c.y = ty
          if (u > 0.86) opacity = 0.92 * (1 - (u - 0.86) / 0.14)
          if (u >= 1) {
            opacity = 0
            c.mode = "follow"
            c.arrived = false
            c.riseT = 0
            c.spawnT = 0
            c.x = targetX + c.driftX * 0.9
            c.y = targetY + 2.8 + (id % 3) * 0.35
            c.cooldown = COMPANION_DETACH_MS + 900 + (id % 5) * 500
          }
        } else {
          if (c.x == null || c.y == null) {
            c.x = targetX + Math.sin(c.phase) * 2.1
            c.y = targetY + 2.6 + (id % 3) * 0.45
            c.arrived = false
            c.spawnT = 0
          }
          if (reduce) {
            c.x = targetX
            c.y = targetY
            c.arrived = true
          } else {
            const k = 1 - Math.exp(-dt / Math.max(120, c.followMs || 400))
            c.x += (targetX - c.x) * k
            c.y += (targetY - c.y) * k
            c.arrived =
              Math.hypot(targetX - c.x, targetY - c.y) <
              COMPANION_ARRIVE_PCT
          }
          c.spawnT = Math.min(480, (c.spawnT || 0) + dt)
          tx = c.x
          ty = c.y
          if (c.arrived && !reduce) {
            tx += wobX
            ty +=
              wobY +
              (c.cushion ? Math.sin(now / 900 + c.phase) * 0.12 : 0)
          }
          opacity = 0.92 * Math.min(1, c.spawnT / 280)
        }
        el.dataset.arrived = c.arrived ? "1" : ""
        el.style.opacity = String(opacity)
        el.style.visibility = opacity > 0.02 ? "visible" : "hidden"
        el.style.transform = `translate3d(${tx - painted.x}%, ${
          ty - painted.y
        }%, 0)`
      })

      if (running && active) raf = window.requestAnimationFrame(step)
    }

    const setActive = nextActive => {
      if (active === nextActive) return
      active = nextActive
      companionBubbleLastTsRef.current = 0
      companionLastScrollYRef.current = window.scrollY
      if (active && !raf) {
        raf = window.requestAnimationFrame(step)
      } else if (!active && raf) {
        window.cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const plate = section5RootRef.current
    const observer =
      plate && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            entries => setActive(entries.some(entry => entry.isIntersecting)),
            { rootMargin: "120px 0px" },
          )
        : null

    if (observer && plate) observer.observe(plate)
    else setActive(true)

    return () => {
      running = false
      if (observer) observer.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  // River bottle: time-based drift along SHORE_BOTTLE_PATH, pausing at each
  // gate until the bottle centroid is above the viewport midpoint.
  useEffect(() => {
    if (!shoreBottlePlaying || typeof window === "undefined") return undefined
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      const t = window.setTimeout(() => setShoreBottlePlaying(false), 2200)
      return () => window.clearTimeout(t)
    }

    shoreBottleProgressRef.current = 0
    shoreBottleGateRef.current = 0
    const mount = shoreBottleMountRef.current
    if (!mount) return undefined

    const applyPose = p => {
      const pose = shoreBottlePoseAt(p)
      mount.style.left = `${pose.left}%`
      mount.style.top = `${pose.top}%`
      mount.style.opacity = String(pose.opacity)
      mount.style.visibility = pose.opacity > 0.02 ? "visible" : "hidden"
    }

    const bottleAboveMid = () => {
      const r = mount.getBoundingClientRect()
      const midY = r.top + r.height * 0.5
      return midY <= window.innerHeight * SHORE_BOTTLE_GATE_VIEW_Y
    }

    const artW = compositionRef.current?.offsetWidth || ART_REF_W
    const driftMs =
      SHORE_BOTTLE_DRIFT_MS *
      Math.max(SHORE_BOTTLE_DRIFT_MIN_SCALE, Math.min(1, artW / ART_REF_W))

    applyPose(0)
    let last = performance.now()
    let raf = 0
    let finished = false

    const step = now => {
      if (finished) return
      const dt = Math.max(0, Math.min(64, now - last))
      last = now
      let p = shoreBottleProgressRef.current
      let gate = shoreBottleGateRef.current

      // Clear any gates already in front of the reader (or just reached).
      while (gate < SHORE_BOTTLE_GATES.length && p >= SHORE_BOTTLE_GATES[gate]) {
        if (bottleAboveMid()) {
          gate += 1
        } else {
          p = SHORE_BOTTLE_GATES[gate]
          break
        }
      }

      const blocked =
        gate < SHORE_BOTTLE_GATES.length && p >= SHORE_BOTTLE_GATES[gate]
      if (!blocked) {
        p = Math.min(1, p + dt / driftMs)
        // Don't skip through a gate on this frame — land on it and wait.
        if (
          gate < SHORE_BOTTLE_GATES.length &&
          p >= SHORE_BOTTLE_GATES[gate]
        ) {
          p = SHORE_BOTTLE_GATES[gate]
        }
      }

      shoreBottleProgressRef.current = p
      shoreBottleGateRef.current = gate
      applyPose(p)

      if (p >= 1) {
        finished = true
        setShoreBottlePlaying(false)
        return
      }
      raf = window.requestAnimationFrame(step)
    }

    raf = window.requestAnimationFrame(step)
    return () => {
      window.cancelAnimationFrame(raf)
      mount.style.left = ""
      mount.style.top = ""
      mount.style.opacity = ""
      mount.style.visibility = ""
    }
  }, [shoreBottlePlaying])

  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    const el = bottleFlipRef.current
    if (!el) return

    if (flipCleanupRef.current) {
      flipCleanupRef.current()
      flipCleanupRef.current = null
    }

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) {
      el.style.transition = ""
      el.style.transform = ""
      el.style.willChange = ""
      flipUnpinFirstRef.current = null
      flipPinFirstRef.current = null
      return undefined
    }

    const runFlip = (first, ease) => {
      const last = el.getBoundingClientRect()
      const dx = first.left - last.left
      const dy = first.top - last.top

      let raf2 = 0
      let timeoutId = 0

      const clearTimers = () => {
        cancelAnimationFrame(raf2)
        window.clearTimeout(timeoutId)
      }

      const finish = () => {
        el.style.transition = ""
        el.style.transform = ""
        el.style.willChange = ""
        el.removeEventListener("transitionend", onEnd)
      }

      function onEnd(ev) {
        if (ev.propertyName !== "transform") return
        clearTimers()
        finish()
      }

      el.style.willChange = "transform"
      el.style.transition = "none"
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`

      requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          el.style.transition = `transform ${BOTTLE_FLIP_MS}ms ${ease}`
          el.style.transform = "translate3d(0, 0, 0)"
        })
      })

      el.addEventListener("transitionend", onEnd)
      timeoutId = window.setTimeout(() => {
        clearTimers()
        finish()
      }, BOTTLE_FLIP_MS + 120)

      flipCleanupRef.current = () => {
        clearTimers()
        finish()
      }
    }

    if (!bottleTouchPinned && flipUnpinFirstRef.current) {
      const first = flipUnpinFirstRef.current
      flipUnpinFirstRef.current = null
      runFlip(first, "cubic-bezier(0.22, 1, 0.36, 1)")
    } else if (bottleTouchPinned && flipPinFirstRef.current) {
      const first = flipPinFirstRef.current
      flipPinFirstRef.current = null
      runFlip(first, "cubic-bezier(0.34, 1.28, 0.64, 1)")
    }

    return () => {
      if (flipCleanupRef.current) {
        flipCleanupRef.current()
        flipCleanupRef.current = null
      }
    }
  }, [bottleTouchPinned])

  return (
    <WikiFrontRoot ref={frontRootRef}>
      <SiteLoader handoff={logoHandoff} always />
      <ScrollStack ref={stackRef}>
        <WalkTrack ref={walkTrackRef}>
          <CompositionRoot ref={compositionRef}>
            <BackScene>
              <ParallaxBack ref={parallaxBackRef}>
                <BackRailImg
                  src={ASSETS.back}
                  alt="Wiki front — background scenery"
                />
              </ParallaxBack>
              <BirdsStack aria-hidden="true">
                {BIRDS.map((bird, i) => (
                  <BirdParallax
                    key={bird.id}
                    $z={bird.z ?? (bird.depth === "front" ? 2 : 1)}
                    ref={el => {
                      birdParallaxRefs.current[i] = el
                    }}
                  >
                    <BirdDrift
                      $enabled={bird.depth === "back"}
                      $durationMs={bird.driftMs || 36000}
                      $delayMs={bird.driftDelayMs || 0}
                    >
                      <BirdHoverMotion $delayMs={bird.delayMs}>
                        <BirdFlapper>
                          <BirdFrame
                            $phase="a"
                            $durationMs={bird.flapMs}
                            $delayMs={bird.delayMs}
                            src={bird.a}
                            alt=""
                          />
                          <BirdFrame
                            $phase="b"
                            $durationMs={bird.flapMs}
                            $delayMs={bird.delayMs}
                            src={bird.b}
                            alt=""
                          />
                        </BirdFlapper>
                      </BirdHoverMotion>
                    </BirdDrift>
                  </BirdParallax>
                ))}
              </BirdsStack>
            </BackScene>

            <FlowSizer>
              <RailImg src={ASSETS.front} alt="" />
            </FlowSizer>

            <ArtBand
              ref={waterRef}
              $top={WATERFALL_BAND_TOP}
              $height={WATERFALL_BAND_HEIGHT}
              $z={2}
            >
              <OverlayStack>
                <OverlaySlice $z={Z.text} $interactive>
                  <WaterfallSideText />
                </OverlaySlice>
                <OverlaySlice $z={Z.logo}>
                  <LogoShiftWrap>
                    <LogoFloatWrap $landed={logoLanded}>
                      <LogoFlapper
                        ref={heroLogoRef}
                        aria-label="PETABITE"
                        $landed={logoLanded}
                      >
                        {LOGO_FRAMES.map((src, i) => (
                          <LogoFrame
                            key={src}
                            src={src}
                            alt={i === 0 ? "PETABITE" : ""}
                            aria-hidden={i !== 0}
                            $index={i}
                          />
                        ))}
                      </LogoFlapper>
                    </LogoFloatWrap>
                  </LogoShiftWrap>
                </OverlaySlice>
                <OverlaySlice $z={Z.bottle}>
                  <BottlePinSpot
                    ref={bottleTouchRef}
                    $touchPinned={bottleTouchPinned}
                  >
                    <BottleFlipSurface ref={bottleFlipRef}>
                      <BottleStickyRock $active={bottleTouchPinned}>
                        <BottleShiftWrap>
                          <BottleSinkMotion ref={bottleSinkMotionRef}>
                            <BottleFloatWrap>
                              <BottleVisual ref={bottleVisualRef}>
                                <RailImg src={ASSETS.bottle} alt="" />
                              </BottleVisual>
                            </BottleFloatWrap>
                          </BottleSinkMotion>
                        </BottleShiftWrap>
                      </BottleStickyRock>
                    </BottleFlipSurface>
                  </BottlePinSpot>
                </OverlaySlice>
                <OverlaySlice $z={Z.water}>
                  <PuddleImg src={ASSETS.water} alt="" />
                  <PuddleImg $under src={ASSETS.water} alt="" />
                </OverlaySlice>
                <OverlaySlice $z={Z.text}>
                  {splashPlaying ? (
                    <WaterfallSplashAnchor
                      key="bottle-splash"
                      aria-hidden="true"
                      onAnimationEnd={e => {
                        if (e.target !== e.currentTarget) return
                        setSplashPlaying(false)
                      }}
                    >
                      <SplashRipple $delay={0} />
                      <SplashRipple $delay={120} $large />
                      <SplashDrop $n={0} />
                      <SplashDrop $n={1} />
                      <SplashDrop $n={2} />
                      <SplashDrop $n={3} />
                      <SplashDrop $n={4} />
                      <SplashDrop $n={5} />
                      <SplashDrop $n={6} />
                      <SplashFoam />
                    </WaterfallSplashAnchor>
                  ) : null}
                </OverlaySlice>
              </OverlayStack>
            </ArtBand>

            <ArtBand
              ref={shoreRef}
              $top={SHORE_BAND_TOP}
              $height={SHORE_BAND_HEIGHT}
              $z={3}
            >
              <ShoreOverlayStack>
                <CrabsStack aria-hidden="true">
                  {CRABS.map(crab => (
                    <CrabMount
                      key={crab.id}
                      $xPct={crab.xPct}
                      $yPct={crab.yPct}
                    >
                      <CrabScuttle
                        originX={crab.originX}
                        originY={crab.originY}
                        label={`Crab ${crab.id}`}
                      >
                        <CrabFlapper>
                          <CrabFrame
                            $phase="a"
                            $durationMs={crab.flapMs}
                            $delayMs={crab.delayMs}
                            src={crab.a}
                            alt=""
                          />
                          <CrabFrame
                            $phase="b"
                            $durationMs={crab.flapMs}
                            $delayMs={crab.delayMs}
                            src={crab.b}
                            alt=""
                          />
                        </CrabFlapper>
                      </CrabScuttle>
                    </CrabMount>
                  ))}
                </CrabsStack>
                <ShoreBottleLayer $z={3}>
                  <ShoreBottleMount
                    ref={shoreBottleMountRef}
                    $playing={shoreBottlePlaying}
                  >
                    <ShoreBottleSize>
                      <ShoreBottleRock $playing={shoreBottlePlaying}>
                        <ShoreBottleImg src={SHORE_BOTTLE_IMG} alt="" />
                      </ShoreBottleRock>
                    </ShoreBottleSize>
                  </ShoreBottleMount>
                </ShoreBottleLayer>
                <ShoreTextLayer $z={4}>
                  <ShorePetaseMount>
                    <ShorePetaseBody>
                      To combat this, we are engineering plastic-degrading
                      enzymes or{" "}
                      <ExplainTerm
                        term="PETases"
                        explanation={PETASE_EXPLANATION}
                      />
                      .
                    </ShorePetaseBody>
                  </ShorePetaseMount>
                  <ShoreTextMount>
                    <ShoreBody>
                      However, PETases currently in industry have a major
                      limitation...
                    </ShoreBody>
                  </ShoreTextMount>
                  <ShoreMidTextMount>
                    <ShoreMidBody>
                      ...the current enzymes only work under…
                    </ShoreMidBody>
                  </ShoreMidTextMount>
                  <ShoreCardsMount>
                    <SwipeInBox stationary title="...3 specific conditions">
                      <ConditionImageRow>
                        {CONDITION_CARD_IMAGES.map(image => (
                          <ConditionFigure key={image.alt}>
                            <ConditionImage src={image.src} alt={image.alt} />
                            <ConditionCaption>{image.alt}</ConditionCaption>
                          </ConditionFigure>
                        ))}
                      </ConditionImageRow>
                    </SwipeInBox>
                  </ShoreCardsMount>
                  <ShoreLoganMount>
                    <ShoreLoganBody>
                      That&apos;s why our team has developed the LOGAN index: a
                      planetary sequence search that discovers novel
                      plastic-degrading enzymes.
                    </ShoreLoganBody>
                  </ShoreLoganMount>
                </ShoreTextLayer>
              </ShoreOverlayStack>
            </ArtBand>

            <ArtBand $top={WORLD_MAP_TOP} $height={WORLD_MAP_HEIGHT} $z={10} />

            <ArtBand
              ref={mapBottleBandRef}
              $top={MAP_BOTTLE_BAND_TOP}
              $height={MAP_BOTTLE_BAND_HEIGHT}
              $z={11}
            >
              <MapBottleLayer aria-hidden="true">
                <MapBottleMount ref={mapBottleMountRef}>
                  <MapBottleRock>
                    <MapBottleImg
                      ref={mapBottleImgRef}
                      src={BOTTLE_STAGES.section2}
                      alt=""
                    />
                  </MapBottleRock>
                </MapBottleMount>
              </MapBottleLayer>
            </ArtBand>

            <ArtBand $top={FOREST_BAND_TOP} $height={FOREST_BAND_HEIGHT} $z={3}>
              <ForestAnimalsStack aria-hidden="true">
                {SECTION3_ANIMALS.map(animal => {
                  let plate = animal.static ? (
                    <CrabFlapper>
                      <StaticPlateImg src={animal.src} alt="" />
                    </CrabFlapper>
                  ) : (
                    <AnimalMotion
                      $scale={animal.scale || 1}
                      $ox={animal.originX}
                      $oy={animal.originY}
                      $hover={animal.hover}
                      $delayMs={animal.delayMs}
                      $clipRightPct={animal.clipRightPct || 0}
                    >
                      <CrabFlapper>
                        <CrabFrame
                          $phase="a"
                          $durationMs={animal.flapMs}
                          $delayMs={animal.delayMs}
                          $hoverFlap={animal.hover}
                          src={animal.a}
                          alt=""
                        />
                        <CrabFrame
                          $phase="b"
                          $durationMs={animal.flapMs}
                          $delayMs={animal.delayMs}
                          $hoverFlap={animal.hover}
                          src={animal.b}
                          alt=""
                        />
                      </CrabFlapper>
                    </AnimalMotion>
                  )

                  let body = plate
                  if (animal.id.startsWith("crab")) {
                    plate = (
                      <CrabScuttle
                        originX={animal.originX}
                        originY={animal.originY}
                        label={`Crab ${animal.id}`}
                      >
                        {plate}
                      </CrabScuttle>
                    )
                    body = plate
                  }
                  if (animal.revealOnArrive) {
                    body = (
                      <PetamonReveal
                        $show={walkArrived}
                        $delayMs={animal.delayMs}
                      >
                        {plate}
                      </PetamonReveal>
                    )
                  } else if (animal.id === STEAL_BIRD_ID) {
                    body = (
                      <BirdStealMount ref={birdStealRef}>{plate}</BirdStealMount>
                    )
                  }

                  return (
                    <CrabMount
                      key={animal.id}
                      $xPct={animal.xPct}
                      $yPct={animal.yPct}
                      $z={animal.id === STEAL_BIRD_ID ? 12 : 0}
                    >
                      {body}
                    </CrabMount>
                  )
                })}
              </ForestAnimalsStack>
            </ArtBand>

            <ArtBand
              $top={FOREST_BAND_TOP}
              $height={FOREST_BAND_HEIGHT}
              $z={20}
            >
              <HumanWalkLayer ref={humanWalkRef} aria-hidden="true">
                <HumanBob ref={humanBobRef} $arrived={walkArrived}>
                  <CrabMount $xPct={HUMAN.xPct} $yPct={HUMAN.yPct}>
                    <AnimalMotion
                      $scale={HUMAN.scale}
                      $ox={HUMAN.originX}
                      $oy={HUMAN.originY}
                    >
                      <CrabFlapper>
                        <ExclamationMark
                          $dx={HUMAN_HEAD_X - EXCLAMATION_MARK_X}
                          $dy={HUMAN_HEAD_Y - EXCLAMATION_MARK_Y}
                        >
                          <ExclamationPop $show={walkArrived}>
                            <StaticPlateImg src={EXCLAMATION_SRC} alt="" />
                          </ExclamationPop>
                        </ExclamationMark>
                        <HumanPose $show={!walkArrived}>
                          <StaticPlateImg src={HUMAN.src} alt="" />
                        </HumanPose>
                        <HumanPose $show={walkArrived} $fill>
                          <StaticPlateImg src={HUMAN.srcArrived} alt="" />
                        </HumanPose>
                      </CrabFlapper>
                    </AnimalMotion>
                  </CrabMount>
                </HumanBob>
              </HumanWalkLayer>
            </ArtBand>

            <ArtBand
              $top={FOREST_BAND_TOP}
              $height={FOREST_BAND_HEIGHT}
              $z={21}
            >
              <ForestDatasetMount ref={forestDatasetRef}>
                <ForestDatasetBody>
                  Before, the industry was using an enzyme dataset of roughly
                  200.
                </ForestDatasetBody>
              </ForestDatasetMount>
              <ForestRnalabMount
                $show={walkArrived}
                $interactive={rnalabInteractive}
              >
                <ForestDatasetBody>
                  With{" "}
                  <ExplainTerm
                    term="RNAlab"
                    explanation={RNALAB_EXPLANATION}
                    imageSrc={RNALAB_TEXTBOX_IMG}
                    imageAlt="RNAlab"
                  />
                  , our advisory lab, our team uncovered 215.7 million
                  high-quality plastic‑degrading enzymes.
                </ForestDatasetBody>
              </ForestRnalabMount>
            </ArtBand>

            <BushLayer>
              <RailImg src={ASSETS.bush} alt="" />
            </BushLayer>

            <ArtBand $top={CREAM_PAD_TOP} $height={CREAM_PAD_HEIGHT} $z={4}>
              <CreamPadTextMount ref={creamPadTextRef}>
                <CreamPadBody>
                  A 1,000,000‑fold increase from the enzyme landscape previously
                  known.
                </CreamPadBody>
              </CreamPadTextMount>
            </ArtBand>
          </CompositionRoot>
        </WalkTrack>

        <EndingHoldTrack ref={endingHoldTrackRef}>
          <EndingHoldSticky ref={endingHoldStickyRef}>
            <Section5Root ref={section5RootRef}>
              <Section5Sizer>
                <RailImg src={`${SECTION5_CDN}/1-bg.avif`} alt="" />
              </Section5Sizer>
              {SECTION5_LAYERS.filter(
                layer => !layer.sizer && layer.id < 4,
              ).map(layer => (
                <Section5Layer
                  key={layer.id}
                  $z={layer.z}
                  src={`${SECTION5_CDN}/${layer.file}`}
                  alt=""
                />
              ))}
              <HexFieldOverlap ref={hexOverlapRef} $topPct={HEX_FIELD_TOP_PCT}>
                <HexFieldImg src={HEX_FIELD_SRC} alt="" />
                <EndingBottleSlot ref={endingSlotRef}>
                  <EndingPetamonBottle ref={endingBottleRef} />
                </EndingBottleSlot>
              </HexFieldOverlap>
              {SECTION5_LAYERS.filter(
                layer => layer.id >= 4 && layer.id < 7,
              ).map(layer => (
                <Section5Layer
                  key={layer.id}
                  $z={layer.z}
                  src={`${SECTION5_CDN}/${layer.file}`}
                  alt=""
                />
              ))}
              <Section5ChuteBottleLayer aria-hidden="true">
                <ChuteBottleMount ref={chuteBottleMountRef}>
                  <ChuteBottleIdle>
                    <ChuteBottleImg
                      ref={chuteBottleImgRef}
                      src={BOTTLE_STAGES.section5}
                      alt=""
                    />
                  </ChuteBottleIdle>
                </ChuteBottleMount>
              </Section5ChuteBottleLayer>
              {SECTION5_LAYERS.filter(layer => layer.id >= 7).map(layer => (
                <Section5Layer
                  key={layer.id}
                  $z={layer.z}
                  src={`${SECTION5_CDN}/${layer.file}`}
                  alt=""
                />
              ))}
              <Section5FishStack aria-hidden="true">
                {SECTION5_FISHES.map(fish => (
                  <Section5FishPlane key={fish.id} $z={fish.z}>
                    <BirdDrift
                      $enabled
                      $durationMs={fish.driftMs}
                      $delayMs={fish.driftDelayMs}
                    >
                      <Section5FishHover $delayMs={fish.hoverDelayMs}>
                        <RailImg src={fish.src} alt="" />
                      </Section5FishHover>
                    </BirdDrift>
                  </Section5FishPlane>
                ))}
              </Section5FishStack>
              <Section5BubbleStack aria-hidden="true">
                {STREAM_BUBBLES.map((bubble, i) => {
                  const painted = BUBBLE_PLATES[bubble.id]
                  return (
                    <Section5StreamBubble
                      key={`stream-${bubble.id}`}
                      style={{
                        "--shift-x": `${bubble.x - painted.x}%`,
                        "--rise-dy": `${FOAM_BARRIER_Y_PCT - 0.4 - painted.y}%`,
                        "--wobble-x": `${(i % 2 === 0 ? 1 : -1) * (1.15 + i * 0.35)}%`,
                      }}
                      $dur={6.6 + i * 1.05}
                      $delay={-i * 1.7}
                    >
                      <Section5BubbleIdle $delay={i * 0.35} $dur={3.1 + (i % 3) * 0.4}>
                        <Section5Layer
                          $z={1}
                          src={`${BUBBLE_CDN}/bubble${bubble.id}.avif`}
                          alt=""
                        />
                      </Section5BubbleIdle>
                    </Section5StreamBubble>
                  )
                })}
                <Section5CompanionLayer ref={companionBubbleLayerRef}>
                  {COMPANION_BUBBLE_SPECS.map(spec => (
                    <Section5CompanionBubble
                      key={`companion-${spec.id}`}
                      data-companion={spec.id}
                    >
                      <Section5BubbleIdle
                        $delay={spec.id * 0.18}
                        $dur={2.8 + (spec.id % 4) * 0.35}
                      >
                        <Section5Layer
                          $z={1}
                          src={`${BUBBLE_CDN}/bubble${spec.id}.avif`}
                          alt=""
                        />
                      </Section5BubbleIdle>
                    </Section5CompanionBubble>
                  ))}
                </Section5CompanionLayer>
              </Section5BubbleStack>
              <Section5AppsBottleLayer aria-hidden="true">
                <Section5AppsBottleMount ref={creamBottleMountRef}>
                  <Section5AppsBottleImg
                    src={BOTTLE_STAGES.section4}
                    alt=""
                  />
                </Section5AppsBottleMount>
                <Section5AppsBottleMount ref={ramp2BottleMountRef}>
                  <Section5AppsBottleImg
                    src={BOTTLE_STAGES.section4}
                    alt=""
                  />
                </Section5AppsBottleMount>
              </Section5AppsBottleLayer>
              <Section5FoamMount
                ref={section5FoamRef}
                aria-hidden="true"
                style={plateCropStyle(FOAM_CROP)}
                onAnimationEnd={e => {
                  if (e.target !== e.currentTarget) return
                  e.currentTarget.dataset.impact = ""
                }}
              >
                <PlateCropImg
                  src={SECTION5_FOAM_SRC}
                  alt=""
                  style={plateCropImgStyle(FOAM_CROP)}
                />
              </Section5FoamMount>
              <Section5SplashLayer ref={section5SplashLayerRef} aria-hidden="true">
                {SPLASH_PLATES.map(splash => (
                  <Section5SplashDrop
                    key={splash.id}
                    data-splash={splash.id}
                    style={plateCropStyle(splash.crop)}
                  >
                    <PlateCropImg
                      src={`${SPLASH_CDN}/splash${splash.id}.avif`}
                      alt=""
                      style={plateCropImgStyle(splash.crop)}
                    />
                  </Section5SplashDrop>
                ))}
              </Section5SplashLayer>
              <Section5TextStack aria-hidden="false">
                <Section5Lead ref={section5LeadRef}>
                  Some applications include...
                </Section5Lead>
                <Section5WwtpLine>
                  PETases in wastewater treatment,...
                </Section5WwtpLine>
                <Section5RecyclingLine>
                  ..., Breaking down plastics in trash and recycling bins,...
                </Section5RecyclingLine>
                <Section5AndMoreLine>...and more.</Section5AndMoreLine>
                <Section5Cta>
                  Discover more about Petabite.
                </Section5Cta>
              </Section5TextStack>
            </Section5Root>

            <HexFieldRoot aria-hidden="true" />
          </EndingHoldSticky>
          <EndingHoldSpacer ref={endingHoldSpacerRef} aria-hidden="true" />
        </EndingHoldTrack>

        <HomeNavMount $pinned={navPinned}>
          <WikiTopBar />
        </HomeNavMount>
      </ScrollStack>
    </WikiFrontRoot>
  )
}

export default HomeScrollPrototype

const WikiFrontRoot = styled.div`
  width: 100%;
  min-width: 0;
  background: var(--color-bg);
  /* No glyph hinting, so art-locked copy wraps the same at every width. */
  text-rendering: geometricPrecision;
`

const ScrollStack = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
`

/** Absolute at rest; `fixed` while scrolling through mockup so nav stays reachable. */
const HomeNavMount = styled.div`
  position: ${({ $pinned }) => ($pinned ? "fixed" : "absolute")};
  top: 0;
  left: 0;
  right: 0;
  z-index: ${WIKI_TOP_BAR_Z_INDEX};
`

const WalkTrack = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
`

/** Section 5 + hex field, plus the scroll length of the ending-bottle hold. */
const EndingHoldTrack = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
`

/**
 * Sticks (top set in the tick) when the ending bottle reaches mid-view, for
 * as long as EndingHoldSpacer lasts. Clips the pieces flying in from the sides.
 */
const EndingHoldSticky = styled.div`
  position: sticky;
  width: 100%;
  min-width: 0;
  overflow-x: clip;
`

const EndingHoldSpacer = styled.div`
  background: #101133;
`

const EndingBottleSlot = styled.div`
  position: absolute;
  left: 50%;
  /* Raised off the bottom of the hex art: some room below it before the footer. */
  bottom: 20vh;
  z-index: 2;
  /* As big as the view allows while held mid-screen (frame is 1340×1060),
     leaving room for the hint under it. */
  width: min(92vw, calc(78vh * 1340 / 1060));
  width: min(92vw, calc(78svh * 1340 / 1060));
  transform: translateX(-50%);
  pointer-events: none;
`

const Section5Root = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  overflow: visible;
  background: transparent;
`

/** Above the chute bottle (z 8) and bubbles (z 10) so they scroll underneath. */
const HexFieldOverlap = styled.div`
  position: absolute;
  left: 0;
  top: ${({ $topPct }) => `${$topPct}%`};
  z-index: 11;
  width: 100%;
  pointer-events: none;
`

const HexFieldImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  pointer-events: none;
  user-select: none;
`

/** Scroll space for the hex image that extends past the reef plate. */
const HexFieldRoot = styled.div`
  position: relative;
  z-index: 0;
  width: 100%;
  min-width: 0;
  aspect-ratio: ${HEX_FIELD_BELOW_ASPECT};
  padding-bottom: 22vh;
  background: #101133;
`

const Section5Sizer = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  pointer-events: none;
`

const Section5Layer = styled.img`
  position: absolute;
  left: 0;
  top: 0;
  z-index: ${({ $z }) => $z};
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  pointer-events: none;
  user-select: none;
`

const foamImpactBob = keyframes`
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  22% {
    transform: translate3d(0, 10px, 0) scale(1.02);
  }
  58% {
    transform: translate3d(0, -5px, 0) scale(1.008);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
`

const Section5FoamMount = styled.div`
  position: absolute;
  z-index: ${SECTION5_FOAM_Z};
  overflow: hidden;
  pointer-events: none;
  transform-origin: ${((FOAM_BOB_ORIGIN.x - FOAM_CROP.x) / FOAM_CROP.w) * 100}%
    ${((FOAM_BOB_ORIGIN.y - FOAM_CROP.y) / FOAM_CROP.h) * 100}%;
  will-change: transform;

  &[data-impact="1"] {
    animation: ${foamImpactBob} 620ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Section5SplashLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${SPLASH_Z};
  pointer-events: none;
  overflow: visible;
`

const Section5SplashDrop = styled.div`
  position: absolute;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  will-change: transform, opacity;
`

/** Full-plate sprite inside a plateCropStyle window (offsets come from style). */
const PlateCropImg = styled.img`
  position: absolute;
  display: block;
  height: auto;
  max-width: none;
  pointer-events: none;
  user-select: none;
`

const Section5FishStack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: auto;
  overflow: hidden;
`

const Section5FishPlane = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${({ $z }) => $z ?? 5};
  pointer-events: none;
`

const fishHoverBob = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -8px, 0);
  }
`

const fishHoverBobStrong = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -14px, 0);
  }
`

const Section5FishHover = styled.div`
  position: absolute;
  inset: 0;
  animation: ${fishHoverBob} 4.8s ease-in-out infinite;
  animation-delay: ${({ $delayMs }) => `${($delayMs || 0) * 0.5}ms`};

  ${Section5FishStack}:hover & {
    animation-name: ${fishHoverBobStrong};
    animation-duration: 3.2s;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const streamRise = keyframes`
  0% {
    transform: translate3d(var(--shift-x), 0, 0);
    opacity: 0;
  }
  7% {
    opacity: 0.95;
  }
  24% {
    transform: translate3d(
      calc(var(--shift-x) + var(--wobble-x) * 0.7),
      calc(var(--rise-dy) * 0.2),
      0
    );
  }
  50% {
    transform: translate3d(
      calc(var(--shift-x) + var(--wobble-x) * -0.5),
      calc(var(--rise-dy) * 0.5),
      0
    );
  }
  76% {
    transform: translate3d(
      calc(var(--shift-x) + var(--wobble-x) * 0.35),
      calc(var(--rise-dy) * 0.78),
      0
    );
  }
  88% {
    opacity: 0.95;
  }
  100% {
    transform: translate3d(
      calc(var(--shift-x) + var(--wobble-x)),
      var(--rise-dy),
      0
    );
    opacity: 0;
  }
`

const bubbleIdleFloat = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  35% {
    transform: translate3d(5px, -6px, 0);
  }
  68% {
    transform: translate3d(-6px, 4px, 0);
  }
`

const Section5BubbleStack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
`

const Section5StreamBubble = styled.div`
  position: absolute;
  inset: 0;
  --rise-dy: 0%;
  --wobble-x: 0%;
  --shift-x: 0%;
  animation: ${streamRise} ${({ $dur }) => $dur}s linear infinite;
  animation-delay: ${({ $delay }) => $delay}s;
  will-change: transform, opacity;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0;
    visibility: hidden;
  }
`

const Section5BubbleIdle = styled.div`
  position: absolute;
  inset: 0;
  animation: ${bubbleIdleFloat} ${({ $dur }) => $dur || 3.2}s ease-in-out infinite;
  animation-delay: ${({ $delay }) => `${$delay || 0}s`};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Section5CompanionLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`

const Section5CompanionBubble = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0;
  visibility: hidden;
  will-change: transform, opacity;

  ${Section5BubbleIdle} {
    animation-play-state: paused;
  }

  &[data-arrived="1"] ${Section5BubbleIdle} {
    animation-play-state: running;
  }
`

/** Copy locked to % of the tall section-5 plate (946×4000). Above foam art. */
const Section5TextStack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 12;
  pointer-events: none;
`

/**
 * Section4 bottle slot: in front of underwater art, behind apps copy.
 * Mount is `position: fixed` and driven by scroll in the tick handler.
 */
const Section5AppsBottleLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
`

const Section5AppsBottleMount = styled.div`
  position: fixed;
  top: 50%;
  left: 118%;
  width: ${artPx(152)};
  transform: translate3d(-50%, -50%, 0);
  transform-origin: 50% 50%;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  will-change: left, top, opacity, transform;
  z-index: 10;
`

const Section5ChuteBottleLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${CHUTE_Z};
  pointer-events: none;
`

const ChuteBottleMount = styled(Section5AppsBottleMount)`
  z-index: ${CHUTE_Z};
  width: ${artPx(196)};
`

const Section5AppsBottleImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35));
`

const ChuteBottleImg = styled(Section5AppsBottleImg)`
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35))
    saturate(1.08) contrast(0.96);
`

const chuteSinkIdle = keyframes`
  0% {
    transform: translate3d(0, 4px, 0) rotate(-4deg);
  }
  40% {
    transform: translate3d(0, 14px, 0) rotate(5deg);
  }
  70% {
    transform: translate3d(0, 8px, 0) rotate(-2deg);
  }
  100% {
    transform: translate3d(0, 4px, 0) rotate(-4deg);
  }
`

const ChuteBottleIdle = styled.div`
  width: 100%;
  transform-origin: 50% 70%;

  ${ChuteBottleMount}[data-sunk="1"] & {
    animation: ${chuteSinkIdle} 3.1s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Section5Lead = styled.p`
  position: absolute;
  top: 5%;
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  width: ${artPx(672)};
  margin: 0;
  color: #0a0a0a;
  font-family: var(--font-body);
  ${artFont(40.32)}
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  overflow-wrap: break-word;

  ${phone} {
    width: 90%;
    font-size: 1.05rem;
  }
`

const section5AppLineBase = `
  position: absolute;
  transform: translate3d(-50%, 0, 0);
  width: ${artPx(640)};
  margin: 0;
  color: #0a0a0a;
  font-family: var(--font-body);
  ${artFont(34.24)}
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  overflow-wrap: break-word;
  text-shadow:
    0 0 6px rgba(255, 252, 240, 0.95),
    0 0 14px rgba(255, 248, 220, 0.7),
    0 1px 3px rgba(255, 255, 255, 0.85);

  ${phone} {
    width: 60%;
    font-size: 0.85rem;
  }
`

/** WWTP callout — edit top/left/width here. */
const Section5WwtpLine = styled.p`
  ${section5AppLineBase}
  top: 16%;
  left: 55%;
  width: ${artPx(352)};

  ${phone} {
    width: 48%;
  }
`

/** Trash / recycling bins callout — edit top/left/width independently. */
const Section5RecyclingLine = styled.p`
  ${section5AppLineBase}
  top: 33%;
  left: 45%;
  width: ${artPx(352)};

  ${phone} {
    width: 48%;
  }
`

/** “...and more.” — edit top/left independently. */
const Section5AndMoreLine = styled.p`
  ${section5AppLineBase}
  top: 46%;
  left: 83%;

  ${phone} {
    left: 76%;
    width: 40%;
  }
`

const Section5Cta = styled.p`
  position: absolute;
  top: 60%;
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  width: ${artPx(768)};
  margin: 0;
  color: #fff;
  font-family: var(--font-body);
  ${artFont(51.84)}
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: break-word;
  text-shadow:
    0 0 12px rgba(255, 255, 255, 0.85),
    0 0 28px rgba(170, 230, 255, 0.75),
    0 0 48px rgba(90, 190, 255, 0.45),
    0 2px 4px rgba(0, 0, 0, 0.35);

  ${phone} {
    width: 90%;
    font-size: 1.2rem;
  }
`

const CompositionRoot = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  overflow: hidden;
`

const HumanWalkLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`

const humanWalkBob = keyframes`
  0%,
  49.9% {
    transform: translate3d(0, 0, 0);
  }
  50%,
  100% {
    transform: translate3d(0, -12px, 0);
  }
`

const humanArriveJump = keyframes`
  0% {
    transform: translate3d(0, 0, 0);
  }
  32% {
    transform: translate3d(0, -26px, 0);
  }
  52% {
    transform: translate3d(0, 5px, 0);
  }
  72% {
    transform: translate3d(0, -11px, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
`

const HumanBob = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;

  &[data-walking="1"] {
    animation: ${humanWalkBob} 0.4s steps(1, end) infinite;
  }

  ${({ $arrived }) =>
    $arrived &&
    css`
      animation: ${humanArriveJump} 0.64s cubic-bezier(0.22, 1.35, 0.32, 1) 1;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const bangPopIn = keyframes`
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

const bangIdleSway = keyframes`
  0%,
  49.9% {
    transform: rotate(-8deg);
  }
  50%,
  100% {
    transform: rotate(8deg);
  }
`

const ExclamationMark = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  z-index: 1;
  transform: translate3d(
    ${({ $dx }) => $dx || 0}%,
    ${({ $dy }) => $dy || 0}%,
    0
  );
  pointer-events: none;
`

const ExclamationPop = styled.div`
  width: 100%;
  transform-origin: ${EXCLAMATION_MARK_X}% ${EXCLAMATION_MARK_Y}%;
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  /* Only bites on the way out — the pop-in keyframes own the entry. */
  transition: opacity 200ms ease;

  ${({ $show }) =>
    $show
      ? css`
          animation:
            ${bangPopIn} 420ms cubic-bezier(0.34, 1.45, 0.64, 1) both,
            ${bangIdleSway} 1.4s steps(1, end) 420ms infinite;
        `
      : css`
          animation: none;
        `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: ${({ $show }) => ($show ? 1 : 0)};
    transform: none;
    transition: none;
  }
`

const HumanPose = styled.div`
  position: ${({ $fill }) => ($fill ? "absolute" : "relative")};
  left: 0;
  top: 0;
  width: 100%;
  z-index: 2;
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  pointer-events: none;
`

/** Toronto + birds, height from the back plate — sits in the transparent sky hole. */
const BackScene = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
`

const FlowSizer = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  pointer-events: none;
`

/** Frontmost scenery (bushes). Above Toronto, painting, and animals; below site nav. */
const BushLayer = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  z-index: 30;
  pointer-events: none;
`

/** Overlay band as a fraction of the unified front canvas. */
const ArtBand = styled.div`
  position: absolute;
  left: 0;
  width: 100%;
  top: ${({ $top }) => `${$top * 100}%`};
  height: ${({ $height }) => `${$height * 100}%`};
  z-index: ${({ $z }) => $z};
  pointer-events: none;
  overflow: visible;
`

const CrabsStack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
`

const ForestAnimalsStack = styled(CrabsStack)`
  pointer-events: auto;
`

const petamonPopIn = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0, 16px, 0);
  }
  62% {
    opacity: 1;
    transform: translate3d(0, -5px, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
`

/** Crabs + axolotls stay off the plate until the walker is surprised. */
const PetamonReveal = styled.div`
  width: 100%;
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  pointer-events: none;
  /* Only bites on the way out — the pop-in keyframes own the entry. */
  transition: opacity 240ms ease;

  ${({ $show, $delayMs }) =>
    $show &&
    css`
      animation: ${petamonPopIn} 620ms cubic-bezier(0.34, 1.4, 0.64, 1) both;
      animation-delay: ${$delayMs || 0}ms;
    `}

  ${({ $show }) =>
    !$show &&
    css`
      button {
        pointer-events: none;
      }
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: none;
    transition: none;
  }
`

/** Steal-flight transform target for the rightmost bird (driven by scroll). */
const BirdStealMount = styled.div`
  width: 100%;
`

const animalHoverBob = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(var(--animal-scale, 1));
  }
  50% {
    transform: translate3d(0, -10px, 0) scale(var(--animal-scale, 1));
  }
`

const animalHoverBobStrong = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(var(--animal-scale, 1));
  }
  50% {
    transform: translate3d(0, -18px, 0) scale(calc(var(--animal-scale, 1) * 1.08));
  }
`

const AnimalMotion = styled.div`
  width: 100%;
  pointer-events: none;
  transform-origin: ${({ $ox, $oy }) =>
    `${$ox != null ? $ox : 50}% ${$oy != null ? $oy : 50}%`};
  --animal-scale: ${({ $scale }) => $scale || 1};
  transform: scale(var(--animal-scale));
  clip-path: ${({ $clipRightPct }) =>
    $clipRightPct > 0 ? `inset(0 ${$clipRightPct}% 0 0)` : "none"};

  ${({ $hover, $delayMs }) =>
    $hover &&
    css`
      animation: ${animalHoverBob} 3.6s ease-in-out infinite;
      animation-delay: ${($delayMs || 0) * 0.5}ms;

      ${ForestAnimalsStack}:hover & {
        animation-name: ${animalHoverBobStrong};
        animation-duration: 2.4s;
      }
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const CrabMount = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  z-index: ${({ $z }) => $z || 0};
  transform: translate3d(
    ${({ $xPct }) => $xPct || 0}%,
    ${({ $yPct }) => $yPct || 0}%,
    0
  );
  pointer-events: none;
`

const crabScuttleLeft = keyframes`
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  18% {
    transform: translate3d(-0.9%, 0, 0) rotate(${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  38% {
    transform: translate3d(-2.1%, 0, 0) rotate(-${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  58% {
    transform: translate3d(-3.3%, 0, 0) rotate(${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  78% {
    transform: translate3d(-4.1%, 0, 0) rotate(-${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  100% {
    transform: translate3d(-${CRAB_SCUTTLE_X_PCT}%, 0, 0) rotate(0deg);
  }
`

const crabScuttleRight = keyframes`
  0% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  18% {
    transform: translate3d(0.9%, 0, 0) rotate(-${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  38% {
    transform: translate3d(2.1%, 0, 0) rotate(${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  58% {
    transform: translate3d(3.3%, 0, 0) rotate(-${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  78% {
    transform: translate3d(4.1%, 0, 0) rotate(${CRAB_SCUTTLE_THETA_DEG}deg);
  }
  100% {
    transform: translate3d(${CRAB_SCUTTLE_X_PCT}%, 0, 0) rotate(0deg);
  }
`

const CrabScuttleShell = styled.div`
  position: relative;
  width: 100%;
  pointer-events: none;
  transform: translate3d(${({ $homeX }) => $homeX}%, 0, 0);
  transform-origin: ${({ $ox, $oy }) => `${$ox}% ${$oy}%`};
`

const CrabScuttleMotion = styled.div`
  position: relative;
  width: 100%;
  pointer-events: none;
  transform-origin: ${({ $ox, $oy }) => `${$ox}% ${$oy}%`};

  ${({ $playing, $dir }) =>
    $playing &&
    css`
      animation: ${$dir < 0 ? crabScuttleLeft : crabScuttleRight}
        ${CRAB_SCUTTLE_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1) both;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`

const CrabHitPad = styled.button`
  position: absolute;
  left: ${({ $ox }) => $ox}%;
  top: ${({ $oy }) => $oy}%;
  width: clamp(3.25rem, 11%, 7.5rem);
  height: clamp(2.75rem, 8%, 5.75rem);
  transform: translate(-50%, -50%);
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  z-index: 5;
  appearance: none;

  &:focus-visible {
    outline: 2px solid rgba(20, 20, 20, 0.45);
    outline-offset: 3px;
  }
`

const CrabFlapper = styled.div`
  position: relative;
  width: 100%;
  pointer-events: none;
`

const crabFlapA = keyframes`
  0%,
  49.9% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
`

const crabFlapB = keyframes`
  0%,
  49.9% {
    opacity: 0;
  }
  50%,
  100% {
    opacity: 1;
  }
`

const CrabFrame = styled.img`
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  user-select: none;
  pointer-events: none;
  opacity: ${({ $phase }) => ($phase === "a" ? 1 : 0)};
  animation-name: ${({ $phase }) => ($phase === "a" ? crabFlapA : crabFlapB)};
  animation-duration: ${({ $durationMs }) => `${$durationMs || 720}ms`};
  animation-delay: ${({ $delayMs }) => `${$delayMs || 0}ms`};
  animation-timing-function: steps(1, end);
  animation-iteration-count: infinite;

  &:first-child {
    position: relative;
  }

  ${({ $hoverFlap, $durationMs }) =>
    $hoverFlap &&
    css`
      ${ForestAnimalsStack}:hover & {
        animation-duration: ${Math.round(($durationMs || 720) * 0.72)}ms;
      }
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: ${({ $phase }) => ($phase === "a" ? 1 : 0)};
  }
`

const StaticPlateImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  user-select: none;
  pointer-events: none;
`

const ShoreOverlayStack = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
`

const ShoreTextLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${({ $z }) => $z};
  pointer-events: none;
`

/** Rematched section1 bottle: autonomous slow drift along the river, under shore copy. */
const ShoreBottleLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${({ $z }) => $z};
  pointer-events: none;
  overflow: hidden;
`

/**
 * Path: appear high on the right, drift mostly downward, then sweep left.
 * Progress and the three scroll-gates are driven in JS (see SHORE_BOTTLE_PATH).
 */
const ShoreBottleMount = styled.div`
  position: absolute;
  left: 104%;
  top: 10%;
  /* Same size as the sky bottle; scales with the art. */
  width: ${artPx(192)};
  transform: translate3d(-50%, -55%, 0);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;

  ${({ $playing }) =>
    $playing
      ? css`
          visibility: visible;
        `
      : css`
          opacity: 0;
          visibility: hidden;
        `}

  @media (prefers-reduced-motion: reduce) {
    ${({ $playing }) =>
      $playing
        ? css`
            /* Keep a quiet mid-path pose; no long drift. */
            visibility: visible;
            left: 92%;
            top: 48%;
            opacity: 0.9;
          `
        : css`
            visibility: hidden;
            opacity: 0;
          `}
  }
`

/** Match sky bottle display size (width set on mount vs shore box). */
const ShoreBottleSize = styled.div`
  width: 100%;
`

const shoreBottleRock = keyframes`
  0%,
  100% {
    transform: rotate(-5deg) translate3d(0, 0, 0);
  }
  50% {
    transform: rotate(5deg) translate3d(0, -4px, 0);
  }
`

const ShoreBottleRock = styled.div`
  width: 100%;
  transform-origin: 50% 70%;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.28));

  ${({ $playing }) =>
    $playing
      ? css`
          animation: ${shoreBottleRock} 2.4s ease-in-out infinite;
        `
      : css`
          animation: none;
        `}

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`

const ShoreBottleImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
`

/** Scroll-scrubbed bottle: above forest animals, under bushes (z:30). */
const MapBottleLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
`

const MapBottleMount = styled.div`
  position: absolute;
  top: ${MAP_BOTTLE_TOP_START}%;
  left: ${MAP_BOTTLE_LEFT_ENTER}%;
  width: ${artPx(176)};
  transform: translate3d(-50%, -50%, 0) scale(1);
  transform-origin: 50% 50%;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  will-change: left, top, opacity, transform;
`

const mapBottleRock = keyframes`
  0%,
  100% {
    transform: rotate(-4deg) translate3d(0, 0, 0);
  }
  50% {
    transform: rotate(4deg) translate3d(0, -3px, 0);
  }
`

const MapBottleRock = styled.div`
  width: 100%;
  transform-origin: 50% 70%;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.28));
  animation: ${mapBottleRock} 2.2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const MapBottleImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
`

/** Extra drop for the PETases + LOGAN lines (px at the 1440 reference). */
const SHORE_COPY_NUDGE = artPx(12)

/** Centered PETases line where the condition cards used to sit (top of shore). */
const ShorePetaseMount = styled.div`
  position: absolute;
  top: calc(-16% + ${SHORE_COPY_NUDGE});
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  width: ${artPx(768)};
  box-sizing: border-box;
  pointer-events: auto;
  text-align: center;

  /* Clear of the waterfall's right-hand column, which runs longer on phones. */
  ${phone} {
    top: calc(-20% + 1.75rem);
    width: 86%;
  }
`

const ShorePetaseBody = styled.p`
  margin: 0;
  color: #fff;
  font-family: var(--font-body);
  ${artFont(36)}
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: break-word;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.55),
    0 0 14px rgba(0, 0, 0, 0.35);

  ${phone} {
    font-size: 1rem;
  }
`

/** Sits on the sand bank (left/center of the shore art). */
const ShoreTextMount = styled.div`
  position: absolute;
  top: 14%;
  left: 5%;
  width: ${artPx(448)};
  box-sizing: border-box;
  pointer-events: none;

  ${phone} {
    top: 12%;
    left: 4%;
    width: 46%;
  }
`

const ShoreBody = styled.p`
  margin: 0;
  color: #0a0a0a;
  font-family: var(--font-body);
  ${artFont(31.68)}
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: break-word;

  ${phone} {
    font-size: 0.95rem;
  }
`

/** Short line on the right, along the bottle’s downward path (between LOGAN and RNAlab). */
const ShoreMidTextMount = styled.div`
  position: absolute;
  top: 42%;
  right: 5%;
  left: auto;
  width: ${artPx(448)};
  box-sizing: border-box;
  pointer-events: none;
  text-align: center;

  ${phone} {
    top: 40%;
    right: 4%;
    width: 44%;
  }
`

const ShoreMidBody = styled.p`
  margin: 0;
  color: #fff;
  font-family: var(--font-body);
  ${artFont(33.12)}
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: break-word;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.55),
    0 0 14px rgba(0, 0, 0, 0.35);

  ${phone} {
    font-size: 0.95rem;
  }
`

/** Condition cards + “...3 specific conditions” on the lower sand. */
const ShoreCardsMount = styled.div`
  pointer-events: none;

  /* SwipeInBox AnchoredStage defaults to top: -16% (old card slot). */
  & > div {
    top: 70%;
  }

  /* Scales with the shore art; 1100px wide at the 1440 reference. */
  & > div > div {
    width: ${artPx(1100)};
    box-sizing: border-box;
    padding: ${artPx(20)} ${artPx(28)};
  }

  & h3 {
    ${artFont(34.56)}
  }

  ${phone} {
    & > div > div {
      width: 94%;
      padding: 0.5rem 0.6rem;
    }

    & h3 {
      font-size: 1rem;
    }
  }
`

/** Centered LOGAN line just above the world map. */
const ShoreLoganMount = styled.div`
  position: absolute;
  top: auto;
  bottom: calc(-14% - ${SHORE_COPY_NUDGE});
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  width: ${artPx(736)};
  box-sizing: border-box;
  pointer-events: none;
  text-align: center;

  ${phone} {
    width: 84%;
  }
`

const ShoreLoganBody = styled.p`
  margin: 0;
  color: #0a0a0a;
  font-family: var(--font-body);
  ${artFont(31.68)}
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: break-word;

  ${phone} {
    font-size: 0.9rem;
  }
`

/** Dataset line left of the walker; opacity driven by walk progress. */
const ForestDatasetMount = styled.div`
  position: absolute;
  top: 66%;
  left: 8%;
  width: ${artPx(264)};
  box-sizing: border-box;
  pointer-events: none;
  text-align: left;
  opacity: 0;

  /* Just above the explorer's head (desktop spot is beside him; too narrow here). */
  ${phone} {
    top: 45%;
    left: 4%;
    width: 44%;
  }
`

const ForestDatasetBody = styled.p`
  margin: 0;
  color: #0a0a0a;
  font-family: var(--font-body);
  ${artFont(31.68)}
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: break-word;
  pointer-events: none;

  ${phone} {
    font-size: 0.8rem;
  }
`

/** RNAlab payoff on the walker's right; swaps in when the bang pops. */
const ForestRnalabMount = styled.div`
  position: absolute;
  top: 66%;
  right: 9%;
  width: ${artPx(480)};
  box-sizing: border-box;
  text-align: left;
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  transform: translate3d(${({ $show }) => ($show ? "0" : "20px")}, 0, 0);
  transition:
    opacity 520ms ease 180ms,
    transform 560ms cubic-bezier(0.22, 1.2, 0.36, 1) 180ms;
  pointer-events: ${({ $interactive }) => ($interactive ? "auto" : "none")};

  p,
  button {
    pointer-events: ${({ $interactive }) =>
      $interactive ? "auto" : "none"};
  }

  ${phone} {
    top: 45%;
    right: 3%;
    width: 46%;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

/** RNAlab copy on the cream pad below the bushes. */
const CreamPadTextMount = styled.div`
  position: absolute;
  top: 18%;
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  width: ${artPx(768)};
  box-sizing: border-box;
  pointer-events: auto;
  text-align: center;

  ${phone} {
    width: 88%;
  }
`

const CreamPadBody = styled.p`
  margin: 0;
  color: #0a0a0a;
  font-family: var(--font-body);
  ${artFont(31.68)}
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: break-word;

  ${phone} {
    font-size: 0.9rem;
  }
`

const ConditionImageRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${artPx(28)};
  margin-top: ${artPx(28)};
  align-items: start;

  /* Keep all 3 cards visible together (no swipe) on phones too. */
  ${phone} {
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
`

const ConditionFigure = styled.figure`
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${artPx(8.8)};
  min-width: 0;

  ${phone} {
    gap: 0.3rem;
  }
`

const ConditionImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  max-height: ${artPx(384)};
  object-fit: contain;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35))
    drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));

  ${phone} {
    max-height: 22vw;
  }
`

const ConditionCaption = styled.figcaption`
  margin: 0;
  color: #fff;
  font-family: var(--font-body);
  ${artFont(29.6)}
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.55),
    0 0 12px rgba(0, 0, 0, 0.35);

  ${phone} {
    font-size: 0.75rem;
  }
`

const RailImg = styled.img`
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  user-select: none;
  pointer-events: none;
`

const ParallaxBack = styled.div`
  width: 100%;
  will-change: auto;

  @media (prefers-reduced-motion: reduce) {
    transform: none !important;
    will-change: auto;
  }
`

const BackRailImg = styled(RailImg)`
  transform: scale(1.04);
  transform-origin: center top;
`

const BirdsStack = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: auto;
  overflow: hidden;
`

const BirdParallax = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${({ $z }) => $z ?? 1};
  will-change: auto;
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    transform: none !important;
    will-change: auto;
  }
`

const birdFlapA = keyframes`
  0%,
  49.9% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
`

const birdFlapB = keyframes`
  0%,
  49.9% {
    opacity: 0;
  }
  50%,
  100% {
    opacity: 1;
  }
`

const birdHoverBob = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -10px, 0);
  }
`

const birdHoverBobStrong = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(0, -18px, 0) scale(1.02);
  }
`

const birdFlyAcross = keyframes`
  0%,
  18% {
    transform: translate3d(0, 0, 0);
  }
  72% {
    transform: translate3d(-115%, 0, 0);
  }
  72.01% {
    transform: translate3d(115%, 0, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
`

const BirdDrift = styled.div`
  position: absolute;
  inset: 0;

  ${({ $enabled, $durationMs, $delayMs }) =>
    $enabled &&
    css`
      animation: ${birdFlyAcross} ${$durationMs || 36000}ms linear infinite;
      animation-delay: ${$delayMs || 0}ms;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const BirdHoverMotion = styled.div`
  position: absolute;
  inset: 0;
  transform-origin: center center;
  animation: ${birdHoverBob} 3.6s ease-in-out infinite;
  animation-delay: ${({ $delayMs }) => `${($delayMs || 0) * 0.5}ms`};

  ${BirdsStack}:hover & {
    animation-name: ${birdHoverBobStrong};
    animation-duration: 2.4s;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const BirdFlapper = styled.div`
  position: absolute;
  inset: 0;
`

const BirdFrame = styled.img`
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  user-select: none;
  pointer-events: none;
  opacity: ${({ $phase }) => ($phase === "a" ? 1 : 0)};
  animation-name: ${({ $phase }) => ($phase === "a" ? birdFlapA : birdFlapB)};
  animation-duration: ${({ $durationMs }) => `${$durationMs || 520}ms`};
  animation-delay: ${({ $delayMs }) => `${$delayMs || 0}ms`};
  animation-timing-function: steps(1, end);
  animation-iteration-count: infinite;

  ${BirdsStack}:hover & {
    animation-duration: ${({ $durationMs }) =>
      `${Math.round(($durationMs || 520) * 0.72)}ms`};
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: ${({ $phase }) => ($phase === "a" ? 1 : 0)};
  }
`

const OverlayStack = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
`

const OverlaySlice = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${({ $z }) => $z};
  display: flex;
  align-items: flex-start;
  justify-content: center;
  pointer-events: ${({ $interactive }) => ($interactive ? "auto" : "none")};
  overflow: visible;
`

/** Legacy water plate, shifted so the puddle blob covers the waterfall basin. */
const PuddleImg = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  transform: translateY(
    ${({ $under }) =>
      PUDDLE_SHIFT_Y_PCT + ($under ? PUDDLE_UNDER_SHIFT_PCT : 0)}%
  );
  user-select: none;
  pointer-events: none;
`

/** Nudge PETABITE title up within the legacy art band (negative = higher). */
const LOGO_SHIFT_FRAC = -0.38

const logoIdleFloat = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -7px, 0);
  }
`

const bottleIdleFloat = keyframes`
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -5px, 0);
  }
`

/** Very slow, subtle sway only while the bottle is in touch "sticky" (fixed) mode. */
const bottleStickyRock = keyframes`
  0%,
  100% {
    transform: rotate(-10deg);
  }
  50% {
    transform: rotate(10deg);
  }
`

/** Subtle idle rotation while bottle is pinned (fixed); off during normal scroll. */
const BottleStickyRock = styled.div`
  width: 100%;
  transform-origin: 50% 42%;

  ${({ $active }) =>
    $active
      ? css`
          animation: ${bottleStickyRock} 2s ease-in-out infinite;
        `
      : css`
          animation: none;
        `}

  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`

const LogoShiftWrap = styled.div`
  width: 100%;
  height: 100%;
  transform: translate3d(0, ${LOGO_SHIFT_FRAC * 100}%, 0);
`

/** Float is held until the loader's logo lands here (see logoHandoff). */
const LogoFloatWrap = styled.div`
  width: 100%;
  animation: ${logoIdleFloat} 4.2s ease-in-out infinite;
  animation-play-state: ${({ $landed }) => ($landed ? "running" : "paused")};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/** Stacked frames; first image stays in-flow so the rail keeps its height. */
const LogoFlapper = styled.div`
  position: relative;
  width: 100%;
  visibility: ${({ $landed }) => ($landed ? "visible" : "hidden")};
`

/** Owns FLIP `transform` so parent pin spot can stay `position: fixed` without fighting this layer. */
const BottleFlipSurface = styled.div`
  width: 100%;
`

/** Scroll-driven sink slide (separate from FLIP transform on BottleFlipSurface). */
const BottleSinkMotion = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  will-change: transform;
`

/** Scroll touch: pins bottle to viewport center while stack scrolls; releases near page bottom. */
const BottlePinSpot = styled.div`
  width: 100%;
  pointer-events: none;

  ${({ $touchPinned }) =>
    $touchPinned
      ? css`
          position: fixed;
          left: 0;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          z-index: 95;
        `
      : css`
          position: absolute;
          left: 0;
          right: 0;
          top: ${BOTTLE_TOP_FRAC * 100}%;
        `}
`

/** Centers the bottle; inner wrap adds idle float. */
const BottleShiftWrap = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`

const BottleFloatWrap = styled.div`
  position: relative;
  /* Scales with the art (192px at the 1440 reference), phones included. */
  width: ${artPx(192)};
  animation: ${bottleIdleFloat} 1.5s ease-in-out infinite;
  animation-delay: -0.7s;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/** Opacity target for the sky bottle image (splash stays as a sibling so it can play). */
const BottleVisual = styled.div`
  width: 100%;
  will-change: opacity;
`

const splashBurst = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.55);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.05);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.2);
  }
`

const splashRipple = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.2);
    opacity: 0.95;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.85);
    opacity: 0;
  }
`

const splashDrop = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0.55);
    opacity: 1;
  }
  40% {
    opacity: 0.95;
  }
  100% {
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2);
    opacity: 0;
  }
`

const splashFoam = keyframes`
  0% {
    transform: translate(-50%, -40%) scale(0.4);
    opacity: 0;
  }
  20% {
    opacity: 0.9;
  }
  100% {
    transform: translate(-50%, -70%) scale(1.35);
    opacity: 0;
  }
`

/** Splash anchored on the first art band at the river / puddle start. */
const WaterfallSplashAnchor = styled.div`
  position: absolute;
  left: ${WATERFALL_SPLASH_LEFT_PCT}%;
  top: ${WATERFALL_SPLASH_TOP_PCT}%;
  z-index: 6;
  width: ${artPx(224)};
  height: ${artPx(128)};
  transform: translate(-50%, -50%);
  pointer-events: none;
  overflow: visible;
  animation: ${splashBurst} ${BOTTLE_SPLASH_MS}ms ease-out forwards;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`

const SplashRipple = styled.span`
  position: absolute;
  left: 50%;
  top: 58%;
  width: ${({ $large }) => ($large ? "95%" : "70%")};
  aspect-ratio: 2.2 / 1;
  border: ${({ $large }) => ($large ? "3px" : "2.5px")} solid
    rgba(230, 248, 255, ${({ $large }) => ($large ? 0.55 : 0.95)});
  border-radius: 50%;
  box-shadow:
    0 0 18px rgba(190, 230, 255, 0.65),
    inset 0 0 12px rgba(255, 255, 255, 0.35);
  animation: ${splashRipple} ${BOTTLE_SPLASH_MS}ms ease-out forwards;
  animation-delay: ${({ $delay }) => `${$delay || 0}ms`};
`

const SPLASH_DROP_OFFSETS = [
  { dx: "-28px", dy: "-42px" },
  { dx: "24px", dy: "-46px" },
  { dx: "-42px", dy: "-14px" },
  { dx: "40px", dy: "-12px" },
  { dx: "0px", dy: "-54px" },
  { dx: "-16px", dy: "-30px" },
  { dx: "18px", dy: "-28px" },
]

const SplashDrop = styled.span`
  position: absolute;
  left: 50%;
  top: 52%;
  width: 14px;
  height: 20px;
  border-radius: 50% 50% 45% 45%;
  background: radial-gradient(
    circle at 35% 30%,
    #ffffff 0%,
    #b7e6f8 50%,
    #4a9fc4 100%
  );
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
  --dx: ${({ $n }) => SPLASH_DROP_OFFSETS[$n]?.dx || "0px"};
  --dy: ${({ $n }) => SPLASH_DROP_OFFSETS[$n]?.dy || "-36px"};
  animation: ${splashDrop} ${BOTTLE_SPLASH_MS}ms ease-out forwards;
  animation-delay: ${({ $n }) => `${($n || 0) * 30}ms`};
`

const SplashFoam = styled.span`
  position: absolute;
  left: 50%;
  top: 55%;
  width: 78%;
  height: 42%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(180, 225, 245, 0.55) 42%,
    rgba(120, 190, 220, 0) 72%
  );
  filter: blur(1px);
  animation: ${splashFoam} ${BOTTLE_SPLASH_MS}ms ease-out forwards;
`
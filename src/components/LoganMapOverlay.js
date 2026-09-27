import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { withPrefix } from "gatsby"
import styled from "styled-components"
import snapshot from "../data/logan-map-locations.json"

/**
 * Mercator crop matched to the painted world map (no Antarctica in the art).
 * yScale stretches or shortens pole-to-pole vs the paint; 1 = true Mercator.
 * Tune pads / lat range / yScale while `?mapCalibrate=1` is on.
 */
export const LOGAN_MAP_CAL = {
  padLeft: 0.015,
  padRight: 0.025,
  padTop: 0.02,
  padBottom: 0.04,
  latMax: 75,
  latMin: -52,
  yScale: 1,
  shiftX: -0.03,
}

const MERCATOR_LIMIT = 85.051129
/** OSM web-mercator zoom-0 tile, used only when `?mapCalibrate=1`. */
const WORLD_TILE_SRC = "/homepage/world-map-reference.png"
const PIN_SRC =
  "https://static.igem.wiki/teams/6187/wiki/homepage-components/pin.avif"
/**
 * The CDN pin is a large padded frame; only this inner box is the marker.
 * Tip is the bottom-center of that box (anchor for lat/lng).
 */
const PIN_FRAME = { w: 2238, h: 3132 }
const PIN_CROP = { x: 968, y: 1260, w: 169, h: 353 }
const PIN_ASPECT = PIN_CROP.w / PIN_CROP.h
const CARD_Z = 102
const CARD_WIDTH = 228

function mercatorY(lat) {
  const clamped = Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat))
  const rad = (clamped * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

const MERC_WORLD_MAX = mercatorY(MERCATOR_LIMIT)
const MERC_WORLD_SPAN = MERC_WORLD_MAX * 2

function lngLatToPct(lng, lat, cal = LOGAN_MAP_CAL) {
  if (lat < cal.latMin - 8 || lat > cal.latMax + 8) return null
  const innerW = 1 - cal.padLeft - cal.padRight
  const innerH = 1 - cal.padTop - cal.padBottom
  const wrapped = ((((lng + 180) % 360) + 360) % 360) / 360
  const clampedLat = Math.max(cal.latMin, Math.min(cal.latMax, lat))
  const yTop = mercatorY(cal.latMax)
  const yBot = mercatorY(cal.latMin)
  const rawY = (yTop - mercatorY(clampedLat)) / Math.max(1e-6, yTop - yBot)
  const y = 0.5 + (rawY - 0.5) * (cal.yScale ?? 1)
  return {
    left: (cal.padLeft + wrapped * innerW + (cal.shiftX ?? 0)) * 100,
    top: (cal.padTop + y * innerH + (cal.shiftY ?? 0)) * 100,
  }
}

function worldTileCrop(cal = LOGAN_MAP_CAL) {
  const topFrac = (MERC_WORLD_MAX - mercatorY(cal.latMax)) / MERC_WORLD_SPAN
  const heightFrac =
    (mercatorY(cal.latMax) - mercatorY(cal.latMin)) / MERC_WORLD_SPAN
  const yScale = cal.yScale ?? 1
  return {
    left: `${(cal.padLeft + (cal.shiftX ?? 0)) * 100}%`,
    top: `${cal.padTop * 100}%`,
    width: `${(1 - cal.padLeft - cal.padRight) * 100}%`,
    height: `${(1 - cal.padTop - cal.padBottom) * 100}%`,
    imgHeight: `${(1 / Math.max(1e-6, heightFrac)) * 100}%`,
    imgTop: `${(-topFrac / Math.max(1e-6, heightFrac)) * 100}%`,
    transform: yScale === 1 ? undefined : `scaleY(${yScale})`,
  }
}

function rankedUniq(values) {
  const counts = new Map()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
}

/**
 * NCBI country / location_name often disagrees with the GPS. Drop labels
 * that cannot be where the coordinates actually are.
 */
function labelFitsCoords(label, lat, lng) {
  if (!label) return false
  const text = String(label).toLowerCase()
  if (text.includes("antarctica")) return lat < -60
  if (text.includes("svalbard")) return lat > 74
  if (text.includes("iceland")) {
    return lat > 62 && lat < 68 && lng > -26 && lng < -12
  }
  if (text.includes("greenland")) {
    return lat > 59 && lng > -75 && lng < -10
  }
  if (text.includes("czech")) {
    return lat > 48 && lat < 52 && lng > 12 && lng < 19
  }
  if (text.includes("korea")) {
    return lat > 33 && lat < 39 && lng > 124 && lng < 132
  }
  if (text.includes("israel")) {
    return lat > 29 && lat < 34 && lng > 34 && lng < 36.6
  }
  if (/\bitaly\b/.test(text)) {
    return lat > 36 && lat < 48 && lng > 6 && lng < 19
  }
  if (/\bspain\b/.test(text)) {
    return lat > 35 && lat < 44 && lng > -10 && lng < 5
  }
  if (text.includes("cyprus")) {
    return lat > 34 && lat < 36 && lng > 32 && lng < 35
  }
  if (
    text.includes("australia") ||
    text.startsWith("au:") ||
    text.includes("nsw")
  ) {
    return lat < -10 && lat > -45 && lng > 112 && lng < 155
  }
  if (text.includes("south china sea")) {
    return lat > 0 && lat < 25 && lng > 102 && lng < 122
  }
  if (text.includes("china")) {
    return lat > 18 && lat < 54 && lng > 73 && lng < 135
  }
  return true
}

function continentFitsCoords(continent, lat, lng) {
  if (!continent) return false
  if (continent === "Antarctica") return lat < -60
  if (continent === "North America") return lng <= -50 && lat > 7 && lat < 85
  if (continent === "South America") {
    return lng < -30 && lng > -95 && lat <= 15 && lat > -60
  }
  if (continent === "Europe") return lng > -25 && lng < 42 && lat > 34 && lat < 73
  if (continent === "Africa") return lng > -20 && lng < 52 && lat > -36 && lat < 38
  if (continent === "Asia") return lng > 26 && lat > -12 && lat < 82
  if (continent === "Oceania") return lng > 110 && lat < 0 && lat > -50
  return true
}

function formatCoords(lat, lng) {
  const ns = lat >= 0 ? "N" : "S"
  const ew = lng >= 0 ? "E" : "W"
  return `${Math.abs(lat).toFixed(1)}°${ns}, ${Math.abs(lng).toFixed(1)}°${ew}`
}

function clusterLocations(locations, decimals = 1) {
  const buckets = new Map()
  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue
    const key = `${Number(loc.latitude).toFixed(decimals)}|${Number(
      loc.longitude,
    ).toFixed(decimals)}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        id: key,
        latitude: loc.latitude,
        longitude: loc.longitude,
        count: 0,
        samples: [],
      }
      buckets.set(key, bucket)
    }
    bucket.count += 1
    bucket.latitude += (loc.latitude - bucket.latitude) / bucket.count
    bucket.longitude += (loc.longitude - bucket.longitude) / bucket.count
    bucket.samples.push(loc)
  }
  return [...buckets.values()].map(bucket => ({
    id: bucket.id,
    latitude: bucket.latitude,
    longitude: bucket.longitude,
    count: bucket.count,
    countries: rankedUniq(bucket.samples.map(s => s.country)),
    continents: rankedUniq(bucket.samples.map(s => s.continent)),
    organisms: rankedUniq(bucket.samples.map(s => s.organism)),
    locationNames: rankedUniq(bucket.samples.map(s => s.location_name)),
    accessions: rankedUniq(bucket.samples.map(s => s.accession)),
  }))
}

function pinSize(count) {
  const height = Math.min(46, 13 + Math.sqrt(count) * 5.1)
  return { height, width: height * PIN_ASPECT }
}

function cardCopy(point) {
  const lat = point.latitude
  const lng = point.longitude
  const locationNames = point.locationNames.filter(name =>
    labelFitsCoords(name, lat, lng),
  )
  const countries = point.countries.filter(country =>
    labelFitsCoords(country, lat, lng),
  )
  const continents = point.continents.filter(continent =>
    continentFitsCoords(continent, lat, lng),
  )
  const coordOnly = !locationNames[0] && !countries[0]
  const title = locationNames[0] || countries[0] || formatCoords(lat, lng)
  const place = coordOnly
    ? ""
    : [countries.find(c => c && !title.includes(c)), continents[0]]
        .filter(Boolean)
        .join(" · ")
  const organisms = point.organisms.slice(0, 3)
  const extraOrganisms = point.organisms.length - organisms.length
  const accessions = point.accessions.slice(0, 2)
  const extraAccessions = point.accessions.length - accessions.length
  return {
    title,
    place,
    coordOnly,
    organisms,
    extraOrganisms,
    accessions,
    extraAccessions,
  }
}

function cardLayout(rect) {
  if (typeof window === "undefined" || !rect) {
    return { left: 0, top: 0, place: "above" }
  }
  const pad = 10
  const estimateH = 168
  let left = rect.left + rect.width / 2 - CARD_WIDTH / 2
  left = Math.min(
    Math.max(left, pad),
    window.innerWidth - CARD_WIDTH - pad,
  )
  const above = rect.top - 10 - estimateH
  if (above >= pad) {
    return { left, top: rect.top - 10, place: "above" }
  }
  return { left, top: rect.bottom + 10, place: "below" }
}

const CLUSTERED_POINTS = clusterLocations(snapshot.locations || [])
const MAPPED_POINTS = CLUSTERED_POINTS.map(point => ({
  point,
  pos: lngLatToPct(point.longitude, point.latitude),
})).filter(entry => entry.pos)

function HoverCard({ hover, onKeep, onClose }) {
  const copy = cardCopy(hover.point)
  const layout = cardLayout(hover.rect)
  return (
    <PinCard
      role="tooltip"
      data-logan-pin-card="1"
      $place={layout.place}
      style={{ left: `${layout.left}px`, top: `${layout.top}px` }}
      onMouseEnter={onKeep}
      onMouseLeave={onClose}
    >
      <PinCardTitle>{copy.title}</PinCardTitle>
      {copy.coordOnly ? (
        <PinCardNote>
          Archive place name doesn&apos;t match these coordinates, so this pin
          is plotted by GPS only.
        </PinCardNote>
      ) : copy.place ? (
        <PinCardMeta>{copy.place}</PinCardMeta>
      ) : null}
      <PinCardCount>
        {hover.point.count === 1
          ? "1 sample"
          : `${hover.point.count} samples`}
      </PinCardCount>
      {copy.organisms.length ? (
        <PinCardRow>
          {copy.organisms.join(" · ")}
          {copy.extraOrganisms > 0 ? ` +${copy.extraOrganisms}` : ""}
        </PinCardRow>
      ) : null}
      {copy.accessions.length ? (
        <PinCardAccession>
          {copy.accessions.join(", ")}
          {copy.extraAccessions > 0 ? ` +${copy.extraAccessions}` : ""}
        </PinCardAccession>
      ) : null}
    </PinCard>
  )
}

export default function LoganMapOverlay() {
  const [calibrate, setCalibrate] = useState(false)
  const [hover, setHover] = useState(null)
  const [keyboardPinId, setKeyboardPinId] = useState(
    MAPPED_POINTS[0]?.point.id ?? null,
  )
  const hoverTimer = useRef(null)
  const pinRefs = useRef(new Map())
  const crop = useMemo(() => worldTileCrop(), [])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const sync = () => {
      const params = new URLSearchParams(window.location.search)
      setCalibrate(params.get("mapCalibrate") === "1")
    }
    sync()
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [])

  useEffect(() => {
    if (!hover) return undefined
    const update = () => {
      const el = hover.el
      if (!el || typeof el.getBoundingClientRect !== "function") return
      const rect = el.getBoundingClientRect()
      setHover(current =>
        current && current.id === hover.id ? { ...current, rect } : current,
      )
    }
    const onPointerDown = event => {
      const target = event.target
      if (hover.el && hover.el.contains(target)) return
      if (target instanceof Element && target.closest("[data-logan-pin-card]")) {
        return
      }
      setHover(null)
    }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    window.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      window.removeEventListener("pointerdown", onPointerDown)
    }
  }, [hover?.id, hover?.el])

  const openHover = (point, el) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    setHover({ id: point.id, point, el, rect: el.getBoundingClientRect() })
  }

  const closeHover = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHover(null), 80)
  }

  const moveKeyboardFocus = (event, currentIndex) => {
    let nextIndex
    if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = MAPPED_POINTS.length - 1
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + MAPPED_POINTS.length) % MAPPED_POINTS.length
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % MAPPED_POINTS.length
    } else {
      return
    }

    event.preventDefault()
    const nextId = MAPPED_POINTS[nextIndex]?.point.id
    if (!nextId) return
    setKeyboardPinId(nextId)
    pinRefs.current.get(nextId)?.focus()
  }

  return (
    <MapOverlayRoot
      role="group"
      aria-label="LOGAN sample locations. Use arrow keys to move between pins."
    >
      {calibrate ? (
        <CalibrateFrame
          style={{
            left: crop.left,
            top: crop.top,
            width: crop.width,
            height: crop.height,
            transform: crop.transform,
          }}
        >
          <CalibrateImg
            src={withPrefix(WORLD_TILE_SRC)}
            alt=""
            style={{ height: crop.imgHeight, top: crop.imgTop }}
          />
        </CalibrateFrame>
      ) : null}
      {MAPPED_POINTS.map(({ point, pos }, index) => {
        const size = pinSize(point.count)
        const copy = cardCopy(point)
        const active = hover?.id === point.id
        return (
          <MapPin
            key={point.id}
            ref={element => {
              if (element) pinRefs.current.set(point.id, element)
              else pinRefs.current.delete(point.id)
            }}
            type="button"
            tabIndex={keyboardPinId === point.id ? 0 : -1}
            aria-label={`${copy.title}. ${point.count} sample${
              point.count === 1 ? "" : "s"
            }`}
            $active={active}
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              width: `${size.width}px`,
              height: `${size.height}px`,
              zIndex: active ? 24 : Math.min(20, point.count),
            }}
            onMouseEnter={event => openHover(point, event.currentTarget)}
            onMouseLeave={closeHover}
            onFocus={event => {
              setKeyboardPinId(point.id)
              openHover(point, event.currentTarget)
            }}
            onBlur={closeHover}
            onClick={event => openHover(point, event.currentTarget)}
            onKeyDown={event => moveKeyboardFocus(event, index)}
          >
            <MapPinImg src={PIN_SRC} alt="" draggable="false" />
          </MapPin>
        )
      })}
      {hover && typeof document !== "undefined"
        ? createPortal(
            <HoverCard
              hover={hover}
              onKeep={() => {
                if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
              }}
              onClose={closeHover}
            />,
            document.body,
          )
        : null}
    </MapOverlayRoot>
  )
}

const MapOverlayRoot = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
`

const CalibrateFrame = styled.div`
  position: absolute;
  overflow: hidden;
  opacity: 0.42;
  mix-blend-mode: multiply;
  transform-origin: center center;
`

const CalibrateImg = styled.img`
  position: absolute;
  left: 0;
  width: 100%;
  max-width: none;
  display: block;
  pointer-events: none;
  user-select: none;
`

const MapPin = styled.button`
  position: absolute;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  overflow: hidden;
  contain: layout style;
  transform: translate3d(-50%, -100%, 0)
    scale(${({ $active }) => ($active ? 1.12 : 1)});
  transform-origin: 50% 100%;
  filter: drop-shadow(0 1px 1px rgba(40, 24, 10, 0.35));
  appearance: none;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: 2px solid #3c5a3a;
    outline-offset: 2px;
  }
`

const MapPinImg = styled.img`
  position: absolute;
  display: block;
  max-width: none;
  width: ${(PIN_FRAME.w / PIN_CROP.w) * 100}%;
  height: ${(PIN_FRAME.h / PIN_CROP.h) * 100}%;
  left: ${(-PIN_CROP.x / PIN_CROP.w) * 100}%;
  top: ${(-PIN_CROP.y / PIN_CROP.h) * 100}%;
  pointer-events: none;
  user-select: none;
`

const PinCard = styled.div`
  position: fixed;
  z-index: ${CARD_Z};
  width: ${CARD_WIDTH}px;
  padding: 0.7rem 0.8rem 0.75rem;
  transform: translate3d(
    0,
    ${({ $place }) => ($place === "above" ? "-100%" : "0")},
    0
  );
  background: #f7eed8;
  color: #3b2a18;
  border: 1px solid rgba(90, 62, 32, 0.22);
  border-radius: 10px;
  box-shadow:
    0 10px 24px rgba(40, 24, 10, 0.18),
    0 1px 0 rgba(255, 248, 232, 0.7) inset;
  pointer-events: auto;
`

const PinCardTitle = styled.p`
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.98rem;
  line-height: 1.2;
`

const PinCardMeta = styled.p`
  margin: 0.18rem 0 0;
  font-family: var(--font-body);
  font-size: 0.72rem;
  color: #6a5640;
`

const PinCardNote = styled.p`
  margin: 0.22rem 0 0;
  font-family: var(--font-body);
  font-size: 0.64rem;
  line-height: 1.35;
  color: #8a7358;
`

const PinCardCount = styled.p`
  margin: 0.38rem 0 0;
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #4d6a46;
`

const PinCardRow = styled.p`
  margin: 0.28rem 0 0;
  font-family: var(--font-body);
  font-size: 0.78rem;
  line-height: 1.35;
`

const PinCardAccession = styled.p`
  margin: 0.22rem 0 0;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  line-height: 1.35;
  color: #6a5640;
  word-break: break-all;
`

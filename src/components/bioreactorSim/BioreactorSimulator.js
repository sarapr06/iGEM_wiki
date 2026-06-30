import React, { useState, useEffect, useRef } from "react"
import styled, { css, keyframes } from "styled-components"

// ── Colour utilities ──────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t }
function lerpRgb([r1,g1,b1],[r2,g2,b2],t) {
  return [lerp(r1,r2,t), lerp(g1,g2,t), lerp(b1,b2,t)]
}
function toHex([r,g,b]) {
  return "#" + [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("")
}
function toRgba([r,g,b],a) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`
}
function colourAt(stops, val) {
  if (val <= stops[0].v) return [...stops[0].c]
  const last = stops[stops.length-1]
  if (val >= last.v) return [...last.c]
  for (let i = 1; i < stops.length; i++) {
    if (val <= stops[i].v) {
      const t = (val - stops[i-1].v) / (stops[i].v - stops[i-1].v)
      return lerpRgb(stops[i-1].c, stops[i].c, t)
    }
  }
  return [...last.c]
}

// Temperature 10–60 °C  →  yellow@20, orange@40, red@60
const TEMP_STOPS = [
  { v: 10, c: [215, 238, 252] },
  { v: 20, c: [255, 229, 100] },
  { v: 40, c: [255, 138,  58] },
  { v: 60, c: [238,  52,  52] },
]

// pH 0–14 — litmus paper colours from the design brief
const PH_STOPS = [
  { v:  0, c: [255, 148, 175] }, // pink
  { v:  3, c: [255, 160,  98] }, // orange
  { v:  6, c: [118, 200, 118] }, // green
  { v:  9, c: [88,  158, 222] }, // blue
  { v: 12, c: [98,   96, 175] }, // indigo
  { v: 14, c: [155,  95, 235] }, // purple
]

// ── OD growth model (Ideonella sakaiensis PETase, logistic) ───────────────────
// Optimum ≈ 37 °C, pH 7.5  |  x-axis: 0–72 h  |  y-axis: OD600
//
// stirStrength: 0–1 continuous (animated), not a boolean — lets the curve
//   transition smoothly.  At 1: rate ×1.28, K ×1.18, inflection 5 h earlier.
// fillFrac: more water dilutes culture → lower OD (Beer-Lambert).
//   dilution = defaultFill(0.62) / currentFill  (only when fill > default)
function odCurve(temp, ph, stirStrength = 0, fillFrac = 0.62, nPts = 100, tMax = 72) {
  const tFac = Math.exp(-(((temp - 37) / 14) * ((temp - 37) / 14)))
  const pFac = Math.exp(-(((ph   - 7.5) / 2.2) * ((ph   - 7.5) / 2.2)))
  const fit  = Math.max(0.01, tFac * pFac)

  // Lerp curve parameters between no-stir (s=0) and full-stir (s=1)
  const K    = (0.05 + 2.0  * fit) * (1 + 0.18 * stirStrength)
  const r    = (0.04 + 0.22 * fit) * (1 + 0.28 * stirStrength)
  const tMid = (24  - 10   * fit)  - (5 * stirStrength)
  const OD0  = 0.05

  // Adding water dilutes the culture; default fill (0.62) = no dilution
  const dilution = fillFrac > 0.62 ? 0.62 / fillFrac : 1.0

  return Array.from({ length: nPts }, (_,i) => {
    const t  = (i / (nPts-1)) * tMax
    const od = K / (1 + ((K-OD0)/OD0) * Math.exp(-r*(t-tMid)))
    return { t, od: Math.max(OD0 * dilution, od * dilution) }
  })
}

// ── Animations ────────────────────────────────────────────────────────────────
const spinKf = keyframes`to { transform: rotate(360deg); }`
const shakeKf = keyframes`
  0%,100% { transform: translateX(0) rotate(0deg); }
  20%      { transform: translateX(2px) rotate(0.4deg); }
  40%      { transform: translateX(-2px) rotate(-0.4deg); }
  60%      { transform: translateX(2px) rotate(0.2deg); }
  80%      { transform: translateX(-1px) rotate(-0.2deg); }
`

// ── Component ─────────────────────────────────────────────────────────────────
export function BioreactorSimulator() {
  const [temp,     setTemp]     = useState(37)
  const [ph,       setPh]       = useState(7.5)
  const [stirring, setStirring] = useState(false)
  const [pumping,  setPumping]  = useState(false)
  const [ledOn,    setLedOn]    = useState(true)
  const [fillFrac,    setFillFrac]    = useState(0.62)
  const [stirStrength, setStirStrength] = useState(0)  // 0–1, animated

  const graphRef     = useRef(null)
  const stirStrRef   = useRef(0)  // tracks live value for RAF closure

  function resetBeaker() {
    setPumping(false)
    setStirring(false)
    setLedOn(true)
    setFillFrac(0.62)
  }

  // Smoothly animate stirStrength toward its target over ~1.1 s
  useEffect(() => {
    const target  = stirring ? 1 : 0
    const start   = stirStrRef.current
    const t0      = performance.now()
    const DURATION = 1100
    let rafId

    const tick = (now) => {
      const elapsed = Math.min(now - t0, DURATION)
      const p = elapsed / DURATION
      // ease-in-out-quad
      const eased = p < 0.5 ? 2*p*p : 1 - ((-2*p+2) * (-2*p+2)) / 2
      const val = start + (target - start) * eased
      stirStrRef.current = val
      setStirStrength(val)
      if (elapsed < DURATION) {
        rafId = requestAnimationFrame(tick)
      } else {
        stirStrRef.current = target
        setStirStrength(target)
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [stirring])  // eslint-disable-line react-hooks/exhaustive-deps

  // Pump fills beaker, auto-stops at 90 %
  useEffect(() => {
    if (!pumping) return
    const id = setInterval(() => {
      setFillFrac(f => {
        if (f >= 0.9) { setPumping(false); return 0.9 }
        return f + 0.003
      })
    }, 80)
    return () => clearInterval(id)
  }, [pumping])

  // Colours — temp and pH each drive the liquid independently, blended 50/50
  const tRgb   = colourAt(TEMP_STOPS, temp)
  const pRgb   = colourAt(PH_STOPS,   ph)
  // Liquid body: pH gives the visible colour (like a pH indicator dye),
  // temperature warms it toward the temp colour
  const lRgb   = lerpRgb(pRgb, tRgb, 0.45)
  const lHex   = toHex(lRgb)
  const lAlpha = toRgba(lRgb, 0.58)

  // SVG geometry — VW widened to 430 for label spacing; BY=68 keeps thermocouple clear
  const VW = 430, VH = 316
  const BX = 112, BY = 68, BW = 146, BH = 186
  const BCX = BX + BW/2
  const ERX = BW/2, ERY = 13
  const fillPx = BH * fillFrac
  const fillY  = BY + BH - fillPx

  const tPct = ((temp-10)/50*100).toFixed(1) + "%"
  const pPct = (ph/14*100).toFixed(1) + "%"

  // ── OD graph ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const cvs = graphRef.current
    if (!cvs) return

    // Scale the canvas buffer by devicePixelRatio so it's crisp on HiDPI screens
    const dpr  = window.devicePixelRatio || 1
    const CSS_W = 820, CSS_H = 220
    cvs.width  = CSS_W * dpr
    cvs.height = CSS_H * dpr
    cvs.style.width  = "100%"
    cvs.style.height = "auto"

    const ctx = cvs.getContext("2d")
    ctx.scale(dpr, dpr)

    const W = CSS_W, H = CSS_H
    const P = { t:28, r:28, b:46, l:56 }
    const PW = W-P.l-P.r, PH = H-P.t-P.b
    const T_MAX = 72, OD_MAX = 2.6   // raised ceiling to fit stirring boost

    ctx.clearRect(0,0,W,H)

    // Grid
    ctx.strokeStyle = "#f2f2f0"; ctx.lineWidth = 1
    for (let i=0; i<=5; i++) {
      const y = P.t + PH*i/5
      ctx.beginPath(); ctx.moveTo(P.l,y); ctx.lineTo(P.l+PW,y); ctx.stroke()
    }
    for (let i=0; i<=6; i++) {
      const x = P.l + PW*i/6
      ctx.beginPath(); ctx.moveTo(x,P.t); ctx.lineTo(x,P.t+PH); ctx.stroke()
    }

    // Axes
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(P.l,P.t); ctx.lineTo(P.l,P.t+PH); ctx.lineTo(P.l+PW,P.t+PH)
    ctx.stroke()

    const tx = t  => P.l + (t/T_MAX)*PW
    const ty = od => P.t + PH - (od/OD_MAX)*PH

    // Reference: unstirred baseline at optimal temp/pH/fill (dashed grey)
    const ref = odCurve(37, 7.5, 0, 0.62)
    ctx.beginPath()
    ref.forEach(({t,od},i) => i===0 ? ctx.moveTo(tx(t),ty(od)) : ctx.lineTo(tx(t),ty(od)))
    ctx.strokeStyle = "rgba(185,185,185,0.5)"; ctx.lineWidth = 1.5
    ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([])

    // Current curve — fill
    const curve = odCurve(temp, ph, stirStrength, fillFrac)
    ctx.beginPath()
    curve.forEach(({t,od},i) => i===0 ? ctx.moveTo(tx(t),ty(od)) : ctx.lineTo(tx(t),ty(od)))
    ctx.lineTo(tx(T_MAX),ty(0)); ctx.lineTo(tx(0),ty(0)); ctx.closePath()
    ctx.fillStyle = toRgba(lRgb, 0.13); ctx.fill()

    // Current curve — line
    ctx.beginPath()
    curve.forEach(({t,od},i) => i===0 ? ctx.moveTo(tx(t),ty(od)) : ctx.lineTo(tx(t),ty(od)))
    ctx.strokeStyle = lHex; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke()

    // Y labels
    ctx.fillStyle = "#9ca3af"; ctx.font = "11px system-ui,sans-serif"; ctx.textAlign = "right"
    for (let i=0; i<=5; i++) {
      ctx.fillText((OD_MAX*(5-i)/5).toFixed(2), P.l-6, P.t+PH*i/5+4)
    }
    // X labels
    ctx.textAlign = "center"
    for (let i=0; i<=6; i++) {
      ctx.fillText(`${Math.round(T_MAX*i/6)}h`, tx(T_MAX*i/6), P.t+PH+16)
    }
    // Axis titles
    ctx.fillStyle = "#6b7280"; ctx.font = "12px system-ui"
    ctx.fillText("time (hours)", P.l+PW/2, H-6)
    ctx.save(); ctx.translate(14,P.t+PH/2); ctx.rotate(-Math.PI/2)
    ctx.fillText("OD₆₀₀",0,0); ctx.restore()

    // Legend — current conditions
    const tags = [
      `${temp}°C`,
      `pH ${ph}`,
      stirring ? "stirring" : null,
      fillFrac > 0.63 ? `${Math.round(fillFrac*100)}% fill` : null,
    ].filter(Boolean).join(" · ")
    ctx.strokeStyle = lHex; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(P.l+8,P.t+12); ctx.lineTo(P.l+28,P.t+12); ctx.stroke()
    ctx.fillStyle = "#6b7280"; ctx.font = "10px system-ui"; ctx.textAlign = "left"
    ctx.fillText(tags, P.l+32, P.t+16)

    ctx.strokeStyle = "rgba(185,185,185,0.5)"; ctx.lineWidth = 1.5
    ctx.setLineDash([4,4])
    ctx.beginPath(); ctx.moveTo(P.l+8,P.t+26); ctx.lineTo(P.l+28,P.t+26); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = "#b0b0b0"
    ctx.fillText("optimal baseline (37 °C · pH 7.5 · no stir)", P.l+32, P.t+30)
  }, [temp, ph, stirring, stirStrength, fillFrac, lRgb, lHex])

  return (
    <Root>
      <TopRow>
      {/* ── Left column: beaker + physical controls ─────────────── */}
      <LeftCol>
        <BeakerCard $shaking={stirring}>
          <BeakerTopBar>
            <FillLabel>{Math.round(fillFrac*100)}% fill</FillLabel>
            <ResetButton onClick={resetBeaker} title="Reset beaker to defaults">↺ reset</ResetButton>
          </BeakerTopBar>
          <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ display:"block" }}>
            <defs>
              <clipPath id="bsim-liq-clip">
                <rect x={BX+2} y={BY+ERY} width={BW-4} height={BH-ERY} />
              </clipPath>
              {/* inner glow: bright white-yellow core */}
              <radialGradient id="bsim-led-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fffde7" stopOpacity="1"/>
                <stop offset="40%"  stopColor="#fef9c3" stopOpacity="0.85"/>
                <stop offset="100%" stopColor="#fef9c3" stopOpacity="0"/>
              </radialGradient>
              {/* outer bloom: wide soft halo */}
              <radialGradient id="bsim-led-bloom" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fef3c7" stopOpacity="0.55"/>
                <stop offset="50%"  stopColor="#fef9c3" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#fef9c3" stopOpacity="0"/>
              </radialGradient>
              {/* light beam through liquid: left=bright, right=absorbed */}
              <linearGradient id="bsim-beam" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#fffde7" stopOpacity="0.72"/>
                <stop offset="55%"  stopColor="#fef3c7" stopOpacity="0.22"/>
                <stop offset="100%" stopColor="#fef9c3" stopOpacity="0"/>
              </linearGradient>
              {/* clip beam to liquid region only (updates with fill level) */}
              <clipPath id="bsim-beam-clip">
                <rect x={BX+2} y={fillY} width={BW-4} height={fillPx}/>
              </clipPath>
              <marker id="bsim-arr" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
                <path d="M0,0 L5,2 L0,4 Z" fill="#9ca3af"/>
              </marker>
            </defs>

            {/* Heater coils */}
            <g opacity={temp > 28 ? 1 : 0.25}>
              {[0,1,2,3].map(i => (
                <path key={i}
                  d={`M${BX+14+i*30} ${BY+BH+8} Q${BX+29+i*30} ${BY+BH+20} ${BX+44+i*30} ${BY+BH+8}`}
                  fill="none"
                  stroke={temp>50 ? "#ef4444" : temp>35 ? "#f97316" : "#fbbf24"}
                  strokeWidth={2.5} strokeLinecap="round"
                />
              ))}
              <text x={BCX} y={BY+BH+32} fontSize={11} fill="#9ca3af" textAnchor="middle">heater</text>
            </g>

            {/* Stir bar — spins when on */}
            <g transform={`translate(${BCX},${BY+BH-12})`}>
              <StirBarRect
                x={-27} y={-6} width={54} height={12} rx={6}
                $spinning={stirring}
              />
            </g>

            {/* Liquid fill */}
            <g clipPath="url(#bsim-liq-clip)">
              <rect x={BX+2} y={fillY} width={BW-4} height={fillPx} fill={lAlpha}/>
              <ellipse cx={BCX} cy={fillY} rx={ERX-5} ry={ERY*0.44}
                fill={toRgba(lRgb,0.3)}/>
            </g>

            {/* Cylinder */}
            <line x1={BX}     y1={BY} x2={BX}     y2={BY+BH} stroke="#374151" strokeWidth={2}/>
            <line x1={BX+BW}  y1={BY} x2={BX+BW}  y2={BY+BH} stroke="#374151" strokeWidth={2}/>
            <ellipse cx={BCX} cy={BY}     rx={ERX} ry={ERY} fill="none" stroke="#374151" strokeWidth={1.5}/>
            <ellipse cx={BCX} cy={BY+BH}  rx={ERX} ry={ERY} fill="none" stroke="#374151" strokeWidth={2}/>

            {/* Thermocouple */}
            <line x1={BCX-9} y1={BY-30} x2={BCX-9} y2={BY+BH-22} stroke="#374151" strokeWidth={2.5}/>
            <line x1={BCX-5} y1={BY-30} x2={BCX-5} y2={BY+BH-22} stroke="#6b7280" strokeWidth={1}/>
            <path
              d={`M${BCX-7} ${BY-30} C${BCX+70} ${BY-86} ${BX+BW+143} ${BY+8} ${BX+BW+125} ${BY+56}`}
              fill="none" stroke="#374151" strokeWidth={1.5}
            />
            {/* Thermocouple label — left of the arc */}
            <line
              x1={BCX-22} y1={BY-40} x2={BCX-11} y2={BY-26}
              stroke="#9ca3af" strokeWidth={1} markerEnd="url(#bsim-arr)"
            />
            <text x={BCX-24} y={BY-44} fontSize={11} fill="#9ca3af" textAnchor="end">thermocouple</text>

            {/* Photodiodes */}
            <rect x={BX+BW-1} y={BY+BH*0.30} width={7} height={14} rx={1} fill="none" stroke="#374151" strokeWidth={1.5}/>
            <rect x={BX+BW-1} y={BY+BH*0.49} width={7} height={14} rx={1} fill="none" stroke="#374151" strokeWidth={1.5}/>
            {/* bracket: vertical bar + two arrows to diodes + label */}
            <line x1={BX+BW+20} y1={BY+BH*0.33} x2={BX+BW+20} y2={BY+BH*0.57} stroke="#9ca3af" strokeWidth={1}/>
            <line x1={BX+BW+20} y1={BY+BH*0.37} x2={BX+BW+6}  y2={BY+BH*0.37} stroke="#9ca3af" strokeWidth={1} markerEnd="url(#bsim-arr)"/>
            <line x1={BX+BW+20} y1={BY+BH*0.56} x2={BX+BW+6}  y2={BY+BH*0.56} stroke="#9ca3af" strokeWidth={1} markerEnd="url(#bsim-arr)"/>
            <line x1={BX+BW+20} y1={BY+BH*0.46} x2={BX+BW+24} y2={BY+BH*0.46} stroke="#9ca3af" strokeWidth={1}/>
            <text x={BX+BW+26} y={BY+BH*0.49} fontSize={11} fill="#9ca3af">photodiodes</text>

            {/* Temp sensor */}
            <rect x={BX+BW-1} y={BY+BH*0.66} width={13} height={10} rx={1} fill="none" stroke="#374151" strokeWidth={1.5}/>
            <line x1={BX+BW+24} y1={BY+BH*0.71} x2={BX+BW+12} y2={BY+BH*0.71} stroke="#9ca3af" strokeWidth={1} markerEnd="url(#bsim-arr)"/>
            <text x={BX+BW+26} y={BY+BH*0.74} fontSize={11} fill="#9ca3af">temp sensor</text>

            {/* LED glow + bulb */}
            {ledOn && (() => {
              const LCX = BX-28, LCY = BY+BH*0.44
              return (
                <>
                  {/* Outer bloom — pulses */}
                  <circle cx={LCX} cy={LCY} r={56} fill="url(#bsim-led-bloom)">
                    <animate attributeName="r"       values="52;66;52" dur="2.4s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="1;0.5;1"  dur="2.4s" repeatCount="indefinite"/>
                  </circle>
                  {/* Inner sharp glow — tighter pulse */}
                  <circle cx={LCX} cy={LCY} r={28} fill="url(#bsim-led-glow)" opacity={0.95}>
                    <animate attributeName="r" values="26;33;26" dur="2.4s" repeatCount="indefinite"/>
                  </circle>
                  {/* External beam: LED → beaker wall */}
                  <line x1={LCX+12} y1={LCY} x2={BX-1} y2={LCY}
                    stroke="#fde68a" strokeWidth={4} strokeLinecap="round" opacity={0.45}/>
                  <line x1={LCX+12} y1={LCY} x2={BX-1} y2={LCY}
                    stroke="#fffde7" strokeWidth={1.5} strokeLinecap="round" opacity={0.9}/>
                  {/* Internal beam through the liquid: fan-shaped, clipped to liquid */}
                  <g clipPath="url(#bsim-beam-clip)">
                    <path
                      d={`M${BX+2} ${LCY-9} L${BX+BW-2} ${LCY-20} L${BX+BW-2} ${LCY+20} L${BX+2} ${LCY+9} Z`}
                      fill="url(#bsim-beam)"
                    />
                  </g>
                </>
              )
            })()}
            {/* LED bulb — bigger and brighter when on */}
            <circle cx={BX-28} cy={BY+BH*0.44}
              r={ledOn ? 9 : 7}
              fill={ledOn ? "#fffde7" : "#e5e7eb"}
              stroke={ledOn ? "#f59e0b" : "#9ca3af"}
              strokeWidth={ledOn ? 2 : 1.5}
            />
            <text x={BX-42} y={BY+BH*0.44+26} fontSize={11} fill="#9ca3af" textAnchor="middle">white LED</text>

            {/* Pump — shifted right by 35px vs original */}
            <rect x={BX+BW+107} y={BY+40} width={38} height={42} rx={4}
              fill={pumping ? "#ede9fe" : "#f3f4f6"}
              stroke={pumping ? "#7c3aed" : "#9ca3af"}
              strokeWidth={1.5}
            />
            <rect x={BX+BW+115} y={BY+48} width={22} height={22} rx={2}
              fill={pumping ? "#c4b5fd" : "#e5e7eb"}
            />
            <text x={BX+BW+126} y={BY+96} fontSize={11} fill="#9ca3af" textAnchor="middle">pump</text>

            {/* Water flow drops */}
            {pumping && (
              <>
                <path id="bsim-flow"
                  d={`M${BX+BW+125} ${BY+56} C${BX+BW+143} ${BY+8} ${BCX+70} ${BY-86} ${BCX-7} ${BY-30}`}
                  fill="none" stroke="none"
                />
                {[0, 0.36, 0.72].map((delay,i) => (
                  <circle key={i} r={5} fill="rgba(96,165,250,0.88)">
                    <animateMotion dur="1s" begin={`${delay}s`} repeatCount="indefinite">
                      <mpath href="#bsim-flow"/>
                    </animateMotion>
                  </circle>
                ))}
              </>
            )}
          </svg>
        </BeakerCard>

      </LeftCol>

      {/* ── Parameter sliders + toggles (right, vertically centered) ── */}
      <SliderPanel>
        {/* Temperature */}
        <ControlCard $accent={toHex(tRgb)}>
          <CardRow>
            <CardLabel $accent={toHex(tRgb)}>Temperature</CardLabel>
            <CardValue $accent={toHex(tRgb)}>{temp} °C</CardValue>
          </CardRow>
          <RangeInput
            type="range" min={10} max={60} step={1} value={temp}
            $fill={tPct} $col={toHex(tRgb)}
            onChange={e => setTemp(+e.target.value)}
          />
          <Ticks>
            {[10,20,30,40,50,60].map(v => <span key={v}>{v}</span>)}
          </Ticks>
        </ControlCard>

        {/* pH */}
        <ControlCard $accent={toHex(pRgb)}>
          <CardRow>
            <CardLabel $accent={toHex(pRgb)}>pH Level</CardLabel>
            <CardValue $accent={toHex(pRgb)}>pH {ph}</CardValue>
          </CardRow>
          <RangeInput
            type="range" min={0} max={14} step={0.5} value={ph}
            $fill={pPct} $col={toHex(pRgb)}
            onChange={e => setPh(+e.target.value)}
          />
          <Ticks>
            {[0,2,4,6,8,10,12,14].map(v => <span key={v}>{v}</span>)}
          </Ticks>
        </ControlCard>

        {/* Toggle buttons */}
        <ToggleGrid>
          <Toggle $on={stirring} $col="#6b7280"
            onClick={() => setStirring(s => !s)}>
            Stir Bar
            <ToggleState>{stirring ? "On" : "Off"}</ToggleState>
          </Toggle>
          <Toggle $on={pumping} $col="#6b7280"
            onClick={() => setPumping(p => !p)}>
            Pump
            <ToggleState>{pumping ? "On" : "Off"}</ToggleState>
          </Toggle>
          <Toggle $on={ledOn} $col="#d97706"
            onClick={() => setLedOn(l => !l)}>
            LED
            <ToggleState>{ledOn ? "On" : "Off"}</ToggleState>
          </Toggle>
        </ToggleGrid>
      </SliderPanel>
      </TopRow>

      {/* ── OD Graph ──────────────────────────────────────────────── */}
      <GraphCard>
        <GraphTitle>
          OD<sub>600</sub> vs Time
          <GraphSub> — bacterial growth at {temp}°C · pH {ph}{stirring ? " · stirring" : ""}</GraphSub>
        </GraphTitle>
        <canvas
          ref={graphRef}
          style={{ display:"block", borderRadius:6 }}
        />
      </GraphCard>
    </Root>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const Root = styled.div`
  width: 100%;
  margin: var(--space-lg) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
`

const TopRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: var(--space-sm);
  align-items: center;

  @media (max-width: 660px) {
    grid-template-columns: 1fr;
  }
`

const LeftCol = styled.div`
  display: flex;
  flex-direction: column;
`

const BeakerCard = styled.div`
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #f9f9f7;
  padding: 0.4rem 0.6rem;
  overflow: visible;

  ${({ $shaking }) => $shaking && css`
    animation: ${shakeKf} 0.1s ease-in-out infinite;
  `}
`

const BeakerTopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.3rem 0.5rem 0;
`

const FillLabel = styled.span`
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-muted);
  font-family: var(--font-body);
`

const ResetButton = styled.button`
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: white;
  color: var(--color-muted);
  font-size: 0.68rem;
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;

  &:hover {
    background: #fee2e2;
    color: #dc2626;
    border-color: #fca5a5;
  }
`


const SliderPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const ControlCard = styled.div`
  border: 2px solid ${({ $accent }) => $accent || "var(--color-border)"};
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  background: white;
  transition: border-color 0.3s ease;
`

const CardRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.4rem;
`

const CardLabel = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${({ $accent }) => $accent || "var(--color-text)"};
  font-family: var(--font-body);
  transition: color 0.3s ease;
`

const CardValue = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: ${({ $accent }) => $accent || "var(--color-text)"};
  font-family: var(--font-body);
  transition: color 0.3s ease;
`

const RangeInput = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    ${({ $col }) => $col} ${({ $fill }) => $fill},
    #e5e7eb ${({ $fill }) => $fill}
  );

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 17px; height: 17px;
    border-radius: 50%;
    background: ${({ $col }) => $col};
    border: 2.5px solid #fff;
    box-shadow: 0 1px 5px rgba(0,0,0,0.22);
    cursor: pointer;
    transition: background 0.25s ease;
  }
  &::-moz-range-thumb {
    width: 17px; height: 17px;
    border-radius: 50%;
    background: ${({ $col }) => $col};
    border: 2.5px solid #fff;
    cursor: pointer;
  }
`

const Ticks = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.66rem;
  color: var(--color-muted);
  font-family: var(--font-body);
`

const ToggleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
`

const Toggle = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0.55rem 0.3rem;
  border-radius: 8px;
  border: 2px solid ${({ $col }) => $col};
  background: ${({ $on, $col }) => ($on ? $col : "white")};
  color: ${({ $on }) => ($on ? "white" : "var(--color-text)")};
  font-size: 0.74rem;
  font-weight: 700;
  font-family: var(--font-body);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${({ $col }) => $col};
    color: white;
  }
`

const ToggleState = styled.span`
  font-size: 0.62rem;
  font-weight: 400;
  opacity: 0.8;
`


const StirBarRect = styled.rect`
  fill: ${({ $spinning }) => ($spinning ? "#3b82f6" : "#d1d5db")};
  opacity: 0.9;
  transform-box: fill-box;
  transform-origin: center;

  ${({ $spinning }) => $spinning && css`
    animation: ${spinKf} 0.5s linear infinite;
  `}
`

const GraphCard = styled.div`
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: var(--space-md);
  background: white;
`

const GraphTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.6rem;
  font-family: var(--font-body);
`

const GraphSub = styled.span`
  font-weight: 400;
  color: var(--color-muted);
  font-size: 0.86em;
`

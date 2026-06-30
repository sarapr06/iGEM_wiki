/**
 * Offline tests for Payload → MDX block rendering (no server required).
 */
import assert from "node:assert/strict"
import {
  normalizeGizmoConfig,
  renderBlock,
  renderPageBody,
  routePartsForExport,
} from "./lib/payload-mdx-render.mjs"

let passed = 0

function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ok ${name}`)
}

console.log("payload-mdx-blocks")

test("callout", () => {
  const out = renderBlock({
    blockType: "callout",
    title: "Note",
    tone: "warning",
    body: "Check this claim.",
  })
  assert.match(out, /<Callout title="Note" tone="warning">/)
  assert.match(out, /Check this claim\./)
})

test("figure with static src", () => {
  const out = renderBlock(
    { blockType: "figure", src: "/images/a.png", alt: "Alt text", caption: "Cap" },
    { resolveFigureSrc: (b) => b.src }
  )
  assert.match(out, /<Figure/)
  assert.match(out, /src="\/images\/a.png"/)
  assert.match(out, /alt="Alt text"/)
  assert.match(out, /caption="Cap"/)
})

test("figure with credit", () => {
  const out = renderBlock(
    { blockType: "figure", src: "/images/a.png", alt: "Alt", credit: "Team photo" },
    { resolveFigureSrc: (b) => b.src }
  )
  assert.match(out, /credit="Team photo"/)
})

test("imageGrid", () => {
  const out = renderBlock(
    {
      blockType: "imageGrid",
      figures: [
        { src: "/images/one.png", alt: "One", caption: "First" },
        { src: "/images/two.png", alt: "Two" },
      ],
    },
    { resolveFigureSrc: (b) => b.src }
  )
  assert.match(out, /<ImageGrid>/)
  assert.match(out, /src="\/images\/one.png"/)
  assert.match(out, /src="\/images\/two.png"/)
  assert.match(out, /<\/ImageGrid>/)
})

test("dataTable", () => {
  const out = renderBlock({
    blockType: "dataTable",
    caption: "Parts list",
    tableMarkdown: "| Part | Status |\n| --- | --- |\n| Sensor | Draft |",
  })
  assert.match(out, /<DataTable caption="Parts list">/)
  assert.match(out, /\| Part \| Status \|/)
  assert.match(out, /<\/DataTable>/)
})

test("contribution calendar", () => {
  const out = renderBlock({
    blockType: "contributionCalendar",
    title: "Our season",
    caption: "Select a week to see each subteam's progress.",
  })
  assert.match(out, /<ContributionCalendar/)
  assert.match(out, /title="Our season"/)
  assert.match(out, /caption="Select a week to see each subteam's progress\."/)
})

test("hardware architecture diagram", () => {
  const out = renderBlock({ blockType: "hardwareArchitectureDiagram" })
  assert.equal(out, "<HardwareArchitectureDiagram />")
})

test("design sketchbook", () => {
  const out = renderBlock({ blockType: "designSketchbook" })
  assert.equal(out, "<DesignSketchbook />")
})

test("page tabs", () => {
  const out = renderBlock({
    blockType: "pageTabs",
    layout: "side",
    defaultTab: "progress",
    tabs: [
      { id: "progress", label: "Progress", body: "Progress copy." },
      { id: "design", label: "Design", body: "<DesignSketchbook />" },
    ],
  })
  assert.match(out, /<PageTabs layout="side" defaultTab="progress">/)
  assert.match(out, /<PageTab id="progress" label="Progress">/)
  assert.match(out, /Progress copy\./)
  assert.match(out, /<PageTab id="design" label="Design">/)
  assert.match(out, /<DesignSketchbook \/>/)
  assert.match(out, /<\/PageTabs>/)
})

test("page tabs rejects unsafe tab ids", () => {
  let captured = null
  const out = renderBlock(
    {
      blockType: "pageTabs",
      tabs: [{ id: "../bad", label: "Bad", body: "Nope" }],
    },
    { onError: (msg) => (captured = msg) }
  )
  assert.equal(out, "")
  assert.match(captured, /invalid tab id/)
})

test("interactiveGizmo with config emits a JSX expression", () => {
  const out = renderBlock({
    blockType: "interactiveGizmo",
    gizmo: "growthCurve",
    title: "Fluorescence Model",
    config: { growthRate: 0.5, carryingCapacity: 200 },
  })
  assert.match(out, /<InteractiveGizmo/)
  assert.match(out, /name="growthCurve"/)
  assert.match(out, /title="Fluorescence Model"/)
  // config must be an expression {{...}}, NOT a quoted string
  assert.match(out, /config=\{\{"growthRate":0\.5,"carryingCapacity":200\}\}/)
})

test("interactiveGizmo accepts a JSON string config", () => {
  const out = renderBlock({
    blockType: "interactiveGizmo",
    gizmo: "growthCurve",
    config: '{"growthRate":0.8}',
  })
  assert.match(out, /config=\{\{"growthRate":0\.8\}\}/)
})

test("interactiveGizmo without config omits the prop", () => {
  const out = renderBlock({ blockType: "interactiveGizmo", gizmo: "growthCurve" })
  assert.match(out, /name="growthCurve"/)
  assert.ok(!/config=/.test(out), "should not emit a config prop when empty")
})

test("propless gizmos (hardwareNotebook, contributionTimeline, bioreactorRequirements) render by name", () => {
  for (const name of ["hardwareNotebook", "contributionTimeline", "bioreactorRequirements"]) {
    const out = renderBlock({ blockType: "interactiveGizmo", gizmo: name })
    assert.match(out, new RegExp(`<InteractiveGizmo`))
    assert.match(out, new RegExp(`name="${name}"`))
    assert.ok(!/config=/.test(out), `${name} should not emit a config prop`)
  }
})

test("interactiveGizmo with invalid JSON reports an error and renders nothing", () => {
  let captured = null
  const out = renderBlock(
    { blockType: "interactiveGizmo", gizmo: "growthCurve", config: "{ not json }" },
    { onError: (msg) => (captured = msg) }
  )
  assert.equal(out, "")
  assert.match(captured, /invalid JSON/)
})

test("interactiveGizmo rejects unknown gizmos and unsafe config", () => {
  assert.throws(
    () => normalizeGizmoConfig("notRegistered", {}),
    /Unknown interactive gizmo/
  )
  assert.throws(
    () => normalizeGizmoConfig("growthCurve", { carryingCapacity: "large" }),
    /must be between/
  )
  assert.throws(
    () => normalizeGizmoConfig("growthCurve", { carryingCapacity: 1000 }),
    /must be between/
  )
  assert.throws(
    () => normalizeGizmoConfig("hardwareNotebook", { unexpected: true }),
    /Unsupported config key/
  )
})

test("wiki export paths reject traversal and unsafe segments", () => {
  assert.deepEqual(routePartsForExport("/project/description/"), ["project", "description"])
  assert.deepEqual(routePartsForExport("/"), ["home"])
  assert.throws(() => routePartsForExport("/../../pages/"), /not a safe wiki slug/)
  assert.throws(() => routePartsForExport("/%2e%2e/pages/"), /not a safe wiki slug/)
  assert.throws(() => routePartsForExport("/project\\pages/"), /unsupported characters/)
  assert.throws(() => routePartsForExport("/project/?draft=1"), /must start and end/)
})

test("gizmo can sit between text blocks (mid-page)", () => {
  const body = renderPageBody(
    [
      { blockType: "richText", body: "Intro paragraph." },
      { blockType: "interactiveGizmo", gizmo: "growthCurve", title: "Try it" },
      { blockType: "richText", body: "Closing paragraph." },
    ],
    { resolveFigureSrc: () => null }
  )
  const gizmoIndex = body.indexOf("<InteractiveGizmo")
  assert.ok(body.indexOf("Intro paragraph.") < gizmoIndex)
  assert.ok(gizmoIndex < body.indexOf("Closing paragraph."))
})

test("full page body", () => {
  const body = renderPageBody(
    [
      { blockType: "callout", body: "Hello", tone: "note" },
      {
        blockType: "dataTable",
        caption: "T",
        tableMarkdown: "| A |\n| --- |\n| 1 |",
      },
    ],
    { resolveFigureSrc: () => null }
  )
  assert.match(body, /<Callout/)
  assert.match(body, /<DataTable/)
})

console.log(`\n${passed} tests passed.`)

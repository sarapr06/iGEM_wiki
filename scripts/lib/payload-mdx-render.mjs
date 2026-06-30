/**
 * Renders Payload wiki page content blocks to MDX using approved components from
 * `src/components/mdx/wikiComponents.js`.
 */

export function quote(value) {
  return JSON.stringify(String(value ?? ""))
}

const GIZMO_CONFIG_RULES = {
  growthCurve: {
    initialPopulation: { min: 0.001, max: 500 },
    carryingCapacity: { min: 10, max: 500 },
    growthRate: { min: 0.05, max: 1.5 },
    timeMax: { min: 1, max: 168 },
    inputLabel: { type: "string", maxLength: 40 },
  },
  hardwareNotebook: {},
  contributionTimeline: {},
  bioreactorRequirements: {},
}

export function routePartsForExport(route) {
  if (typeof route !== "string" || !route.startsWith("/") || !route.endsWith("/")) {
    throw new Error('Path must start and end with "/".')
  }

  if (route.includes("\\") || route.includes("\0") || route.includes("?") || route.includes("#")) {
    throw new Error("Path contains unsupported characters.")
  }

  let decoded
  try {
    decoded = decodeURIComponent(route)
  } catch {
    throw new Error("Path contains invalid URL encoding.")
  }

  const parts = decoded.slice(1, -1).split("/").filter(Boolean)
  for (const part of parts) {
    if (part === "." || part === ".." || !/^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(part)) {
      throw new Error(`Path segment "${part}" is not a safe wiki slug.`)
    }
  }

  return parts.length > 0 ? parts : ["home"]
}

export function renderBlock(block, { resolveFigureSrc, onError } = {}) {
  if (!block?.blockType) return ""

  switch (block.blockType) {
    case "richText":
      return typeof block.body === "string" ? block.body.trim() : ""
    case "callout":
      return renderCallout(block)
    case "figure":
      return renderFigure(block, { resolveFigureSrc, onError })
    case "imageGrid":
      return renderImageGrid(block, { resolveFigureSrc, onError })
    case "dataTable":
      return renderDataTable(block)
    case "contributionCalendar":
      return renderContributionCalendar(block)
    case "hardwareArchitectureDiagram":
      return "<HardwareArchitectureDiagram />"
    case "designSketchbook":
      return "<DesignSketchbook />"
    case "pageTabs":
      return renderPageTabs(block, { onError })
    case "interactiveGizmo":
      return renderInteractiveGizmo(block, { onError })
    case "markdown":
      return String(block.body || "").trim()
    default:
      onError?.(`Unknown block type "${block.blockType}".`)
      return ""
  }
}

export function renderPageBody(blocks, options = {}) {
  return (blocks || []).map((block) => renderBlock(block, options)).filter(Boolean).join("\n\n")
}

function renderCallout(block) {
  const titleAttr = block.title ? ` title=${quote(block.title)}` : ""
  const tone = block.tone || "note"
  return `<Callout${titleAttr} tone=${quote(tone)}>\n${String(block.body || "").trim()}\n</Callout>`
}

function renderFigure(block, options) {
  const src = options.resolveFigureSrc?.(block)
  if (!src) {
    options.onError?.("Figure block is missing Media or fallback src.")
    return ""
  }

  const alt = block.alt || ""
  const attrs = [`src=${quote(src)}`, `alt=${quote(alt)}`]
  if (block.caption) attrs.push(`caption=${quote(block.caption)}`)
  if (block.credit) attrs.push(`credit=${quote(block.credit)}`)

  return `<Figure\n  ${attrs.join("\n  ")}\n/>`
}

function renderImageGrid(block, options) {
  const figures = Array.isArray(block.figures) ? block.figures : []
  if (figures.length === 0) {
    options.onError?.("ImageGrid block has no figures.")
    return ""
  }

  const inner = figures
    .map((item) => renderFigure(item, options))
    .filter(Boolean)
    .join("\n  ")

  if (!inner) return ""

  return `<ImageGrid>\n  ${inner}\n</ImageGrid>`
}

function renderDataTable(block) {
  const table = String(block.tableMarkdown || "").trim()
  if (!table) return ""

  const captionAttr = block.caption ? ` caption=${quote(block.caption)}` : ""
  return `<DataTable${captionAttr}>\n\n${table}\n\n</DataTable>`
}

function renderContributionCalendar(block) {
  const attrs = []
  if (block.title) attrs.push(`title=${quote(block.title)}`)
  if (block.caption) attrs.push(`caption=${quote(block.caption)}`)
  if (attrs.length === 0) return "<ContributionCalendar />"
  return `<ContributionCalendar\n  ${attrs.join("\n  ")}\n/>`
}

function renderPageTabs(block, options) {
  const tabs = Array.isArray(block.tabs) ? block.tabs : []
  if (tabs.length === 0) {
    options.onError?.("Page Tabs block has no tabs.")
    return ""
  }

  const ids = new Set()
  const renderedTabs = []

  for (const tab of tabs) {
    const id = String(tab.id || "").trim()
    const label = String(tab.label || "").trim()
    const body = String(tab.body || "").trim()

    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      options.onError?.(`Page Tabs block has invalid tab id "${id}".`)
      continue
    }
    if (ids.has(id)) {
      options.onError?.(`Page Tabs block has duplicate tab id "${id}".`)
      continue
    }
    if (!label || !body) {
      options.onError?.(`Page Tabs block tab "${id}" is missing label or body.`)
      continue
    }

    ids.add(id)
    renderedTabs.push(`<PageTab id=${quote(id)} label=${quote(label)}>\n\n${body}\n\n</PageTab>`)
  }

  if (renderedTabs.length === 0) return ""

  const attrs = []
  if (block.layout === "side") attrs.push('layout="side"')
  if (block.defaultTab) attrs.push(`defaultTab=${quote(block.defaultTab)}`)
  const open = attrs.length > 0 ? `<PageTabs ${attrs.join(" ")}>` : "<PageTabs>"

  return `${open}\n\n${renderedTabs.join("\n\n")}\n\n</PageTabs>`
}

/** Normalizes a Payload `json` field that may arrive as an object or a string. */
export function parseGizmoConfig(raw) {
  if (raw == null || raw === "") return {}
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gizmo config must be a JSON object.")
  }
  return parsed
}

export function normalizeGizmoConfig(name, raw) {
  const rules = GIZMO_CONFIG_RULES[name]
  if (!rules) throw new Error(`Unknown interactive gizmo "${name}".`)

  let config
  try {
    config = parseGizmoConfig(raw)
  } catch {
    throw new Error(`Interactive gizmo "${name}" has invalid JSON config.`)
  }
  const normalized = {}

  for (const [key, value] of Object.entries(config)) {
    const rule = rules[key]
    if (!rule) throw new Error(`Unsupported config key "${key}" for gizmo "${name}".`)

    if (rule.type === "string") {
      if (typeof value !== "string" || value.length > rule.maxLength) {
        throw new Error(`Config "${key}" for gizmo "${name}" must be a short string.`)
      }
      normalized[key] = value
      continue
    }

    if (typeof value !== "number" || !Number.isFinite(value) || value < rule.min || value > rule.max) {
      throw new Error(
        `Config "${key}" for gizmo "${name}" must be between ${rule.min} and ${rule.max}.`
      )
    }
    normalized[key] = value
  }

  return normalized
}

function renderInteractiveGizmo(block, options) {
  const name = String(block.gizmo || "").trim()
  if (!name) {
    options.onError?.("Interactive Gizmo block is missing a gizmo selection.")
    return ""
  }

  let config
  try {
    config = normalizeGizmoConfig(name, block.config)
  } catch (error) {
    options.onError?.(error.message)
    return ""
  }

  const attrs = [`name=${quote(name)}`]
  if (block.title) attrs.push(`title=${quote(block.title)}`)
  if (block.caption) attrs.push(`caption=${quote(block.caption)}`)
  if (config && Object.keys(config).length > 0) {
    // Emit a real JSX expression so props arrive as numbers/booleans, not strings.
    attrs.push(`config={${JSON.stringify(config)}}`)
  }

  return `<InteractiveGizmo\n  ${attrs.join("\n  ")}\n/>`
}

import fs from "fs"
import path from "path"
import process from "process"
import {
  normalizeGizmoConfig,
  quote,
  renderBlock,
  routePartsForExport,
} from "./lib/payload-mdx-render.mjs"

const root = process.cwd()
const outputRoot = path.join(root, "src", "content", "wiki", "_payload-export")
const payloadMediaRoot = path.join(root, "cms", "payload-app", "media")
const staticMediaRoot = path.join(root, "static", "payload-media")
const payloadUrl = String(process.env.PAYLOAD_URL || "http://localhost:3000").replace(/\/$/, "")
const payloadFetchTimeoutMs = Number(process.env.PAYLOAD_FETCH_TIMEOUT_MS || 15000)
const errors = []

let response

try {
  response = await fetchWithTimeout(
    `${payloadUrl}/api/wiki-pages?limit=100&depth=2&where[_status][equals]=published&sort=section,order`
  )
} catch (error) {
  console.error(`Unable to fetch Payload pages from ${payloadUrl} within ${payloadFetchTimeoutMs}ms.`)
  console.error("Make sure Payload is running with npm run payload:develop, then try again.")
  console.error(error.message)
  process.exit(1)
}

if (!response.ok) {
  console.error(`Unable to fetch Payload pages from ${payloadUrl}: ${response.status} ${response.statusText}`)
  console.error(await response.text())
  process.exit(1)
}

const payload = await response.json()
const pages = payload.docs || []

await ensureRemoteMedia(pages)

if (!isPathInside(outputRoot, path.join(root, "src", "content", "wiki"))) {
  console.error(`Refusing to export outside src/content/wiki: ${relative(outputRoot)}`)
  process.exit(1)
}

for (const page of pages) {
  validatePage(page)
}

if (errors.length > 0) {
  console.error("Payload export failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const expectedFiles = new Set()
const renderedPages = []
let writtenCount = 0
let skippedCount = 0
let removedCount = 0
let copiedMediaCount = 0

for (const page of pages) {
  const filePath = filePathForPage(page)
  const rendered = renderPage(page)

  expectedFiles.add(path.normalize(filePath))
  renderedPages.push({ filePath, rendered })
}

if (errors.length > 0) {
  console.error("Payload export failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

fs.mkdirSync(outputRoot, { recursive: true })
fs.mkdirSync(staticMediaRoot, { recursive: true })

for (const { filePath, rendered } of renderedPages) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === rendered) {
    skippedCount += 1
    continue
  }

  fs.writeFileSync(filePath, rendered, "utf8")
  writtenCount += 1
}

if (fs.existsSync(outputRoot)) {
  for (const filePath of findMdxFiles(outputRoot)) {
    if (!expectedFiles.has(path.normalize(filePath))) {
      fs.rmSync(filePath, { force: true })
      removedCount += 1
    }
  }
}

console.log(
  `Exported ${pages.length} published Payload page(s) to ${relative(outputRoot)} ` +
    `(${writtenCount} written, ${skippedCount} unchanged, ${removedCount} removed, ${copiedMediaCount} media copied).`
)

function validatePage(page) {
  const label = page.title ? `Payload page "${page.title}"` : `Payload page "${page.id}"`

  for (const field of ["title", "section", "path", "navTitle", "order", "description", "owners", "updated", "content"]) {
    if (page[field] == null || page[field] === "") errors.push(`${label} is missing ${field}.`)
  }

  if (typeof page.path === "string" && (!page.path.startsWith("/") || !page.path.endsWith("/"))) {
    errors.push(`${label} path must start and end with "/".`)
  }

  if (typeof page.path === "string") {
    try {
      routePartsForExport(page.path)
    } catch (error) {
      errors.push(`${label} ${error.message}`)
    }
  }

  if (!Array.isArray(page.owners) || page.owners.length === 0) {
    errors.push(`${label} must have at least one owner.`)
  }

  if (!Array.isArray(page.content) || page.content.length === 0) {
    errors.push(`${label} must have at least one content block.`)
  }

  for (const block of page.content || []) {
    if (block.blockType === "figure") {
      validateFigureItem(label, block)
    }

    if (block.blockType === "imageGrid") {
      const figures = Array.isArray(block.figures) ? block.figures : []
      if (figures.length === 0) {
        errors.push(`${label} has an ImageGrid block with no figures.`)
      }
      for (const item of figures) validateFigureItem(label, item, "ImageGrid figure")
    }

    if (block.blockType === "dataTable") {
      if (!String(block.tableMarkdown || "").trim()) {
        errors.push(`${label} has a DataTable block without table markdown.`)
      }
    }

    if (block.blockType === "interactiveGizmo") {
      if (!String(block.gizmo || "").trim()) {
        errors.push(`${label} has an Interactive Gizmo block without a gizmo selection.`)
      }
      try {
        normalizeGizmoConfig(block.gizmo, block.config)
      } catch (error) {
        errors.push(`${label} ${error.message}`)
      }
    }

    if (block.blockType === "pageTabs") {
      const tabs = Array.isArray(block.tabs) ? block.tabs : []
      if (tabs.length === 0) {
        errors.push(`${label} has a Page Tabs block with no tabs.`)
      }
      const ids = new Set()
      for (const tab of tabs) {
        const id = String(tab.id || "").trim()
        if (!/^[A-Za-z0-9_-]+$/.test(id)) {
          errors.push(`${label} has a Page Tabs block with invalid tab id "${id}".`)
        } else if (ids.has(id)) {
          errors.push(`${label} has a Page Tabs block with duplicate tab id "${id}".`)
        }
        ids.add(id)
        if (!String(tab.label || "").trim() || !String(tab.body || "").trim()) {
          errors.push(`${label} has a Page Tabs block tab missing label or body.`)
        }
      }
    }
  }
}

function validateFigureItem(pageLabel, item, context = "Figure block") {
  const media = normalizeMedia(item.image)

  if (!media && !item.src) {
    errors.push(`${pageLabel} has a ${context} without Media or fallback src.`)
  }

  if (!item.alt && !media?.alt) {
    errors.push(`${pageLabel} has a ${context} without alt text.`)
  }

  if (media) {
    const filename = path.basename(media.filename)
    const sourcePath = path.join(payloadMediaRoot, filename)

    if (!fs.existsSync(sourcePath)) {
      errors.push(
        `${pageLabel} references missing media file "${filename}" (not found locally or on ${payloadUrl}).`
      )
    }
  }
}

function filePathForPage(page) {
  const filePath = path.join(outputRoot, ...routePartsForExport(page.path), "index.mdx")
  if (!isPathInside(filePath, outputRoot)) {
    throw new Error(`Refusing to export outside ${relative(outputRoot)}: ${relative(filePath)}`)
  }
  return filePath
}

function renderPage(page) {
  const owners = page.owners.map((owner) => owner.name).filter(Boolean)
  const renderOptions = {
    resolveFigureSrc: resolveFigureSrc,
    onError: (message) => errors.push(`${page.title || page.id}: ${message}`),
  }

  const body = page.content
    .map((block) => {
      if (block.blockType === "richText") return renderRichText(block.body)
      return renderBlock(block, renderOptions)
    })
    .filter(Boolean)
    .join("\n\n")

  return `---\ntitle: ${quote(page.title)}\nsection: ${quote(page.section)}\npath: ${quote(page.path)}\nnavTitle: ${quote(page.navTitle)}\norder: ${Number(page.order)}\ndescription: ${quote(page.description)}\nowners: [${owners.map(quote).join(", ")}]\nupdated: ${quote(String(page.updated).slice(0, 10))}\nstatus: "published"\n---\n\n{/* Generated from Payload CMS. Edit in Payload, then re-run npm run payload:export. */}\n\n${body.trim()}\n`
}

function resolveFigureSrc(block) {
  const media = normalizeMedia(block.image)
  if (media) return exportMedia(media)
  return block.src || null
}

function normalizeMedia(media) {
  if (!media || typeof media !== "object") return null
  if (!media.filename) return null
  return media
}

function exportMedia(media) {
  const filename = path.basename(media.filename)
  const sourcePath = path.join(payloadMediaRoot, filename)
  const targetPath = path.join(staticMediaRoot, filename)

  if (!fs.existsSync(sourcePath)) {
    errors.push(`Payload media file "${filename}" is missing after download attempt.`)
    return `/payload-media/${filename}`
  }

  if (!fs.existsSync(targetPath) || fs.readFileSync(sourcePath).compare(fs.readFileSync(targetPath)) !== 0) {
    fs.copyFileSync(sourcePath, targetPath)
    copiedMediaCount += 1
  }

  return `/payload-media/${filename}`
}

function collectFigureItems(block) {
  if (block.blockType === "figure") return [block]
  if (block.blockType === "imageGrid" && Array.isArray(block.figures)) return block.figures
  return []
}

async function ensureRemoteMedia(pages) {
  fs.mkdirSync(payloadMediaRoot, { recursive: true })

  for (const page of pages) {
    for (const block of page.content || []) {
      for (const item of collectFigureItems(block)) {
        const media = normalizeMedia(item.image)
        if (!media?.filename) continue

        const filename = path.basename(media.filename)
        const sourcePath = path.join(payloadMediaRoot, filename)

        if (fs.existsSync(sourcePath)) continue

        const response = await fetchWithTimeout(mediaFileUrl(media))

        if (!response.ok) {
          errors.push(
            `Unable to download media "${filename}" from ${payloadUrl}: ${response.status} ${response.statusText}`
          )
          continue
        }

        fs.writeFileSync(sourcePath, Buffer.from(await response.arrayBuffer()))
      }
    }
  }
}

function mediaFileUrl(media) {
  if (media.url?.startsWith("http")) return media.url

  if (media.url) {
    return `${payloadUrl}${media.url.startsWith("/") ? media.url : `/${media.url}`}`
  }

  const filename = path.basename(media.filename)
  return `${payloadUrl}/api/media/file/${encodeURIComponent(filename)}`
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), payloadFetchTimeoutMs)

  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function renderRichText(data) {
  if (!data) return ""
  return renderLexicalFallback(data)
}

function renderLexicalFallback(data) {
  const children = data?.root?.children || []
  return children.map(renderLexicalNode).filter(Boolean).join("\n\n")
}

function renderLexicalNode(node) {
  if (node.type === "heading") {
    const depth = Number(String(node.tag || "h2").replace("h", "")) || 2
    return `${"#".repeat(depth)} ${renderLexicalChildren(node.children)}`
  }

  if (node.type === "list") {
    return (node.children || []).map((child) => `- ${renderLexicalChildren(child.children)}`).join("\n")
  }

  return renderLexicalChildren(node.children)
}

function renderLexicalChildren(children = []) {
  return children
    .map((child) => {
      if (child.text) return child.text
      return renderLexicalChildren(child.children)
    })
    .join("")
}

function findMdxFiles(directory) {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) return findMdxFiles(entryPath)
    if (entry.isFile() && entry.name.endsWith(".mdx")) return [entryPath]
    return []
  })
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/")
}

function isPathInside(child, parent) {
  const relativePath = path.relative(parent, child)
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
}

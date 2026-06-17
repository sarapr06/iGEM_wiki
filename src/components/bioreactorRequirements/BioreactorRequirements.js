import React, { useMemo, useState } from "react"
import styled, { css } from "styled-components"
import {
  BIOREACTOR_REQUIREMENT_VERSIONS,
  LATEST_REQUIREMENT_VERSION_INDEX,
  REQUIREMENT_COLUMNS,
  REQUIREMENT_FLAG_LEGEND,
} from "../../data/bioreactorRequirements.js"

const CELL_COLUMNS = ["subObjectives", "metric", "constraints", "links"]

function formatLongDate(iso) {
  if (!iso) return ""
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed)
}

/**
 * Diff the selected version against the previous one.
 * Returns a map keyed by `${sectionId}:${rowId}` describing what changed so the
 * table can highlight updated cells and newly added rows. No-op for the first
 * version (nothing to compare against).
 */
function buildDiff(versions, index) {
  if (index <= 0) return { rows: {}, hasPrevious: false }
  const prev = versions[index - 1]
  const prevRows = {}
  for (const section of prev.sections) {
    for (const row of section.rows) {
      prevRows[`${section.id}:${row.id}`] = row
    }
  }

  const current = versions[index]
  /** @type {Record<string, { added: boolean, changed: Record<string, boolean> }>} */
  const rows = {}
  for (const section of current.sections) {
    for (const row of section.rows) {
      const key = `${section.id}:${row.id}`
      const before = prevRows[key]
      if (!before) {
        rows[key] = { added: true, changed: {} }
        continue
      }
      const changed = {}
      if ((before.objective || "") !== (row.objective || "")) changed.objective = true
      if ((before.flag || null) !== (row.flag || null)) changed.flag = true
      for (const col of CELL_COLUMNS) {
        if (JSON.stringify(before[col] || []) !== JSON.stringify(row[col] || [])) {
          changed[col] = true
        }
      }
      if (Object.keys(changed).length > 0) rows[key] = { added: false, changed }
    }
  }
  return { rows, hasPrevious: true }
}

function renderItem(item) {
  if (item && typeof item === "object") {
    if (item.url) {
      return (
        <CellLink href={item.url} target="_blank" rel="noopener noreferrer">
          {item.label || item.url}
        </CellLink>
      )
    }
    return item.label || ""
  }
  return item
}

function CellList({ items }) {
  if (!items || items.length === 0) return <Muted>—</Muted>
  if (items.length === 1) return <span>{renderItem(items[0])}</span>
  return (
    <CellUl>
      {items.map((item, i) => (
        <li key={i}>{renderItem(item)}</li>
      ))}
    </CellUl>
  )
}

export function BioreactorRequirements() {
  const versions = BIOREACTOR_REQUIREMENT_VERSIONS
  const lastIndex = LATEST_REQUIREMENT_VERSION_INDEX
  const [index, setIndex] = useState(lastIndex)
  const [activeSectionId, setActiveSectionId] = useState(
    versions[lastIndex].sections[0]?.id
  )

  const version = versions[index] || versions[lastIndex]
  const diff = useMemo(() => buildDiff(versions, index), [versions, index])
  const singleVersion = versions.length <= 1

  const activeSection =
    version.sections.find((s) => s.id === activeSectionId) || version.sections[0]

  const changedSectionIds = useMemo(() => {
    const set = new Set()
    for (const key of Object.keys(diff.rows)) set.add(key.split(":")[0])
    return set
  }, [diff])

  const totalRows = useMemo(
    () => version.sections.reduce((sum, s) => sum + s.rows.length, 0),
    [version]
  )

  return (
    <Root>
      <Header>
        <div>
          <Eyebrow>Bioreactor build · requirements</Eyebrow>
          <SelectedDate>{formatLongDate(version.date)}</SelectedDate>
          {version.note && <Note>{version.note}</Note>}
        </div>
        <Counts>
          <Counts1>{version.sections.length} sections</Counts1>
          <Counts2>{totalRows} requirements</Counts2>
        </Counts>
      </Header>

      <SliderBlock aria-label="Requirements version history">
        <SliderLabelRow>
          <span>Version history</span>
          {singleVersion ? (
            <SliderHint>Only one version so far — slider activates as the doc evolves.</SliderHint>
          ) : (
            <SliderHint>Slide to view requirements as they were on each date.</SliderHint>
          )}
        </SliderLabelRow>
        <Slider
          type="range"
          min={0}
          max={Math.max(0, versions.length - 1)}
          step={1}
          value={index}
          disabled={singleVersion}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={formatLongDate(version.date)}
        />
        <Ticks $count={versions.length}>
          {versions.map((v, i) => (
            <TickButton
              key={v.id}
              type="button"
              $active={i === index}
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
            >
              <TickDot $active={i === index} aria-hidden />
              <TickLabel $active={i === index}>{v.label}</TickLabel>
            </TickButton>
          ))}
        </Ticks>
      </SliderBlock>

      <Legend aria-label="Flag legend">
        {REQUIREMENT_FLAG_LEGEND.map((item) => (
          <LegendItem key={item.id} title={item.description}>
            <LegendSwatch $flag={item.id} aria-hidden />
            {item.label}
          </LegendItem>
        ))}
        {diff.hasPrevious && (
          <LegendItem title="Changed since the previous version">
            <LegendSwatch $flag="updated" aria-hidden />
            Updated this version
          </LegendItem>
        )}
      </Legend>

      <SectionTabs role="tablist" aria-label="Requirement sections">
        {version.sections.map((section) => {
          const selected = section.id === activeSection?.id
          return (
            <SectionTab
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              $selected={selected}
              onClick={() => setActiveSectionId(section.id)}
            >
              {section.title}
              {changedSectionIds.has(section.id) && <ChangeDot aria-label="updated this version" />}
            </SectionTab>
          )
        })}
      </SectionTabs>

      {activeSection && (
        <Section>
          {activeSection.objectiveNote && (
            <SectionNote>{activeSection.objectiveNote}</SectionNote>
          )}
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  {REQUIREMENT_COLUMNS.map((col) => (
                    <th key={col.id}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSection.rows.map((row, rowIdx) => {
                  const key = `${activeSection.id}:${row.id}`
                  const rowDiff = diff.rows[key]
                  const isAdded = rowDiff?.added
                  const changed = rowDiff?.changed || {}
                  const showGroup =
                    row.group &&
                    (rowIdx === 0 || activeSection.rows[rowIdx - 1].group !== row.group)
                  return (
                    <React.Fragment key={row.id}>
                      {showGroup && (
                        <tr>
                          <GroupCell colSpan={REQUIREMENT_COLUMNS.length}>{row.group}</GroupCell>
                        </tr>
                      )}
                      <BodyRow $added={isAdded}>
                        <ObjectiveCell $changed={changed.objective || changed.flag}>
                          <ObjectiveName>
                            {row.flag && <FlagBadge $flag={row.flag}>{row.flag}</FlagBadge>}
                            {row.objective}
                          </ObjectiveName>
                          {isAdded && <AddedTag>new</AddedTag>}
                        </ObjectiveCell>
                        <Cell $changed={changed.subObjectives}>
                          <CellList items={row.subObjectives} />
                        </Cell>
                        <Cell $changed={changed.metric}>
                          <CellList items={row.metric} />
                        </Cell>
                        <Cell $changed={changed.constraints}>
                          <CellList items={row.constraints} />
                        </Cell>
                        <Cell $changed={changed.links}>
                          <CellList items={row.links} />
                          {row.images?.length > 0 && (
                            <CellImages>
                              {row.images.map((img, i) => (
                                <a
                                  key={i}
                                  href={img.src}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img src={img.src} alt={img.alt || ""} loading="lazy" />
                                </a>
                              ))}
                            </CellImages>
                          )}
                        </Cell>
                      </BodyRow>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </Table>
          </TableScroll>
        </Section>
      )}
    </Root>
  )
}

export default BioreactorRequirements

/* ── flag colours ── */
const FLAG_COLORS = {
  important: "#f2c744",
  difficult: "#ef88b6",
  "needs-quantify": "#5bd47a",
  updated: "var(--color-accent)",
}

const Root = styled.div`
  width: 100%;
  min-width: 0;
`

const Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
`

const Eyebrow = styled.p`
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin: 0 0 var(--space-xs);
`

const SelectedDate = styled.h3`
  font-size: clamp(1.4rem, 3vw, 2rem);
  color: var(--color-text);
  margin: 0;
`

const Note = styled.p`
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.6;
  max-width: none;
  margin: var(--space-sm) 0 0;
`

const Counts = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  color: var(--color-muted);
  font-size: 0.8rem;
  white-space: nowrap;
`

const Counts1 = styled.span``
const Counts2 = styled.span``

const SliderBlock = styled.div`
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-md) var(--space-lg) var(--space-lg);
  background: color-mix(in srgb, var(--color-accent) 5%, transparent);
  margin-bottom: var(--space-lg);
`

const SliderLabelRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);

  > span:first-child {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text);
    font-weight: 600;
  }
`

const SliderHint = styled.span`
  color: var(--color-muted);
  font-size: 0.8rem;
`

const Slider = styled.input`
  width: 100%;
  accent-color: var(--color-accent);
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
`

const Ticks = styled.div`
  display: flex;
  justify-content: ${({ $count }) => ($count <= 1 ? "flex-start" : "space-between")};
  margin-top: var(--space-xs);
  gap: var(--space-sm);
`

const TickButton = styled.button`
  appearance: none;
  background: none;
  border: none;
  padding: 4px 2px 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
`

const TickDot = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 2px solid var(--color-accent);
  background: ${({ $active }) => ($active ? "var(--color-accent)" : "var(--color-bg)")};
`

const TickLabel = styled.span`
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: ${({ $active }) => ($active ? "var(--color-text)" : "var(--color-muted)")};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
`

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm) var(--space-md);
  margin-bottom: var(--space-md);
  font-size: 0.8rem;
  color: var(--color-muted);
`

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

const LegendSwatch = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: ${({ $flag }) => FLAG_COLORS[$flag] || "var(--color-border)"};
  ${({ $flag }) =>
    $flag === "updated" &&
    css`
      background: transparent;
      border: 2px solid var(--color-accent);
    `}
`

const SectionTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin: var(--space-lg) 0 0;
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border);

  @media (max-width: 720px) {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
`

const SectionTab = styled.button`
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  border: 1px solid ${({ $selected }) => ($selected ? "var(--color-accent)" : "var(--color-border)")};
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: ${({ $selected }) => ($selected ? 600 : 500)};
  color: ${({ $selected }) => ($selected ? "#2a2a2a" : "var(--color-text)")};
  background: ${({ $selected }) => ($selected ? "var(--color-accent)" : "transparent")};
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: var(--color-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
`

const ChangeDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-bg);
`

const Section = styled.section`
  margin: var(--space-lg) 0;
`

const SectionNote = styled.p`
  color: var(--color-muted);
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0 0 var(--space-md);
  max-width: none;
`

const TableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  min-width: 720px;

  th,
  td {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
    text-align: left;
    vertical-align: top;
  }

  th:last-child,
  td:last-child {
    border-right: none;
  }

  thead th {
    position: sticky;
    top: 0;
    background: color-mix(in srgb, var(--color-accent) 16%, var(--color-bg));
    color: var(--color-text);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    z-index: 1;
  }

  thead th:first-child {
    min-width: 12rem;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
`

const BodyRow = styled.tr`
  ${({ $added }) =>
    $added &&
    css`
      background: color-mix(in srgb, var(--color-accent) 8%, transparent);
    `}
`

const changedCell = css`
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
  box-shadow: inset 3px 0 0 var(--color-accent);
`

const Cell = styled.td`
  color: var(--color-muted);
  line-height: 1.5;
  ${({ $changed }) => $changed && changedCell}
`

const ObjectiveCell = styled.td`
  color: var(--color-text);
  font-weight: 600;
  ${({ $changed }) => $changed && changedCell}
`

const ObjectiveName = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const AddedTag = styled.span`
  display: inline-block;
  margin-top: 6px;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
  font-weight: 700;
`

const FlagBadge = styled.span`
  display: inline-block;
  align-self: flex-start;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 999px;
  color: #2a2a2a;
  background: ${({ $flag }) => FLAG_COLORS[$flag] || "var(--color-border)"};
`

const GroupCell = styled.td`
  background: color-mix(in srgb, var(--color-text) 5%, transparent);
  color: var(--color-text) !important;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`

const CellUl = styled.ul`
  margin: 0;
  padding-left: 1.05rem;

  li + li {
    margin-top: 4px;
  }
`

const CellLink = styled.a`
  color: var(--color-text);
  border-bottom: 1px solid var(--color-accent);
  text-decoration: none;
  word-break: break-word;

  &:hover {
    background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  }
`

const CellImages = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;

  a {
    display: block;
    max-width: min(280px, 100%);
  }

  img {
    width: 100%;
    max-width: min(280px, 100%);
    height: auto;
    max-height: 220px;
    object-fit: contain;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    display: block;
    background: color-mix(in srgb, var(--color-bg) 92%, var(--color-border));
  }
`

const Muted = styled.span`
  color: var(--color-border);
`

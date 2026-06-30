import React, { useState, createContext, useContext } from "react"
import styled, { css } from "styled-components"

/** When true, side tabs align with the page header in a two-column page grid. */
export const WideSideTabContext = createContext(false)

export function WideSideTabProvider({ children }) {
  return (
    <WideSideTabContext.Provider value={true}>{children}</WideSideTabContext.Provider>
  )
}

/**
 * In-page tab switcher for MDX wiki pages.
 *
 * <PageTabs layout="side" defaultTab="progress">
 *   <PageTab id="progress" label="Progress">...</PageTab>
 * </PageTabs>
 */
export function PageTabs({ defaultTab, layout = "horizontal", children }) {
  const isSide = layout === "side"
  const widePage = useContext(WideSideTabContext)
  const pageSide = widePage && isSide
  const tabs = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === PageTab
  )

  const tabIds = tabs.map((tab) => tab.props.id)
  const initialTab = defaultTab && tabIds.includes(defaultTab) ? defaultTab : tabIds[0]
  const [activeId, setActiveId] = useState(initialTab)

  if (tabs.length === 0) return null

  const activePanel = tabs.find((tab) => tab.props.id === activeId) || tabs[0]

  return (
    <TabsRoot $side={isSide} $widePage={widePage} $pageSide={pageSide}>
      <TabList role="tablist" aria-label="Page sections" $side={isSide} $pageSide={pageSide}>
        {tabs.map((tab) => {
          const { id, label } = tab.props
          const selected = id === activeId
          return (
            <TabButton
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              $selected={selected}
              $side={isSide}
              onClick={() => setActiveId(id)}
            >
              {label}
            </TabButton>
          )
        })}
      </TabList>
      <TabPanel
        role="tabpanel"
        id={`panel-${activePanel.props.id}`}
        aria-labelledby={`tab-${activePanel.props.id}`}
        $side={isSide}
        $widePage={widePage}
        $pageSide={pageSide}
      >
        {activePanel.props.children}
      </TabPanel>
    </TabsRoot>
  )
}

export function PageTab() {
  return null
}

const TabsRoot = styled.div`
  margin: var(--space-lg) 0;
  max-width: ${({ $side, $widePage }) => ($widePage || $side ? "none" : "100%")};
  width: 100%;

  ${({ $widePage, $pageSide }) =>
    $widePage &&
    !$pageSide &&
    css`
      margin: var(--space-sm) 0;
    `}

  ${({ $side, $pageSide }) =>
    $side &&
    !$pageSide &&
    css`
      @media (max-width: 720px) {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      @media (min-width: 721px) {
        display: grid;
        grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr);
        gap: var(--space-xl);
        align-items: start;
      }
    `}

  ${({ $pageSide }) =>
    $pageSide &&
    css`
      display: contents;
      margin: 0;
    `}
`

const TabList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);

  ${({ $side, $pageSide }) =>
    $side
      ? css`
          flex-direction: column;
          flex-wrap: nowrap;
          align-items: stretch;
          gap: 10px;
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;

          ${$pageSide &&
          css`
            grid-column: 1;
            grid-row: 1 / -1;
            align-self: start;

            @media (min-width: 721px) {
              position: sticky;
              top: 96px;
              max-height: calc(100vh - 120px);
              overflow-y: auto;
              overscroll-behavior: contain;
              padding-top: 0.25rem;
            }
          `}

          ${!$pageSide &&
          css`
            @media (min-width: 721px) {
              position: sticky;
              top: 96px;
              align-self: start;
              max-height: calc(100vh - 120px);
              overflow-y: auto;
              overscroll-behavior: contain;
            }
          `}

          @media (max-width: 720px) {
            flex-direction: row;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: var(--space-xs);
            border-bottom: 1px solid var(--color-border);
            -webkit-overflow-scrolling: touch;
            grid-column: 1 / -1;
            grid-row: auto;
          }
        `
      : css`
          margin-bottom: var(--space-lg);
          padding-bottom: var(--space-sm);
          border-bottom: 1px solid var(--color-border);
        `}
`

const TabButton = styled.button`
  appearance: none;
  background: none;
  color: var(--color-text);
  font-family: var(--font-body);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  ${({ $side, $selected }) =>
    $side
      ? css`
          border: none;
          border-left: 3px solid
            ${$selected ? "var(--color-accent)" : "var(--color-border)"};
          border-radius: 0;
          padding: 2px 0 2px 8px;
          text-align: left;
          font-size: 1.125rem;
          line-height: 1.35;
          font-weight: ${$selected ? 600 : 400};
          color: ${$selected ? "var(--color-accent)" : "var(--color-muted)"};
          white-space: nowrap;

          &:hover {
            color: var(--color-accent);
            border-left-color: var(--color-accent);
          }

          @media (max-width: 720px) {
            border-left: none;
            border-bottom: 2px solid
              ${$selected ? "var(--color-accent)" : "transparent"};
            padding: 0.45rem 0.85rem;
            font-size: 0.9375rem;
            flex-shrink: 0;
          }
        `
      : css`
          border: 1px solid ${$selected ? "var(--color-accent)" : "var(--color-border)"};
          border-radius: 999px;
          padding: 0.45rem 1rem;
          background: ${$selected ? "var(--color-accent)" : "transparent"};
          font-size: 0.8125rem;
          font-weight: ${$selected ? 600 : 500};
          letter-spacing: 0.03em;

          &:hover {
            border-color: var(--color-accent);
          }
        `}
`

const TabPanel = styled.div`
  min-width: 0;
  width: 100%;

  > * + * {
    margin-top: var(--space-md);
  }

  h2 {
    font-size: clamp(1.25rem, 2.5vw, 1.75rem);
    margin-top: 0;
    margin-bottom: var(--space-sm);
    padding-top: 0;
    border-top: none;
  }

  h2,
  h3,
  h4 {
    max-width: none;
  }

  p {
    color: var(--color-muted);
    line-height: 1.7;
    max-width: 48rem;
  }

  ${({ $side, $widePage }) =>
    ($side || $widePage) &&
    css`
      p,
      h2,
      h3,
      h4 {
        max-width: none;
      }
    `}

  ${({ $pageSide }) =>
    $pageSide &&
    css`
      grid-column: 2;
      min-width: 0;
      width: 100%;

      > * + * {
        margin-top: var(--space-sm);
      }

      @media (max-width: 720px) {
        grid-column: 1 / -1;
      }
    `}
`

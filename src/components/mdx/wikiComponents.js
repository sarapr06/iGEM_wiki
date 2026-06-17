import React from "react"
import styled, { css } from "styled-components"
import { BioreactorRequirements } from "../bioreactorRequirements/BioreactorRequirements.js"
import { ContributionTimeline } from "../contributionCalendar/ContributionTimeline.js"
import { DesignSketchbook } from "../designSketchbook/DesignSketchbook.js"
import { HardwareNotebookSandbox } from "../hardwareNotebook/HardwareNotebookSandbox.js"
import { HardwareArchitectureDiagram } from "../hardwareArchitecture/HardwareArchitectureDiagram.js"
import { PageTab, PageTabs } from "../PageTabs.js"
import { InteractiveGizmo } from "./interactive/InteractiveGizmo.js"
import Citation from "../Citation"
import References from "../References"

export const Callout = ({ tone = "note", title, children }) => (
  <CalloutBox $tone={tone}>
    {title && <CalloutTitle>{title}</CalloutTitle>}
    <CalloutBody>{children}</CalloutBody>
  </CalloutBox>
)

export const Figure = ({ src, alt = "", caption, credit, children }) => (
  <FigureWrap>
    {src && <img src={src} alt={alt} />}
    {children}
    {(caption || credit) && (
      <figcaption>
        {caption && <span>{caption}</span>}
        {credit && <small>{credit}</small>}
      </figcaption>
    )}
  </FigureWrap>
)

export const ImageGrid = ({ children }) => <GridWrap>{children}</GridWrap>

export const DataTable = ({ caption, children }) => (
  <DataTableWrap>
    {caption && <TableCaption>{caption}</TableCaption>}
    {children}
  </DataTableWrap>
)

export const ContributionCalendar = ({ title, caption }) => (
  <ContributionCalendarWrap>
    {title && <CalendarTitle>{title}</CalendarTitle>}
    <ContributionTimeline embedded />
    {caption && <CalendarCaption>{caption}</CalendarCaption>}
  </ContributionCalendarWrap>
)

export const mdxComponents = {
  Callout,
  Figure,
  ImageGrid,
  DataTable,
  ContributionCalendar,
  ContributionTimeline,
  DesignSketchbook,
  HardwareNotebookSandbox,
  BioreactorRequirements,
  HardwareArchitectureDiagram,
  PageTabs,
  PageTab,
  InteractiveGizmo,
  Citation,
  References,
}

const toneStyles = {
  note: css`
    --callout-accent: var(--color-accent);
  `,
  success: css`
    --callout-accent: #5bd47a;
  `,
  warning: css`
    --callout-accent: #f2b84b;
  `,
}

const CalloutBox = styled.aside`
  max-width: 48rem;
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-border);
  border-left: 5px solid var(--callout-accent);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.24);
  ${({ $tone }) => toneStyles[$tone] || toneStyles.note}
`

const CalloutTitle = styled.p`
  color: var(--color-text) !important;
  font-weight: 700;
  margin-bottom: var(--space-xs);
`

const CalloutBody = styled.div`
  > * + * {
    margin-top: var(--space-sm);
  }

  p {
    color: var(--color-muted);
  }
`

const FigureWrap = styled.figure`
  max-width: 54rem;
  margin: var(--space-lg) 0;

  img {
    width: 100%;
    border: 1px solid var(--color-border);
    background: rgba(255, 255, 255, 0.28);
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem var(--space-sm);
    margin-top: var(--space-sm);
    color: var(--color-muted);
    font-size: 0.875rem;
  }

  figcaption span {
    color: var(--color-text);
  }

  figcaption small {
    font: inherit;
  }
`

const GridWrap = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-md);
  max-width: 54rem;
  margin: var(--space-lg) 0;

  figure {
    margin: 0;
  }
`

const DataTableWrap = styled.div`
  max-width: 54rem;
  overflow-x: auto;
  margin: var(--space-lg) 0;
`

const TableCaption = styled.p`
  color: var(--color-text) !important;
  font-size: 0.9rem;
  font-weight: 700;
  margin-bottom: var(--space-sm);
`

const ContributionCalendarWrap = styled.div`
  width: 100%;
  max-width: 80rem;
  min-width: 0;
  margin: var(--space-lg) 0;
`

const CalendarTitle = styled.p`
  color: var(--color-text) !important;
  font-weight: 700;
  margin-bottom: var(--space-sm);
`

const CalendarCaption = styled.p`
  max-width: 48rem;
  margin-top: var(--space-sm);
  color: var(--color-muted);
  font-size: 0.875rem;
`

import React from "react"
import styled from "styled-components"
import { interactiveRegistry } from "./registry.js"

/**
 * Single MDX entry point for interactive gizmos. Pages render:
 *
 *   <InteractiveGizmo name="growthCurve" title="..." config={{ growthRate: 0.5 }} />
 *
 * `name` selects an approved component from the registry; `config` is spread as
 * props. Unknown names render a visible notice instead of crashing the build.
 */
export const InteractiveGizmo = ({ name, title, caption, config = {} }) => {
  const Component = interactiveRegistry[name]
  const componentProps =
    config && typeof config === "object" && !Array.isArray(config) ? config : {}
  const isWide = name === "contributionTimeline" || name === "bioreactorRequirements"

  if (!Component) {
    return (
      <Missing role="note">
        Unknown interactive gizmo: <code>{String(name)}</code>. Check the registry in
        <code> src/components/mdx/interactive/registry.js</code>.
      </Missing>
    )
  }

  return (
    <Wrap $wide={isWide}>
      {title && <Title>{title}</Title>}
      <Component {...componentProps} />
      {caption && <Caption>{caption}</Caption>}
    </Wrap>
  )
}

const Wrap = styled.div`
  width: 100%;
  max-width: ${({ $wide }) => ($wide ? "80rem" : "54rem")};
  min-width: 0;
  margin: var(--space-lg) 0;
`

const Title = styled.p`
  color: var(--color-text);
  font-weight: 700;
  margin-bottom: var(--space-sm);
`

const Caption = styled.p`
  margin-top: var(--space-sm);
  color: var(--color-muted);
  font-size: 0.875rem;
`

const Missing = styled.div`
  max-width: 54rem;
  margin: var(--space-lg) 0;
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-left: 5px solid #f2b84b;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.24);
  color: var(--color-text);
  font-size: 0.9rem;

  code {
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
`

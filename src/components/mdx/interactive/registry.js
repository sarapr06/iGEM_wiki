import React from "react"
import { BioreactorRequirements } from "../../bioreactorRequirements/BioreactorRequirements.js"
import { GrowthCurveSimulator } from "./GrowthCurveSimulator.js"
import { HardwareNotebookSandbox } from "../../hardwareNotebook/HardwareNotebookSandbox.js"
import { ContributionTimeline } from "../../contributionCalendar/ContributionTimeline.js"

const EmbeddedContributionTimeline = (props) => (
  <ContributionTimeline {...props} embedded />
)

/**
 * Approved interactive "gizmos" subteams can embed in wiki pages.
 *
 * To add a new gizmo:
 *   1. Build an SSR-safe React component in this folder (state + SVG/canvas is
 *      fine; guard any window/document access).
 *   2. Register it here under a stable key.
 *   3. Add the same key to the `gizmo` select options in
 *      cms/payload-app/src/blocks/wikiContentBlocks.ts so editors can pick it.
 *
 * Nothing else changes — the export pipeline and MDX wiring stay the same.
 */
export const interactiveRegistry = {
  growthCurve: GrowthCurveSimulator,
  hardwareNotebook: HardwareNotebookSandbox,
  contributionTimeline: EmbeddedContributionTimeline,
  bioreactorRequirements: BioreactorRequirements,
}

export const interactiveKeys = Object.keys(interactiveRegistry)

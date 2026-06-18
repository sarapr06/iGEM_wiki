/**
 * Bioreactor build requirements — versioned history.
 *
 * This mirrors the hardware "Centralized Living Hardware Doc" requirements table.
 * The doc is a living brainstorm that keeps changing, so requirements are stored
 * as dated VERSIONS (oldest -> newest). The notebook renders a time-slider over
 * these versions and (once there is more than one) highlights what changed.
 *
 * To add a new version later:
 *   1. Copy the latest version object.
 *   2. Change `id` / `date` / `label` / `note`.
 *   3. Edit the rows that changed. The diff view keys rows by section id + row id,
 *      so keep ids stable across versions for accurate change tracking.
 *
 * Flag legend (from the source doc's highlight colours):
 *   'important'      -> yellow highlight: important requirement
 *   'difficult'      -> pink highlight: difficult to achieve
 *   'needs-quantify' -> green highlight: still needs a concrete number/metric
 * Flags, hyperlinks, and images are ingested from the Google Doc (.docx export)
 * via scripts/apply-docx-requirements.py.
 *
 * @typedef {'important' | 'difficult' | 'needs-quantify'} RequirementFlag
 *
 * @typedef {string | { label: string, url?: string }} RequirementLink
 * @typedef {{ src: string, alt?: string }} RequirementImage
 *
 * @typedef {Object} RequirementRow
 * @property {string} id - stable id (used for diffing + React keys)
 * @property {string} objective
 * @property {string} [group] - optional sub-grouping within a section
 * @property {string[]} subObjectives
 * @property {string[]} metric - "Metric & Criteria" column
 * @property {string[]} constraints
 * @property {RequirementLink[]} links - "Links to useful components, diagrams, etc." (text label or {label,url})
 * @property {RequirementImage[]} [images] - images pulled from the doc, served from /hardware-notebook/requirements/
 * @property {RequirementFlag | null} [flag] - single highlight (use `flags` when a row has more than one)
 * @property {RequirementFlag[]} [flags] - multiple highlights from the source doc
 *
 * @typedef {Object} RequirementSection
 * @property {string} id
 * @property {string} title
 * @property {string} [objectiveNote]
 * @property {RequirementRow[]} rows
 *
 * @typedef {Object} RequirementVersion
 * @property {string} id
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {string} label - short slider label
 * @property {string} note - what changed / context for this version
 * @property {RequirementSection[]} sections
 */

export const REQUIREMENT_FLAG_LEGEND = [
  { id: "important", label: "Important", description: "Important requirement (yellow in the doc)." },
  { id: "difficult", label: "Difficult", description: "Difficult to achieve (pink in the doc)." },
  {
    id: "needs-quantify",
    label: "Needs a number",
    description: "Still needs a concrete metric / value (green in the doc).",
  },
]

export const REQUIREMENT_COLUMNS = [
  { id: "objective", label: "Objective" },
  { id: "subObjectives", label: "Related sub-objectives" },
  { id: "metric", label: "Metric & Criteria" },
  { id: "constraints", label: "Constraints" },
  { id: "links", label: "Links / references" },
]

/** @type {RequirementVersion[]} */
export const BIOREACTOR_REQUIREMENT_VERSIONS = [
  {
    id: "2026-06-17",
    date: "2026-06-17",
    label: "Jun 17",
    note:
      "Initial requirements brainstorm transcribed from the Centralized Living Hardware Doc " +
      "(Bioreactor Build → Requirements). This is a living doc; blanks ( _ ) mark values still to be quantified.",
    sections: [
      {
        id: "culturing",
        title: "Base Functionality — Culturing Bacteria",
        objectiveNote: "Overarching objective: try to be power efficient.",
        rows: [
          {
            id: "heating",
            objective: "Heating",
            subObjectives: [
              "Compact size.",
              "Minimize time to achieve temperature (temp is currently measured every 4 minutes — 2.5 min for temp data collection, 1.5 min of heating cycles).",
              "KEY EXAMPLE: takes 1 hour to go from 28C to 37C; 24–30C is ~0.5 hours.",
              "Maximize heat range (currently ambient to 50C).",
              "Need to be able to set a specific temperature; range is likely 20–40C.",
              "Time needed to update temperature shouldn't be an issue.",
            ],
            metric: [
              "Size dimensions: smaller than or equal to pioreactor solution (list out measurements).",
              "Time to achieve temperature: reduce to less than _.",
              "Range of components: specific range of temperatures still needed — is it 20–40C?",
            ],
            constraints: [
              "Temperature range cannot melt plastic (will break components — similar to how the pioreactor caps at 63C to protect itself).",
              "Accurate temperature readings; do not overshoot or it can kill bacteria.",
            ],
            links: [
              { label: "Pioreactor heating PCB", url: "https://pioreactor.com/en-ca/products/temperature-hall-and-heating-circuit-board-replacement-part?pr_prod_strat=e5_desc&pr_rec_id=00ed8ae55&pr_rec_pid=7662599471160&pr_ref_pid=8681129574456&pr_seq=uniform" },
              { label: "Thermal pad replacement on PCB", url: "https://pioreactor.com/en-ca/products/heating-pcb-thermal-pad-replacement-part?pr_prod_strat=e5_desc&pr_rec_id=fcdff3d4a&pr_rec_pid=8681129574456&pr_ref_pid=7662599471160&pr_seq=uniform" },
              { label: "How heating works on pioreactor", url: "https://pioreactor.com/en-ca/blogs/pioreactor/pioreactor-dev-log-13-heating-improvements?srsltid=AfmBOoqxwEUxk19wF2GcfyTscW78J_5ZNwf1Cm_NP08psszPd2lJdt9W" },
              { label: "Temp complaints", url: "https://forum.pioreactor.com/t/temperature-control-limitations-expectations/1014" },
            ],
            images: [
              { src: "/hardware-notebook/requirements/image2.png", alt: "Heating" },
            ],
            flags: ["important", "needs-quantify"],
          },
          {
            id: "aeration",
            objective: "Aeration for vials",
            subObjectives: [
              "Accessibility: should be included with the base kit, as air bubblers and pumps are currently sold separately (aeration is mainly done by stirring right now).",
              "Maximize aeration tube vials, refer to diagram photo (must be above liquid level).",
              "Increase surface area to volume ratio.",
            ],
            metric: [
              "Be included in the base kit.",
              "Shortest tube possible (reason unclear) — shorter than _.",
              "Surface area / volume: usually the vial takes care of this (20mL / 40mL).",
            ],
            constraints: [
              "Need enough room in the vial for bacteria (aeration tube, vials, and buffers cannot take all the space).",
              "At minimum, should have the tube vials — this is what the pioreactor has now and it semi-works.",
            ],
            links: [
              { label: "Aeration complaints", url: "https://forum.pioreactor.com/t/air-bubbler-questions/451" },
              { label: "Aeration complaints2", url: "https://forum.pioreactor.com/t/air-bubbler-questions/451" },
              { label: "Possible solution?", url: "https://www.printables.com/model/575292-baffle-for-pioreactor-vial-cap-a/files" },
              { label: "“How can I improve mixing and aeration” section", url: "https://docs.pioreactor.com/user-guide/common-questions" },
            ],
            images: [
              { src: "/hardware-notebook/requirements/image1.png", alt: "Aeration for vials" },
            ],
            flags: ["important", "needs-quantify"],
          },
          {
            id: "mixing",
            objective: "Mixing fluid (even concentration)",
            subObjectives: [
              "Maximize stirrer speed (helps with gas mixing/aeration; currently the limiting factor in pioreactors because of the OD constraint).",
              "Stirrer should not affect OD readings (vortex can scuff it).",
              "Maximize liquids it can work with (struggles with debris and high viscosity).",
              "Reduce stalling at low RPMs.",
              "Can also look into the noise it makes when stirring.",
              "Stirring speed might not need to be exact.",
            ],
            metric: [
              "Range of RPM the stirrer can run at without affecting OD — at most _ (find the point where it affects OD).",
              "RPM should ideally have no effect on OD readings (might be impossible) — have < _% effect.",
              "Capable of mixing a variety of liquids (will it run in the first place).",
              "Capable of running at low RPM < _ RPM.",
            ],
            constraints: [
              "Complaints suggest heating affects the stirring magnet connection, so the mixer should not limit the temperature range the solution can work in.",
            ],
            links: [
              { label: "Stalling complaint", url: "https://forum.pioreactor.com/t/stirring-randomly-stops/789" },
              { label: "High temp malfunction", url: "https://forum.pioreactor.com/t/stirring-malfunction-at-high-temperatures/349" },
            ],
            flags: ["important", "needs-quantify"],
          },
          {
            id: "pumping",
            objective: "Pumping fluid (in and out)",
            subObjectives: [
              "Accessibility: should be included with the base kit (currently comes with 2 pumps). Does not come with liquid containers that connect to the pump.",
              "Maximize number of pumps it can run with (currently 3).",
              "Maximize dosage rate range (currently 1–2mL; may struggle with microdosage).",
            ],
            metric: [
              "Is included in the kit.",
              "Number of pumps capable of being attached > 3 (the greater the better).",
              "Dosage the pump can regulate > 1–2mL (the greater the better).",
            ],
            constraints: [
              "Must have at least TWO pumps for in and out movement of fluid (bare minimum).",
              "Cannot leak.",
              "Must keep fluid entering and fluid exiting separate from each other (thus need 2).",
            ],
            links: [
              { label: "Low low dosage complaint", url: "https://forum.pioreactor.com/t/using-pioreactor-with-slow-flow-rate-requirements/220/8" },
              { label: "Uses for pumps", url: "https://docs.pioreactor.com/user-guide/dosing-automations" },
            ],
            images: [
              { src: "/hardware-notebook/requirements/image3.png", alt: "Pumping Fluid (in and out)" },
            ],
            flags: ["important", "needs-quantify"],
          },
          {
            id: "vial-volume",
            objective: "Vial volume",
            subObjectives: [
              "Maximize surface area to volume.",
              "Resist temperature and pH differences.",
              "Patricia is currently happy with the current size of the pioreactor.",
            ],
            metric: [
              "Surface area to volume at least _:_ ratio.",
              "Range of temp and pH from _ to _.",
            ],
            constraints: [
              "Available options are currently 20mL and 40mL.",
              "Should NOT affect the bacteria's environment.",
            ],
            links: [],
            flag: "needs-quantify",
          },
          {
            id: "runtime",
            objective: "Runtime",
            subObjectives: ["Minimum: 1 week to longer than a week."],
            metric: [],
            constraints: [],
            links: [],
            flag: null,
          },
        ],
      },
      {
        id: "measurements",
        title: "Base Functionality — Taking Measurements / Readings",
        objectiveNote:
          "What measurements do we want to take and how? What units and equipment are required for this process?",
        rows: [
          {
            id: "optical-density",
            objective: "Optical density readings",
            subObjectives: ["Accuracy of optical reading.", "Streamline optical reading process."],
            metric: ["Compare optical density reading from the reactor to an in-lab densitometer."],
            constraints: ["What sensors or methods will be used to measure this value?"],
            links: [],
            flag: null,
          },
          {
            id: "temperature-control",
            objective: "Temperature control",
            subObjectives: ["Power usage.", "Obtaining set point.", "Time delay in control."],
            metric: ["Ability to maintain steady-state temperature."],
            constraints: [
              "Material used.",
              "Actuator used.",
              "Temperature of environment (must ensure the reactor maintains the temperature).",
              "Must maintain cooling.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "separation",
            objective: "Separation of undesired final products and product",
            subObjectives: ["Downstream operation.", "Downstream parts to be added."],
            metric: [
              "Efficiency of separation.",
              "Pump power to send the effluent to the next stage.",
            ],
            constraints: ["Will require adding valves to pump the effluent to the next step."],
            links: [],
            flag: null,
          },
          {
            id: "ph-control",
            objective: "pH control",
            subObjectives: ["Accuracy of pH control."],
            metric: [],
            constraints: [
              "Will require either: (1) adding buffer to the system and hoping that's enough to maintain the pH, or (2) a control system to introduce buffer when the pH is off.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "stirring-control",
            objective: "Stirring control",
            subObjectives: [
              "Maintaining RPM.",
              "Ensure power usage is not high — we don't want it to be too power intensive.",
            ],
            metric: [
              "Don't kill the bacteria.",
              "Don't use too much power.",
              "Facilitate good mass transfer.",
            ],
            constraints: [
              "Good mass transfer = higher speed, but higher speed may mean killing the bacteria.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "control-systems",
            objective: "Control systems",
            subObjectives: [
              "Allow actuators to make changes to the reactor ASAP.",
              "Control system is user friendly.",
            ],
            metric: ["Length of time delay."],
            constraints: [
              "How transparent should we be when reporting actuated changes to the process — e.g. should the datalogger state \"temperature controller bumped up temperature by x°C at this point\"? Answer: most likely more of a concern for us than dry lab.",
            ],
            links: [],
            flag: null,
          },
        ],
      },
      {
        id: "ergonomics",
        title: "Operation Ergonomics (User Friendliness)",
        objectiveNote:
          "Minimizing cognitive load, physical strain, and human error. Wetlab-friendly GUI.",
        rows: [
          {
            id: "status-queues",
            group: "Minimizing cognitive load",
            objective: "Status queues",
            subObjectives: ["LEDs (R, G, Y), audible alarms, cleaning lights."],
            metric: [
              "Status visible from 3m away at a 180° viewing angle.",
              "Alarm sound __ to be heard over lab fans.",
            ],
            constraints: [
              "If operated with software (Patricia prefers this for customizability), status should still be shown on the bioreactor.",
              "Must use low-power LEDs (e.g., WS2812B) to stay within the power budget of the main PCB.",
            ],
            links: [],
            flag: "important",
          },
          {
            id: "vessel-transparency",
            group: "Minimizing cognitive load",
            objective: "Vessel transparency",
            subObjectives: ["Observation window, internal LED illumination."],
            metric: [
              "Users can see the bottom of the impeller or the top of the fluid line without removing the lid.",
            ],
            constraints: ["Must not cloud over time."],
            links: [],
            flag: null,
          },
          {
            id: "data-displays",
            group: "Minimizing cognitive load",
            objective: "Data displays",
            subObjectives: ["Local hardware screen, connection icons."],
            metric: [
              "Screen refresh rate 1 Hz.",
              "Must display at least 3 parameters: Temp, Runtime, …",
            ],
            constraints: [
              "Screen size must be __ to keep the footprint small.",
              "Must be recessed to prevent spill damage.",
              "Must be visible to the average user from __ m away.",
            ],
            links: [],
            flag: "needs-quantify",
          },
          {
            id: "ordered-organization",
            group: "Minimizing cognitive load",
            objective: "Ordered component organization",
            subObjectives: ["Numbered packages/boxes (Lego-style) to identify the next step."],
            metric: ["Users can intuitively identify the next step in < 10s."],
            constraints: [],
            links: [],
            flag: null,
          },
          {
            id: "textured-knobs",
            group: "Minimizing cognitive load",
            objective: "Textured knobs for touch",
            subObjectives: [
              "Textured rings around the top/knobs for better grip, unscrewable for maintenance and learnability.",
            ],
            metric: [
              "Knobs must be operable with wet nitrile gloves without the hand slipping (high-friction knurling).",
            ],
            constraints: [],
            links: [],
            flag: null,
          },
          {
            id: "single-handed",
            group: "Minimizing physical strain",
            objective: "Single-handed operability",
            subObjectives: [],
            metric: [
              "80% of routine tasks (sampling, swapping vials) executable with 1 hand.",
            ],
            constraints: [],
            links: [],
            flag: "difficult",
          },
          {
            id: "spill-stability",
            group: "Minimizing physical strain",
            objective: "Spill / damage-safe stability",
            subObjectives: [
              "Low center of gravity to prevent tipping and internal damage, or a lower adhesive (suction).",
            ],
            metric: [
              "The unit must not slide or tip when a force of __N is applied to a port with one hand.",
            ],
            constraints: [],
            links: [],
            flag: "needs-quantify",
          },
          {
            id: "glove-tactility",
            group: "Minimizing physical strain",
            objective: "Glove-optimized tactility",
            subObjectives: [
              "Large buttons/surfaces; encased buttons to prevent contaminants from being trapped.",
            ],
            metric: [
              "Primary buttons must be ___ mm radius.",
              "___ IP65 rating (dust/splash proof) for the interface.",
            ],
            constraints: [
              "Patricia uses gloves with similar dexterity to normal hands (manages pipette tips precisely) — match pipette-level dexterity.",
            ],
            links: [],
            flag: "needs-quantify",
          },
          {
            id: "autoclave-compat",
            group: "Minimizing physical strain",
            objective: "Autoclave / sanitization compatibility",
            subObjectives: [
              "All materials able to withstand cleaning products (e.g., 70% Ethanol, 10% Bleach) with no damage.",
            ],
            metric: [
              'No clouding, cracking, or surface "tackiness" after 100 wipe-cycles with Ethanol/Bleach/other.',
            ],
            constraints: [],
            links: [],
            flag: "important",
          },
          {
            id: "tool-less-modularity",
            group: "Minimizing physical strain",
            objective: "Tool-less modularity",
            subObjectives: ["Thumb-screws vs. hex bolts; magnetic housings; snap-fit components."],
            metric: [
              "Full teardown for cleaning must be possible in < 2 mins using zero external tools.",
            ],
            constraints: [],
            links: [],
            flag: "difficult",
          },
          {
            id: "no-cross-connection",
            group: "Minimizing human error",
            objective: "Zero cross-connection possibility",
            subObjectives: ["Different ports are not compatible with others."],
            metric: [],
            constraints: [],
            links: [],
            flag: null,
          },
          {
            id: "checklist-operation",
            group: "Minimizing human error",
            objective: "Checklist-led operation",
            subObjectives: ["e.g. system cannot run if the cap is not on (safety interlock)."],
            metric: [
              'Software must receive a "Cap Engaged" signal from a sensor (Hall effect or limit switch) before heating/agitation starts.',
            ],
            constraints: [],
            links: [],
            flag: "needs-quantify",
          },
        ],
      },
      {
        id: "assembly-maintenance",
        title: "Ease of Assembly / Maintenance",
        rows: [
          {
            id: "screw-tolerance",
            objective: "Accurate screw tolerance",
            subObjectives: [],
            metric: [
              "% of screws that fit without wobbling or being too hard to install.",
              "Or: amount of post-processing after 3D printing / machining needed to allow proper installation of screws.",
            ],
            constraints: [],
            links: [],
            flag: null,
          },
          {
            id: "autoclavable",
            objective: "Autoclavable",
            subObjectives: [
              "Number of reusable components autoclavable (components in contact with test materials).",
            ],
            metric: [
              "All components in contact with test materials must be either single-use or autoclavable (# of components).",
              "Time needed to remove and reassemble autoclavable parts — measure this on the Pioreactor and use it as the metric.",
            ],
            constraints: [],
            links: [],
            flag: null,
          },
          {
            id: "disassemble-clean",
            objective: "Ability to disassemble and clean",
            subObjectives: [],
            metric: [
              "Time needed to disassemble and clean all relevant parts — measure on the Pioreactor and use as the metric.",
              "% of modular / cleanable parts.",
            ],
            constraints: [
              "Ideally all parts will be disassemblable for cleaning, but the exact percentage is unknown.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "electronics-complexity",
            objective: "Complexity of pins, connectors, hat PCBs, MCU together",
            subObjectives: [],
            metric: [
              "For assembly: number of steps to assemble all electronics (or number of pins, etc.) — compare to Pioreactor.",
              "For maintenance: number of exposed pins/connectors — compare to Pioreactor; ideally none.",
              "For maintenance: % of PCB components repairable/replaceable (how many resistors, capacitors, chips, etc. can be unsoldered and replaced on failure).",
            ],
            constraints: [],
            links: [],
            flag: null,
          },
        ],
      },
      {
        id: "power",
        title: "Power Distribution",
        rows: [
          {
            id: "power-limits",
            objective: "Adheres to power consumption limits in Donnelly Centre",
            subObjectives: ["Use scheduled heating and mixing to keep overall wattage down."],
            metric: [
              "Total current draw for the 96 reactors must stay under the safe load limit for a 15A(?) circuit (max 12A or 1440 W total).",
            ],
            constraints: [
              "Assume a standard 120V socket.",
              "Must account for 96 reactors running simultaneously without tripping lab breakers.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "power-distribution",
            objective: "Efficient power distribution and cable routing",
            subObjectives: [
              "Separate power lines for heating/mixing from the microcontrollers to protect sensitive components from voltage spikes.",
              "Centralize power using a high-capacity shared DC PSU to avoid 96 individual wall adapters.",
            ],
            metric: [
              "Number of centralized PSUs required (aim for minimal PSUs with ~20%(?) wattage safety overhead).",
              "Voltage drop across daisy-chained cables must remain < 5% (?).",
            ],
            constraints: [
              "Must physically fit within the designated shelf for the benchtop space being measured.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "electrical-safety",
            objective: "Ensure electrical and thermal safety in a wetlab",
            subObjectives: [
              "Prevent overheating of power boards / PSUs.",
              "Ensure no high-voltage AC lines are routed near fluid transfer points (tubes).",
            ],
            metric: [
              "Must protect against splashes (have an IP rating).",
              "Operating temp of PSUs must be within manufacturer limits.",
            ],
            constraints: [
              "Must meet Donnelly Centre power / safety limits.",
              "System cannot leak or expose live circuitry to fluids.",
              "IP rating.",
            ],
            links: [
              { label: "IP rating", url: "https://www.enclosurecompany.com/ip-ratings-explained.php" },
            ],
            flag: null,
          },
        ],
      },
      {
        id: "overarching",
        title: "Other Overarching Requirements",
        rows: [
          {
            id: "lower-cost",
            objective: "Lower cost",
            subObjectives: ["Shall minimize the cost of each component."],
            metric: [
              "Lower cost is better — Metric: $.",
              "Minimum component manufacturing cost.",
              "Ethical human labour wages.",
            ],
            constraints: [],
            links: [],
            flag: null,
          },
          {
            id: "component-accessibility",
            objective: "Component accessibility",
            subObjectives: ["Shall be easy to assemble."],
            metric: [
              "Smaller number of components is better — Metric: number of components.",
              "More meaningful colour coordination is better — Metric: number and quality of colours used to indicate component types.",
            ],
            constraints: [
              "Number of components required to build a pioreactor that can be assembled by students instead of in a factory.",
              "3D printing filament colour might not be controllable (e.g., if we use MyFab…).",
            ],
            links: [],
            flag: null,
          },
          {
            id: "instructions",
            objective: "Instructions accessibility",
            subObjectives: [
              "Shall be easy to read.",
              "Digital and printed formats shall be available.",
              "Each format's interface shall be easy to navigate.",
              "Shall include context clues for each component.",
            ],
            metric: [
              "Less text is better — Metric: number of words in the instructions.",
              "Availability of digital and printed formats — Metric: binary (yes/no).",
              "???????? — Metric: (TBD).",
              "Inclusion of context clues per component — Metric: binary (yes/no).",
            ],
            constraints: [
              "Minimum text required to communicate the instructions.",
              "Amount of paper that can be used without producing too much waste.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "size-compactness",
            objective: "Physical size & compactness (for multi-reactor setups)",
            subObjectives: [
              "Component size should be minimized for each part.",
              "Components shall be easy to integrate with each other.",
            ],
            metric: [
              "Smaller size is better — Metric: m, m², m³.",
              "Shorter time to integrate components is better — Metric: time it takes to integrate components.",
            ],
            constraints: [
              "Some bolts and nuts are very smol.",
              "Different people have different skill sets, resulting in different assembly/integration times.",
            ],
            links: [],
            flag: null,
          },
          {
            id: "network-limits",
            objective: "Adheres to network limitations (when scaled up to 96)",
            subObjectives: [
              "System of all 96 pioreactors shall take up no more than ____??? bandwidth.",
            ],
            metric: ["Less bandwidth is better? — Metric: bandwidth."],
            constraints: ["96 modules will require a somewhat large bandwidth."],
            links: [],
            flag: null,
          },
          {
            id: "sustainability",
            objective: "Environmental sustainability",
            subObjectives: [
              "Shall use a minimal number of parts.",
              "Shall use materials that are reusable / recyclable.",
            ],
            metric: [
              "Fewer parts is better — Metric: number of parts.",
              "Fewer non-reusable / non-recyclable parts is better — Metric: number of not reusable or recyclable parts.",
            ],
            constraints: [
              "More than just a couple of parts will be necessary.",
              "Not all components might be reusable or recyclable for sanitary reasons.",
            ],
            links: ["Added by a team member — unsure where it should go."],
            flag: null,
          },
          {
            id: "safety",
            objective: "Safety",
            subObjectives: [
              "Shall have no sharp corners.",
              "Shall not be harmful to human or wildlife health?? (material-wise).",
            ],
            metric: [
              "Fewer sharp corners is better — Metric: number of sharp corners.",
              "Requirement should be more specific, but unsure how to phrase it.",
            ],
            constraints: ["Some components we order may come with sharp corners."],
            links: [],
            flag: null,
          },
          {
            id: "sizing",
            objective: "Sizing",
            subObjectives: ["Artem has a big shelf (dimensions TBD)."],
            metric: [],
            constraints: [
              "Wet lab — regular benchtop level of space (Patricia will measure?); a decent-sized desk for one person?",
            ],
            links: [],
            flag: null,
          },
        ],
      },
      {
        id: "parking-lot",
        title: "Parking Lot / Additional Ideas",
        objectiveNote: "Loose ideas captured at the end of the doc — not yet structured.",
        rows: [
          {
            id: "airplane-window",
            objective: "Airplane window to inspect bioreactor progression",
            subObjectives: [],
            metric: [],
            constraints: [],
            links: [],
            flag: null,
          },
          {
            id: "peristaltic-pump-reopen",
            objective: "Peristaltic pump reopen",
            subObjectives: [
              "Assemble in a way that only requires autoclaving of tubes that can easily be unattached.",
            ],
            metric: [],
            constraints: [],
            links: [],
            flag: null,
          },
        ],
      },
    ],
  },
]

/** Convenience: latest version is the last entry. */
export const LATEST_REQUIREMENT_VERSION_INDEX =
  BIOREACTOR_REQUIREMENT_VERSIONS.length - 1

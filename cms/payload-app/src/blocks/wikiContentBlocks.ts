import type { Block } from 'payload'

/** Fields shared by standalone Figure blocks and figures inside ImageGrid. */
export const figureItemFields = [
  {
    name: 'image',
    type: 'relationship' as const,
    relationTo: 'media' as const,
    admin: {
      description:
        'Upload or choose a Payload media item. Export copies it into Gatsby static files.',
    },
  },
  {
    name: 'src',
    type: 'text' as const,
    admin: {
      description:
        'Optional fallback for existing static paths such as /images/example.png. Prefer Media above.',
    },
  },
  {
    name: 'alt',
    type: 'text' as const,
    required: true,
  },
  {
    name: 'caption',
    type: 'textarea' as const,
  },
  {
    name: 'credit',
    type: 'text' as const,
    admin: {
      description: 'Optional photo credit shown below the caption.',
    },
  },
]

/**
 * Payload blocks that map 1:1 to approved MDX components in
 * `src/components/mdx/wikiComponents.js` (see docs/content-authoring.md).
 */
export const wikiContentBlocks: Block[] = [
  {
    slug: 'richText',
    labels: {
      singular: 'Rich Text',
      plural: 'Rich Text',
    },
    fields: [
      {
        name: 'body',
        type: 'richText',
        required: true,
      },
    ],
  },
  {
    slug: 'callout',
    labels: {
      singular: 'Callout',
      plural: 'Callouts',
    },
    fields: [
      {
        name: 'title',
        type: 'text',
      },
      {
        name: 'tone',
        type: 'select',
        defaultValue: 'note',
        options: [
          { label: 'Note', value: 'note' },
          { label: 'Success', value: 'success' },
          { label: 'Warning', value: 'warning' },
        ],
      },
      {
        name: 'body',
        type: 'textarea',
        required: true,
      },
    ],
  },
  {
    slug: 'figure',
    labels: {
      singular: 'Figure',
      plural: 'Figures',
    },
    fields: figureItemFields,
  },
  {
    slug: 'imageGrid',
    labels: {
      singular: 'Image Grid',
      plural: 'Image Grids',
    },
    fields: [
      {
        name: 'figures',
        type: 'array',
        required: true,
        minRows: 1,
        labels: {
          singular: 'Figure',
          plural: 'Figures',
        },
        fields: figureItemFields,
      },
    ],
  },
  {
    slug: 'dataTable',
    labels: {
      singular: 'Data Table',
      plural: 'Data Tables',
    },
    fields: [
      {
        name: 'caption',
        type: 'text',
      },
      {
        name: 'tableMarkdown',
        type: 'textarea',
        required: true,
        admin: {
          description:
            'GitHub-flavored markdown table (header row, separator, data rows). Example:\n| Col A | Col B |\n| --- | --- |\n| a | b |',
        },
      },
    ],
  },
  {
    slug: 'contributionCalendar',
    labels: {
      singular: 'Contribution Calendar',
      plural: 'Contribution Calendars',
    },
    fields: [
      {
        name: 'title',
        type: 'text',
        admin: {
          description: 'Optional heading shown above the contribution calendar.',
        },
      },
      {
        name: 'caption',
        type: 'textarea',
        admin: {
          description: 'Optional caption shown below the contribution calendar.',
        },
      },
    ],
  },
  {
    slug: 'hardwareArchitectureDiagram',
    labels: {
      singular: 'Hardware Architecture Diagram',
      plural: 'Hardware Architecture Diagrams',
    },
    fields: [],
  },
  {
    slug: 'designSketchbook',
    labels: {
      singular: 'Design Sketchbook',
      plural: 'Design Sketchbooks',
    },
    fields: [],
  },
  {
    slug: 'pageTabs',
    labels: {
      singular: 'Page Tabs',
      plural: 'Page Tabs',
    },
    fields: [
      {
        name: 'layout',
        type: 'select',
        defaultValue: 'horizontal',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Side', value: 'side' },
        ],
      },
      {
        name: 'defaultTab',
        type: 'text',
        admin: {
          description: 'Optional tab id to open first, e.g. progress.',
        },
      },
      {
        name: 'tabs',
        type: 'array',
        required: true,
        minRows: 1,
        labels: {
          singular: 'Tab',
          plural: 'Tabs',
        },
        fields: [
          {
            name: 'id',
            type: 'text',
            required: true,
            admin: {
              description: 'Stable id using letters, numbers, hyphens, or underscores.',
            },
          },
          {
            name: 'label',
            type: 'text',
            required: true,
          },
          {
            name: 'body',
            type: 'textarea',
            required: true,
            admin: {
              description: 'Markdown content for this tab. MDX components can be used if needed.',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'interactiveGizmo',
    labels: {
      singular: 'Interactive Gizmo',
      plural: 'Interactive Gizmos',
    },
    fields: [
      {
        name: 'gizmo',
        type: 'select',
        required: true,
        defaultValue: 'growthCurve',
        options: [
          { label: 'Growth Curve Simulator', value: 'growthCurve' },
          { label: 'Hardware Notebook', value: 'hardwareNotebook' },
          { label: 'Contribution Timeline', value: 'contributionTimeline' },
          { label: 'Bioreactor Requirements', value: 'bioreactorRequirements' },
        ],
        admin: {
          description: 'Which approved interactive component to render.',
        },
      },
      {
        name: 'title',
        type: 'text',
        admin: {
          description: 'Optional heading shown above the gizmo.',
        },
      },
      {
        name: 'config',
        type: 'json',
        admin: {
          description:
            'Optional settings passed to the gizmo as props, e.g. { "growthRate": 0.5, "carryingCapacity": 200 }. Leave blank to use defaults.',
        },
      },
      {
        name: 'caption',
        type: 'textarea',
        admin: {
          description: 'Optional caption shown below the gizmo.',
        },
      },
    ],
  },
  {
    slug: 'markdown',
    labels: {
      singular: 'Markdown / MDX',
      plural: 'Markdown / MDX',
    },
    fields: [
      {
        name: 'body',
        type: 'textarea',
        required: true,
        admin: {
          description:
            'Escape hatch for web members when a visual block is not enough. Prefer the blocks above.',
        },
      },
    ],
  },
]

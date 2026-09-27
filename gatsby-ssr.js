const React = require("react")

/**
 * Browsers still request /favicon.ico by default; we ship /favicon.svg and advertise it here.
 * Add static/favicon.ico later if you want to silence that specific request.
 */
/** PETABITE logo loop frames — the loading screen shows these first (see src/components/logoFrames.js). */
const LOGO_FRAME_URLS = Array.from(
  { length: 9 },
  (_, i) =>
    `https://static.igem.wiki/teams/6187/wiki/homepage-components/logo-animation-files/untitled-artwork-${i + 1}.avif`,
)

exports.onRenderBody = ({ setHeadComponents }) => {
  setHeadComponents([
    React.createElement("link", {
      key: "favicon-svg",
      rel: "icon",
      href: "/favicon.svg",
      type: "image/svg+xml",
    }),
    ...LOGO_FRAME_URLS.map((href, i) =>
      React.createElement("link", {
        key: `logo-frame-${i}`,
        rel: "preload",
        as: "image",
        href,
        fetchpriority: "high",
      }),
    ),
  ])
}

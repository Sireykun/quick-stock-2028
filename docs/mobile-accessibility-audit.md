# Mobile speed and accessibility check

Date: 16 October 2026. Target: WCAG 2.2 AA. Tested the public sign-in view at 390 × 844 in Chrome headless, with a 4× CPU slowdown and simulated 150 ms latency / 1.6 Mbps download.

- Production first contentful paint: 2.14 seconds in one cold run. Resource transfer reported by the browser: 271 KB. These are single-run measurements, not a field percentile.
- Horizontal overflow: 0 px at 390 px viewport width.
- Keyboard: the first Tab focuses the Google sign-in button. Visible controls have a 3 px `:focus-visible` outline; reduced-motion mode turns off transitions and animations.
- Khmer audit PDF: rendered one-page sample with Khmer title, headers, room, and item using the bundled Khmer font. Visual inspection confirmed the text was legible and within its cells.
- Initial JavaScript remains large (about 526 KB minified, 144 KB gzip). Daily backup code now loads after authentication, reducing the initial chunk by about 42 KB minified.

Limits: authenticated inventory screens and actual Google/Drive consent require an authorized account. They were not included in the browser measurement. A complete WCAG conformance claim requires those screens and assistive-technology testing. The Telegram-generated stock PDF still uses its legacy PDF writer and has not been verified for Khmer glyph rendering.

## Authenticated mobile follow-up — 16 October 2026

Inspected the authenticated Settings view at a phone breakpoint. The mobile header icon controls measured about 34 px, the permission and revoke controls about 26–27 px, and several audit rule fields and actions about 22–36 px in the browser's rendered view. The checkbox itself was about 15 px. The app now gives mobile controls at least a 44 px CSS hit area, increases checkbox size and clickable label height, and keeps the bottom navigation at least 56 px tall. The mobile More menu closes with Escape and returns focus to its button. Icon-only header controls have accessible names; current mobile navigation announces the active page.

The shared focus indicator is a 3 px outline in both themes, with a contrasting separation ring. Primary blue buttons and the main blue/cyan gradients use darker colors for white text, and the dark-mode Revoke action uses a lighter red. Opening More moves keyboard focus to its first link; Escape closes it and returns focus to the More button. These changes improve the audited paths but are not a complete WCAG 2.2 AA conformance claim. Remaining verification includes all authenticated screens, screen readers, 200% text resizing, and color contrast on image or translucent backgrounds.

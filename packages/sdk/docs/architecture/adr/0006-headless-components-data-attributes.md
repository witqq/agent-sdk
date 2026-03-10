---
title: "ADR-0006: Adopt Headless Component Pattern with Data Attributes"
status: accepted
---

# ADR-0006: Adopt Headless Component Pattern with Data Attributes

## Status
Accepted

## Context
- Chat React components (Thread, Composer, ChatUI, etc.) must work in any design system: Material UI, Tailwind, custom CSS
- SDK consumers should not fight against pre-applied styles or import CSS they don't want
- React 18+ is an optional peer dep — components cannot use JSX (would require React in scope at build time)
- Components need stable hooks for testing (e.g., `[data-thread-message]`, `[data-action="send"]`)
- Quality attributes affected: QA-6 (Developer Experience), Portability

## Decision
All React components use `createElement` (no JSX), render semantic HTML with `data-*` attributes for styling hooks and test selectors, and ship zero CSS by default. An optional `theme.css` provides a default theme using CSS custom properties targeting `data-*` selectors.

## Options Considered

### Option 1: Styled Components with CSS-in-JS
- Pros: Complete visual design out of the box; styles co-located with components; theme provider pattern
- Cons: Runtime CSS overhead; style conflicts with consumer's design system; forces CSS-in-JS dependency; hard to override deeply nested styles

### Option 2: Headless with Data Attributes (chosen)
- Pros: Zero style opinions; consumers use their own CSS framework; `data-*` selectors are stable test hooks; theme.css is opt-in; no CSS-in-JS runtime; works with Tailwind, CSS modules, vanilla CSS
- Cons: Components look unstyled by default (poor first impression); consumers must write CSS; more documentation needed to show styling patterns

### Option 3: Render Props / Headless Hooks Only (no DOM)
- Pros: Maximum flexibility; zero markup opinions
- Cons: Consumers must write all markup + logic; no composable components; dramatically increases integration effort; defeats purpose of a UI SDK

## Consequences
- Positive: SDK works with any CSS framework. Test selectors like `[data-thread-message]` are stable across releases. `theme.css` provides instant visual design for demos/prototyping. No CSS-in-JS runtime dependency.
- Negative: First experience without CSS is a blank page with unstyled divs. Consumer must import `theme.css` or write custom CSS. Documentation must show styling examples for major frameworks.
- Risks: If `data-*` attribute names change, consumer CSS and tests break. Must treat attribute names as public API.

## Related
- [ADR-0005](./0005-granular-package-exports.md) — theme.css is a separate export entry
- [ADR-0001](./0001-independent-sibling-interfaces.md) — headless components consume IChatClient/IChatRuntime via context

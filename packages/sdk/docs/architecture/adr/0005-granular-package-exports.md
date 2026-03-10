---
title: "ADR-0005: Use Granular Package Exports for Tree-Shaking"
status: accepted
---

# ADR-0005: Use Granular Package Exports for Tree-Shaking

## Status
Accepted

## Context
- The SDK contains 11 bounded contexts with different consumer profiles: some apps need only agent core, others need full chat UI
- Backend SDKs (Copilot, Claude, Vercel AI) are optional peer dependencies — importing one should not pull in the others
- React is an optional peer dep used only by chat UI consumers; server-only consumers should not bundle React code
- Bundle size directly impacts DX: consumers include SDK in their apps, unnecessary code increases their bundle
- Quality attributes affected: QA-6 (Developer Experience), Portability

## Decision
Use 21 granular `exports` entries in package.json, each mapping to a separate tsup entry point. Consumers import only what they need via deep paths (e.g., `@witqq/agent-sdk/chat/react`, `@witqq/agent-sdk/copilot`).

## Options Considered

### Option 1: Single Entry Point with Namespace Exports
- Pros: Simpler import paths (`import { ChatRuntime } from '@witqq/agent-sdk'`), easier to discover API
- Cons: Bundlers must tree-shake entire SDK; optional peer deps become de-facto required (import resolution fails); 762KB+ in every consumer bundle regardless of usage

### Option 2: Granular Package Exports (chosen)
- Pros: True tree-shaking at package boundary; optional peers only resolved when their entry point is imported; each export is independently testable; consumers pay only for what they use
- Cons: 21 entry points to maintain in package.json + tsup config; more import paths for consumers to learn; breaking change risk when restructuring exports

### Option 3: Separate npm Packages per Module
- Pros: Maximum isolation; independent versioning per module
- Cons: Monorepo overhead (lerna/nx); cross-package type sharing is fragile; 11+ packages to publish and version; consumers need many `npm install` commands

## Consequences
- Positive: Server-only consumers get ~50KB instead of 762KB. React is never bundled unless `@witqq/agent-sdk/chat/react` is imported. Backend SDK peer deps don't cause resolution errors unless their specific entry is used.
- Negative: 21 entry points in package.json require maintenance. Adding a new export is a public API commitment. Consumers must know which entry point to use.
- Risks: Entry point restructuring is a breaking change. Must document which types come from which entry point.

## Related
- [Container Diagram](../container-diagram.md) — entry points map 1:1 to containers
- [ADR-0003](./0003-cli-subprocess-backends.md) — optional peer deps enabled by granular exports

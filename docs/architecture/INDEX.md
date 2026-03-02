---
title: Architecture Documentation Index
project: "@witqq/agent-sdk"
version: "0.8.0"
---

# Architecture Documentation

## Overview

- [Architecture Overview](./overview.md) — System purpose, constraints, quality goals, key decisions

## C4 Diagrams

- [Context Diagram (C4 L1)](./context-diagram.md) — System boundary, external actors
- [Container Diagram (C4 L2)](./container-diagram.md) — Internal modules / entry points
- Component Diagrams (C4 L3) — N/A. Container-level decomposition shows individual classes via annotations, and per-module details are in the Bounded Context Map's Owned Entities column.

## Domain

- [Bounded Context Map](./bounded-context-map.md) — 11 contexts with DDD relationships

## Quality

- [Quality Attributes](./quality-attributes.md) — 6 measurable scenarios with targets
- [Risks and Technical Debt](./risks-and-debt.md) — 6 resolved gaps + 9 open items from feedback audit

## Decisions

- [ADR-0001: Use independent sibling interfaces](./adr/0001-independent-sibling-interfaces.md)
- [ADR-0002: Stateless runtime with per-call resolution](./adr/0002-stateless-runtime.md)
- [ADR-0003: CLI subprocess backends](./adr/0003-cli-subprocess-backends.md)
- [ADR-0004: Server-mediated authentication](./adr/0004-server-mediated-auth.md)
- [ADR-0005: Granular package exports for tree-shaking](./adr/0005-granular-package-exports.md)
- [ADR-0006: Headless components with data attributes](./adr/0006-headless-components-data-attributes.md)
- [ADR-0007: Dual event systems with bridge](./adr/0007-dual-event-systems-with-bridge.md)

## Reference

- [API Surface](./api-surface.md) — All 21 package exports with stability levels
- [Crosscutting Concerns](./crosscutting-concerns.md) — 8 concerns: auth, errors, validation, transport, persistence
- [Glossary](./glossary.md) — Key terms and definitions

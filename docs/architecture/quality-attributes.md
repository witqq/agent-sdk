---
title: Quality Attributes
project: "@witqq/agent-sdk"
---

# Quality Attributes

## Priority Justification

1. **Maintainability (Dead Code & Interface Compliance)** — Dead infrastructure and missing interface methods cause unsafe casts and confuse developers. Must fix first.
2. **Documentation Accuracy** — CLAUDE.md is consumed by LLM agents as primary architecture reference. Phantom types cause hallucinated APIs.
3. **Type Safety** — SDK's value proposition is type-safe multi-backend abstraction. Every assertion is a potential runtime bug.

## Scenarios

### QA-1: Maintainability — Dead Code & Interface Compliance (Priority 1)

| Aspect | Detail |
|--------|--------|
| Source | SDK developer |
| Stimulus | Adding a new feature or fixing a bug in chat module |
| Environment | Developer modifies or extends the chat module |
| Response | All code paths reachable. All interface methods fulfilled. Shared patterns extracted. |
| Measure | 0 dead code areas, 0 interface violations, 0 duplicated patterns |
| Current | 0 dead code areas, 0 interface violations, 0 duplicated patterns (resolved: Gaps 1-3) |

### QA-2: Documentation Accuracy (Priority 2)

| Aspect | Detail |
|--------|--------|
| Source | LLM agent or new developer |
| Stimulus | Reading CLAUDE.md to understand SDK architecture |
| Environment | Developer or LLM agent reads CLAUDE.md |
| Response | All interfaces, methods, and decisions match actual code |
| Measure | 0 phantom type/method references (verified by grep against exports) |
| Current | Fixed in this session (was 10+ phantom references) |

### QA-3: Type Safety — Assertion Count (Priority 3)

| Aspect | Detail |
|--------|--------|
| Source | TypeScript compiler |
| Stimulus | Compiling with strict: true |
| Environment | TypeScript strict mode |
| Response | Fix architectural gap, review unsafe assertions |
| Measure | 0 architecturally-caused assertions; total unsafe (as any/unknown) categorized and justified |
| Current | 0 architecturally-caused (resolved in commit a6cbde7); 34 total unsafe (8 `as any` + 26 `as unknown`), all at SDK/external type boundaries — see risks-and-debt.md Gap 5 for full categorization |

### QA-4: Testability — Mock-Interface Parity (Priority 4)

| Aspect | Detail |
|--------|--------|
| Source | SDK consumer writing tests |
| Stimulus | Importing mock factories for unit tests |
| Environment | Consumer test suite |
| Response | Mock factories satisfy interfaces at compile time |
| Measure | 100% method coverage on mocks; types assignable to interfaces |
| Current | Mostly aligned; some method names may be stale |

### QA-5: Security — Credential Isolation (Priority 5)

| Aspect | Detail |
|--------|--------|
| Source | Concurrent users |
| Stimulus | Simultaneous requests with different provider credentials |
| Environment | Production multi-user deployment |
| Response | Credentials transient per-request. Browser never receives raw tokens. |
| Measure | 0 credential storage in runtime/adapter; 0 auth imports in browser bundle |
| Current | Compliant (per ADR-0002 and ADR-0004) |

### QA-6: Developer Experience — API Ergonomics (Priority 6)

| Aspect | Detail |
|--------|--------|
| Source | New SDK consumer |
| Stimulus | Building a chat application for the first time |
| Environment | New project setup |
| Response | Standard workflows work without type assertions or workarounds |
| Measure | 0 required casts; under 5 imports for basic app; under 30 lines of app code |
| Current | 0 required casts (getContextStats gap resolved); demo shows ~80 lines |

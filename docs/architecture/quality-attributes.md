---
title: Quality Attributes
project: "@witqq/agent-sdk"
---

# Quality Attributes

## Scenarios

### QA-1: Maintainability — Dead Code & Interface Compliance

| Aspect | Detail |
|--------|--------|
| Source | SDK developer |
| Stimulus | Adding a new feature or fixing a bug in chat module |
| Environment | Developer modifies or extends the chat module |
| Response | All code paths reachable. All interface methods fulfilled. Shared patterns extracted. |
| Measure | 0 dead code areas, 0 interface violations, 0 duplicated patterns |

### QA-2: Documentation Accuracy

| Aspect | Detail |
|--------|--------|
| Source | LLM agent or new developer |
| Stimulus | Reading CLAUDE.md to understand SDK architecture |
| Environment | Developer or LLM agent reads CLAUDE.md |
| Response | All interfaces, methods, and decisions match actual code |
| Measure | 0 phantom type/method references (verified by grep against exports) |

### QA-3: Type Safety — Assertion Count

| Aspect | Detail |
|--------|--------|
| Source | TypeScript compiler |
| Stimulus | Compiling with strict: true |
| Environment | TypeScript strict mode |
| Response | Fix architectural gap, review unsafe assertions |
| Measure | 0 architecturally-caused assertions; total unsafe (as any/unknown) categorized and justified |

### QA-4: Testability — Mock-Interface Parity

| Aspect | Detail |
|--------|--------|
| Source | SDK consumer writing tests |
| Stimulus | Importing mock factories for unit tests |
| Environment | Consumer test suite |
| Response | Mock factories satisfy interfaces at compile time |
| Measure | 100% method coverage on mocks; types assignable to interfaces |

### QA-5: Security — Credential Isolation

| Aspect | Detail |
|--------|--------|
| Source | Concurrent users |
| Stimulus | Simultaneous requests with different provider credentials |
| Environment | Production multi-user deployment |
| Response | Credentials transient per-request. Browser never receives raw tokens. |
| Measure | 0 credential storage in runtime/adapter; 0 auth imports in browser bundle |

### QA-6: Developer Experience — API Ergonomics

| Aspect | Detail |
|--------|--------|
| Source | New SDK consumer |
| Stimulus | Building a chat application for the first time |
| Environment | New project setup |
| Response | Standard workflows work without type assertions or workarounds |
| Measure | 0 required casts; under 5 imports for basic app; under 30 lines of app code |

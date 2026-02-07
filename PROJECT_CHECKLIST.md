# Project Checklist — agent-sdk

## Code Quality
- [x] TypeScript strict mode enabled
- [x] No `any` types (use `unknown` + type guards)
- [x] All public APIs have JSDoc comments
- [x] No unused imports/variables (noUnusedLocals)
- [x] Error classes extend AgentSDKError base

## Testing
- [x] Unit tests for all core types and type guards
- [x] Unit tests for registry and factory
- [x] Unit tests for base agent state machine
- [x] Unit tests for permission store (3-store architecture)
- [x] Unit tests for each backend (copilot, claude, vercel-ai)
- [x] Cross-backend streaming event consistency tests
- [ ] Integration tests for each backend (with cheap models) — requires real CLI auth

## Build & Package
- [x] tsup produces ESM + CJS + DTS
- [x] Separate entry points per backend
- [x] Tree-shaking works (importing one backend doesn't bundle others)
- [x] npm pack produces valid package
- [x] package.json exports are correct
- [x] MIT LICENSE file present

## Documentation
- [x] CLAUDE.md with project overview and all backends
- [x] README.md with usage examples for all features
- [x] DOCUMENTATION-STYLE-GUIDE.md
- [x] All public types have descriptions
- [ ] CHANGELOG.md updated before each release

## Architecture
- [x] ToolDeclaration/ToolDefinition split (B1)
- [x] Generic AgentResult<T> (B4)
- [x] Backend registry pattern (B5)
- [x] Type-safe factory with overloads (B6)
- [x] Re-entrancy guard (M8)
- [x] Permission scopes v3.1 (once/session/project/always)
- [x] Permission store (InMemory + File + Composite)
- [x] User input with freeform support
- [x] Streaming event consistency across backends

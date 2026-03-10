# Quality Checklist

Quality gates for `@witqq/agent-sdk`. Reference during development and before commits.

## Before Commit

- [ ] `npm run build` — compiles without errors (tsup, ~20 entry points)
- [ ] `npm run typecheck` — `tsc --noEmit` passes with strict mode
- [ ] `npm run test` — all unit tests pass (vitest, 2365+ tests)
- [ ] No `console.log` / debug statements left in `src/`
- [ ] No `any` types introduced (one benign exception in `listener-set.ts`)
- [ ] New public APIs have JSDoc comments
- [ ] Exports updated in `src/index.ts` and relevant sub-entry if needed

## Before Merge

- [ ] All existing tests still pass
- [ ] New functionality has tests — unit at minimum
- [ ] Breaking changes documented in commit message
- [ ] `package.json` exports map updated if new entry points added
- [ ] Documentation updated if public API changed
- [ ] CHANGELOG.md updated for notable changes

## Code Quality

- [ ] TypeScript strict mode satisfied — no `@ts-ignore`, no `as any`
- [ ] Functions focused — single responsibility
- [ ] Error hierarchy respected — extend `AgentSDKError` for SDK errors
- [ ] Backend-specific code stays in backend modules (not in core)
- [ ] Optional peer deps — backend SDKs not imported unconditionally
- [ ] Tree-shaking preserved — separate entry points for each backend

## Testing Standards

- [ ] Unit tests in `tests/unit/` mirroring `src/` structure
- [ ] Integration tests in `tests/integration/` for real CLI auth flows
- [ ] **Model restrictions**: Copilot → `gpt-5-mini`, Claude → `claude-haiku-4-5-*`, Vercel → `openai/gpt-4.1-mini`
- [ ] No paid models in automated tests
- [ ] Test names describe behavior, not implementation

## Documentation

- [ ] Follow `docs/DOCUMENTATION-STANDARDS.md`
- [ ] Code examples are complete and runnable (include imports)
- [ ] TypeScript only — never `js` in code blocks
- [ ] Tables for structured comparisons

## Architecture

- [ ] Shared interfaces in `src/` core, backend-specific in `src/backends/`
- [ ] Chat SDK components in `src/chat/`, React in `src/chat/react/`
- [ ] Permission model follows v3.1 scopes: `once | session | project | always`
- [ ] Zod compatibility maintained: v3.23+ and v4.x

# Documentation Standards

Standards for all documentation in `@witqq/agent-sdk`.

## Language & Tone

- Terse, technical, developer-first. No marketing, no filler.
- Short declarative sentences. Imperative verbs for instructions.
- Em dashes (`—`) for inline clarifications instead of parentheses.
- English for all documentation. Russian only in `CLAUDE.md` custom instructions.

## File Structure

```
README.md                    — package overview, install, quick start
CLAUDE.md                    — AI agent cheat-sheet (build, arch, restrictions)
CHANGELOG.md                 — release history
docs/
  architecture/
    INDEX.md                 — architecture docs entry point
    overview.md              — system overview
    api-surface.md           — all exports reference
    adr/                     — Architecture Decision Records
  chat-sdk/
    README.md                — consumer docs entry point
    server-quickstart.md     — setup guide
    custom-transports.md     — transport implementation
    custom-renderers.md      — CSS theming, slot overrides
```

### Naming

- **lowercase-kebab-case** for all doc files: `server-quickstart.md`, `api-surface.md`
- `README.md` or `INDEX.md` as directory entry points
- ADRs: `NNN-short-title.md` (e.g., `001-backend-abstraction.md`)

## Formatting

### Headings

- `#` H1 — document title (one per file)
- `##` H2 — major sections
- `###` H3 — subsections within a feature
- No H4+ unless absolutely necessary

### Code Blocks

- Always specify language: ` ```typescript `, ` ```bash `
- TypeScript for all code examples (never `js`)
- Examples must be complete and runnable — include imports
- Inline comments explain key fields

```typescript
import { createAgent } from '@witqq/agent-sdk';

const agent = createAgent({
  backend: 'copilot-cli', // or 'claude-cli', 'vercel-ai'
  model: { id: 'gpt-5-mini' },
});
```

### Tables

Use tables for structured comparisons — backends, events, scopes, options:

```markdown
| Backend      | Type    | Tool Loop |
| ------------ | ------- | --------- |
| copilot-cli  | CLI SDK | External  |
| claude-cli   | CLI SDK | External  |
| vercel-ai    | API SDK | Internal  |
```

### Lists

- `-` for unordered lists
- `1.` for ordered/sequential steps
- `"value"` — format for enumerating option values in lists

## API Documentation

### In Source (JSDoc)

- Every public export gets a JSDoc comment
- Single-line JSDoc for simple declarations: `/** Factory function that creates a backend service */`
- Multi-line for complex interfaces with field descriptions
- No `@param`/`@returns` — use self-contained prose descriptions

```typescript
/** Permission scope controlling tool authorization lifetime */
type PermissionScope = 'once' | 'session' | 'project' | 'always';
```

### In Docs

- Show interface/type definition first, then usage example
- Every public function: description, parameters (via type), example
- Group related APIs in the same document

## Architecture Docs

- Follow arc42 template structure
- ADRs for significant decisions with status, context, decision, consequences
- YAML frontmatter for metadata: `title`, `project`, `arc42_sections`

## Diagrams

- Text-only. ASCII or Mermaid for architecture diagrams.
- No screenshots or images.

## What NOT to Do

- No emoji in documentation
- No "amazing", "revolutionary", "awesome" — state facts
- No version history in doc files (use CHANGELOG.md)
- No `@author` tags
- No commented-out documentation

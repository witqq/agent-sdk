# Documentation Style Guide — agent-sdk

## Principles

- Technical facts only, no marketing language
- Concrete commands and paths
- Code examples with correct syntax
- Interface definitions where relevant

## Format

- Markdown for all documentation
- Code blocks with language tags
- Headers: `#` for title, `##` for sections, `###` for subsections
- No emoji in headers

## Code Examples

- Must compile and run
- Use TypeScript with types
- Show imports
- Include expected output where helpful

## API Documentation

- JSDoc on all public exports
- `@param` for function parameters
- `@returns` for return values
- `@throws` for errors
- `@example` for usage

## README Structure

1. One-sentence description
2. Install command
3. Quick start example
4. API reference (brief)
5. Backend-specific notes

## Naming

- Types: PascalCase (`AgentConfig`, `ToolDefinition`)
- Functions: camelCase (`createAgentService`, `registerBackend`)
- Constants: UPPER_SNAKE_CASE where appropriate
- Files: kebab-case (`vercel-ai.ts`, `base-agent.ts`)

import { createElement, type ReactNode } from "react";

/** Props for the MarkdownRenderer component. */
export interface MarkdownRendererProps {
  content: string;
  renderCode?: (code: string, language?: string) => ReactNode;
  renderLink?: (href: string, text: string) => ReactNode;
}

// ─── Token types for the parser ────────────────────────────────

interface HeadingToken { type: "heading"; level: number; content: string; }
interface ParagraphToken { type: "paragraph"; content: string; }
interface CodeBlockToken { type: "code_block"; code: string; language?: string; }
interface BlockquoteToken { type: "blockquote"; content: string; }
interface ListToken { type: "list"; ordered: boolean; items: string[]; }

type BlockToken = HeadingToken | ParagraphToken | CodeBlockToken | BlockquoteToken | ListToken;

// ─── Block-level parser ────────────────────────────────────────

function parseBlocks(text: string): BlockToken[] {
  const tokens: BlockToken[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (fenced)
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const language = fenceMatch[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      tokens.push({ type: "code_block", code: codeLines.join("\n"), language });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      tokens.push({ type: "heading", level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      tokens.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      tokens.push({ type: "list", ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      tokens.push({ type: "list", ordered: true, items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-empty lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^(#{1,6}\s|```|>\s|[-*]\s|\d+\.\s)/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      tokens.push({ type: "paragraph", content: paraLines.join("\n") });
    }
  }

  return tokens;
}

// ─── Inline parser ─────────────────────────────────────────────

function parseInline(text: string, props?: MarkdownRendererProps): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Pattern: inline code, bold, italic, links
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const fragment = match[0];

    if (fragment.startsWith("`")) {
      // Inline code
      const code = fragment.slice(1, -1);
      nodes.push(createElement("code", { key: `ic-${match.index}`, "data-md-inline-code": true }, code));
    } else if (fragment.startsWith("**")) {
      // Bold
      const content = fragment.slice(2, -2);
      nodes.push(createElement("strong", { key: `b-${match.index}` }, content));
    } else if (fragment.startsWith("*") || fragment.startsWith("_")) {
      // Italic
      const content = fragment.slice(1, -1);
      nodes.push(createElement("em", { key: `i-${match.index}` }, content));
    } else if (fragment.startsWith("[")) {
      // Link
      const linkMatch = fragment.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        nodes.push(
          props?.renderLink
            ? props.renderLink(linkMatch[2], linkMatch[1])
            : createElement("a", { key: `a-${match.index}`, href: linkMatch[2] }, linkMatch[1]),
        );
      }
    }

    lastIndex = match.index + fragment.length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

// ─── Block renderer ────────────────────────────────────────────

function renderBlock(token: BlockToken, index: number, props: MarkdownRendererProps): ReactNode {
  switch (token.type) {
    case "heading":
      return createElement(
        `h${token.level}` as keyof HTMLElementTagNameMap,
        { key: index, "data-md-heading": true },
        ...parseInline(token.content, props),
      );

    case "paragraph":
      return createElement(
        "p",
        { key: index, "data-md-paragraph": true },
        ...parseInline(token.content, props),
      );

    case "code_block":
      if (props.renderCode) {
        return props.renderCode(token.code, token.language);
      }
      return createElement(
        "pre",
        { key: index, "data-md-code-block": true },
        createElement(
          "code",
          { className: token.language ? `language-${token.language}` : undefined },
          token.code,
        ),
      );

    case "blockquote":
      return createElement(
        "blockquote",
        { key: index, "data-md-blockquote": true },
        ...parseInline(token.content, props),
      );

    case "list": {
      const tag = token.ordered ? "ol" : "ul";
      const items = token.items.map((item, i) =>
        createElement("li", { key: i }, ...parseInline(item, props)),
      );
      return createElement(tag, { key: index, "data-md-list": true }, ...items);
    }
  }
}

/**
 * Headless markdown renderer.
 * Parses markdown text to semantic HTML elements via createElement.
 * Supports headings, paragraphs, bold, italic, inline code, code blocks,
 * links, blockquotes, and lists. No external dependencies.
 */
export function MarkdownRenderer(props: MarkdownRendererProps): ReactNode {
  const tokens = parseBlocks(props.content);
  const children = tokens.map((token, i) => renderBlock(token, i, props));
  return createElement("div", { "data-md-root": true }, ...children);
}

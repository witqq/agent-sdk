import { z } from "zod";

export const DEMO_TOOLS = [
  {
    name: "search_news",
    description: "Search for recent news on a topic.",
    parameters: z.object({ query: z.string().describe("Search query") }),
    execute: async (args: { query: string }) => JSON.stringify({
      results: [
        { headline: `Breaking: ${args.query}`, snippet: "Major developments today..." },
        { headline: `${args.query}: What you need to know`, snippet: "A comprehensive look..." },
      ],
    }),
  },
  {
    name: "calculator",
    description: "Evaluate arithmetic expressions (+, -, *, /).",
    parameters: z.object({ expression: z.string().describe("Math expression") }),
    execute: async (args: { expression: string }) => {
      try {
        const safe = args.expression.replace(/[^0-9+\-*/.() ]/g, "");
        return JSON.stringify({ result: Function(`"use strict"; return (${safe})`)() });
      } catch { return JSON.stringify({ error: `Cannot evaluate: ${args.expression}` }); }
    },
  },
  {
    name: "format_output",
    description: "Format and display structured output.",
    parameters: z.object({
      title: z.string(), bullets: z.array(z.string()), conclusion: z.string(),
    }),
    needsApproval: true,
    execute: async (args: { title: string; bullets: string[]; conclusion: string }) =>
      [`# ${args.title}`, "", ...args.bullets.map(b => `• ${b}`), "", args.conclusion].join("\n"),
  },
];

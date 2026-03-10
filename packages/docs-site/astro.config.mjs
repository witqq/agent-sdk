import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://agent-sdk.witqq.com",
  integrations: [
    starlight({
      title: "@witqq/agent-sdk",
      description:
        "AI agent abstraction layer — Copilot CLI, Claude CLI, Vercel AI, Mock LLM",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/nicyuvi/agent-sdk",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          autogenerate: { directory: "getting-started" },
        },
        {
          label: "Backends",
          autogenerate: { directory: "backends" },
        },
        {
          label: "Tools & Permissions",
          autogenerate: { directory: "tools" },
        },
        {
          label: "Streaming & Events",
          autogenerate: { directory: "streaming" },
        },
        {
          label: "Authentication",
          autogenerate: { directory: "auth" },
        },
        {
          label: "Storage",
          autogenerate: { directory: "storage" },
        },
        {
          label: "Testing",
          autogenerate: { directory: "testing" },
        },
        {
          label: "Chat SDK",
          autogenerate: { directory: "chat-sdk" },
        },
        {
          label: "Examples & Tutorials",
          autogenerate: { directory: "examples" },
        },
        {
          label: "API Reference",
          items: [
            {
              label: "Overview",
              slug: "api-reference",
            },
            {
              label: "Core",
              items: [
                { slug: "api-reference/core" },
                { slug: "api-reference/auth" },
                { slug: "api-reference/testing" },
              ],
            },
            {
              label: "Backends",
              autogenerate: { directory: "api-reference/backends" },
            },
            {
              label: "Chat SDK",
              autogenerate: { directory: "api-reference/chat" },
            },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
      pagefind: true,
      editLink: {
        baseUrl: "https://github.com/nicyuvi/agent-sdk/edit/main/packages/docs-site/",
      },
    }),
  ],
});

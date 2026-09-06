import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://agent-sdk.witqq.dev",
  integrations: [
    starlight({
      title: "@witqq/agent-sdk",
      description:
        "AI agent abstraction layer — Copilot CLI, Claude CLI, Vercel AI, Mock LLM",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/witqq/agent-sdk",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [{ autogenerate: { directory: "getting-started" } }],
        },
        {
          label: "Backends",
          items: [{ autogenerate: { directory: "backends" } }],
        },
        {
          label: "Tools & Permissions",
          items: [{ autogenerate: { directory: "tools" } }],
        },
        {
          label: "Streaming & Events",
          items: [{ autogenerate: { directory: "streaming" } }],
        },
        {
          label: "Authentication",
          items: [{ autogenerate: { directory: "auth" } }],
        },
        {
          label: "Storage",
          items: [{ autogenerate: { directory: "storage" } }],
        },
        {
          label: "Testing",
          items: [{ autogenerate: { directory: "testing" } }],
        },
        {
          label: "Chat SDK",
          items: [{ autogenerate: { directory: "chat-sdk" } }],
        },
        {
          label: "Examples & Tutorials",
          items: [{ autogenerate: { directory: "examples" } }],
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
              items: [{ autogenerate: { directory: "api-reference/backends" } }],
            },
            {
              label: "Chat SDK",
              items: [{ autogenerate: { directory: "api-reference/chat" } }],
            },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
      pagefind: true,
      editLink: {
        baseUrl: "https://github.com/witqq/agent-sdk/edit/master/packages/docs-site/",
      },
    }),
  ],
});

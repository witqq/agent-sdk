# Screenshot Validation Guide

Screenshot validation captures UI state during development. Used for the React chat UI component (`@witqq/agent-sdk/chat/react`) and demo application.

## When to Use

- After changes to `src/chat/react/` components
- After changes to `src/chat/react/theme.css`
- After changes to `packages/demo/frontend/`
- When verifying custom renderer behavior

## Directory Structure

```
moira-ws/<workspace>/
├── screenshots/               # Capture scripts
│   ├── capture-step-1.ts
│   └── ...
├── step-N/
│   └── iteration-N/
│       └── screenshots/       # Captured PNGs
│           ├── 01-chat-empty.png
│           └── 02-chat-message.png
└── development-plan.md
```

## Capture Script Template

```typescript
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:3456';
const STEP = 1;
const OUTPUT_DIR = path.resolve(
  `moira-ws/<workspace>/step-${STEP}/iteration-1/screenshots`
);

async function capture() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  await page.goto(BASE_URL);
  await page.waitForSelector('[data-chat-thread]');

  await page.screenshot({
    path: path.join(OUTPUT_DIR, '01-chat-initial.png'),
    fullPage: false,
  });

  await browser.close();
  console.log(`Screenshots saved to ${OUTPUT_DIR}`);
}

capture().catch(console.error);
```

## Prerequisites

```bash
npm run demo          # Start demo server on port 3456
npx playwright install chromium
```

## HTML Report Generation

Self-contained HTML report with base64-embedded screenshots:

```typescript
function generateReport(screenshotDir: string, outputPath: string) {
  const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
  const images = files.map(f => {
    const data = fs.readFileSync(path.join(screenshotDir, f));
    const base64 = data.toString('base64');
    return `<div><h3>${f}</h3><img src="data:image/png;base64,${base64}" style="max-width:100%;border:1px solid #ccc"/></div>`;
  });

  const html = `<!DOCTYPE html>
<html><head><title>Screenshot Report</title></head>
<body style="font-family:system-ui;max-width:1200px;margin:0 auto;padding:20px">
<h1>Screenshot Report — Step ${STEP}</h1>
${images.join('\n')}
</body></html>`;

  fs.writeFileSync(outputPath, html);
}
```

## Validation Criteria

When reviewing screenshots, check:

1. **UI loads** — no blank screens, spinners resolved
2. **Layout** — components positioned correctly, no overflow
3. **Theme** — CSS variables applied, dark/light mode correct
4. **Data** — messages render, tool calls display
5. **Responsiveness** — viewport sizes respected
6. **Errors** — no error boundaries triggered, no console errors

## Key Pages to Capture

| Page | URL | What to verify |
| ---- | --- | -------------- |
| Chat empty state | `/` | Thread renders, composer visible |
| Chat with messages | `/` (after sending) | Message bubbles, timestamps |
| Tool call display | `/` (after tool use) | Tool name, args, result |
| Streaming state | `/` (during response) | Streaming indicator, partial text |
| Custom theme | `/` (with custom CSS) | Theme variables applied |

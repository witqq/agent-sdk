/**
 * Quick test: Claude Agent SDK with OAuth token via CLAUDE_CODE_OAUTH_TOKEN env var.
 * Usage: CLAUDE_CODE_OAUTH_TOKEN=<token> node claude-sdk-test.mjs
 */
import { query } from '@anthropic-ai/claude-agent-sdk';

const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
if (!token) {
  console.error('❌ Set CLAUDE_CODE_OAUTH_TOKEN env var');
  process.exit(1);
}

console.log(`🔑 Token: ${token.substring(0, 20)}...`);
console.log('🚀 Starting Claude SDK query...\n');

try {
  const result = query({
    prompt: 'Say hello in one word. Do not use any tools.',
    options: {
      maxTokens: 50,
      allowedTools: [],
    },
  });

  let responseText = '';
  for await (const event of result) {
    if (event.type === 'assistant') {
      for (const block of event.message?.content || []) {
        if (block.type === 'text') responseText += block.text;
      }
    }
    // Log all event types for debugging
    console.log(`  event: ${event.type}${event.type === 'auth_status' ? ` (${JSON.stringify(event)})` : ''}`);
  }

  console.log(`\n🤖 Response: ${responseText || '(empty)'}`);
  console.log('✅ SUCCESS');
} catch (error) {
  console.error(`❌ Failed: ${error.message}`);
  if (error.stack) console.error(error.stack.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

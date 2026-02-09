/**
 * Claude SDK - OAuth Auth Flow (host-friendly version)
 * 
 * KEY FINDINGS from CLI source code analysis:
 * 1. CLI uses access_token as Bearer token (NOT API key) for inference
 * 2. Console endpoint gives org:create_api_key,user:profile (no inference!)
 * 3. Claude.ai endpoint gives user:inference (what we need!)
 * 4. CLAUDE_CODE_OAUTH_TOKEN env var → CLI uses it as Bearer with user:inference scope
 * 5. Header: Authorization: Bearer <token>, anthropic-beta: oauth-2025-04-20
 *
 * Usage: node claude-auth-file.mjs [--console] [--api-key]
 *   --console  Use platform.claude.com (Console) instead of claude.ai
 *   --api-key  Also create an API key (for testing)
 */

import { randomBytes, createHash } from 'crypto';
import { URL } from 'url';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

// Two OAuth endpoints with different scope sets
const CLAUDE_AI_AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const CONSOLE_AUTHORIZE_URL = 'https://platform.claude.com/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const API_KEY_URL = 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key';
const MANUAL_REDIRECT_URL = 'https://platform.claude.com/oauth/code/callback';

// Claude.ai scopes (includes user:inference)
const CLAUDE_AI_SCOPES = 'user:profile user:inference user:sessions:claude_code user:mcp_servers';
// Console scopes
const CONSOLE_SCOPES = 'org:create_api_key user:profile';

const URL_FILE = '/tmp/claude-auth-url.txt';
const CODE_FILE = '/tmp/claude-auth-code.txt';

function generateCodeVerifier() {
  return randomBytes(96).toString('base64').replace(/\+/g, '~').replace(/=/g, '_').replace(/\//g, '-');
}

function generateCodeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64').split('=')[0].replace(/\+/g, '-').replace(/\//g, '_');
}

function generateState() {
  return randomBytes(16).toString('hex');
}

async function waitForCodeFile() {
  console.log(`\nWaiting for auth code in ${CODE_FILE}...`);
  console.log('After authorizing, paste the redirect URL or code into that file.\n');
  
  if (existsSync(CODE_FILE)) unlinkSync(CODE_FILE);
  
  while (true) {
    await new Promise(r => setTimeout(r, 1000));
    if (existsSync(CODE_FILE)) {
      const content = readFileSync(CODE_FILE, 'utf-8').trim();
      if (content) {
        try {
          const url = new URL(content);
          return url.searchParams.get('code') || content;
        } catch {
          return content;
        }
      }
    }
  }
}

async function exchangeCodeForTokens(code, codeVerifier, state) {
  const body = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: MANUAL_REDIRECT_URL,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
    state,
  };

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function createApiKey(accessToken) {
  const response = await fetch(API_KEY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'anthropic-version': 'oauth-2025-04-20',
    },
    body: JSON.stringify({ name: 'agent-sdk-test' }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API key creation failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log('   API key response keys:', Object.keys(data));
  return data;
}

// Test 1: Bearer token (how CLI actually does it)
async function testWithBearerToken(accessToken) {
  console.log('\n🔧 Test: Messages API with Bearer token (OAuth)...');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2025-04-20',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.log(`❌ Bearer token failed (${response.status}): ${text}`);
    return false;
  }

  const data = JSON.parse(text);
  console.log('🤖 Model response:', data.content?.[0]?.text || text);
  console.log('✅ Bearer token auth WORKS!');
  return true;
}

// Test 2: API key (if created)
async function testWithApiKey(apiKey) {
  console.log('\n🔧 Test: Messages API with API key...');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.log(`❌ API key failed (${response.status}): ${text}`);
    return false;
  }

  const data = JSON.parse(text);
  console.log('🤖 Model response:', data.content?.[0]?.text || text);
  console.log('✅ API key auth WORKS!');
  return true;
}

// Test 3: Claude SDK with CLAUDE_CODE_OAUTH_TOKEN
async function testClaudeSDK(accessToken) {
  console.log('\n🔧 Test: Claude Agent SDK with CLAUDE_CODE_OAUTH_TOKEN...');
  
  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    
    const env = { 
      ...process.env, 
      CLAUDE_CODE_OAUTH_TOKEN: accessToken 
    };
    
    const result = query({
      prompt: 'Say hello in one word. Do not use any tools.',
      options: { 
        env,
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
    }
    
    console.log('🤖 SDK response:', responseText || '(empty)');
    console.log('✅ Claude SDK with OAuth token WORKS!');
    return true;
  } catch (error) {
    console.log(`❌ Claude SDK test failed: ${error.message}`);
    if (error.stack) console.log('   Stack:', error.stack.split('\n').slice(0,3).join('\n'));
    return false;
  }
}

async function main() {
  const useConsole = process.argv.includes('--console');
  const createKey = process.argv.includes('--api-key');
  const endpoint = useConsole ? 'Console (platform.claude.com)' : 'Claude.ai';
  
  console.log(`🔑 Claude - OAuth Auth Flow with PKCE`);
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Mode: Bearer token${createKey ? ' + API key' : ''}\n`);

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  console.log('Step 1: PKCE generated');

  const authorizeBaseUrl = useConsole ? CONSOLE_AUTHORIZE_URL : CLAUDE_AI_AUTHORIZE_URL;
  const scopes = useConsole ? CONSOLE_SCOPES : CLAUDE_AI_SCOPES;
  
  const url = new URL(authorizeBaseUrl);
  url.searchParams.append('code', 'true');
  url.searchParams.append('client_id', CLIENT_ID);
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('redirect_uri', MANUAL_REDIRECT_URL);
  url.searchParams.append('scope', scopes);
  url.searchParams.append('code_challenge', codeChallenge);
  url.searchParams.append('code_challenge_method', 'S256');
  url.searchParams.append('state', state);
  const authorizeUrl = url.toString();

  writeFileSync(URL_FILE, authorizeUrl);
  console.log(`\n✅ Auth URL saved to: ${URL_FILE}`);
  console.log(`\nOpen this URL in browser:\n${authorizeUrl}\n`);

  const authCode = await waitForCodeFile();
  console.log('✅ Authorization code received!');

  console.log('Step 3: Exchanging code for tokens...');
  const tokens = await exchangeCodeForTokens(authCode, codeVerifier, state);
  console.log(`✅ Tokens received!`);
  console.log(`   Scopes: ${tokens.scope}`);
  console.log(`   Token type: ${tokens.token_type}`);
  console.log(`   Expires in: ${tokens.expires_in}s`);
  console.log(`   Access token (first 20): ${tokens.access_token?.substring(0, 20)}...`);

  // Test Bearer token (primary approach)
  const bearerOk = await testWithBearerToken(tokens.access_token);
  
  // Optionally test API key
  if (createKey) {
    console.log('\nStep 4: Creating API key...');
    try {
      const apiKeyData = await createApiKey(tokens.access_token);
      const apiKey = apiKeyData.raw_key || apiKeyData.api_key || apiKeyData.key;
      console.log(`✅ API key created: ${apiKey ? apiKey.substring(0, 15) + '...' : 'field not found'}`);
      if (apiKey) {
        await testWithApiKey(apiKey);
      }
    } catch (error) {
      console.log(`⚠️  API key creation failed: ${error.message}`);
    }
  }

  // Test SDK integration (always — this is the primary use case)
  const sdkOk = await testClaudeSDK(tokens.access_token);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`OAuth endpoint: ${endpoint}`);
  console.log(`Scopes granted: ${tokens.scope}`);
  console.log(`Bearer token (direct API): ${bearerOk ? '✅ WORKS' : '❌ N/A (Claude Code only)'}`);
  console.log(`Claude SDK (via CLI): ${sdkOk ? '✅ WORKS' : '❌ FAILED'}`);
  console.log(`\nFor SDK integration use:`);
  console.log(`  env: CLAUDE_CODE_OAUTH_TOKEN=<token>`);
  console.log(`  file: ~/.claude/.credentials.json`);
  console.log(`\n⚠️  Note: This token ONLY works through Claude Code CLI,`);
  console.log(`   not for direct /v1/messages API calls.`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

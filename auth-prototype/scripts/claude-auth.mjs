/**
 * Claude SDK - Programmatic OAuth Authorization Code Flow with PKCE
 * 
 * This script implements the OAuth flow directly:
 * 1. Generate PKCE code_verifier + code_challenge
 * 2. Start local HTTP server for callback
 * 3. Display authorize URL to user
 * 4. Wait for callback with authorization code
 * 5. Exchange code for tokens
 * 6. Get API key
 * 7. Test with Claude SDK
 * 
 * For Docker: use --manual flag to use manual redirect mode
 * (user copies the redirect URL instead of localhost callback)
 */

import { createServer } from 'http';
import { randomBytes, createHash } from 'crypto';
import { URL, URLSearchParams } from 'url';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CONSOLE_AUTHORIZE_URL = 'https://platform.claude.com/oauth/authorize';
const CLAUDE_AI_AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const API_KEY_URL = 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key';
const MANUAL_REDIRECT_URL = 'https://platform.claude.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers';

const isManualMode = process.argv.includes('--manual');
const useClaudeAi = process.argv.includes('--claude-ai');

function generateCodeVerifier() {
  return randomBytes(96)
    .toString('base64')
    .replace(/\+/g, '~')
    .replace(/=/g, '_')
    .replace(/\//g, '-');
}

function generateCodeChallenge(verifier) {
  return createHash('sha256')
    .update(verifier)
    .digest('base64')
    .split('=')[0]
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateState() {
  return randomBytes(16).toString('hex');
}

function buildAuthorizeUrl({ codeChallenge, state, port }) {
  const baseUrl = useClaudeAi ? CLAUDE_AI_AUTHORIZE_URL : CONSOLE_AUTHORIZE_URL;
  const url = new URL(baseUrl);
  url.searchParams.append('code', 'true');
  url.searchParams.append('client_id', CLIENT_ID);
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('redirect_uri', 
    isManualMode ? MANUAL_REDIRECT_URL : `http://localhost:${port}/callback`
  );
  url.searchParams.append('scope', SCOPES);
  url.searchParams.append('code_challenge', codeChallenge);
  url.searchParams.append('code_challenge_method', 'S256');
  url.searchParams.append('state', state);
  return url.toString();
}

function startCallbackServer(expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code) {
        res.writeHead(400);
        res.end('No authorization code');
        reject(new Error('No authorization code received'));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400);
        res.end('Invalid state');
        reject(new Error('State mismatch'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>✅ Authorization successful!</h1><p>You can close this tab.</p></body></html>');
      
      server.close();
      resolve(code);
    });

    server.listen(0, 'localhost', () => {
      const port = server.address().port;
      resolve({ server, port, waitForCode: () => new Promise((r, j) => { resolve = r; reject = j; }) });
    });
  });
}

async function waitForManualCode() {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  return new Promise((resolve) => {
    console.log('\n📋 After authorizing, you\'ll be redirected to a page with a URL containing the auth code.');
    console.log('   Copy the FULL redirect URL and paste it here:');
    rl.question('\n> ', (answer) => {
      rl.close();
      // Extract code from URL
      try {
        const url = new URL(answer.trim());
        const code = url.searchParams.get('code');
        if (code) {
          resolve(code);
        } else {
          // Maybe they pasted just the code
          resolve(answer.trim());
        }
      } catch {
        // Not a URL, assume it's the code directly
        resolve(answer.trim());
      }
    });
  });
}

async function exchangeCodeForTokens(code, codeVerifier, state, port) {
  const body = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: isManualMode ? MANUAL_REDIRECT_URL : `http://localhost:${port}/callback`,
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
    body: JSON.stringify({
      name: 'agent-sdk-test',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API key creation failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function testClaudeSDK(apiKey) {
  console.log('\n🔧 Testing Claude SDK with obtained API key...');
  
  // Claude SDK spawns cli.js as subprocess, pass API key via env
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  
  try {
    const result = query({
      prompt: 'Say hello in one word.',
      options: {
        maxTurns: 1,
        systemPrompt: 'You are a test assistant. Reply briefly.',
      },
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: apiKey,
      },
    });

    let responseText = '';
    for await (const event of result) {
      if (event.type === 'assistant' && event.message) {
        // Collect text from content blocks
        for (const block of event.message.content || []) {
          if (block.type === 'text') {
            responseText += block.text;
          }
        }
      }
    }

    console.log('🤖 Model response:', responseText);
    console.log('✅ Full flow completed successfully!');
  } catch (error) {
    console.error('❌ SDK error:', error.message);
  }
}

async function main() {
  console.log('🔑 Claude SDK - OAuth Authorization Code Flow with PKCE\n');
  console.log(`Mode: ${isManualMode ? 'Manual redirect' : 'Localhost callback'}`);
  console.log(`Auth provider: ${useClaudeAi ? 'Claude.ai' : 'Anthropic Console'}\n`);

  // Step 1: Generate PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  console.log('Step 1: PKCE generated');

  let port = null;
  let codePromise;

  if (!isManualMode) {
    // Step 2: Start callback server
    const serverInfo = await new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, 'localhost', () => {
        port = server.address().port;
        console.log(`Step 2: Callback server started on port ${port}`);
        
        const codePromise = new Promise((resolveCode, rejectCode) => {
          server.on('request', (req, res) => {
            const url = new URL(req.url, `http://localhost:${port}`);
            if (url.pathname !== '/callback') {
              res.writeHead(404);
              res.end();
              return;
            }

            const code = url.searchParams.get('code');
            const recvState = url.searchParams.get('state');

            if (!code || recvState !== state) {
              res.writeHead(400);
              res.end('Invalid request');
              rejectCode(new Error('Invalid callback'));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>✅ Authorized!</h1><p>Close this tab.</p></body></html>');
            server.close();
            resolveCode(code);
          });
        });

        resolve({ port, codePromise });
      });
    });

    port = serverInfo.port;
    codePromise = serverInfo.codePromise;
  }

  // Step 3: Build authorize URL
  const authorizeUrl = buildAuthorizeUrl({ codeChallenge, state, port });

  console.log('\n' + '='.repeat(60));
  console.log('📋 AUTHORIZATION REQUIRED');
  console.log('='.repeat(60));
  console.log(`\nOpen this URL in your browser:\n\n${authorizeUrl}`);
  console.log('\n' + '='.repeat(60));

  // Step 4: Wait for authorization code
  let authCode;
  if (isManualMode) {
    authCode = await waitForManualCode();
  } else {
    console.log('\nWaiting for browser callback...');
    authCode = await codePromise;
  }
  console.log('\n✅ Authorization code received!');

  // Step 5: Exchange code for tokens
  console.log('Step 5: Exchanging code for tokens...');
  const tokens = await exchangeCodeForTokens(authCode, codeVerifier, state, port);
  console.log('✅ Tokens received!');
  console.log(`   Access token (first 10): ${tokens.access_token?.substring(0, 10)}...`);
  console.log(`   Scopes: ${tokens.scope}`);

  // Step 6: Create API key
  console.log('\nStep 6: Creating API key...');
  try {
    const apiKeyData = await createApiKey(tokens.access_token);
    const apiKey = apiKeyData.api_key || apiKeyData.key;
    console.log(`✅ API key created (first 10): ${apiKey?.substring(0, 10)}...`);

    // Step 7: Test with SDK
    await testClaudeSDK(apiKey);
    
    console.log('\n📝 API key (first 15 chars):', apiKey?.substring(0, 15) + '...');
  } catch (error) {
    console.log(`⚠️  API key creation failed: ${error.message}`);
    console.log('   Testing with access_token directly via ANTHROPIC_API_KEY...');
    
    // Try using access_token directly
    await testClaudeSDK(tokens.access_token);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

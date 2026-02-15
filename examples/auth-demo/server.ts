/**
 * Web-based interactive demo: @witqq/agent-sdk authentication flows.
 *
 * HTTP server with HTML UI for provider selection, auth flows, and chat.
 * Run: docker compose -f examples/auth-demo/docker-compose.yml up
 * Open: http://localhost:3456
 */
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAgentService } from "@witqq/agent-sdk";
import type { IAgentService, IAgent, PermissionRequest, Message } from "@witqq/agent-sdk";
import { CopilotAuth, ClaudeAuth } from "@witqq/agent-sdk/auth";
import type { AuthToken, CopilotAuthToken, ClaudeAuthToken } from "@witqq/agent-sdk/auth";

const PORT = parseInt(process.env.PORT || "3456", 10);
const TOKEN_DIR = process.env.TOKEN_DIR || "/data";

// ─── Token Persistence ──────────────────────────────────────────

function tokenPath(provider: string): string {
  return path.join(TOKEN_DIR, `${provider}-token.json`);
}

function saveToken(provider: string, token: AuthToken): void {
  try {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
    fs.writeFileSync(tokenPath(provider), JSON.stringify(token));
  } catch { /* ignore write errors */ }
}

function loadToken(provider: string): AuthToken | null {
  try {
    const data = fs.readFileSync(tokenPath(provider), "utf-8");
    return JSON.parse(data) as AuthToken;
  } catch { return null; }
}

function clearTokens(): void {
  try {
    for (const f of fs.readdirSync(TOKEN_DIR)) {
      if (f.endsWith("-token.json")) fs.unlinkSync(path.join(TOKEN_DIR, f));
    }
  } catch { /* ignore */ }
}

// ─── State ──────────────────────────────────────────────────────

interface SessionState {
  provider: "copilot" | "claude" | "vercel-ai" | null;
  token: AuthToken | null;
  service: IAgentService | null;
  agent: IAgent | null;
  messages: Message[];
  copilotFlow: Awaited<ReturnType<CopilotAuth["startDeviceFlow"]>> | null;
  claudeFlow: Awaited<ReturnType<ClaudeAuth["startOAuthFlow"]>> | null;
  vercelBaseUrl: string | null;
}

const state: SessionState = {
  provider: null,
  token: null,
  service: null,
  agent: null,
  messages: [],
  copilotFlow: null,
  claudeFlow: null,
  vercelBaseUrl: null,
};

// ─── HTML ───────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>agent-sdk Auth Demo</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0d1117; color: #c9d1d9; max-width: 720px; margin: 0 auto; padding: 20px; }
  h1 { color: #58a6ff; margin-bottom: 8px; font-size: 1.4em; }
  .subtitle { color: #8b949e; margin-bottom: 24px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
  .card h2 { color: #58a6ff; font-size: 1.1em; margin-bottom: 12px; }
  button { background: #238636; color: #fff; border: none; padding: 8px 16px;
    border-radius: 6px; cursor: pointer; font-size: 14px; margin: 4px; }
  button:hover { background: #2ea043; }
  button:disabled { background: #21262d; color: #484f58; cursor: not-allowed; }
  button.secondary { background: #30363d; }
  button.secondary:hover { background: #484f58; }
  input, select { background: #0d1117; border: 1px solid #30363d; color: #c9d1d9;
    padding: 8px 12px; border-radius: 6px; font-size: 14px; width: 100%; margin: 4px 0; }
  .status { padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 13px; }
  .status.ok { background: #0d2818; border: 1px solid #238636; color: #3fb950; }
  .status.error { background: #2d1117; border: 1px solid #da3633; color: #f85149; }
  .status.info { background: #0d1d31; border: 1px solid #1f6feb; color: #58a6ff; }
  .auth-link { word-break: break-all; }
  .auth-link a { color: #58a6ff; }
  #chat { display: none; }
  #messages { max-height: 400px; overflow-y: auto; padding: 12px; background: #0d1117;
    border: 1px solid #30363d; border-radius: 6px; margin-bottom: 12px; font-family: monospace; font-size: 13px; }
  .msg-user { color: #58a6ff; margin: 8px 0; }
  .msg-agent { color: #c9d1d9; margin: 8px 0; white-space: pre-wrap; }
  .msg-thinking { margin: 8px 0; }
  .msg-thinking details { background: #1c2128; border: 1px solid #30363d; border-radius: 6px; padding: 4px 8px; }
  .msg-thinking summary { color: #8b949e; cursor: pointer; font-size: 12px; padding: 4px 0; }
  .msg-thinking pre { color: #8b949e; font-size: 12px; white-space: pre-wrap; margin: 4px 0; max-height: 300px; overflow-y: auto; }
  .msg-error { color: #f85149; margin: 8px 0; }
  #chat-form { display: flex; gap: 8px; }
  #chat-form input { flex: 1; }
  #provider-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .hidden { display: none; }
  .code { font-family: monospace; background: #0d1117; padding: 2px 6px; border-radius: 3px; font-size: 1.2em; letter-spacing: 2px; }
</style>
</head>
<body>

<h1>@witqq/agent-sdk Demo</h1>
<p class="subtitle">Authentication flows and agent interaction</p>

<!-- Step 1: Provider -->
<div class="card" id="step-provider">
  <h2>1. Select Provider</h2>
  <div id="saved-tokens"></div>
  <div id="provider-btns">
    <button onclick="startAuth('copilot')">GitHub Copilot</button>
    <button onclick="startAuth('claude')">Claude</button>
    <button onclick="startAuth('vercel-ai')">Vercel AI</button>
  </div>
  <div id="provider-status"></div>
  <div style="margin-top:12px">
    <button class="secondary" onclick="clearAllTokens()" style="font-size:12px">Clear Saved Tokens</button>
  </div>
</div>

<!-- Step 2: Auth -->
<div class="card hidden" id="step-auth">
  <h2>2. Authenticate</h2>
  <div id="auth-content"></div>
</div>

<!-- Step 3: Model -->
<div class="card hidden" id="step-model">
  <h2>3. Select Model</h2>
  <div id="model-content"></div>
</div>

<!-- Step 4: Chat -->
<div class="card hidden" id="step-chat">
  <h2>4. Chat</h2>
  <div id="messages"></div>
  <form id="chat-form" onsubmit="sendMessage(event)">
    <input id="chat-input" placeholder="Type a message..." autocomplete="off">
    <button type="submit">Send</button>
  </form>
  <div style="margin-top: 8px">
    <button class="secondary" onclick="switchProvider()">Switch Provider</button>
  </div>
</div>

<script>
async function api(path, body) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function setHtml(id, html) { document.getElementById(id).innerHTML = html; }
function addMsg(cls, text) {
  const el = document.getElementById('messages');
  el.innerHTML += '<div class="msg-' + cls + '">' + escapeHtml(text) + '</div>';
  el.scrollTop = el.scrollHeight;
}
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function loadSavedTokens() {
  var result = await api('/tokens/saved');
  var el = document.getElementById('saved-tokens');
  if (result.saved && result.saved.length > 0) {
    var html = '<div class="status ok" style="margin-bottom:8px">Saved tokens: ';
    result.saved.forEach(function(p, i) {
      html += '<button style="margin:2px 4px" class="saved-token-btn" data-provider="' + escapeHtml(p) + '">Use ' + escapeHtml(p) + '</button>';
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.saved-token-btn').forEach(function(btn) {
      btn.onclick = function() { useSavedToken(btn.dataset.provider); };
    });
  } else {
    el.innerHTML = '';
  }
}

async function useSavedToken(provider) {
  setHtml('provider-status', '<div class="status info">Loading saved ' + provider + ' token...</div>');
  var result = await api('/tokens/use', { provider: provider });
  if (result.ok) {
    setHtml('provider-status', '<div class="status ok">Authenticated with saved ' + provider + ' token</div>');
    hide('step-auth');
    await setupChat();
  } else {
    setHtml('provider-status', '<div class="status error">' + escapeHtml(result.error || 'Failed') + '</div>');
  }
}

async function clearAllTokens() {
  await api('/tokens/clear');
  setHtml('saved-tokens', '');
  setHtml('provider-status', '<div class="status info">All tokens cleared</div>');
}

// Load saved tokens on page load
loadSavedTokens();

async function startAuth(provider) {
  setHtml('provider-status', '<div class="status info">Starting ' + provider + ' auth...</div>');
  show('step-auth');
  hide('step-chat');

  const data = await api('/auth/start', { provider });
  if (data.error) {
    setHtml('auth-content', '<div class="status error">' + escapeHtml(data.error) + '</div>');
    return;
  }

  if (provider === 'copilot') {
    setHtml('auth-content',
      '<p>Enter this code at the URL below:</p>' +
      '<p class="code" style="margin: 12px 0; font-size: 1.4em">' + data.userCode + '</p>' +
      '<p class="auth-link"><a href="' + data.verificationUrl + '" target="_blank">' + data.verificationUrl + '</a></p>' +
      '<div class="status info" id="auth-poll">Waiting for authorization...</div>'
    );
    const result = await api('/auth/copilot-poll');
    if (result.ok) {
      setHtml('auth-poll', '<div class="status ok">Authenticated' + (result.login ? ' as ' + escapeHtml(result.login) : '') + '</div>');
      await setupChat();
    } else {
      setHtml('auth-poll', '<div class="status error">' + escapeHtml(result.error || 'Auth failed') + '</div>');
    }
  } else if (provider === 'claude') {
    setHtml('auth-content',
      '<p>Open this URL to authorize:</p>' +
      '<p class="auth-link" style="margin: 8px 0"><a href="' + data.authorizeUrl + '" target="_blank">' + data.authorizeUrl + '</a></p>' +
      '<p style="margin: 8px 0">After authorizing, paste the code or redirect URL below:</p>' +
      '<div style="display:flex; gap:8px">' +
      '<input id="claude-code" placeholder="Paste code or redirect URL...">' +
      '<button onclick="completeClaudeAuth()">Submit</button>' +
      '</div>' +
      '<div id="claude-status"></div>'
    );
  } else if (provider === 'vercel-ai') {
    setHtml('auth-content',
      '<p>Enter your OpenAI-compatible API key and base URL:</p>' +
      '<div style="margin: 8px 0">' +
      '<input id="base-url" placeholder="https://api.openai.com/v1" value="" style="width:100%; margin-bottom:8px">' +
      '</div>' +
      '<div style="display:flex; gap:8px; margin: 8px 0">' +
      '<input id="api-key" type="password" placeholder="sk-...">' +
      '<button onclick="completeVercelAuth()">Connect</button>' +
      '</div>' +
      '<div id="vercel-status"></div>'
    );
  }
}

async function completeClaudeAuth() {
  const code = document.getElementById('claude-code').value.trim();
  if (!code) return;
  setHtml('claude-status', '<div class="status info">Exchanging code...</div>');
  const result = await api('/auth/claude-complete', { code });
  if (result.ok) {
    setHtml('claude-status', '<div class="status ok">Authenticated!</div>');
    await setupChat();
  } else {
    setHtml('claude-status', '<div class="status error">' + escapeHtml(result.error || 'Failed') + '</div>');
  }
}

async function completeVercelAuth() {
  const key = document.getElementById('api-key').value.trim();
  if (!key) return;
  const baseUrl = document.getElementById('base-url').value.trim() || undefined;
  const result = await api('/auth/vercel-complete', { apiKey: key, baseUrl });
  if (result.ok) {
    setHtml('vercel-status', '<div class="status ok">Connected!</div>');
    await setupChat();
  } else {
    setHtml('vercel-status', '<div class="status error">' + escapeHtml(result.error || 'Failed') + '</div>');
  }
}

async function setupChat() {
  show('step-model');
  setHtml('model-content', '<div class="status info">Loading models...</div>');
  const models = await api('/models/list');
  if (models.error) {
    setHtml('model-content',
      '<div class="status error">' + escapeHtml(models.error) + '</div>' +
      '<div style="display:flex; gap:8px; margin-top:8px">' +
      '<input id="model-manual" placeholder="Enter model name...">' +
      '<button id="model-use-btn">Use</button>' +
      '</div>'
    );
    document.getElementById('model-use-btn').onclick = function() {
      selectModel(document.getElementById('model-manual').value);
    };
    return;
  }
  if (models.models && models.models.length > 0) {
    var html = '<select id="model-select">';
    models.models.forEach(function(m) {
      html += '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(m.id) + (m.name ? ' — ' + escapeHtml(m.name) : '') + '</option>';
    });
    html += '</select>';
    html += '<button style="margin-top:8px" id="model-select-btn">Select Model</button>';
    setHtml('model-content', html);
    document.getElementById('model-select-btn').onclick = function() {
      selectModel(document.getElementById('model-select').value);
    };
  } else {
    setHtml('model-content',
      '<div style="display:flex; gap:8px">' +
      '<input id="model-manual" placeholder="Enter model name..." value="gpt-4.1">' +
      '<button id="model-use-btn">Use</button>' +
      '</div>'
    );
    document.getElementById('model-use-btn').onclick = function() {
      selectModel(document.getElementById('model-manual').value);
    };
  }
}

async function selectModel(model) {
  if (!model) return;
  setHtml('model-content', '<div class="status info">Creating agent with ' + escapeHtml(model) + '...</div>');
  const result = await api('/agent/create', { model: model });
  if (result.ok) {
    setHtml('model-content', '<div class="status ok">Using model: ' + escapeHtml(model) + '</div>');
    show('step-chat');
    setHtml('messages', '');
    setHtml('provider-status', '<div class="status ok">Connected to ' + escapeHtml(result.provider) + '</div>');
    document.getElementById('chat-input').focus();
  } else {
    setHtml('model-content', '<div class="status error">' + escapeHtml(result.error || 'Failed') + '</div>');
  }
}

async function sendMessage(e) {
  e.preventDefault();
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.disabled = true;
  addMsg('user', 'You: ' + text);

  var msgs = document.getElementById('messages');
  var agentEl = null;
  var thinkingEl = null;
  var thinkingPre = null;

  try {
    var res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      var lines = buffer.split('\\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data: ')) continue;
        var evt;
        try { evt = JSON.parse(line.slice(6)); } catch(_) { continue; }

        if (evt.type === 'thinking_start') {
          thinkingEl = document.createElement('div');
          thinkingEl.className = 'msg-thinking';
          var details = document.createElement('details');
          details.open = true;
          var summary = document.createElement('summary');
          summary.textContent = 'Thinking...';
          thinkingPre = document.createElement('pre');
          details.appendChild(summary);
          details.appendChild(thinkingPre);
          thinkingEl.appendChild(details);
          msgs.appendChild(thinkingEl);
          msgs.scrollTop = msgs.scrollHeight;
        } else if (evt.type === 'thinking_delta' && evt.text) {
          if (thinkingPre) {
            thinkingPre.textContent += evt.text;
            msgs.scrollTop = msgs.scrollHeight;
          }
        } else if (evt.type === 'thinking_end') {
          if (thinkingEl) {
            thinkingEl.querySelector('summary').textContent = 'Thinking';
            thinkingEl.querySelector('details').open = false;
          }
          thinkingEl = null;
          thinkingPre = null;
        } else if (evt.type === 'text_delta' && evt.text) {
          if (!agentEl) {
            agentEl = document.createElement('div');
            agentEl.className = 'msg-agent';
            agentEl.textContent = 'Agent: ';
            msgs.appendChild(agentEl);
          }
          agentEl.textContent += evt.text;
          msgs.scrollTop = msgs.scrollHeight;
        } else if (evt.type === 'error') {
          addMsg('error', 'Error: ' + (evt.text || 'Unknown error'));
        }
      }
    }

    if (!agentEl && !thinkingEl) {
      addMsg('agent', 'Agent: (no response)');
    }
  } catch (err) {
    addMsg('error', 'Error: ' + (err.message || String(err)));
  }

  input.disabled = false;
  input.focus();
}

async function switchProvider() {
  await api('/agent/dispose');
  hide('step-chat');
  hide('step-model');
  hide('step-auth');
  setHtml('provider-status', '');
}
</script>
</body>
</html>`;

// ─── API Handlers ───────────────────────────────────────────────

type Provider = "copilot" | "claude" | "vercel-ai";

function handleSavedTokens(): Record<string, unknown> {
  const saved: string[] = [];
  for (const p of ["copilot", "claude", "vercel-ai"]) {
    if (loadToken(p)) saved.push(p);
  }
  return { saved };
}

async function handleUseSavedToken(provider: Provider): Promise<Record<string, unknown>> {
  const token = loadToken(provider);
  if (!token) return { error: "No saved token for " + provider };
  if (state.agent) { await state.agent.dispose(); state.agent = null; }
  if (state.service) { await state.service.dispose(); state.service = null; }
  state.provider = provider;
  state.token = token;
  state.messages = [];
  await ensureService();
  return { ok: true, provider };
}

function handleClearTokens(): Record<string, unknown> {
  clearTokens();
  return { ok: true };
}

async function handleAuthStart(provider: Provider): Promise<Record<string, unknown>> {
  // Cleanup previous
  if (state.agent) { await state.agent.dispose(); state.agent = null; }
  if (state.service) { await state.service.dispose(); state.service = null; }
  state.provider = provider;
  state.token = null;
  state.messages = [];

  if (provider === "copilot") {
    const auth = new CopilotAuth();
    state.copilotFlow = await auth.startDeviceFlow();
    return { userCode: state.copilotFlow.userCode, verificationUrl: state.copilotFlow.verificationUrl };
  }
  if (provider === "claude") {
    const auth = new ClaudeAuth();
    state.claudeFlow = await auth.startOAuthFlow();
    return { authorizeUrl: state.claudeFlow.authorizeUrl };
  }
  if (provider === "vercel-ai") {
    return { ready: true };
  }
  return { error: "Unknown provider" };
}

async function handleCopilotPoll(): Promise<Record<string, unknown>> {
  if (!state.copilotFlow) return { error: "No active copilot flow" };
  const token = await state.copilotFlow.waitForToken();
  state.token = token;
  state.copilotFlow = null;
  saveToken("copilot", token);
  const ct = token as CopilotAuthToken;
  await ensureService();
  return { ok: true, login: ct.login };
}

async function handleClaudeComplete(code: string): Promise<Record<string, unknown>> {
  if (!state.claudeFlow) return { error: "No active claude flow" };
  try {
    const token = await state.claudeFlow.completeAuth(code);
    state.token = token;
    state.claudeFlow = null;
    saveToken("claude", token);
    await ensureService();
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function handleVercelComplete(apiKey: string, baseUrl?: string): Promise<Record<string, unknown>> {
  state.token = { accessToken: apiKey, tokenType: "bearer", obtainedAt: Date.now() };
  state.vercelBaseUrl = baseUrl || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1";
  saveToken("vercel-ai", state.token);
  state.service = await createAgentService("vercel-ai", {
    baseUrl: state.vercelBaseUrl,
    apiKey: state.token.accessToken,
  });
  return { ok: true };
}

async function ensureService(): Promise<void> {
  if (state.service || !state.provider || !state.token) return;
  switch (state.provider) {
    case "copilot":
      state.service = await createAgentService("copilot", { githubToken: state.token.accessToken });
      break;
    case "claude":
      state.service = await createAgentService("claude", { oauthToken: state.token.accessToken });
      break;
    case "vercel-ai":
      state.service = await createAgentService("vercel-ai", {
        baseUrl: state.vercelBaseUrl || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1",
        apiKey: state.token.accessToken,
      });
      break;
  }
}

async function handleModelsList(): Promise<Record<string, unknown>> {
  if (!state.provider || !state.token) return { error: "Not authenticated" };
  await ensureService();
  if (!state.service) return { error: "Failed to create service" };
  try {
    const models = await state.service.listModels();
    return { models: models.map(m => ({ id: m.id, name: m.name })) };
  } catch {
    return { error: "Could not list models", models: [] };
  }
}

async function handleAgentCreate(model?: string): Promise<Record<string, unknown>> {
  if (!state.provider || !state.token) return { error: "Not authenticated" };
  await ensureService();
  if (!state.service) return { error: "Failed to create service" };

  state.messages = [];
  state.agent = state.service.createAgent({
    model: model || undefined,
    systemPrompt: "You are a helpful assistant. Be concise.",
    sessionMode: state.provider === "copilot" || state.provider === "claude" ? "persistent" : undefined,
    tools: [],
    supervisor: {
      onPermission: async (_req: PermissionRequest) => ({ allowed: true, scope: "session" as const }),
    },
  });

  return { ok: true, provider: state.provider };
}

async function handleChatStream(message: string, res: http.ServerResponse): Promise<void> {
  if (!state.agent) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ type: "error", text: "No active agent" })}\n\n`);
    res.end();
    return;
  }

  state.messages.push({ role: "user", content: message });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  let response = "";
  try {
    for await (const event of state.agent.streamWithContext(state.messages)) {
      if (event.type === "text_delta" && event.text) {
        response += event.text;
        res.write(`data: ${JSON.stringify({ type: "text_delta", text: event.text })}\n\n`);
      } else if (event.type === "thinking_start") {
        res.write(`data: ${JSON.stringify({ type: "thinking_start" })}\n\n`);
      } else if (event.type === "thinking_delta" && event.text) {
        res.write(`data: ${JSON.stringify({ type: "thinking_delta", text: event.text })}\n\n`);
      } else if (event.type === "thinking_end") {
        res.write(`data: ${JSON.stringify({ type: "thinking_end" })}\n\n`);
      }
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", text: (err as Error).message })}\n\n`);
  }

  state.messages.push({ role: "assistant", content: response || "(no response)" });
  res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  res.end();
}

async function handleDispose(): Promise<Record<string, unknown>> {
  if (state.agent) { await state.agent.dispose(); state.agent = null; }
  if (state.service) { await state.service.dispose(); state.service = null; }
  state.provider = null;
  state.token = null;
  state.messages = [];
  return { ok: true };
}

// ─── HTTP Server ────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
  });
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  if (url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML);
    return;
  }

  if (url.startsWith("/api/") && req.method === "POST") {
    const body = JSON.parse(await readBody(req) || "{}");
    try {
      switch (url) {
        case "/api/auth/start":
          json(res, await handleAuthStart(body.provider));
          break;
        case "/api/tokens/saved":
          json(res, handleSavedTokens());
          break;
        case "/api/tokens/use":
          json(res, await handleUseSavedToken(body.provider));
          break;
        case "/api/tokens/clear":
          json(res, handleClearTokens());
          break;
        case "/api/auth/copilot-poll":
          json(res, await handleCopilotPoll());
          break;
        case "/api/auth/claude-complete":
          json(res, await handleClaudeComplete(body.code));
          break;
        case "/api/auth/vercel-complete":
          json(res, await handleVercelComplete(body.apiKey, body.baseUrl));
          break;
        case "/api/models/list":
          json(res, await handleModelsList());
          break;
        case "/api/agent/create":
          json(res, await handleAgentCreate(body.model));
          break;
        case "/api/agent/chat":
          await handleChatStream(body.message, res);
          return;
        case "/api/agent/dispose":
          json(res, await handleDispose());
          break;
        default:
          json(res, { error: "Not found" }, 404);
      }
    } catch (err) {
      json(res, { error: err instanceof Error ? err.message : String(err) }, 500);
    }
    return;
  }

  json(res, { error: "Not found" }, 404);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  @witqq/agent-sdk Auth Demo`);
  console.log(`  Open http://localhost:${PORT}\n`);
});

/**
 * Demo server child process lifecycle manager.
 *
 * Starts the demo server as a child process with a random port,
 * waits for the health endpoint, and provides clean shutdown.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface ServerManagerOptions {
  /** Port to use. Default: random available port */
  port?: number;
  /** Health check timeout in ms. Default: 30000 */
  healthTimeout?: number;
  /** Health check poll interval in ms. Default: 300 */
  healthInterval?: number;
  /** GitHub token for Copilot auth */
  githubToken: string;
}

export interface RunningServer {
  /** Base URL (http://localhost:{port}) */
  baseUrl: string;
  /** Server port */
  port: number;
  /** Stop the server and clean up temp files */
  stop: () => Promise<void>;
}

/**
 * Start the demo server as a child process.
 * Pre-populates token store with the given GitHub token for Copilot.
 */
export async function startDemoServer(options: ServerManagerOptions): Promise<RunningServer> {
  const port = options.port ?? randomPort();
  const healthTimeout = options.healthTimeout ?? 30_000;
  const healthInterval = options.healthInterval ?? 300;

  // Create temp token directory and pre-populate Copilot token
  const tokenDir = mkdtempSync(join(tmpdir(), "e2e-tokens-"));
  mkdirSync(tokenDir, { recursive: true });
  writeFileSync(
    join(tokenDir, "copilot-token.json"),
    JSON.stringify({
      accessToken: options.githubToken,
      tokenType: "bearer",
      obtainedAt: Date.now(),
    }),
  );

  const serverRoot = resolve(import.meta.dirname, "../../../examples/demo");

  const child: ChildProcess = spawn("npx", ["tsx", "server.ts"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: String(port),
      TOKEN_DIR: tokenDir,
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Collect stderr for diagnostics on failure
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  let stdout = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  // Handle spawn errors (e.g., tsx not found)
  const spawnError = await new Promise<Error | null>((resolve) => {
    child.on("error", (err) => resolve(err));
    // If no error within 2s, continue
    setTimeout(() => resolve(null), 2000);
  });

  if (spawnError) {
    cleanupDir(tokenDir);
    throw new Error(`Failed to spawn demo server: ${spawnError.message}`);
  }

  const baseUrl = `http://localhost:${port}`;

  // Wait for health endpoint
  const start = Date.now();
  let healthy = false;

  while (Date.now() - start < healthTimeout) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        healthy = true;
        break;
      }
    } catch {
      // Server not ready yet
    }
    await sleep(healthInterval);
  }

  if (!healthy) {
    child.kill("SIGTERM");
    cleanupDir(tokenDir);
    throw new Error(
      `Demo server failed to start within ${healthTimeout}ms on port ${port}.\nStderr: ${stderr.slice(-500)}`,
    );
  }

  return {
    baseUrl,
    port,
    stop: async () => {
      if (!child.killed) {
        child.kill("SIGTERM");
        // Wait for process to exit
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 5000);
          child.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      cleanupDir(tokenDir);
    },
  };
}

export interface MockServerManagerOptions {
  /** Port to use. Default: random available port */
  port?: number;
  /** Health check timeout in ms. Default: 30000 */
  healthTimeout?: number;
  /** Health check poll interval in ms. Default: 300 */
  healthInterval?: number;
}

/**
 * Start the mock demo server as a child process.
 * No API keys or tokens required — uses MockLLMChatAdapter.
 */
export async function startMockDemoServer(options: MockServerManagerOptions = {}): Promise<RunningServer> {
  const port = options.port ?? randomPort();
  const healthTimeout = options.healthTimeout ?? 30_000;
  const healthInterval = options.healthInterval ?? 300;

  const serverRoot = resolve(import.meta.dirname, "../../../examples/demo");

  // Isolated temp DB so tests don't share state across runs
  const tmpDbDir = mkdtempSync(join(tmpdir(), "e2e-mock-db-"));
  const dbPath = join(tmpDbDir, "chat-mock.db");

  const child: ChildProcess = spawn("npx", ["tsx", "server-mock.ts"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  let stdout = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  const spawnError = await new Promise<Error | null>((resolve) => {
    child.on("error", (err) => resolve(err));
    setTimeout(() => resolve(null), 2000);
  });

  if (spawnError) {
    try { rmSync(tmpDbDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw new Error(`Failed to spawn mock demo server: ${spawnError.message}`);
  }

  const baseUrl = `http://localhost:${port}`;

  const start = Date.now();
  let healthy = false;

  while (Date.now() - start < healthTimeout) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        healthy = true;
        break;
      }
    } catch {
      // Server not ready yet
    }
    await sleep(healthInterval);
  }

  if (!healthy) {
    child.kill("SIGTERM");
    try { rmSync(tmpDbDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw new Error(
      `Mock demo server failed to start within ${healthTimeout}ms on port ${port}.\nStdout: ${stdout.slice(-300)}\nStderr: ${stderr.slice(-500)}`,
    );
  }

  return {
    baseUrl,
    port,
    stop: async () => {
      if (!child.killed) {
        child.kill("SIGTERM");
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            child.kill("SIGKILL");
            resolve();
          }, 5000);
          child.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      // Clean up temp DB directory
      try { rmSync(tmpDbDir, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

function randomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}

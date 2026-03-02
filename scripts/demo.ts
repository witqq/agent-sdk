#!/usr/bin/env tsx
/**
 * Demo app lifecycle management — единая точка входа.
 *
 * Usage:
 *   npm run demo             # Build & start (docker compose up --build -d)
 *   npm run demo -- stop     # Stop containers
 *   npm run demo -- logs     # Follow logs
 *   npm run demo -- restart  # Stop → build → start
 *   npm run demo -- help      # Show help
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const COMPOSE_FILE = "examples/demo/docker-compose.yml";
const CONTAINER_NAME = "demo-demo-1";
const PORT = 3456;
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const HEALTH_TIMEOUT = 60_000;

function log(msg: string): void {
  console.log(`[demo] ${msg}`);
}

function exec(cmd: string, ignoreError = false): void {
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT });
  } catch (e) {
    if (!ignoreError) throw e;
  }
}

function execQuiet(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", cwd: ROOT }).trim();
  } catch {
    return "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compose(args: string, ignoreError = false): void {
  exec(`docker compose -f ${COMPOSE_FILE} ${args}`, ignoreError);
}

async function waitForHealth(): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < HEALTH_TIMEOUT) {
    try {
      const result = execQuiet(`curl -sf "${HEALTH_URL}"`);
      if (result.includes('"ok":true')) return true;
    } catch {
      // retry
    }
    await sleep(2000);
  }
  return false;
}

// ── Commands ──

async function start(): Promise<void> {
  log("Stopping existing containers...");
  compose("down --remove-orphans", true);

  log("Building and starting...");
  compose("up -d --build");

  log(`Waiting for health check (${HEALTH_TIMEOUT / 1000}s timeout)...`);

  // Wait for container to be healthy
  for (let i = 0; i < 30; i++) {
    const status = execQuiet(
      `docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null`,
    );
    if (status === "healthy") {
      log("Container: healthy");
      break;
    }
    const running = execQuiet(
      `docker inspect --format='{{.State.Running}}' ${CONTAINER_NAME} 2>/dev/null`,
    );
    if (running === "false") {
      log("ERROR: Container stopped unexpectedly");
      compose("logs --tail 50", true);
      process.exit(1);
    }
    await sleep(2000);
  }

  // Final HTTP health check
  const ok = await waitForHealth();
  if (!ok) {
    log("ERROR: Health check failed");
    compose("logs --tail 50", true);
    process.exit(1);
  }

  log("");
  log("=== Demo running ===");
  log(`http://localhost:${PORT}`);
  log("");
  log("Logs: npm run demo -- logs");
  log("Stop: npm run demo -- stop");
}

function stop(): void {
  log("Stopping...");
  compose("down --remove-orphans", true);
  log("Stopped");
}

function logs(): void {
  compose("logs -f");
}

async function restart(): Promise<void> {
  await start();
}

function showHelp(): void {
  console.log(`
  agent-sdk Demo

  Usage:
    npm run demo              Start demo in Docker (build + health check)
    npm run demo -- stop      Stop Docker containers
    npm run demo -- logs      Follow Docker logs
    npm run demo -- restart   Rebuild and restart
    npm run demo -- help      Show this help
`);
}

// ── Main ──

async function main(): Promise<void> {
  const command = process.argv[2] || "start";

  switch (command) {
    case "start":
      await start();
      break;
    case "stop":
      stop();
      break;
    case "logs":
      logs();
      break;
    case "restart":
      await restart();
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      log(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("[demo] Error:", err.message);
  process.exit(1);
});

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { PermissionScope } from "./types.js";

// ─── Interface ──────────────────────────────────────────────────

/** Pluggable store for persisting permission (scope) decisions across runs. */
export interface IPermissionStore {
  /** Check if tool is already approved */
  isApproved(toolName: string): Promise<boolean>;

  /** Store an approval decision */
  approve(toolName: string, scope: PermissionScope): Promise<void>;

  /** Revoke approval for a tool */
  revoke(toolName: string): Promise<void>;

  /** Clear all approvals */
  clear(): Promise<void>;

  /** Dispose resources */
  dispose(): Promise<void>;
}

// ─── InMemoryPermissionStore ────────────────────────────────────

/** In-memory store — approvals live until process exits (or dispose). */
export class InMemoryPermissionStore implements IPermissionStore {
  private approvals = new Map<string, PermissionScope>();

  async isApproved(toolName: string): Promise<boolean> {
    return this.approvals.has(toolName);
  }

  async approve(toolName: string, scope: PermissionScope): Promise<void> {
    if (scope === "once") return; // "once" means don't persist
    this.approvals.set(toolName, scope);
  }

  async revoke(toolName: string): Promise<void> {
    this.approvals.delete(toolName);
  }

  async clear(): Promise<void> {
    this.approvals.clear();
  }

  async dispose(): Promise<void> {
    this.approvals.clear();
  }
}

// ─── FilePermissionStore ────────────────────────────────────────

interface FileStoreEntry {
  scope: PermissionScope;
  timestamp: number;
}

interface FileStoreData {
  approvals: Record<string, FileStoreEntry>;
}

/** File-backed store — reads/writes a JSON file for persistent approvals. */
export class FilePermissionStore implements IPermissionStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async isApproved(toolName: string): Promise<boolean> {
    const data = this.readFile();
    return toolName in data.approvals;
  }

  async approve(toolName: string, scope: PermissionScope): Promise<void> {
    if (scope === "once") return;
    const data = this.readFile();
    data.approvals[toolName] = { scope, timestamp: Date.now() };
    this.writeFileAtomic(data);
  }

  async revoke(toolName: string): Promise<void> {
    const data = this.readFile();
    delete data.approvals[toolName];
    this.writeFileAtomic(data);
  }

  async clear(): Promise<void> {
    this.writeFileAtomic({ approvals: {} });
  }

  async dispose(): Promise<void> {
    // No resources to release
  }

  private readFile(): FileStoreData {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as FileStoreData;
      if (parsed && typeof parsed.approvals === "object") return parsed;
    } catch {
      // File doesn't exist or is invalid — start fresh
    }
    return { approvals: {} };
  }

  private writeFileAtomic(data: FileStoreData): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = this.filePath + `.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, this.filePath);
  }
}

// ─── CompositePermissionStore ───────────────────────────────────

/**
 * Composes multiple stores — checks in order, routes writes by scope.
 *
 * - "session" → sessionStore (in-memory)
 * - "project" → projectStore (file-based in project directory)
 * - "always"  → userStore (file-based in user home)
 */
export class CompositePermissionStore implements IPermissionStore {
  private readonly sessionStore: IPermissionStore;
  private readonly projectStore: IPermissionStore;
  private readonly userStore: IPermissionStore;

  constructor(
    sessionStore: IPermissionStore,
    projectStore: IPermissionStore,
    userStore?: IPermissionStore,
  ) {
    this.sessionStore = sessionStore;
    this.projectStore = projectStore;
    this.userStore = userStore ?? projectStore;
  }

  async isApproved(toolName: string): Promise<boolean> {
    return (
      (await this.sessionStore.isApproved(toolName)) ||
      (await this.projectStore.isApproved(toolName)) ||
      (await this.userStore.isApproved(toolName))
    );
  }

  async approve(toolName: string, scope: PermissionScope): Promise<void> {
    if (scope === "once") return;
    if (scope === "session") {
      await this.sessionStore.approve(toolName, scope);
    } else if (scope === "project") {
      await this.projectStore.approve(toolName, scope);
    } else {
      // "always" → user-level store
      await this.userStore.approve(toolName, scope);
    }
  }

  async revoke(toolName: string): Promise<void> {
    await this.sessionStore.revoke(toolName);
    await this.projectStore.revoke(toolName);
    await this.userStore.revoke(toolName);
  }

  async clear(): Promise<void> {
    await this.sessionStore.clear();
    await this.projectStore.clear();
    await this.userStore.clear();
  }

  async dispose(): Promise<void> {
    await this.sessionStore.dispose();
    await this.projectStore.dispose();
    if (this.userStore !== this.projectStore) {
      await this.userStore.dispose();
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Create a default composite store with separate project and user-level persistence. */
export function createDefaultPermissionStore(
  projectDir?: string,
): CompositePermissionStore {
  const sessionStore = new InMemoryPermissionStore();
  const projectPath = projectDir
    ? path.join(projectDir, ".agent-sdk", "permissions.json")
    : path.join(process.cwd(), ".agent-sdk", "permissions.json");
  const userPath = path.join(os.homedir(), ".agent-sdk", "permissions.json");
  const projectStore = new FilePermissionStore(projectPath);
  const userStore = new FilePermissionStore(userPath);
  return new CompositePermissionStore(sessionStore, projectStore, userStore);
}

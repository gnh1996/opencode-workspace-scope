import { basename, dirname, isAbsolute, join } from "node:path"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import os from "node:os"
import { parseJsonc } from "./jsonc.js"

export interface WorktreeDef {
  name: string
  path: string
  description?: string
}

export interface WorkspaceScope {
  name: string
  workspace: { path: string; description?: string }
  worktrees: WorktreeDef[]
}

export interface ScopeResult {
  config: WorkspaceScope
  sidecarPath: string
  sidecarDir: string
}

let cached: ScopeResult | null = null
let cachedAnchor: string | null = null

export function invalidateScope(): void {
  cached = null
  cachedAnchor = null
}

export function findSidecarPath(anchor: string): string | null {
  let dir = anchor
  for (let depth = 0; depth < 10; depth += 1) {
    const candidate = join(dir, ".opencode", "workspace-scope.jsonc")
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

function toAbsolutePath(p: string, base: string): string {
  const t = p.trim()
  if (t.startsWith("~")) return join(os.homedir(), t.slice(1))
  if (isAbsolute(t)) return t
  return join(base, t)
}

function normalizePath(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

export function loadScope(anchor: string): ScopeResult | null {
  if (cached && cachedAnchor === anchor) return cached
  cached = null
  cachedAnchor = anchor

  const sidecarPath = findSidecarPath(anchor)
  if (!sidecarPath) return null

  let parsed: unknown
  try {
    parsed = parseJsonc(readFileSync(sidecarPath, "utf8"))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null

  const raw = parsed as Record<string, unknown>
  if (!Array.isArray(raw.worktrees)) return null

  const sidecarDir = dirname(sidecarPath)
  const workspaceRoot = dirname(sidecarDir)

  const wsRaw =
    raw.workspace && typeof raw.workspace === "object"
      ? (raw.workspace as Record<string, unknown>)
      : {}
  const workspacePath = normalizePath(
    typeof wsRaw.path === "string" && wsRaw.path
      ? toAbsolutePath(wsRaw.path, workspaceRoot)
      : workspaceRoot,
  )

  const worktrees: WorktreeDef[] = raw.worktrees
    .filter(
      (w): w is Record<string, unknown> =>
        !!w && typeof w === "object" && typeof w.name === "string" && typeof w.path === "string",
    )
    .map((w) => ({
      name: w.name as string,
      path: normalizePath(toAbsolutePath(w.path as string, workspacePath)),
      description: typeof w.description === "string" ? w.description : undefined,
    }))
  if (worktrees.length === 0) return null

  const name = typeof raw.name === "string" && raw.name ? raw.name : basename(anchor)

  return {
    config: {
      name,
      workspace: {
        path: workspacePath,
        description: typeof wsRaw.description === "string" ? wsRaw.description : undefined,
      },
      worktrees,
    },
    sidecarPath,
    sidecarDir,
  }
}

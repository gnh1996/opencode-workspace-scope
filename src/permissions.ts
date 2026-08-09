import { existsSync } from "node:fs"
import type { ScopeResult } from "./scope.js"

function patternPath(p: string): string {
  return p.replaceAll("\\", "/") + "/**"
}

export function buildExternalDirectory(scope: ScopeResult): Record<string, string> {
  const rules: Record<string, string> = {}
  for (const wt of scope.config.worktrees) {
    if (!existsSync(wt.path)) continue
    rules[patternPath(wt.path)] = "allow"
  }
  return rules
}

export function mergeExternalDirectory(
  current: unknown,
  allows: Record<string, string>,
): Record<string, string> {
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return { ...(current as Record<string, string>), ...allows }
  }
  if (typeof current === "string") {
    return { "*": current, ...allows }
  }
  return allows
}

export function mergePermission(current: unknown, external: Record<string, string>): unknown {
  if (typeof current === "string") return current
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return { external_directory: external }
  }
  const base = current as Record<string, unknown>
  return {
    ...base,
    external_directory: mergeExternalDirectory(base.external_directory, external),
  }
}

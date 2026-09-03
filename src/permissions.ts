import { isAbsolute, relative } from "node:path"
import { homedir } from "node:os"
import type { ScopeResult } from "./scope.js"

/**
 * 归一化 external_directory 资源：去掉结尾通配与斜杠、展开 ~，
 * 得到目录边界路径（V2 中资源通常以 "dir/*" 形式出现且已规范化）。
 */
export function normalizeBoundary(resource: string): string {
  let p = resource.replaceAll("\\", "/")
  if (p === "~" || p.startsWith("~/")) p = homedir() + p.slice(1)
  if (p.endsWith("/*")) p = p.slice(0, -2)
  return p.replace(/\/+$/, "")
}

function isWithin(candidate: string, root: string): boolean {
  if (candidate === root) return true
  const rel = relative(root, candidate)
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)
}

/** 单个 external_directory 资源边界是否落在作用域声明的 worktree（词法路径或 realpath）内 */
export function inScope(resource: string, scope: ScopeResult): boolean {
  const boundary = normalizeBoundary(resource)
  return scope.config.worktrees.some(
    (wt) => isWithin(boundary, wt.path) || isWithin(boundary, wt.realpath),
  )
}

/**
 * 全部资源都命中作用域才放行；部分命中时保持默认（ask），
 * 避免把边界外资源一并放行造成越权放大。
 */
export function coveredByScope(
  resources: ReadonlyArray<string>,
  scope: ScopeResult,
): boolean {
  return resources.length > 0 && resources.every((r) => inScope(r, scope))
}

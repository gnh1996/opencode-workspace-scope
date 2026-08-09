import type { ScopeResult } from "./scope.js"

export function buildScopeBlock(scope: ScopeResult): string {
  const { config } = scope
  const lines = [
    "## Workspace Scope（由 workspace-scope 插件自动注入）",
    `当前工作区：${config.name}（工作区根：${config.workspace.path}）`,
    "本次会话的修改范围仅限以下目录，其他路径一律视为外部目录、需用户确认后才可修改：",
    ...config.worktrees.map((w) => {
      const desc = w.description ? ` — ${w.description}` : ""
      return `- ${w.name}: ${w.path}${desc}`
    }),
  ]
  return lines.join("\n")
}

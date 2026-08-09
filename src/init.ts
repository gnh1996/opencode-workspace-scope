import { tool } from "@opencode-ai/plugin"
import { basename, dirname, join } from "node:path"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"
import { invalidateScope } from "./scope.js"
import { WORKSPACE_SCOPE_SCHEMA } from "./schema.js"

function isGitRepo(p: string): boolean {
  return existsSync(join(p, ".git"))
}

function detectSiblingRepos(anchor: string): Array<{ name: string; path: string }> {
  const parent = dirname(anchor)
  let names: string[]
  try {
    names = readdirSync(parent, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
  const selfName = basename(anchor)
  const out: Array<{ name: string; path: string }> = []
  for (const name of names) {
    if (name === selfName) continue
    const p = join(parent, name)
    if (isGitRepo(p)) out.push({ name, path: p })
  }
  return out
}

function ensureGitignore(sidecarDir: string, lines: string[]): void {
  const gi = join(sidecarDir, ".gitignore")
  try {
    const cur = existsSync(gi) ? readFileSync(gi, "utf8") : ""
    const missing = lines.filter((l) => !cur.split("\n").includes(l))
    if (missing.length > 0) appendFileSync(gi, `${missing.join("\n")}\n`)
  } catch {
    // ignore
  }
}

function writeSchema(sidecarDir: string): void {
  try {
    writeFileSync(
      join(sidecarDir, "workspace-scope.schema.json"),
      JSON.stringify(WORKSPACE_SCOPE_SCHEMA, null, 2),
    )
  } catch {
    // ignore
  }
}

export const initTool = tool({
  description:
    "初始化或重建当前工作区的 workspace-scope 配置（.opencode/workspace-scope.jsonc）。不传 worktrees 时自动探测父目录下的兄弟 git 仓库作为候选 worktree。生成的 sidecar 不纳入版本管理（自动写入 .gitignore），并附带 JSON Schema。",
  args: {
    name: tool.schema.string().optional().describe("工作区名称，缺省使用当前目录名"),
    workspaceDescription: tool.schema.string().optional().describe("工作区职责说明"),
    worktrees: tool.schema
      .array(
        tool.schema.object({
          name: tool.schema.string().describe("仓库名，例如 frontend / backend"),
          path: tool.schema.string().describe("绝对路径"),
          description: tool.schema.string().optional().describe("该路径职责说明，会注入 AI 上下文"),
        }),
      )
      .optional()
      .describe("可选：显式指定 worktree 列表；缺省自动探测父目录兄弟 git 仓库"),
  },
  async execute(args, context) {
    const anchor = context.worktree || context.directory
    const sidecarDir = join(anchor, ".opencode")
    mkdirSync(sidecarDir, { recursive: true })

    const worktrees: Array<{ name: string; path: string; description?: string }> =
      args.worktrees && args.worktrees.length > 0 ? args.worktrees : detectSiblingRepos(anchor)

    if (worktrees.length === 0) {
      return [
        "未探测到兄弟 git 仓库，也未收到显式 worktrees 参数。",
        "请传入 worktrees（name+path+description），或确认已在 workspace 根目录启动 opencode。",
      ].join("\n")
    }

    const filePath = join(sidecarDir, "workspace-scope.jsonc")
    const content = {
      $schema: "./workspace-scope.schema.json",
      name: args.name || basename(anchor),
      workspace: {
        path: anchor,
        description: args.workspaceDescription,
      },
      worktrees: worktrees.map((w) => ({
        name: w.name,
        path: w.path,
        description: w.description,
      })),
    }
    writeFileSync(filePath, JSON.stringify(content, null, 2))
    writeSchema(sidecarDir)
    ensureGitignore(sidecarDir, ["workspace-scope.jsonc", "workspace-scope.schema.json"])
    invalidateScope()

    return [
      `已生成 ${filePath}`,
      "",
      "内容：",
      "```jsonc",
      JSON.stringify(content, null, 2),
      "```",
      "",
      "下一步：",
      "1. 编辑该文件，为每个 worktree 补充 description（职责说明，会注入 AI 上下文）；",
      "2. 重启 opencode 使 external_directory 权限生效（上下文注入无需重启）。",
    ].join("\n")
  },
})

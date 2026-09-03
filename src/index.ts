import { Plugin } from "@opencode-ai/plugin"
import { loadScope } from "./scope.js"
import { coveredByScope } from "./permissions.js"
import { buildScopeBlock } from "./context.js"
import { INIT_ARGS_SCHEMA, INIT_TOOL_DESCRIPTION, runInit, type InitArgs } from "./init.js"

const log = (message: string): void => {
  console.log(`[workspace-scope] ${message}`)
}

export const WorkspaceScopePlugin = Plugin.define({
  id: "opencode-workspace-scope",
  async setup(ctx) {
    // 对齐 V1 语义：优先项目规范根（原 worktree），回退会话目录
    const anchor = ctx.location.project.canonical || ctx.location.directory
    const scope = loadScope(anchor)
    if (scope) log(`已应用工作区作用域 ${scope.sidecarPath}`)

    if (scope) {
      // 权限：不再改写配置，改为在评估阶段动态放行。
      // 仅 escalate ask→allow；配置显式 deny 不会进入本 hook（最终生效）。
      await ctx.permission.hook("evaluate", (event) => {
        if (event.action !== "external_directory") return
        if (event.effect !== "ask") return
        const current = loadScope(anchor)
        if (!current) return
        if (coveredByScope(event.resources, current)) {
          event.effect = "allow"
          event.message = "workspace-scope：目标路径位于本工作区声明的范围内"
        }
      })

      // 上下文：每轮模型调用注入工作区块；V2 为可 push 数组，无 sessionID 时不会触发 title 请求
      await ctx.session.hook("context", (event) => {
        const current = loadScope(anchor)
        if (!current) return
        event.system.push({ type: "text", text: buildScopeBlock(current) })
      })
    }

    // init 工具始终注册：sidecar 尚不存在时也要能引导创建
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "workspace_scope_init",
        description: INIT_TOOL_DESCRIPTION,
        input: INIT_ARGS_SCHEMA,
        async execute(input) {
          return { content: runInit(anchor, input as InitArgs) }
        },
      })
    })
  },
})

export default WorkspaceScopePlugin

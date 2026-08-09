import type { Plugin } from "@opencode-ai/plugin"
import { loadScope } from "./scope.js"
import { buildExternalDirectory, mergePermission } from "./permissions.js"
import { buildScopeBlock } from "./context.js"
import { initTool } from "./init.js"

export const WorkspaceScopePlugin: Plugin = async ({ directory, worktree, client }) => {
  const anchor = worktree || directory

  const logApplied = (sidecarPath: string): void => {
    try {
      const result = (
        client as { app?: { log?: (input: unknown) => Promise<unknown> } }
      ).app?.log?.({
        body: {
          service: "workspace-scope",
          level: "info",
          message: `已应用工作区作用域 ${sidecarPath}`,
        },
      })
      if (result && typeof result.catch === "function") {
        result.catch(() => {})
      }
    } catch {
      // ignore
    }
  }

  return {
    config: async (cfg) => {
      const scope = loadScope(anchor)
      if (!scope) return
      logApplied(scope.sidecarPath)
      const external = buildExternalDirectory(scope)
      if (Object.keys(external).length === 0) return
      const anyCfg = cfg as { permission?: unknown }
      anyCfg.permission = mergePermission(anyCfg.permission, external)
    },

    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) return
      const scope = loadScope(anchor)
      if (!scope) return
      output.system[0] = `${output.system[0] ?? ""}\n\n${buildScopeBlock(scope)}`
    },

    tool: {
      workspace_scope_init: initTool,
    },
  }
}

export default WorkspaceScopePlugin

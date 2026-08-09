import type { Plugin } from "@opencode-ai/plugin"
import { loadScope } from "./scope.js"
import { buildExternalDirectory, mergePermission } from "./permissions.js"
import { buildScopeBlock } from "./context.js"
import { initTool } from "./init.js"

export const WorkspaceScopePlugin: Plugin = async ({ directory, worktree }) => {
  const anchor = worktree || directory

  return {
    config: async (cfg) => {
      const scope = loadScope(anchor)
      if (!scope) return
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

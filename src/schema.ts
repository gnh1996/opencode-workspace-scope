export const WORKSPACE_SCOPE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "WorkspaceScopeConfig",
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "工作区名称" },
    workspace: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string", description: "工作区根路径" },
        description: { type: "string", description: "工作区职责说明" },
      },
    },
    worktrees: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "path"],
        properties: {
          name: { type: "string", description: "仓库名，如 frontend / backend" },
          path: { type: "string", description: "worktree 路径（绝对路径，或相对工作区根目录，如 ../frontend）" },
          description: { type: "string", description: "该路径职责说明，会注入 AI 上下文" },
        },
      },
    },
  },
  required: ["worktrees"],
}

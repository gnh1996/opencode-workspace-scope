# opencode-workspace-scope

> **opencode2（V2）用户请看这里**：本分支为 V1（opencode 1.x）适配。opencode2 的插件适配在 [`v2` 分支](https://github.com/gnh1996/opencode-workspace-scope/tree/v2)，npm 包以 `beta` dist-tag 发布：`opencode2 plugin add opencode-workspace-scope@beta`。两版插件 API 与依赖不兼容，不可混装。

全局安装、**sidecar 自激活**的 [opencode](https://opencode.ai) 插件，为"一个项目涉及多个代码仓库"的并行开发场景提供工作区作用域隔离。

在 `.opencode/workspace-scope.jsonc` 里声明本项目涉及的各个仓库路径与职责（如前端仓库、后端仓库、编排根），插件据此：

- 自动注入 `permission.external_directory` 白名单，**只放开配置中声明的仓库**，其余外部路径保持默认 ask；
- 把"工作区根 + 各仓库路径及职责"注入 system prompt，让 AI 每轮都知道改哪里、哪些路径不能碰。

sidecar 只需在编排根（或任一仓库）放一份，其他并行会话通过向上查找自动继承作用域，配合 init 工具自动探测兄弟仓库，开箱即用、零重复配置。

无 sidecar 的项目中插件完全 no-op，不影响任何正常使用。

## 安装

全局安装（推荐，配合 sidecar 自激活）：

```bash
mkdir -p ~/.config/opencode/plugins
ln -s /path/to/opencode-workspace-scope/src/index.ts ~/.config/opencode/plugins/workspace-scope.ts
# 或按项目使用 npm：
# npm install opencode-workspace-scope
```

重启 opencode 后生效。

## 快速开始

1. 在某个工作区根目录启动 opencode，对它说：

   > 初始化这个工作区的 scope 配置

   插件会调用 `workspace_scope_init` 工具：自动探测父目录下的兄弟 git 仓库作为候选 worktree，生成 `.opencode/workspace-scope.jsonc`（并自动写入 `.opencode/.gitignore`，不纳入版本管理），同时生成配套 JSON Schema。也可让 AI 传入显式 worktrees 列表，覆盖任意仓库/目录。

2. 编辑该文件，为每个 worktree 补充 `description`（职责说明，会注入 AI 上下文）：

   ```jsonc
   {
     "$schema": "./workspace-scope.schema.json",
     "name": "feature-x",
     "workspace": {
       "path": "/home/you/dev/wsp/feature-x",
       "description": "编排根：opencode 配置/规则所在地"
     },
     "worktrees": [
       { "name": "frontend", "path": "/home/you/dev/wsp/feature-x/frontend", "description": "前端仓库 React/TS" },
       { "name": "backend", "path": "../backend", "description": "后端仓库 Go" }
     ]
   }
   ```

   `path` 支持绝对路径，也支持相对**工作区根目录**的相对路径（如 `../backend`）。

   > `worktrees` 泛指本工作区涉及的各代码仓库/目录，不要求是 git worktree；可以是兄弟仓库、monorepo 子目录，或任意绝对/相对路径。

3. **重启 opencode**，使 external_directory 权限生效（上下文注入无需重启）。

## 权限行为

- 注入到 `permission.external_directory`：`"<worktree>/**: allow"`，采用"末尾追加、last-match-wins"合并，不覆盖你已有的其他规则；对每个 worktree 同时写入**词法路径与 realpath 两种 pattern**，避免符号链接祖先导致白名单失效；
- 工作区根目录之外、且不在白名单内的路径：维持 opencode 默认 `ask`；
- sidecar 中不存在的路径会被跳过，不会崩溃；
- **sidecar 向上查找**：从启动目录逐级向上找 `.opencode/workspace-scope.jsonc`（最多 10 层），嵌套子项目会继承父工作区的作用域（对齐 opencode 自身配置发现行为）；
- 注意：`opencode --auto` 会把 `ask` 自动放行。若并行会话需要硬隔离，请在配置里为 `external_directory` 追加 `"*": "deny"` 兜底。

## 注入的上下文

每轮请求会把以下块拼进 system prompt 主块（`output.system[0]`，无 `sessionID` 时不注入）：

```
## Workspace Scope（由 workspace-scope 插件自动注入）
当前工作区：feature-x（工作区根：/home/you/dev/wsp/feature-x）
本次会话的修改范围仅限以下目录，其他路径一律视为外部目录、需用户确认后才可修改：
- frontend: /home/you/dev/wsp/feature-x/frontend — 前端仓库 React/TS
- backend: /home/you/dev/wsp/feature-x/backend  — 后端仓库 Go
```

## 设计约束

- **自激活**：无 sidecar 时插件必须完全 no-op；
- **权限只押 `external_directory`**：不依赖 read/edit 的路径 pattern（存在绝对/相对不对称问题，见 opencode issue #26524）；
- **不改默认语义**：用户 `permission` 为字符串缩写（如 `"allow"`）时不改写；对象形式按"末尾追加 allow"合并；
- **system.transform 原地变更**：只拼 `output.system[0]`，禁止整体赋值（静默 no-op，issue #25754）；
- **零新增运行时依赖**：仅依赖 `@opencode-ai/plugin`。

## 开发

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # 输出到 dist/
bun /tmp/opencode/smoke.ts   # 冒烟测试（临时脚本，不入库）
```

发布：`npm version patch && npm publish`（`prepublishOnly` 自动 typecheck + build）。

## License

MIT

# opencode-workspace-scope

全局安装、**sidecar 自激活**的 [opencode2](https://opencode.ai)（V2）插件，为"一个项目涉及多个代码仓库"的并行开发场景提供工作区作用域隔离。

在 `.opencode/workspace-scope.jsonc` 里声明本项目涉及的各个仓库路径与职责（如前端仓库、后端仓库、编排根），插件据此：

- 在权限评估阶段**动态放行**已声明仓库的 `external_directory` 请求，其余外部路径保持默认 ask，配置中的显式 deny 仍然最终生效；
- 把"工作区根 + 各仓库路径及职责"注入 system prompt，让 AI 每轮都知道改哪里、哪些路径不能碰。

sidecar 只需在编排根（或任一仓库）放一份，其他并行会话通过向上查找自动继承作用域，配合 init 工具自动探测兄弟仓库，开箱即用、零重复配置。

无 sidecar 的项目中插件不注册任何 hook，完全 no-op，不影响任何正常使用。

> 仅适配 opencode2（V2 插件 API）。V1 版本见 `main` 分支，二者不可混用：V2 下加载 V1 插件会以 WARN 失败跳过。

## 安装

已发布为 npm 包，通过 V2 CLI 全局安装：

```bash
opencode2 plugin add opencode-workspace-scope@beta
```

或手动写入全局 `~/.config/opencode/opencode.json(c)` 的 `plugins` 数组（注意是复数 `plugins`，不是 V1 的 `plugin`）：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-workspace-scope@beta"]
}
```

重启 opencode2（`opencode2 service restart`）后生效。建议条目带版本/tag 固定，避免被 `plugin update` 升到不兼容版本。

## 快速开始

1. 在某个工作区根目录启动 opencode2，对它说：

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

3. **重启 opencode2**，使 external_directory 放行生效（上下文注入无需重启，sidecar 修改后每轮调用会重新加载）。

## 权限行为

- V2 插件 API 无 config hook，插件**不再改写配置**，改为注册 `permission.evaluate` hook：当 `external_directory` 请求的资源边界全部落在 sidecar 声明的 worktree（词法路径或 realpath）内时，把 `ask` 升级为 `allow`；
- 只做 `ask → allow` 的单向升级：配置显式 `deny` 不会进入 hook（最终生效），已是 `allow` 的请求保持不变；部分命中的多资源请求**整体不放行**，避免越权放大；
- 对每个 worktree 同时比对**词法路径与 realpath**，规避符号链接祖先导致匹配失效；
- 工作区根目录之外、且不在声明范围内的路径：维持默认 `ask`；
- sidecar 中不存在的路径会被跳过，不会崩溃；
- **sidecar 向上查找**：从启动目录逐级向上找 `.opencode/workspace-scope.jsonc`（最多 10 层），嵌套子项目会继承父工作区的作用域（对齐 opencode 自身配置发现行为）；
- 注意：`/tmp` 等托管临时目录被 opencode2 内置豁免，不经过 `external_directory` 决策；并行会话需要硬隔离时请在配置中追加显式 deny 规则。

## 注入的上下文

每轮模型调用（`session.context` hook）会把以下块 push 进 system parts（title 请求等无会话上下文的调用不注入）：

```
## Workspace Scope（由 workspace-scope 插件自动注入）
当前工作区：feature-x（工作区根：/home/you/dev/wsp/feature-x）
本次会话的修改范围仅限以下目录，其他路径一律视为外部目录、需用户确认后才可修改：
- frontend: /home/you/dev/wsp/feature-x/frontend — 前端仓库 React/TS
- backend: /home/you/dev/wsp/feature-x/backend  — 后端仓库 Go
```

## 设计约束

- **自激活**：无 sidecar 时 setup 不注册任何 hook，完全 no-op；
- **权限只押 `external_directory`**：不依赖 read/edit 的路径 pattern；
- **不改默认语义**：只升级 `ask → allow`，deny/allow 原样保留，多资源部分命中不放行；
- **零新增运行时依赖**：仅依赖 `@opencode-ai/plugin`（beta）。

## 开发

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # 输出到 dist/
```

本地联调：在测试工作区的 `.opencode/plugins/` 放一个转发文件（V2 自动发现该目录，直接 `.ts/.js` 文件形式最稳）：

```ts
// <测试工作区>/.opencode/plugins/ws-scope.ts
export { default } from "/absolute/path/to/opencode-workspace-scope/dist/index.js"
```

注意本地包目录形式的插件需要依赖可解析（`@opencode-ai/plugin`），建议用上面的转发文件 + 仓库内 `node_modules`。

发布：`npm version prerelease && npm publish --tag beta`（`prepublishOnly` 自动 typecheck + build）；V2 插件 API 仍在 beta，随 opencode2 版本升级需回归验证。

## License

MIT

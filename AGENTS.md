# 项目规则：opencode-workspace-scope（v2 分支）

## 项目定位

一个**全局安装、sidecar 自激活**的 opencode2（V2）插件，用于多 worktree 并行开发场景：

- 每个并行工作区在 `.opencode/workspace-scope.jsonc` 声明本工作区涉及的 worktree 路径及职责；
- 插件通过 `permission.evaluate` hook 动态放行已声明 worktree 的 `external_directory` 请求（仅 ask→allow），其余外部路径保持默认 ask，显式 deny 最终生效；
- 插件把"工作区路径 + 职责"块注入 system prompt（`session.context` hook），让 AI 明确知道各路径作用与修改范围；
- 配套 `workspace_scope_init` 自定义工具（`tool.transform` 注册），自动探测兄弟 git 仓库生成 sidecar（不纳入版本管理）。

**仅适配 V2**；V1 适配在 `main` 分支，二者实现与依赖不兼容，不可互相加载。

## 关键设计约束

- **自激活**：setup 时无 sidecar 则不注册任何 hook（init 工具始终注册，用于引导创建 sidecar），不得影响任何正常项目；
- **权限只押 external_directory**：在 evaluate hook 里对 `action === "external_directory"` 做判断，不依赖 read/edit 的路径 pattern；
- **只升级 ask→allow**：deny 不进 hook（V2 语义，显式 deny 最终生效）、allow 保持原样；多资源请求必须**全部命中**作用域才放行，防止越权放大；
- **边界匹配双路径**：对每个 worktree 同时比对词法路径与 realpath，规避符号链接祖先导致匹配失效；资源边界先归一化（去结尾 `/*`、展开 `~`）；
- **上下文注入用 `event.system.push`**：V2 的 `session.context` hook 提供可 push 数组，禁止整体赋值；每轮调用重新 loadScope，sidecar 修改后无需重启即生效；
- **相对路径以工作区根为基准**：sidecar 位于 `<工作区根>/.opencode/`，worktree 相对路径（如 `../frontend`）以工作区根解析；sidecar 缺失/解析失败/路径不存在均不崩溃，仅记日志；
- **sidecar 向上查找（最多 10 层）**：嵌套子项目继承父工作区作用域，与 opencode 自身配置发现行为一致；作用域生效时打日志记录 sidecar 路径；
- **anchor 取 `ctx.location.project.canonical`（回退 `ctx.location.directory`）**：对齐 V1 的 `worktree || directory` 语义；
- **零新增依赖**：运行时只依赖 `@opencode-ai/plugin`（beta，与目标 opencode2 版本一致），jsonc 解析用自带轻量实现。

## 技术栈与命令

- TypeScript，ESM（`"type": "module"`），NodeNext 解析；源码内相对导入必须带 `.js` 后缀；
- `npm install` 安装依赖；`npm run typecheck`（`tsc --noEmit`）；`npm run build`（`tsc` 输出到 `dist/`）；
- 安装：`opencode2 plugin add opencode-workspace-scope@beta` 写入全局 `plugins`（复数）数组；发布用 `npm publish --tag beta`；启动时安装/缓存到 `~/.cache/opencode/npm/<pkg>@<ver>/`，按版本隔离、可与 V1 并存。

## 开发与调试

- 源码位置：`src/`（index.ts 为插件入口，`Plugin.define` 定义，导出 `WorkspaceScopePlugin` 及 default）；
- 本地联调：测试工作区 `.opencode/plugins/` 放转发文件 `export { default } from "<绝对路径>/dist/index.js"`（直接 `.ts` 文件形式，V2 自动发现）；插件包目录形式要求依赖可解析，勿在无 node_modules 的目录使用；
- 冒烟：`opencode2 api get '/api/plugin?location[directory]=<测试目录>'` 看插件是否 active；权限行为用 `opencode2 run`（非交互、不加 `--auto`）对范围内/范围外路径各做一次读对照；
- 配置文件改动（含 sidecar）不热加载，需 `opencode2 service restart`；
- 注意 `/tmp` 属 V2 托管临时目录豁免范围，权限冒烟必须用 `/tmp` 之外的真实路径。

## 代码约定

- 回复与注释使用中文；不添加无必要的注释；
- 文件职责：`jsonc.ts` 解析、`scope.ts` 加载/缓存、`permissions.ts` 边界归一化与作用域匹配、`context.ts` 上下文块、`schema.ts` sidecar JSON Schema、`init.ts` 初始化工具（逻辑 + args schema）、`index.ts` 组装；
- 修改权限/上下文行为前，先按"开发与调试"跑冒烟对照，确认放行语义不被破坏。

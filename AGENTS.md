# 项目规则：opencode-workspace-scope

## 项目定位

一个**全局安装、sidecar 自激活**的 opencode 插件，用于多 worktree 并行开发场景：

- 每个并行工作区在 `.opencode/workspace-scope.jsonc` 声明本工作区涉及的 worktree 路径及职责；
- 插件自动注入 `permission.external_directory` 白名单（仅放开本工作区的 worktree），其余外部路径保持默认 ask；
- 插件把"工作区路径 + 职责"块注入 system prompt，让 AI 明确知道各路径作用与修改范围；
- 配套 `workspace_scope_init` 自定义工具，自动探测兄弟 git 仓库生成 sidecar（不纳入版本管理）。

## 关键设计约束

- **自激活**：无 sidecar 时插件必须完全 no-op，不得影响任何正常项目；
- **权限只押 external_directory**：不依赖 read/edit 的路径 pattern（存在绝对/相对不对称坑，见 opencode issue #26524）；
- **外部路径不改默认语义**：用户 `permission` 为字符串缩写（如 `"allow"`）时不改写；对象形式的 `external_directory` 按"末尾追加 allow、last-match-wins"合并；
- **system.transform 必须原地变更**：拼进 `output.system[0]`，禁止整体赋值 `output.system = [...]`（静默 no-op，issue #25754）；无 `sessionID` 时不注入；
- **相对路径以工作区根为基准**：sidecar 位于 `<工作区根>/.opencode/`，worktree 相对路径（如 `../frontend`）以工作区根解析；sidecar 缺失/解析失败/路径不存在均不崩溃，仅记日志；
- **零新增依赖**：运行时只依赖 `@opencode-ai/plugin`（用于 `tool` 助手与类型），jsonc 解析用自带轻量实现。

## 技术栈与命令

- TypeScript，ESM（`"type": "module"`），NodeNext 解析；源码内相对导入必须带 `.js` 后缀；
- `npm install` 安装依赖；`npm run typecheck`（`tsc --noEmit`）；`npm run build`（`tsc` 输出到 `dist/`）；
- 发布：`npm version patch && npm publish`（发布前自动 typecheck+build，见 `prepublishOnly`）。

## 开发与调试

- 源码位置：`src/`（index.ts 为插件入口，导出 `WorkspaceScopePlugin` 及 default）；
- 全局加载：`~/.config/opencode/plugins/workspace-scope.ts` 已符号链接到 `src/index.ts`，改源码后**重启 opencode** 生效；
- 冒烟测试：改完执行 `bun /tmp/opencode/smoke.ts`（临时脚本，不入库），验证 config hook / system.transform / init 工具；
- 配置文件改动（含 sidecar）不热加载，需重启。

## 代码约定

- 回复与注释使用中文；不添加无必要的注释；
- 文件职责：`jsonc.ts` 解析、`scope.ts` 加载/缓存、`permissions.ts` 权限合并、`context.ts` 上下文块、`schema.ts` 内嵌 JSON Schema、`init.ts` 初始化工具、`index.ts` 组装；
- 修改权限/上下文行为前，先跑冒烟测试确认合并语义不被破坏。

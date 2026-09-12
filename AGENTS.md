# Memory

水电表数据面板(meter-panel)的长期约定。沟通与回复使用中文。

## 项目概览

连接后端水电表采集服务、用 AG Grid 展示水表/电表两个 CSV 表格的 Electron 桌面工具。

`docs/` 下三份规范合计 1000+ 行,**不要整份 `@import` 进来**——import 的内容每轮都会进 system prompt,持续占用上下文。按场景按需读取:

| 场景 | 读哪份 |
| --- | --- |
| 引入/移除依赖,或用某个库写代码前 | `docs/tech-stack.md`(§2 冻结基线、§4 暂不引入、§5 AG Grid 规则) |
| 改动分层、IPC、目录结构、状态归属 | `docs/architecture.md`(§2 顶层分区、§10 目录演进、§12 验收清单) |
| 决定要跑哪些验证、写测试 | `docs/testing.md`(§4 基础门禁、§12 最低验证矩阵) |
| 用户可见的功能、命令、配置项 | `README.md` |

较大的功能或重构按 `README.md`「结合ai的功能实现流程」先定 spec(写入 `docs/specs/`)再动手,不要跳过评审直接实现。

## 文档同步规则

目录结构、文件命名、技术选型、跨进程契约发生变更时,**必须在同一次改动内同步文档**,不得留作后续任务:

| 变更 | 同步到哪里 |
| --- | --- |
| 目录增删/重命名、分层调整 | `docs/architecture.md` §10 的目录树与演进表格 |
| 新增/移除依赖、库用法约定 | `docs/tech-stack.md` |
| 测试策略、验收方式变化 | `docs/testing.md` |
| 用户可见的功能、命令、配置项 | `README.md`(其中「技术栈」一节需与 `docs/tech-stack.md` 保持一致) |

## 命令与验证

See @package.json for available npm/pnpm commands for this project.

- 改了任何 `.ts`/`.tsx` 生产代码:完成前**必须**跑 `npm run typecheck` 和 `npm run build`
- 只改 Markdown:可以不跑门禁,但要检查 diff(确认没误改生产代码)、相对链接与路径一致性,并在完成说明中讲清这是 docs-only 变更及未运行的原因
- 完成说明必须列出**实际运行的命令及结果**,以及未运行项和原因;不得用"运行时应该没问题"代替门禁
- 具体的最低验证矩阵见 `docs/testing.md` §12.1

## 命名与目录约定

- 集合类目录一律用复数:`pages/`、`stores/`、`queries/`、`components/`
- 不预先创建空目录(`features/`、`hooks/`、`services/` 等),按 `docs/architecture.md` §10 的触发条件再建
- 依赖方向为 `renderer → (IPC) → main`;跨进程契约放 `src/shared/`,保持无平台依赖、无副作用

## 提交约定

- Conventional Commits + 中文描述(`feat:` / `fix:` / `refactor:` / `docs:`)
- 不相关的改动拆成独立提交(例如重构与文档更新分开),不要压成一个大提交

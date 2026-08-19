# 技术栈规范

> 状态：项目级长期约束  
> 适用范围：本仓库中的人工开发、Codex/agent 生成代码、重构与依赖变更  
> 最后更新：2026-08-19

## 1. 目的

本文定义项目允许使用的技术、当前兼容性基线和依赖引入规则。它约束“使用什么”，不规定具体功能的实现细节；进程边界与依赖方向见 [`architecture.md`](./architecture.md)，长期测试与验收策略见 [`testing.md`](./testing.md)。

本文中的关键词含义如下：

- **MUST / 必须**：不可违反；若现有代码不符合，应在相关迁移 spec 中列为修复项。
- **MUST NOT / 禁止**：不得在新代码中出现。
- **SHOULD / 应当**：默认做法；偏离时必须在 feature spec 或变更说明中解释原因。
- **MAY / 可以**：按实际需求选择，不要求预先采用。

## 2. 当前冻结基线

以下是当前项目已经使用并应保留的基础版本线，不代表它们是最新版本：

| 领域 | 当前基线 | 状态 |
| --- | --- | --- |
| 桌面运行时 | Electron 33（当前依赖 `^33.2.1`） | 已安装，第一阶段不升级 |
| Electron 构建 | electron-vite 2（当前依赖 `^2.3.0`） | 已安装，第一阶段不升级 |
| Web 构建 | Vite 5（当前依赖 `^5.4.11`） | 已安装，第一阶段不升级 |
| UI 框架 | React 18（当前依赖 `^18.3.1`） | 已安装，第一阶段不升级 |
| 语言 | TypeScript 5（当前依赖 `^5.6.3`） | 已安装 |
| 数据表格 | AG Grid Community 33（当前依赖 `^33.2.0`） | 已安装并保留 |
| 打包 | electron-builder 26 | 已安装并保留 |
| CSV | PapaParse 5 | 已安装并保留 |
| 字符编码 | iconv-lite 0.6 | 已安装并保留 |

### 基线规则

1. 第一阶段的 UI 与架构演进 **MUST NOT** 顺带升级 React、Electron、Vite、electron-vite、TypeScript、AG Grid 或 electron-builder 的主版本。
2. 锁文件 `package-lock.json` **MUST** 与 `package.json` 一起提交；禁止为了“刷新依赖”无目的地重建锁文件。
3. 新依赖 **MUST** 有明确职责，且不得与已批准技术重复解决同一问题。
4. 发现新版或弃用警告不等于获得升级授权。基础版本升级 **MUST** 进入单独的迁移 spec，包含兼容性调查、分步方案、回滚方式和验证标准。

## 3. 第一阶段批准引入

第一阶段可以引入以下技术，但应按实际改造步骤逐项加入，不要求一次性安装或一次性重写现有界面。

| 领域 | 选型 | 约束 |
| --- | --- | --- |
| 样式 | Tailwind CSS v4 | 用于新 UI 的布局、间距、颜色和响应式样式；不得借引入之机一次性重写所有现有 CSS |
| UI 组件 | shadcn/ui | 组件源码归项目所有；仅添加实际需要的组件，不批量生成组件 |
| 图标 | Lucide | 统一使用 React 图标包；业务组件不混用另一套通用图标库 |
| 路由 | React Router v7 | 使用 Declarative Mode；不使用 Framework Mode，不升级到 v8 |
| 客户端状态 | Zustand | 只承载确有跨组件共享需求的客户端状态 |
| 运行时契约 | Zod 4 | 用于 IPC、配置、HTTP/CSV 解析结果等不可信边界的数据校验，并作为相关 TypeScript 类型来源 |

### 3.1 Tailwind CSS v4

- 新增 Tailwind 时 **MUST** 遵循 v4 的配置与集成方式，不照搬 v3 配置模板。
- 全局设计 token（颜色、圆角、间距等）应集中定义；组件中避免散落无法解释的任意值。
- 原生 CSS 可以继续用于全局基础样式、复杂动画、第三方组件适配和 Tailwind 不适合表达的规则。
- 迁移应渐进进行。仅因引入 Tailwind，不得改动无关组件的视觉行为。

### 3.2 shadcn/ui 与 Lucide

- shadcn/ui 是项目内源码，不是不可修改的黑盒依赖；通用修正应在 `components/ui/` 内保持一致。
- 只在有真实使用方时添加组件，禁止提前生成整套组件或空目录。
- 业务组件应组合基础 UI 组件，不应把业务状态、IPC 调用或数据获取逻辑写进 `components/ui/`。
- 图标默认来自 Lucide；使用图标时应提供清晰的可访问名称或与可见文本配合。

### 3.3 React Router v7

- **MUST** 使用 v7 的 Declarative Mode。
- 桌面应用在 `file://` 打包环境下默认采用 `HashRouter`，避免刷新或直接进入子路由时依赖服务器回退规则。
- 不引入 React Router Framework Mode、服务端渲染、loader/action 数据层或与本地桌面应用无关的全栈约定。
- 页面数量达到两个且确有导航需求时再建立 `pages/` 与路由表；单页面阶段不为形式完整而制造空路由。

### 3.4 Zustand

- Zustand 用于跨页面或跨较远组件共享、且具有明确生命周期的客户端 UI/会话状态。
- 局部表单输入、弹窗开关、仅属于单个组件树的状态应优先使用 React 本地状态。
- 服务端或主进程数据不应因为“需要缓存”就全部复制到全局 store；必须先定义所有权、刷新策略与失效规则。
- store 应按领域拆分并暴露最小 action；禁止建立无边界的 `useAppStore` 收纳全部状态。
- store 中 **MUST NOT** 持有 Electron/Node 对象、AG Grid API 实例、DOM 节点或不可序列化的 IPC 句柄。

### 3.5 Zod 4

- 跨信任边界的数据 **MUST** 在运行时校验，不能只使用 TypeScript 类型断言。
- schema 是相关契约的单一事实来源；类型应优先通过 `z.infer<typeof Schema>` 派生，禁止手写一份可能漂移的重复 interface。
- schema 应放在 `src/shared/schemas/` 或紧邻其所属共享契约的位置，并保持可被 main、preload、renderer 共同导入。
- 校验失败必须转化为可诊断、可安全展示的错误；禁止静默吞掉，也禁止把密码、认证头或完整敏感载荷写入日志。

## 4. 明确暂不引入

第一阶段 **MUST NOT** 引入下列库。出现真实需求时，应先提交独立 feature spec 或迁移 spec，说明现有能力为何不足。

| 暂不引入 | 当前决定 |
| --- | --- |
| TanStack Table | 不引入；结构化数据表格统一使用 AG Grid Community 33 |
| TanStack Virtual | 不引入；表格虚拟化由 AG Grid 提供，非表格超长列表需另行评估 |
| TanStack Query | 暂不引入；当前数据访问通过受控 IPC/main service 完成，出现复杂远程缓存需求后再评估 |
| React Hook Form | 暂不引入；现阶段表单规模不足以证明新增抽象的必要性 |
| Apache ECharts | 暂不引入；出现明确趋势图、统计图与性能指标后再做可视化 spec |
| Playwright | 暂不引入；Electron E2E 测试在独立测试迁移中设计 |

“暂不引入”不是永久禁止，但 agent **MUST NOT** 仅以流行度、便利性或“最佳实践”为由自行加入。

## 5. AG Grid Community 33 规则

1. 所有大型、可排序、可过滤或持续更新的结构化表格默认使用 AG Grid Community 33。
2. **MUST NOT** 使用 Enterprise-only API、模块或主题，除非项目另行批准许可证与迁移 spec。
3. Community 版已经提供的排序、过滤、分页和虚拟化能力不得由另一套表格/虚拟列表库重复实现。
4. 列定义、值格式化与纯数据转换应尽可能保持纯函数；领域列定义可放在相应 feature 内，可跨进程复用的纯元数据才放入 `shared`。
5. 高频更新应优先使用稳定行 ID 与 AG Grid transaction/async transaction API；禁止每次采样都重建整份大型 `rowData`。
6. Grid API、列 API 或组件引用只能留在 renderer 内，不得进入 Zustand、shared、IPC 参数或持久化配置。
7. 对第三方主题的 CSS 覆盖应集中管理，避免在多个业务组件中散落高优先级选择器。

## 6. 测试与工具链升级

项目需要自动化测试，但 **Vitest 的引入和基础工具链升级不属于第一阶段 UI/架构变更**。测试层级、完成门禁和 feature spec 验收写法以 [`testing.md`](./testing.md) 为准。

必须单独编写迁移 spec，至少评估：

- Node.js 支持范围；
- electron-vite、Vite、React、Electron 与 React Router 的兼容矩阵；
- Vitest 的适配版本、运行环境与覆盖范围；
- 现有 build、typecheck、开发启动和 Windows 打包流程；
- 分步升级顺序、每步验证命令和失败回滚方案；
- 是否以及何时引入 Playwright Electron E2E。

在该迁移 spec 获批前：

- **MUST** 保留现有 `build`、`typecheck`、`dist` 和 `dist:portable` 工作流；
- **MUST NOT** 为安装最新版 Vitest 而顺带升级 Vite/electron-vite；
- 可以为纯函数补充不依赖新测试框架的可测试结构，但不要创建虚假的空测试套件。

## 7. 依赖变更流程

Agent 在新增、删除或升级依赖前 **MUST**：

1. 阅读本文与相关 feature spec；
2. 说明依赖解决的具体问题和不用现有技术解决的原因；
3. 检查与当前冻结基线的兼容性；
4. 确认许可证和 Community/Enterprise 边界；
5. 将改动限制在相关功能范围；
6. 运行 `npm run typecheck` 与 `npm run build`；涉及打包配置时再运行相应 Windows 打包验证；
7. 更新本文中受影响的状态或通过单独 ADR/spec 记录决策。

未经 spec 明确授权，禁止“顺手升级”、替换包管理器、引入第二套 UI/状态/表格方案，或用大规模重写完成一次本可渐进完成的依赖迁移。

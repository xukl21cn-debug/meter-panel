# 架构规范

> 状态：项目级长期约束  
> 适用范围：`src/main`、`src/preload`、`src/renderer`、`src/shared` 及其后续演进  
> 最后更新：2026-09-12

## 1. 目标

本项目是用于现场调试和数据追踪的 Electron 桌面应用。测试与验收要求见 [`testing.md`](./testing.md)。架构首先保证：

- Electron 权限边界清晰，renderer 不获得 Node/Electron 能力；
- 外部数据和跨进程数据在运行时可验证；
- 采集、配置、文件和系统能力集中在 main；
- UI 可以独立演进，不把业务逻辑塞进 preload 或全局状态；
- 目录随真实复杂度渐进生长，不进行无需求支撑的“企业级”分层；
- 每次变更范围可理解、可验证、可回滚。

本文中的 **MUST / 必须**、**MUST NOT / 禁止**、**SHOULD / 应当** 与 **MAY / 可以** 均为规范性关键词。

## 2. 顶层分区与职责

```text
src/
├── main/       Electron 主进程、系统权限、数据访问与持久化
├── preload/    最小化的安全桥接层
├── renderer/   React UI 与纯前端交互
└── shared/     跨分区共享的纯契约、schema、常量与纯函数
```

标准调用链：

```text
Renderer (React)
    │  window.api.<operation>(typed payload)
    ▼
Preload (contextBridge)
    │  ipcRenderer.invoke / 安全事件订阅
    ▼
Main IPC adapter
    │  校验、鉴权式能力检查、调用 service
    ▼
Main service / OS / HTTP / filesystem
    │
    └── 返回经 schema 校验且可结构化克隆的数据
```

允许的静态依赖方向：

```text
main ───────► shared
preload ────► shared
renderer ───► shared

shared ─X─► main | preload | renderer
renderer ─X─► main | preload
main ─X─► renderer
```

`preload` 与 `main` 的运行时通信只能经过 Electron IPC；renderer 与 preload 的运行时边界只能经过 `contextBridge` 暴露的窄接口。

## 3. Main 进程

`src/main` 是受信任后端，拥有 Electron、Node.js、文件系统、网络、进程与持久化能力。

### Main 必须负责

- 应用和窗口生命周期；
- 文件读取、写入、导出与路径选择；
- 后端 HTTP 请求、认证信息使用、编码处理与 CSV 获取；
- 配置持久化和敏感字段保护；
- IPC handler 注册、输入校验、错误归一化和 service 调用；
- 只向 renderer 返回完成任务所需的最小数据。

### Main 禁止

- 导入 React、renderer 组件、Zustand store 或浏览器 DOM 代码；
- 把 `BrowserWindow`、Electron event、Node stream、Buffer、Error 实例等对象直接通过 IPC 返回；
- 信任 renderer 传入的路径、URL、配置或任意对象；
- 在 IPC handler 中无限堆积网络、解析、持久化等业务逻辑；复杂逻辑应下沉到 main service；
- 记录认证密码、完整 Authorization 头或其他敏感载荷。

### Main 组织方式

当前 `src/main/api.ts`、`config.ts` 和 `index.ts` 可以保留。只有复杂度实际增长时才演进为：

```text
src/main/
├── index.ts              应用启动与组合根
├── ipc/                  IPC adapter；按领域注册 handler
│   ├── config.ts
│   ├── data.ts
│   └── file.ts
└── services/             不依赖 UI 的业务与基础设施服务
    ├── config.ts
    └── data.ts
```

`index.ts` 应保持为组合入口，不应长期承载各领域的完整实现。

## 4. Preload 与 contextBridge

`src/preload` 是安全适配层，不是第二个业务后端。

### Preload 必须

- 使用 `contextBridge.exposeInMainWorld` 暴露一个小而明确的 API（当前为 `window.api`）；
- 为每个公开操作提供具体方法，如 `getConfig()`、`setConfig(input)`，而不是通用消息转发器；
- 使用 shared 中的契约类型，并保证全局 `Window` 声明与实际 bridge 一致；
- 对事件订阅返回取消订阅函数，并在取消时移除精确的 listener；
- 只传递可结构化克隆的数据。

### Preload 禁止

- 向 renderer 暴露 `ipcRenderer`、`event.sender`、`require`、文件系统、shell 或任意 Electron/Node 对象；
- 暴露 `send(channel: string, ...args)`、`invoke(channel: string, ...args)` 等允许 renderer 自选频道的通用 API；
- 承担 HTTP、CSV 解析、配置合并、缓存或领域决策；
- 允许 renderer 提供任意回调后直接接收完整 Electron event。

安全 API 示例：

```ts
type DesktopApi = {
  getConfig(): Promise<AppConfig>
  setConfig(input: UpdateConfigInput): Promise<AppConfig>
  getCsvs(): Promise<CsvBatch>
  exportCsvs(): Promise<ExportResult>
}
```

新增能力时，应新增命名明确的方法并同步更新 shared 契约与 `env.d.ts`，不得扩展成万能 bridge。

## 5. IPC 契约与错误规则

### 5.1 频道

- 频道名应使用稳定的 `domain:operation` 形式，例如 `config:get`、`config:set`、`data:get`。
- 当频道超过少量或出现多处引用时，应集中到 `src/shared/ipc/` 的只读常量中，避免 main/preload 字符串漂移。
- 请求/响应式操作默认使用 `ipcRenderer.invoke` 与 `ipcMain.handle`。
- 高频单向事件必须有明确订阅/取消订阅 API、生命周期和背压策略；不得默认用 IPC 广播每个原始采样点。
- handler 注册应可追踪且只发生一次；窗口重建不得造成重复注册。

### 5.2 校验

- renderer 传入 main 的每个非空 payload **MUST** 在 main 的 IPC 边界用 Zod schema 解析后再使用。
- 来自 HTTP、磁盘、环境变量和 CSV 的不可信数据 **MUST** 在首次进入受信任领域时校验。
- 重要响应也应按共享 schema 构造或解析，确保运行时值与公开类型一致。
- 禁止用 `as SomeType`、非空断言或仅 TypeScript interface 代替边界校验。

推荐契约形式：

```ts
export const AppConfigSchema = z.object({ /* ... */ })
export type AppConfig = z.infer<typeof AppConfigSchema>
```

schema 是运行时契约和类型来源。若需要区分更新输入与完整输出，应建立两个相关 schema，而不是接受 `Partial<any>`。

### 5.3 错误

- 跨 IPC 错误应归一化为可结构化克隆、可安全展示的对象，如 `{ code, message, details? }`。
- 面向用户的消息与诊断细节应分开；renderer 不应收到堆栈、绝对敏感路径、密码或认证信息。
- 未知错误在 main 记录经过脱敏的上下文，并向 renderer 返回稳定错误码。
- renderer 必须处理拒绝、超时或无效响应，不得假设 IPC 永远成功。

## 6. Renderer

`src/renderer` 是不受信任的浏览器环境，只负责展示、交互、导航和调用 preload 提供的能力。

### Renderer 必须

- 通过 `window.api` 访问桌面能力；
- 把页面/feature 逻辑、可复用业务组件和基础 UI 组件区分开；
- 对异步加载、空数据、错误和重试提供明确 UI 状态；
- 保持组件 props 与 store selector 尽量窄，避免无关全树重渲染；
- 路由采用 React Router v7 Declarative Mode，打包环境默认使用 `HashRouter`。

### Renderer 禁止

- `import 'electron'` 或导入 `node:fs`、`node:path`、`node:child_process`、`node:net` 等 Node API；
- 使用 `require`、`process`、直接文件路径访问或依赖 Node 集成；
- 直接调用 `ipcRenderer`；
- 通过动态频道名绕过 preload 的有限 API；
- 在 UI 组件中保存认证密码、实现文件系统操作或复制 main service 的业务规则。

Electron 窗口必须继续保持 `contextIsolation: true` 与 `nodeIntegration: false`。降低这些安全选项需要独立安全评审，不属于普通 feature 的实现空间。

## 7. Shared 的纯共享约束

`src/shared` 只包含两个或更多运行分区确实需要共享、且可在不同 JavaScript 环境安全执行的内容。

### Shared 可以包含

- Zod schemas 与由其推导的 TypeScript 类型；
- IPC 频道常量和请求/响应契约；
- 领域常量、枚举式 union、默认的纯数据；
- 不访问环境、无副作用的纯转换或格式化函数。

### Shared 禁止包含

- React 组件、hooks、Zustand stores、AG Grid API/组件类型；
- Electron、Node.js 或 DOM 导入；
- 文件系统、网络、localStorage、环境变量或进程访问；
- main service、preload bridge 或 renderer feature 的反向导入；
- 只被单一分区使用、却为了“看起来通用”而提前上移的代码。

允许 `shared` 依赖 Zod，因为它承担纯运行时契约职责；除此之外新增运行时依赖必须谨慎评审。`shared` **MUST** 保持无平台副作用，导入模块不能触发 I/O、注册 handler 或读取环境。

## 8. 状态所有权与数据流

状态应放在最接近其真实所有者的位置：

| 状态类型 | 所有者 |
| --- | --- |
| 窗口、应用生命周期、文件与系统资源 | main |
| 持久化配置 | main；renderer 只持有用于显示/编辑的副本 |
| 单组件输入、展开/关闭、临时选择 | React 本地状态 |
| 跨页面共享的客户端会话/UI 状态 | 按领域拆分的 Zustand store |
| AG Grid API、选择与视图实例状态 | renderer 中的 grid/feature 层 |
| IPC 契约与数据形状 | shared schema |

### Zustand 边界

- 引入 store 前必须证明状态跨越了合理的组件边界；能用 props 或局部 state 清晰表达时不使用 store。
- store 只包含该领域的数据、同步 action 和必要的编排逻辑。
- IPC 调用可由 feature service/hook 编排；不得把所有远程调用统一塞进一个全局 store。
- 禁止把 main 当成 Zustand store 的隐式持久化副本；配置保存成功后再以 main 返回值更新 renderer 状态。
- 派生值优先由 selector/纯函数计算，不重复持久化可推导状态。

## 9. AG Grid 架构规则

- `DataTable` 或后续 grid feature 只存在于 renderer。
- 表格输入应是经过解析和标准化的普通数据；AG Grid 不负责验证不可信 IPC/HTTP 数据。
- 使用稳定、领域唯一的 row ID；高频更新优先 transaction/async transaction，而不是整体替换大型数据集。
- 列定义靠近所属 feature。只有不含 renderer/AG Grid 运行时对象且确需跨分区复用的纯列元数据才能放进 shared。
- cell renderer 应保持轻量，禁止在每个单元格内发 IPC 请求或创建全局订阅。
- Grid API 不得写入 Zustand、shared、IPC payload 或持久化配置。
- 仅使用 AG Grid Community 33 能力；不得无意引用 Enterprise module 或通过第二个表格库绕开限制。

## 10. 渐进式目录演进

当前目录是有效起点，不应为了匹配目标树而一次性搬迁：

```text
src/
├── main/
│   ├── api.ts
│   ├── config.ts
│   └── index.ts
├── preload/
│   └── index.ts
├── renderer/
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── components/
│       ├── env.d.ts
│       ├── main.tsx
│       ├── pages/
│       ├── queries/
│       ├── stores/
│       └── styles.css
└── shared/
    ├── columns.ts
    ├── defaults.ts
    └── types.ts
```

只有出现以下触发条件时才创建新目录：

| 触发条件 | 允许的演进 |
| --- | --- |
| 出现第二个真实页面 | 建立 `renderer/src/pages/` 和集中路由定义 |
| 某领域已有多个组件、hooks 与数据编排 | 建立 `renderer/src/features/<domain>/` |
| 添加第一个 shadcn 基础组件 | 建立 `renderer/src/components/ui/` |
| 出现第一个跨组件共享状态 | 建立 `renderer/src/stores/` 或领域内 store |
| 出现第一个跨组件共享的远程数据查询 | 建立 `renderer/src/queries/` |
| IPC handler 增多且 `main/index.ts` 职责过重 | 建立 `main/ipc/` |
| main 中网络/配置/文件逻辑需要独立测试或复用 | 建立 `main/services/` |
| 引入第一个 Zod 跨边界契约 | 建立 `shared/schemas/` |
| IPC 频道或契约出现多处引用 | 建立 `shared/ipc/` |

禁止预先创建空的 `features`、`hooks`、`services`、`repositories`、`adapters`、`domain`、`infrastructure` 等目录。一次迁移应只移动与当前目标有关的文件，并在每一步保持可构建。

## 11. 功能实现的推荐流程

每个非平凡功能应按以下顺序推进：

1. 阅读 `docs/tech-stack.md`、本文和相关 feature spec；
2. 确认数据所有者、信任边界和依赖方向；
3. 先定义或更新 shared Zod 契约；
4. 在 main service 实现受信任能力；
5. 在 main IPC adapter 校验输入并归一化输出/错误；
6. 在 preload 暴露最小、命名明确的 API；
7. 更新 renderer 的 `Window` 类型声明；
8. 在 renderer 实现 feature、页面与 UI 状态；
9. 对大量表格更新按 AG Grid transaction 模式设计；
10. 按 [`testing.md`](./testing.md) 执行与变更风险相称的自动化验证和必要的人工验收。

任何步骤若需要违反本规范，agent 必须停止扩大实现范围，在 spec 中明确提出冲突、理由和最小例外；不得静默绕过边界。

## 12. 架构验收清单

提交功能或重构前至少确认：

- [ ] renderer 没有新增 Electron/Node 直接访问；
- [ ] preload 没有暴露原始 `ipcRenderer` 或通用频道调用；
- [ ] IPC 输入和外部数据已由 Zod 在正确边界校验；
- [ ] shared 没有平台依赖、副作用或反向依赖；
- [ ] Zustand 只保存有明确所有权的跨组件状态；
- [ ] AG Grid API 未泄漏到 store、shared 或 IPC；
- [ ] 没有引入未批准或职责重复的依赖；
- [ ] 没有无关的基础工具链升级或大规模目录搬迁；
- [ ] 错误可诊断且日志不泄漏敏感信息；
- [ ] `npm run typecheck` 通过；
- [ ] `npm run build` 通过。

# 测试与验收规范

> 状态：项目级长期约束  
> 适用范围：本仓库中的功能开发、缺陷修复、重构、依赖迁移和发布准备  
> 最后更新：2026-08-19

## 1. 目的

本文定义 Electron 项目的长期测试分层、完成门禁、测试数据原则和 feature spec 验收写法。技术版本与依赖引入规则见 [`tech-stack.md`](./tech-stack.md)，进程边界与依赖方向见 [`architecture.md`](./architecture.md)。

本文中的关键词含义如下：

- **MUST / 必须**：不可省略的要求。
- **MUST NOT / 禁止**：不得采用的做法。
- **SHOULD / 应当**：默认做法；偏离时必须记录理由。
- **MAY / 可以**：按风险和需求选择。

测试的目标是为行为、契约和关键集成提供可信证据，不是追求测试数量、快照数量或单一覆盖率百分比。优先覆盖失败代价高、容易回归、仅靠类型无法证明的行为。

## 2. 当前阶段与长期目标

当前仓库已经提供：

```text
npm run typecheck
npm run build
```

当前尚未正式引入 Vitest、React component test 工具链或 Playwright。按照 [`tech-stack.md`](./tech-stack.md)，这些工具及其所需的基础版本升级 **MUST** 通过独立测试/工具链迁移 spec 实施。

因此：

1. 本文定义长期目标态，但不授权 agent 在普通 feature 中自行安装测试依赖或升级 Vite、electron-vite、React、Electron。
2. 在测试迁移完成前，Typecheck 与 Build 是可执行的自动化基础门禁；缺少测试基础设施的风险必须在 Verification 中如实记录，并在适用时补充 Manual Acceptance。
3. 在某一测试层正式落地后，相关功能的新增和修改 **MUST** 按本文将该层纳入完成门禁。
4. Agent **MUST NOT** 虚构测试脚本、测试结果或声称运行了当前仓库不存在的测试命令。

## 3. 测试分层总览

| 层级 | 主要证明内容 | 不负责证明 |
| --- | --- | --- |
| Typecheck | TypeScript 类型、跨分区声明与编译期契约一致 | 运行时数据有效、UI 行为、IPC 真正可用 |
| Build | main/preload/renderer 能由当前工具链完成生产构建 | 打包后的真实启动、用户工作流正确 |
| Unit Test | 纯逻辑、schema、转换和明确边界条件 | React/Electron/AG Grid 的真实集成 |
| React Component Test | 单个组件或小型组件树的可观察 UI 行为 | preload/main、真实 Electron 窗口和 AG Grid 完整行为 |
| Electron E2E | renderer → preload → IPC → main 的真实关键工作流 | 所有细小纯函数边界组合 |
| Visual Regression | 稳定页面状态下的意外视觉变化 | 功能正确性、可访问性和业务语义 |
| Manual Acceptance | 主观体验、物理环境或暂时难以自动化的集成 | 可稳定自动化的回归门禁 |

这些层级互相补充，不应互相替代。Build 通过不能证明应用行为正确；E2E 通过也不能替代快速、精确的纯逻辑单元测试。

## 4. Typecheck 与 Build 基础门禁

### 4.1 Typecheck

凡修改以下内容，agent 在宣布完成前 **MUST** 运行：

```text
npm run typecheck
```

适用范围包括：

- `src/main`、`src/preload`、`src/renderer` 或 `src/shared`；
- TypeScript 配置、全局 `Window`/bridge 声明；
- Zod schema、IPC 请求/响应类型；
- 依赖或类型包变化；
- 生成 TypeScript 产物的构建配置。

Typecheck 失败时，不得以“运行时应该没问题”为由宣布任务完成。若失败确认与本次变更无关，必须提供可复现证据，明确标为既存问题，并说明它是否影响本次验收。

### 4.2 Build

凡修改生产代码、依赖、构建配置、静态资源引用或 Electron 入口，agent 在宣布完成前 **MUST** 运行：

```text
npm run build
```

Build 是 main、preload 和 renderer 的共同基础门禁。它只能证明生产 bundle 可以生成，不能证明 Electron 应用能够启动或关键工作流能够运行。

涉及 `electron-builder.yml`、preload/main 输出路径、打包资源、安装包行为或 Windows 分发时，还 **MUST** 按 feature/migration spec 运行相应的 `npm run dist` 或 `npm run dist:portable` 验证。普通 renderer 样式修改不要求每次生成安装包。

### 4.3 文档例外

仅修改 Markdown 等非执行文档时，可以不运行 Typecheck 和 Build，但必须：

- 检查实际 diff，确认没有生产代码或配置被意外修改；
- 检查相对链接、命令名、文件路径和规范之间是否一致；
- 在完成说明中明确这是 docs-only 变更以及未运行构建的原因。

## 5. Unit Test

### 5.1 适用范围

Unit Test 应用于输入/输出明确、可快速隔离且存在有意义边界条件的逻辑，例如：

- Zod schema 的有效、无效、缺失、边界值和兼容性案例；
- CSV 解析后的规范化、列映射、单位转换、过滤和排序辅助函数；
- 配置默认值合并、迁移与脱敏逻辑；
- URL、请求参数和安全路径规则的构造；
- 错误码映射与可安全展示的错误归一化；
- Zustand store 中不依赖 UI/IPC 的 action 与 selector；
- main service 中可通过自然边界隔离的重试、解析和状态转换逻辑；
- 已修复缺陷的最小回归案例。

### 5.2 不适用范围

Unit Test 不应：

- 重复测试 TypeScript interface、常量赋值或无分支的简单 getter；
- 通过大量 mock 模拟完整 Electron 工作流；
- 测试 React、Electron、Zod 或 AG Grid 自身已经承担的内部行为；
- 用实现细节断言代替可观察结果；
- 为提高覆盖率而调用私有函数、复制生产算法或写没有失败价值的断言。

纯逻辑如果很难测试，应先检查职责是否混杂。可以通过清晰的参数和依赖边界提高可测试性，但不得为测试建立与生产路径不同的第二套实现。

## 6. React Component Test

React Component Test 用于在浏览器式 DOM 环境中验证单个组件或小型组件树的用户可观察行为。

适合验证：

- loading、empty、error、success 等状态切换；
- 按钮、表单、弹窗、导航入口和键盘交互；
- 输入校验、禁用条件与错误提示；
- props 或 store 状态变化后的可见输出；
- 调用 `window.api` 后 UI 对成功/失败结果的处理；
- 具备实际项目定制行为的 shadcn/ui 组合组件。

边界规则：

1. 查询元素应优先使用可访问角色、名称、label 和可见文本；只有缺少稳定语义选择器时才使用 `data-testid`。
2. `window.api` 可以在 component test 中按公开 bridge 接口 mock；禁止 mock `ipcRenderer` 或 Electron 内部实现。
3. 测试应断言用户可见结果和公开回调，不应断言组件内部 state、hook 调用次数或具体 DOM 层级。
4. 不为未修改的 shadcn/ui 基础实现重复编写上游组件测试；只验证项目自己的组合、样式契约和行为。
5. 不使用浅渲染规避真实交互，也不依赖巨大的 DOM snapshot 作为主要断言。
6. AG Grid 的核心交互不以 component test 为主要证据，具体规则见下一节。

Component Test 所需 runner、DOM 环境和 React 测试库必须由独立测试迁移 spec 选定，本文不授权直接安装某个最新版工具。

## 7. Electron + Playwright E2E

Electron E2E 是验证真实进程边界和关键用户旅程的最高价值集成层。测试基础设施落地后，应通过 Playwright 启动真实 Electron 应用，而不是把 renderer 当普通网页替代测试。

### 7.1 适用范围

以下场景应优先或必须具有 Electron E2E：

- `window.api` → preload → IPC → main 的完整调用链；
- 配置读取、编辑、保存、重启后恢复及无效配置处理；
- 本地 CSV 加载、HTTP fixture 数据加载、刷新与错误恢复；
- 文件选择、导出和临时目录中的结果校验；
- 路由导航、核心页面启动状态和关键现场工作流；
- context isolation 下 bridge 可用，同时 Node/Electron 能力未泄漏给 renderer；
- 只有打包/真实 Electron 环境才会出现的行为；
- AG Grid 的关键展示和交互。

### 7.2 E2E 隔离规则

- **MUST NOT** 连接真实生产服务、使用真实凭据、覆盖真实用户配置或操作现场设备。
- 每个测试使用独立临时 `userData`、导出目录和端口；测试结束后清理自身资源。
- HTTP 行为通过本地 deterministic fixture server 提供，不依赖公网可用性。
- 时钟、ID、数据顺序和随机值必须可控制；禁止用任意固定 `sleep` 猜测应用何时完成。
- 等待应基于可观察条件，例如元素状态、特定响应、文件出现或明确的应用 ready 信号。
- 测试之间不得依赖执行顺序或共享可变状态；确因 Electron 资源限制串行执行时，也必须保持单测例可独立重跑。
- selector 优先使用角色、名称和稳定业务语义；不得依赖易变化的 CSS 层级或 AG Grid 自动生成 class 组合。

### 7.3 E2E 不是万能测试

E2E 运行较慢、失败诊断成本较高。纯 schema 边界、数据转换组合和大量输入变体应留在 Unit Test。E2E 应聚焦少量高价值 happy path、关键失败路径与进程边界，不为每个细小条件复制完整用户旅程。

## 8. AG Grid 验证策略

AG Grid 依赖浏览器布局、虚拟化、事件和真实交互。项目对 AG Grid 的关键行为 **SHOULD** 优先通过真实 Electron + Playwright E2E 验证。

E2E 应覆盖与功能相关的代表性行为：

- 确定性 fixture 能生成预期行、列和值格式；
- 排序、过滤、滚动、行选择或分页等实际启用能力；
- 空数据、加载失败和恢复；
- 稳定 row ID 下的 transaction/async transaction 更新；
- 高频更新不会重置用户选择、滚动位置或已批准的视图状态；
- 导出或下游操作使用的是正确数据集。

其他测试层的职责：

- 列定义生成、值格式化和数据规范化等纯函数可以做 Unit Test；
- 包含表格的页面可以在 Component Test 中验证外围 loading/error/toolbar 状态，但不应伪造 AG Grid 内部 DOM 来证明排序或虚拟化；
- 禁止对完整 grid DOM 做大型快照，也禁止复现 AG Grid 内部算法做“对照测试”。

若 Electron E2E 尚未落地，涉及 AG Grid 关键交互的 feature 必须提供精确的 Manual Acceptance 步骤并明确自动化缺口，不得用 Build 或静态截图冒充行为验证。

## 9. Visual Regression Testing

Visual Regression 用于发现稳定 UI 状态下未经预期的布局、主题、间距、截断和样式变化。它是视觉补充门禁，不是功能测试或设计评审的替代品。

### 9.1 适用范围

适合建立基线的对象包括：

- 应用主框架、导航与主题；
- 关键页面在固定数据下的 empty、error 和 populated 状态；
- 对现场可读性重要的密集信息布局；
- 经项目定制的对话框、工具栏和状态栏；
- 少量稳定、代表性的窗口尺寸与缩放组合。

### 9.2 稳定性要求

视觉测试必须固定：

- Electron/OS 执行环境、窗口尺寸、device scale factor 和主题；
- 字体、locale、timezone 和颜色模式；
- fixture 数据、排序、时钟和生成 ID；
- 动画、光标、进度动画和其他瞬态效果。

时间戳、动态计数、光标、随机内容和持续刷新的表格单元格应冻结、遮罩或排除。AG Grid 受字体、虚拟化、canvas/GPU 和滚动位置影响时，只对稳定区域或明确状态截图；关键 grid 行为仍以 Electron E2E 断言为主。

### 9.3 限制与基线管理

- 截图相同不代表功能正确、数据正确或可访问性合格。
- 禁止以宽松像素阈值长期掩盖不稳定测试。
- 基线变更必须是可审阅的显式改动，并说明预期视觉变化；不得在失败后无条件批量更新快照。
- 原生文件对话框、系统窗口装饰和跨机器字体渲染通常不作为像素级基线。
- 高频误报的基线应被修复、缩小范围或删除，而不是让团队习惯忽略失败。

## 10. Deterministic Fixture 与 Mock Data

所有自动化测试默认使用可重复、可解释、无敏感信息的 fixture。

### 10.1 Fixture 原则

- 相同输入在相同环境中必须产生相同结果。
- 固定时钟、时区、随机种子、ID、端口分配策略和数据顺序；不得依赖“当前时间”或不设种子的随机数据。
- fixture 应尽量小、可读，并清楚表达测试意图；大数据/高频场景由带固定种子的 factory 生成，不提交巨型不透明文件。
- 应覆盖正常数据以及与功能相关的空值、边界值、重复 ID、乱序、无效编码、格式错误和部分失败。
- CSV fixture 应明确编码、换行符、表头和预期解析结果。
- 只使用虚构设备、主机、账号和密码；禁止复制生产数据、真实认证头或可识别现场信息。
- 每个测试不得修改共享 fixture；需要变体时复制或由 factory 新建。

推荐组织方式在测试迁移 spec 中最终确定，长期方向如下：

```text
tests/
├── fixtures/       跨测试层复用的只读数据
├── helpers/        仅测试使用的启动与资源管理工具
└── e2e/            Electron E2E

src/**/__tests__/   与模块紧邻的 Unit/Component Test（需要时）
```

### 10.2 Mock 边界

- 在最窄且真实的系统边界 mock：Component Test mock `window.api`；Unit Test mock service 的 I/O adapter；E2E 使用真实 preload/IPC/main 配合本地 fixture server 和临时文件。
- 不要 mock 被测模块本身，也不要用一串互相配合的 mock 复刻完整应用。
- mock 必须符合 shared schema 和公开接口；随意返回不可能存在的对象会制造虚假信心。
- 对错误、超时和取消的 mock 应是确定性的，并允许测试等待明确状态。

## 11. 测试代码不得污染生产逻辑

测试可用性来自清晰架构，而不是在生产代码中埋测试后门。

禁止：

- 在生产路径中加入 `if (test)`、测试专用业务分支或不同算法；
- 为测试关闭 Zod 校验、context isolation、安全路径检查或认证逻辑；
- 向 `window.api`、IPC 或生产类型暴露测试专用方法；
- 为测试导出原本应保持私有且没有合理模块职责的内部状态；
- 在生产 bundle 中包含 fixture、测试凭据、Playwright 控制代码或 mock server；
- 用固定延时、无条件 retry 或吞掉异常来让测试“变绿”。

允许：

- 在自然 I/O 边界注入 clock、ID generator、HTTP client、filesystem adapter 等依赖，前提是生产默认实现明确且设计本身更清晰；
- 使用语义选择器无法稳定定位时添加少量 `data-testid`；它不得暴露权限能力或取代可访问语义；
- 从独立测试入口设置临时 `userData`、fixture server 地址和测试日志级别；这些设置不得改变业务语义或降低安全边界。

测试文件、fixture 和 helper 必须位于测试专用路径或采用测试文件命名，并确保不会意外进入生产产物。

## 12. Agent 完成前的验证责任

Agent 在宣布任务完成前 **MUST** 根据实际 diff 确定验证范围，执行可用门禁，并报告事实结果。

### 12.1 最低验证矩阵

| 变更类型 | 完成前最低验证 |
| --- | --- |
| 仅规范/Markdown | 检查 diff、链接、路径和跨文档一致性；可不运行 Typecheck/Build |
| 任意 TypeScript/TSX 生产代码 | `npm run typecheck` + `npm run build` |
| Unit/Component 覆盖的逻辑或 UI | 基础门禁 + 相关测试文件；测试基础设施支持时运行受影响测试集 |
| preload、IPC、main service、配置/文件能力 | 基础门禁 + 相关 Unit Test + Electron E2E 关键路径 |
| AG Grid 数据与交互 | 基础门禁 + 纯转换 Unit Test + 真实 Electron E2E；暂未落地时执行并记录 Manual Acceptance |
| 样式或布局 | 基础门禁 + 相关交互验证；已有稳定基线时运行 Visual Regression，否则进行精确人工视觉验收 |
| 构建、入口、资源或打包配置 | 基础门禁 + 对应 Electron 启动/打包验证 |
| 缺陷修复 | 能在适当层复现缺陷的回归测试；无法自动化时记录原因和复现/验收步骤 |

### 12.2 执行与报告规则

1. 先运行最接近变更的快速测试，完成修改后再运行全部适用门禁。
2. 测试失败后修改了代码，必须重跑受影响测试；不得引用修改前的成功结果。
3. 不得只写测试而不运行，也不得把“未发现问题”等同于通过。
4. 完成说明必须列出实际运行的命令/检查及结果，并明确列出未运行项和原因。
5. 相关必需门禁失败时不得宣布完成。确认是既存失败时，必须提供证据、影响判断和后续处理建议。
6. 不得为了让本任务通过而修改无关测试、放宽断言、更新无关视觉基线或扩大业务范围。
7. 当前缺少某测试层时，应写“测试基础设施尚未引入”，不能写“无需测试”或假设测试通过。

## 13. Feature Spec 的 Acceptance Criteria

Acceptance Criteria 定义“什么行为算完成”，应面向可观察结果，而不是实现任务清单。

### 13.1 编写规则

每条 Acceptance Criterion **MUST**：

- 使用稳定编号，如 `AC-1`、`AC-2`；
- 描述明确前置状态、用户/系统动作和可观察结果；
- 可以被自动化测试或精确 Manual Acceptance 判定为通过/失败；
- 在相关时覆盖 loading、empty、error、retry、权限、安全和大数据边界；
- 避免“正常工作”“体验良好”“性能足够”等不可判定措辞。

Acceptance Criteria **MUST NOT** 写成：

- “创建 `DevicePage.tsx`”；
- “使用 Zustand”；
- “调用某个内部函数”；
- “添加测试”；
- “代码结构清晰”。

这些属于实现约束或工程任务，不是用户/系统可观察的验收结果。

推荐使用 Given / When / Then，或等价的明确行为句式：

```markdown
## Acceptance Criteria

- AC-1: Given 应用使用确定性的双表 fixture，when 用户打开监控页，then 水表和电表区域分别显示 fixture 中的行数和关键字段。
- AC-2: Given 后端返回不符合 schema 的数据，when 刷新完成，then 页面显示可重试的安全错误信息，且不展示凭据或内部堆栈。
- AC-3: Given 用户已设置排序并选中一行，when 新批次通过 transaction 更新，then 排序和选择保持不变，目标行显示新值。
```

## 14. Feature Spec 的 Verification

Verification 定义“用什么证据证明每条 AC”。它必须与 Acceptance Criteria 分开书写，并建立可追踪映射。

每项 Verification **MUST** 包含：

- 编号和覆盖的 AC；
- 验证层级（Unit、Component、Electron E2E、Visual、Manual、Typecheck/Build）；
- 确定性的 fixture/前置环境；
- 可执行命令或精确步骤；
- 预期结果和需要保留的证据；
- 若暂时无法自动化，明确原因与后续自动化条件。

推荐格式：

```markdown
## Verification

| ID | Covers | Level | Setup / Action | Expected Evidence |
| --- | --- | --- | --- | --- |
| V-1 | AC-1 | Electron E2E | 使用 `dual-meter-basic` fixture 启动临时 Electron 实例并打开监控页 | 两个 grid 的行数与指定单元格断言通过 |
| V-2 | AC-2 | Unit + Electron E2E | schema 测试输入无效响应；E2E fixture server 返回同类响应 | schema 拒绝；UI 显示安全错误与重试按钮 |
| V-3 | AC-3 | Electron E2E | 固定 row ID，先排序/选择，再发送一批确定性更新 | 排序、选择和更新值断言通过 |
| V-4 | all | Gate | 运行 `npm run typecheck` 与 `npm run build` | 两条命令退出码均为 0 |
```

规则：

1. 每条 AC 至少映射到一项 Verification；一项 Verification 可以覆盖多条高度相关的 AC。
2. “运行测试”“人工看看”“build 通过”不能单独证明具体业务 AC。
3. Verification 应指定最小充分层级；不要把所有行为都推到昂贵 E2E，也不要用 Unit Test 冒充进程集成证明。
4. Agent 实施后应在完成说明中报告实际执行结果；feature spec 描述的是要求，不能预先写成已通过。
5. 性能 AC 必须给出数据规模、环境、测量方法和阈值；视觉 AC 必须给出稳定窗口/主题/fixture 或明确的人工判断标准。

## 15. Manual Acceptance

Manual Acceptance 只在自动化不现实、收益暂时不足或需要人类主观判断时使用。

### 15.1 允许场景

- 视觉层级、现场可读性、密集信息布局和交互手感等主观判断；
- Windows 原生文件对话框、系统窗口装饰或特定桌面集成难以稳定自动化的部分；
- 需要真实物联网设备、现场网络或专用硬件的最终联调；
- 安装包、便携版和目标 Windows 环境的一次性发布验收；
- 某测试层尚未通过独立迁移 spec 落地，但当前功能必须前进的过渡期；
- 偶发、昂贵且无法在 CI 安全复现的外部系统兼容性检查。

### 15.2 不允许作为替代的场景

Manual Acceptance **MUST NOT** 替代：

- Typecheck 与 Build 基础门禁；
- 可稳定自动化的纯函数、schema 和回归缺陷；
- 已存在且适用的 Unit、Component 或 E2E 测试；
- 仅因为自动化测试当前失败或编写测试“比较麻烦”的情况。

重复执行且结果客观的 Manual Acceptance 应逐步自动化。相同手工回归若成为常规发布步骤，相关 spec 必须评估将其迁移到 Unit、Component 或 Electron E2E。

### 15.3 手工验收记录

每项手工验收必须记录：

- 覆盖的 AC；
- 未自动化的具体原因；
- OS、应用版本、窗口/显示设置和必要外部环境；
- 使用的确定性 fixture 或明确的设备/数据前置条件；
- 逐步操作与每步期望结果；
- 实际结果及截图、脱敏日志或导出文件等证据；
- 执行人和日期（进入正式发布记录时）。

如果 agent 无法亲自完成需要真实 UI、设备或用户判断的步骤，必须将其标为 **Pending Manual Acceptance**，清楚交给用户执行；在完成说明中不得把它描述为已经验证通过。

## 16. 不稳定测试处理

- 禁止通过增加任意 sleep、无限 retry 或放宽断言掩盖竞态。
- 首先定位不确定来源：时钟、动画、网络、共享目录、端口、随机数、事件订阅或未等待的异步状态。
- retry 只能用于确认和诊断偶发性，不能成为长期正确性的证据。
- 暂时隔离测试必须记录负责人、原因、影响和恢复条件；关键门禁测试不得静默跳过。
- 连续不稳定的视觉基线应缩小截图范围或固定环境；连续不稳定的 E2E 应改进可观察 ready 条件和资源隔离。

## 17. 完成定义

一个任务只有在以下条件都满足时才能宣布完成：

- 实现满足相关 Acceptance Criteria；
- 所有适用且当前可用的自动化门禁通过；
- 必需但尚不可用的验证层已明确记录缺口和 Manual Acceptance；
- 没有为测试降低生产安全边界或引入测试专用业务路径；
- 实际验证命令、结果和未运行项均在完成说明中如实报告；
- 未解决的 Pending Manual Acceptance 不被描述为“已全面验收”。

# 水电表数据面板 (meter-panel)

连接后端水电表采集服务、实时展示两个 CSV 数据表格的 Electron 桌面工具。

## 功能

- 🗂️ **双表格展示**:水表 / 电表两个 Tab,基于 AG Grid,数千行流畅滚动、排序、数字/文本筛选、任意列快速过滤
- 🔍 **只看无值**:一键筛选值列为空(水表累计流量 / 电表电量为空)的表,按钮实时显示无值行数,可与网关/总线过滤叠加使用
- ⏱️ **按时间范围过滤**:当 CSV 带「最近获取时间」列时,表格工具栏出现时间范围选择(日历弹窗,精确到秒),选定区间后只显示该时段内的表,可叠加其他过滤
- 📐 **列与 CSV 逐列一致**:按 CSV 表头严格解析,每行不增不减,顶栏实时显示水/电列数
- 🔌 **双数据来源**(设置中切换):
  - **后端接口**:只请求两个 CSV 接口(您的采集服务),支持自动刷新(默认 60 秒),顶栏显示刷新倒计时
  - **本地内置样例**:直接展示 `resources/meter-data/` 下内置的数据文件,不发起任何网络请求,便于离线演示
- 💾 **导出 CSV**:点击「导出 CSV」——后端模式导出内存中缓存的**最新**数据;本地模式导出内置文件;默认写入桌面(`water_meter.csv` / `power_meter.csv`,带 BOM,Excel 直接打开)
- 🧰 **编码自适应**:CSV 支持 UTF-8(含 BOM)与 GBK,中文不乱码

## 快速开始

需要 **Node.js 18+**(建议 20/22 LTS 或更新)。

### 全新环境完整流程(新电脑 / 办公室机器)

```bash
# 1. 克隆代码(需要 GitHub 访问权限)
git clone <你的仓库地址>
cd meter-panel

# 2. 安装依赖
npm install

# 若 npm 版本 ≥ 11.16, 安装脚本默认被拦截, 需要放行(装完再跑一次下面的命令即可):
npm approve-scripts electron esbuild

# 3. 开发调试(热更新, 改代码自动刷新)
npm run dev

# 4. 验证 + 构建
npm run typecheck
npm run build

# 5. 打包绿色版 exe(单文件免安装, 产物在 dist/)
npm run dist:portable
# 或同时出安装版 + 绿色版:
npm run dist
```

> **国内网络提示**:项目已内置 `.npmrc`(Electron 二进制走 npmmirror 镜像),正常安装即可;若打包阶段下载 NSIS 工具慢,临时加环境变量:
> ```powershell
> $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
> npm run dist:portable
> ```
> 若 `npm install` 时 Electron 二进制下载失败(提示 aborted/ReadError),重跑一次 `npm install` 通常即可恢复(下载是断点续传的)。

启动后会根据已保存的设置选择数据来源:

- **后端接口(默认, 开箱即用)**:默认已填好现场后端地址 `10.148.201.103` 与账号/密码,打包后双击 exe 即可直接看到数据;换后端时再进设置修改
- **本地内置样例**(离线可用,不联网):设置 → 数据来源 → 本地内置样例 → 保存并应用

> 配置保存在本机 `%APPDATA%\meter-panel\app-config.json`(开发版与打包版共用同一目录,已固定)。之前的设置若指向 `127.0.0.1:8787`(旧版模拟服务),会自动迁移为本地内置样例模式;旧版保存的完整 URL 会自动提取出地址,无需手动处理。

## 后端接口(只需一个地址)

面板只使用两个 CSV 接口,**路径与端口固定**。默认已预填现场后端地址与账号/密码,一般用户无需任何配置,双击 exe 即用;仅换后端时才需要改设置:

| 配置项 | 说明 |
|--------|------|
| 后端服务地址 | 例如 `10.148.201.103` 或 `localhost`;端口固定 `8891` |
| 后端认证(可选) | 若接口返回 401,在设置里填写后端账号/密码(HTTP Basic Auth),留空则不发送认证信息 |
| 水表 CSV(自动拼接) | `http://{地址}:8891/kpi/summary/dahua/tcl_water_meters` |
| 电表 CSV(自动拼接) | `http://{地址}:8891/kpi/summary/dahua/tcl_power_meters` |

CSV 约定:

- GET 返回 `text/csv`,首行表头 + UTF-8 BOM(便于 Excel 打开)
- 列名任意、数量任意,面板按表头自动识别列类型(纯数字列自动右对齐、数字筛选/排序)
- 若 CSV 末尾带「最近获取时间」列(表头含 `时间` 或 key 为 `time`),会按时间列展示,不做数值处理——「只看无值」与顶栏有/无数据统计仍以真正的值列(累计流量/电量)为准
- 示例(与水表接口结构一致):
  ```
  表serial,电表地址,网关serial,总线(ch),电量(kWh)
  S1-F10-DB01-1001,1,NS-S1-F11-DBWG04,1,787.98
  ```

请求由面板主进程发出,不受浏览器跨域限制;每轮刷新把最新 CSV 文本缓存在内存,供一键导出。

## 常用命令

```bash
npm run dev        # 开发模式(热更新)
npm run build      # 生产构建(输出到 out/)
npm run start      # 预览生产构建
npm run typecheck  # TypeScript 类型检查
```

## 目录结构

```
src/main/          主进程(窗口、IPC、数据获取与导出)
src/preload/       安全桥接(contextBridge)
src/renderer/      React 界面(AG Grid 表格等)
resources/meter-data/   本地内置样例 CSV(可替换成最新数据)
scripts/           数据分析/诊断脚本(开发用)
```

> 更新本地样例:直接把最新的两个 CSV 复制到 `resources/meter-data/`(文件名保持 `water_meter.csv` / `power_meter.csv`),本地模式即显示最新数据。

## 打包成 exe

```bash
npm run dist            # 同时产出安装版 + 绿色版(产物在 dist/)
npm run dist:portable   # 只要绿色版(单文件免安装)
```

产物(位于 `dist/`):

| 文件 | 说明 |
|------|------|
| `meter-panel-Setup-0.1.0.exe` | 安装版(NSIS 向导,可选安装目录、创建桌面快捷方式) |
| `meter-panel-0.1.0-portable.exe` | 绿色版(单文件,免安装,双击即用) |
| `win-unpacked/` | 解包目录(调试用) |

要点:

- 打包自动包含内置样例 CSV(`resources/meter-data/`)与运行依赖,本地/后端模式在打包版中均可使用
- 应用图标由 `scripts/gen-icon.js` 程序化生成(`npm run icon` 可重新生成),配色与界面一致
- exe 未做代码签名,首次运行 Windows SmartScreen 会提示"未知发布者"——点"更多信息 → 仍要运行"即可;正式分发再考虑购买代码签名证书
- 如需走国内网络打包,已配置镜像于 `.npmrc`,或临时:
  ```powershell
  $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
  $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
  npm run dist
  ```

## 常见问题

- **下载 Electron 慢/失败**:设置镜像后重试
  ```powershell
  $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
  npm install
  ```
- **`npm install` 后 Electron 二进制缺失**(仅 Node 24+ 可能遇到):`node_modules/electron/dist/` 里只有 `LICENSES.chromium.html` 没有 `electron.exe`,原因是 Electron 安装脚本的解压步骤在 Node 24 下静默失败。修复(Windows):
  ```powershell
  # 找到缓存里的 zip(约 115MB)
  $zip = Get-ChildItem "$env:LOCALAPPDATA\electron\Cache\*\.zip" | Select-Object -First 1
  Remove-Item -Recurse node_modules\electron\dist
  Expand-Archive $zip.FullName -DestinationPath node_modules\electron\dist -Force
  Set-Content node_modules\electron\path.txt -NoNewline -Value "electron.exe"
  ```
- **打包阶段 NSIS 工具下载慢/失败**:临时设置镜像环境变量后重跑
  ```powershell
  $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
  npm run dist:portable
  ```
- **连不上后端**:先确认本机可访问接口地址(`curl <地址>`)。若 curl 返回 `401 Unauthorized` 且带 `WWW-Authenticate: Basic` 头,说明服务端开启了 HTTP Basic 认证——在面板「设置」的「后端认证」里填账号密码即可;若 curl 完全无响应/超时,再检查网络与防火墙。面板若报错,错误提示会给出具体地址和原因,把提示发出来即可。
- **打包分发**:需要打包成 exe 时再加 electron-builder(目前未配置)。

## 技术栈

Electron 33 + electron-vite + React 18 + TypeScript + AG Grid 33(Community) + PapaParse + iconv-lite
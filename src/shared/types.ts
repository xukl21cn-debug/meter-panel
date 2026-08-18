/** 面板数据来源 */
export type DataSource = 'local' | 'http'

/** 面板连接后端服务的配置 */
export interface AppConfig {
  /** 数据来源: local=内置样例 CSV, http=请求后端接口 */
  dataSource: DataSource
  /** 后端服务地址(IP 或域名); 端口固定, 请求路径固定, 由应用自动拼接 */
  serverHost: string
  /** 表格自动刷新间隔(秒),仅 http 模式生效 */
  refreshIntervalSec: number
  /** 后端 HTTP Basic 认证用户名(留空则不发送认证头) */
  authUser: string
  /** 后端 HTTP Basic 认证密码(留空则按空密码发送,配合 authUser 使用) */
  authPass: string
}

/** 后端轮询状态(进度控制功能保留未启用,类型备用) */
export interface ApiStatus {
  total: number
  progress: number
  active: number
  serverTime: string
  changedAt?: number
}

/** CSV 表格行 */
export type TableRow = Record<string, string | number>

export interface TableData {
  rows: TableRow[]
  fetchedAt: number
  error: string | null
}

/** 主进程一次性返回两个 CSV 文本 */
export interface CsvBatch {
  /** 水表 CSV 全文 */
  water: string
  /** 电表 CSV 全文 */
  electricity: string
  source: DataSource
  fetchedAt: number
}

/** 导出结果 */
export interface ExportResult {
  dir: string
  /** 导出的文件名列表 */
  files: string[]
}

/** 预加载脚本通过 contextBridge 暴露给渲染进程的 API */
export interface ApiBridge {
  getConfig: () => Promise<AppConfig>
  setConfig: (cfg: AppConfig) => Promise<AppConfig>
  /** 按当前配置获取两个 CSV(本地读文件 / 后端发请求) */
  getCsvs: () => Promise<CsvBatch>
  /** 导出最近一次获取的 CSV 到桌面(或 METER_EXPORT_DIR 指定的目录) */
  exportCsvs: () => Promise<ExportResult>
}
import type { AppConfig } from './types'

/** 后端服务固定端口 */
export const API_PORT = 8891
/** 两个 CSV 接口的固定路径 */
export const WATER_CSV_PATH = '/kpi/summary/dahua/tcl_water_meters'
export const ELECTRICITY_CSV_PATH = '/kpi/summary/dahua/tcl_power_meters'

/** 把用户输入的地址规整成纯主机名(去协议/路径/端口) */
export function normalizeHost(input: string): string {
  let h = (input || '').trim()
  h = h.replace(/^https?:\/\//i, '')
  h = h.split('/')[0]
  h = h.replace(/:\d+$/, '')
  return h
}

export function buildWaterUrl(host: string): string {
  return `http://${normalizeHost(host)}:${API_PORT}${WATER_CSV_PATH}`
}

export function buildElectricityUrl(host: string): string {
  return `http://${normalizeHost(host)}:${API_PORT}${ELECTRICITY_CSV_PATH}`
}

/** 从完整 URL 中提取主机名(旧配置迁移用) */
export function extractHostFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** 默认配置 → 连接真实后端(现场地址),只需一个 IP */
export const DEFAULT_CONFIG: AppConfig = {
  dataSource: 'http',
  serverHost: '10.148.201.103',
  refreshIntervalSec: 60
}

/** 本地内置样例配置(仅离线演示) */
export const LOCAL_CONFIG: AppConfig = {
  dataSource: 'local',
  serverHost: '',
  refreshIntervalSec: 60
}
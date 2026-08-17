import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AppConfig, DataSource } from '../shared/types'
import { DEFAULT_CONFIG, extractHostFromUrl, normalizeHost } from '../shared/defaults'

export { DEFAULT_CONFIG }

function configFilePath(): string {
  return join(app.getPath('userData'), 'app-config.json')
}

function normalizeDataSource(v: unknown): DataSource {
  return v === 'local' || v === 'http' ? v : 'http'
}

/** 仅迁移用的旧字段形状 */
type LegacyConfig = Partial<AppConfig> & {
  waterCsvUrl?: string
  electricityCsvUrl?: string
}

export function loadConfig(): AppConfig {
  try {
    const raw = readFileSync(configFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as LegacyConfig

    // 旧格式迁移:
    // 1) 旧版本保存的是完整 URL -> 提取主机作为 serverHost
    let serverHost =
      typeof parsed.serverHost === 'string' && parsed.serverHost.trim() !== ''
        ? parsed.serverHost
        : parsed.waterCsvUrl
          ? extractHostFromUrl(parsed.waterCsvUrl)
          : DEFAULT_CONFIG.serverHost

    // 2) 旧本地模拟配置(指向 127.0.0.1:8787 且无 dataSource 字段) -> 视为本地内置样例
    let dataSource = normalizeDataSource(parsed.dataSource)
    if (
      parsed.dataSource === undefined &&
      /^https?:\/\/(127\.0\.0\.1|localhost):8787/i.test(parsed.waterCsvUrl ?? '')
    ) {
      dataSource = 'local'
    }

    return {
      dataSource,
      serverHost: normalizeHost(serverHost),
      refreshIntervalSec:
        typeof parsed.refreshIntervalSec === 'number' && parsed.refreshIntervalSec >= 1
          ? parsed.refreshIntervalSec
          : DEFAULT_CONFIG.refreshIntervalSec
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(cfg: AppConfig): AppConfig {
  const file = configFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8')
  return cfg
}
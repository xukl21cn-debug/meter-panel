import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Papa from 'papaparse'
import type { AppConfig, TableRow } from '../../../shared/types'

/** 单个页面的数据查询结果: 解析后的两个表 + 原始批次元信息 */
export interface MeterData {
  waterRows: TableRow[]
  elecRows: TableRow[]
}

/** 严格按 CSV 表头解析:每行只保留表头里有的列(缺的补空字符串),与源文件列完全一致 */
function parseCsv(text: string): TableRow[] {
  const result = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true })
  const header = result.meta.fields ?? []
  return result.data.map((row, i) => {
    const out: TableRow = { _idx: i }
    for (const k of header) out[k] = row[k] ?? ''
    return out
  })
}

/** 拉取并解析两个 CSV(由 React Query 调度,失败时保留上次成功数据) */
export async function fetchMeterData(config: AppConfig): Promise<MeterData> {
  const batch = await window.api.getCsvs()
  const data: MeterData = {
    waterRows: parseCsv(batch.water),
    elecRows: parseCsv(batch.electricity)
  }
  console.log(`[fetchMeterData] ok source=${batch.source} water=${data.waterRows.length} electricity=${data.elecRows.length}`)
  return data
}

/** 查询键: 配置决定数据源(本地/后端地址), 变化时自动重拉 */
export function meterQueryKey(config: AppConfig | null): string[] {
  return ['meter-data', config?.dataSource ?? 'none', config?.serverHost ?? '']
}

export function useMeterData(config: AppConfig | null, autoRefresh: boolean) {
  const httpMode = config?.dataSource === 'http'

  return useQuery({
    queryKey: meterQueryKey(config),
    queryFn: () => fetchMeterData(config!),
    enabled: !!config,
    // 轮询: 仅 http 模式且开启自动刷新时每 refreshIntervalSec 重拉一次
    refetchInterval: httpMode && autoRefresh ? Math.max(1, (config?.refreshIntervalSec ?? 60) * 1000) : false,
    // 窗口最小化/被完全遮挡时也继续轮询(默认会跳过, 导致面板在后台不再更新)
    refetchIntervalInBackground: true,
    // 切换数据源/后端地址时沿用上一份数据, 避免表格先闪成空态
    placeholderData: keepPreviousData,
    staleTime: 0,
    // 失败不自动重试(与现状一致: 等下一个轮询周期再拉)
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  })
}

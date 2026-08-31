import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AppConfig, TableRow } from '../../../shared/types'
import { API_PORT, normalizeHost } from '../../../shared/defaults'
import { findValueColumn } from '../../../shared/columns'
import { meterQueryKey, useMeterData } from '../query/meterData'
import DataTable from '../components/DataTable'
import StatusBar from '../components/StatusBar'
import SettingsModal from '../components/SettingsModal'

interface Props {
  config: AppConfig | null
  onConfigSaved: (cfg: AppConfig) => void
}

export default function MeterPage({ config, onConfigSaved }: Props) {
  const queryClient = useQueryClient()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'water' | 'electricity'>('water')
  const [notice, setNotice] = useState<string | null>(null)
  // 网关/总线过滤状态按水/电分别保存(修复: 切换 Tab 时不再串用另一张表的过滤值)
  const [gwFilter, setGwFilter] = useState<Record<'water' | 'electricity', string>>({ water: '', electricity: '' })
  const [busFilter, setBusFilter] = useState<Record<'water' | 'electricity', string>>({ water: '', electricity: '' })
  // 「只看无值」开关也按水/电分别保存
  const [noValueOnly, setNoValueOnly] = useState<Record<'water' | 'electricity', boolean>>({ water: false, electricity: false })

  // 数据: React Query 统一管理拉取/轮询/失败, 失败时保留上次成功数据
  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useMeterData(config, autoRefresh)
  const waterRows = data?.waterRows ?? []
  const elecRows = data?.elecRows ?? []

  // 去掉 IPC 包装前缀,只保留可读的错误信息
  const cleanErrMsg = (err: unknown): string => {
    let msg = err instanceof Error ? err.message : String(err)
    msg = msg.replace(/^Error invoking remote method '[^']+':\s*/, '')
    msg = msg.replace(/^Error:\s*/, '')
    return msg
  }

  // 失败时弹出错误通知(保留表格旧数据; 成功刷新后自动消失)
  const lastErrorMsg = isError ? cleanErrMsg(error) : null
  useEffect(() => {
    if (lastErrorMsg) setNotice(`数据获取失败: ${lastErrorMsg}`)
  }, [lastErrorMsg])

  // 手动刷新按钮
  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  // 通知自动消失(与原有行为一致: 错误/成功通知都 6 秒后消失)
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(id)
  }, [notice])

  // 自动刷新倒计时(每秒一跳; 仅后端模式且开启自动刷新时显示)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!config || config.dataSource !== 'http' || !autoRefresh) return
    // 重新开启/配置变化时立即对齐当前时间, 避免用陈旧的 now 算出虚高的倒计时
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [config, autoRefresh])
  const intervalMs = Math.max(1, config?.refreshIntervalSec ?? 60) * 1000
  const countdownSec =
    config && config.dataSource === 'http' && autoRefresh
      ? Math.min(
          Math.max(1, Math.round(intervalMs / 1000)),
          Math.max(0, Math.ceil((dataUpdatedAt + intervalMs - now) / 1000))
        )
      : null

  const exportCsvs = useCallback(async () => {
    if (!config) return
    setExporting(true)
    try {
      const result = await window.api.exportCsvs()
      setNotice(`已导出 ${result.files.join('、')} 到: ${result.dir}`)
    } catch (err) {
      setNotice(`导出失败: ${cleanErrMsg(err)}`)
    } finally {
      setExporting(false)
    }
  }, [config])

  const saveConfig = useCallback(
    async (cfg: AppConfig) => {
      const saved = await window.api.setConfig(cfg)
      onConfigSaved(saved)
      setShowSettings(false)
      setNotice('配置已保存并应用')
      // 失效当前/新增 key 的缓存: 配置不变时(如仅改密码)也强制重拉;
      // 配置改变时 queryKey 变化, 新 key 自动拉取, 旧 key 缓存被失效也不会重复拉
      await queryClient.invalidateQueries({ queryKey: meterQueryKey(saved) })
    },
    [onConfigSaved, queryClient]
  )

  // 数据来源标签
  const sourceLabel = useMemo(() => {
    if (!config) return ''
    if (config.dataSource === 'local') return '本地内置样例'
    const host = normalizeHost(config.serverHost)
    return host ? `${host}:${API_PORT}` : '后端接口'
  }, [config])

  const lastRefresh = dataUpdatedAt
  const noticeError = notice?.startsWith('数据获取失败') || notice?.startsWith('导出失败')

  // 统计每个表值列(电量/累计流量)有数据/无数据的行数; 时间列不算值列
  const countHasData = (rows: TableRow[]) => {
    if (rows.length === 0) return { has: 0, empty: 0 }
    const valueCol = findValueColumn(rows)
    if (!valueCol) return { has: 0, empty: rows.length }
    let has = 0
    let empty = 0
    for (const r of rows) {
      const v = r[valueCol]
      if (v === '' || v === undefined || v === null) empty++
      else has++
    }
    return { has, empty }
  }
  const waterData = countHasData(waterRows)
  const elecData = countHasData(elecRows)

  return (
    <div className="meter-page">
      <StatusBar
        source={sourceLabel}
        waterCount={waterRows.length}
        elecCount={elecRows.length}
        waterHas={waterData.has}
        waterEmpty={waterData.empty}
        elecHas={elecData.has}
        elecEmpty={elecData.empty}
        lastRefresh={lastRefresh}
        busy={isFetching}
        exporting={exporting}
        autoRefresh={autoRefresh}
        autoRefreshAvailable={config?.dataSource === 'http'}
        countdownSec={countdownSec}
        onToggleAuto={() => setAutoRefresh((v) => !v)}
        onRefresh={handleRefresh}
        onExport={() => exportCsvs()}
        onOpenSettings={() => setShowSettings(true)}
      />

      {notice && <div className={`notice ${noticeError ? 'error' : ''}`}>{notice}</div>}

      <main className="tabs">
        <div className="tabbar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'water'}
            className={`tab ${activeTab === 'water' ? 'active' : ''}`}
            onClick={() => setActiveTab('water')}
          >
            水表 <span className="tab-count">{waterRows.length.toLocaleString()}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'electricity'}
            className={`tab ${activeTab === 'electricity' ? 'active' : ''}`}
            onClick={() => setActiveTab('electricity')}
          >
            电表 <span className="tab-count">{elecRows.length.toLocaleString()}</span>
          </button>
        </div>
        <div className="tabpanel" role="tabpanel">
          <DataTable
            key={activeTab}
            rows={activeTab === 'water' ? waterRows : elecRows}
            gwFilter={gwFilter[activeTab]}
            busFilter={busFilter[activeTab]}
            noValueOnly={noValueOnly[activeTab]}
            onGwFilterChange={(v) => setGwFilter((p) => ({ ...p, [activeTab]: v }))}
            onBusFilterChange={(v) => setBusFilter((p) => ({ ...p, [activeTab]: v }))}
            onNoValueOnlyChange={(v) => setNoValueOnly((p) => ({ ...p, [activeTab]: v }))}
            emptyText="暂无数据 · 请在设置里选择数据来源(本地内置样例 / 后端接口)"
          />
        </div>
      </main>

      {showSettings && config && (
        <SettingsModal config={config} onClose={() => setShowSettings(false)} onSave={saveConfig} />
      )}
    </div>
  )
}

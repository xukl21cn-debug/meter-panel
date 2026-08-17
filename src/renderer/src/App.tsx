import { useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import type { AppConfig, TableData, TableRow } from '../../shared/types'
import { API_PORT, normalizeHost } from '../../shared/defaults'
import DataTable from './components/DataTable'
import SettingsModal from './components/SettingsModal'
import StatusBar from './components/StatusBar'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [water, setWater] = useState<TableData>({ rows: [], fetchedAt: 0, error: null })
  const [elec, setElec] = useState<TableData>({ rows: [], fetchedAt: 0, error: null })
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  // 自动刷新倒计时的基准: 最近一次成功刷新时刻
  const [lastFetchAt, setLastFetchAt] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'water' | 'electricity'>('water')
  const [notice, setNotice] = useState<string | null>(null)
  // 网关/总线过滤状态按水/电分别保存(修复: 切换 Tab 时不再串用另一张表的过滤值)
  const [gwFilter, setGwFilter] = useState<Record<'water' | 'electricity', string>>({ water: '', electricity: '' })
  const [busFilter, setBusFilter] = useState<Record<'water' | 'electricity', string>>({ water: '', electricity: '' })

  useEffect(() => {
    window.api.getConfig().then(setConfig)
  }, [])

  /**
   * 严格按 CSV 表头解析:每行只保留表头里有的列(缺的补空字符串),
   * 不多不少,与源文件列完全一致。
   */
  const parseCsv = useCallback((text: string): TableRow[] => {
    const result = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true })
    const header = result.meta.fields ?? []
    return result.data.map((row, i) => {
      const out: TableRow = { _idx: i }
      for (const k of header) out[k] = row[k] ?? ''
      return out
    })
  }, [])

  const fetchTables = useCallback(async () => {
    if (!config) return
    setBusy(true)
    try {
      const batch = await window.api.getCsvs()
      setLastFetchAt(Date.now())
      setWater({ rows: parseCsv(batch.water), fetchedAt: batch.fetchedAt, error: null })
      setElec({ rows: parseCsv(batch.electricity), fetchedAt: batch.fetchedAt, error: null })
      console.log(`[fetchTables] ok source=${batch.source} water=${batch.water.trim().split('\n').length - 1} electricity=${batch.electricity.trim().split('\n').length - 1}`)
    } catch (err) {
      const msg = cleanErrMsg(err)
      console.error('[fetchTables] 拉取数据失败:', msg)
      setWater({ rows: [], fetchedAt: 0, error: msg })
      setElec({ rows: [], fetchedAt: 0, error: msg })
      setNotice(`数据获取失败: ${msg}`)
    } finally {
      setBusy(false)
    }
  }, [config, parseCsv])

  // 首次加载 + 配置变化时立即拉取;只有 http 模式做定时自动刷新
  useEffect(() => {
    if (!config) return
    fetchTables()
    if (config.dataSource !== 'http') return
    if (!autoRefresh) return
    const id = window.setInterval(fetchTables, Math.max(1, config.refreshIntervalSec) * 1000)
    return () => window.clearInterval(id)
  }, [config, autoRefresh, fetchTables])

  // 通知自动消失
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
          Math.max(0, Math.ceil((lastFetchAt + intervalMs - now) / 1000))
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
      setConfig(saved)
      setShowSettings(false)
      setNotice('配置已保存并应用')
      await fetchTables()
    },
    [fetchTables]
  )

  // 数据来源标签
  const sourceLabel = useMemo(() => {
    if (!config) return ''
    if (config.dataSource === 'local') return '本地内置样例'
    const host = normalizeHost(config.serverHost)
    return host ? `${host}:${API_PORT}` : '后端接口'
  }, [config])

  const lastRefresh = Math.max(water.fetchedAt, elec.fetchedAt)
  const noticeError = notice?.startsWith('数据获取失败') || notice?.startsWith('导出失败')

  // 统计每个表最后一个值列(电量/累计流量)有数据/无数据的行数
  const countHasData = (rows: TableRow[]) => {
    if (rows.length === 0) return { has: 0, empty: 0 }
    const keys = Object.keys(rows[0]).filter((k) => k !== '_idx')
    const valueCol = keys[keys.length - 1]
    let has = 0
    let empty = 0
    for (const r of rows) {
      const v = r[valueCol]
      if (v === '' || v === undefined || v === null) empty++
      else has++
    }
    return { has, empty }
  }
  const waterData = countHasData(water.rows)
  const elecData = countHasData(elec.rows)

  // 去掉 IPC 包装前缀,只保留可读的错误信息
  const cleanErrMsg = (err: unknown): string => {
    let msg = err instanceof Error ? err.message : String(err)
    msg = msg.replace(/^Error invoking remote method '[^']+':\s*/, '')
    msg = msg.replace(/^Error:\s*/, '')
    return msg
  }

  return (
    <div className="app">
      <StatusBar
        source={sourceLabel}
        waterCount={water.rows.length}
        elecCount={elec.rows.length}
        waterHas={waterData.has}
        waterEmpty={waterData.empty}
        elecHas={elecData.has}
        elecEmpty={elecData.empty}
        lastRefresh={lastRefresh}
        busy={busy}
        exporting={exporting}
        autoRefresh={autoRefresh}
        autoRefreshAvailable={config?.dataSource === 'http'}
        countdownSec={countdownSec}
        onToggleAuto={() => setAutoRefresh((v) => !v)}
        onRefresh={() => fetchTables()}
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
            水表 <span className="tab-count">{water.rows.length.toLocaleString()}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'electricity'}
            className={`tab ${activeTab === 'electricity' ? 'active' : ''}`}
            onClick={() => setActiveTab('electricity')}
          >
            电表 <span className="tab-count">{elec.rows.length.toLocaleString()}</span>
          </button>
        </div>
        <div className="tabpanel" role="tabpanel">
          <DataTable
            key={activeTab}
            rows={activeTab === 'water' ? water.rows : elec.rows}
            gwFilter={gwFilter[activeTab]}
            busFilter={busFilter[activeTab]}
            onGwFilterChange={(v) => setGwFilter((p) => ({ ...p, [activeTab]: v }))}
            onBusFilterChange={(v) => setBusFilter((p) => ({ ...p, [activeTab]: v }))}
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
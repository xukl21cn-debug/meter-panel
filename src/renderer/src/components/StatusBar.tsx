interface Props {
  /** 数据来源标签(本地内置样例 / 后端接口地址) */
  source: string
  waterCount: number
  elecCount: number
  /** 水表: 值列(累计流量)有数据 / 无数据的行数 */
  waterHas: number
  waterEmpty: number
  /** 电表: 值列(电量)有数据 / 无数据的行数 */
  elecHas: number
  elecEmpty: number
  lastRefresh: number
  busy: boolean
  exporting: boolean
  autoRefresh: boolean
  /** 仅在 http 模式下提供自动刷新开关 */
  autoRefreshAvailable: boolean
  /** 距离下次自动刷新的秒数; 未开启/本地模式时为 null(不显示) */
  countdownSec: number | null
  onToggleAuto: () => void
  onRefresh: () => void
  onExport: () => void
  onOpenSettings: () => void
}

function fmtClock(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString('zh-CN', { hour12: false })
}

export default function StatusBar(props: Props) {
  const {
    source,
    waterCount,
    elecCount,
    waterHas,
    waterEmpty,
    elecHas,
    elecEmpty,
    lastRefresh,
    busy,
    exporting,
    autoRefresh,
    autoRefreshAvailable,
    countdownSec,
    onToggleAuto,
    onRefresh,
    onExport,
    onOpenSettings
  } = props

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand">
          <svg className="brand-mark" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M2 13h4l2.5-7 5 11 2.5-7H22" />
            <path d="M2 19h20" />
          </svg>
          <div>
            <h1>水电表数据面板</h1>
            <div className="brand-sub">METER TELEMETRY</div>
          </div>
          <span className="host-tag" title="数据来源">{source || '未配置'}</span>
        </div>

        <div className="header-right">
          <button className="btn accent" onClick={onExport} disabled={busy || exporting}>
            {exporting ? '导出中…' : '导出 CSV'}
          </button>
          <button className="btn" onClick={onRefresh} disabled={busy}>
            {busy ? '刷新中…' : '立即刷新'}
          </button>
          {autoRefreshAvailable && (
            <label className="switch">
              <input type="checkbox" checked={autoRefresh} onChange={onToggleAuto} />
              <span className="switch-track"><span className="switch-thumb" /></span>
              <span className="switch-label">自动刷新</span>
            </label>
          )}
          {countdownSec !== null && (
            <span className="countdown" title="距下次自动刷新">{countdownSec}s</span>
          )}
          <button className="btn ghost" onClick={onOpenSettings}>设置</button>
        </div>
      </div>

      <div className="readout-strip">
        <div className="readout">
          <span className="label">表格行数(水/电)</span>
          <span className="value">{waterCount.toLocaleString()} / {elecCount.toLocaleString()}</span>
        </div>
        <div className="readout">
          <span className="label">水表有/无数据</span>
          <span className="value amber" title="值列(累计流量)有数据 / 无数据的行数">{waterHas.toLocaleString()} / {waterEmpty.toLocaleString()}</span>
        </div>
        <div className="readout">
          <span className="label">电表有/无数据</span>
          <span className="value amber" title="值列(电量)有数据 / 无数据的行数">{elecHas.toLocaleString()} / {elecEmpty.toLocaleString()}</span>
        </div>
        <div className="readout">
          <span className="label">最近刷新</span>
          <span className="value">{fmtClock(lastRefresh)}</span>
        </div>
      </div>
    </header>
  )
}
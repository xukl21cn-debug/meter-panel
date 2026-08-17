import { useEffect, useRef, useState } from 'react'
import type { ApiStatus } from '../../../shared/types'

interface Props {
  status: ApiStatus | null
  /** 后端是否提供了状态/进度接口;false 时控件禁用并给出提示 */
  available: boolean
  onApply: (pct: number) => void
  disabled?: boolean
}

const QUICK = [10, 30, 50, 70, 100]
const SEGMENTS = 40
const NOT_AVAILABLE_HINT =
  '后端尚未提供轮询进度接口。数据表当前显示全量数据;后端实现 /kpi/summary/status 与 /kpi/summary/progress 后(见 README 接口契约),在"设置"里填入地址即可启用。'

export default function ProgressControl({ status, available, onApply, disabled }: Props) {
  const [draft, setDraft] = useState(50)
  const timer = useRef<number | undefined>(undefined)

  const percent = status ? Math.round(status.progress) : 0

  useEffect(() => {
    if (status) setDraft(Math.round(status.progress))
  }, [status])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const slide = (v: number) => {
    setDraft(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onApply(v), 200)
  }

  const lit = available ? Math.max(0, Math.min(SEGMENTS, Math.round((percent / 100) * SEGMENTS))) : 0
  const complete = available && percent >= 100
  const locked = !available || disabled

  return (
    <section className="card progress">
      <div className="progress-head">
        <div>
          <div className="label">轮询进度控制(扫掠范围)</div>
          <div className="value">
            {available ? (
              <>
                {percent}%
                <span className="muted-inline">
                  {' '}
                  · 约 {status ? status.active.toLocaleString() : '—'} / {status ? status.total.toLocaleString() : '—'} 表
                </span>
              </>
            ) : (
              <span className="muted-inline">当前不可用 · 数据表显示全量数据</span>
            )}
          </div>
        </div>
        <div className="quick-btns">
          {QUICK.map((q) => (
            <button
              key={q}
              className={`btn accent ${percent === q ? 'active' : ''}`}
              disabled={locked}
              onClick={() => onApply(q)}
            >
              {q}%
            </button>
          ))}
        </div>
      </div>

      <div
        className={`gauge ${complete ? 'complete' : ''} ${!available ? 'gauge-locked' : ''}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={available ? percent : 0}
        aria-label="轮询进度"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={`seg ${i < lit ? 'on' : ''}`} />
        ))}
      </div>

      <div className="progress-controls">
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={available ? draft : 0}
          disabled={locked}
          onChange={(e) => slide(Number(e.target.value))}
        />
        <input
          type="number"
          className="num-input"
          min={1}
          max={100}
          value={available ? draft : 0}
          disabled={locked}
          onChange={(e) => setDraft(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
        />
        <span className="unit">%</span>
        <button className="btn primary" disabled={locked} onClick={() => onApply(draft)}>
          调整进度
        </button>
      </div>
      <p className={`hint ${!available ? 'hint-warn' : ''}`}>{available ? '提示:调整后后端只轮询前 N% 的表,表格行数与数值会立即变化。' : NOT_AVAILABLE_HINT}</p>
    </section>
  )
}
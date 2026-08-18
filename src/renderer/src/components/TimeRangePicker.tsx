import { useEffect, useRef, useState } from 'react'
import DateTimeRangePicker from '@wojtekmaj/react-datetimerange-picker'
import '@wojtekmaj/react-datetimerange-picker/dist/DateTimeRangePicker.css'
import 'react-calendar/dist/Calendar.css'
import 'react-clock/dist/Clock.css'

/** 时间范围: [开始, 结束] */
export type TimeRange = [Date, Date]

/** 格式化为 20xx-xx-xx xx:xx:xx, 与组件展示/CSV 时间列对齐 */
export function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

interface Props {
  /** 当前选中的时间区间; null = 未选择 */
  value: TimeRange | null
  /** 选择/清除回调 */
  onChange: (v: TimeRange | null) => void
  /** 未选择时按钮上显示的文案 */
  placeholder?: string
}

/**
 * 时间范围选择组件: 按钮显示 20xx-xx-xx xx:xx:xx ~ 20yy-yy-yy yy:yy:yy,
 * 点击弹出双日历 + 时分秒面板, 点组件外或「关闭」收起, 「清除」清空。
 */
export default function TimeRangePicker({ value, onChange, placeholder = '选择时间范围' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击组件外部 → 收起
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const label = value ? `${formatDateTime(value[0])}  ~  ${formatDateTime(value[1])}` : placeholder

  return (
    <div className={`time-range-picker${value ? ' has-value' : ''}`} ref={rootRef}>
      <button type="button" className="btn time-range-btn" title="选择时间范围" onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {value && (
        <button type="button" className="btn time-range-clear" title="清除时间范围" onClick={() => onChange(null)}>
          ✕
        </button>
      )}
      {open && (
        <div className="time-range-pop">
          <DateTimeRangePicker
            value={value}
            onChange={(v) => {
              if (Array.isArray(v) && v[0] instanceof Date && v[1] instanceof Date) onChange([v[0], v[1]])
              else onChange(null)
            }}
            format="y-MM-dd HH:mm:ss"
            maxDetail="second"
            locale="zh-CN"
            isCalendarOpen={open}
            clearIcon={null}
            calendarIcon={null}
          />
          <div className="time-range-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              清除
            </button>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

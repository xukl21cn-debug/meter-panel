import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GetRowIdParams, GridApi, GridReadyEvent } from 'ag-grid-community'
import type { TableRow } from '../../../shared/types'
import { findValueColumn, isTimeColumnKey } from '../../../shared/columns'

interface Props {
  rows: TableRow[]
  /** 按网关过滤的值(由父组件按水/电分别保存) */
  gwFilter: string
  /** 按总线过滤的值 */
  busFilter: string
  /** 只看无值: 仅显示值列为空的表 */
  noValueOnly: boolean
  onGwFilterChange: (v: string) => void
  onBusFilterChange: (v: string) => void
  onNoValueOnlyChange: (v: boolean) => void
  emptyText?: string
}

const NUMERIC_RE = /^-?\d+(\.\d+)?$/

/** 采样判断列是否数值型(用于对齐/数字筛选/数值排序) */
function isNumericColumn(rows: TableRow[], key: string): boolean {
  let num = 0
  let seen = 0
  for (const r of rows) {
    const v = r[key]
    if (v === undefined || v === null || v === '') continue
    seen++
    if (typeof v === 'number' || NUMERIC_RE.test(String(v).trim())) num++
    if (seen >= 80) break
  }
  return seen >= 3 && num >= Math.max(3, Math.ceil(seen * 0.6))
}

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr))
}

export default function DataTable({
  rows,
  gwFilter,
  busFilter,
  noValueOnly,
  onGwFilterChange,
  onBusFilterChange,
  onNoValueOnlyChange,
  emptyText = '暂无数据'
}: Props) {
  const [api, setApi] = useState<GridApi | null>(null)
  const [search, setSearch] = useState('')

  // 从表头动态识别网关/总线段(水表/电表表头均含这两列; 缺列时自动隐藏下拉)
  const headerKeys = useMemo(() => (rows.length ? Object.keys(rows[0]).filter((k) => k !== '_idx') : []), [rows])
  const gwKey = useMemo(() => headerKeys.find((k) => k.includes('网关')), [headerKeys])
  const busKey = useMemo(() => headerKeys.find((k) => k.includes('总线')), [headerKeys])

  const gwOptions = useMemo(
    () => (gwKey ? unique(rows.map((r) => String(r[gwKey])).filter(Boolean)).sort() : []),
    [rows, gwKey]
  )
  const busOptions = useMemo(
    () => (busKey ? unique(rows.map((r) => String(r[busKey])).filter(Boolean)).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)) : []),
    [rows, busKey]
  )

  // 值列: 每行最后一个非序号列(水表=累计流量, 电表=电量); 无值=该列为空
  // 值列: 最后一个非时间列(水表=累计流量, 电表=电量); 时间列(如「最近获取时间」)仅作展示
  const valueKey = useMemo(() => findValueColumn(rows), [rows])
  const isNoValue = useCallback(
    (r: TableRow) => {
      if (!valueKey) return false
      const v = r[valueKey]
      return v === '' || v === undefined || v === null
    },
    [valueKey]
  )
  const noValueCount = useMemo(() => (valueKey ? rows.filter(isNoValue).length : 0), [rows, valueKey, isNoValue])

  // 工具条过滤(网关/总线/只看无值, 与快速过滤叠加生效)
  const filteredRows = useMemo(() => {
    let out = rows
    if (gwFilter) out = out.filter((r) => gwKey != null && String(r[gwKey]) === gwFilter)
    if (busFilter) out = out.filter((r) => busKey != null && String(r[busKey]) === busFilter)
    if (noValueOnly) out = out.filter(isNoValue)
    return out
  }, [rows, gwFilter, busFilter, gwKey, busKey, noValueOnly, isNoValue])

  const colDefs = useMemo<ColDef[]>(() => {
    if (rows.length === 0) return []
    const keys = Object.keys(rows[0]).filter((k) => k !== '_idx')
    return keys.map((k) => {
      // 时间列按文本列处理(不右对齐、不用数字筛选), 避免把时间串当数字
      const numeric = !isTimeColumnKey(k) && isNumericColumn(rows, k)
      const def: ColDef = {
        field: k,
        headerName: k,
        sortable: true,
        resizable: true,
        /** 弹性拉伸: 窗口宽时各列等比例撑满; 容器宽度低于各列最小宽度之和时出现横向滚动条 */
        flex: 1,
        /** 文本列(表号/地址/网关等)给更大的下限, 数值列可以窄一些 */
        minWidth: numeric ? 110 : 170,
        filter: numeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
        cellStyle: numeric ? { textAlign: 'right' } : undefined
      }
      if (numeric) {
        def.comparator = (a, b) => {
          const x = a === null || a === '' || a === undefined ? Number.NEGATIVE_INFINITY : Number(a)
          const y = b === null || b === '' || b === undefined ? Number.NEGATIVE_INFINITY : Number(b)
          return x === y ? 0 : x > y ? 1 : -1
        }
      }
      return def
    })
  }, [rows])

  const firstKey = colDefs[0]?.field ?? '_idx'

  const getRowId = useMemo(
    () => (params: GetRowIdParams<TableRow>) => String(params.data[firstKey] ?? params.data._idx),
    [firstKey]
  )

  useEffect(() => {
    if (api) api.setGridOption('quickFilterText', search)
  }, [api, search])

  if (rows.length === 0) {
    return <div className="empty-state">{emptyText}</div>
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <span className="row-count">
          共 {filteredRows.length.toLocaleString()} 行
          {filteredRows.length !== rows.length && <> / 总 {rows.length.toLocaleString()} 行</>}
        </span>
        <input
          className="quick-filter"
          type="search"
          placeholder="快速过滤 · 支持任意列"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {gwKey && (
          <select
            className="toolbar-select"
            value={gwFilter}
            title="按网关过滤"
            aria-label="按网关过滤"
            onChange={(e) => onGwFilterChange(e.target.value)}
          >
            <option value="">全部网关</option>
            {gwOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
        {busKey && (
          <select
            className="toolbar-select"
            value={busFilter}
            title="按总线过滤"
            aria-label="按总线过滤"
            onChange={(e) => onBusFilterChange(e.target.value)}
          >
            <option value="">全部总线</option>
            {busOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
        {valueKey && (
          <button
            className={`btn toolbar-btn${noValueOnly ? ' active' : ''}`}
            title={`仅显示「${valueKey}」为空的表(当前无值 ${noValueCount.toLocaleString()} 行)`}
            aria-pressed={noValueOnly}
            onClick={() => onNoValueOnlyChange(!noValueOnly)}
          >
            只看无值
            {noValueCount > 0 && <span className="toolbar-badge">{noValueCount.toLocaleString()}</span>}
          </button>
        )}
      </div>
      <div className="grid ag-theme-quartz">
        <AgGridReact
          rowData={filteredRows}
          columnDefs={colDefs}
          getRowId={getRowId}
          theme="legacy"
          enableCellTextSelection={true}
          animateRows
          rowBuffer={5}
          defaultColDef={{ minWidth: 90, resizable: true }}
          onGridReady={(e: GridReadyEvent) => setApi(e.api)}
        />
      </div>
    </div>
  )
}
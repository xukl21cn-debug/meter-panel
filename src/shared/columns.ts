import type { TableRow } from './types'

/**
 * 时间列识别: key 为 time 或表头含「时间」(如「最近获取时间」)。
 * 时间列正常展示/排序/过滤, 但不算作「值列」, 不参与有/无数据统计与「只看无值」。
 */
export function isTimeColumnKey(k: string): boolean {
  return k === 'time' || k.includes('时间')
}

/**
 * 值列 = 最后一个非时间列(水表=累计流量, 电表=电量)。
 * 后端若在 CSV 末尾追加「最近获取时间」列, 值列识别自动跳过, 不影响统计与筛选。
 */
export function findValueColumn(rows: TableRow[]): string | null {
  const keys = rows.length ? Object.keys(rows[0]).filter((k) => k !== '_idx' && !isTimeColumnKey(k)) : []
  return keys.length ? keys[keys.length - 1] : null
}

import { app, ipcMain } from 'electron'
import iconv from 'iconv-lite'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppConfig, CsvBatch, ExportResult } from '../shared/types'
import { buildElectricityUrl, buildWaterUrl } from '../shared/defaults'

const TIMEOUT_MS = 15000

/** 后端 HTTP Basic 认证信息(留空 user 则不发送认证头) */
interface BasicAuth {
  user?: string
  pass?: string
}

async function request(url: string, auth?: BasicAuth): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {}
    if (auth?.user) {
      // RFC 7617: 用户名:密码 经 base64 编码后放在 Authorization 头
      headers['Authorization'] = 'Basic ' + Buffer.from(`${auth.user}:${auth.pass ?? ''}`, 'utf8').toString('base64')
    }
    const res = await fetch(url, { headers, signal: ctrl.signal })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(`认证失败(HTTP ${res.status}) — 后端口令错误或已变更, 请在「设置」中检查后端认证账号/密码。`)
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    return res
  } catch (err) {
    // 服务端已响应但返回非 2xx: 属于认证/业务错误, 直接透传, 不当作网络问题
    if (err instanceof Error && (err.message.startsWith('认证失败') || err.message.startsWith('HTTP '))) throw err
    const cause = (err as { cause?: { code?: string } })?.cause
    const short = url.replace(/^https?:\/\//, '')
    if (cause?.code === 'ECONNREFUSED') throw new Error(`连接被拒绝(${short}) — 请确认服务已启动并监听该端口。`)
    if (cause?.code === 'ENOTFOUND' || cause?.code === 'EAI_AGAIN') throw new Error(`无法解析主机(${short}) — 请检查地址或网络。`)
    if (cause?.code === 'ETIMEDOUT' || cause?.code === 'UND_ERR_CONNECT_TIMEOUT') throw new Error(`连接超时(${short}) — 请检查网络/防火墙。`)
    if (err instanceof Error && err.name === 'AbortError') throw new Error(`请求超时(${short}) — 服务响应超过 ${TIMEOUT_MS / 1000} 秒。`)
    // 兜底: 无法识别的 fetch 失败,给出可操作提示
    throw new Error(`无法连接(${short}) — 请检查地址、网络与服务状态。`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 解码 CSV 字节:
 * - 支持 UTF-8 BOM / UTF-16 BOM
 * - 无 BOM 时先按 UTF-8 解码,若出现大量乱码字符且存在高位字节,回退到 GBK
 */
export function decodeBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return iconv.decode(buf.subarray(2), 'utf16-le')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return iconv.decode(buf.subarray(2), 'utf16-be')
  }

  const utf8 = buf.toString('utf8')
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length
  const hasHighBytes = buf.some((b) => b >= 0x80)
  if (replacementCount > 0 && hasHighBytes) {
    const gbk = iconv.decode(buf, 'gbk')
    const gbkReplacement = (gbk.match(/\uFFFD/g) || []).length
    if (gbkReplacement < replacementCount) return gbk
  }
  return utf8
}

/** 本地内置样例目录 */
function localDataDir(): string {
  return join(app.getAppPath(), 'resources', 'meter-data')
}

function readLocalCsv(fileName: string): string {
  const p = join(localDataDir(), fileName)
  return decodeBuffer(readFileSync(p))
}

async function fetchHttpCsv(url: string, config: AppConfig): Promise<string> {
  const res = await request(url, { user: config.authUser, pass: config.authPass })
  return decodeBuffer(Buffer.from(await res.arrayBuffer()))
}

/** 按当前配置获取两个 CSV 全文(本地读文件 / 后端发请求) */
export async function getCsvBatch(config: AppConfig): Promise<CsvBatch> {
  if (config.dataSource === 'local') {
    return {
      water: readLocalCsv('water_meter.csv'),
      electricity: readLocalCsv('power_meter.csv'),
      source: 'local',
      fetchedAt: Date.now()
    }
  }
  const [water, electricity] = await Promise.all([
    fetchHttpCsv(buildWaterUrl(config.serverHost), config),
    fetchHttpCsv(buildElectricityUrl(config.serverHost), config)
  ])
  return { water, electricity, source: 'http', fetchedAt: Date.now() }
}

/** 带 BOM 写出(与源 CSV 一致,Excel 直接打开不乱码) */
function writeCsvWithBom(filePath: string, text: string): void {
  const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])
  writeFileSync(filePath, buf)
}

/** 把一批 CSV 写入指定目录,返回结果 */
export function writeBatchToDir(batch: CsvBatch, dir: string): ExportResult {
  mkdirSync(dir, { recursive: true })
  const waterPath = join(dir, 'water_meter.csv')
  const electricityPath = join(dir, 'power_meter.csv')
  writeCsvWithBom(waterPath, batch.water)
  writeCsvWithBom(electricityPath, batch.electricity)
  return {
    dir,
    files: [waterPath.split(/[\\/]/).pop() ?? 'water_meter.csv', electricityPath.split(/[\\/]/).pop() ?? 'power_meter.csv']
  }
}

export function registerDataHandlers(getConfig: () => AppConfig): void {
  ipcMain.handle('data:get', async () => getCsvBatch(getConfig()))

  ipcMain.handle('data:export', async (): Promise<ExportResult> => {
    // 导出前重新拉取当前来源的最新数据,保证导出"最新"状态
    const batch = await getCsvBatch(getConfig())
    return writeBatchToDir(batch, process.env.METER_EXPORT_DIR || app.getPath('desktop'))
  })
}
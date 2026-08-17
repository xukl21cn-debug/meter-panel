import { useState } from 'react'
import type { AppConfig } from '../../../shared/types'
import { API_PORT, DEFAULT_CONFIG, LOCAL_CONFIG, buildElectricityUrl, buildWaterUrl, normalizeHost } from '../../../shared/defaults'

interface Props {
  config: AppConfig
  onClose: () => void
  onSave: (cfg: AppConfig) => void
}

export default function SettingsModal({ config, onClose, onSave }: Props) {
  const [form, setForm] = useState<AppConfig>({ ...config })
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof AppConfig>(k: K, v: AppConfig[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (form.dataSource === 'http') {
      const host = normalizeHost(form.serverHost)
      if (!host) {
        setError('请填写后端服务地址(IP 或域名)')
        return
      }
      if (/\s/.test(form.serverHost.trim())) {
        setError('地址不能包含空格')
        return
      }
      form.serverHost = host
    }
    const sec = Number(form.refreshIntervalSec)
    if (!Number.isFinite(sec) || sec < 1 || sec > 3600) {
      setError('刷新间隔需在 1–3600 秒之间')
      return
    }
    onSave({ ...form, refreshIntervalSec: Math.round(sec) })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="设置">
        <h2>设置</h2>
        <p className="modal-hint">
          面板只使用两个 CSV 接口;「本地内置样例」模式直接展示项目 resources/meter-data 下的数据,不发起任何网络请求。
        </p>

        <div className="form-field">
          <label>数据来源</label>
          <div className="radio-row">
            <label className="radio">
              <input type="radio" name="dataSource" checked={form.dataSource === 'http'} onChange={() => set('dataSource', 'http')} />
              <span>后端接口(CSV)</span>
            </label>
            <label className="radio">
              <input type="radio" name="dataSource" checked={form.dataSource === 'local'} onChange={() => set('dataSource', 'local')} />
              <span>本地内置样例</span>
            </label>
          </div>
        </div>

        {form.dataSource === 'http' && (
          <>
            <div className="form-field">
              <label>{`后端服务地址(IP 或域名)· 端口固定 ${API_PORT}`}</label>
              <input
                type="text"
                value={form.serverHost}
                spellCheck={false}
                placeholder="例如: 10.148.201.103 或 localhost"
                onChange={(e) => set('serverHost', e.target.value)}
              />
              <p className="field-hint">自动拼接的接口地址:</p>
              <p className="field-hint mono">{buildWaterUrl(form.serverHost)}</p>
              <p className="field-hint mono">{buildElectricityUrl(form.serverHost)}</p>
            </div>
          </>
        )}

        <div className="form-field">
          <label>表格自动刷新间隔(秒,仅后端模式生效)</label>
          <input type="number" min={1} max={3600} value={form.refreshIntervalSec} onChange={(e) => set('refreshIntervalSec', Number(e.target.value))} />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn" onClick={() => setForm({ ...LOCAL_CONFIG })}>本地内置样例</button>
          <button className="btn" onClick={() => setForm({ ...DEFAULT_CONFIG })}>恢复默认(真实后端)</button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={submit}>保存并应用</button>
        </div>
      </div>
    </div>
  )
}
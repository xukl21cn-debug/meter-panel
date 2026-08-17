import { contextBridge, ipcRenderer } from 'electron'
import type { ApiBridge, AppConfig } from '../shared/types'

const api: ApiBridge = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
  setConfig: (cfg: AppConfig): Promise<AppConfig> => ipcRenderer.invoke('config:set', cfg),
  getCsvs: () => ipcRenderer.invoke('data:get'),
  exportCsvs: () => ipcRenderer.invoke('data:export')
}

contextBridge.exposeInMainWorld('api', api)
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { DEFAULT_CONFIG, loadConfig, saveConfig } from './config'
import { registerDataHandlers } from './api'
import type { AppConfig } from '../shared/types'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: '水电表数据面板',
    autoHideMenuBar: true,
    backgroundColor: '#0a1120',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 外部链接用系统浏览器打开,不在应用内跳转
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 诊断:渲染进程崩溃/控制台日志(开发排查用)
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.log(`[renderer-gone] reason=${details.reason} exitCode=${details.exitCode}`)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  let config = loadConfig()
  registerDataHandlers(() => config)

  ipcMain.handle('config:get', () => config)
  ipcMain.handle('config:set', (_e, cfg: AppConfig) => {
    config = { ...DEFAULT_CONFIG, ...cfg }
    saveConfig(config)
    return config
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
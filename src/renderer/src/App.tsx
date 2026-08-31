import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { AppConfig } from '../../shared/types'
import MeterPage from './views/MeterPage'
import CameraPage from './views/CameraPage'
import Sidebar from './components/Sidebar'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    window.api.getConfig().then(setConfig)
  }, [])

  return (
    <HashRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/meter" element={<MeterPage config={config} onConfigSaved={setConfig} />} />
            <Route path="/camera" element={<CameraPage />} />
            <Route path="*" element={<Navigate to="/meter" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

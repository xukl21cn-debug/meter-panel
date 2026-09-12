import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import App from './App'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './styles.css'

// AG Grid 33+ 需要显式注册社区模块
ModuleRegistry.registerModules([AllCommunityModule])

// 全局默认: 失败不自动重试(等下一个轮询周期), 与原有 setInterval 行为一致
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // 现场多为无外网的内网环境, navigator.onLine 可能为 false;
      // 默认 networkMode('online') 会把请求一直挂起, 这里固定按"始终可发请求"处理
      networkMode: 'always'
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
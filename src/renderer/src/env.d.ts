/// <reference types="vite/client" />
import type { ApiBridge, AppConfig, ApiStatus, TableRow, TableData } from '../../shared/types'

declare global {
  interface Window {
    api: ApiBridge
  }
}

export type { AppConfig, ApiStatus, TableRow, TableData }
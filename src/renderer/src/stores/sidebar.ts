import { create } from 'zustand'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
}

/** 侧边栏折叠状态(纯 UI 状态,全局共享) */
export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (v) => set({ collapsed: v })
}))

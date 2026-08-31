import { NavLink } from 'react-router-dom'
import { FiBarChart2, FiVideo, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { useSidebarStore } from '../store/sidebar'

export default function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">
          <FiBarChart2 />
        </span>
        {!collapsed && (
          <div>
            <div className="sidebar-title">水电表数据面板</div>
            <div className="sidebar-sub">METER TELEMETRY</div>
          </div>
        )}
      </div>

      <NavLink to="/meter" title={collapsed ? '水电表' : undefined} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon">
          <FiBarChart2 />
        </span>
        {!collapsed && <span className="nav-label">水电表</span>}
      </NavLink>
      <NavLink to="/camera" title={collapsed ? '摄像头' : undefined} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="nav-icon">
          <FiVideo />
        </span>
        {!collapsed && <span className="nav-label">摄像头</span>}
      </NavLink>

      <button className="sidebar-toggle" onClick={toggle} title={collapsed ? '展开侧边栏' : '折叠侧边栏'}>
        {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
      </button>
    </nav>
  )
}

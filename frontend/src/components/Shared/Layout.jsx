import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import client from '../../api/client'

export default function Layout({ children }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isManager = user?.role === 'manager'
  const isHrOrAdmin = user?.role === 'hr' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'
  const isEmployee = user?.role === 'employee'

  async function handleLogout() {
    try {
      await client.post('/auth/logout')
    } catch (e) {}
    setUser(null)
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  const roleBadgeColor = {
    admin: 'bg-purple-100 text-purple-700',
    hr: 'bg-blue-100 text-blue-700',
    manager: 'bg-green-100 text-green-700',
    employee: 'bg-gray-100 text-gray-600'
  }[user?.role] || 'bg-gray-100 text-gray-600'

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="p-6 border-b border-gray-200 relative">
          <h1 className="text-base font-bold text-blue-600 leading-tight">SIPS HR Evaluation System</h1>
          <p className="text-xs text-gray-500 mt-1">Performance Management</p>
          <button
            onClick={closeSidebar}
            className="md:hidden absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl leading-none"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLink to="/dashboard" className={navLinkClass} onClick={closeSidebar}>
            <span>📊</span> Dashboard
          </NavLink>

          <NavLink to="/evaluations" className={navLinkClass} onClick={closeSidebar}>
            <span>📋</span> Evaluations
          </NavLink>

          <NavLink to="/employees" className={navLinkClass} onClick={closeSidebar}>
            <span>👥</span> {isManager ? 'My Team' : 'Employees'}
          </NavLink>

          <NavLink to="/attendance" className={navLinkClass} onClick={closeSidebar}>
            <span>📅</span> Attendance Log
          </NavLink>

          <NavLink to="/disciplinary" className={navLinkClass} onClick={closeSidebar}>
            <span>⚖️</span> Disciplinary Action
          </NavLink>

          <NavLink to="/qa-log" className={navLinkClass} onClick={closeSidebar}>
            <span>🔍</span> QA Log
          </NavLink>

          <NavLink to="/pip" className={navLinkClass} onClick={closeSidebar}>
            <span>⚠️</span> PIP Plans
          </NavLink>

          {!isEmployee && (
            <NavLink to="/calendar" className={navLinkClass} onClick={closeSidebar}>
              <span>📆</span> Calendar
            </NavLink>
          )}

          {(isHrOrAdmin || isManager) && (
            <NavLink to="/reports" className={navLinkClass} onClick={closeSidebar}>
              <span>📈</span> Reports
            </NavLink>
          )}

          {isHrOrAdmin && (
            <NavLink to="/notifications" className={navLinkClass} onClick={closeSidebar}>
              <span>📨</span> Notification Log
            </NavLink>
          )}

          {isHrOrAdmin && (
            <NavLink to="/audit" className={navLinkClass} onClick={closeSidebar}>
              <span>🔒</span> Audit Log
            </NavLink>
          )}

          {isAdmin && (
            <NavLink to="/settings" className={navLinkClass} onClick={closeSidebar}>
              <span>⚙️</span> Settings
            </NavLink>
          )}
        </nav>

        <div className="p-4 space-y-3 border-t border-gray-200">
          <NavLink
            to="/evaluations/new"
            onClick={closeSidebar}
            className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Evaluation
          </NavLink>
          <NavLink
            to="/evaluations/tech/new"
            onClick={closeSidebar}
            className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            🔬 New Tech Evaluation
          </NavLink>
          {/* Role badge */}
          <div className="flex items-center justify-center">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleBadgeColor}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-700 hover:text-gray-900 -ml-1 p-1"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3 md:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

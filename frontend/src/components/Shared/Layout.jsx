import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import client from '../../api/client'

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/evaluations', label: 'Evaluations', icon: '📋' },
  { to: '/employees', label: 'Employees', icon: '👥' },
  { to: '/reports', label: 'Reports', icon: '📈' }
]

export default function Layout({ children }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await client.post('/auth/logout')
    } catch (e) {}
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-lg font-bold text-blue-600">HR Eval System</h1>
          <p className="text-xs text-gray-500 mt-1">Performance Management</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <NavLink
            to="/evaluations/new"
            className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Evaluation
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-4">
            <div className="text-right">
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
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

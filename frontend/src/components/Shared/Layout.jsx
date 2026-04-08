import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import client from '../../api/client'

export default function Layout({ children }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const isManager = user?.role === 'manager'
  const isHrOrAdmin = user?.role === 'hr' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  async function handleLogout() {
    try {
      await client.post('/auth/logout')
    } catch (e) {}
    setUser(null)
    navigate('/login')
  }

  const roleBadgeColor = {
    admin: 'bg-purple-100 text-purple-700',
    hr: 'bg-blue-100 text-blue-700',
    manager: 'bg-green-100 text-green-700',
    employee: 'bg-gray-100 text-gray-600'
  }[user?.role] || 'bg-gray-100 text-gray-600'

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-base font-bold text-blue-600 leading-tight">SIPS HR Evaluation System</h1>
          <p className="text-xs text-gray-500 mt-1">Performance Management</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span>📊</span> Dashboard
          </NavLink>

          <NavLink
            to="/evaluations"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span>📋</span> Evaluations
          </NavLink>

          <NavLink
            to="/employees"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span>👥</span> {isManager ? 'My Team' : 'Employees'}
          </NavLink>

          <NavLink
            to="/attendance"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span>📅</span> Attendance Log
          </NavLink>

          <NavLink
            to="/disciplinary"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span>⚖️</span> Disciplinary Action
          </NavLink>

          <NavLink
            to="/qa-log"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span>🔍</span> QA Log
          </NavLink>

          <NavLink
            to="/pip"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span>⚠️</span> PIP Plans
          </NavLink>

          {(isHrOrAdmin || isManager) && (
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span>📈</span> Reports
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span>⚙️</span> Settings
            </NavLink>
          )}
        </nav>

        <div className="p-4 space-y-3 border-t border-gray-200">
          <NavLink
            to="/evaluations/new"
            className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New Evaluation
          </NavLink>
          <NavLink
            to="/evaluations/tech/new"
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

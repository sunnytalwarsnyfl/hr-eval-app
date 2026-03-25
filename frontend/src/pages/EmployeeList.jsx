import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import { employeesApi } from '../api/employees'

export default function EmployeeList() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => { loadEmployees() }, [search])

  async function loadEmployees() {
    setLoading(true)
    try {
      const res = await employeesApi.list({ search })
      setEmployees(res.data.employees)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSendInvite(emp, e) {
    e.stopPropagation()
    try {
      const res = await employeesApi.sendInvite(emp.id)
      showToast(res.data.message || `Invite sent to ${emp.email}`)
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send invite', 'error')
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {toast.message}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-sm text-gray-500 mt-1">{employees.length} active employees</p>
          </div>
          <button
            onClick={() => navigate('/employees/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add Employee
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <input
            type="text"
            placeholder="Search by name, email, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No employees found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Job Title</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Tech Level</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Hire Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Last Eval</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Last Score</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map(emp => {
                    const pct = emp.last_score && emp.last_score > 0
                      ? Math.round(emp.last_score / 227 * 100)
                      : null
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/employees/${emp.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                        <td className="px-4 py-3 text-gray-600">{emp.job_title}</td>
                        <td className="px-4 py-3 text-center">
                          {emp.tech_level ? (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                              {emp.tech_level}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{emp.hire_date}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {emp.last_eval_date ? (
                            <span className={
                              new Date(emp.last_eval_date) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                                ? 'text-red-500 font-medium'
                                : 'text-gray-600'
                            }>
                              {emp.last_eval_date}
                            </span>
                          ) : (
                            <span className="text-red-500 font-medium text-xs">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pct !== null ? (
                            <span className={`font-medium ${pct >= 93 ? 'text-green-600' : pct >= 80 ? 'text-blue-600' : 'text-red-500'}`}>
                              {emp.last_score}/227 ({pct}%)
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-2"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/employees/${emp.id}/edit`) }}
                            className="text-gray-600 hover:text-gray-800 font-medium text-xs mr-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleSendInvite(emp, e)}
                            className="text-green-600 hover:text-green-800 font-medium text-xs mr-2"
                          >
                            Invite
                          </button>
                          <button
                            onClick={() => navigate(`/evaluations/new?employee=${emp.id}`)}
                            className="text-purple-600 hover:text-purple-800 font-medium text-xs"
                          >
                            + Eval
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

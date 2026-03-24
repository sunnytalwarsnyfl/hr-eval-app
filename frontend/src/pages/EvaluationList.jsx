import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import StatusBadge from '../components/Shared/StatusBadge'
import { evaluationsApi } from '../api/evaluations'

const PAGE_SIZE = 10

export default function EvaluationList() {
  const navigate = useNavigate()
  const [evaluations, setEvaluations] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({
    department: '', status: '', start_date: '', end_date: '', passed: '', search: ''
  })

  useEffect(() => { loadEvals() }, [filters])

  async function loadEvals() {
    setLoading(true)
    try {
      const params = {}
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
      const res = await evaluationsApi.list(params)
      setEvaluations(res.data.evaluations)
      setPage(0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function updateFilter(key, val) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  function exportCSV() {
    const headers = ['Employee', 'Date', 'Type', 'Score', 'Max', 'Pct', 'Pass/Fail', 'Status']
    const rows = evaluations.map(ev => [
      ev.employee_name,
      ev.evaluation_date,
      ev.evaluation_type,
      ev.total_score,
      ev.max_score,
      `${Math.round(ev.total_score / ev.max_score * 100)}%`,
      ev.passed ? 'Pass' : 'Fail',
      ev.status
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'evaluations.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const paginated = evaluations.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(evaluations.length / PAGE_SIZE)

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evaluations</h1>
            <p className="text-sm text-gray-500 mt-1">{evaluations.length} total records</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportCSV} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Export CSV
            </button>
            <button
              onClick={() => navigate('/evaluations/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + New Evaluation
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={filters.department}
              onChange={e => updateFilter('department', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              <option>Sterile Processing</option>
              <option>IT</option>
              <option>QA</option>
            </select>
            <select
              value={filters.status}
              onChange={e => updateFilter('status', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option>Draft</option>
              <option>Submitted</option>
              <option>Acknowledged</option>
            </select>
            <select
              value={filters.passed}
              onChange={e => updateFilter('passed', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pass & Fail</option>
              <option value="true">Pass Only</option>
              <option value="false">Fail Only</option>
            </select>
            <input
              type="date"
              value={filters.start_date}
              onChange={e => updateFilter('start_date', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filters.end_date}
              onChange={e => updateFilter('end_date', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : evaluations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No evaluations found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Score %</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Result</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map(ev => {
                      const pct = ev.max_score > 0 ? Math.round(ev.total_score / ev.max_score * 100) : 0
                      return (
                        <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{ev.employee_name}</div>
                            <div className="text-xs text-gray-500">{ev.department}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{ev.evaluation_date}</td>
                          <td className="px-4 py-3 text-gray-600">{ev.evaluation_type}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            <span className={pct >= 93 ? 'text-green-600' : pct >= 80 ? 'text-blue-600' : 'text-red-500'}>
                              {ev.total_score}/{ev.max_score} ({pct}%)
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ev.status !== 'Draft' && <StatusBadge status={ev.passed ? 'Pass' : 'Fail'} />}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={ev.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => navigate(`/evaluations/${ev.id}`)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-3"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, evaluations.length)} of {evaluations.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

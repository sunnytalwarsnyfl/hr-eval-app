import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Shared/Layout'
import { notificationsApi } from '../api/notifications'
import { useAuth } from '../App'

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'self_eval_due_30', label: 'Self-eval due 30' },
  { value: 'self_eval_due_15', label: 'Self-eval due 15' },
  { value: 'self_eval_due_5', label: 'Self-eval due 5' },
  { value: 'annual_review_due_30', label: 'Annual review due 30' },
  { value: 'annual_review_due_15', label: 'Annual review due 15' },
  { value: 'annual_review_due_5', label: 'Annual review due 5' },
  { value: 'manual_reminder', label: 'Manual reminder' },
  { value: 'manual_reminder_bulk', label: 'Manual reminder (bulk)' }
]

const LIMIT_OPTIONS = [50, 100, 250, 500]

function typeBadgeClass(type) {
  if (!type) return 'bg-gray-100 text-gray-700'
  if (type.startsWith('manual_reminder')) return 'bg-blue-100 text-blue-700'
  if (type.startsWith('self_eval_due')) return 'bg-indigo-100 text-indigo-700'
  if (type.startsWith('annual_review_due')) return 'bg-purple-100 text-purple-700'
  return 'bg-gray-100 text-gray-700'
}

function formatDate(s) {
  if (!s) return '—'
  // SQLite CURRENT_TIMESTAMP form: "YYYY-MM-DD HH:MM:SS" or ISO
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return s
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${yr}-${mo}-${da} ${hh}:${mm}`
}

export default function NotificationLog() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [type, setType] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [limit, setLimit] = useState(100)

  const isHrOrAdmin = user?.role === 'admin' || user?.role === 'hr'

  useEffect(() => {
    if (!isHrOrAdmin) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, limit])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const params = { limit }
      if (type) params.type = type
      const res = await notificationsApi.getLog(params)
      setRows(res.data?.data || [])
    } catch (e) {
      setErr(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => (r.employee_name || '').toLowerCase().includes(q))
  }, [rows, employeeSearch])

  if (!isHrOrAdmin) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-600">
          Access restricted to HR / Admin.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Log</h1>
            <p className="text-sm text-gray-500 mt-1">Recent evaluation-related notifications sent by the system.</p>
          </div>
          <button
            onClick={load}
            className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee search</label>
              <input
                type="text"
                value={employeeSearch}
                onChange={e => setEmployeeSearch(e.target.value)}
                placeholder="Filter by employee name..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Limit</label>
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading notifications...</div>
          ) : err ? (
            <div className="p-8 text-center text-red-600 text-sm">{err}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No notifications found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Sent At</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Sent To Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Sent To Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Sent By</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Manual?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{formatDate(r.sent_at)}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800">{r.employee_name || '—'}</div>
                        {r.department && <div className="text-xs text-gray-500">{r.department}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass(r.notification_type)}`}>
                          {r.notification_type || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700 capitalize">{r.sent_to_role || '—'}</td>
                      <td className="py-3 px-4 text-gray-600">{r.sent_to_email || '—'}</td>
                      <td className="py-3 px-4 text-gray-700">{r.sent_by_name || (r.sent_by ? `User #${r.sent_by}` : '—')}</td>
                      <td className="py-3 px-4 text-center">
                        {r.reminder_sent_manually
                          ? <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Manual</span>
                          : <span className="text-gray-400 text-xs">Auto</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 text-right">
          Showing {filteredRows.length} of {rows.length} (limit {limit})
        </div>
      </div>
    </Layout>
  )
}

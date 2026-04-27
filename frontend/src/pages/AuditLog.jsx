import React, { useState, useEffect } from 'react'
import Layout from '../components/Shared/Layout'
import { auditApi } from '../api/audit'

const ENTITY_TYPES = ['evaluation', 'employee', 'disciplinary', 'qa_log', 'attendance', 'pip', 'auth', 'user', 'department', 'facility', 'compliance']
const ACTIONS = ['create', 'update', 'delete', 'approve', 'sign_employee', 'sign_manager', 'login', 'logout', 'hr_review', 'acknowledge', 'invite_self_eval', 'bulk_invite', 'bulk_deactivate']

const ACTION_COLORS = {
  login: 'bg-gray-100 text-gray-700',
  logout: 'bg-gray-100 text-gray-700',
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  approve: 'bg-purple-100 text-purple-700',
  sign_employee: 'bg-purple-100 text-purple-700',
  sign_manager: 'bg-purple-100 text-purple-700',
  acknowledge: 'bg-indigo-100 text-indigo-700',
  hr_review: 'bg-pink-100 text-pink-700',
  invite_self_eval: 'bg-teal-100 text-teal-700',
  bulk_invite: 'bg-teal-100 text-teal-700',
  bulk_deactivate: 'bg-orange-100 text-orange-700',
}

export default function AuditLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    user_search: '',
    start_date: '',
    end_date: '',
    limit: 100
  })
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { load() }, [filters.entity_type, filters.action, filters.start_date, filters.end_date, filters.limit])

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (filters.entity_type) params.entity_type = filters.entity_type
      if (filters.action) params.action = filters.action
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      params.limit = filters.limit
      const res = await auditApi.list(params)
      let data = res.data.data || []
      if (filters.user_search) {
        const q = filters.user_search.toLowerCase()
        data = data.filter(r => (r.user_name || '').toLowerCase().includes(q))
      }
      setRows(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function fmt(dt) {
    if (!dt) return ''
    const d = new Date(dt)
    return d.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">Track all sensitive actions across the system</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={filters.entity_type}
            onChange={e => setFilters(f => ({ ...f, entity_type: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select
            value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            {ACTIONS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <input
            type="text"
            placeholder="User name..."
            value={filters.user_search}
            onChange={e => setFilters(f => ({ ...f, user_search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.start_date}
            onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={filters.limit}
            onChange={e => setFilters(f => ({ ...f, limit: Number(e.target.value) }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
            <option value={250}>250 entries</option>
            <option value={500}>500 entries</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No audit entries match filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <React.Fragment key={r.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">{fmt(r.created_at)}</td>
                      <td className="px-4 py-2 text-xs">{r.user_name || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 capitalize">{r.user_role || '—'}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${ACTION_COLORS[r.action] || 'bg-gray-100 text-gray-700'}`}>
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">{r.entity_type}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{r.entity_id || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                        {r.details ? JSON.stringify(r.details) : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{r.ip_address || '—'}</td>
                    </tr>
                    {expandedId === r.id && (
                      <tr>
                        <td colSpan={8} className="px-4 py-3 bg-gray-50 text-xs">
                          <div className="space-y-1">
                            <div><strong>IP:</strong> {r.ip_address || 'N/A'}</div>
                            <div><strong>User Agent:</strong> {r.user_agent || 'N/A'}</div>
                            {r.details && (
                              <div>
                                <strong>Details:</strong>
                                <pre className="mt-1 bg-white border border-gray-200 rounded p-2 overflow-x-auto">{JSON.stringify(r.details, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}

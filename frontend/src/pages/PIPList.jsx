import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import { pipApi } from '../api/pip'

const STATUS_TABS = ['All', 'Active', 'Complete - Met Expectations', 'Incomplete - Did Not Meet', 'Extended']

const statusBadge = {
  'Active': 'bg-blue-100 text-blue-700',
  'Complete - Met Expectations': 'bg-green-100 text-green-700',
  'Incomplete - Did Not Meet': 'bg-red-100 text-red-700',
  'Extended': 'bg-yellow-100 text-yellow-700',
  // Legacy
  'Completed': 'bg-green-100 text-green-700'
}

function parseMonitoringDays(value) {
  if (!value) return 30
  const m = String(value).match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 30
}

function calcRollOffDate(createdAt, monitoringPeriod) {
  if (!createdAt) return '—'
  const base = String(createdAt).substring(0, 10)
  const d = new Date(base)
  if (isNaN(d.getTime())) return '—'
  d.setDate(d.getDate() + parseMonitoringDays(monitoringPeriod))
  return d.toISOString().split('T')[0]
}

export default function PIPList() {
  const navigate = useNavigate()
  const [pips, setPips] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('All')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadPips()
  }, [activeTab])

  async function loadPips() {
    setLoading(true)
    try {
      const params = activeTab !== 'All' ? { status: activeTab } : {}
      const res = await pipApi.list(params)
      setPips(res.data.pips)
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

  async function handleUpdateStatus(pip, status, e) {
    e.stopPropagation()
    try {
      await pipApi.updateStatus(pip.id, status)
      showToast(`PIP status updated to ${status}`)
      loadPips()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error')
    }
  }

  async function handleDelete(pip, e) {
    e.stopPropagation()
    if (!confirm(`Delete PIP for ${pip.employee_name}? This cannot be undone.`)) return
    try {
      await pipApi.remove(pip.id)
      showToast('PIP deleted')
      loadPips()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete PIP', 'error')
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {toast.message}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Improvement Plans</h1>
            <p className="text-sm text-gray-500 mt-1">{pips.length} {activeTab !== 'All' ? activeTab.toLowerCase() : 'total'} PIPs</p>
          </div>
          <button
            onClick={() => navigate('/pip/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + New PIP
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : pips.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No {activeTab !== 'All' ? activeTab.toLowerCase() + ' ' : ''}PIPs found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Monitoring</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Eval Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Start Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Roll-Off Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Next Review</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pips.map(pip => (
                    <tr
                      key={pip.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/pip/${pip.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{pip.employee_name}</td>
                      <td className="px-4 py-3 text-gray-600">{pip.department}</td>
                      <td className="px-4 py-3 text-gray-600">{pip.type || 'New'}</td>
                      <td className="px-4 py-3 text-gray-600">{pip.monitoring_period || '30 Days'}</td>
                      <td className="px-4 py-3 text-gray-600">{pip.evaluation_date || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {pip.created_at ? pip.created_at.split('T')[0] || pip.created_at.substring(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {calcRollOffDate(pip.created_at, pip.monitoring_period)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{pip.next_pip_date || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[pip.status] || 'bg-gray-100 text-gray-600'}`}>
                          {pip.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/pip/${pip.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs mr-2"
                        >
                          View
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/pip/${pip.id}/edit`) }}
                          className="text-gray-600 hover:text-gray-800 font-medium text-xs mr-2"
                        >
                          Edit
                        </button>
                        {pip.status !== 'Complete - Met Expectations' && (
                          <button
                            onClick={(e) => handleUpdateStatus(pip, 'Complete - Met Expectations', e)}
                            className="text-green-600 hover:text-green-800 font-medium text-xs mr-2"
                          >
                            Complete
                          </button>
                        )}
                        {pip.status !== 'Extended' && (
                          <button
                            onClick={(e) => handleUpdateStatus(pip, 'Extended', e)}
                            className="text-yellow-600 hover:text-yellow-800 font-medium text-xs mr-2"
                          >
                            Extend
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(pip, e)}
                          className="text-red-500 hover:text-red-700 font-medium text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

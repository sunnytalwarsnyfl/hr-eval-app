import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import { pipApi } from '../api/pip'

const statusBadge = {
  'Active': 'bg-blue-100 text-blue-700',
  'Complete - Met Expectations': 'bg-green-100 text-green-700',
  'Incomplete - Did Not Meet': 'bg-red-100 text-red-700',
  'Extended': 'bg-yellow-100 text-yellow-700',
  // Legacy
  'Completed': 'bg-green-100 text-green-700'
}

const STATUS_OPTIONS = ['Active', 'Complete - Met Expectations', 'Incomplete - Did Not Meet', 'Extended']
const MONITORING_OPTIONS = ['15 Days', '30 Days', '45 Days', '60 Days']
const TYPE_OPTIONS = ['New', 'Extension']

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

export default function PIPDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pip, setPip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadPip() }, [id])

  async function loadPip() {
    try {
      const res = await pipApi.get(id)
      setPip(res.data.pip)
      setEditForm(res.data.pip)
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

  async function handleStatusUpdate(status) {
    try {
      await pipApi.updateStatus(id, status)
      showToast(`PIP marked as ${status}`)
      loadPip()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error')
    }
  }

  async function handleSaveEdit() {
    setSaving(true)
    try {
      const res = await pipApi.update(id, {
        action_plan: editForm.action_plan,
        goals: editForm.goals,
        expectations: editForm.expectations,
        timeline: editForm.timeline,
        next_pip_date: editForm.next_pip_date,
        status: editForm.status,
        monitoring_period: editForm.monitoring_period,
        type: editForm.type
      })
      setPip(prev => ({ ...prev, ...res.data.pip }))
      setIsEditing(false)
      showToast('PIP updated successfully')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save changes', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading PIP...</div>
        </div>
      </Layout>
    )
  }

  if (!pip) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">PIP not found.</p>
          <button onClick={() => navigate('/pip')} className="mt-4 text-blue-600 hover:underline">Back to PIPs</button>
        </div>
      </Layout>
    )
  }

  const scorePct = pip.max_score > 0 ? Math.round(pip.total_score / pip.max_score * 100) : 0
  const rollOffDate = calcRollOffDate(pip.created_at, pip.monitoring_period)

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => navigate('/pip')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
              ← Back to PIPs
            </button>
            <h1 className="text-2xl font-bold text-gray-900">PIP — {pip.employee_name}</h1>
            <p className="text-gray-500 text-sm mt-1">{pip.department} • {pip.job_title}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusBadge[pip.status] || 'bg-gray-100 text-gray-600'}`}>
              {pip.status || 'Active'}
            </span>
          </div>
        </div>

        {/* Employee + Eval info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Employee Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-medium">{pip.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Department</span>
                <span className="font-medium">{pip.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Job Title</span>
                <span className="font-medium">{pip.job_title || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tech Level</span>
                <span className="font-medium">{pip.tech_level || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hire Date</span>
                <span className="font-medium">{pip.hire_date || '—'}</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/employees/${pip.employee_id}`)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              View Employee Profile →
            </button>
          </div>

          {/* Evaluation summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Linked Evaluation</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{pip.evaluation_date || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium">{pip.evaluation_type || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Score</span>
                <span className={`font-medium ${scorePct >= 93 ? 'text-green-600' : scorePct >= 80 ? 'text-blue-600' : 'text-red-500'}`}>
                  {pip.total_score}/{pip.max_score} ({scorePct}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Result</span>
                <span className={`font-medium ${pip.passed ? 'text-green-600' : 'text-red-500'}`}>
                  {pip.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Evaluator</span>
                <span className="font-medium">{pip.evaluator_name || '—'}</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/evaluations/${pip.evaluation_id}`)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              View Evaluation →
            </button>
          </div>
        </div>

        {/* PIP Schedule Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">PIP Schedule</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium">{pip.type || 'New'}</p>
            </div>
            <div>
              <p className="text-gray-500">Monitoring Period</p>
              <p className="font-medium">{pip.monitoring_period || '30 Days'}</p>
            </div>
            <div>
              <p className="text-gray-500">Issuance Date</p>
              <p className="font-medium">
                {pip.created_at ? String(pip.created_at).substring(0, 10) : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Roll-Off Date</p>
              <p className="font-medium">{rollOffDate}</p>
            </div>
          </div>
        </div>

        {/* PIP Fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">PIP Details</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditForm(pip) }}
                  className="text-sm border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {[
              { key: 'action_plan', label: 'Action Plan' },
              { key: 'goals', label: 'Goals' },
              { key: 'expectations', label: 'Expectations & Standards' }
            ].map(({ key, label }) => (
              <div key={key}>
                <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
                {isEditing ? (
                  <textarea
                    value={editForm[key] || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                    {pip[key] || <span className="text-gray-400 italic">Not specified</span>}
                  </p>
                )}
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Timeline</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.timeline || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, timeline: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-600">{pip.timeline || '—'}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Next PIP Date</p>
                {isEditing ? (
                  <input
                    type="date"
                    value={editForm.next_pip_date || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, next_pip_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-600">{pip.next_pip_date || '—'}</p>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Type</p>
                  <select
                    value={editForm.type || 'New'}
                    onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {TYPE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Monitoring Period</p>
                  <select
                    value={editForm.monitoring_period || '30 Days'}
                    onChange={e => setEditForm(prev => ({ ...prev, monitoring_period: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {MONITORING_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
                  <select
                    value={editForm.status || 'Active'}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status update actions */}
        {!isEditing && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Update Status</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {pip.status !== 'Complete - Met Expectations' && (
                <button
                  onClick={() => handleStatusUpdate('Complete - Met Expectations')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Mark Complete - Met Expectations
                </button>
              )}
              {pip.status !== 'Incomplete - Did Not Meet' && (
                <button
                  onClick={() => handleStatusUpdate('Incomplete - Did Not Meet')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Mark Incomplete - Did Not Meet
                </button>
              )}
              {pip.status !== 'Extended' && (
                <button
                  onClick={() => handleStatusUpdate('Extended')}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                >
                  Mark Extended
                </button>
              )}
              {pip.status !== 'Active' && (
                <button
                  onClick={() => handleStatusUpdate('Active')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Reactivate
                </button>
              )}
              <button
                onClick={() => navigate(`/pip/${id}/edit`)}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Edit Full PIP
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

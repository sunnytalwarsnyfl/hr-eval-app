import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import { pipApi } from '../api/pip'
import { employeesApi } from '../api/employees'
import client from '../api/client'

export default function PIPForm() {
  const navigate = useNavigate()
  const { id } = useParams() // present when editing
  const isEdit = Boolean(id)

  const [employees, setEmployees] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [loadingEvals, setLoadingEvals] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    employee_id: '',
    evaluation_id: '',
    action_plan: '',
    goals: '',
    expectations: '',
    timeline: '',
    next_pip_date: '',
    status: 'Active'
  })

  // Load employees list
  useEffect(() => {
    employeesApi.list({})
      .then(res => setEmployees(res.data.employees))
      .catch(e => console.error(e))
  }, [])

  // When editing: load existing PIP
  useEffect(() => {
    if (!isEdit) return
    async function loadPip() {
      try {
        const res = await pipApi.get(id)
        const pip = res.data.pip
        setForm({
          employee_id: String(pip.employee_id || ''),
          evaluation_id: String(pip.evaluation_id || ''),
          action_plan: pip.action_plan || '',
          goals: pip.goals || '',
          expectations: pip.expectations || '',
          timeline: pip.timeline || '',
          next_pip_date: pip.next_pip_date || '',
          status: pip.status || 'Active'
        })
        // Load evals for this employee
        if (pip.employee_id) {
          loadEvaluationsForEmployee(pip.employee_id)
        }
      } catch (e) {
        console.error(e)
        setError('Failed to load PIP data')
      } finally {
        setLoading(false)
      }
    }
    loadPip()
  }, [id])

  async function loadEvaluationsForEmployee(empId) {
    if (!empId) { setEvaluations([]); return }
    setLoadingEvals(true)
    try {
      const res = await client.get('/evaluations', { params: { employee_id: empId } })
      setEvaluations(res.data.evaluations || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingEvals(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name === 'employee_id') {
      setForm(prev => ({ ...prev, employee_id: value, evaluation_id: '' }))
      loadEvaluationsForEmployee(value)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        evaluation_id: parseInt(form.evaluation_id),
        action_plan: form.action_plan || null,
        goals: form.goals || null,
        expectations: form.expectations || null,
        timeline: form.timeline || null,
        next_pip_date: form.next_pip_date || null,
        status: form.status
      }
      if (isEdit) {
        await pipApi.update(id, payload)
      } else {
        await pipApi.create(payload)
      }
      navigate('/pip')
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} PIP`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading PIP data...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={() => navigate('/pip')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← Back to PIPs
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit PIP' : 'New Performance Improvement Plan'}</h1>
          <p className="text-sm text-gray-500 mt-1">{isEdit ? 'Update the PIP details below' : 'Fill in the PIP details below'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Employee selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee <span className="text-red-500">*</span></label>
              <select
                name="employee_id"
                required
                value={form.employee_id}
                onChange={handleChange}
                disabled={isEdit}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Select employee...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>
                ))}
              </select>
            </div>

            {/* Evaluation selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Evaluation <span className="text-red-500">*</span></label>
              <select
                name="evaluation_id"
                required
                value={form.evaluation_id}
                onChange={handleChange}
                disabled={!form.employee_id || isEdit}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">
                  {loadingEvals ? 'Loading evaluations...' : 'Select evaluation...'}
                </option>
                {evaluations.map(ev => {
                  const pct = ev.max_score > 0 ? Math.round(ev.total_score / ev.max_score * 100) : 0
                  return (
                    <option key={ev.id} value={ev.id}>
                      {ev.evaluation_date} — {ev.evaluation_type} — {ev.total_score}/{ev.max_score} ({pct}%) — {ev.passed ? 'Pass' : 'Fail'}
                    </option>
                  )
                })}
              </select>
              {form.employee_id && !loadingEvals && evaluations.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">No evaluations found for this employee.</p>
              )}
            </div>

            {/* Action Plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Plan</label>
              <textarea
                name="action_plan"
                value={form.action_plan}
                onChange={handleChange}
                rows={4}
                placeholder="Describe the specific actions the employee needs to take..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Goals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goals</label>
              <textarea
                name="goals"
                value={form.goals}
                onChange={handleChange}
                rows={4}
                placeholder="List the measurable goals that must be achieved..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Expectations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expectations & Standards</label>
              <textarea
                name="expectations"
                value={form.expectations}
                onChange={handleChange}
                rows={4}
                placeholder="Define the expectations and performance standards..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Timeline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
                <input
                  type="text"
                  name="timeline"
                  value={form.timeline}
                  onChange={handleChange}
                  placeholder="e.g. 90 days from evaluation date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Next PIP Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next PIP Date</label>
                <input
                  type="date"
                  name="next_pip_date"
                  value={form.next_pip_date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Extended">Extended</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create PIP'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/pip')}
                className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

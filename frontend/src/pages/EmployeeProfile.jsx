import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import StatusBadge from '../components/Shared/StatusBadge'
import { employeesApi } from '../api/employees'
import { complianceApi } from '../api/compliance'
import { settingsApi } from '../api/settings'
import { useAuth } from '../App'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

const COMPLIANCE_TYPES = ['Hepatitis B', 'Physical Exam', 'BLS', 'Certification', 'Other']

const BELT_LEVELS = [
  { value: '', label: 'None' },
  { value: 'White', label: 'White Belt' },
  { value: 'Yellow', label: 'Yellow Belt' },
  { value: 'Green', label: 'Green Belt' },
  { value: 'Blue', label: 'Blue Belt' },
  { value: 'Brown', label: 'Brown Belt' },
  { value: 'Black', label: 'Black Belt' },
]

function ComplianceModal({ onClose, onSaved, employeeId }) {
  const [form, setForm] = useState({
    requirement_type: 'Hepatitis B',
    expiration_date: '',
    renewed_date: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.requirement_type) { setError('Requirement type is required'); return }
    setSaving(true); setError('')
    try {
      await complianceApi.create({
        employee_id: employeeId,
        ...form,
        expiration_date: form.expiration_date || null,
        renewed_date: form.renewed_date || null,
        notes: form.notes || null
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Add Compliance Record</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requirement Type <span className="text-red-500">*</span></label>
            <select
              value={form.requirement_type}
              onChange={e => setForm(p => ({ ...p, requirement_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {COMPLIANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
              <input type="date" value={form.expiration_date}
                onChange={e => setForm(p => ({ ...p, expiration_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Renewed Date</label>
              <input type="date" value={form.renewed_date}
                onChange={e => setForm(p => ({ ...p, renewed_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} rows={3}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ComplianceSection({ employeeId }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { load() }, [employeeId])

  async function load() {
    try {
      const res = await complianceApi.list({ employee_id: employeeId })
      setRecords(res.data.data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSaved() {
    setShowModal(false)
    setLoading(true)
    await load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this compliance record?')) return
    try { await complianceApi.remove(id); load() }
    catch (e) { alert(e.response?.data?.error || 'Failed to delete') }
  }

  function statusBadge(record) {
    if (record.renewed_within_deadline === 1) {
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">On Time</span>
    }
    if (record.renewed_within_deadline === 0) {
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Late</span>
    }
    if (record.expiration_date) {
      const exp = new Date(record.expiration_date)
      if (exp < new Date()) {
        return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Expired</span>
      }
    }
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">Pending</span>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Compliance</h2>
        <button onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
          + Add Compliance Record
        </button>
      </div>
      {loading ? (
        <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
      ) : records.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">No compliance records on file.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Requirement</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expiration</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Renewed</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.requirement_type}</td>
                <td className="px-4 py-3 text-gray-600">{r.expiration_date || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.renewed_date || '—'}</td>
                <td className="px-4 py-3 text-center">{statusBadge(r)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={r.notes || ''}>{r.notes || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && <ComplianceModal employeeId={employeeId} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
    </div>
  )
}

const BELT_LEVEL_COLORS = {
  'White': 'bg-gray-100 text-gray-700 border border-gray-300',
  'Yellow': 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  'Green': 'bg-green-100 text-green-700 border border-green-300',
  'Blue': 'bg-blue-100 text-blue-700 border border-blue-300',
  'Brown': 'bg-amber-100 text-amber-800 border border-amber-300',
  'Black': 'bg-gray-900 text-white border border-gray-700',
}

export default function EmployeeProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [employee, setEmployee] = useState(null)
  const [evaluations, setEvaluations] = useState([])
  const [pipPlans, setPipPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteSending, setInviteSending] = useState(false)
  const [toast, setToast] = useState(null)

  // Inline edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [managers, setManagers] = useState([])
  const [departments, setDepartments] = useState([])
  const [facilities, setFacilities] = useState([])
  const [optionsLoaded, setOptionsLoaded] = useState(false)

  const canInviteSelfEval = user && ['admin', 'hr', 'manager'].includes(user.role)
  const canEdit = user && ['admin', 'hr'].includes(user.role)

  useEffect(() => { loadEmployee() }, [id])

  function showToast(message, type = 'success') {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSendSelfEvalInvite() {
    setInviteSending(true)
    setToast(null)
    try {
      const res = await employeesApi.inviteSelfEval(id)
      setToast({ type: 'success', message: `Self-eval invite sent to ${res.data.sent_to}` })
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Failed to send invite' })
    } finally {
      setInviteSending(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  async function loadEmployee() {
    try {
      const res = await employeesApi.get(id)
      setEmployee(res.data.employee)
      setEvaluations(res.data.evaluations)
      setPipPlans(res.data.pipPlans)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadEditOptions() {
    if (optionsLoaded) return
    try {
      const [mgrRes, deptRes, facRes] = await Promise.all([
        employeesApi.getManagers(),
        settingsApi.getDepartments(),
        settingsApi.getFacilities()
      ])
      setManagers(mgrRes.data.managers || [])
      setDepartments((deptRes.data.departments || []).filter(d => d.active))
      setFacilities((facRes.data.facilities || []).filter(f => f.active))
      setOptionsLoaded(true)
    } catch (e) {
      console.error('Failed to load edit options', e)
    }
  }

  function startEdit() {
    setEditError('')
    setEditForm({
      name: employee.name || '',
      work_email: employee.work_email || employee.email || '',
      phone_number: employee.phone_number || employee.phone || '',
      hire_date: employee.hire_date || '',
      anniversary_date: employee.anniversary_date || employee.hire_date || '',
      job_title: employee.job_title || '',
      department: employee.department || '',
      belt_level: employee.belt_level || employee.tech_level || '',
      employment_type: employee.employment_type || 'Permanent',
      is_leadership: !!(employee.is_leadership === 1 || employee.is_leadership === true),
      is_evaluator: !!(employee.is_evaluator === 1 || employee.is_evaluator === true),
      manager_id: employee.manager_id ? String(employee.manager_id) : '',
      facility_id: employee.facility_id ? String(employee.facility_id) : '',
    })
    setEditing(true)
    loadEditOptions()
  }

  function cancelEdit() {
    setEditing(false)
    setEditError('')
  }

  function handleEditChange(e) {
    const { name, value, type, checked } = e.target
    setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function saveEdit() {
    setEditError('')
    setSaving(true)
    try {
      const payload = {
        ...editForm,
        // Send both forms for backward compatibility
        email: editForm.work_email,
        phone: editForm.phone_number,
        manager_id: editForm.manager_id ? Number(editForm.manager_id) : null,
        facility_id: editForm.facility_id ? Number(editForm.facility_id) : null,
        belt_level: editForm.belt_level || null,
        is_leadership: editForm.is_leadership ? 1 : 0,
        is_evaluator: editForm.is_evaluator ? 1 : 0,
      }
      await employeesApi.update(id, payload)
      setEditing(false)
      await loadEmployee()
      showToast('Saved', 'success')
    } catch (err) {
      setEditError(err.response?.data?.error || err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading employee profile...</div>
        </div>
      </Layout>
    )
  }

  if (!employee) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Employee not found.</p>
          <button onClick={() => navigate('/employees')} className="mt-4 text-blue-600 hover:underline">Back</button>
        </div>
      </Layout>
    )
  }

  const chartData = evaluations
    .filter(ev => ev.status !== 'Draft' && ev.max_score > 0)
    .map(ev => ({
      date: ev.evaluation_date,
      pct: Math.round(ev.total_score / ev.max_score * 100),
      passed: ev.passed
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => navigate('/employees')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
              ← Back to Employees
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{employee.job_title} • {employee.department}</p>
          </div>
          <div className="flex items-center gap-2">
            {canInviteSelfEval && (
              <button
                onClick={handleSendSelfEvalInvite}
                disabled={inviteSending}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {inviteSending ? 'Sending...' : 'Send Self-Eval Invite'}
              </button>
            )}
            <button
              onClick={() => navigate('/evaluations/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Start New Evaluation
            </button>
          </div>
        </div>

        {toast && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Employee info card (with inline edit) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Employee Information</h2>
            {canEdit && !editing && (
              <button
                onClick={startEdit}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Edit
              </button>
            )}
            {editing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="text-sm border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {editError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {editError}
            </div>
          )}

          {!editing ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500 block text-xs mb-1">Name</span><span className="font-medium">{employee.name}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Work Email</span><span className="font-medium">{employee.work_email || employee.email || '—'}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Phone</span><span className="font-medium">{employee.phone_number || employee.phone || '—'}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Department</span><span className="font-medium">{employee.department}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Job Title</span><span className="font-medium">{employee.job_title}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Belt Level</span>
                <span className="font-medium">
                  {(employee.belt_level || employee.tech_level) ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${BELT_LEVEL_COLORS[employee.belt_level || employee.tech_level] || 'bg-blue-100 text-blue-700'}`}>{employee.belt_level || employee.tech_level}</span>
                  ) : 'N/A'}
                </span>
              </div>
              <div><span className="text-gray-500 block text-xs mb-1">Hire Date</span><span className="font-medium">{employee.hire_date || '—'}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Anniversary Date</span><span className="font-medium">{employee.anniversary_date || employee.hire_date || '—'}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Employment Type</span><span className="font-medium">{employee.employment_type || '—'}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Manager</span><span className="font-medium">{employee.manager_name || 'N/A'}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Facility</span><span className="font-medium">{employee.facility_name || '—'}</span></div>
              <div><span className="text-gray-500 block text-xs mb-1">Roles</span>
                <span className="font-medium text-xs">
                  {[
                    (employee.is_leadership === 1 || employee.is_leadership === true) ? 'Leadership' : null,
                    (employee.is_evaluator === 1 || employee.is_evaluator === true) ? 'Evaluator' : null,
                  ].filter(Boolean).join(', ') || '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Work Email</label>
                <input
                  type="email"
                  name="work_email"
                  value={editForm.work_email}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone_number"
                  value={editForm.phone_number}
                  onChange={handleEditChange}
                  placeholder="(555) 123-4567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hire Date</label>
                <input
                  type="date"
                  name="hire_date"
                  value={editForm.hire_date}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Anniversary Date</label>
                <input
                  type="date"
                  name="anniversary_date"
                  value={editForm.anniversary_date}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Job Title</label>
                <input
                  type="text"
                  name="job_title"
                  value={editForm.job_title}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select
                  name="department"
                  value={editForm.department}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                  {/* Fallback: keep current value visible if not in loaded list */}
                  {editForm.department && !departments.some(d => d.name === editForm.department) && (
                    <option value={editForm.department}>{editForm.department}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Belt Level</label>
                <select
                  name="belt_level"
                  value={editForm.belt_level}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {BELT_LEVELS.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employment Type</label>
                <select
                  name="employment_type"
                  value={editForm.employment_type}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="Permanent">Permanent</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Manager</label>
                <select
                  name="manager_id"
                  value={editForm.manager_id}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">No manager assigned</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}{m.department ? ` (${m.department})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Facility / Client Site</label>
                <select
                  name="facility_id"
                  value={editForm.facility_id}
                  onChange={handleEditChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">No facility assigned</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}{f.city ? ` — ${f.city}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_leadership"
                    checked={!!editForm.is_leadership}
                    onChange={handleEditChange}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Leadership Position</span>
                </label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_evaluator"
                    checked={!!editForm.is_evaluator}
                    onChange={handleEditChange}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Add as Evaluator</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Score trend chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Score Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => `${v}%`} />
                <ReferenceLine y={93} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Passing', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Evaluation history */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Evaluation History</h2>
          </div>
          {evaluations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No evaluations on record.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Score</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Result</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evaluations.map(ev => {
                  const pct = ev.max_score > 0 ? Math.round(ev.total_score / ev.max_score * 100) : 0
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/evaluations/${ev.id}`)}>
                      <td className="px-4 py-3 text-gray-600">{ev.evaluation_date}</td>
                      <td className="px-4 py-3 text-gray-600">{ev.evaluation_type}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {ev.total_score}/{ev.max_score} ({pct}%)
                      </td>
                      <td className="px-4 py-3 text-center">
                        {ev.status !== 'Draft' && <StatusBadge status={ev.passed ? 'Pass' : 'Fail'} />}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={ev.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-blue-600 text-xs font-medium">View →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Compliance Records */}
        <ComplianceSection employeeId={employee.id} />

        {/* PIP Plans */}
        {pipPlans.length > 0 && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
            <h2 className="font-semibold text-yellow-800 mb-4">Active PIP Plans</h2>
            <div className="space-y-4">
              {pipPlans.map(pip => (
                <div key={pip.id} className="bg-white rounded-lg p-4 border border-yellow-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {pip.goals && (
                      <div className="col-span-2">
                        <p className="font-medium text-gray-700 mb-1">Goals</p>
                        <p className="text-gray-600">{pip.goals}</p>
                      </div>
                    )}
                    {pip.timeline && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Timeline</p>
                        <p className="text-gray-600">{pip.timeline}</p>
                      </div>
                    )}
                    {pip.next_pip_date && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Next PIP Date</p>
                        <p className="text-gray-600">{pip.next_pip_date}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

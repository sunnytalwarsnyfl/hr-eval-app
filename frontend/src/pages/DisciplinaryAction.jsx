import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Shared/Layout'
import { disciplinaryApi } from '../api/logs'
import { employeesApi } from '../api/employees'

const VIOLATION_TYPES = [
  { key: 'Conduct',                value: 'Conduct' },
  { key: 'Safety',                 value: 'Safety' },
  { key: 'Substandard Performance', value: 'Substandard Performance' },
  { key: 'Quality (QA)',           value: 'Quality (QA)',         note: 'Link to QA Log entries' },
  { key: 'Attendance',             value: 'Attendance',           note: 'Link to Attendance Log entries' },
  { key: 'Time-Tracking',          value: 'Time-Tracking' },
  { key: 'Away from Workstation',  value: 'Away from Workstation' },
]

const ACTION_LEVELS = [
  'Verbal Warning',
  'Counseling with Additional Training',
  '1st Warning',
  '2nd Warning',
  'Final Warning',
  'Termination',
]

const MONITORING_PERIODS = ['30 Days', '15 Days', '45 Days', '60 Days']
const TYPE_OPTIONS = ['New', 'Extension']

const ACKNOWLEDGMENT = "By signing below, I acknowledge the terms set forth and will strive to improve in the areas of concern. I further understand that failure to correct the behavior and/or further violation of company policy will result in additional disciplinary action up to and including termination."

const STATUS_BADGES = {
  'Pending HR Review':           'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'Approved':                    'bg-blue-100 text-blue-700 border border-blue-200',
  'Active':                      'bg-orange-100 text-orange-700 border border-orange-200',
  'Complete - Met Expectations': 'bg-green-100 text-green-700 border border-green-200',
  'Incomplete - Did Not Meet':   'bg-red-100 text-red-700 border border-red-200',
}

function statusClass(status) {
  return STATUS_BADGES[status] || 'bg-gray-100 text-gray-700 border border-gray-200'
}

async function uploadFile(file, endpoint) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    body: formData
  })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

function calcRollOff(dateStr, period = '30 Days') {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const days = parseInt(String(period).match(/\d+/)?.[0] || '30', 10)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function DisciplinaryAction() {
  const [entries, setEntries] = useState([])
  const [employees, setEmployees] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const initialForm = {
    employee_id: '',
    position: '',
    facility: '',
    shift: '',
    date_of_incident: '',
    violations: [],
    other_violation: '',
    details: '',
    action_level: '',
    improvement_plan: '',
    consequence_type: '', // 'Unpaid Suspension' | 'Other' | 'Immediate Termination'
    suspension_days: '',
    consequence_other: '',
    policy_attached: 'No',
    attachment_path: '',
    monitoring_period: '30 Days',
    type: 'New',
    issuance_date: '',
  }

  const [form, setForm] = useState(initialForm)
  const [attachmentFile, setAttachmentFile] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [entriesRes, empRes] = await Promise.all([
        disciplinaryApi.list(),
        employeesApi.list()
      ])
      setEntries(entriesRes.data.data || entriesRes.data.entries || entriesRes.data || [])
      const emps = empRes.data.employees || []
      setEmployees(emps)
      const facSet = new Set()
      emps.forEach(e => {
        const f = e.facility_name || e.worksite || e.facility
        if (f) facSet.add(f)
      })
      setFacilities(Array.from(facSet))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const selectedEmployee = useMemo(
    () => employees.find(e => String(e.id) === String(form.employee_id)),
    [employees, form.employee_id]
  )

  // Auto-fill position + facility when employee changes
  useEffect(() => {
    if (selectedEmployee) {
      const empPosition = selectedEmployee.position || selectedEmployee.job_title || ''
      const empFacility = selectedEmployee.facility_name || selectedEmployee.worksite || selectedEmployee.facility || ''
      setForm(prev => ({
        ...prev,
        position: prev.position || empPosition,
        facility: prev.facility || empFacility,
      }))
    }
  }, [selectedEmployee])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function toggleViolation(v) {
    setForm(prev => {
      const has = prev.violations.includes(v)
      const next = has ? prev.violations.filter(x => x !== v) : [...prev.violations, v]
      return { ...prev, violations: next }
    })
  }

  function toggleOther() {
    setForm(prev => {
      const has = prev.violations.includes('Other')
      const next = has ? prev.violations.filter(x => x !== 'Other') : [...prev.violations, 'Other']
      return { ...prev, violations: next, other_violation: has ? '' : prev.other_violation }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // Upload file first if present
      let attachment_path = form.attachment_path || ''
      if (attachmentFile) {
        try {
          const uploadRes = await uploadFile(attachmentFile, '/api/disciplinary/upload')
          attachment_path = uploadRes.path
        } catch (uploadErr) {
          setError('File upload failed: ' + uploadErr.message)
          setSubmitting(false)
          return
        }
      }

      // Build violation_types array
      const violationList = form.violations.filter(v => v !== 'Other')
      if (form.violations.includes('Other') && form.other_violation.trim()) {
        violationList.push(`Other: ${form.other_violation.trim()}`)
      }

      // Find facility_id if available from employee record
      const facility_id = selectedEmployee?.facility_id || null

      const payload = {
        employee_id: parseInt(form.employee_id),
        facility_id,
        facility: form.facility,
        position: form.position,
        shift: form.shift,
        date_of_incident: form.date_of_incident,
        issuance_date: form.issuance_date,
        monitoring_period: form.monitoring_period,
        type: form.type,
        violation_types: JSON.stringify(violationList),
        action_level: form.action_level,
        details: form.details,
        improvement_plan: form.improvement_plan,
        consequence_if_continued:
          form.consequence_type === 'Unpaid Suspension'
            ? `Unpaid Suspension for ${form.suspension_days} day(s)`
            : form.consequence_type === 'Other'
              ? form.consequence_other
              : form.consequence_type === 'Immediate Termination'
                ? 'N/A: Immediate Termination'
                : '',
        consequence_type: form.consequence_type,
        suspension_days: form.consequence_type === 'Unpaid Suspension' ? parseInt(form.suspension_days || '0', 10) : 0,
        policy_attached: form.policy_attached === 'Yes' ? 1 : 0,
        attachment_path,
        roll_off_date: calcRollOff(form.issuance_date, form.monitoring_period),
      }
      await disciplinaryApi.create(payload)
      setForm(initialForm)
      setAttachmentFile(null)
      setShowForm(false)
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(id) {
    try {
      await disciplinaryApi.approve(id)
      loadData()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Failed to approve')
    }
  }

  function parseViolations(entry) {
    const raw = entry.violation_types ?? entry.violations ?? entry.issue
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : [String(raw)]
      } catch {
        return [raw]
      }
    }
    return []
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Disciplinary Action</h1>
            <p className="text-sm text-gray-500 mt-1">Issue and track formal disciplinary write-ups</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Write-Up'}
          </button>
        </div>

        {/* Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Notification will be sent to HR@sipsconsults.com and the employee on save. Status begins as "Pending HR Review".
        </div>

        {/* Inline form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">New Disciplinary Write-Up</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* GROUP 1: Employee Info */}
              <fieldset className="border border-gray-200 rounded-lg p-5">
                <legend className="px-2 text-sm font-semibold text-gray-700">Employee Information</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee <span className="text-red-500">*</span></label>
                    <select name="employee_id" required value={form.employee_id} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Select employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position / Job Title</label>
                    <input type="text" name="position" value={form.position} onChange={handleChange}
                      placeholder="Auto-fills from employee"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Facility</label>
                    {facilities.length > 0 ? (
                      <select name="facility" value={form.facility} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Select facility...</option>
                        {facilities.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" name="facility" value={form.facility} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                    <input type="text" name="shift" value={form.shift} onChange={handleChange}
                      placeholder="e.g. Day, Night, 7-3"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </fieldset>

              {/* GROUP 2: Incident Details */}
              <fieldset className="border border-gray-200 rounded-lg p-5">
                <legend className="px-2 text-sm font-semibold text-gray-700">Incident Details</legend>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Incident <span className="text-red-500">*</span></label>
                    <input type="date" name="date_of_incident" required value={form.date_of_incident} onChange={handleChange}
                      className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type of Violation (check all that apply)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {VIOLATION_TYPES.map(v => {
                        const checked = form.violations.includes(v.value)
                        return (
                          <label key={v.key} className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleViolation(v.value)}
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <span className="text-sm text-gray-800">{v.value}</span>
                              {v.note && checked && (
                                <div className="text-xs text-blue-600 mt-0.5 italic">{v.note}</div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                      <label className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${form.violations.includes('Other') ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                        <input
                          type="checkbox"
                          checked={form.violations.includes('Other')}
                          onChange={toggleOther}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-gray-800">Other</span>
                          {form.violations.includes('Other') && (
                            <input
                              type="text"
                              name="other_violation"
                              value={form.other_violation}
                              onChange={handleChange}
                              placeholder="Specify..."
                              className="mt-2 w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Description of Violation <span className="text-red-500">*</span></label>
                    <textarea name="details" required value={form.details} onChange={handleChange} rows={5}
                      placeholder="Describe what happened, when, who was involved, and any prior conversations..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </fieldset>

              {/* GROUP 3: Disciplinary Action */}
              <fieldset className="border border-gray-200 rounded-lg p-5">
                <legend className="px-2 text-sm font-semibold text-gray-700">Disciplinary Action</legend>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Action Level <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {ACTION_LEVELS.map(a => (
                        <label key={a} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${form.action_level === a ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                          <input
                            type="radio"
                            name="action_level"
                            value={a}
                            checked={form.action_level === a}
                            onChange={handleChange}
                            required
                          />
                          <span className="text-sm text-gray-800">{a}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Counseled — Plan for Improvement</label>
                    <textarea name="improvement_plan" value={form.improvement_plan} onChange={handleChange} rows={3}
                      placeholder="Describe expectations, training, and goals..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">If Continued, Next Step</label>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-2 rounded border cursor-pointer ${form.consequence_type === 'Unpaid Suspension' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                        <input
                          type="radio"
                          name="consequence_type"
                          value="Unpaid Suspension"
                          checked={form.consequence_type === 'Unpaid Suspension'}
                          onChange={handleChange}
                        />
                        <span className="text-sm text-gray-800">Unpaid Suspension for</span>
                        {form.consequence_type === 'Unpaid Suspension' && (
                          <input
                            type="number"
                            min="1"
                            name="suspension_days"
                            value={form.suspension_days}
                            onChange={handleChange}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        )}
                        {form.consequence_type === 'Unpaid Suspension' && <span className="text-sm text-gray-700">day(s)</span>}
                      </label>
                      <label className={`flex items-center gap-3 p-2 rounded border cursor-pointer ${form.consequence_type === 'Other' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                        <input
                          type="radio"
                          name="consequence_type"
                          value="Other"
                          checked={form.consequence_type === 'Other'}
                          onChange={handleChange}
                        />
                        <span className="text-sm text-gray-800">Other:</span>
                        {form.consequence_type === 'Other' && (
                          <input
                            type="text"
                            name="consequence_other"
                            value={form.consequence_other}
                            onChange={handleChange}
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        )}
                      </label>
                      <label className={`flex items-center gap-3 p-2 rounded border cursor-pointer ${form.consequence_type === 'Immediate Termination' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                        <input
                          type="radio"
                          name="consequence_type"
                          value="Immediate Termination"
                          checked={form.consequence_type === 'Immediate Termination'}
                          onChange={handleChange}
                        />
                        <span className="text-sm text-gray-800">N/A: Immediate Termination</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company policy attached?</label>
                      <div className="flex gap-4">
                        {['Yes', 'No'].map(v => (
                          <label key={v} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="policy_attached"
                              value={v}
                              checked={form.policy_attached === v}
                              onChange={handleChange}
                            />
                            <span className="text-sm text-gray-800">{v}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (photo/PDF)</label>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={e => setAttachmentFile(e.target.files[0] || null)}
                        className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {attachmentFile && (
                        <span className="text-xs text-gray-500 mt-1 inline-block">
                          {attachmentFile.name} ({Math.round(attachmentFile.size / 1024)} KB)
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Monitoring Period</label>
                      <select name="monitoring_period" value={form.monitoring_period} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {MONITORING_PERIODS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select name="type" value={form.type} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {TYPE_OPTIONS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issuance Date <span className="text-red-500">*</span></label>
                      <input type="date" name="issuance_date" required value={form.issuance_date} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Roll-Off Date (auto)</label>
                      <input type="text" readOnly
                        value={calcRollOff(form.issuance_date, form.monitoring_period) || `Auto (${form.monitoring_period} from issuance)`}
                        className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Acknowledgment */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 italic">
                {ACKNOWLEDGMENT}
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={submitting}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {submitting ? 'Saving...' : 'Save Write-Up'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (Array.isArray(entries) && entries.length === 0) ? (
            <div className="p-8 text-center text-gray-500">No disciplinary entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Facility</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Violations</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Action Level</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Monitoring</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Roll-Off</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Attachment</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(Array.isArray(entries) ? entries : []).map(entry => {
                    const violations = parseViolations(entry)
                    const status = entry.status || 'Pending HR Review'
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{entry.employee_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.facility || entry.facility_name || entry.worksite || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.date_of_incident || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                          {violations.length === 0 ? '—' : (
                            <div className="flex flex-wrap gap-1">
                              {violations.map((v, i) => (
                                <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">{v}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{entry.action_level || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(status)}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{entry.monitoring_period || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.roll_off_date || '—'}</td>
                        <td className="px-4 py-3">
                          {entry.attachment_path ? (
                            <a
                              href={entry.attachment_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 text-xs hover:underline"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {status === 'Pending HR Review' ? (
                            <button
                              onClick={() => handleApprove(entry.id)}
                              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                            >
                              Approve
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
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

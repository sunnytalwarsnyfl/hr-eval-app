import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Shared/Layout'
import { qaLogApi } from '../api/logs'
import { employeesApi } from '../api/employees'

const ISSUE_TYPES = [
  { type: 'Bio Burden',                            description: 'Visible debris on instruments or trays',     points: 4 },
  { type: 'Broken Instruments in Set',             description: 'Nonfunctional or breached integrity',        points: 4 },
  { type: 'Incorrect Instruments in Set',          description: 'Adverse to Count sheet',                     points: 2 },
  { type: 'Missing Instrument Documented as Found', description: '',                                          points: 2 },
  { type: 'Missing Tray Filters',                  description: '',                                            points: 2 },
  { type: 'Incomplete Trays',                      description: 'Not on count sheet',                          points: 2 },
  { type: 'Incorrect Tray on Case Carts',          description: '',                                            points: 2 },
  { type: 'Incorrect Decontamination Process',     description: '',                                            points: 2 },
]

const STATUS_OPTIONS = ['Complete - Met Expectations', 'Incomplete']

const THRESHOLDS = [
  { pts: 2,  action: 'Verbal Warning',                       color: 'bg-yellow-100 text-yellow-700' },
  { pts: 4,  action: 'Written Warning with Counseling',      color: 'bg-orange-100 text-orange-700' },
  { pts: 6,  action: 'Written Warning + Additional Training', color: 'bg-orange-200 text-orange-800' },
  { pts: 8,  action: 'Final Written Warning',                color: 'bg-red-100 text-red-700' },
  { pts: 10, action: 'Termination',                          color: 'bg-red-200 text-red-800' },
]

function getActionForPoints(accum) {
  let result = ''
  for (const t of THRESHOLDS) {
    if (accum >= t.pts) result = t.action
  }
  return result
}

function getIssueMeta(type) {
  return ISSUE_TYPES.find(i => i.type === type)
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

export default function QALog() {
  const [entries, setEntries] = useState([])
  const [employees, setEmployees] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    employee_id: '',
    facility: '',
    date_of_incident: '',
    issue_type: '',
    description: '',
    status: '',
    action_step: '',
    employee_initials: '',
    manager_initials: '',
  })
  const [attachmentFile, setAttachmentFile] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [entriesRes, empRes] = await Promise.all([
        qaLogApi.list(),
        employeesApi.list()
      ])
      setEntries(entriesRes.data.data || entriesRes.data.entries || entriesRes.data || [])
      const emps = empRes.data.employees || []
      setEmployees(emps)
      // Build a unique facility list from employees
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

  useEffect(() => {
    if (selectedEmployee) {
      const empFacility = selectedEmployee.facility_name || selectedEmployee.worksite || selectedEmployee.facility || ''
      if (empFacility && !form.facility) {
        setForm(prev => ({ ...prev, facility: empFacility }))
      }
    }
  }, [selectedEmployee])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function calcRollOff(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    d.setMonth(d.getMonth() + 6)
    return d.toISOString().split('T')[0]
  }

  const issueMeta = getIssueMeta(form.issue_type)
  const issuePoints = issueMeta ? issueMeta.points : 0

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // Upload file first if present
      let attachment_path = null
      if (attachmentFile) {
        try {
          const uploadRes = await uploadFile(attachmentFile, '/api/qa-log/upload')
          attachment_path = uploadRes.path
        } catch (uploadErr) {
          setError('File upload failed: ' + uploadErr.message)
          setSubmitting(false)
          return
        }
      }

      const payload = {
        employee_id: parseInt(form.employee_id),
        facility: form.facility,
        date_of_incident: form.date_of_incident,
        issue_type: form.issue_type,
        issue: form.issue_type, // for back-compat
        description: form.description,
        status: form.status,
        action_step: form.action_step,
        employee_initials: form.employee_initials,
        manager_initials: form.manager_initials,
        points: issuePoints,
        roll_off_date: calcRollOff(form.date_of_incident),
        attachment_path,
      }
      await qaLogApi.create(payload)
      setForm({
        employee_id: '',
        facility: '',
        date_of_incident: '',
        issue_type: '',
        description: '',
        status: '',
        action_step: '',
        employee_initials: '',
        manager_initials: '',
      })
      setAttachmentFile(null)
      setShowForm(false)
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create entry')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QA Log</h1>
            <p className="text-sm text-gray-500 mt-1">Track quality assurance incidents and actions</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>

        {/* Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Manager will be notified on save. Disciplinary actions auto-trigger based on accumulated points.
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Inline form */}
            {showForm && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">New QA Entry</h2>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Incident <span className="text-red-500">*</span></label>
                      <input type="date" name="date_of_incident" required value={form.date_of_incident} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issue Points (auto)</label>
                      <input type="text" readOnly value={form.issue_type ? `${issuePoints} pts` : 'Auto from issue type'}
                        className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type <span className="text-red-500">*</span></label>
                      <select name="issue_type" required value={form.issue_type} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Select issue type...</option>
                        {ISSUE_TYPES.map(o => (
                          <option key={o.type} value={o.type}>
                            {o.type}{o.description ? ` — ${o.description}` : ''} ({o.points} pts)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description of QA Incident</label>
                      <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Action Required (auto)</label>
                      <input type="text" readOnly
                        value={form.issue_type ? (getActionForPoints(issuePoints) || 'No action threshold reached yet') : 'Will display after save based on accumulated points'}
                        className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                      <select name="status" required value={form.status} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Select status...</option>
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Roll-Off Date</label>
                      <input type="text" readOnly value={calcRollOff(form.date_of_incident) || 'Auto-calculated (6 months)'}
                        className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Action Step</label>
                      <textarea name="action_step" value={form.action_step} onChange={handleChange} rows={2}
                        placeholder="HR reviews, enter points, request applicable bonus in HRIS, Belt Level Score"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee Initials</label>
                      <input type="text" name="employee_initials" value={form.employee_initials} onChange={handleChange} maxLength={5}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Initials</label>
                      <input type="text" name="manager_initials" value={form.manager_initials} onChange={handleChange} maxLength={5}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (photo/PDF)</label>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={e => setAttachmentFile(e.target.files[0] || null)}
                        className="text-sm block w-full file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {attachmentFile && (
                        <span className="text-xs text-gray-500 mt-1 inline-block">
                          Selected: {attachmentFile.name} ({Math.round(attachmentFile.size / 1024)} KB)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="submit" disabled={submitting}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {submitting ? 'Saving...' : 'Save Entry'}
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
                <div className="p-8 text-center text-gray-500">No QA entries found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Facility</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Issue Type</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Points</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">Accumulated</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Roll-Off</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Action Required</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Attachment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(Array.isArray(entries) ? entries : []).map(entry => {
                        const accum = entry.accumulated_points ?? entry.points ?? 0
                        const actionTaken = entry.action_taken || entry.action_required || getActionForPoints(accum) || '—'
                        return (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{entry.employee_name || '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{entry.facility || entry.facility_name || entry.worksite || '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{entry.date_of_incident || '—'}</td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.issue_type || entry.issue || '—'}</td>
                            <td className="px-4 py-3 text-center font-medium">{entry.points ?? entry.issue_points ?? '—'}</td>
                            <td className="px-4 py-3 text-center font-medium">{accum}</td>
                            <td className="px-4 py-3 text-gray-600">{entry.roll_off_date || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{actionTaken}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                entry.status === 'Complete - Met Expectations' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>{entry.status || '—'}</span>
                            </td>
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
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Threshold reference */}
          <aside className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Disciplinary Thresholds</h3>
              <p className="text-xs text-gray-500 mb-4">Auto-triggered when accumulated QA points reach the levels below.</p>
              <ul className="space-y-2">
                {THRESHOLDS.map(t => (
                  <li key={t.pts} className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${t.color} min-w-[3rem] text-center`}>
                      {t.pts} pts
                    </span>
                    <span className="text-sm text-gray-700">{t.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}

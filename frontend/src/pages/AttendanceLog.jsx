import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Shared/Layout'
import { attendanceApi } from '../api/logs'
import { employeesApi } from '../api/employees'

const OCCURRENCE_CODES = [
  { code: 'A',    label: 'Absent 1 day',           points: 1.0 },
  { code: 'A3',   label: 'Absent 3+ days',         points: 1.0 },
  { code: 'AA',   label: 'Approved Absence',       points: 0   },
  { code: 'N',    label: 'No Call/No Show',        points: 1.0 },
  { code: 'S',    label: 'Suspension',             points: 0   },
  { code: 'T15',  label: 'Tardy 1-15 min',         points: 0.25 },
  { code: 'T30',  label: 'Tardy 16-30 min',        points: 0.50 },
  { code: 'T120', label: 'Tardy 31-120 min',       points: 0.75 },
  { code: 'T121', label: 'Tardy 121+ min',         points: 1.0 },
  { code: 'E15',  label: 'Early Out 1-15 min',     points: 0.25 },
  { code: 'E30',  label: 'Early Out 16-30 min',    points: 0.50 },
  { code: 'E120', label: 'Early Out 31-120 min',   points: 0.75 },
  { code: 'E121', label: 'Early Out 121+ min',     points: 1.0 },
  { code: 'TT',   label: 'Time Tracking violation', points: 1.0 },
  { code: 'W',    label: 'Workers Comp',           points: 0   },
]

const DESCRIPTION_TYPES = ['Sick/Medical', 'Vacation', 'Personal', 'Other']

function deriveOccurrenceType(code) {
  if (!code) return ''
  if (code === 'A' || code === 'A3' || code === 'AA') return 'Call-Out'
  if (code.startsWith('T')) return 'Tardy'
  if (code.startsWith('E')) return 'Early Out'
  if (code === 'N') return 'No Call No Show'
  if (code === 'S') return 'Suspension'
  if (code === 'W') return 'Workers Comp'
  if (code === 'TT') return 'Time Tracking'
  return ''
}

function getCodeMeta(code) {
  return OCCURRENCE_CODES.find(o => o.code === code)
}

export default function AttendanceLog() {
  const [entries, setEntries] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    employee_id: '',
    facility: '',
    date_of_occurrence: '',
    time_of_request: '',
    occurrence_code: '',
    description_type: '',
    description: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [entriesRes, empRes] = await Promise.all([
        attendanceApi.list(),
        employeesApi.list()
      ])
      setEntries(entriesRes.data.data || entriesRes.data.entries || entriesRes.data || [])
      setEmployees(empRes.data.employees || [])
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

  // Auto-fill facility when employee is selected
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

  const codeMeta = getCodeMeta(form.occurrence_code)
  const autoPoints = codeMeta ? codeMeta.points : 0

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        employee_id: parseInt(form.employee_id),
        facility: form.facility,
        date_of_occurrence: form.date_of_occurrence,
        time_of_request: form.time_of_request,
        occurrence_code: form.occurrence_code,
        occurrence_type: deriveOccurrenceType(form.occurrence_code),
        description_type: form.description_type,
        description: form.description,
        accumulated_points: autoPoints,
        points: autoPoints,
        roll_off_date: calcRollOff(form.date_of_occurrence)
      }
      await attendanceApi.create(payload)
      setForm({
        employee_id: '',
        facility: '',
        date_of_occurrence: '',
        time_of_request: '',
        occurrence_code: '',
        description_type: '',
        description: '',
      })
      setShowForm(false)
      loadData()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAcknowledge(id) {
    try {
      await attendanceApi.acknowledge(id)
      loadData()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Failed to acknowledge')
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Log</h1>
            <p className="text-sm text-gray-500 mt-1">Track employee attendance occurrences and points</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Attendance points roll off in the order received; the oldest points roll off first. Example: Points received Jan 1 roll off July 1.
        </div>

        {/* Future integration note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          Future integration: Automated attendance phone line can be connected here.
        </div>

        {/* Phone integration banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-700">
          <strong>Future Integration:</strong> Automated Attendance Phone Line (972-833-2121) — entries can be auto-logged when integrated.
        </div>

        {/* Inline form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Attendance Entry</h2>
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
                  <input type="text" name="facility" value={form.facility} onChange={handleChange}
                    placeholder="Auto-fills from employee, or enter manually"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Occurrence <span className="text-red-500">*</span></label>
                  <input type="date" name="date_of_occurrence" required value={form.date_of_occurrence} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time of Request</label>
                  <input type="time" name="time_of_request" value={form.time_of_request} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Occurrence Code <span className="text-red-500">*</span></label>
                  <select name="occurrence_code" required value={form.occurrence_code} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select code...</option>
                    {OCCURRENCE_CODES.map(o => (
                      <option key={o.code} value={o.code}>
                        {o.code} — {o.label} ({o.points} pts)
                      </option>
                    ))}
                  </select>
                  {codeMeta && (
                    <div className="mt-2 text-xs text-gray-500">
                      Derived type: <span className="font-medium text-gray-700">{deriveOccurrenceType(form.occurrence_code)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description Type</label>
                  <select name="description_type" value={form.description_type} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select type...</option>
                    {DESCRIPTION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points (auto)</label>
                  <input type="text" readOnly value={form.occurrence_code ? `${autoPoints} pts` : 'Auto-calculated from code'}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll-Off Date (auto)</label>
                  <input type="text" readOnly value={calcRollOff(form.date_of_occurrence) || 'Auto-calculated (6 months)'}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <div className="p-8 text-center text-gray-500">No attendance entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Facility</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Points</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Accumulated</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Roll-Off</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Acknowledged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(Array.isArray(entries) ? entries : []).map(entry => {
                    const ack = entry.acknowledged === 1 || entry.acknowledged === true
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{entry.employee_name || entry.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.facility || entry.facility_name || entry.worksite || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.date_of_occurrence || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{entry.occurrence_code || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.occurrence_type || '—'}</td>
                        <td className="px-4 py-3 text-center font-medium">{entry.points ?? '—'}</td>
                        <td className="px-4 py-3 text-center font-medium">{entry.accumulated_points ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.roll_off_date || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {ack ? (
                            <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                              <span className="w-4 h-4 inline-flex items-center justify-center bg-green-100 rounded-full">✓</span>
                              Acknowledged
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAcknowledge(entry.id)}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Acknowledge
                            </button>
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

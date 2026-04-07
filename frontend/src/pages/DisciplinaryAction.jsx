import { useState, useEffect } from 'react'
import Layout from '../components/Shared/Layout'
import { disciplinaryApi } from '../api/logs'
import { employeesApi } from '../api/employees'

const ISSUE_OPTIONS = [
  'Bio Burden: Visible debris on instruments or trays',
  'Broken instruments in set: Nonfunctional or breached integrity',
  'Incorrect instrument(s) in set: Adverse to Count sheet requirement',
  'Missing instrument documented as found: Undocumented instruments',
  'Missing tray filters: Missing tray filters',
  'Incomplete trays: Missing instruments not identified as missing on count sheet',
  'Incorrect tray on Case Carts: Adverse to preference card requirement',
  'Incorrect decontamination process: Not using the proper decontamination process',
]

const MONITORING_PERIODS = ['30 Days', '15 Days', '45 Days', '60 Days']
const TYPE_OPTIONS = ['New', 'Extension']
const STATUS_OPTIONS = ['Complete - Met Expectations', 'Incomplete']

export default function DisciplinaryAction() {
  const [entries, setEntries] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    employee_id: '',
    date_of_incident: '',
    issue: '',
    details: '',
    issuance_date: '',
    monitoring_period: '',
    type: '',
    status: '',
    next_step: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [entriesRes, empRes] = await Promise.all([
        disciplinaryApi.list(),
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

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function calcRollOff(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        employee_id: parseInt(form.employee_id),
        roll_off_date: calcRollOff(form.issuance_date)
      }
      await disciplinaryApi.create(payload)
      setForm({ employee_id: '', date_of_incident: '', issue: '', details: '', issuance_date: '', monitoring_period: '', type: '', status: '', next_step: '' })
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
            <h1 className="text-2xl font-bold text-gray-900">Disciplinary Action</h1>
            <p className="text-sm text-gray-500 mt-1">Track disciplinary incidents and corrective actions</p>
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
          Notification will be sent to HR@sipsconsults.com and the employee on save.
        </div>

        {/* Inline form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Disciplinary Entry</h2>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Incident <span className="text-red-500">*</span></label>
                  <input type="date" name="date_of_incident" required value={form.date_of_incident} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue <span className="text-red-500">*</span></label>
                  <select name="issue" required value={form.issue} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select issue...</option>
                    {ISSUE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Details of Incident</label>
                  <textarea name="details" value={form.details} onChange={handleChange} rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issuance Date <span className="text-red-500">*</span></label>
                  <input type="date" name="issuance_date" required value={form.issuance_date} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll-Off Date</label>
                  <input type="text" readOnly value={calcRollOff(form.issuance_date) || 'Auto-calculated (30 days from issuance)'}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monitoring Period <span className="text-red-500">*</span></label>
                  <select name="monitoring_period" required value={form.monitoring_period} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select period...</option>
                    {MONITORING_PERIODS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select name="type" required value={form.type} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Select type...</option>
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">If Continued - Next Step</label>
                  <input type="text" name="next_step" value={form.next_step} onChange={handleChange}
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
            <div className="p-8 text-center text-gray-500">No disciplinary entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Employee Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Worksite</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Job Title</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date of Incident</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Issue</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Accum. Points</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Issuance Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Monitoring</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Roll-Off Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Next Step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(Array.isArray(entries) ? entries : []).map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{entry.employee_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.worksite || entry.facility_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.job_title || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.date_of_incident || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.issue || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.details || '—'}</td>
                      <td className="px-4 py-3 text-center font-medium">{entry.accumulated_points ?? entry.points ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.issuance_date || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.monitoring_period || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.type || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          entry.status === 'Complete - Met Expectations' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{entry.status || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{entry.roll_off_date || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.next_step || '—'}</td>
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

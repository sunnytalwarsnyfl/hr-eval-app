import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import { employeesApi } from '../api/employees'
import { settingsApi } from '../api/settings'

const BELT_LEVELS = [
  { value: 'White', label: 'White Belt', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'Yellow', label: 'Yellow Belt', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'Green', label: 'Green Belt', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'Blue', label: 'Blue Belt', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'Brown', label: 'Brown Belt', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'Black', label: 'Black Belt', color: 'bg-gray-900 text-white border-gray-700' },
]

export default function EditEmployee() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [managers, setManagers] = useState([])
  const [departments, setDepartments] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    hire_date: '',
    department: '',
    job_title: '',
    belt_level: '',
    manager_id: '',
    facility_id: '',
    active: true,
    phone: '',
    employment_type: '',
    is_leadership: false,
    is_evaluator: false
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [empRes, mgrRes, deptRes, facRes] = await Promise.all([
          employeesApi.get(id),
          employeesApi.getManagers(),
          settingsApi.getDepartments(),
          settingsApi.getFacilities()
        ])
        const emp = empRes.data.employee
        setForm({
          name: emp.name || '',
          email: emp.email || '',
          hire_date: emp.hire_date || '',
          department: emp.department || '',
          job_title: emp.job_title || '',
          belt_level: emp.belt_level || emp.tech_level || '',
          manager_id: emp.manager_id ? String(emp.manager_id) : '',
          facility_id: emp.facility_id ? String(emp.facility_id) : '',
          active: emp.active === 1 || emp.active === true,
          phone: emp.phone || '',
          employment_type: emp.employment_type || '',
          is_leadership: emp.is_leadership === 1 || emp.is_leadership === true,
          is_evaluator: emp.is_evaluator === 1 || emp.is_evaluator === true
        })
        setManagers(mgrRes.data.managers)
        setDepartments(deptRes.data.departments.filter(d => d.active))
        setFacilities(facRes.data.facilities.filter(f => f.active))
      } catch (e) {
        console.error(e)
        setError('Failed to load employee data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        belt_level: form.belt_level || null,
        manager_id: form.manager_id ? parseInt(form.manager_id) : null,
        facility_id: form.facility_id ? parseInt(form.facility_id) : null,
        active: form.active ? 1 : 0,
        is_leadership: form.is_leadership ? 1 : 0,
        is_evaluator: form.is_evaluator ? 1 : 0
      }
      await employeesApi.update(id, payload)
      navigate('/employees')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update employee')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading employee data...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={() => navigate('/employees')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← Back to Employees
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Employee</h1>
          <p className="text-sm text-gray-500 mt-1">Update employee information</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Work Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Hire Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="hire_date"
                  required
                  value={form.hire_date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                <select
                  name="department"
                  required
                  value={form.department}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="job_title"
                  required
                  value={form.job_title}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Belt Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Belt Level</label>
                <select
                  name="belt_level"
                  value={form.belt_level}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">None</option>
                  {BELT_LEVELS.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>

              {/* Employment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select
                  name="employment_type"
                  value={form.employment_type}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select type...</option>
                  <option value="Permanent">Permanent</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>

              {/* Facility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility / Client Site</label>
                <select
                  name="facility_id"
                  value={form.facility_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">No facility assigned</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}{f.city ? ` — ${f.city}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Manager */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                <select
                  name="manager_id"
                  value={form.manager_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">No manager assigned</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} {m.department ? `(${m.department})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Active status */}
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="active"
                    checked={form.active}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Employee</span>
                </label>
              </div>

              {/* Leadership Position */}
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_leadership"
                    checked={form.is_leadership}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Leadership Position</span>
                </label>
              </div>

              {/* Add as Evaluator */}
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_evaluator"
                    checked={form.is_evaluator}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Add as Evaluator</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/employees')}
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

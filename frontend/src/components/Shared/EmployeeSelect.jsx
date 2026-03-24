import { useState, useEffect } from 'react'
import { employeesApi } from '../../api/employees'

export default function EmployeeSelect({ value, onChange, placeholder = 'Search employees...' }) {
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadEmployees()
  }, [search])

  async function loadEmployees() {
    setLoading(true)
    try {
      const res = await employeesApi.list({ search })
      setEmployees(res.data.employees)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const selected = employees.find(e => e.id === value)

  function selectEmployee(emp) {
    onChange(emp)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
        value={open ? search : (selected ? selected.name : '')}
        onFocus={() => setOpen(true)}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
      />
      {open && (
        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>}
          {!loading && employees.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No employees found</div>
          )}
          {employees.map(emp => (
            <button
              key={emp.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
              onClick={() => selectEmployee(emp)}
            >
              <div className="font-medium text-gray-900">{emp.name}</div>
              <div className="text-gray-500 text-xs">{emp.department} • {emp.tech_level || emp.job_title}</div>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}

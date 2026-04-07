import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import StatusBadge from '../components/Shared/StatusBadge'
import { employeesApi } from '../api/employees'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

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
  const [employee, setEmployee] = useState(null)
  const [evaluations, setEvaluations] = useState([])
  const [pipPlans, setPipPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadEmployee() }, [id])

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
          <button
            onClick={() => navigate('/evaluations/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Start New Evaluation
          </button>
        </div>

        {/* Employee info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Employee Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500 block text-xs mb-1">Department</span><span className="font-medium">{employee.department}</span></div>
            <div><span className="text-gray-500 block text-xs mb-1">Job Title</span><span className="font-medium">{employee.job_title}</span></div>
            <div><span className="text-gray-500 block text-xs mb-1">Belt Level</span>
              <span className="font-medium">
                {(employee.belt_level || employee.tech_level) ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${BELT_LEVEL_COLORS[employee.belt_level || employee.tech_level] || 'bg-blue-100 text-blue-700'}`}>{employee.belt_level || employee.tech_level}</span>
                ) : 'N/A'}
              </span>
            </div>
            <div><span className="text-gray-500 block text-xs mb-1">Hire Date</span><span className="font-medium">{employee.hire_date}</span></div>
            <div><span className="text-gray-500 block text-xs mb-1">Manager</span><span className="font-medium">{employee.manager_name || 'N/A'}</span></div>
            <div><span className="text-gray-500 block text-xs mb-1">Email</span><span className="font-medium">{employee.email}</span></div>
          </div>
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

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import { reportsApi } from '../api/reports'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'

export default function Reports() {
  const navigate = useNavigate()
  const [deptScores, setDeptScores] = useState([])
  const [distribution, setDistribution] = useState([])
  const [passFail, setPassFail] = useState(null)
  const [evalsDue, setEvalsDue] = useState([])
  const [pipTracking, setPipTracking] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => { loadAll() }, [dateRange])

  async function loadAll() {
    setLoading(true)
    try {
      const params = {}
      if (dateRange.start) params.start_date = dateRange.start
      if (dateRange.end) params.end_date = dateRange.end

      const [deptRes, distRes, dueRes, pipRes] = await Promise.all([
        reportsApi.deptScores(params),
        reportsApi.scoreDistribution(params),
        reportsApi.evalsDue(),
        reportsApi.pipTracking()
      ])
      setDeptScores(deptRes.data.data)
      setDistribution(distRes.data.distribution)
      setPassFail(distRes.data.pass_fail)
      setEvalsDue(dueRes.data.data)
      setPipTracking(pipRes.data.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const piePFData = passFail ? [
    { name: 'Pass', value: passFail.passed, fill: '#22c55e' },
    { name: 'Fail', value: passFail.failed, fill: '#ef4444' }
  ] : []

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Performance analytics and insights</p>
          </div>
          {/* Date range filter */}
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: '', end: '' })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading reports...</div>
        ) : (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Department Scores */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Department Average Scores</h2>
                {deptScores.length === 0 ? (
                  <p className="text-gray-500 text-sm">No data available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={deptScores} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
                      <Bar dataKey="avg_score_pct" radius={[4, 4, 0, 0]}>
                        {deptScores.map((d, i) => (
                          <Cell key={i} fill={d.avg_score_pct >= 93 ? '#22c55e' : d.avg_score_pct >= 80 ? '#3b82f6' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {deptScores.length > 0 && (
                  <table className="w-full text-xs mt-4">
                    <thead className="text-gray-500 border-b">
                      <tr>
                        <th className="text-left py-1">Dept</th>
                        <th className="text-center py-1">Evals</th>
                        <th className="text-center py-1">Avg%</th>
                        <th className="text-center py-1">Pass</th>
                        <th className="text-center py-1">Fail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptScores.map((d, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1 text-gray-700">{d.department}</td>
                          <td className="py-1 text-center">{d.eval_count}</td>
                          <td className="py-1 text-center font-medium">{d.avg_score_pct}%</td>
                          <td className="py-1 text-center text-green-600">{d.passed_count}</td>
                          <td className="py-1 text-center text-red-500">{d.failed_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pass/Fail Pie + Score Distribution */}
              <div className="space-y-6">
                {/* Pass/Fail Pie */}
                {passFail && passFail.total > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Pass / Fail Rate</h2>
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={piePFData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                          >
                            {piePFData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span>Pass: <strong>{passFail.passed}</strong> ({Math.round(passFail.passed / passFail.total * 100)}%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span>Fail: <strong>{passFail.failed}</strong> ({Math.round(passFail.failed / passFail.total * 100)}%)</span>
                          </div>
                          <div className="text-gray-500">Total: {passFail.total}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Score Distribution */}
                {distribution.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">Score Distribution</h2>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={distribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Employees Due for Evaluation */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Employees Due for Evaluation</h2>
                {evalsDue.length > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{evalsDue.length} overdue</span>
                )}
              </div>
              {evalsDue.length === 0 ? (
                <div className="p-6 text-center text-gray-500">All employees have recent evaluations.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Tech Level</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Last Eval</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Days Since</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {evalsDue.map(emp => (
                      <tr key={emp.id} className="hover:bg-red-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                        <td className="px-4 py-3 text-center">
                          {emp.tech_level ? (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{emp.tech_level}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-red-500 font-medium">
                          {emp.last_eval_date || 'Never'}
                        </td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">
                          {Math.round(emp.days_since_eval || 0)} days
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2"
                          >
                            Profile
                          </button>
                          <button
                            onClick={() => navigate('/evaluations/new')}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            + Eval
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* PIP Tracking */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-800">PIP Tracking</h2>
              </div>
              {pipTracking.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No active PIPs.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Eval Date</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Score</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Next PIP Date</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pipTracking.map(pip => {
                      const pct = pip.max_score > 0 ? Math.round(pip.total_score / pip.max_score * 100) : 0
                      return (
                        <tr key={pip.id} className="hover:bg-yellow-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{pip.employee_name}</td>
                          <td className="px-4 py-3 text-gray-600">{pip.department}</td>
                          <td className="px-4 py-3 text-gray-600">{pip.evaluation_date}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-red-500 font-medium">{pip.total_score}/{pip.max_score} ({pct}%)</span>
                          </td>
                          <td className="px-4 py-3">
                            {pip.next_pip_date ? (
                              <span className={new Date(pip.next_pip_date) < new Date() ? 'text-red-500 font-medium' : 'text-gray-600'}>
                                {pip.next_pip_date}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => navigate(`/evaluations/${pip.evaluation_id}`)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              View Eval
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

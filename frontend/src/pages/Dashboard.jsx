import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import KPICard from '../components/Dashboard/KPICard'
import RecentEvalsTable from '../components/Dashboard/RecentEvalsTable'
import ScoreChart from '../components/Dashboard/ScoreChart'
import { reportsApi } from '../api/reports'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [deptScores, setDeptScores] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [dashRes, deptRes] = await Promise.all([
        reportsApi.dashboard(),
        reportsApi.deptScores()
      ])
      setData(dashRes.data)
      setDeptScores(deptRes.data.data)
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
          <div className="text-gray-500">Loading dashboard...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">HR Performance Overview</p>
          </div>
          <button
            onClick={() => navigate('/evaluations/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            + Start New Evaluation
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            title="Evals This Month"
            value={data?.total_this_month ?? 0}
            subtitle="Submitted evaluations"
            color="blue"
            icon="📋"
          />
          <KPICard
            title="Average Score"
            value={`${data?.avg_score_pct ?? 0}%`}
            subtitle="Across all evaluations"
            color="green"
            icon="📊"
          />
          <KPICard
            title="Employees Due"
            value={data?.employees_due ?? 0}
            subtitle="Need evaluation (12+ months)"
            color="yellow"
            icon="⏰"
          />
          <KPICard
            title="Active PIPs"
            value={data?.active_pips ?? 0}
            subtitle="Performance improvement plans"
            color="red"
            icon="⚠️"
          />
        </div>

        {/* Charts + Table row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Department Scores */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Department Average Scores</h2>
            <ScoreChart data={deptScores} />
          </div>

          {/* Overdue Employees */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Employees Overdue for Evaluation
              {data?.overdue_employees?.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {data.overdue_employees.length}
                </span>
              )}
            </h2>
            {(!data?.overdue_employees || data.overdue_employees.length === 0) ? (
              <p className="text-sm text-gray-500">All employees are up to date.</p>
            ) : (
              <div className="space-y-3">
                {data.overdue_employees.map(emp => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => navigate(`/employees/${emp.id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.department} • {emp.tech_level || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-red-600 font-medium">
                        {emp.last_eval_date ? `Last: ${emp.last_eval_date}` : 'Never evaluated'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Evaluations */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Recent Evaluations</h2>
            <button
              onClick={() => navigate('/evaluations')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all →
            </button>
          </div>
          <RecentEvalsTable evals={data?.recent_evals || []} />
        </div>
      </div>
    </Layout>
  )
}

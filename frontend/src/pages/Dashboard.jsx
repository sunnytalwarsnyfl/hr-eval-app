import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import KPICard from '../components/Dashboard/KPICard'
import RecentEvalsTable from '../components/Dashboard/RecentEvalsTable'
import ScoreChart from '../components/Dashboard/ScoreChart'
import ReminderModal from '../components/Dashboard/ReminderModal'
import BulkReminderModal from '../components/Dashboard/BulkReminderModal'
import { reportsApi } from '../api/reports'
import { notificationsApi } from '../api/notifications'
import { attendanceApi, disciplinaryApi } from '../api/logs'
import { useAuth } from '../App'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [deptScores, setDeptScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [reminderStatus, setReminderStatus] = useState(null)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [attendanceSummary, setAttendanceSummary] = useState(null)
  const [disciplinarySummary, setDisciplinarySummary] = useState(null)
  const [reminderTarget, setReminderTarget] = useState(null) // { employee, manager }
  const [reminderToast, setReminderToast] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkSending, setBulkSending] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const isHrOrAdmin = user?.role === 'hr' || user?.role === 'admin'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [dashRes, deptRes, attRes, discRes] = await Promise.all([
        reportsApi.dashboard(),
        reportsApi.deptScores(),
        attendanceApi.summary().catch(() => ({ data: {} })),
        disciplinaryApi.summary().catch(() => ({ data: {} }))
      ])
      setData(dashRes.data)
      setDeptScores(deptRes.data.data)
      setAttendanceSummary(attRes.data)
      setDisciplinarySummary(discRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendReminders() {
    setSendingReminders(true)
    setReminderStatus(null)
    try {
      const res = await notificationsApi.sendReminders()
      setReminderStatus({ type: 'success', message: res.data.message || 'Reminders sent successfully.' })
    } catch (err) {
      setReminderStatus({ type: 'error', message: err.response?.data?.error || 'Failed to send reminders.' })
    } finally {
      setSendingReminders(false)
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
          <div className="flex items-center gap-3">
            {isHrOrAdmin && (
              <button
                onClick={handleSendReminders}
                disabled={sendingReminders}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {sendingReminders ? 'Sending...' : '📧 Send Reminder Emails'}
              </button>
            )}
            <button
              onClick={() => navigate('/evaluations/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              + Start New Evaluation
            </button>
          </div>
        </div>

        {/* Reminder status message */}
        {reminderStatus && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            reminderStatus.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {reminderStatus.message}
          </div>
        )}

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

        {/* Log Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📅</span>
              <h3 className="text-sm font-medium text-gray-600">Active Attendance Points</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{attendanceSummary?.active_points ?? attendanceSummary?.count ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Employees with active points</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚖️</span>
              <h3 className="text-sm font-medium text-gray-600">Open Disciplinary Cases</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{disciplinarySummary?.open_cases ?? disciplinarySummary?.count ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Cases currently being monitored</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔍</span>
              <h3 className="text-sm font-medium text-gray-600">Incomplete QA Items</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data?.incomplete_qa ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">QA items pending completion</p>
          </div>
        </div>

        {/* Evaluations Due (anniversary within 30 days) */}
        {data?.employees_due_list && data.employees_due_list.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Evaluations Due
              <span className="ml-2 bg-yellow-100 text-yellow-600 text-xs px-2 py-0.5 rounded-full">
                {data.employees_due_list.length}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mb-3">Employees with anniversary dates within the next 30 days</p>
            <div className="space-y-2">
              {data.employees_due_list.map(emp => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => navigate(`/employees/${emp.id}`)}
                  >
                    <p className="font-medium text-gray-900 text-sm">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.department} - {emp.job_title}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className="text-xs text-yellow-700 font-medium">
                      Anniversary: {emp.anniversary_date || emp.hire_date}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setReminderTarget({
                          employee: emp,
                          manager: emp.manager_id
                            ? { id: emp.manager_id, name: emp.manager_name, email: emp.manager_email }
                            : null
                        })
                      }}
                      className="px-3 py-1 bg-white border border-yellow-300 text-yellow-800 rounded-md text-xs font-medium hover:bg-yellow-50"
                    >
                      Send Reminder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {reminderTarget && (
          <ReminderModal
            employee={reminderTarget.employee}
            manager={reminderTarget.manager}
            onClose={() => setReminderTarget(null)}
            onSent={(data) => setReminderToast({
              type: 'success',
              message: data?.message || 'Reminder sent.'
            })}
          />
        )}

        {showBulkModal && (
          <BulkReminderModal
            employees={(data?.overdue_employees || []).filter(emp => selectedIds.has(emp.id))}
            onClose={() => setShowBulkModal(false)}
            onSent={(res) => {
              setReminderToast({
                type: 'success',
                message: `Bulk reminders: sent ${res.sent}, skipped ${res.skipped}, errors ${res.error}.`
              })
              setSelectedIds(new Set())
            }}
          />
        )}

        {reminderToast && (
          <div className={`fixed bottom-6 right-6 p-3 rounded-lg shadow-lg text-sm font-medium z-50 ${
            reminderToast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {reminderToast.message}
            <button
              onClick={() => setReminderToast(null)}
              className="ml-3 text-gray-500 hover:text-gray-700"
            >×</button>
          </div>
        )}

        {/* Charts + Table row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Department Scores */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Department Average Scores</h2>
            <ScoreChart data={deptScores} />
          </div>

          {/* Overdue Employees */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                Employees Overdue for Evaluation
                {data?.overdue_employees?.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                    {data.overdue_employees.length}
                  </span>
                )}
              </h2>
              {isHrOrAdmin && data?.overdue_employees?.length > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  disabled={selectedIds.size === 0 || bulkSending}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send Reminders to Selected ({selectedIds.size})
                </button>
              )}
            </div>
            {(!data?.overdue_employees || data.overdue_employees.length === 0) ? (
              <p className="text-sm text-gray-500">All employees are up to date.</p>
            ) : (
              <>
                {isHrOrAdmin && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <input
                      type="checkbox"
                      id="select-all-overdue"
                      checked={selectedIds.size === data.overdue_employees.length && data.overdue_employees.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(data.overdue_employees.map(emp => emp.id)))
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="select-all-overdue" className="text-xs font-medium text-gray-700 cursor-pointer">
                      Select All
                    </label>
                  </div>
                )}
                <div className="space-y-3">
                  {data.overdue_employees.map(emp => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                    >
                      {isHrOrAdmin && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds)
                            if (e.target.checked) {
                              next.add(emp.id)
                            } else {
                              next.delete(emp.id)
                            }
                            setSelectedIds(next)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 mr-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      )}
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/employees/${emp.id}`)}
                      >
                        <p className="font-medium text-gray-900 text-sm">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.department} • {emp.belt_level || emp.tech_level || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-red-600 font-medium">
                          {emp.last_eval_date ? `Last: ${emp.last_eval_date}` : 'Never evaluated'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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

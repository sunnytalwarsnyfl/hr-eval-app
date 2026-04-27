import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import client from '../api/client'
import { complianceApi } from '../api/compliance'

function ComplianceStatusPill({ record }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = record.expiration_date ? new Date(record.expiration_date) : null

  let label = 'Pending'
  let cls = 'bg-yellow-100 text-yellow-700'

  if (record.renewed_within_deadline === 1) {
    label = 'On Time'
    cls = 'bg-green-100 text-green-700'
  } else if (record.renewed_within_deadline === 0) {
    label = 'Late'
    cls = 'bg-red-100 text-red-700'
  } else if (!record.renewed_date && exp && exp < today) {
    label = 'Expired'
    cls = 'bg-red-100 text-red-700'
  } else if (!record.renewed_date) {
    label = 'Pending'
    cls = 'bg-yellow-100 text-yellow-700'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function StatusPill({ status }) {
  const styles = {
    'Draft': 'bg-gray-100 text-gray-700',
    'Submitted': 'bg-blue-100 text-blue-700',
    'Acknowledged': 'bg-green-100 text-green-700',
    'Pending HR Review': 'bg-yellow-100 text-yellow-700',
    'Approved': 'bg-green-100 text-green-700',
    'Rejected': 'bg-red-100 text-red-700',
  }
  const cls = styles[status] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || 'Unknown'}
    </span>
  )
}

export default function EmployeeMyEvals() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [evals, setEvals] = useState([])
  const [compliance, setCompliance] = useState([])
  const [complianceLoading, setComplianceLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [activeEval, setActiveEval] = useState(null)
  const [activeDetail, setActiveDetail] = useState(null)
  const [activeSections, setActiveSections] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [ackName, setAckName] = useState('')
  const [ackLoading, setAckLoading] = useState(false)
  const [employeeName, setEmployeeName] = useState('')

  useEffect(() => {
    loadEvals()
    loadCompliance()
  }, [])

  async function loadCompliance() {
    setComplianceLoading(true)
    try {
      const res = await complianceApi.list()
      setCompliance(res.data.data || [])
    } catch (e) {
      console.error('Failed to load compliance:', e)
    } finally {
      setComplianceLoading(false)
    }
  }

  async function loadEvals() {
    setLoading(true)
    try {
      const meRes = await client.get('/auth/me')
      const me = meRes.data.user || {}
      const empId = me.employee_id
      setEmployeeName(me.employee_name || me.name || '')
      if (!empId) {
        setEvals([])
        return
      }
      const res = await client.get('/evaluations', { params: { employee_id: empId } })
      setEvals(res.data.evaluations || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(ev) {
    setActiveEval(ev)
    setActiveDetail(null)
    setActiveSections([])
    setAckName('')
    setDetailLoading(true)
    try {
      const res = await client.get(`/evaluations/${ev.id}`)
      setActiveDetail(res.data.evaluation)
      setActiveSections(res.data.sections || [])
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeModal() {
    setActiveEval(null)
    setActiveDetail(null)
    setActiveSections([])
    setAckName('')
  }

  async function handleAcknowledge(evalId) {
    if (!ackName.trim()) return alert('Please type your full name to acknowledge.')
    setAckLoading(true)
    try {
      await client.patch(`/evaluations/${evalId}/acknowledge`, { acknowledged_by: ackName })
      closeModal()
      await loadEvals()
    } catch (e) {
      alert('Acknowledgment failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setAckLoading(false)
    }
  }

  async function handleLogout() {
    try { await client.post('/auth/logout') } catch (e) {}
    setUser(null)
    navigate('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading your evaluations...</div>
  }

  const totalEvals = evals.length
  const pendingAck = evals.filter(e => e.status === 'Submitted').length
  const acknowledgedCount = evals.filter(e => e.status === 'Acknowledged').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold">
              S
            </div>
            <div>
              <div className="font-semibold text-gray-900">SIPS Healthcare</div>
              <div className="text-xs text-gray-500">Employee Self-Service Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-800">{employeeName || user?.name}</div>
              <div className="text-xs text-gray-500">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Evaluations</h1>
          <p className="text-sm text-gray-500 mt-1">View and acknowledge your performance evaluations.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Total Evaluations</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{totalEvals}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Pending Acknowledgment</div>
            <div className="text-3xl font-bold text-blue-600 mt-1">{pendingAck}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs uppercase tracking-wide text-gray-500">Acknowledged</div>
            <div className="text-3xl font-bold text-green-600 mt-1">{acknowledgedCount}</div>
          </div>
        </div>

        {/* Evaluations table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">All Evaluations</h2>
          </div>
          {evals.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              You don't have any evaluations on file yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Type</th>
                    <th className="text-left px-6 py-3 font-medium">Date</th>
                    <th className="text-left px-6 py-3 font-medium">Score</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="text-right px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evals.map(ev => {
                    const pct = ev.max_score > 0 ? Math.round(ev.total_score / ev.max_score * 100) : 0
                    return (
                      <tr key={ev.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-800">{ev.evaluation_type}</td>
                        <td className="px-6 py-3 text-gray-600">{ev.evaluation_date}</td>
                        <td className="px-6 py-3 text-gray-700">
                          <span className="font-medium">{ev.total_score} / {ev.max_score}</span>
                          <span className="text-gray-500 ml-1">({pct}%)</span>
                        </td>
                        <td className="px-6 py-3"><StatusPill status={ev.status} /></td>
                        <td className="px-6 py-3 text-right space-x-2">
                          <button
                            onClick={() => openDetail(ev)}
                            className="text-blue-600 text-sm hover:underline"
                          >
                            View Detail
                          </button>
                          {ev.status === 'Submitted' && (
                            <button
                              onClick={() => openDetail(ev)}
                              className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700"
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

        {/* My Compliance Records */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">My Compliance Records</h2>
            <p className="text-xs text-gray-500 mt-0.5">Hepatitis B, Physical Exam, BLS, Certifications, etc.</p>
          </div>

          {/* Info card */}
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 flex items-start gap-2">
            <span className="mt-0.5">ℹ️</span>
            <span>
              Contact HR to update your compliance records (Hepatitis B, Physical Exam, BLS, Certification).
            </span>
          </div>

          {complianceLoading ? (
            <div className="p-10 text-center text-gray-500 text-sm">Loading compliance records...</div>
          ) : compliance.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              You don't have any compliance records on file yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Requirement Type</th>
                    <th className="text-left px-6 py-3 font-medium">Expiration Date</th>
                    <th className="text-left px-6 py-3 font-medium">Renewed Date</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="text-left px-6 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {compliance.map(rec => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-800">{rec.requirement_type}</td>
                      <td className="px-6 py-3 text-gray-600">{rec.expiration_date || '—'}</td>
                      <td className="px-6 py-3 text-gray-600">{rec.renewed_date || '—'}</td>
                      <td className="px-6 py-3"><ComplianceStatusPill record={rec} /></td>
                      <td className="px-6 py-3 text-gray-600 text-xs max-w-xs truncate" title={rec.notes || ''}>
                        {rec.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {activeEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-gray-900">{activeEval.evaluation_type}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{activeEval.evaluation_date} • by {activeEval.evaluator_name || 'Manager'}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">
              {detailLoading && <div className="text-center py-6 text-gray-500 text-sm">Loading details...</div>}

              {activeDetail && (
                <>
                  {/* Score */}
                  <div className={`rounded-xl p-5 border ${activeDetail.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-3xl font-bold ${activeDetail.passed ? 'text-green-700' : 'text-red-600'}`}>
                          {activeDetail.total_score} / {activeDetail.max_score}
                        </div>
                        <div className="text-sm text-gray-700 mt-0.5">
                          {activeDetail.max_score > 0 ? Math.round(activeDetail.total_score / activeDetail.max_score * 100) : 0}% — {activeDetail.passed ? 'PASS' : 'FAIL'}
                        </div>
                      </div>
                      <StatusPill status={activeDetail.status} />
                    </div>
                  </div>

                  {/* Sections */}
                  {activeSections.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">Section Breakdown</h3>
                      <div className="space-y-3">
                        {activeSections.map((s, si) => {
                          const sPct = s.section_max > 0 ? Math.round(s.section_score / s.section_max * 100) : 0
                          return (
                            <details key={si} className="bg-gray-50 rounded-lg border border-gray-200">
                              <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
                                <span className="font-medium text-gray-800">{s.section_name}</span>
                                <span className={`text-sm font-semibold ${sPct >= 80 ? 'text-green-600' : sPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                  {s.section_score} / {s.section_max} ({sPct}%)
                                </span>
                              </summary>
                              <div className="px-4 pb-3">
                                <table className="w-full text-sm">
                                  <tbody>
                                    {(s.items || []).map((it, ii) => (
                                      <tr key={ii} className="border-t border-gray-200">
                                        <td className="py-2 text-gray-700">{it.item_label}</td>
                                        <td className="py-2 text-right text-gray-600 w-24">{it.score} / {it.max_score}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  {(activeDetail.supervisor_comments || activeDetail.employee_comments) && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-800">Comments</h3>
                      {activeDetail.supervisor_comments && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Supervisor Comments</p>
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{activeDetail.supervisor_comments}</p>
                        </div>
                      )}
                      {activeDetail.employee_comments && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Employee Comments</p>
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{activeDetail.employee_comments}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Acknowledgment */}
                  {activeDetail.status === 'Submitted' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                      <h3 className="font-semibold text-blue-800 mb-2">Employee Acknowledgment</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        By typing your full name below, you acknowledge that you have reviewed this evaluation.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={ackName}
                          onChange={e => setAckName(e.target.value)}
                          placeholder="Type your full name..."
                          className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleAcknowledge(activeDetail.id)}
                          disabled={ackLoading || !ackName.trim()}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {ackLoading ? 'Saving...' : 'Acknowledge'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeDetail.status === 'Acknowledged' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-sm text-green-800">
                        Acknowledged by <strong>{activeDetail.acknowledged_by}</strong>
                        {activeDetail.acknowledged_at ? ` on ${activeDetail.acknowledged_at.split('T')[0]}` : ''}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-200 flex justify-end sticky bottom-0 bg-white">
              <button
                onClick={closeModal}
                className="text-sm border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

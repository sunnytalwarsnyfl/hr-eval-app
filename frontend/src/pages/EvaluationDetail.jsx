import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import StatusBadge from '../components/Shared/StatusBadge'
import { evaluationsApi } from '../api/evaluations'
import { generateEvalPDF } from '../utils/generatePDF'
import { useAuth } from '../App'

const BELT_LEVELS = ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Black']

export default function EvaluationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [evalData, setEvalData] = useState(null)
  const [sections, setSections] = useState([])
  const [pipPlan, setPipPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ackName, setAckName] = useState('')
  const [ackLoading, setAckLoading] = useState(false)

  // HR Review state
  const [hrFormOpen, setHrFormOpen] = useState(false)
  const [hrForm, setHrForm] = useState({
    attendance_occurrences: '',
    disciplinary_count: '',
    compliance_status: '',
    belt_level_at_eval: '',
    overall_score: '',
    pay_increase_rate: '',
    bonus_percentage: '',
    hr_notes: ''
  })
  const [hrLoading, setHrLoading] = useState(false)
  const [hrToast, setHrToast] = useState(null)

  useEffect(() => { loadEval() }, [id])

  async function loadEval() {
    try {
      const res = await evaluationsApi.get(id)
      setEvalData(res.data.evaluation)
      setSections(res.data.sections)
      setPipPlan(res.data.pipPlan)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAcknowledge() {
    if (!ackName.trim()) return alert('Please type your full name to acknowledge.')
    setAckLoading(true)
    try {
      const res = await evaluationsApi.acknowledge(id, { acknowledged_by: ackName })
      setEvalData(res.data.evaluation)
    } catch (e) {
      alert('Acknowledgment failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setAckLoading(false)
    }
  }

  function handleDownloadPDF() {
    generateEvalPDF(evalData, sections, pipPlan)
  }

  async function handleOpenHrReview() {
    setHrFormOpen(true)
    try {
      const res = await evaluationsApi.hrReviewData(id)
      const d = res.data
      setHrForm(prev => ({
        ...prev,
        attendance_occurrences: d.attendance?.count ?? '',
        disciplinary_count: d.disciplinary?.count_12mo ?? '',
        compliance_status: d.compliance?.status === 'No Records' ? '' : (d.compliance?.status || ''),
        belt_level_at_eval: d.employee_belt_level || ''
      }))
    } catch (e) {
      console.error('hr-review-data error', e)
    }
  }

  function handleHrFieldChange(field, value) {
    setHrForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmitHrReview() {
    setHrLoading(true)
    try {
      const payload = {
        attendance_occurrences: hrForm.attendance_occurrences === '' ? null : Number(hrForm.attendance_occurrences),
        disciplinary_count: hrForm.disciplinary_count === '' ? null : Number(hrForm.disciplinary_count),
        compliance_status: hrForm.compliance_status || null,
        belt_level_at_eval: hrForm.belt_level_at_eval || null,
        overall_score: hrForm.overall_score === '' ? null : Number(hrForm.overall_score),
        pay_increase_rate: hrForm.pay_increase_rate === '' ? null : Number(hrForm.pay_increase_rate),
        bonus_percentage: hrForm.bonus_percentage === '' ? null : Number(hrForm.bonus_percentage),
        hr_notes: hrForm.hr_notes || null
      }
      await evaluationsApi.hrReview(id, payload)
      setHrToast({ type: 'success', message: 'HR Review saved successfully.' })
      setHrFormOpen(false)
      await loadEval()
      setTimeout(() => setHrToast(null), 3500)
    } catch (e) {
      const msg = e.response?.data?.error || e.message
      setHrToast({ type: 'error', message: 'Save failed: ' + msg })
      setTimeout(() => setHrToast(null), 4500)
    } finally {
      setHrLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading evaluation...</div>
        </div>
      </Layout>
    )
  }

  if (!evalData) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Evaluation not found.</p>
          <button onClick={() => navigate('/evaluations')} className="mt-4 text-blue-600 hover:underline">Back to evaluations</button>
        </div>
      </Layout>
    )
  }

  const pct = evalData.max_score > 0 ? Math.round(evalData.total_score / evalData.max_score * 100) : 0

  const isHrOrAdmin = user?.role === 'admin' || user?.role === 'hr'
  const eligibleForHrReview = (evalData.evaluation_type === 'Self-Evaluation' || evalData.status === 'Submitted')
  const showHrReviewSection = isHrOrAdmin && eligibleForHrReview && !evalData.hr_reviewed_at
  const hasHrReview = !!evalData.hr_reviewed_at

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {hrToast && (
          <div className={`rounded-lg p-3 text-sm ${hrToast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {hrToast.message}
          </div>
        )}
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => navigate('/evaluations')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
              ← Back to Evaluations
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{evalData.employee_name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {evalData.evaluation_type} • {evalData.evaluation_date} • by {evalData.evaluator_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={evalData.status} size="md" />
            <button
              onClick={handleDownloadPDF}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              📄 Download PDF
            </button>
          </div>
        </div>

        {/* Score summary */}
        <div className={`rounded-xl border p-6 ${evalData.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-4xl font-bold ${evalData.passed ? 'text-green-700' : 'text-red-600'}`}>
                {evalData.total_score} / {evalData.max_score}
              </div>
              <div className="text-lg text-gray-700 mt-1">{pct}% — {evalData.passed ? 'PASS' : 'FAIL'}</div>
            </div>
            <div className="text-right">
              <StatusBadge status={evalData.passed ? 'Pass' : 'Fail'} size="md" />
              <p className="text-xs text-gray-500 mt-1">Passing: {evalData.passing_score}</p>
            </div>
          </div>
        </div>

        {/* Employee info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-3">Employee Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">Department:</span> <span className="font-medium">{evalData.department}</span></div>
            <div><span className="text-gray-500">Tech Level:</span> <span className="font-medium">{evalData.tech_level || 'N/A'}</span></div>
            <div><span className="text-gray-500">Hire Date:</span> <span className="font-medium">{evalData.hire_date}</span></div>
          </div>
        </div>

        {/* Section scores */}
        {sections.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">Section Scores</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {sections.map((section, si) => {
                const sPct = section.section_max > 0 ? Math.round(section.section_score / section.section_max * 100) : 0
                return (
                  <details key={si} className="group">
                    <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-800">{section.section_name}</span>
                        <div className="w-24 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${sPct >= 80 ? 'bg-green-500' : sPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${sPct}%` }}
                          />
                        </div>
                      </div>
                      <span className={`font-semibold text-sm ${sPct >= 80 ? 'text-green-600' : sPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {section.section_score} / {section.section_max} ({sPct}%)
                      </span>
                    </summary>
                    <div className="px-6 pb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 font-medium text-gray-600">Item</th>
                            <th className="text-center py-2 font-medium text-gray-600 w-20">Score</th>
                            <th className="text-center py-2 font-medium text-gray-600 w-20">Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.items?.map((item, ii) => (
                            <tr key={ii} className="border-b border-gray-50">
                              <td className="py-2 text-gray-700">{item.item_label}</td>
                              <td className="py-2 text-center font-medium">{item.score}</td>
                              <td className="py-2 text-center text-gray-500">{item.max_score}</td>
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

        {/* PIP Plan */}
        {pipPlan && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
            <h2 className="font-semibold text-yellow-800 mb-4">Performance Improvement Plan</h2>
            <div className="space-y-3 text-sm">
              {pipPlan.action_plan && (
                <div><p className="font-medium text-gray-700">Action Plan:</p><p className="text-gray-600 mt-1">{pipPlan.action_plan}</p></div>
              )}
              {pipPlan.goals && (
                <div><p className="font-medium text-gray-700">Goals:</p><p className="text-gray-600 mt-1">{pipPlan.goals}</p></div>
              )}
              {pipPlan.expectations && (
                <div><p className="font-medium text-gray-700">Expectations:</p><p className="text-gray-600 mt-1">{pipPlan.expectations}</p></div>
              )}
              {pipPlan.timeline && (
                <div><p className="font-medium text-gray-700">Timeline:</p><p className="text-gray-600 mt-1">{pipPlan.timeline}</p></div>
              )}
              {pipPlan.next_pip_date && (
                <div><p className="font-medium text-gray-700">Next PIP Date:</p><p className="text-gray-600 mt-1">{pipPlan.next_pip_date}</p></div>
              )}
            </div>
          </div>
        )}

        {/* Comments */}
        {(evalData.supervisor_comments || evalData.employee_comments) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Comments</h2>
            {evalData.supervisor_comments && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Supervisor Comments</p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{evalData.supervisor_comments}</p>
              </div>
            )}
            {evalData.employee_comments && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Employee Comments</p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{evalData.employee_comments}</p>
              </div>
            )}
          </div>
        )}

        {/* HR Review — read-only summary */}
        {hasHrReview && (
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-semibold text-purple-800">HR Review</h2>
              <span className="text-xs text-purple-700">
                Reviewed {evalData.hr_reviewed_at?.split('T')[0] || evalData.hr_reviewed_at}
                {evalData.hr_reviewed_by ? ` by user #${evalData.hr_reviewed_by}` : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Attendance Occurrences:</span> <span className="font-medium">{evalData.attendance_occurrences ?? '—'}</span></div>
              <div><span className="text-gray-500">Disciplinary (12mo):</span> <span className="font-medium">{evalData.disciplinary_count ?? '—'}</span></div>
              <div><span className="text-gray-500">Compliance:</span> <span className="font-medium">{evalData.compliance_status || '—'}</span></div>
              <div><span className="text-gray-500">Belt Level at Eval:</span> <span className="font-medium">{evalData.belt_level_at_eval || '—'}</span></div>
              <div><span className="text-gray-500">Overall Score:</span> <span className="font-medium">{evalData.overall_score ?? '—'}</span></div>
              <div><span className="text-gray-500">Pay Increase Rate:</span> <span className="font-medium">{evalData.pay_increase_rate != null ? `${evalData.pay_increase_rate}%` : '—'}</span></div>
              <div><span className="text-gray-500">Bonus %:</span> <span className="font-medium">{evalData.bonus_percentage != null ? `${evalData.bonus_percentage}%` : '—'}</span></div>
            </div>
          </div>
        )}

        {/* HR Review — form */}
        {showHrReviewSection && (
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-purple-800">HR Review</h2>
              {!hrFormOpen && (
                <button
                  onClick={handleOpenHrReview}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  [HR Review]
                </button>
              )}
            </div>
            {!hrFormOpen ? (
              <p className="text-sm text-gray-600">
                This self-evaluation is ready for HR review. Click [HR Review] to record attendance, disciplinary, compliance, and pay-increase data.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attendance Occurrences</label>
                    <input
                      type="number"
                      step="1"
                      value={hrForm.attendance_occurrences}
                      onChange={e => handleHrFieldChange('attendance_occurrences', e.target.value)}
                      className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-pulled from active attendance records.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disciplinary Count (last 12 mo)</label>
                    <input
                      type="number"
                      step="1"
                      value={hrForm.disciplinary_count}
                      onChange={e => handleHrFieldChange('disciplinary_count', e.target.value)}
                      className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Status</label>
                    <select
                      value={hrForm.compliance_status}
                      onChange={e => handleHrFieldChange('compliance_status', e.target.value)}
                      className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">— Select —</option>
                      <option value="Compliant">Compliant</option>
                      <option value="Non-Compliant">Non-Compliant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Belt Level at Eval</label>
                    <select
                      value={hrForm.belt_level_at_eval}
                      onChange={e => handleHrFieldChange('belt_level_at_eval', e.target.value)}
                      className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">— Select —</option>
                      {BELT_LEVELS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Overall Score (optional)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={hrForm.overall_score}
                      onChange={e => handleHrFieldChange('overall_score', e.target.value)}
                      className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pay Increase Rate % (optional)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 0.5, 1.0"
                      value={hrForm.pay_increase_rate}
                      onChange={e => handleHrFieldChange('pay_increase_rate', e.target.value)}
                      className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bonus % (temp staff, optional)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={hrForm.bonus_percentage}
                      onChange={e => handleHrFieldChange('bonus_percentage', e.target.value)}
                      className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HR Notes</label>
                  <textarea
                    rows="3"
                    value={hrForm.hr_notes}
                    onChange={e => handleHrFieldChange('hr_notes', e.target.value)}
                    className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Notes will be appended to supervisor comments with [HR Review] prefix.</p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setHrFormOpen(false)}
                    className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitHrReview}
                    disabled={hrLoading}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {hrLoading ? 'Saving...' : 'Submit HR Review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Acknowledgment section */}
        {evalData.status === 'Submitted' && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h2 className="font-semibold text-blue-800 mb-3">Employee Acknowledgment</h2>
            <p className="text-sm text-gray-600 mb-4">Type your full name to acknowledge this evaluation.</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={ackName}
                onChange={e => setAckName(e.target.value)}
                placeholder="Type full name to acknowledge..."
                className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAcknowledge}
                disabled={ackLoading || !ackName.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {ackLoading ? 'Saving...' : 'Acknowledge'}
              </button>
            </div>
          </div>
        )}

        {evalData.status === 'Acknowledged' && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <p className="text-sm text-green-700">
              Acknowledged by <strong>{evalData.acknowledged_by}</strong> on {evalData.acknowledged_at?.split('T')[0] || evalData.acknowledged_at}
            </p>
          </div>
        )}

        {evalData.next_eval_date && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Next Evaluation Date:</span> {evalData.next_eval_date}
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}

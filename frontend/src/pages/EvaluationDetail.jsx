import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import StatusBadge from '../components/Shared/StatusBadge'
import { evaluationsApi } from '../api/evaluations'
import { generateEvalPDF } from '../utils/generatePDF'

export default function EvaluationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [evalData, setEvalData] = useState(null)
  const [sections, setSections] = useState([])
  const [pipPlan, setPipPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ackName, setAckName] = useState('')
  const [ackLoading, setAckLoading] = useState(false)

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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
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

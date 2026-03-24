import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import EmployeeSelect from '../components/Shared/EmployeeSelect'
import SectionTab from '../components/EvalForm/SectionTab'
import TotalScoreCard from '../components/EvalForm/TotalScoreCard'
import { EVAL_SECTIONS, getItemMaxScore } from '../constants/evalSections'
import { evaluationsApi } from '../api/evaluations'
import { useAutoSave } from '../hooks/useAutoSave'
import { useAuth } from '../App'
import { generateEvalPDF } from '../utils/generatePDF'

const EVAL_TYPES = ['Annual', 'Mid-Year', '90-Day', 'PIP Follow-up']
const STEPS = ['Select Employee', 'Eval Info', 'Scoring', 'Summary & Plan', 'Review & Submit']

export default function NewEvaluation() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState(0)
  const [activeSection, setActiveSection] = useState(0)
  const [evalId, setEvalId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [evalType, setEvalType] = useState('Annual')
  const [evalDate, setEvalDate] = useState(today)
  const [scores, setScores] = useState({})
  const [supervisorComments, setSupervisorComments] = useState('')
  const [employeeComments, setEmployeeComments] = useState('')
  const [nextEvalDate, setNextEvalDate] = useState('')
  const [requiresPip, setRequiresPip] = useState(false)
  const [pip, setPip] = useState({ action_plan: '', goals: '', expectations: '', timeline: '', next_pip_date: '' })

  function handleScoreChange(sectionIndex, itemIndex, value) {
    setScores(prev => ({ ...prev, [`${sectionIndex}_${itemIndex}`]: value }))
  }

  function buildSectionsPayload() {
    return EVAL_SECTIONS.map((section, si) => {
      const items = section.items.map((item, ii) => ({
        item_label: item,
        score: scores[`${si}_${ii}`] ?? 0,
        max_score: getItemMaxScore(section.scoring)
      }))
      const sectionScore = items.reduce((sum, i) => sum + i.score, 0)
      return {
        section_name: section.name,
        section_score: sectionScore,
        section_max: section.maxScore,
        items
      }
    })
  }

  function getTotalScore() {
    return EVAL_SECTIONS.reduce((total, section, si) => {
      return total + section.items.reduce((sum, _, ii) => sum + (scores[`${si}_${ii}`] ?? 0), 0)
    }, 0)
  }

  const buildPayload = useCallback(() => {
    if (!selectedEmployee) return null
    return {
      employee_id: selectedEmployee.id,
      evaluator_id: user.id,
      evaluation_type: evalType,
      evaluation_date: evalDate,
      sections: buildSectionsPayload(),
      supervisor_comments: supervisorComments,
      employee_comments: employeeComments,
      next_eval_date: nextEvalDate || null
    }
  }, [selectedEmployee, evalType, evalDate, scores, supervisorComments, employeeComments, nextEvalDate, user])

  const { triggerSave } = useAutoSave(evalId, setEvalId, buildPayload, step === 2)

  const totalScore = getTotalScore()
  const passed = totalScore >= 211
  const showPip = requiresPip || !passed

  async function saveAsDraft() {
    setSubmitting(true)
    try {
      const payload = buildPayload()
      if (!payload) return
      if (evalId) {
        await evaluationsApi.update(evalId, { ...payload, status: 'Draft' })
      } else {
        const res = await evaluationsApi.create({ ...payload, status: 'Draft' })
        setEvalId(res.data.evaluation.id)
      }
      navigate('/evaluations')
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEval() {
    setSubmitting(true)
    try {
      const payload = {
        ...buildPayload(),
        status: 'Submitted',
        pip_plan: showPip ? pip : null
      }
      if (evalId) {
        await evaluationsApi.update(evalId, payload)
        navigate(`/evaluations/${evalId}`)
      } else {
        const res = await evaluationsApi.create(payload)
        navigate(`/evaluations/${res.data.evaluation.id}`)
      }
    } catch (e) {
      alert('Submit failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setSubmitting(false)
    }
  }

  function handleDownloadPDF() {
    const evalData = {
      id: evalId || 'draft',
      employee_name: selectedEmployee?.name || '',
      evaluation_date: evalDate,
      evaluation_type: evalType,
      evaluator_name: user?.name || '',
      department: selectedEmployee?.department || '',
      tech_level: selectedEmployee?.tech_level || '',
      total_score: totalScore,
      max_score: 227,
      passed,
      status: 'Draft',
      supervisor_comments: supervisorComments,
      employee_comments: employeeComments
    }
    const sectionsData = buildSectionsPayload().map(s => ({
      section_name: s.section_name,
      section_score: s.section_score,
      section_max: s.section_max,
      items: s.items.map(i => ({ item_label: i.item_label, score: i.score, max_score: i.max_score }))
    }))
    generateEvalPDF(evalData, sectionsData, showPip ? pip : null)
  }

  // Step renderers
  function renderStep() {
    switch (step) {
      case 0: return renderStepEmployee()
      case 1: return renderStepInfo()
      case 2: return renderStepScoring()
      case 3: return renderStepSummary()
      case 4: return renderStepReview()
      default: return null
    }
  }

  function renderStepEmployee() {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Select Employee</h2>
          <p className="text-sm text-gray-500">Search for the employee to evaluate</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
          <EmployeeSelect
            value={selectedEmployee?.id}
            onChange={emp => setSelectedEmployee(emp)}
          />
        </div>
        {selectedEmployee && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedEmployee.name}</span></div>
              <div><span className="text-gray-500">Dept:</span> <span className="font-medium">{selectedEmployee.department}</span></div>
              <div><span className="text-gray-500">Tech Level:</span> <span className="font-medium">{selectedEmployee.tech_level || 'N/A'}</span></div>
              <div><span className="text-gray-500">Hire Date:</span> <span className="font-medium">{selectedEmployee.hire_date}</span></div>
              <div><span className="text-gray-500">Job Title:</span> <span className="font-medium">{selectedEmployee.job_title}</span></div>
              <div><span className="text-gray-500">Last Eval:</span> <span className="font-medium">{selectedEmployee.last_eval_date || 'Never'}</span></div>
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={() => setStep(1)}
            disabled={!selectedEmployee}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Next: Evaluation Info →
          </button>
        </div>
      </div>
    )
  }

  function renderStepInfo() {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Evaluation Info</h2>
          <p className="text-sm text-gray-500">Set the evaluation type and date</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Evaluation Type</label>
          <select
            value={evalType}
            onChange={e => setEvalType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {EVAL_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Evaluation Date</label>
          <input
            type="date"
            value={evalDate}
            onChange={e => setEvalDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Evaluator</label>
          <input
            type="text"
            value={user?.name || ''}
            readOnly
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-sm text-gray-500"
          />
        </div>
        <div className="flex justify-between">
          <button onClick={() => setStep(0)} className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">← Back</button>
          <button onClick={() => setStep(2)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">Next: Scoring →</button>
        </div>
      </div>
    )
  }

  function renderStepScoring() {
    return (
      <div className="flex gap-6">
        {/* Main scoring area */}
        <div className="flex-1 min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Scoring</h2>
            <button
              onClick={triggerSave}
              className="text-xs border border-gray-300 px-3 py-1 rounded text-gray-600 hover:bg-gray-50"
            >
              Save Draft
            </button>
          </div>

          {/* Section tabs */}
          <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-2">
            {EVAL_SECTIONS.map((section, i) => {
              let sScore = section.items.reduce((sum, _, ii) => sum + (scores[`${i}_${ii}`] ?? 0), 0)
              const sPct = (sScore / section.maxScore) * 100
              return (
                <button
                  key={i}
                  onClick={() => setActiveSection(i)}
                  className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
                    activeSection === i
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {section.name}
                  {sPct > 0 && (
                    <span className={`ml-1 ${activeSection === i ? 'text-blue-200' : sPct >= 80 ? 'text-green-600' : sPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                      ({Math.round(sPct)}%)
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionTab
              section={EVAL_SECTIONS[activeSection]}
              sectionIndex={activeSection}
              scores={scores}
              onScoreChange={handleScoreChange}
            />

            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
              {activeSection > 0 ? (
                <button
                  onClick={() => setActiveSection(activeSection - 1)}
                  className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  ← Previous Section
                </button>
              ) : (
                <button onClick={() => setStep(1)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                  ← Back to Info
                </button>
              )}
              {activeSection < EVAL_SECTIONS.length - 1 ? (
                <button
                  onClick={() => setActiveSection(activeSection + 1)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Next Section →
                </button>
              ) : (
                <button
                  onClick={() => setStep(3)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Next: Summary →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky score card */}
        <div className="w-56 flex-shrink-0">
          <TotalScoreCard scores={scores} />
        </div>
      </div>
    )
  }

  function renderStepSummary() {
    const sectionScores = EVAL_SECTIONS.map((section, si) => {
      const score = section.items.reduce((sum, _, ii) => sum + (scores[`${si}_${ii}`] ?? 0), 0)
      return { name: section.name, score, max: section.maxScore, pct: Math.round((score / section.maxScore) * 100) }
    })

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Summary & Development Plan</h2>
          <p className="text-sm text-gray-500">Review scores and add comments</p>
        </div>

        {/* Score summary table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Section</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Max</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
              </tr>
            </thead>
            <tbody>
              {sectionScores.map((s, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-center">{s.score}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{s.max}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-medium ${s.pct >= 80 ? 'text-green-600' : s.pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {s.pct}%
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-center">{totalScore}</td>
                <td className="px-4 py-3 text-center text-gray-500">227</td>
                <td className="px-4 py-3 text-center">
                  <span className={passed ? 'text-green-600' : 'text-red-500'}>
                    {Math.round(totalScore / 227 * 100)}% — {passed ? 'PASS' : 'FAIL'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PIP section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-semibold text-gray-800">Performance Improvement Plan</h3>
            {!passed && (
              <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Required (score below passing)</span>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <input
              type="checkbox"
              checked={requiresPip || !passed}
              disabled={!passed}
              onChange={e => setRequiresPip(e.target.checked)}
              className="rounded"
            />
            Include PIP Plan
          </label>

          {showPip && (
            <div className="space-y-4">
              {[
                { key: 'action_plan', label: 'Action Plan' },
                { key: 'goals', label: 'Goals' },
                { key: 'expectations', label: 'Expectations' },
                { key: 'timeline', label: 'Timeline' }
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <textarea
                    rows={3}
                    value={pip[key]}
                    onChange={e => setPip(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder={`Enter ${label.toLowerCase()}...`}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next PIP Date</label>
                <input
                  type="date"
                  value={pip.next_pip_date}
                  onChange={e => setPip(prev => ({ ...prev, next_pip_date: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Comments</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Comments</label>
            <textarea
              rows={4}
              value={supervisorComments}
              onChange={e => setSupervisorComments(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter supervisor comments..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Comments</label>
            <textarea
              rows={4}
              value={employeeComments}
              onChange={e => setEmployeeComments(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter employee comments..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Evaluation Date</label>
            <input
              type="date"
              value={nextEvalDate}
              onChange={e => setNextEvalDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(2)} className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">← Back</button>
          <button onClick={() => setStep(4)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">Next: Review →</button>
        </div>
      </div>
    )
  }

  function renderStepReview() {
    const sectionScores = EVAL_SECTIONS.map((section, si) => {
      const score = section.items.reduce((sum, _, ii) => sum + (scores[`${si}_${ii}`] ?? 0), 0)
      return { ...section, score, pct: Math.round((score / section.maxScore) * 100) }
    })

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Review & Submit</h2>
            <p className="text-sm text-gray-500">Review everything before submitting</p>
          </div>
          <button
            onClick={handleDownloadPDF}
            className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            📄 Download PDF
          </button>
        </div>

        {/* Employee & eval summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Evaluation Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="text-gray-500">Employee:</span> <span className="font-medium">{selectedEmployee?.name}</span></div>
            <div><span className="text-gray-500">Department:</span> <span className="font-medium">{selectedEmployee?.department}</span></div>
            <div><span className="text-gray-500">Type:</span> <span className="font-medium">{evalType}</span></div>
            <div><span className="text-gray-500">Date:</span> <span className="font-medium">{evalDate}</span></div>
            <div><span className="text-gray-500">Evaluator:</span> <span className="font-medium">{user?.name}</span></div>
            <div><span className="text-gray-500">Tech Level:</span> <span className="font-medium">{selectedEmployee?.tech_level || 'N/A'}</span></div>
          </div>

          <div className={`text-center py-4 rounded-lg ${passed ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-3xl font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>
              {totalScore} / 227
            </div>
            <div className={`text-lg font-semibold ${passed ? 'text-green-700' : 'text-red-600'}`}>
              {Math.round(totalScore / 227 * 100)}% — {passed ? 'PASS' : 'FAIL'}
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Section</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Score / Max</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
              </tr>
            </thead>
            <tbody>
              {sectionScores.map((s, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 text-center">{s.score} / {s.maxScore}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={s.pct >= 80 ? 'text-green-600' : s.pct >= 50 ? 'text-yellow-600' : 'text-red-500'}>
                      {s.pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {supervisorComments && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Supervisor Comments</p>
            <p className="text-sm text-gray-600">{supervisorComments}</p>
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(3)} className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">← Back</button>
          <div className="flex gap-3">
            <button
              onClick={saveAsDraft}
              disabled={submitting}
              className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              onClick={submitEval}
              disabled={submitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit for Acknowledgment'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold flex-shrink-0 ${
                    i < step ? 'bg-blue-600 text-white' :
                    i === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <div className="ml-2 text-xs hidden sm:block">
                  <span className={i === step ? 'text-blue-700 font-semibold' : 'text-gray-500'}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {renderStep()}
      </div>
    </Layout>
  )
}

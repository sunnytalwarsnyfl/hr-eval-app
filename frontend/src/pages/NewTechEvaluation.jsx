import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Shared/Layout'
import EmployeeSelect from '../components/Shared/EmployeeSelect'
import {
  TECH_EVAL_SECTIONS, TECH_SCORE_OPTIONS, TECH_TOTAL_ITEMS, TECH_MAX_SCORE, TECH_PASSING_SCORE,
  ATTENDANCE_OPTIONS, COMPLIANCE_ITEMS, DISCIPLINARY_OPTIONS,
  getBeltLevel, getOverallRating, getBeltBonus
} from '../constants/techEvalSections'
import { evaluationsApi } from '../api/evaluations'
import { useAuth } from '../App'

const STEPS = ['Select Employee', 'Eval Info', 'Performance Scoring', 'Attendance / Compliance / Disciplinary', 'Summary & Submit']

export default function NewTechEvaluation() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState(0)
  const [activeSection, setActiveSection] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [evalDate, setEvalDate] = useState(today)
  const [staffType, setStaffType] = useState('permanent')
  const [scores, setScores] = useState({})
  const [attendance, setAttendance] = useState(null)
  const [compliance, setCompliance] = useState({})
  const [disciplinary, setDisciplinary] = useState(null)
  const [supervisorComments, setSupervisorComments] = useState('')
  const [employeeComments, setEmployeeComments] = useState('')

  function handleScoreChange(sectionIndex, itemIndex, value) {
    setScores(prev => ({ ...prev, [`${sectionIndex}_${itemIndex}`]: value }))
  }

  // Calculate performance score (scaled to 50)
  const perfRawSum = Object.values(scores).reduce((s, v) => s + v, 0)
  const perfScore = TECH_TOTAL_ITEMS > 0 ? Math.round((perfRawSum / TECH_TOTAL_ITEMS) * 50 * 100) / 100 : 0
  const attendanceScore = attendance !== null ? attendance : 0
  const complianceScore = Object.values(compliance).filter(Boolean).length * 2
  const disciplinaryScore = disciplinary !== null ? disciplinary : 0
  const overallScore = Math.round((perfScore + attendanceScore + complianceScore + disciplinaryScore) * 100) / 100

  const ratedCount = Object.keys(scores).length
  const belt = getBeltLevel(perfScore)
  const rating = getOverallRating(overallScore)
  const beltBonus = getBeltBonus(belt.belt)
  const passed = overallScore >= TECH_PASSING_SCORE

  function buildSectionsPayload() {
    // Performance sections
    const perfSections = TECH_EVAL_SECTIONS.map((section, si) => {
      const items = section.items.map((item, ii) => ({
        item_label: item,
        score: scores[`${si}_${ii}`] ?? 0,
        max_score: 1
      }))
      const sectionScore = items.reduce((sum, i) => sum + i.score, 0)
      // Scale section score proportionally to 50 pts total
      const scaledScore = TECH_TOTAL_ITEMS > 0 ? Math.round((sectionScore / section.items.length) * (section.items.length / TECH_TOTAL_ITEMS) * 50 * 100) / 100 : 0
      return {
        section_name: section.name,
        section_score: Math.round(scaledScore * 100) / 100,
        section_max: Math.round((section.items.length / TECH_TOTAL_ITEMS) * 50 * 100) / 100,
        items
      }
    })

    // Add attendance, compliance, disciplinary as sections
    perfSections.push({
      section_name: "Attendance",
      section_score: attendanceScore,
      section_max: 20,
      items: [{ item_label: ATTENDANCE_OPTIONS.find(o => o.points === attendance)?.label || "Not rated", score: attendanceScore, max_score: 20 }]
    })

    perfSections.push({
      section_name: "Compliance",
      section_score: complianceScore,
      section_max: 10,
      items: COMPLIANCE_ITEMS.map((item, i) => ({
        item_label: item,
        score: compliance[i] ? 2 : 0,
        max_score: 2
      }))
    })

    perfSections.push({
      section_name: "Disciplinary Action",
      section_score: disciplinaryScore,
      section_max: 20,
      items: [{ item_label: DISCIPLINARY_OPTIONS.find(o => o.points === disciplinary)?.label || "Not rated", score: disciplinaryScore, max_score: 20 }]
    })

    return perfSections
  }

  async function submitEval() {
    setSubmitting(true)
    try {
      const payload = {
        employee_id: selectedEmployee.id,
        evaluator_id: user.id,
        evaluation_type: 'Tech Review',
        evaluation_date: evalDate,
        status: 'Submitted',
        max_score: TECH_MAX_SCORE,
        passing_score: TECH_PASSING_SCORE,
        sections: buildSectionsPayload(),
        supervisor_comments: supervisorComments,
        employee_comments: employeeComments,
      }
      const res = await evaluationsApi.create(payload)
      navigate(`/evaluations/${res.data.evaluation.id}`)
    } catch (e) {
      alert('Submit failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setSubmitting(false)
    }
  }

  async function saveAsDraft() {
    setSubmitting(true)
    try {
      const payload = {
        employee_id: selectedEmployee.id,
        evaluator_id: user.id,
        evaluation_type: 'Tech Review',
        evaluation_date: evalDate,
        status: 'Draft',
        max_score: TECH_MAX_SCORE,
        passing_score: TECH_PASSING_SCORE,
        sections: buildSectionsPayload(),
        supervisor_comments: supervisorComments,
        employee_comments: employeeComments,
      }
      await evaluationsApi.create(payload)
      navigate('/evaluations')
    } catch (e) {
      alert('Save failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setSubmitting(false)
    }
  }

  // Section progress helper
  function sectionProgress(si) {
    const section = TECH_EVAL_SECTIONS[si]
    const rated = section.items.filter((_, ii) => scores[`${si}_${ii}`] !== undefined).length
    return { rated, total: section.items.length }
  }

  function renderStep() {
    switch (step) {
      case 0: return renderStepEmployee()
      case 1: return renderStepInfo()
      case 2: return renderStepScoring()
      case 3: return renderStepACDScoring()
      case 4: return renderStepSummary()
      default: return null
    }
  }

  function renderStepEmployee() {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Select Employee</h2>
          <p className="text-sm text-gray-500">Search for the technician to evaluate</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
          <EmployeeSelect value={selectedEmployee?.id} onChange={emp => setSelectedEmployee(emp)} />
        </div>
        {selectedEmployee && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedEmployee.name}</span></div>
              <div><span className="text-gray-500">Dept:</span> <span className="font-medium">{selectedEmployee.department}</span></div>
              <div><span className="text-gray-500">Tech Level:</span> <span className="font-medium">{selectedEmployee.tech_level || 'N/A'}</span></div>
              <div><span className="text-gray-500">Hire Date:</span> <span className="font-medium">{selectedEmployee.hire_date}</span></div>
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={() => setStep(1)} disabled={!selectedEmployee}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
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
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Tech Review Info</h2>
          <p className="text-sm text-gray-500">Set the evaluation date and staff type</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Evaluation Date</label>
          <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Staff Type</label>
          <select value={staffType} onChange={e => setStaffType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="permanent">Permanent / SBD Staff</option>
            <option value="temporary">Temporary Staff</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Evaluator</label>
          <input type="text" value={user?.name || ''} readOnly
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-sm text-gray-500" />
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h3 className="font-semibold text-indigo-800 text-sm mb-2">Tech Review Scoring Structure</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-indigo-700">
            <div>Performance (competency): <strong>50 pts</strong></div>
            <div>Attendance: <strong>20 pts</strong></div>
            <div>Compliance: <strong>10 pts</strong></div>
            <div>Disciplinary: <strong>20 pts</strong></div>
            <div className="col-span-2 pt-1 border-t border-indigo-200 mt-1 font-bold">Total: 100 pts · Passing: 70</div>
          </div>
        </div>
        <div className="flex justify-between">
          <button onClick={() => setStep(0)} className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">← Back</button>
          <button onClick={() => setStep(2)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">Next: Performance Scoring →</button>
        </div>
      </div>
    )
  }

  function renderStepScoring() {
    const section = TECH_EVAL_SECTIONS[activeSection]
    const options = TECH_SCORE_OPTIONS[section.scoring] || TECH_SCORE_OPTIONS.tech_standard

    // Section score
    let sectionRawScore = 0
    section.items.forEach((_, ii) => { sectionRawScore += scores[`${activeSection}_${ii}`] ?? 0 })
    const sectionPct = section.items.length > 0 ? Math.round((sectionRawScore / section.items.length) * 100) : 0
    const barColor = sectionPct >= 80 ? 'bg-green-500' : sectionPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'

    return (
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Performance Scoring</h2>
            <span className="text-sm text-gray-500">{ratedCount}/{TECH_TOTAL_ITEMS} items rated</span>
          </div>

          {/* Section tabs */}
          <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-2">
            {TECH_EVAL_SECTIONS.map((sec, i) => {
              const prog = sectionProgress(i)
              const done = prog.rated === prog.total
              return (
                <button key={i} onClick={() => setActiveSection(i)}
                  className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
                    activeSection === i ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  {done ? '✅ ' : ''}{sec.name}
                  <span className={`ml-1 ${activeSection === i ? 'text-blue-200' : 'text-gray-400'}`}>
                    ({prog.rated}/{prog.total})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Scoring area */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-800">{section.name}</h3>
                <span className="text-sm font-medium text-gray-600">
                  {sectionRawScore.toFixed(2)} / {section.items.length} ({sectionPct}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${Math.min(sectionPct, 100)}%` }} />
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {options.map(opt => (
                  <span key={opt.value} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1">{opt.label}</span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {section.items.map((item, ii) => {
                const key = `${activeSection}_${ii}`
                const currentScore = scores[key]
                return (
                  <div key={ii} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{ii + 1}. {item}</p>
                    </div>
                    <div className="flex-shrink-0 w-60">
                      <select value={currentScore ?? ''} onChange={e => handleScoreChange(activeSection, ii, Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="" disabled>Select rating...</option>
                        {options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
              {activeSection > 0 ? (
                <button onClick={() => setActiveSection(activeSection - 1)}
                  className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">← Previous Section</button>
              ) : (
                <button onClick={() => setStep(1)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">← Back to Info</button>
              )}
              {activeSection < TECH_EVAL_SECTIONS.length - 1 ? (
                <button onClick={() => setActiveSection(activeSection + 1)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Next Section →</button>
              ) : (
                <button onClick={() => setStep(3)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Next: Attendance & Compliance →</button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky score card */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sticky top-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Running Total</h3>
            <div className="text-center mb-4">
              <div className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>{overallScore}</div>
              <div className="text-sm text-gray-500">out of {TECH_MAX_SCORE}</div>
              <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{passed ? 'PASS' : 'FAIL'}</div>
              <div className="text-xs text-gray-400 mt-1">Passing: {TECH_PASSING_SCORE}/{TECH_MAX_SCORE}</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div className={`h-2 rounded-full transition-all duration-300 ${passed ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min((overallScore / TECH_MAX_SCORE) * 100, 100)}%` }} />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">Performance</span><span className="font-medium">{perfScore}/50</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Attendance</span><span className="font-medium">{attendanceScore}/20</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Compliance</span><span className="font-medium">{complianceScore}/10</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Disciplinary</span><span className="font-medium">{disciplinaryScore}/20</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className={`font-bold ${belt.color}`}>{belt.belt} Belt</span>
                <span className={`font-bold ${rating.color}`}>{rating.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderStepACDScoring() {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Attendance, Compliance & Disciplinary</h2>

        {/* Attendance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-1">Attendance — 20 Points</h3>
          <p className="text-sm text-gray-500 mb-4">Select the technician's active attendance point range.</p>
          <div className="space-y-2">
            {ATTENDANCE_OPTIONS.map(opt => (
              <label key={opt.points} className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                attendance === opt.points ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="attendance" checked={attendance === opt.points}
                    onChange={() => setAttendance(opt.points)} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                </div>
                <span className={`font-bold text-lg ${attendance === opt.points ? 'text-blue-600' : 'text-gray-400'}`}>{opt.points} pts</span>
              </label>
            ))}
          </div>
        </div>

        {/* Compliance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-1">Compliance — 10 Points</h3>
          <p className="text-sm text-gray-500 mb-4">Check each item renewed on time. Each = 2 pts.</p>
          <div className="space-y-2">
            {COMPLIANCE_ITEMS.map((item, idx) => (
              <label key={idx} className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                compliance[idx] ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={!!compliance[idx]}
                    onChange={e => setCompliance(p => ({ ...p, [idx]: e.target.checked }))}
                    className="rounded text-green-600 w-4 h-4" />
                  <span className="text-sm text-gray-800">{item}</span>
                </div>
                <span className={`font-bold ${compliance[idx] ? 'text-green-600' : 'text-gray-400'}`}>{compliance[idx] ? '2' : '0'} pts</span>
              </label>
            ))}
          </div>
        </div>

        {/* Disciplinary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-1">Disciplinary Action — 20 Points</h3>
          <p className="text-sm text-gray-500 mb-4">Select disciplinary history for the last 12 months.</p>
          <div className="space-y-2">
            {DISCIPLINARY_OPTIONS.map(opt => (
              <label key={opt.points} className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                disciplinary === opt.points ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="disciplinary" checked={disciplinary === opt.points}
                    onChange={() => setDisciplinary(opt.points)} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                </div>
                <span className={`font-bold text-lg ${disciplinary === opt.points ? 'text-blue-600' : 'text-gray-400'}`}>{opt.points} pts</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(2)} className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">← Back</button>
          <button onClick={() => setStep(4)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">Next: Summary →</button>
        </div>
      </div>
    )
  }

  function renderStepSummary() {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Review & Submit Tech Evaluation</h2>
          <p className="text-sm text-gray-500">Review all scores, add comments, and submit.</p>
        </div>

        {/* Employee info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Evaluation Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="text-gray-500">Employee:</span> <span className="font-medium">{selectedEmployee?.name}</span></div>
            <div><span className="text-gray-500">Department:</span> <span className="font-medium">{selectedEmployee?.department}</span></div>
            <div><span className="text-gray-500">Type:</span> <span className="font-medium">Tech Review</span></div>
            <div><span className="text-gray-500">Date:</span> <span className="font-medium">{evalDate}</span></div>
            <div><span className="text-gray-500">Evaluator:</span> <span className="font-medium">{user?.name}</span></div>
            <div><span className="text-gray-500">Staff Type:</span> <span className="font-medium capitalize">{staffType}</span></div>
          </div>

          {/* Overall score display */}
          <div className={`text-center py-6 rounded-lg ${passed ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>{overallScore} / {TECH_MAX_SCORE}</div>
            <div className={`text-lg font-semibold mt-1 ${passed ? 'text-green-700' : 'text-red-600'}`}>
              {Math.round(overallScore / TECH_MAX_SCORE * 100)}% — {passed ? 'PASS' : 'FAIL'}
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Max</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-800 font-medium">Performance (Competency)</td>
                <td className="px-4 py-3 text-center">{perfScore}</td>
                <td className="px-4 py-3 text-center text-gray-500">50</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${perfScore/50*100 >= 80 ? 'text-green-600' : perfScore/50*100 >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {Math.round(perfScore / 50 * 100)}%
                  </span>
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-800">Attendance</td>
                <td className="px-4 py-3 text-center">{attendanceScore}</td>
                <td className="px-4 py-3 text-center text-gray-500">20</td>
                <td className="px-4 py-3 text-center"><span className={`font-medium ${attendanceScore >= 15 ? 'text-green-600' : 'text-yellow-600'}`}>{Math.round(attendanceScore/20*100)}%</span></td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-800">Compliance</td>
                <td className="px-4 py-3 text-center">{complianceScore}</td>
                <td className="px-4 py-3 text-center text-gray-500">10</td>
                <td className="px-4 py-3 text-center"><span className={`font-medium ${complianceScore >= 8 ? 'text-green-600' : 'text-yellow-600'}`}>{Math.round(complianceScore/10*100)}%</span></td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-800">Disciplinary Action</td>
                <td className="px-4 py-3 text-center">{disciplinaryScore}</td>
                <td className="px-4 py-3 text-center text-gray-500">20</td>
                <td className="px-4 py-3 text-center"><span className={`font-medium ${disciplinaryScore >= 15 ? 'text-green-600' : 'text-yellow-600'}`}>{Math.round(disciplinaryScore/20*100)}%</span></td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-center">{overallScore}</td>
                <td className="px-4 py-3 text-center text-gray-500">{TECH_MAX_SCORE}</td>
                <td className="px-4 py-3 text-center">
                  <span className={passed ? 'text-green-600' : 'text-red-500'}>
                    {Math.round(overallScore / TECH_MAX_SCORE * 100)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Belt & Compensation */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl border-2 p-6 text-center ${belt.bg} ${belt.border}`}>
            <div className="text-xs text-gray-500 font-semibold mb-1">BELT COMPETENCY</div>
            <div className={`text-2xl font-bold ${belt.color}`}>{belt.belt} Belt</div>
            <div className="text-sm text-gray-600 mt-1">Bonus: +{beltBonus}</div>
          </div>
          <div className={`rounded-xl border-2 p-6 text-center ${rating.bg} border-gray-200`}>
            <div className="text-xs text-gray-500 font-semibold mb-1">
              {staffType === 'permanent' ? 'HOURLY RATE INCREASE' : 'BONUS PERCENTAGE'}
            </div>
            <div className={`text-2xl font-bold ${rating.color}`}>
              {staffType === 'permanent' ? rating.increase : rating.bonus}
            </div>
            <div className="text-sm text-gray-600 mt-1">{rating.label}</div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Comments</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Comments</label>
            <textarea rows={4} value={supervisorComments} onChange={e => setSupervisorComments(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Development goals, observations, follow-up items..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Comments</label>
            <textarea rows={4} value={employeeComments} onChange={e => setEmployeeComments(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Employee response or comments..." />
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(3)} className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">← Back</button>
          <div className="flex gap-3">
            <button onClick={saveAsDraft} disabled={submitting}
              className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">Save as Draft</button>
            <button onClick={submitEval} disabled={submitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Submitting...' : 'Submit Tech Evaluation'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">TECH REVIEW</span>
            <h1 className="text-xl font-bold text-gray-900">New Tech Performance Evaluation</h1>
          </div>
          <p className="text-sm text-gray-500">Sterile By Design™ competency-based evaluation with attendance, compliance & disciplinary scoring.</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold flex-shrink-0 ${
                  i < step ? 'bg-blue-600 text-white' :
                  i === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                  'bg-gray-200 text-gray-500'
                }`}>
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

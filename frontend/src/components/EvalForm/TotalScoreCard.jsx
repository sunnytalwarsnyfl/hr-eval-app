import { EVAL_SECTIONS } from '../../constants/evalSections'

export default function TotalScoreCard({ scores }) {
  const MAX_SCORE = 227
  const PASSING = 211

  // Calculate section scores
  const sectionScores = EVAL_SECTIONS.map((section, si) => {
    let score = 0
    section.items.forEach((_, ii) => {
      score += scores[`${si}_${ii}`] ?? 0
    })
    return { name: section.name, score, max: section.maxScore }
  })

  const totalScore = sectionScores.reduce((sum, s) => sum + s.score, 0)
  const pct = Math.round((totalScore / MAX_SCORE) * 100)
  const passed = totalScore >= PASSING

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sticky top-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Running Total</h3>

      {/* Total score display */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>
          {totalScore}
        </div>
        <div className="text-sm text-gray-500">out of {MAX_SCORE}</div>
        <div className="text-xl font-semibold text-gray-700 mt-1">{pct}%</div>
        <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
          passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {passed ? 'PASS' : 'FAIL'}
        </div>
        <div className="text-xs text-gray-400 mt-1">Passing: {PASSING}/{MAX_SCORE}</div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${passed ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Section breakdown */}
      <div className="space-y-2">
        {sectionScores.map((s, i) => {
          const sPct = s.max > 0 ? Math.round((s.score / s.max) * 100) : 0
          return (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 truncate mr-2" title={s.name}>{s.name}</span>
              <span className={`font-medium flex-shrink-0 ${sPct >= 80 ? 'text-green-600' : sPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                {s.score}/{s.max}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

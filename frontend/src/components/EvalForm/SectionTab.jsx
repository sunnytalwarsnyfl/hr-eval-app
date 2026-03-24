import ScoreDropdown from './ScoreDropdown'
import { SCORE_OPTIONS } from '../../constants/evalSections'

export default function SectionTab({ section, sectionIndex, scores, onScoreChange }) {
  const items = section.items
  const options = SCORE_OPTIONS[section.scoring] || SCORE_OPTIONS.standard

  // Calculate section score
  let sectionScore = 0
  items.forEach((_, itemIndex) => {
    sectionScore += scores[`${sectionIndex}_${itemIndex}`] ?? 0
  })

  const pct = section.maxScore > 0 ? (sectionScore / section.maxScore) * 100 : 0
  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-800">{section.name}</h3>
          <span className="text-sm font-medium text-gray-600">
            {sectionScore} / {section.maxScore} ({Math.round(pct)}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        {section.note && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-700">{section.note}</p>
          </div>
        )}

        {/* Scoring legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {options.map(opt => (
            <span key={opt.value} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1">
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, itemIndex) => {
          const key = `${sectionIndex}_${itemIndex}`
          const currentScore = scores[key] ?? 0

          return (
            <div key={itemIndex} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex-1">
                <p className="text-sm text-gray-800">{item}</p>
              </div>
              <div className="flex-shrink-0 w-52">
                <ScoreDropdown
                  value={currentScore}
                  onChange={(val) => onScoreChange(sectionIndex, itemIndex, val)}
                  options={options}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

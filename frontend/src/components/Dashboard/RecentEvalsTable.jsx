import { useNavigate } from 'react-router-dom'
import StatusBadge from '../Shared/StatusBadge'

export default function RecentEvalsTable({ evals }) {
  const navigate = useNavigate()

  if (!evals || evals.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No recent evaluations.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-600">Employee</th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
            <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
            <th className="text-right py-3 px-4 font-medium text-gray-600">Score</th>
            <th className="text-center py-3 px-4 font-medium text-gray-600">Result</th>
            <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
            <th className="text-right py-3 px-4 font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody>
          {evals.map(ev => {
            const pct = ev.max_score > 0 ? Math.round((ev.total_score / ev.max_score) * 100) : 0
            return (
              <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{ev.employee_name}</td>
                <td className="py-3 px-4 text-gray-600">{ev.evaluation_date}</td>
                <td className="py-3 px-4 text-gray-600">{ev.evaluation_type}</td>
                <td className="py-3 px-4 text-right text-gray-600">{ev.total_score}/{ev.max_score} ({pct}%)</td>
                <td className="py-3 px-4 text-center">
                  <StatusBadge status={ev.passed ? 'Pass' : 'Fail'} />
                </td>
                <td className="py-3 px-4 text-center">
                  <StatusBadge status={ev.status} />
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => navigate(`/evaluations/${ev.id}`)}
                    className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                  >
                    View
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

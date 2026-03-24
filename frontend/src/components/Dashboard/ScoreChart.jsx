import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function ScoreChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No data available.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="department" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`${value}%`, 'Avg Score']}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="avg_score_pct" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.avg_score_pct >= 93 ? '#22c55e' : entry.avg_score_pct >= 80 ? '#3b82f6' : '#ef4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

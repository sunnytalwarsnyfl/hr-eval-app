export default function KPICard({ title, value, subtitle, color = 'blue', icon }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200'
  }
  const valueColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    red: 'text-red-700'
  }

  return (
    <div className={`bg-white rounded-xl border p-6 shadow-sm ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${valueColors[color]}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  )
}

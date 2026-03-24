export default function StatusBadge({ status, size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  const styles = {
    Draft: 'bg-gray-100 text-gray-700',
    Submitted: 'bg-blue-100 text-blue-700',
    Acknowledged: 'bg-green-100 text-green-700',
    Pass: 'bg-green-100 text-green-700',
    Fail: 'bg-red-100 text-red-700',
    Active: 'bg-green-100 text-green-700',
    Inactive: 'bg-gray-100 text-gray-600'
  }

  const cls = styles[status] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${cls}`}>
      {status}
    </span>
  )
}

export default function ScoreDropdown({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

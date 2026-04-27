import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Shared/Layout'
import { reportsApi } from '../api/reports'
import { useNavigate } from 'react-router-dom'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function EvalCalendar() {
  const navigate = useNavigate()
  const [triggers, setTriggers] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => {
    const t = new Date()
    return { year: t.getFullYear(), month: t.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const res = await reportsApi.evalCalendar()
      setTriggers(res.data.data || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Build month grid
  const grid = useMemo(() => {
    const firstDay = new Date(view.year, view.month, 1)
    const lastDay = new Date(view.year, view.month + 1, 0)
    const startOffset = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(view.year, view.month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [view])

  // Map triggers by date string
  const triggersByDate = useMemo(() => {
    const map = {}
    triggers.forEach(t => {
      if (!map[t.anniversary_date]) map[t.anniversary_date] = []
      map[t.anniversary_date].push(t)
    })
    return map
  }, [triggers])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)

  function formatDate(d) {
    if (!d) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function prev() {
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
    setSelectedDate(null)
  }
  function next() {
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
    setSelectedDate(null)
  }
  function goToday() {
    const t = new Date()
    setView({ year: t.getFullYear(), month: t.getMonth() })
    setSelectedDate(null)
  }

  // Triggers in current viewed month
  const monthTriggers = triggers.filter(t => {
    const d = new Date(t.anniversary_date)
    return d.getFullYear() === view.year && d.getMonth() === view.month
  })

  const selectedTriggers = selectedDate ? triggersByDate[selectedDate] || [] : []

  // Belt level color helper
  function beltColor(belt) {
    const map = {
      'White': 'bg-gray-200 text-gray-800',
      'Yellow': 'bg-yellow-200 text-yellow-900',
      'Green': 'bg-green-200 text-green-900',
      'Blue': 'bg-blue-200 text-blue-900',
      'Brown': 'bg-amber-200 text-amber-900',
      'Black': 'bg-gray-800 text-white',
    }
    return map[belt] || 'bg-gray-100 text-gray-700'
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evaluation Calendar</h1>
            <p className="text-sm text-gray-500 mt-1">Upcoming anniversary-based eval triggers (next 90 days)</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={prev} className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50">← Prev</button>
            <button onClick={goToday} className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50">Today</button>
            <button onClick={next} className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50">Next →</button>
            <a
              href="/api/reports/eval-calendar.ics"
              download="sips-hr-eval-calendar.ics"
              className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50 inline-flex items-center gap-1"
              title="Download as iCalendar (.ics) file for Google Cal / Outlook / Apple Cal"
            >
              📅 Export .ics
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Calendar grid (2/3) */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
              {MONTHS[view.month]} {view.year}
            </h2>
            <div className="grid grid-cols-7 gap-1 text-xs font-medium text-gray-500 mb-2">
              {DAYS.map(d => <div key={d} className="text-center py-1">{d}</div>)}
            </div>
            {loading ? (
              <div className="text-center text-gray-500 py-8">Loading...</div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {grid.map((d, i) => {
                  if (!d) return <div key={i} className="aspect-square" />
                  const ds = formatDate(d)
                  const isToday = ds === todayStr
                  const ts = triggersByDate[ds] || []
                  const isSelected = ds === selectedDate

                  // Determine dot/marker color based on min days_until of triggers on this day
                  const minDays = ts.length > 0 ? Math.min(...ts.map(t => t.days_until)) : null
                  let dotColor = ''
                  if (ts.length > 0) {
                    if (minDays === 0) dotColor = 'bg-green-500'
                    else if (minDays <= 5) dotColor = 'bg-yellow-500'
                    else if (minDays <= 30) dotColor = 'bg-gray-400'
                    else dotColor = 'bg-gray-300'
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(ds)}
                      className={`aspect-square p-1 rounded border text-left transition-colors flex flex-col ${
                        isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' :
                        isToday ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-200' :
                        'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                        {d.getDate()}
                      </div>
                      {ts.length > 0 && (
                        <div className="mt-auto flex items-center gap-1 flex-wrap">
                          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <div className="bg-green-500 text-white text-[10px] rounded-full px-1.5 inline-block font-bold leading-tight">
                            {ts.length}
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Side panel (1/3) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                {selectedDate ? `Triggers on ${selectedDate}` : `${MONTHS[view.month]} ${view.year} (${monthTriggers.length})`}
              </h2>
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {(selectedDate ? selectedTriggers : monthTriggers).length === 0 ? (
                <p className="text-sm text-gray-500">No anniversaries in this period.</p>
              ) : (
                (selectedDate ? selectedTriggers : monthTriggers).map((t, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/employees/${t.employee_id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-gray-900 text-sm">{t.employee_name}</div>
                      {t.belt_level && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${beltColor(t.belt_level)}`}>
                          {t.belt_level}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t.department || '—'} • {t.manager_name || 'No manager'}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-xs text-gray-600">{t.anniversary_date}</div>
                      <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.days_until <= 5 ? 'bg-red-100 text-red-700' :
                        t.days_until <= 15 ? 'bg-yellow-100 text-yellow-700' :
                        t.days_until <= 30 ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {t.days_until === 0 ? 'Today' : `${t.days_until}d`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-gray-600">Anniversary today</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500" /><span className="text-gray-600">Within 5 days</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400" /><span className="text-gray-600">Within 30 days</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-300" /><span className="text-gray-600">31-90 days</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded border-2 border-blue-400 bg-blue-50" /><span className="text-gray-600">Today</span></div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            Pill colors in side panel: <span className="text-red-700 font-medium">≤5d urgent</span>, <span className="text-yellow-700 font-medium">≤15d</span>, <span className="text-blue-700 font-medium">≤30d</span>, <span className="text-gray-600 font-medium">31-90d</span>.
          </div>
        </div>
      </div>
    </Layout>
  )
}

import { useState } from 'react'
import { notificationsApi } from '../../api/notifications'

export default function BulkReminderModal({ employees, onClose, onSent }) {
  // employees: array of { id, name, manager_id, manager_name, manager_email, last_eval_date }
  const [message, setMessage] = useState('Hi {{manager}},\n\nThis is a reminder that {{employee}}\'s annual evaluation is due. Please log in to start the evaluation.\n\nThanks,\nHR')
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)

  // Filter to only those with manager email
  const sendable = employees.filter(e => e.manager_email)
  const skipped = employees.filter(e => !e.manager_email)

  async function handleSend() {
    setSending(true)
    try {
      const reminders = sendable.map(e => ({
        employee_id: e.id,
        manager_id: e.manager_id,
        message: message
          .replace(/\{\{manager\}\}/g, e.manager_name || 'Manager')
          .replace(/\{\{employee\}\}/g, e.name)
      }))
      const res = await notificationsApi.sendBulkReminders(reminders)
      setResults(res.data)
    } catch (e) {
      alert('Bulk send failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Send Bulk Reminders</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {!results ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-blue-800">Sending to {sendable.length} manager(s)</p>
                <p className="text-blue-700 text-xs mt-1">
                  Variables: <code>{`{{manager}}`}</code> and <code>{`{{employee}}`}</code> will be substituted per recipient.
                </p>
                {skipped.length > 0 && (
                  <p className="text-yellow-700 text-xs mt-2">
                    ⚠ {skipped.length} employee(s) will be skipped (manager has no email).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Template</label>
                <textarea
                  rows={6}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Recipients ({sendable.length})</p>
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                  {sendable.map(e => (
                    <div key={e.id} className="px-3 py-2 text-sm border-b border-gray-100 last:border-0">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-gray-500"> → {e.manager_name} &lt;{e.manager_email}&gt;</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="font-medium text-green-800">Done</p>
                <p className="text-sm text-green-700 mt-1">
                  Sent: {results.sent} · Skipped: {results.skipped} · Errors: {results.error}
                </p>
              </div>
              <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {results.results.map((r, i) => (
                  <div key={i} className="px-3 py-2 text-xs border-b border-gray-100 last:border-0 flex justify-between">
                    <span>Employee #{r.employee_id}</span>
                    <span className={
                      r.status === 'sent' ? 'text-green-600' :
                      r.status === 'skipped' ? 'text-yellow-600' :
                      'text-red-600'
                    }>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          {!results ? (
            <>
              <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sendable.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : `Send ${sendable.length} Reminder${sendable.length === 1 ? '' : 's'}`}
              </button>
            </>
          ) : (
            <button
              onClick={() => { onSent && onSent(results); onClose() }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

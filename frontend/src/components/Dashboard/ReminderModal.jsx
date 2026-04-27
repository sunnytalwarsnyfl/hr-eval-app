import { useState, useEffect } from 'react'
import { notificationsApi } from '../../api/notifications'

export default function ReminderModal({ employee, manager, onClose, onSent }) {
  const defaultSubject = employee
    ? `Reminder: ${employee.name} Evaluation Due`
    : 'Reminder: Evaluation Due'

  const defaultMessage = employee
    ? `Hello${manager?.name ? ' ' + manager.name : ''},\n\n` +
      `This is a friendly reminder that an evaluation is due for ${employee.name}` +
      `${employee.department ? ' in ' + employee.department : ''}` +
      `${employee.anniversary_date ? ' (anniversary: ' + employee.anniversary_date + ')' : ''}.\n\n` +
      `Please log in to the SIPS HR Evaluation System to schedule it at your earliest convenience.\n\n` +
      `Thank you.`
    : ''

  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setSubject(defaultSubject)
    setMessage(defaultMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, manager?.id])

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const payload = {
        employee_id: employee.id,
        manager_id: manager?.id || employee?.manager_id,
        subject,
        message
      }
      const res = await notificationsApi.sendReminder(payload)
      if (onSent) onSent(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reminder')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Send Reminder</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="text-sm text-gray-600">
            <div><span className="text-gray-500">To manager:</span> <span className="font-medium">{manager?.name || employee?.manager_name || 'Unassigned'}</span></div>
            <div><span className="text-gray-500">Regarding employee:</span> <span className="font-medium">{employee?.name}</span></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={7}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !manager?.id && !employee?.manager_id}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Reminder'}
          </button>
        </div>
      </div>
    </div>
  )
}

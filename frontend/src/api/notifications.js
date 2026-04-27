import client from './client'

export const notificationsApi = {
  sendReminders: () => client.post('/notifications/send-reminders'),
  sendInvite: (employeeId) => client.post(`/notifications/invite/${employeeId}`),
  sendReminder: (payload) => client.post('/notifications/reminder', payload)
}

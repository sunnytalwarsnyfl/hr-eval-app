import client from './client'

export const attendanceApi = {
  list: (params) => client.get('/attendance', { params }),
  get: (id) => client.get(`/attendance/${id}`),
  create: (data) => client.post('/attendance', data),
  update: (id, data) => client.put(`/attendance/${id}`, data),
  remove: (id) => client.delete(`/attendance/${id}`),
  summary: () => client.get('/attendance/summary'),
}

export const disciplinaryApi = {
  list: (params) => client.get('/disciplinary', { params }),
  get: (id) => client.get(`/disciplinary/${id}`),
  create: (data) => client.post('/disciplinary', data),
  update: (id, data) => client.put(`/disciplinary/${id}`, data),
  remove: (id) => client.delete(`/disciplinary/${id}`),
  summary: () => client.get('/disciplinary/summary'),
}

export const qaLogApi = {
  list: (params) => client.get('/qa-log', { params }),
  get: (id) => client.get(`/qa-log/${id}`),
  create: (data) => client.post('/qa-log', data),
  update: (id, data) => client.put(`/qa-log/${id}`, data),
  remove: (id) => client.delete(`/qa-log/${id}`),
}

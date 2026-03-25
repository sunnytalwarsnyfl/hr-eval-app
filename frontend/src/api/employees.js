import client from './client'

export const employeesApi = {
  list: (params) => client.get('/employees', { params }),
  get: (id) => client.get(`/employees/${id}`),
  create: (data) => client.post('/employees', data),
  update: (id, data) => client.put(`/employees/${id}`, data),
  remove: (id) => client.delete(`/employees/${id}`),
  sendInvite: (id) => client.post(`/employees/${id}/invite`),
  getManagers: () => client.get('/users/managers')
}

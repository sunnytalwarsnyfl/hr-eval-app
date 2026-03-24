import client from './client'

export const employeesApi = {
  list: (params) => client.get('/employees', { params }),
  get: (id) => client.get(`/employees/${id}`),
  create: (data) => client.post('/employees', data),
  update: (id, data) => client.put(`/employees/${id}`, data),
  getManagers: () => client.get('/users/managers')
}

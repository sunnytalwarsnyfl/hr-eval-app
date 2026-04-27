import client from './client'

export const complianceApi = {
  list: (params) => client.get('/compliance', { params }),
  create: (data) => client.post('/compliance', data),
  update: (id, data) => client.put(`/compliance/${id}`, data),
  remove: (id) => client.delete(`/compliance/${id}`),
}

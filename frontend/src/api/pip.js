import client from './client'

export const pipApi = {
  list: (params) => client.get('/pip', { params }),
  get: (id) => client.get(`/pip/${id}`),
  create: (data) => client.post('/pip', data),
  update: (id, data) => client.put(`/pip/${id}`, data),
  updateStatus: (id, status) => client.patch(`/pip/${id}/status`, { status }),
  remove: (id) => client.delete(`/pip/${id}`)
}

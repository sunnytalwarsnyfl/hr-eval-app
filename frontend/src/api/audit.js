import client from './client'

export const auditApi = {
  list: (params) => client.get('/audit', { params }),
  forEntity: (type, id) => client.get(`/audit/entity/${type}/${id}`),
}

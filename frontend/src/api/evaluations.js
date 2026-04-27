import client from './client'

export const evaluationsApi = {
  list: (params) => client.get('/evaluations', { params }),
  get: (id) => client.get(`/evaluations/${id}`),
  create: (data) => client.post('/evaluations', data),
  update: (id, data) => client.put(`/evaluations/${id}`, data),
  acknowledge: (id, data) => client.patch(`/evaluations/${id}/acknowledge`, data),
  hrReviewData: (id) => client.get(`/evaluations/${id}/hr-review-data`),
  hrReview: (id, data) => client.patch(`/evaluations/${id}/hr-review`, data),
  delete: (id) => client.delete(`/evaluations/${id}`)
}

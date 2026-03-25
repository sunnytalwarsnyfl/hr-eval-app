import client from './client'

export const settingsApi = {
  // Departments
  getDepartments: () => client.get('/settings/departments'),
  createDepartment: (data) => client.post('/settings/departments', data),
  updateDepartment: (id, data) => client.put(`/settings/departments/${id}`, data),
  deleteDepartment: (id) => client.delete(`/settings/departments/${id}`),

  // Facilities
  getFacilities: () => client.get('/settings/facilities'),
  createFacility: (data) => client.post('/settings/facilities', data),
  updateFacility: (id, data) => client.put(`/settings/facilities/${id}`, data),
  deleteFacility: (id) => client.delete(`/settings/facilities/${id}`),

  // Users
  getUsers: () => client.get('/settings/users'),
  createUser: (data) => client.post('/settings/users', data),
  updateUser: (id, data) => client.put(`/settings/users/${id}`, data),
  deleteUser: (id) => client.delete(`/settings/users/${id}`),
}

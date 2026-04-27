import client from './client'

export const reportsApi = {
  dashboard: () => client.get('/reports/dashboard'),
  deptScores: (params) => client.get('/reports/dept-scores', { params }),
  evalsDue: () => client.get('/reports/evals-due'),
  scoreDistribution: (params) => client.get('/reports/score-distribution', { params }),
  pipTracking: () => client.get('/reports/pip-tracking'),
  evalCalendar: () => client.get('/reports/eval-calendar'),
}

import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  withCredentials: true
})

client.interceptors.response.use(
  r => r,
  err => {
    // Don't redirect for the session-check call — let App.jsx handle it
    const url = err.config?.url || ''
    if (err.response?.status === 401 && !url.includes('/auth/me')) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client

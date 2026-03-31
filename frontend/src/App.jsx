import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import client from './api/client'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewEvaluation from './pages/NewEvaluation'
import EvaluationDetail from './pages/EvaluationDetail'
import EvaluationList from './pages/EvaluationList'
import EmployeeList from './pages/EmployeeList'
import EmployeeProfile from './pages/EmployeeProfile'
import AddEmployee from './pages/AddEmployee'
import EditEmployee from './pages/EditEmployee'
import Reports from './pages/Reports'
import PIPList from './pages/PIPList'
import PIPDetail from './pages/PIPDetail'
import PIPForm from './pages/PIPForm'
import Settings from './pages/Settings'
import NewTechEvaluation from './pages/NewTechEvaluation'
import ProtectedRoute from './components/Shared/ProtectedRoute'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to restore session from httpOnly cookie
    client.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/evaluations" element={
            <ProtectedRoute><EvaluationList /></ProtectedRoute>
          } />
          <Route path="/evaluations/new" element={
            <ProtectedRoute><NewEvaluation /></ProtectedRoute>
          } />
          <Route path="/evaluations/tech/new" element={
            <ProtectedRoute><NewTechEvaluation /></ProtectedRoute>
          } />
          <Route path="/evaluations/:id" element={
            <ProtectedRoute><EvaluationDetail /></ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute><EmployeeList /></ProtectedRoute>
          } />
          <Route path="/employees/new" element={
            <ProtectedRoute><AddEmployee /></ProtectedRoute>
          } />
          <Route path="/employees/:id/edit" element={
            <ProtectedRoute><EditEmployee /></ProtectedRoute>
          } />
          <Route path="/employees/:id" element={
            <ProtectedRoute><EmployeeProfile /></ProtectedRoute>
          } />
          <Route path="/pip" element={
            <ProtectedRoute><PIPList /></ProtectedRoute>
          } />
          <Route path="/pip/new" element={
            <ProtectedRoute><PIPForm /></ProtectedRoute>
          } />
          <Route path="/pip/:id/edit" element={
            <ProtectedRoute><PIPForm /></ProtectedRoute>
          } />
          <Route path="/pip/:id" element={
            <ProtectedRoute><PIPDetail /></ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute><Reports /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute><Settings /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

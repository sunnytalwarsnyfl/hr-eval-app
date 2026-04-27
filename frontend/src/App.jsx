import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import client from './api/client'
import ErrorBoundary from './components/Shared/ErrorBoundary'

// Eager imports — small or critical for first paint
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/Shared/ProtectedRoute'

// Lazy-loaded pages
const NewEvaluation = lazy(() => import('./pages/NewEvaluation'))
const NewTechEvaluation = lazy(() => import('./pages/NewTechEvaluation'))
const EvaluationDetail = lazy(() => import('./pages/EvaluationDetail'))
const EvaluationList = lazy(() => import('./pages/EvaluationList'))
const EmployeeList = lazy(() => import('./pages/EmployeeList'))
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'))
const AddEmployee = lazy(() => import('./pages/AddEmployee'))
const EditEmployee = lazy(() => import('./pages/EditEmployee'))
const EmployeeMyEvals = lazy(() => import('./pages/EmployeeMyEvals'))
const AttendanceLog = lazy(() => import('./pages/AttendanceLog'))
const DisciplinaryAction = lazy(() => import('./pages/DisciplinaryAction'))
const DisciplinarySignPortal = lazy(() => import('./pages/DisciplinarySignPortal'))
const QALog = lazy(() => import('./pages/QALog'))
const PIPList = lazy(() => import('./pages/PIPList'))
const PIPDetail = lazy(() => import('./pages/PIPDetail'))
const PIPForm = lazy(() => import('./pages/PIPForm'))
const Reports = lazy(() => import('./pages/Reports'))
const NotificationLog = lazy(() => import('./pages/NotificationLog'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const EvalCalendar = lazy(() => import('./pages/EvalCalendar'))
const Settings = lazy(() => import('./pages/Settings'))
const SelfEvalPortal = lazy(() => import('./pages/SelfEvalPortal'))

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 mt-3">Loading...</p>
      </div>
    </div>
  )
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
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, setUser, loading }}>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={
                user
                  ? <Navigate to={user.role === 'employee' ? '/my-evaluations' : '/dashboard'} replace />
                  : <Login />
              } />
              <Route path="/self-eval/invite/:token" element={<SelfEvalPortal />} />
              <Route path="/disciplinary/sign/:id/:token" element={<DisciplinarySignPortal />} />
              <Route path="/my-evaluations" element={
                <ProtectedRoute><EmployeeMyEvals /></ProtectedRoute>
              } />
              <Route path="/" element={
                <Navigate to={user?.role === 'employee' ? '/my-evaluations' : '/dashboard'} replace />
              } />

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
              <Route path="/attendance" element={
                <ProtectedRoute><AttendanceLog /></ProtectedRoute>
              } />
              <Route path="/disciplinary" element={
                <ProtectedRoute><DisciplinaryAction /></ProtectedRoute>
              } />
              <Route path="/qa-log" element={
                <ProtectedRoute><QALog /></ProtectedRoute>
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
              <Route path="/calendar" element={
                <ProtectedRoute><EvalCalendar /></ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute><Reports /></ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute><NotificationLog /></ProtectedRoute>
              } />
              <Route path="/audit" element={
                <ProtectedRoute><AuditLog /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><Settings /></ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthContext.Provider>
    </ErrorBoundary>
  )
}

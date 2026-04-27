import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

function parseViolations(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === 'object' && parsed !== null) return Object.values(parsed)
    return [String(parsed)]
  } catch {
    return String(raw).split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
  }
}

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold">
          S
        </div>
        <div>
          <div className="font-semibold text-gray-900">SIPS Healthcare</div>
          <div className="text-xs text-gray-500">Disciplinary Action - Employee Acknowledgment</div>
        </div>
      </div>
    </header>
  )
}

function ErrorPage({ error }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto p-8 mt-8">
        <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl">!</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Document</h1>
          <p className="text-gray-600 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-4">If you believe this is an error, please contact your HR representative.</p>
        </div>
      </div>
    </div>
  )
}

function SuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto p-8 mt-8">
        <div className="bg-white border border-green-200 rounded-2xl shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-5 text-3xl">✓</div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Signature Recorded</h1>
          <p className="text-gray-600 text-sm">
            Thank you. Your acknowledgment has been recorded. A copy will be retained in your employee file.
          </p>
          <p className="text-gray-500 text-xs mt-6">You may now close this window.</p>
        </div>
      </div>
    </div>
  )
}

export default function DisciplinarySignPortal() {
  const { id, token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signature, setSignature] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [statement, setStatement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/disciplinary/${id}/employee-link/${token}`, { credentials: 'omit' })
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(json.error || `Failed to load (${res.status})`)
        } else if (json.error) {
          setError(json.error)
        } else {
          setData(json.data || json)
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, token])

  async function handleSign() {
    if (!signature.trim()) return alert('Please type your full name to sign.')
    if (!acknowledged) return alert('Please check the acknowledgment box to continue.')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/disciplinary/${id}/employee-link/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ signature, employee_statement: statement })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to sign')
      setSuccess(true)
    } catch (e) {
      alert('Signing failed: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20 text-gray-500">Loading document...</div>
      </div>
    )
  }
  if (error) return <ErrorPage error={error} />
  if (success) return <SuccessPage />
  if (!data) return <ErrorPage error="Document not found" />

  const alreadySigned = !!data.employee_signature
  const violations = parseViolations(data.violations)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disciplinary Action Form</h1>
          <p className="text-sm text-gray-500 mt-1">Please review the details below carefully before signing.</p>
        </div>

        {/* Employee + meta */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Employee Information</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-5 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Employee</div>
              <div className="font-medium text-gray-900">{data.employee_name || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Department</div>
              <div className="font-medium text-gray-900">{data.department || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Job Title</div>
              <div className="font-medium text-gray-900">{data.job_title || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Facility</div>
              <div className="font-medium text-gray-900">{data.facility_name || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Incident Date</div>
              <div className="font-medium text-gray-900">{data.incident_date || data.action_date || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Action Level</div>
              <div className="font-medium text-gray-900">{data.action_level || data.level || '—'}</div>
            </div>
          </div>
        </div>

        {/* Violations */}
        {violations.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-800">Policy Violations</h2>
            </div>
            <ul className="px-6 py-5 space-y-2 text-sm">
              {violations.map((v, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span className="text-gray-700">{typeof v === 'string' ? v : (v.label || v.name || JSON.stringify(v))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Description */}
        {data.description && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-800">Incident Description</h2>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 whitespace-pre-wrap">{data.description}</div>
          </div>
        )}

        {/* Improvement plan / consequences */}
        {(data.improvement_plan || data.consequences || data.expectations) && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-200">
              <h2 className="font-semibold text-amber-800">Plan for Improvement & Consequences</h2>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              {data.improvement_plan && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Improvement Plan</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{data.improvement_plan}</p>
                </div>
              )}
              {data.expectations && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Expectations</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{data.expectations}</p>
                </div>
              )}
              {data.consequences && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Consequences of Further Violations</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{data.consequences}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {alreadySigned ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-sm text-green-800">
            This document was signed by <strong>{data.employee_signature}</strong>
            {data.employee_signed_at ? ` on ${data.employee_signed_at.split('T')[0]}` : ''}. No further action is required.
          </div>
        ) : (
          <>
            {/* Acknowledgment text */}
            <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-200 bg-blue-50">
                <h2 className="font-semibold text-blue-900">Employee Acknowledgment</h2>
              </div>
              <div className="px-6 py-5 space-y-5">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
                  By signing below, I acknowledge the terms set forth and will strive to improve in the areas of concern.
                  I further understand that failure to correct the behavior and/or further violation of company policy
                  will result in additional disciplinary action up to and including termination.
                </div>

                {/* Optional employee statement */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Statement (optional)</label>
                  <textarea
                    rows={4}
                    value={statement}
                    onChange={e => setStatement(e.target.value)}
                    placeholder="If you would like to add a statement or response, you may do so here..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Acknowledgment checkbox */}
                <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={e => setAcknowledged(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    I have read, understand, and acknowledge the contents of this disciplinary action form.
                  </span>
                </label>

                {/* Signature input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type your full name as your electronic signature</label>
                  <input
                    type="text"
                    value={signature}
                    onChange={e => setSignature(e.target.value)}
                    placeholder="Full legal name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base font-serif italic focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your typed name above will serve as your legally binding electronic signature, dated today.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSign}
                    disabled={submitting || !signature.trim() || !acknowledged}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Sign & Submit'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="text-center text-xs text-gray-400 py-6">
          SIPS Healthcare — Confidential HR Document
        </div>
      </main>
    </div>
  )
}

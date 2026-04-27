import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. Mission, Mindset & Accountability',
    items: [
      'I take ownership of my work and outcomes',
      'I align my daily actions with the team mission',
      'I am accountable for the results I produce',
      'I maintain a positive, growth-oriented mindset',
      'I follow through on commitments I make'
    ]
  },
  {
    title: '2. Chain of Command, Communication & Professionalism',
    items: [
      'I respect and follow the established chain of command',
      'I communicate clearly and respectfully with peers',
      'I escalate issues to leadership in a timely manner',
      'I demonstrate professionalism in conflict situations',
      'I keep my supervisor informed of progress and obstacles'
    ]
  },
  {
    title: '3. Standardization, Compliance & Survey Readiness',
    items: [
      'I follow standardized work procedures consistently',
      'I keep my work area survey-ready at all times',
      'I comply with regulatory and policy requirements',
      'I document all activities accurately and completely',
      'I report compliance gaps when I identify them'
    ]
  },
  {
    title: '4. Decontamination Knowledge & Safe Practice',
    items: [
      'I correctly apply decontamination protocols',
      'I use appropriate PPE for every task',
      'I handle contaminated instruments safely',
      'I recognize and respond to bio-hazard exposures',
      'I keep up to date on decontamination best practices'
    ]
  },
  {
    title: '5. Inspection, Sterilization & Quality Control',
    items: [
      'I inspect instruments thoroughly before packaging',
      'I correctly load and operate sterilizers',
      'I verify chemical and biological indicators',
      'I document quality-control checks accurately',
      'I quarantine and report failed loads appropriately'
    ]
  },
  {
    title: '6. Documentation, Traceability, Workflow & Prioritization',
    items: [
      'I complete documentation in real time',
      'I maintain accurate traceability records',
      'I prioritize urgent work effectively',
      'I keep my workflow organized and efficient',
      'I help maintain accurate inventory tracking'
    ]
  },
  {
    title: '7. Culture & Professional Ownership',
    items: [
      'I treat all team members with respect',
      'I contribute to a positive team culture',
      'I take initiative without being asked',
      'I support new team members in onboarding',
      'I model the values of the organization',
      'I take pride in the quality of my work',
      'I seek feedback and act on it constructively',
      'I share knowledge with peers willingly',
      'I support continuous improvement initiatives',
      'I uphold patient safety as my top priority',
      'I demonstrate reliability in attendance and punctuality',
      'I handle confidential information appropriately',
      'I represent the department professionally outside the team',
      'I take ownership of my professional development'
    ]
  }
]

const SCORE_OPTIONS = [
  { value: 0, label: '0 - Does not meet' },
  { value: 1, label: '1 - Developing' },
  { value: 2, label: '2 - Meets' },
  { value: 3, label: '3 - Exceeds' }
]

const CAREER_OPTIONS = [
  'Not at this time',
  'Yes within 18-24 months',
  'Yes sooner than later'
]

export default function SelfEvalPortal() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [error, setError] = useState(null)
  const [employee, setEmployee] = useState(null)

  // form state
  const [scores, setScores] = useState({}) // key: `${si}-${ii}` -> 0-3
  const [comments, setComments] = useState('')
  const [concerns, setConcerns] = useState('')
  const [careerInterest, setCareerInterest] = useState('')
  const [careerDetail, setCareerDetail] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Account creation post-submit
  const [showAccountSetup, setShowAccountSetup] = useState(true)
  const [accountSkipped, setAccountSkipped] = useState(false)
  const [accountCreated, setAccountCreated] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdError, setPwdError] = useState(null)
  const [pwdSubmitting, setPwdSubmitting] = useState(false)

  async function handleCreateAccount(e) {
    e.preventDefault()
    setPwdError(null)
    if (!pwd || pwd.length < 8) {
      setPwdError('Password must be at least 8 characters')
      return
    }
    if (pwd !== pwdConfirm) {
      setPwdError('Passwords do not match')
      return
    }
    setPwdSubmitting(true)
    try {
      const res = await fetch('/api/auth/invite/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password: pwd })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setPwdError(data.error || 'Failed to create account')
      } else {
        setAccountCreated(true)
      }
    } catch (err) {
      setPwdError('Network error creating account')
    } finally {
      setPwdSubmitting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch(`/api/auth/invite/${token}`, { credentials: 'include' })
        const data = await res.json()
        if (cancelled) return
        if (data.valid) {
          setValid(true)
          setEmployee({
            name: data.employee_name,
            id: data.employee_id,
            department: data.department,
            job_title: data.job_title
          })
        } else {
          setValid(false)
          setError(data.error || 'Invite is invalid')
        }
      } catch (e) {
        if (!cancelled) setError('Unable to validate invite link')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [token])

  function setScore(si, ii, value) {
    setScores(prev => ({ ...prev, [`${si}-${ii}`]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    // Build sections payload
    const sectionsPayload = SECTIONS.map((sec, si) => ({
      title: sec.title,
      items: sec.items.map((label, ii) => ({
        label,
        score: scores[`${si}-${ii}`] ?? null
      }))
    }))

    // Validate all items scored
    const unscored = sectionsPayload.flatMap(s => s.items.filter(it => it.score === null))
    if (unscored.length > 0) {
      setSubmitError(`Please score all ${unscored.length} remaining item(s).`)
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/auth/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          sections: sectionsPayload,
          comments,
          concerns,
          career_interest: careerInterest,
          career_interest_detail: careerDetail
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to submit')
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      setSubmitError('Network error submitting evaluation')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Validating invite...</div>
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Unavailable</h1>
          <p className="text-gray-600 text-sm">{error || 'This invite link is no longer valid.'}</p>
          <p className="text-gray-400 text-xs mt-4">Please contact HR if you need a new invite.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-green-200 shadow-sm p-8">
          <div className="text-center">
            <div className="text-5xl mb-3">✅</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Self-Evaluation Submitted</h1>
            <p className="text-gray-600 text-sm">Thank you, {employee?.name}. Your manager and HR have been notified.</p>
          </div>

          {accountCreated ? (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm font-medium text-green-800">Account created!</p>
              <p className="text-xs text-green-700 mt-1">You can now log in with your email and password.</p>
              <a href="/login" className="inline-block mt-3 text-sm text-blue-600 hover:underline font-medium">
                Go to Login →
              </a>
            </div>
          ) : accountSkipped ? (
            <p className="text-gray-400 text-xs mt-4 text-center">You may now close this window.</p>
          ) : showAccountSetup ? (
            <form onSubmit={handleCreateAccount} className="mt-6 pt-6 border-t border-gray-200">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Create Account (Optional)</h2>
              <p className="text-xs text-gray-500 mb-4">
                Want to access your evaluations later? Set a password to create an account.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password (min 8 characters)</label>
                  <input
                    type="password"
                    value={pwd}
                    onChange={e => setPwd(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={pwdConfirm}
                    onChange={e => setPwdConfirm(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
                {pwdError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-xs">
                    {pwdError}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={pwdSubmitting}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {pwdSubmitting ? 'Creating...' : 'Create Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAccountSetup(false); setAccountSkipped(true) }}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Self-Evaluation</h1>
          <p className="text-sm text-gray-500 mt-1">
            {employee?.name}{employee?.department ? ` • ${employee.department}` : ''}{employee?.job_title ? ` • ${employee.job_title}` : ''}
          </p>
          <p className="text-xs text-gray-500 mt-3">
            Score each item from 0 (does not meet) to 3 (exceeds expectations). All items are required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {SECTIONS.map((sec, si) => (
            <div key={si} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4">{sec.title}</h2>
              <div className="space-y-4">
                {sec.items.map((item, ii) => {
                  const key = `${si}-${ii}`
                  return (
                    <div key={ii} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-sm text-gray-700 mb-2">{item}</p>
                      <div className="flex gap-2 flex-wrap">
                        {SCORE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setScore(si, ii, opt.value)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                              scores[key] === opt.value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Open-Ended Questions</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Do you have any concerns you would like to share?
              </label>
              <textarea
                value={concerns}
                onChange={e => setConcerns(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Are you interested in career advancement?
              </label>
              <div className="flex flex-col gap-2">
                {CAREER_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="careerInterest"
                      value={opt}
                      checked={careerInterest === opt}
                      onChange={() => setCareerInterest(opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tell us more about your career goals:
              </label>
              <textarea
                value={careerDetail}
                onChange={e => setCareerDetail(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional comments
              </label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {submitError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Self-Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

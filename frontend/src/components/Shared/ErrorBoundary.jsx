import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.setState({ errorInfo })
    // Future: send to error tracking service (Sentry, etc.)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-2xl w-full p-8">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
              <p className="text-sm text-gray-500 mt-1">An unexpected error occurred. The team has been notified.</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-xs font-medium text-gray-700 mb-1">Error details:</p>
            <p className="text-xs text-gray-600 font-mono">{this.state.error?.message || 'Unknown error'}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Reload Page
            </button>
            <a
              href="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Go to Dashboard →
            </a>
          </div>

          {/* Dev-only stack trace */}
          {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
            <details className="mt-6">
              <summary className="text-xs text-gray-500 cursor-pointer">Stack trace (dev only)</summary>
              <pre className="text-xs bg-gray-100 border border-gray-200 rounded p-3 mt-2 overflow-x-auto whitespace-pre-wrap">
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}

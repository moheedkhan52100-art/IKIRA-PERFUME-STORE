import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import loginBackgroundVideo from '../../../images/background/BACKGROUND.mp4'
import { createAdminSession } from '../services/products.js'
import {
  createCustomerSession,
  registerCustomer,
} from '../services/customerAuth.js'
import './LoginPage.css'

function LoginPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const [fullName, setFullName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const registering = mode === 'register'
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const isCustomerLogin = registering || identifier.includes('@')
      if (isCustomerLogin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        setError('Enter a valid email address.')
        return
      }

      if (!isCustomerLogin) {
        await createAdminSession({ username: identifier, password })
        navigate('/admin', { replace: true })
        return
      }

      const response = registering
        ? await registerCustomer({ fullName, email: identifier, password })
        : await createCustomerSession({ email: identifier, password })
      window.dispatchEvent(new CustomEvent('ikira:customer-session', {
        detail: { customer: response.data.customer },
      }))
      navigate('/account', { replace: true })
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="account-page section-wrap login-page">
      <video className="login-background-video" autoPlay={!prefersReducedMotion} muted loop={!prefersReducedMotion} playsInline preload={prefersReducedMotion ? 'none' : 'metadata'} aria-hidden="true" tabIndex={-1}>
        <source src={loginBackgroundVideo} type="video/mp4" />
      </video>
      <section className="account-card login-card" aria-labelledby="login-title">
        <p className="eyebrow">IKIRA / Store access</p>
        <h1 id="login-title">{registering ? 'Create your account.' : 'Welcome back.'}</h1>
        <p>{registering
          ? 'Join IKIRA to create your customer account.'
          : 'Sign in to your IKIRA account.'}</p>

        <form className="account-form unified-login-form" onSubmit={handleSubmit}>
          {registering && (
            <label>
              Full name
              <input
                autoComplete="name"
                maxLength={100}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
          )}

          <label>
            Email address
            <input
              autoComplete="username"
              maxLength={254}
              placeholder="Your email address"
              required
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>

          <label>
            Password
            <span className="password-input-wrap">
              <input
                autoComplete={registering ? 'new-password' : 'current-password'}
                minLength={registering ? 8 : undefined}
                maxLength={256}
                required
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="password-visibility-toggle"
                type="button"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible
                  ? <Eye size={18} aria-hidden="true" />
                  : <EyeOff size={18} aria-hidden="true" />}
              </button>
            </span>
          </label>

          {error && <p className="admin-error" role="alert">{error}</p>}

          <button className="hero-cta" type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : registering
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        {(registering || !identifier || identifier.includes('@')) && (
          <div className="unified-login-switch">
            {registering ? 'Already have an account?' : 'New to IKIRA?'}
            <button
              type="button"
              onClick={() => {
                setMode(registering ? 'login' : 'register')
                setError('')
              }}
            >
              {registering ? 'Sign in' : 'Create account'}
            </button>
          </div>
        )}

        <Link className="unified-login-store-link" to="/">
          Return to IKIRA store
        </Link>
      </section>
    </main>
  )
}

export default LoginPage

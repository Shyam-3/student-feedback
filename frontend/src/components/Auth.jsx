import React, { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import './Auth.css'

const ALLOWED_DOMAIN = 'tce.edu'

const Auth = ({
  user,
  onAuthSuccess,
  mode = 'full',
  title,
  subtitle,
}) => {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validateEmail = (email) => {
    const normalized = email.trim().toLowerCase()
    const domain = normalized.split('@')[1]
    return domain === ALLOWED_DOMAIN
  }

  const ensureUserProfile = async (currentUser) => {
    const userRef = doc(db, 'users', currentUser.uid)
    const existingUser = await getDoc(userRef)
    if (!existingUser.exists()) {
      const fallbackName = currentUser.displayName
        || currentUser.email?.split('@')[0]
        || 'Faculty'
      await setDoc(userRef, {
        uid: currentUser.uid,
        name: fallbackName,
        email: currentUser.email?.trim().toLowerCase() || '',
        role: 'faculty',
        createdAt: new Date().toISOString(),
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate email domain
    if (!validateEmail(email)) {
      setError(`Only ${ALLOWED_DOMAIN} email addresses are allowed`)
      setLoading(false)
      return
    }

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (isLogin) {
        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password)
        await ensureUserProfile(credential.user)
      } else {
        if (!name.trim()) {
          setError('User name is required for sign up')
          setLoading(false)
          return
        }
        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        await updateProfile(credential.user, { displayName: name.trim() })

        await ensureUserProfile(credential.user)
      }
      onAuthSuccess?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      setError(err.message)
    }
  }

  if (user) {
    const displayName = user.displayName || user.email?.split('@')[0] || 'Faculty'

    if (mode === 'compact') {
      return (
        <div className="auth-user-chip">
          <div className="chip-text">
            <span className="chip-label">Logged in as</span>
            <span className="chip-name">{displayName}</span>
          </div>
          <button onClick={handleSignOut} className="btn btn-secondary">
            Sign Out
          </button>
        </div>
      )
    }

    return (
      <div className="auth-container">
        <div className="auth-panel">
          <div className="user-info">
            <span className="user-email">{displayName}</span>
            <button onClick={handleSignOut} className="btn btn-secondary">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-panel">
        <h2>{title || (isLogin ? 'Sign In' : 'Create Account')}</h2>
        <p className="auth-subtitle">
          {subtitle || `Faculty members with @${ALLOWED_DOMAIN} email only`}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">User Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required={!isLogin}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`your.name@${ALLOWED_DOMAIN}`}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setName('')
            }}
            className="link-button"
            disabled={loading}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Auth

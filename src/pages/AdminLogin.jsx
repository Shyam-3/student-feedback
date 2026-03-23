import React, { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase/config'
import Auth from '../components/Auth.jsx'

const ADMIN_ROLES = new Set(['hod'])

const AdminLogin = () => {
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const navigate = useNavigate()

  const verifyAdmin = useCallback(async (uid) => {
    setChecking(true)
    setError('')
    try {
      const userRef = doc(db, 'users', uid)
      const snapshot = await getDoc(userRef)
      const role = snapshot.exists() ? snapshot.data().role : null

      if (ADMIN_ROLES.has(role)) {
        navigate('/admin')
        return
      }

      navigate('/', { replace: true })
    } catch (err) {
      setError('Unable to verify admin access. Please try again.')
    } finally {
      setChecking(false)
    }
  }, [navigate])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        return
      }
      await verifyAdmin(currentUser.uid)
    })

    return () => unsubscribe()
  }, [verifyAdmin])

  return (
    <div>
      <Auth
        title="Admin Login"
        subtitle="HOD access only"
        onAuthSuccess={() => {
          if (auth.currentUser) {
            verifyAdmin(auth.currentUser.uid)
          }
        }}
      />
      {checking && (
        <div className="admin-auth-status">
          <p>Checking admin permissions...</p>
        </div>
      )}
      {error && (
        <div className="admin-auth-status error">
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}

export default AdminLogin

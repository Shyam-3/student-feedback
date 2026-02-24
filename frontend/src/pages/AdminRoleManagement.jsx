import React, { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { Link, useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase/config'
import Auth from '../components/Auth.jsx'
import '../App.css'

const ADMIN_ROLES = new Set(['hod'])

const AdminRoleManagement = () => {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [users, setUsers] = useState([])
  const [roleSavingFor, setRoleSavingFor] = useState('')
  const navigate = useNavigate()

  const verifyAdmin = useCallback(async (uid) => {
    try {
      const userRef = doc(db, 'users', uid)
      const snapshot = await getDoc(userRef)
      const role = snapshot.exists() ? snapshot.data().role : null

      if (ADMIN_ROLES.has(role)) {
        return true
      }

      navigate('/', { replace: true })
      return false
    } catch (err) {
      setError('Unable to verify admin access.')
      await signOut(auth)
      navigate('/admin/login')
      return false
    }
  }, [navigate])

  const loadUsers = useCallback(async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const allUsers = usersSnapshot.docs
        .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        .sort((left, right) =>
          String(left.name || left.email || '').localeCompare(String(right.name || right.email || ''))
        )
      setUsers(allUsers)
    } catch (err) {
      setError('Unable to load users.')
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null)
        setAuthLoading(false)
        navigate('/admin/login')
        return
      }

      const isAdmin = await verifyAdmin(currentUser.uid)
      if (!isAdmin) {
        setUser(null)
        setAuthLoading(false)
        return
      }

      setUser(currentUser)
      setAuthLoading(false)
      await loadUsers()
    })

    return () => unsubscribe()
  }, [loadUsers, navigate, verifyAdmin])

  const updateUserRole = async (targetUser, newRole) => {
    if (!targetUser?.id || !newRole) {
      return
    }

    if (targetUser.id === user?.uid && newRole !== targetUser.role) {
      setError('You cannot change your own role from this panel.')
      return
    }

    setError('')
    setInfo('')
    setRoleSavingFor(targetUser.id)

    try {
      await setDoc(
        doc(db, 'users', targetUser.id),
        {
          role: newRole,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.uid || '',
        },
        { merge: true }
      )

      setUsers((previous) =>
        previous.map((item) => (item.id === targetUser.id ? { ...item, role: newRole } : item))
      )
      setInfo(`Updated role for ${targetUser.name || targetUser.email || 'user'} to ${newRole}.`)
    } catch (err) {
      setError('Unable to update user role. Check Firestore rules for users collection update.')
    } finally {
      setRoleSavingFor('')
    }
  }

  if (authLoading) {
    return (
      <div className="app loading-container">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Auth title="Admin Login" subtitle="HOD access only" />
  }

  return (
    <div className="app admin-page">
      <header className="hero admin-hero">
        <div>
          <p className="eyebrow">Admin Role Management</p>
          <h1>Control HOD and admin access.</h1>
        </div>
        <div className="hero-actions">
          <Link className="admin-link" to="/admin">
            Admin Dashboard
          </Link>
          <Link className="admin-link" to="/login">
            Faculty Dashboard
          </Link>
          <Auth user={user} mode="compact" />
        </div>
      </header>

      <section className="panel table-panel">
        <div className="table-header">
          <h2>Role Management</h2>
          <p>Assign role access for faculty and HOD/admin users.</p>
          {error ? <p className="error">{error}</p> : null}
          {info ? <p className="info">{info}</p> : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Set Role</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((userItem) => (
                  <tr key={userItem.id}>
                    <td>{userItem.name || 'N/A'}</td>
                    <td>{userItem.email || 'N/A'}</td>
                    <td>{userItem.role || 'faculty'}</td>
                    <td>
                      <select
                        value={userItem.role || 'faculty'}
                        onChange={(event) => updateUserRole(userItem, event.target.value)}
                        disabled={roleSavingFor === userItem.id || userItem.id === user?.uid}
                        className="role-select"
                      >
                        <option value="faculty">faculty</option>
                        <option value="hod">hod</option>
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default AdminRoleManagement

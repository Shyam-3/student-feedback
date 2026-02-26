import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { Link, useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase/config'
import Auth from '../components/Auth.jsx'
import '../App.css'

const ADMIN_ROLES = new Set(['hod'])

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined) {
    return '--'
  }
  return Number(value).toFixed(digits)
}

const getSectionPercentage = (report, sectionLabel) => {
  const match = report.sections?.find((section) => section.label === sectionLabel)
  return match?.percentage ?? null
}

const AdminDashboard = () => {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError] = useState('')
  const [reports, setReports] = useState([])
  const [faculty, setFaculty] = useState([])
  const [userDirectory, setUserDirectory] = useState({})
  const navigate = useNavigate()

  const getReportFacultyName = useCallback(
    (item) => {
      const liveName = item.userId ? userDirectory[item.userId]?.name : ''
      return liveName || item.uploaderName || item.userName || 'N/A'
    },
    [userDirectory]
  )

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

  const loadData = useCallback(async () => {
    try {
      const [reportsSnapshot, usersSnapshot] = await Promise.all([
        getDocs(collection(db, 'reports')),
        getDocs(collection(db, 'users')),
      ])

      const allReports = reportsSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))
      allReports.sort(
        (left, right) =>
          new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
      )
      setReports(allReports)

      const allFaculty = usersSnapshot.docs
        .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        .filter((userItem) => userItem.role === 'faculty')
      setFaculty(allFaculty)

      const liveDirectory = usersSnapshot.docs.reduce((acc, docItem) => {
        acc[docItem.id] = docItem.data()
        return acc
      }, {})
      setUserDirectory(liveDirectory)
    } catch (err) {
      setError('Unable to load admin data.')
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
      await loadData()
    })

    return () => unsubscribe()
  }, [loadData, navigate, verifyAdmin])

  const facultySummary = useMemo(() => {
    const summary = new Map()
    reports.forEach((item) => {
      const name = getReportFacultyName(item)
      if (!summary.has(name)) {
        summary.set(name, new Set())
      }
      if (item.subjectHandled) {
        summary.get(name).add(item.subjectHandled)
      }
    })
    return Array.from(summary.entries()).map(([name, subjects]) => ({
      name,
      subjects: Array.from(subjects),
    }))
  }, [reports, getReportFacultyName])

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
          <p className="eyebrow">Admin Dashboard</p>
          <h1>View faculty uploads and manage reports.</h1>
        </div>
        <div className="hero-actions">
          <Link className="admin-link" to="/admin/role">
            Role Management
          </Link>
          <Link className="admin-link" to="/login">
            Faculty Dashboard
          </Link>
          <Auth user={user} mode="compact" displayNameOverride={userDirectory[user?.uid]?.name} />
        </div>
      </header>

      <section className="panel">
        <div>
          <h2>Overall Data Snapshot</h2>
          <p className="lead">This page displays aggregated faculty and report data only.</p>
          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="hero-card">
          <h2>Admin Snapshot</h2>
          <p className="stat-label">Faculty Count</p>
          <p className="stat-value">{faculty.length}</p>
          <p className="stat-label">Total Reports</p>
          <p className="stat-value accent">{reports.length}</p>
          <p className="hint">Upload is available in the Faculty Dashboard.</p>
        </div>
      </section>

      <section className="panel admin-panel">
        <div>
          <h2>Faculty Overview</h2>
          <p className="lead">Subjects handled by each faculty member.</p>
        </div>
        <div className="admin-list">
          {facultySummary.length ? (
            facultySummary.map((item) => (
              <div key={item.name} className="admin-card">
                <h3>{item.name}</h3>
                <div className="admin-subjects">
                  {item.subjects.length
                    ? item.subjects.map((subject) => (
                        <span key={subject}>{subject}</span>
                      ))
                    : 'No subjects recorded'}
                </div>
              </div>
            ))
          ) : (
            <div className="report-empty">No faculty uploads yet.</div>
          )}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-header">
          <h2>All Uploaded Reports</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Subject</th>
                <th>Section</th>
                <th>Course Content %</th>
                <th>Course Outcome %</th>
                <th>Content Delivery %</th>
                <th>Assessment %</th>
                <th>Overall %</th>
              </tr>
            </thead>
            <tbody>
              {reports.length ? (
                reports.map((item) => (
                  <tr key={item.id}>
                    <td>{getReportFacultyName(item)}</td>
                    <td>{item.subjectHandled || 'N/A'}</td>
                    <td>{item.section || 'N/A'}</td>
                    <td>{formatNumber(getSectionPercentage(item, 'Course Content'))}%</td>
                    <td>{formatNumber(getSectionPercentage(item, 'Course Outcome'))}%</td>
                    <td>{formatNumber(getSectionPercentage(item, 'Content Delivery'))}%</td>
                    <td>{formatNumber(getSectionPercentage(item, 'Assessment'))}%</td>
                    <td>{formatNumber(item.overallPercentage)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    No report data available.
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

export default AdminDashboard

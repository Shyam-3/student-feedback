import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore'
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

const normalizeSortValue = (value) => String(value || '').trim().toLowerCase()

const getSectionTail = (value) => {
  const text = String(value || '').trim()
  if (!text) {
    return 'N/A'
  }
  const tokens = text.split(/[\s\-/]+/).filter(Boolean)
  const lastToken = tokens.at(-1) || text
  const letters = lastToken.match(/[A-Za-z]+$/)
  if (letters?.[0]) {
    return letters[0].toUpperCase()
  }
  return lastToken.toUpperCase()
}

const LOW_ALERT_THRESHOLD = 83

const isLowPercentage = (value) =>
  value !== null && value !== undefined && Number(value) < LOW_ALERT_THRESHOLD

const ROWS_PER_PAGE_STORAGE_KEY = 'adminReportsRowsPerPage'
const COURSE_FILTER_STORAGE_KEY = 'adminReportsCourseFilter'
const SECTION_FILTER_STORAGE_KEY = 'adminReportsSectionFilter'

const getInitialFilterValue = (storageKey) => localStorage.getItem(storageKey) || 'all'

const getInitialRowsPerPage = () => {
  const storedValue = Number.parseInt(localStorage.getItem(ROWS_PER_PAGE_STORAGE_KEY) || '', 10)
  if ([10, 25, 50].includes(storedValue)) {
    return storedValue
  }
  return 10
}

const AdminDashboard = () => {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError] = useState('')
  const [reports, setReports] = useState([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [userDirectory, setUserDirectory] = useState({})
  const [courseFilter, setCourseFilter] = useState(() => getInitialFilterValue(COURSE_FILTER_STORAGE_KEY))
  const [sectionFilter, setSectionFilter] = useState(() => getInitialFilterValue(SECTION_FILTER_STORAGE_KEY))
  const [thresholdFilter, setThresholdFilter] = useState('lt-threshold')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(getInitialRowsPerPage)
  const [deletingReportId, setDeletingReportId] = useState('')
  const [pendingDeleteReport, setPendingDeleteReport] = useState(null)
  const navigate = useNavigate()

  const currentUserProfile = user?.uid ? userDirectory[user.uid] : null

  const getReportFacultyName = useCallback(
    (item) => {
      const liveName = item.userId ? userDirectory[item.userId]?.name : ''
      return liveName || item.uploaderName || item.userName || 'N/A'
    },
    [userDirectory]
  )

  const courseOptions = useMemo(() => {
    const values = new Set(
      reports
        .map((item) => item.subjectHandled)
        .filter((item) => item && String(item).trim().length)
        .map((item) => String(item).trim())
    )
    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [reports])

  const sectionOptions = useMemo(() => {
    const values = new Set(
      reports
        .map((item) => getSectionTail(item.section))
        .filter((item) => item !== 'N/A')
    )
    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [reports])

  const filteredSortedReports = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return reports
      .filter((item) => {
        const subject = String(item.subjectHandled || '').trim()
        const sectionTail = getSectionTail(item.section)
        const facultyName = getReportFacultyName(item).toLowerCase()
        const courseContent = getSectionPercentage(item, 'Course Content')
        const courseOutcome = getSectionPercentage(item, 'Course Outcome')
        const contentDelivery = getSectionPercentage(item, 'Content Delivery')
        const assessment = getSectionPercentage(item, 'Assessment')
        const overall = item.overallPercentage
        const metrics = [courseContent, courseOutcome, contentDelivery, assessment, overall]
        const hasAnyBelowThreshold = metrics.some((value) => isLowPercentage(value))
        const matchCourse = courseFilter === 'all' || subject === courseFilter
        const matchSection = sectionFilter === 'all' || sectionTail === sectionFilter
        const matchSearch = !normalizedSearch || facultyName.includes(normalizedSearch)
        const matchThreshold =
          thresholdFilter === 'all-data' ? true : hasAnyBelowThreshold
        return matchCourse && matchSection && matchSearch && matchThreshold
      })
      .sort((left, right) => {
        const leftCourse = normalizeSortValue(left.subjectHandled)
        const rightCourse = normalizeSortValue(right.subjectHandled)
        if (leftCourse !== rightCourse) {
          return leftCourse.localeCompare(rightCourse)
        }

        const leftSection = normalizeSortValue(getSectionTail(left.section))
        const rightSection = normalizeSortValue(getSectionTail(right.section))
        if (leftSection !== rightSection) {
          return leftSection.localeCompare(rightSection)
        }

        return normalizeSortValue(getReportFacultyName(left)).localeCompare(
          normalizeSortValue(getReportFacultyName(right))
        )
      })
  }, [courseFilter, getReportFacultyName, reports, searchQuery, sectionFilter, thresholdFilter])

  const totalPages = Math.max(1, Math.ceil(filteredSortedReports.length / rowsPerPage))

  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredSortedReports.slice(start, start + rowsPerPage)
  }, [currentPage, filteredSortedReports, rowsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [courseFilter, sectionFilter, thresholdFilter, rowsPerPage, searchQuery])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    if (courseFilter !== 'all' && !courseOptions.includes(courseFilter)) {
      setCourseFilter('all')
    }
  }, [courseFilter, courseOptions])

  useEffect(() => {
    if (sectionFilter !== 'all' && !sectionOptions.includes(sectionFilter)) {
      setSectionFilter('all')
    }
  }, [sectionFilter, sectionOptions])

  useEffect(() => {
    localStorage.setItem(ROWS_PER_PAGE_STORAGE_KEY, String(rowsPerPage))
  }, [rowsPerPage])

  useEffect(() => {
    localStorage.setItem(COURSE_FILTER_STORAGE_KEY, courseFilter)
  }, [courseFilter])

  useEffect(() => {
    localStorage.setItem(SECTION_FILTER_STORAGE_KEY, sectionFilter)
  }, [sectionFilter])

  const handleResetFilters = () => {
    setCourseFilter('all')
    setSectionFilter('all')
    setThresholdFilter('lt-threshold')
    setSearchQuery('')
    setRowsPerPage(10)
    setCurrentPage(1)
  }

  const confirmDeleteReport = async () => {
    if (!pendingDeleteReport) {
      return
    }

    setError('')
    setDeletingReportId(pendingDeleteReport.id)

    try {
      await deleteDoc(doc(db, 'reports', pendingDeleteReport.id))
      setReports((previous) => previous.filter((item) => item.id !== pendingDeleteReport.id))
      setPendingDeleteReport(null)
    } catch (err) {
      setError('Unable to delete this report. Please try again.')
    } finally {
      setDeletingReportId('')
    }
  }

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

      const hodAndFacultyCount = usersSnapshot.docs
        .map((docItem) => docItem.data())
        .filter((userItem) => userItem.role === 'faculty' || userItem.role === 'hod').length
      setTotalMembers(hodAndFacultyCount)

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
      <section className="panel admin-overview">
        <div className="admin-overview-header">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h1>View faculty uploads and manage reports.</h1>
            <p className="lead">This page displays aggregated faculty and report data only.</p>
            {error ? <p className="error">{error}</p> : null}
          </div>
          <div className="admin-actions-stack">
            <Link className="admin-link" to="/admin/role">
              Role Management
            </Link>
            <Link className="admin-link" to="/login">
              Faculty Dashboard
            </Link>
            <Auth user={user} mode="compact" displayNameOverride={currentUserProfile?.name} />
          </div>
        </div>

        <div className="admin-overview-body">
          <div className="admin-stats-grid">
            <div className="hero-card">
              <p className="stat-label">Total Count (Faculty + HOD)</p>
              <p className="stat-value">{totalMembers}</p>
            </div>
            <div className="hero-card">
              <p className="stat-label">Total Reports</p>
              <p className="stat-value accent">{reports.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-header">
          <h2>All Uploaded Reports</h2>
          <p className="table-note">All values are in %</p>
          <div className="table-filters">
            <label className="table-search">
              Search Faculty
              <input
                type="text"
                className="table-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by faculty name"
              />
            </label>
            <label>
              Course
              <select
                value={courseFilter}
                onChange={(event) => setCourseFilter(event.target.value)}
                className="table-filter-select"
              >
                <option value="all">All Courses</option>
                {courseOptions.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Section
              <select
                value={sectionFilter}
                onChange={(event) => setSectionFilter(event.target.value)}
                className="table-filter-select"
              >
                <option value="all">All Sections</option>
                {sectionOptions.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Threshold
              <select
                value={thresholdFilter}
                onChange={(event) => setThresholdFilter(event.target.value)}
                className="table-filter-select"
              >
                <option value="lt-threshold">&lt;{LOW_ALERT_THRESHOLD}</option>
                <option value="all-data">No Threshold</option>
              </select>
            </label>
            <button type="button" className="table-reset-btn" onClick={handleResetFilters}>
              Reset Filters
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-idx">S.No</th>
                <th className="col-faculty">Faculty</th>
                <th className="col-course">Course</th>
                <th className="col-section">Section</th>
                <th className="col-metric">Course Content</th>
                <th className="col-metric">Course Outcome</th>
                <th className="col-metric">Content Delivery</th>
                <th className="col-metric">Assessment</th>
                <th className="col-metric">Overall</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.length ? (
                paginatedReports.map((item, index) => {
                  const courseContent = getSectionPercentage(item, 'Course Content')
                  const courseOutcome = getSectionPercentage(item, 'Course Outcome')
                  const contentDelivery = getSectionPercentage(item, 'Content Delivery')
                  const assessment = getSectionPercentage(item, 'Assessment')
                  const overall = item.overallPercentage

                  return (
                  <tr key={item.id}>
                    <td className="col-idx">{(currentPage - 1) * rowsPerPage + index + 1}</td>
                    <td className="col-faculty">{getReportFacultyName(item)}</td>
                    <td className="col-course">{item.subjectHandled || 'N/A'}</td>
                    <td className="col-section">{getSectionTail(item.section)}</td>
                    <td className="col-metric">
                      <span className={`metric-badge ${isLowPercentage(courseContent) ? 'metric-badge-low' : ''}`}>
                        {formatNumber(courseContent)}%
                      </span>
                    </td>
                    <td className="col-metric">
                      <span className={`metric-badge ${isLowPercentage(courseOutcome) ? 'metric-badge-low' : ''}`}>
                        {formatNumber(courseOutcome)}%
                      </span>
                    </td>
                    <td className="col-metric">
                      <span className={`metric-badge ${isLowPercentage(contentDelivery) ? 'metric-badge-low' : ''}`}>
                        {formatNumber(contentDelivery)}%
                      </span>
                    </td>
                    <td className="col-metric">
                      <span className={`metric-badge ${isLowPercentage(assessment) ? 'metric-badge-low' : ''}`}>
                        {formatNumber(assessment)}%
                      </span>
                    </td>
                    <td className="col-metric">
                      <span className={`metric-badge ${isLowPercentage(overall) ? 'metric-badge-low' : ''}`}>
                        {formatNumber(overall)}%
                      </span>
                    </td>
                    <td className="col-action">
                      <button
                        type="button"
                        className="danger-btn icon-btn"
                        aria-label="Delete report"
                        title="Delete report"
                        onClick={() =>
                          setPendingDeleteReport({
                            id: item.id,
                            faculty: getReportFacultyName(item),
                            course: item.subjectHandled || 'N/A',
                          })
                        }
                        disabled={deletingReportId === item.id}
                      >
                        {deletingReportId === item.id ? '...' : <i className="bi bi-trash3-fill" aria-hidden="true" />}
                      </button>
                    </td>
                  </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={10} className="empty-cell">
                    No report data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <div className="rows-per-page">
            <label htmlFor="rowsPerPage">Rows per page</label>
            <select
              id="rowsPerPage"
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <p>
            Page {currentPage} of {totalPages}
          </p>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </section>

      {pendingDeleteReport ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-card">
            <h3 id="delete-modal-title">Delete report?</h3>
            <p>
              This report will be removed from admin dashboard, faculty dashboard, and Firestore.
            </p>
            <p>
              <strong>Faculty:</strong> {pendingDeleteReport.faculty}
            </p>
            <p>
              <strong>Course:</strong> {pendingDeleteReport.course}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setPendingDeleteReport(null)}
                disabled={deletingReportId === pendingDeleteReport.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={confirmDeleteReport}
                disabled={deletingReportId === pendingDeleteReport.id}
              >
                {deletingReportId === pendingDeleteReport.id ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AdminDashboard

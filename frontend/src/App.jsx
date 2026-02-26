import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { auth, db } from './firebase/config'
import { parseExcelFile } from './utils/excelParser'
import Auth from './components/Auth.jsx'
import './App.css'

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined) {
    return '--'
  }
  return Number(value).toFixed(digits)
}

const hashString = (input) => {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return `h${Math.abs(hash).toString(16)}`
}

const buildReportHash = (payload) => hashString(JSON.stringify(payload))

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [report, setReport] = useState([])
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [previousReports, setPreviousReports] = useState([])
  const [showPrevious, setShowPrevious] = useState(false)
  const [role, setRole] = useState('faculty')
  const [profileName, setProfileName] = useState('')
  const userName = profileName || user?.displayName || user?.email?.split('@')[0] || 'Faculty'

  const loadUserRole = useCallback(async (uid) => {
    try {
      const userRef = doc(db, 'users', uid)
      const snapshot = await getDoc(userRef)
      const userRole = snapshot.exists() ? snapshot.data().role : 'faculty'
      const userProfileName = snapshot.exists() ? snapshot.data().name : ''
      setRole(userRole || 'faculty')
      setProfileName(userProfileName || '')
    } catch (err) {
      setRole('faculty')
      setProfileName('')
    }
  }, [])

  const resolveReportDisplayName = useCallback(
    (reportItem) => {
      if (reportItem.userId === user?.uid) {
        return userName
      }
      return reportItem.uploaderName || reportItem.userName || 'N/A'
    },
    [user?.uid, userName]
  )

  const loadPreviousReports = useCallback(async (userId) => {
    try {
      const reportsRef = collection(db, 'reports')
      const q = query(reportsRef, where('userId', '==', userId))
      const snapshot = await getDocs(q)
      const reports = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      reports.sort(
        (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
      )
      setPreviousReports(reports)
    } catch (err) {
      console.error('Error loading previous reports:', err)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
      if (currentUser) {
        loadUserRole(currentUser.uid)
        loadPreviousReports(currentUser.uid)
      }
    })

    return () => unsubscribe()
  }, [loadUserRole, loadPreviousReports])

  const summary = useMemo(() => {
    if (!report.length) {
      return null
    }
    const overall = report.find((item) => item.label === 'Overall Percentage')
    return overall ? `${formatNumber(overall.percentage)}%` : null
  }, [report])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setError('')
    setInfo('')
    setLoading(true)
    setFileName(file.name)

    try {
      const data = await parseExcelFile(file)

      setMetadata(data.metadata)
      setHeaders(data.headers)
      setRows(data.rows)

      const sections = [...data.sections]
      if (data.overallPercentage !== null) {
        sections.push({
          label: 'Overall Percentage',
          score: null,
          percentage: data.overallPercentage,
        })
      }
      setReport(sections)

      const reportHash = buildReportHash({
        metadata: data.metadata,
        sections: data.sections,
        overallPercentage: data.overallPercentage,
        headers: data.headers,
        rows: data.rows,
        respondentCount: data.respondentCount,
        questionsCount: data.questionsCount,
      })

      // Save to Firestore
      if (user) {
        const saved = await saveToFirestore({
          fileName: file.name,
          reportHash,
          uploaderName: userName,
          subjectHandled: data.metadata?.course || '',
          section: data.metadata?.section || '',
          metadata: data.metadata,
          sections: data.sections,
          overallPercentage: data.overallPercentage,
          totalReportOutput: {
            overallPercentage: data.overallPercentage,
            sections: data.sections,
          },
          respondentCount: data.respondentCount,
          questionsCount: data.questionsCount,
        })
        if (saved) {
          setInfo('Report saved to database.')
        } else {
          setInfo('Same report data already exists for your account. Duplicate was not saved.')
        }
        // Reload previous reports
        await loadPreviousReports(user.uid)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process the file.')
      setMetadata(null)
      setReport([])
      setHeaders([])
      setRows([])
      setInfo('')
    } finally {
      setLoading(false)
    }
  }

  const saveToFirestore = async (reportData) => {
    try {
      const reportRef = doc(db, 'reports', `${user.uid}_${reportData.reportHash}`)
      const existing = await getDoc(reportRef)

      if (existing.exists()) {
        return false
      }

      await setDoc(reportRef, {
        ...reportData,
        userId: user.uid,
        userName,
        userEmail: user.email,
        createdAt: new Date().toISOString(),
      })
      return true
    } catch (err) {
      console.error('Error saving to Firestore:', err)
      if (err?.code === 'permission-denied') {
        throw new Error('Firestore permission denied. Confirm @tce.edu login and deploy latest firestore.rules.')
      }
      throw new Error('Failed to save report to database')
    }
  }

  const loadPreviousReport = (report) => {
    setFileName(report.fileName)
    setMetadata(report.metadata)
    const sections = [...report.sections]
    if (report.overallPercentage !== null) {
      sections.push({
        label: 'Overall Percentage',
        score: null,
        percentage: report.overallPercentage,
      })
    }
    setReport(sections)
    setHeaders([])
    setRows([])
    setShowPrevious(false)
    window.scrollTo(0, 0)
  }

  if (authLoading) {
    return (
      <div className="app loading-container">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Auth user={user} />
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Student Feedback Report</p>
          <h1>Upload feedback data to generate the report.</h1>
        </div>
        <div className="hero-actions">
          {role === 'hod' ? (
            <Link className="admin-link" to="/admin">
              Admin Console
            </Link>
          ) : null}
          <Auth user={user} mode="compact" displayNameOverride={userName} />
        </div>
      </header>

      <section className="panel">
        <div className="upload">
          <div>
            <h2>Upload feedback data</h2>
          </div>
          <label className="file-input">
            <input type="file" accept=".xlsx" onChange={handleFile} disabled={loading} />
            <span>{loading ? 'Processing...' : 'Choose Excel file'}</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          {info ? <p className="info">{info}</p> : null}
          {previousReports.length > 0 && (
            <button
              onClick={() => setShowPrevious(!showPrevious)}
              className="btn-previous"
            >
              {showPrevious ? 'Hide' : 'View'} Previous Reports ({previousReports.length})
            </button>
          )}
        </div>

        <div className="hero-card">
          <h2>Quick Stats</h2>
          <p className="stat-label">Faculty</p>
          <p className="stat-value">{userName}</p>
          <p className="stat-label">Current file</p>
          <p className="stat-value">{fileName || 'No file yet'}</p>
          <p className="stat-label">Overall percentage</p>
          <p className="stat-value accent">{summary || '--'}</p>
          <p className="hint">Supported: .xlsx only</p>
        </div>
      </section>

      {showPrevious && previousReports.length > 0 && (
        <section className="panel previous-reports">
          <h2>Previous Reports</h2>
          <div className="reports-grid">
            {previousReports.map((prevReport) => (
              <div key={prevReport.id} className="report-card">
                <h3>{prevReport.fileName}</h3>
                <div className="report-card-meta">
                  <span>{prevReport.subjectHandled || prevReport.metadata?.course || 'N/A'}</span>
                  <span>{prevReport.section || prevReport.metadata?.section || 'N/A'}</span>
                  <span>{resolveReportDisplayName(prevReport)}</span>
                </div>
                <div className="report-card-stats">
                  <span className="stat-accent">
                    {formatNumber(prevReport.overallPercentage)}%
                  </span>
                  <span className="stat-muted">
                    {new Date(prevReport.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => loadPreviousReport(prevReport)}
                  className="btn-load"
                >
                  Load Report
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel meta-panel">
        <div>
          <h2>Metadata</h2>
        </div>
        <div className="meta-grid">
          <div>
            <span className="meta-label">Institution</span>
            <span className="meta-value">{metadata?.institution || '--'}</span>
          </div>
          <div>
            <span className="meta-label">Report title</span>
            <span className="meta-value">{metadata?.reportTitle || '--'}</span>
          </div>
          <div>
            <span className="meta-label">Academic year</span>
            <span className="meta-value">{metadata?.academicYear || '--'}</span>
          </div>
          <div>
            <span className="meta-label">Department</span>
            <span className="meta-value">{metadata?.department || '--'}</span>
          </div>
          <div>
            <span className="meta-label">Course</span>
            <span className="meta-value">{metadata?.course || '--'}</span>
          </div>
          <div>
            <span className="meta-label">Semester</span>
            <span className="meta-value">{metadata?.semester || '--'}</span>
          </div>
          <div>
            <span className="meta-label">Section</span>
            <span className="meta-value">{metadata?.section || '--'}</span>
          </div>
          <div>
            <span className="meta-label">Generated on</span>
            <span className="meta-value">{metadata?.generatedOn || '--'}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="report">
          <h2>Report output</h2>
          <div className="report-table">
            <div className="report-row report-header">
              <span>Section</span>
              <span>Score</span>
              <span>Percentage</span>
            </div>
            {report.length ? (
              report.map((item) => (
                <div className="report-row" key={item.label}>
                  <span>{item.label}</span>
                  <span>{formatNumber(item.score)}</span>
                  <span>{formatNumber(item.percentage)}%</span>
                </div>
              ))
            ) : (
              <div className="report-empty">Upload a file to see the report.</div>
            )}
          </div>
        </div>
      </section>
      
      <section className="panel table-panel">
        <div className="table-header">
          <h2>Raw responses</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th key={`${header}-${index}`}>{header || `Col ${index + 1}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {headers.map((_, colIndex) => (
                      <td key={`cell-${rowIndex}-${colIndex}`}>
                        {row[colIndex] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length || 1} className="empty-cell">
                    Upload a file to load the responses.
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

export default App

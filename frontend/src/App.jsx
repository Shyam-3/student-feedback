import React, { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore'
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

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [report, setReport] = useState([])
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [previousReports, setPreviousReports] = useState([])
  const [showPrevious, setShowPrevious] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
      if (currentUser) {
        loadPreviousReports(currentUser.uid)
      }
    })

    return () => unsubscribe()
  }, [])

  const loadPreviousReports = async (userId) => {
    try {
      const reportsRef = collection(db, 'reports')
      const q = query(
        reportsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      const reports = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setPreviousReports(reports)
    } catch (err) {
      console.error('Error loading previous reports:', err)
    }
  }

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

      // Save to Firestore
      if (user) {
        await saveToFirestore({
          fileName: file.name,
          metadata: data.metadata,
          sections: data.sections,
          overallPercentage: data.overallPercentage,
          respondentCount: data.respondentCount,
          questionsCount: data.questionsCount,
        })
        // Reload previous reports
        await loadPreviousReports(user.uid)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process the file.')
      setMetadata(null)
      setReport([])
      setHeaders([])
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const saveToFirestore = async (reportData) => {
    try {
      await addDoc(collection(db, 'reports'), {
        ...reportData,
        userId: user.uid,
        userEmail: user.email,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Error saving to Firestore:', err)
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
        <Auth user={user} />
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
                  <span>{prevReport.metadata?.course || 'N/A'}</span>
                  <span>{prevReport.metadata?.semester || 'N/A'}</span>
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

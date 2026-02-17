import React, { useEffect, useMemo, useState } from 'react'
import { parseExcelFile } from './utils/excelParser'
import './App.css'

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined) {
    return '--'
  }
  return Number(value).toFixed(digits)
}

function App() {
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState(null)
  const [report, setReport] = useState([])
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

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

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Student Feedback Report</p>
          <h1>Upload feedback data to generate the report.</h1>
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

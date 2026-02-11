import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

const MAX_SCORE = 4
const SECTION_LABELS = {
  1: 'Course Content',
  2: 'Course Outcome',
  3: 'Content Delivery',
  4: 'Assessment',
}
const HEADER_REGEX = /^([1-4])\.(\d+)/
const HEADER_MIN_MATCHES = 5
const STOP_LABELS = new Set([
  'course content',
  'course outcome',
  'content delivery',
  'assessment',
  'overall percentage',
  'score',
  'percentage',
])
const META_LOCATIONS = {
  institution: 'A2',
  reportTitle: 'A3',
  descriptor: 'A4',
  generated: 'A5',
}

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const averageSection = (rows, indices) => {
  let sum = 0
  let count = 0
  rows.forEach((row) => {
    indices.forEach((index) => {
      const value = toNumber(row[index])
      if (value !== null) {
        sum += value
        count += 1
      }
    })
  })

  return count === 0 ? null : sum / count
}

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined) {
    return '--'
  }
  return Number(value).toFixed(digits)
}

const buildSectionConfig = (headers) => {
  const sections = new Map()
  headers.forEach((header, index) => {
    if (typeof header !== 'string') {
      return
    }
    const match = header.trim().match(HEADER_REGEX)
    if (!match) {
      return
    }
    const sectionKey = Number(match[1])
    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, [])
    }
    sections.get(sectionKey).push(index)
  })

  return Array.from(sections.entries())
    .sort(([a], [b]) => a - b)
    .map(([sectionKey, indices]) => ({
      label: SECTION_LABELS[sectionKey] || `Section ${sectionKey}`,
      indices,
    }))
}

const countHeaderMatches = (row) =>
  row.reduce((count, cell) => {
    if (typeof cell !== 'string') {
      return count
    }
    return HEADER_REGEX.test(cell.trim()) ? count + 1 : count
  }, 0)

const looksLikeHeaderRow = (row) => countHeaderMatches(row) >= HEADER_MIN_MATCHES

const isStopRow = (row) => {
  const firstCell = row[0]
  if (typeof firstCell !== 'string') {
    return false
  }
  const normalized = firstCell.trim().toLowerCase()
  return STOP_LABELS.has(normalized)
}

const normalizeRow = (row, length) => {
  if (row.length >= length) {
    return row
  }
  return [...row, ...Array.from({ length: length - row.length }, () => null)]
}

const readCell = (worksheet, address) => {
  const cell = worksheet[address]
  return cell ? cell.v : null
}

const parseMetadata = (worksheet) => {
  const institution = readCell(worksheet, META_LOCATIONS.institution) || ''
  const reportTitle = readCell(worksheet, META_LOCATIONS.reportTitle) || ''
  const descriptor = readCell(worksheet, META_LOCATIONS.descriptor) || ''
  const generated = readCell(worksheet, META_LOCATIONS.generated) || ''

  const parts = typeof descriptor === 'string'
    ? descriptor.split('|').map((part) => part.trim()).filter(Boolean)
    : []

  const academicYear = parts.length >= 5 ? parts.at(-5) : ''
  const department = parts.length >= 4 ? parts.at(-4) : ''
  const course = parts.length >= 3 ? parts.at(-3) : ''
  const semester = parts.length >= 2 ? parts.at(-2) : ''
  const section = parts.length >= 1 ? parts.at(-1) : ''

  const generatedOn =
    typeof generated === 'string' && generated.includes(':')
      ? generated.split(':').slice(1).join(':').trim()
      : ''

  return {
    institution,
    reportTitle,
    descriptor,
    academicYear,
    department,
    course,
    semester,
    section,
    generatedOn,
  }
}

function App() {
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [report, setReport] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [metadata, setMetadata] = useState(null)

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
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      if (!worksheet) {
        throw new Error('No worksheet found in the uploaded file.')
      }

      const sheetMeta = parseMetadata(worksheet)

      const matrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
      })

      if (!matrix.length) {
        throw new Error('No data found in the worksheet.')
      }

      const headerRowIndex = matrix.findIndex(looksLikeHeaderRow)

      if (headerRowIndex === -1) {
        throw new Error('Unable to locate the question headers in this worksheet.')
      }

      const headerRow = matrix[headerRowIndex]
      const rawRows = matrix.slice(headerRowIndex + 1)
      const sectionConfig = buildSectionConfig(headerRow)
      if (!sectionConfig.length) {
        throw new Error('No numbered question headers (1.1 to 4.x) were found.')
      }
      const questionIndices = sectionConfig.flatMap((section) => section.indices)
      const cleanedRows = []
      for (const row of rawRows) {
        if (isStopRow(row)) {
          break
        }
        if (questionIndices.some((index) => toNumber(row[index]) !== null)) {
          cleanedRows.push(row)
        }
      }
      const normalizedRows = cleanedRows.map((row) =>
        normalizeRow(row, headerRow.length)
      )

      const computedReport = sectionConfig.map((section) => {
        const average = averageSection(cleanedRows, section.indices)
        const percentage = average === null ? null : (average / MAX_SCORE) * 100
        return {
          label: section.label,
          score: average,
          percentage,
        }
      })

      const overallAverage = computedReport.every((item) => item.score !== null)
        ? computedReport.reduce((sum, item) => sum + item.score, 0) / computedReport.length
        : null

      const overallPercentage =
        overallAverage === null ? null : (overallAverage / MAX_SCORE) * 100

      computedReport.push({
        label: 'Overall Percentage',
        score: null,
        percentage: overallPercentage,
      })

      setHeaders(headerRow)
      setRows(normalizedRows)
      setReport(computedReport)
      setMetadata(sheetMeta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read the file.')
      setHeaders([])
      setRows([])
      setReport([])
      setMetadata(null)
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
            <input type="file" accept=".xlsx" onChange={handleFile} />
            <span>Choose Excel file</span>
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
            <span className="meta-value">
              {metadata?.institution || '--'}
            </span>
          </div>
          <div>
            <span className="meta-label">Report title</span>
            <span className="meta-value">
              {metadata?.reportTitle || '--'}
            </span>
          </div>
          <div>
            <span className="meta-label">Academic year</span>
            <span className="meta-value">
              {metadata?.academicYear || '--'}
            </span>
          </div>
          <div>
            <span className="meta-label">Department</span>
            <span className="meta-value">
              {metadata?.department || '--'}
            </span>
          </div>
          <div>
            <span className="meta-label">Course</span>
            <span className="meta-value">
              {metadata?.course || '--'}
            </span>
          </div>
          <div>
            <span className="meta-label">Semester</span>
            <span className="meta-value">
              {metadata?.semester || '--'}
            </span>
          </div>
          <div>
            <span className="meta-label">Section</span>
            <span className="meta-value">
              {metadata?.section || '--'}
            </span>
          </div>
          <div>
            <span className="meta-label">Generated on</span>
            <span className="meta-value">
              {metadata?.generatedOn || '--'}
            </span>
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

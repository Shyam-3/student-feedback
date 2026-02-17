import * as XLSX from 'xlsx'
import fs from 'fs'

const HEADER_REGEX = /^([1-4])\.(\d+)/
const HEADER_MIN_MATCHES = 5
const MAX_SCORE = 4
const SECTION_LABELS = {
  1: 'Course Content',
  2: 'Course Outcome',
  3: 'Content Delivery',
  4: 'Assessment',
}

const STOP_LABELS = new Set([
  'course content',
  'course outcome',
  'content delivery',
  'assessment',
  'overall percentage',
  'score',
  'percentage',
])

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
  const institution = readCell(worksheet, 'A2') || ''
  const reportTitle = readCell(worksheet, 'A3') || ''
  const descriptor = readCell(worksheet, 'A4') || ''
  const generated = readCell(worksheet, 'A5') || ''

  const parts =
    typeof descriptor === 'string'
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

export const parseExcelFile = (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet) {
      throw new Error('No worksheet found in the uploaded file.')
    }

    const metadata = parseMetadata(worksheet)

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

    const computedReport = sectionConfig.map((section) => {
      const average = averageSection(cleanedRows, section.indices)
      const percentage = average === null ? null : (average / MAX_SCORE) * 100
      return {
        label: section.label,
        score: average ? parseFloat(average.toFixed(2)) : null,
        percentage: percentage ? parseFloat(percentage.toFixed(2)) : null,
      }
    })

    const overallAverage =
      computedReport.every((item) => item.score !== null)
        ? computedReport.reduce((sum, item) => sum + item.score, 0) /
          computedReport.length
        : null

    const overallPercentage =
      overallAverage === null
        ? null
        : parseFloat(((overallAverage / MAX_SCORE) * 100).toFixed(2))

    return {
      metadata,
      sections: computedReport,
      overallPercentage,
      respondentCount: cleanedRows.length,
      questionsCount: questionIndices.length,
    }
  } catch (error) {
    throw new Error(`Excel parsing failed: ${error.message}`)
  }
}

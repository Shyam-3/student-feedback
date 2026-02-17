import Report from '../models/Report.js'
import { parseExcelFile } from '../utils/excelParser.js'
import fs from 'fs'

export const uploadAndProcessReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const filePath = req.file.path
    const fileName = req.file.originalname

    // Parse and process Excel file
    const reportData = parseExcelFile(filePath)

    // Save to MongoDB
    const report = new Report({
      metadata: reportData.metadata,
      sections: reportData.sections,
      overallPercentage: reportData.overallPercentage,
      fileName,
      fileUploadPath: filePath,
      respondentCount: reportData.respondentCount,
      questionsCount: reportData.questionsCount,
    })

    await report.save()

    // Return processed data to client
    res.json({
      success: true,
      reportId: report._id,
      metadata: report.metadata,
      sections: report.sections,
      overallPercentage: report.overallPercentage,
      respondentCount: report.respondentCount,
      questionsCount: report.questionsCount,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export const getReport = async (req, res) => {
  try {
    const { id } = req.params
    const report = await Report.findById(id)

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    res.json(report)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export const getAllReports = async (req, res) => {
  try {
    const reports = await Report.find().select('-fileUploadPath').sort({ createdAt: -1 })
    res.json(reports)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params
    const report = await Report.findByIdAndDelete(id)

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    // Delete uploaded file
    if (report.fileUploadPath && fs.existsSync(report.fileUploadPath)) {
      fs.unlinkSync(report.fileUploadPath)
    }

    res.json({ success: true, message: 'Report deleted' })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

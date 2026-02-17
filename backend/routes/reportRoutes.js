import express from 'express'
import upload from '../middleware/uploadMiddleware.js'
import {
  uploadAndProcessReport,
  getReport,
  getAllReports,
  deleteReport,
} from '../controllers/reportController.js'

const router = express.Router()

// Routes
router.post('/upload', upload.single('file'), uploadAndProcessReport)
router.get('/', getAllReports)
router.get('/:id', getReport)
router.delete('/:id', deleteReport)

export default router

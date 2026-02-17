import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema(
  {
    metadata: {
      institution: String,
      reportTitle: String,
      academicYear: String,
      department: String,
      course: String,
      semester: String,
      section: String,
      generatedOn: String,
    },
    sections: [
      {
        label: String,
        score: Number,
        percentage: Number,
      },
    ],
    overallPercentage: Number,
    fileName: String,
    fileUploadPath: String,
    respondentCount: Number,
    questionsCount: Number,
  },
  {
    timestamps: true,
  }
)

const Report = mongoose.model('Report', reportSchema)
export default Report

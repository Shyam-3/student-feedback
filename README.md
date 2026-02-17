# Student Feedback Report - MERN Stack

A full-stack application to upload and process student feedback Excel files, calculate section-wise scores, and generate detailed reports.

## Tech Stack

- **Frontend**: React 19 with Create React App
- **Backend**: Express.js with Node.js (ES modules)
- **Database**: MongoDB with Mongoose
- **File Processing**: XLSX library
- **DevOps**: concurrently, nodemon

## Features

- ✅ Upload Excel files with student feedback data
- ✅ Auto-detect question headers and metadata
- ✅ Calculate section-wise scores and percentages (4 sections: Course Content, Course Outcome, Content Delivery, Assessment)
- ✅ Display metadata, report output, and raw response data
- ✅ Support multiple Excel file formats with different layouts
- ✅ Strict validation: only processes numbered question headers (1.1 to 4.x format)
- ✅ Responsive UI with real-time processing

## Project Structure

```
feedback-report/
├── frontend/                 # React app (Create React App)
│   ├── public/
│   ├── src/
│   │   ├── App.jsx          # Main component
│   │   ├── App.css          # Styling
│   │   ├── index.js         # Entry point
│   │   ├── index.css        # Global styles
│   │   └── utils/
│   │       └── excelParser.js  # Excel processing logic
│   ├── package.json
│   └── .env
│
├── backend/                  # Express server
│   ├── server.js            # Main server
│   ├── controllers/
│   │   └── reportController.js
│   ├── models/
│   │   └── Report.js        # MongoDB schema
│   ├── routes/
│   │   └── reportRoutes.js
│   ├── middleware/
│   │   └── uploadMiddleware.js
│   ├── utils/
│   │   └── excelParser.js
│   ├── package.json
│   └── .env
│
├── package.json             # Root scripts
├── README.md
└── Camu Feedback/           # Sample data files
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Install root dependencies (concurrently only)
npm install

# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install
```

### 2. Configuration

**Frontend** (`frontend/.env`):
```
REACT_APP_API_URL=http://localhost:5000
```

**Backend** (`backend/.env`):
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/feedback-report
NODE_ENV=development
```

### 3. Start Application

**Option A: Frontend Only (Recommended for Testing)**
```bash
cd frontend && npm start
```
Frontend runs on `http://localhost:3000` with local file processing.

**Option B: Full Stack (with Backend & MongoDB)**
```bash
# From root directory
npm run dev
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

**Option C: Individual Servers**
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

## Excel File Format

The application expects Excel files with:

1. **Metadata rows** (rows 1-5):
   - A2: Institution name
   - A3: Report title
   - A4: Descriptor (pipe-delimited: academic year|department|course|semester|section)
   - A5: Generated date

2. **Question data**:
   - Headers with numbered format (1.1, 1.2, 2.1, 2.2, 3.1, etc.)
   - Numeric responses (1-4 scale)
   - Stops at summary rows

3. **Section mapping**:
   - `1.x` headers → Course Content
   - `2.x` headers → Course Outcome
   - `3.x` headers → Content Delivery
   - `4.x` headers → Assessment

## API Endpoints (Backend)

- `POST /api/reports/upload` - Upload and process Excel file
- `GET /api/reports` - Get all reports
- `GET /api/reports/:id` - Get specific report
- `DELETE /api/reports/:id` - Delete report

## Data Processing

The parser:
1. Scans for header row (minimum 5 numbered headers)
2. Extracts metadata from fixed cells
3. Processes only numeric data in question columns
4. Stops at summary row labels
5. Calculates section averages and percentages (max score: 4)
6. Returns metadata, sections, overall percentage, and raw data

## Build & Deploy

```bash
# Build frontend
npm run build

# Output: frontend/build/
```

## Notes

- Frontend can run standalone without backend (local processing)
- Backend requires MongoDB running locally or MongoDB Atlas configured
- All Excel processing happens in `frontend/src/utils/excelParser.js`
- Sample feedback files available in `Camu Feedback/` folder

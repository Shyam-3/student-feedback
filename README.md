# Student Feedback Report - Firebase + React

A full-stack application to upload and process student feedback Excel files, calculate section-wise scores, and generate detailed reports. Features Firebase Authentication with @tce.edu email restriction and Firestore database for storing results.

## Tech Stack

- **Frontend**: React 19 with Create React App
- **Authentication**: Firebase Authentication (Email/Password with domain restriction)
- **Database**: Firebase Firestore
- **File Processing**: XLSX library (client-side)
- **Hosting**: Firebase Hosting

## Features

- ✅ **Secure Authentication**: Faculty login restricted to @tce.edu email addresses
- ✅ Upload Excel files with student feedback data
- ✅ Auto-detect question headers and metadata
- ✅ Calculate section-wise scores and percentages (4 sections)
- ✅ Display metadata, report output, and raw response data
- ✅ **Save reports to Firestore** for each logged-in user
- ✅ **View previous uploads** and load historical reports
- ✅ Support multiple Excel file formats with different layouts
- ✅ Responsive UI with real-time processing

## Project Structure

```
feedback-report/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx              # Main component
│   │   ├── App.css              # Styling
│   │   ├── index.js             # Entry point
│   │   ├── index.css            # Global styles
│   │   ├── components/
│   │   │   ├── Auth.jsx         # Authentication component
│   │   │   └── Auth.css         # Auth styling
│   │   ├── firebase/
│   │   │   └── config.js        # Firebase configuration
│   │   └── utils/
│   │       └── excelParser.js   # Excel processing logic
│   ├── package.json
│   └── .env                     # Firebase credentials
│
├── package.json
└── README.md
```

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"**
3. Enter project name (e.g., `feedback-report`)
4. Disable Google Analytics (optional)
5. Click **"Create Project"**

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click **"Get Started"**
3. Enable **Email/Password** sign-in method
4. Save changes

### 3. Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **"Create Database"**
3. Select **"Start in test mode"** (for development)
4. Choose a location (closest to your users)
5. Click **"Enable"**

**Production Security Rules** (update after testing):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reports/{reportId} {
      allow read, write: if request.auth != null 
        && request.auth.token.email.matches('.*@tce.edu$')
        && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

### 4. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **"Your apps"**
3. Click **Web icon** (</>) to create a web app
4. Register app with nickname
5. Copy the `firebaseConfig` object

### 5. Configure Environment Variables

Create `frontend/.env`:
```env
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Firebase

Update `frontend/.env` with your Firebase credentials from step 5 above.

### 3. Start Development Server

```bash
npm start
```

App runs on `http://localhost:3000`

## Usage Flow

1. **Sign Up**: Create account with @tce.edu email
2. **Sign In**: Login with credentials
3. **Upload Excel**: Click "Choose Excel file" and select feedback data
4. **View Report**: See calculated scores and percentages
5. **Access History**: Click "View Previous Reports" to load past uploads
6. **Sign Out**: Click "Sign Out" in header

## Excel File Format

Expected Excel structure:

1. **Metadata** (rows 1-5):
   - A2: Institution name
   - A3: Report title
   - A4: Descriptor (academic year|department|course|semester|section)
   - A5: Generated date

2. **Questions**:
   - Headers: 1.1, 1.2, 2.1, 2.2, 3.1, etc.
   - Responses: Numeric (1-4 scale)

3. **Section Mapping**:
   - `1.x` → Course Content
   - `2.x` → Course Outcome
   - `3.x` → Content Delivery
   - `4.x` → Assessment

## Firestore Data Structure

**Collection**: `reports`

**Document Fields**:
```javascript
{
  userId: string,           // Firebase Auth UID
  userEmail: string,        // User's email (@tce.edu)
  fileName: string,         // Original file name
  metadata: {
    institution, reportTitle, academicYear,
    department, course, semester, section, generatedOn
  },
  sections: [
    { label: string, score: number, percentage: number }
  ],
  overallPercentage: number,
  respondentCount: number,
  questionsCount: number,
  createdAt: string         // ISO timestamp
}
```

## Deploy to Firebase Hosting

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase Project

```bash
cd frontend
firebase init
```

Select:
- **Hosting**: Configure files for Firebase Hosting
- Use existing project (select your project)
- Public directory: `build`
- Single-page app: `Yes`
- Automatic builds: `No`

### 4. Build Production

```bash
npm run build
```

### 5. Deploy

```bash
firebase deploy
```

Your app will be live at: `https://your-project-id.web.app`

## Environment Variables for Production

Create `frontend/.env.production`:
```env
REACT_APP_FIREBASE_API_KEY=your-production-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Security Considerations

1. **Email Domain Restriction**: Only @tce.edu emails can sign up (enforced in Auth.jsx)
2. **Firestore Rules**: Set production rules to restrict read/write to authenticated users
3. **Environment Variables**: Never commit `.env` files (already in `.gitignore`)
4. **Firebase API Key**: Safe to expose in frontend (restricted by domain in Firebase Console)

## Data Privacy

- Each user can only see their own uploaded reports
- Reports are stored with userId and userEmail for isolation
- Firestore security rules enforce user-specific access

## Troubleshooting

**Authentication Errors**:
- Verify email domain is exactly `tce.edu`
- Check Firebase Console → Authentication is enabled

**Firestore Permission Denied**:
- Update Firestore security rules (see Firebase Setup step 3)
- Ensure user is authenticated

**Import Errors**:
- Run `npm install` in frontend directory
- Check all Firebase packages are installed

## Notes

- Project is frontend-only (Firebase Auth + Firestore)
- All processing happens client-side (secure for user data)
- Firebase free tier: 1GB storage, 50K reads/day, 20K writes/day

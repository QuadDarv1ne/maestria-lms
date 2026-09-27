# Course Functionality Improvements

## Summary of Changes

This document summarizes the improvements made to the course functionality in the Maestria LMS.

---

## 1. Database Schema Enhancements (`prisma/schema.prisma`)

### New Course Fields
- **startDate** - Course start date (DateTime)
- **endDate** - Course end date (DateTime)
- **visibility** - Course visibility: public, private, unlisted (String)
- **maxStudents** - Maximum number of students allowed (Int)
- **prerequisites** - JSON array of prerequisite course IDs (String)
- **language** - Course language (default: "ru")

### New Assignment Types
Extended assignment type from `quiz, coding, text` to include:
- **matching** - Pair matching exercises
- **ordering** - Sequence ordering tasks
- **file_upload** - File submission assignments
- **essay** - Long-form written assignments
- **drag_drop** - Drag-and-drop interactive exercises

### New Model: AssignmentSubmission
Complete submission tracking system:
- **id** - Unique identifier
- **assignmentId** - Reference to assignment
- **userId** - Student who submitted
- **answer** - Student's answer (JSON or text)
- **score** - Assigned score
- **maxScore** - Maximum possible score (default: 100)
- **grade** - Grade letter or label
- **feedback** - Teacher feedback text
- **status** - draft, submitted, graded, failed
- **submittedAt** - Submission timestamp
- **gradedAt** - Grading timestamp
- **gradedBy** - Teacher who graded

---

## 2. API Endpoints

### Enhanced: `/api/admin/courses` (route.ts)

#### POST (Create) - Updated
Now accepts new fields:
- startDate, endDate, visibility, maxStudents, prerequisites, language

#### PUT (Update) - NEW
Update existing courses with full validation:
- Checks course ownership (teacher can only edit own courses)
- Validates slug uniqueness
- Supports updating modules and lessons
- URL: `/api/admin/courses?id=<courseId>`

#### DELETE - NEW
Delete courses with ownership validation:
- Teachers can only delete their own courses
- Admins can delete any course
- URL: `/api/admin/courses?id=<courseId>`

### NEW: `/api/courses/[id]/assignments/[assignmentId]`

#### POST - Submit Assignment
Students submit answers to assignments:
- Validates enrollment
- Auto-grades quiz assignments if correct answer is defined
- Supports multiple attempts (tracked by upsert)
- Body: `{ answer: string }`

#### GET - Get Submission Status
Retrieve current user's submission for an assignment:
- Returns submission with score, feedback, status
- Includes assignment metadata

### NEW: `/api/admin/courses/[id]/submissions`

#### GET - List Submissions
Teacher dashboard endpoint:
- Filter by status (draft, submitted, graded, failed)
- Filter by assignmentId
- Pagination support
- Includes student info, assignment details, grader info

### NEW: `/api/admin/courses/[id]/submissions/[submissionId]`

#### PUT - Grade Submission
Teacher grades student submissions:
- Validates course ownership
- Updates score, grade, feedback, status
- Creates notification for student
- Body: `{ score?, grade?, feedback?, status? }`

### NEW: `/api/admin/categories`

Full category CRUD:
- **GET** - List all categories with course counts
- **POST** - Create category (admin only)
- **PUT** - Update category (admin only)
- **DELETE** - Delete category (admin only, only if no courses)

---

## 3. TypeScript Types (`src/components/course-editor/types.ts`)

### New Type Definitions
```typescript
type LessonType = "video" | "text" | "coding" | "quiz" | "assignment" | "interactive"
type AssignmentType = "quiz" | "coding" | "text" | "matching" | "ordering" | "file_upload" | "essay" | "drag_drop"
type CourseVisibility = "public" | "private" | "unlisted"
type SubmissionStatus = "draft" | "submitted" | "graded" | "failed"
```

### New Interfaces
- **QuizOption** - Quiz answer options with correctness flag
- **MatchingPair** - Left/right pairs for matching exercises
- **OrderingItem** - Items with correct position for ordering exercises
- **AssignmentForm** - Complete assignment configuration
  - quizOptions, matchingPairs, orderingItems
  - maxAttempts, timeLimit
- **LessonForm** - Now includes assignments array
- **CourseFormData** - Now includes:
  - startDate, endDate, visibility, maxStudents, prerequisites, language

### Helper Functions
- `createEmptyQuizOption()`
- `createEmptyMatchingPair()`
- `createEmptyOrderingItem()`
- `createEmptyAssignment()`

---

## 4. UI Components

### NEW: `AssignmentEditor.tsx`
Full-featured assignment configuration component:
- **Type selector** - Choose from 7 assignment types
- **Quiz editor** - Add/remove options, mark correct answers
- **Matching editor** - Create left/right pairs
- **Ordering editor** - Define sequence with drag-drop ordering
- **Settings** - Points, max attempts, time limit
- **Correct answer field** - For auto-graded assignment types

### NEW: `SettingsTab.tsx`
Course settings configuration:
- **Date picker** - Start and end dates with duration calculation
- **Visibility selector** - Public/Private/Unlisted with descriptions
- **Student limit** - Maximum enrollment cap
- **Language selector** - RU/EN/ZH
- **Prerequisites manager** - Add/remove prerequisite courses with badges

### UPDATED: `CourseEditorPage.tsx`
- Added Settings tab between Basic and Curriculum
- Updated save handler to include new fields
- Improved navigation flow: Basic → Settings → Curriculum → Preview

### UPDATED: `constants.tsx`
- Added icons for all new assignment types:
  - matching (ArrowUpDown), ordering (Move)
  - file_upload (Upload), essay (Pencil)
  - drag_drop (AlignLeft), interactive (Blocks)

---

## 5. Migration

Created migration file: `prisma/migrations/002_add_course_settings_and_submissions/migration.sql`

Applies all schema changes:
- New Course columns
- AssignmentSubmission table with indexes and foreign keys

---

## 6. Features Summary

### Course Settings
✅ Start/end dates with duration tracking
✅ Visibility control (public/private/unlisted)
✅ Maximum student enrollment limit
✅ Multi-language support (RU/EN/ZH)
✅ Course prerequisites management

### Assignment Variations
✅ Quiz (multiple choice with correct answers)
✅ Text (open-ended response)
✅ Coding (code execution)
✅ Matching (pair connection)
✅ Ordering (sequence arrangement)
✅ Essay (long-form writing)
✅ File upload (document submission)

### Submission System
✅ Student answer submission
✅ Multiple attempt support
✅ Auto-grading for quizzes
✅ Manual grading by teachers
✅ Score and feedback tracking
✅ Submission status management
✅ Student notifications on grading

### Course Management
✅ Create courses with new settings
✅ Update existing courses (PUT endpoint)
✅ Delete courses with ownership validation
✅ Category CRUD operations
✅ Full Zod validation on all inputs
✅ Rate limiting on all endpoints

---

## 7. Next Steps (Not Implemented)

- [ ] Payment gateway integration (YooKassa, Tinkoff)
- [ ] Email notifications (Resend, SendGrid)
- [ ] Video transcoding and streaming
- [ ] Code execution engine for coding lessons
- [ ] Discussion/comments on lessons
- [ ] File attachments for lessons
- [ ] Course analytics dashboard
- [ ] Quiz question bank/reusability
- [ ] SCORM/xAPI compliance
- [ ] Accessibility features (WCAG)

---

## 8. Testing Checklist

Before deploying:
- [ ] Run `npx prisma generate` to update Prisma client
- [ ] Run `npx prisma db push` or apply migration
- [ ] Test course creation with all new fields
- [ ] Test course update via PUT endpoint
- [ ] Test assignment submission flow
- [ ] Test teacher grading interface
- [ ] Test category CRUD operations
- [ ] Verify rate limiting works
- [ ] Check Zod validation errors
- [ ] Test ownership checks (teacher vs admin)

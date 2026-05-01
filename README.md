# SQL Builder - ChatGPT-Supported Report Planning (MVP)

This repo is a starter skeleton that converts a report request received in natural language into a `REPORT Plan` JSON and transforms this plan into safe/deterministic SQL.

## Technology
- Frontend: Next.js + Material UI
- Backend: Node.js + Express
- Database: PostgreSQL

## Folder Structure
- `/frontend`: Login + report planning screen
- `/backend`: Auth, dictionary, report plan, SQL builder API
- `/db`: PostgreSQL schema and seed files

## Quick Start
1. Start PostgreSQL:
   - `docker compose up -d`
2. Backend environment file:
   - `cp backend/.env.example backend/.env`
3. Frontend environment file:
   - `cp frontend/.env.example frontend/.env.local`
4. Run backend:
   - `cd backend && npm install && npm run dev`
5. Run frontend:
   - `cd frontend && npm install && npm run dev`

## Demo Users
- `superadmin / admin123`
- `teacher_ayse / teacher123`

Note: Plain-text passwords are used in the seed for demo purposes. Use bcrypt hashes in production.

## API Summary
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dictionary`
- `POST /api/reports/plan`
- `POST /api/reports/execute`
- `GET /api/reports/history`
- `POST /api/speech/transcribe`
- `GET /api/admin/dictionary`
- `POST /api/admin/dictionary/entities`
- `POST /api/admin/dictionary/synonyms`
- `POST /api/admin/dictionary/metrics`
- `POST /api/admin/dictionary/fields`
- `POST /api/admin/dictionary/relationships`
- `GET /api/admin/analytics/summary`
- `GET /api/admin/query-logs`

## Security Principles
- The LLM only generates the plan; SQL generation is performed in the backend using whitelist metadata.
- All queries are parameterized (`$1, $2...`).
- User scope (`school_id`, `grade_level`, `course_id`, `teacher_id`) is applied as a mandatory filter.
- The LLM output is validated with Zod.


## Sample Queries

- `List schools`, `All campuses`

- `List students by grade, course session, and school` 

- `List of 9th grade students`
   |- **call for admin and teachers separetly. It should return different results**

- `For the fall semester, provide the attendance rate and the number of students by course for 9th grade.` (Clarification question for fall semester)
   |- **will ask for exact date range, won't accept informal description**

- `For the fall semester, provide the absenteeism rate and the number of students by course for 9th grade.` (Asks a clarification question)
   |- **Unsupported metric: absenteeism_rate**


## Sample Queries in Turkish
- `9. sınıf öğrenci listesi`

- `Sonbahar dönemi için 9. sınıf bazında derslere göre devamsızlık oranı ve öğrenci sayısını getir.` (Asks a clarification question)

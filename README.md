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
- `For the fall semester, provide the attendance rate and the number of students by course for 9th grade.` (Clarification question for fall semester)
- `For the fall semester, provide the absenteeism rate and the number of students by course for 9th grade.` (Asks a clarification question)
- `Show student count by school for the last 30 days.`
- `List all 9th grade students in School 1.`
- `Show attendance rate by course for Grade 9 between 2026-03-01 and 2026-03-31.`
- `Compare attendance rate by school for the Spring term.`
- `List classes with the lowest attendance rate this month.`
- `Show student count and attendance rate by teacher for School 2.`
- `List students with attendance rate below 85% in the last 60 days.`
- `Show daily attendance trend by grade level for the past 2 weeks.`
- `List courses with the highest student count by school.`
- `Show absenteeism days and total instructional days by class for Grade 10.`


## Sample Queries in Turkish
- `9. sınıf öğrenci listesi`
- `Sonbahar dönemi için 9. sınıf bazında derslere göre devamsızlık oranı ve öğrenci sayısını getir.` (Asks a clarification question)

## Out of domain questions

- `Show guardian contact rate by school for last month.`
- `List students by homeroom building floor and grade.`
- `Show attendance by bus route number.`
- `Compare parent engagement score by teacher.`
- `List courses with highest lunch participation rate.`
- `Show student count by district region and campus.`
- `Filter students where device_serial_number starts with ‘A1’.`
- `Show discipline_referral_rate by course for Grade 9.`

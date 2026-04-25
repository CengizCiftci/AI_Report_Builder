CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- AUTH / RBAC
-- =========================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_scopes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id INTEGER,
  grade_level INTEGER,
  course_id INTEGER,
  teacher_id INTEGER,
  CONSTRAINT uq_user_scopes UNIQUE (user_id, school_id, grade_level, course_id, teacher_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- DICTIONARY
-- =========================
CREATE TABLE IF NOT EXISTS entity_definitions (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS entity_synonyms (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER NOT NULL REFERENCES entity_definitions(id) ON DELETE CASCADE,
  synonym_text TEXT NOT NULL,
  UNIQUE (entity_id, synonym_text)
);

CREATE TABLE IF NOT EXISTS metric_definitions (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  formula_type TEXT NOT NULL,
  numerator_field TEXT,
  denominator_field TEXT,
  aggregation_default TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relationship_definitions (
  id SERIAL PRIMARY KEY,
  from_entity TEXT NOT NULL,
  to_entity TEXT NOT NULL,
  join_path TEXT NOT NULL,
  CONSTRAINT uq_relationship_definitions UNIQUE (from_entity, to_entity, join_path),
  cardinality TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_definitions (
  id SERIAL PRIMARY KEY,
  field_key TEXT NOT NULL UNIQUE,
  entity_key TEXT NOT NULL,
  data_type TEXT NOT NULL,
  is_groupable BOOLEAN NOT NULL DEFAULT TRUE,
  is_filterable BOOLEAN NOT NULL DEFAULT TRUE,
  is_aggregatable BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================
-- AUDIT
-- =========================
CREATE TABLE IF NOT EXISTS report_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  raw_plan JSONB NOT NULL,
  scoped_plan JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated',
  confidence NUMERIC(4,3),
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  planner_source TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS report_plans
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3);

ALTER TABLE IF EXISTS report_plans
  ADD COLUMN IF NOT EXISTS validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS report_plans
  ADD COLUMN IF NOT EXISTS audit_log JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS report_plans
  ADD COLUMN IF NOT EXISTS planner_source TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_report_plans_user_id ON report_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_report_plans_created_at ON report_plans(created_at DESC);

-- =========================
-- DOMAIN MODEL
-- =========================
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  campus_code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (school_id, course_code)
);

CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  grade_level INTEGER NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_level INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  student_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGSERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  UNIQUE (student_id, section_id, start_date)
);

CREATE TABLE IF NOT EXISTS attendance_daily (
  id BIGSERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  present_days SMALLINT NOT NULL DEFAULT 1,
  total_days SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (student_id, section_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_students_school_grade ON students(school_id, grade_level);
CREATE INDEX IF NOT EXISTS idx_sections_school_grade ON sections(school_id, grade_level);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_date ON attendance_daily(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_student ON attendance_daily(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_section ON attendance_daily(section_id);

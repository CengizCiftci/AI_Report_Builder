-- =========================
-- AUTH / RBAC seed
-- =========================
INSERT INTO roles (id, key, label) VALUES
  (1, 'SUPER_ADMIN', 'Super Admin'),
  (2, 'SCHOOL_ADMIN', 'School Admin'),
  (3, 'TEACHER', 'Teacher')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'superadmin', 'superadmin@example.com', 'admin123', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'teacher', 'teacher@example.com', 'teacher123', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 1),
  ('00000000-0000-0000-0000-000000000002', 3)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =========================
-- Domain seed
-- =========================
INSERT INTO schools (id, name, campus_code) VALUES
  (1, 'Bergen High School', 'ATHS'),
  (2, 'Hudson High School', 'CHS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO teachers (id, school_id, full_name) VALUES
  (1, 1, 'Ayse Yilmaz'),
  (2, 1, 'Mehmet Demir'),
  (3, 2, 'Elif Kaya')
ON CONFLICT (id) DO NOTHING;

INSERT INTO courses (id, school_id, course_code, name) VALUES
  (1, 1, 'MATH-9', 'Mathematics 9'),
  (2, 1, 'SCI-9', 'Science 9'),
  (3, 2, 'MATH-10', 'Mathematics 10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sections (id, school_id, course_id, teacher_id, grade_level, name) VALUES
  (1, 1, 1, 1, 9, '9A-Math'),
  (2, 1, 2, 2, 9, '9A-Science'),
  (3, 2, 3, 3, 10, '10B-Math')
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, school_id, grade_level, full_name, student_number, status) VALUES
  (1, 1, 9, 'Ali Can', 'S1001', 'active'),
  (2, 1, 9, 'Zeynep Ak', 'S1002', 'active'),
  (3, 1, 9, 'Deniz Nur', 'S1003', 'active'),
  (4, 2, 10, 'Mert Oz', 'S2001', 'active'),
  (5, 2, 10, 'Selin Ar', 'S2002', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO enrollments (student_id, section_id, start_date, end_date) VALUES
  (1, 1, '2025-09-01', NULL),
  (2, 1, '2025-09-01', NULL),
  (3, 2, '2025-09-01', NULL),
  (4, 3, '2025-09-01', NULL),
  (5, 3, '2025-09-01', NULL)
ON CONFLICT (student_id, section_id, start_date) DO NOTHING;

INSERT INTO attendance_daily (student_id, section_id, attendance_date, present_days, total_days) VALUES
  (1, 1, '2025-09-02', 1, 1),
  (2, 1, '2025-09-02', 1, 1),
  (3, 2, '2025-09-02', 0, 1),
  (4, 3, '2025-09-02', 1, 1),
  (5, 3, '2025-09-02', 1, 1),
  (1, 1, '2025-09-03', 1, 1),
  (2, 1, '2025-09-03', 0, 1),
  (3, 2, '2025-09-03', 1, 1),
  (4, 3, '2025-09-03', 1, 1),
  (5, 3, '2025-09-03', 0, 1)
ON CONFLICT (student_id, section_id, attendance_date) DO NOTHING;

-- teacher user only has access to school 1, grade 9, course 1, teacher 1 scope 
INSERT INTO user_scopes (user_id, school_id, grade_level, course_id, teacher_id) VALUES
  ('00000000-0000-0000-0000-000000000002', 1, 9, 1, 1)
ON CONFLICT (user_id, school_id, grade_level, course_id, teacher_id) DO NOTHING;

-- =========================
-- Dictionary seed
-- =========================
INSERT INTO entity_definitions (id, key, label, description) VALUES
  (1, 'school', 'School', 'Institution/campus level entity'),
  (2, 'grade', 'Grade', 'Grade level of students'),
  (3, 'course', 'Course', 'Course definition'),
  (4, 'section', 'Section', 'Class/section level offering'),
  (5, 'teacher', 'Teacher', 'Teacher entity'),
  (6, 'student', 'Student', 'Student entity'),
  (7, 'attendance', 'Attendance', 'Daily attendance facts')
ON CONFLICT (id) DO NOTHING;

INSERT INTO entity_synonyms (entity_id, synonym_text) VALUES
  (1, 'campus'),
  (1, 'school building'),
  (2, 'class level'),
  (2, 'grade band'),
  (3, 'subject'),
  (4, 'classroom section'),
  (4, 'class'),
  (7, 'devamsizlik'),
  (7, 'attendance')
ON CONFLICT (entity_id, synonym_text) DO NOTHING;

INSERT INTO metric_definitions (id, key, label, formula_type, numerator_field, denominator_field, aggregation_default) VALUES
  (1, 'student_count', 'Student Count', 'count_distinct', 'student_id', NULL, 'COUNT'),
  (2, 'attendance_rate', 'Attendance Rate', 'ratio', 'present_days', 'total_days', 'RATIO'),
  (3, 'attendance_days', 'Attendance Days', 'sum', 'present_days', NULL, 'SUM'),
  (4, 'total_days', 'Total Instruction Days', 'sum', 'total_days', NULL, 'SUM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO relationship_definitions (from_entity, to_entity, join_path, cardinality) VALUES
  ('course', 'section', 'courses.id = sections.course_id', '1:N'),
  ('section', 'teacher', 'sections.teacher_id = teachers.id', 'N:1'),
  ('section', 'student', 'sections.id = enrollments.section_id AND enrollments.student_id = students.id', 'N:M'),
  ('student', 'school', 'students.school_id = schools.id', 'N:1'),
  ('attendance', 'student', 'attendance_daily.student_id = students.id', 'N:1'),
  ('attendance', 'section', 'attendance_daily.section_id = sections.id', 'N:1')
ON CONFLICT (from_entity, to_entity, join_path) DO NOTHING;

INSERT INTO field_definitions (field_key, entity_key, data_type, is_groupable, is_filterable, is_aggregatable) VALUES
  ('school_id', 'school', 'integer', TRUE, TRUE, FALSE),
  ('school_name', 'school', 'text', TRUE, FALSE, FALSE),
  ('grade_level', 'grade', 'integer', TRUE, TRUE, FALSE),
  ('course_id', 'course', 'integer', TRUE, TRUE, FALSE),
  ('course_name', 'course', 'text', TRUE, TRUE, FALSE),
  ('class_id', 'section', 'integer', TRUE, TRUE, FALSE),
  ('class_name', 'section', 'text', TRUE, TRUE, FALSE),
  ('teacher_id', 'teacher', 'integer', TRUE, TRUE, FALSE),
  ('teacher_name', 'teacher', 'text', TRUE, FALSE, FALSE),
  ('student_id', 'student', 'integer', TRUE, TRUE, FALSE),
  ('student_name', 'student', 'text', TRUE, TRUE, FALSE),
  ('attendance_date', 'attendance', 'date', TRUE, TRUE, FALSE),
  ('attendance_rate', 'attendance', 'numeric', FALSE, FALSE, TRUE),
  ('attendance_days', 'attendance', 'integer', FALSE, FALSE, TRUE),
  ('total_days', 'attendance', 'integer', FALSE, FALSE, TRUE),
  ('student_count', 'student', 'integer', FALSE, FALSE, TRUE)
ON CONFLICT (field_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS report_query_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  is_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  row_count INTEGER,
  execution_ms INTEGER,
  error_message TEXT,
  sql_text TEXT,
  params_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success';

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS is_dry_run BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS row_count INTEGER;

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS execution_ms INTEGER;

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS sql_text TEXT;

ALTER TABLE IF EXISTS report_query_logs
  ADD COLUMN IF NOT EXISTS params_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_report_query_logs_user_id ON report_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_report_query_logs_status ON report_query_logs(status);
CREATE INDEX IF NOT EXISTS idx_report_query_logs_created_at ON report_query_logs(created_at DESC);

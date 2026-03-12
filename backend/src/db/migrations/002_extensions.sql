-- 002_extensions.sql

-- App settings (Setup-Wizard, global config)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Theme preference per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system'
  CHECK (theme IN ('light', 'dark', 'system'));

-- Dashboard layouts per user
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  layout     JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servers for multi-server support
CREATE TABLE IF NOT EXISTS servers (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  agent_token  TEXT NOT NULL UNIQUE,
  last_seen_at TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'online', 'offline')),
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Add server_id to metrics and alert_rules
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS server_id INT REFERENCES servers(id);
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS server_id INT REFERENCES servers(id);

-- Maintenance windows
CREATE TABLE IF NOT EXISTS maintenance_windows (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  server_id    INT REFERENCES servers(id),
  process_name TEXT,
  recurring    TEXT,    -- cron expression for recurring windows (NULL = one-time)
  created_by   INT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Report schedules
CREATE TABLE IF NOT EXISTS report_schedules (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('weekly', 'metrics', 'alert_history', 'capacity')),
  config        JSONB NOT NULL,
  cron_expr     TEXT NOT NULL,
  recipients    TEXT[] NOT NULL,
  enabled       BOOLEAN DEFAULT TRUE,
  last_sent_at  TIMESTAMPTZ,
  created_by    INT REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Alert comments
CREATE TABLE IF NOT EXISTS alert_comments (
  id             SERIAL PRIMARY KEY,
  alert_event_id BIGINT NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
  user_id        INT NOT NULL REFERENCES users(id),
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Inbound webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  secret     TEXT NOT NULL,
  enabled    BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id         BIGSERIAL PRIMARY KEY,
  webhook_id INT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title      TEXT NOT NULL,
  description TEXT,
  severity   TEXT DEFAULT 'info',
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove the seed admin — Setup Wizard will create the first admin
-- (existing deployments keep their admin via ON CONFLICT DO NOTHING in 001)

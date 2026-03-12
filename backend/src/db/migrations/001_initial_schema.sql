-- 001_initial_schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  totp_secret   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitors (
  id               SERIAL PRIMARY KEY,
  user_id          INT REFERENCES users(id),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('http', 'process', 'shell')),
  config           JSONB NOT NULL,
  interval_seconds INT NOT NULL DEFAULT 60,
  retention_days   INT NOT NULL DEFAULT 90,
  enabled          BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics (
  id           BIGSERIAL PRIMARY KEY,
  monitor_id   INT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value        DOUBLE PRECISION NOT NULL,
  labels       JSONB
);

CREATE INDEX IF NOT EXISTS idx_metrics_monitor_time ON metrics (monitor_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS alert_rules (
  id               SERIAL PRIMARY KEY,
  user_id          INT REFERENCES users(id),
  name             TEXT NOT NULL,
  process_name     TEXT NOT NULL,
  metric           TEXT NOT NULL,
  operator         TEXT NOT NULL CHECK (operator IN ('>', '<', '=')),
  threshold        DOUBLE PRECISION NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  cooldown_seconds INT NOT NULL DEFAULT 300,
  severity         TEXT NOT NULL DEFAULT 'warning',
  channels         JSONB NOT NULL DEFAULT '[]',
  enabled          BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id             BIGSERIAL PRIMARY KEY,
  rule_id        INT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  fired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ,
  metric_value   DOUBLE PRECISION,
  acknowledged   BOOLEAN DEFAULT FALSE,
  ack_user_id    INT REFERENCES users(id),
  channels_sent  JSONB
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  action     TEXT NOT NULL,
  target     TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default admin (password: changeme)
-- bcrypt hash for 'changeme' with cost 12
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@localhost', '$2a$12$LJ3m4ys3Lk0TSwMCkGKJi.IT5a6GzW3DH8BpCODjfXGMVzr.vCPaG', 'admin')
ON CONFLICT (username) DO NOTHING;

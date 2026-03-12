-- 003_agent_security.sql

-- Replace bcrypt token with AES-encrypted token + security fields
ALTER TABLE servers ADD COLUMN IF NOT EXISTS agent_token_enc BYTEA;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS token_iv BYTEA;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS token_auth_tag BYTEA;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS allowed_ip INET;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS token_rotated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop old unique constraint on agent_token (if exists) and make it nullable
-- The encrypted columns replace it
ALTER TABLE servers ALTER COLUMN agent_token DROP NOT NULL;

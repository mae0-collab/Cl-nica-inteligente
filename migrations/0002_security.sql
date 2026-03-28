-- ============================================================
-- MIGRATION 0002: Segurança e Integridade
-- Clínica Inteligente
-- ============================================================

-- Adicionar suporte a refresh tokens (opcional, para sessões longas)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_professional ON refresh_tokens(professional_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Auditoria de acessos (segurança)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_professional ON audit_logs(professional_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Adicionar colunas de segurança à tabela de profissionais (se não existirem)
-- D1/SQLite não suporta ALTER TABLE ADD COLUMN IF NOT EXISTS nativamente
-- mas suporta o padrão, então criamos um bloco seguro:

-- Tentativa de adicionar login_attempts (controle de brute force)
-- Nota: Em D1, se a coluna já existir, isso pode falhar silenciosamente
-- Por isso usamos uma tabela separada

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip_address TEXT,
  success INTEGER DEFAULT 0,
  attempted_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);

-- Garantir integridade: pacientes SÓ pertencem a profissionais ativos
-- D1 tem suporte parcial a FOREIGN KEY - habilitar via PRAGMA
-- Nota: este PRAGMA precisa ser executado em cada conexão no Cloudflare D1
PRAGMA foreign_keys = ON;

-- View útil: pacientes com nome do profissional (para admin)
-- Comentado por padrão - habilitar se necessário
-- CREATE VIEW IF NOT EXISTS v_patients_with_professional AS
-- SELECT p.*, pr.name as professional_name, pr.email as professional_email
-- FROM patients p
-- JOIN professionals pr ON pr.id = p.professional_id;

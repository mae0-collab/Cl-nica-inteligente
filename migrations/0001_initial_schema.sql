-- Clínica Inteligente - Schema Principal
-- Cloudflare D1 Database

-- Profissionais de Saúde
CREATE TABLE professionals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  registration_number TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  xp_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  plan_type TEXT DEFAULT 'free',
  plan_expires_at TEXT,
  marketplace_active INTEGER DEFAULT 0,
  marketplace_featured INTEGER DEFAULT 0,
  consultation_price REAL,
  rating_average REAL DEFAULT 0,
  total_consultations INTEGER DEFAULT 0,
  email_verified INTEGER DEFAULT 0,
  profile_completed INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_professionals_email ON professionals(email);
CREATE INDEX idx_professionals_specialty ON professionals(specialty);

-- Pacientes
CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date TEXT,
  gender TEXT,
  weight REAL,
  height REAL,
  blood_type TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_patients_professional ON patients(professional_id);

-- Consultas
CREATE TABLE consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  consultation_date TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  chief_complaint TEXT,
  anamnesis TEXT,
  physical_exam TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  prescription TEXT,
  follow_up_date TEXT,
  follow_up_notes TEXT,
  status TEXT DEFAULT 'agendada',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_consultations_professional ON consultations(professional_id);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);

-- Exames Laboratoriais
CREATE TABLE lab_exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  consultation_id INTEGER,
  exam_date TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  lab_name TEXT,
  results TEXT NOT NULL,
  interpretation TEXT,
  ai_analysis TEXT,
  attached_file_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_lab_exams_patient ON lab_exams(patient_id);

-- Cursos
CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT NOT NULL,
  difficulty TEXT DEFAULT 'intermediario',
  xp_reward INTEGER DEFAULT 100,
  duration_hours INTEGER,
  total_lessons INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_courses_category ON courses(category);

-- Aulas
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL,
  content_url TEXT,
  content_text TEXT,
  order_index INTEGER NOT NULL,
  duration_minutes INTEGER,
  xp_reward INTEGER DEFAULT 50,
  is_published INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(course_id, order_index)
);

CREATE INDEX idx_lessons_course ON lessons(course_id);

-- Progresso em Cursos
CREATE TABLE course_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  lessons_completed INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  status TEXT DEFAULT 'iniciado',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  last_accessed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(professional_id, course_id)
);

CREATE INDEX idx_course_progress_professional ON course_progress(professional_id);

-- Progresso em Aulas
CREATE TABLE lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  is_completed INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  completed_at TEXT,
  UNIQUE(professional_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_professional ON lesson_progress(professional_id);

-- Casos Clínicos
CREATE TABLE clinical_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  patient_profile TEXT NOT NULL,
  chief_complaint TEXT NOT NULL,
  patient_history TEXT,
  lab_results TEXT,
  expected_diagnosis TEXT,
  expected_treatment TEXT,
  learning_points TEXT,
  difficulty TEXT DEFAULT 'intermediario',
  specialty TEXT NOT NULL,
  tags TEXT,
  xp_reward INTEGER DEFAULT 500,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_clinical_cases_difficulty ON clinical_cases(difficulty);

-- Tentativas de Resolução de Casos
CREATE TABLE case_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  clinical_case_id INTEGER NOT NULL,
  submitted_diagnosis TEXT,
  submitted_treatment TEXT,
  score INTEGER,
  ai_feedback TEXT,
  is_correct INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_case_attempts_professional ON case_attempts(professional_id);

-- Protocolos Clínicos
CREATE TABLE protocols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  condition TEXT NOT NULL,
  protocol_steps TEXT NOT NULL,
  supplements TEXT,
  lifestyle_recommendations TEXT,
  lab_monitoring TEXT,
  specialty TEXT NOT NULL,
  evidence_level TEXT,
  scientific_references TEXT,
  is_premium INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_protocols_condition ON protocols(condition);

-- Aplicação de Protocolos
CREATE TABLE protocol_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  protocol_id INTEGER NOT NULL,
  consultation_id INTEGER,
  customizations TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  outcome_notes TEXT,
  effectiveness_rating INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_protocol_applications_professional ON protocol_applications(professional_id);

-- Badges/Conquistas
CREATE TABLE badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT,
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER,
  rarity TEXT DEFAULT 'comum',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE professional_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  badge_id INTEGER NOT NULL,
  earned_at TEXT DEFAULT (datetime('now')),
  UNIQUE(professional_id, badge_id)
);

CREATE INDEX idx_professional_badges_professional ON professional_badges(professional_id);

-- Transações de XP
CREATE TABLE xp_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_xp_transactions_professional ON xp_transactions(professional_id);

-- Solicitações de Consulta (Marketplace)
CREATE TABLE consultation_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name TEXT NOT NULL,
  patient_email TEXT NOT NULL,
  patient_phone TEXT,
  professional_id INTEGER NOT NULL,
  preferred_date TEXT,
  message TEXT,
  status TEXT DEFAULT 'pendente',
  consultation_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  responded_at TEXT
);

CREATE INDEX idx_consultation_requests_professional ON consultation_requests(professional_id);

-- Avaliações de Profissionais
CREATE TABLE professional_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  consultation_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  review_text TEXT,
  communication_rating INTEGER,
  expertise_rating INTEGER,
  reviewer_name TEXT,
  is_visible INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(consultation_id)
);

CREATE INDEX idx_professional_reviews_professional ON professional_reviews(professional_id);

-- Interações com IA
CREATE TABLE ai_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  context_type TEXT NOT NULL,
  patient_id INTEGER,
  user_prompt TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  was_helpful INTEGER,
  feedback_text TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_interactions_professional ON ai_interactions(professional_id);

-- Notificações
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  action_url TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  read_at TEXT
);

CREATE INDEX idx_notifications_professional ON notifications(professional_id);

-- Métricas de Profissionais
CREATE TABLE professional_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER NOT NULL,
  metric_date TEXT NOT NULL,
  consultations_count INTEGER DEFAULT 0,
  new_patients_count INTEGER DEFAULT 0,
  courses_started INTEGER DEFAULT 0,
  courses_completed INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  cases_solved INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  badges_earned INTEGER DEFAULT 0,
  consultation_requests INTEGER DEFAULT 0,
  reviews_received INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(professional_id, metric_date)
);

CREATE INDEX idx_professional_metrics_professional ON professional_metrics(professional_id);

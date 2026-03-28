// ============================================================
// CLÍNICA INTELIGENTE - TIPOS CENTRAIS
// ============================================================

// Bindings do Cloudflare Workers
export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  OPENAI_API_KEY?: string;
  ENVIRONMENT?: string;
};

export type Env = {
  Bindings: Bindings;
};

// Variáveis de contexto injetadas pelo middleware de auth
export type Variables = {
  professionalId: number;
  professionalEmail: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

// -------------------------------------------------------
// MODELOS DE DADOS
// -------------------------------------------------------

export interface Professional {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  specialty: 'medico' | 'nutricionista' | 'farmaceutico' | 'serumanologista' | 'saude_integrativa';
  registration_number?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  xp_points: number;
  level: number;
  plan_type: 'free' | 'pro' | 'enterprise';
  plan_expires_at?: string;
  marketplace_active: number;
  marketplace_featured: number;
  consultation_price?: number;
  rating_average: number;
  total_consultations: number;
  email_verified: number;
  profile_completed: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: number;
  professional_id: number;
  name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  weight?: number;
  height?: number;
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  notes?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: number;
  professional_id: number;
  patient_id: number;
  consultation_date: string;
  duration_minutes: number;
  chief_complaint?: string;
  anamnesis?: string;
  physical_exam?: string;
  diagnosis?: string;
  treatment_plan?: string;
  prescription?: string;
  follow_up_date?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: number;
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  category: string;
  difficulty: string;
  xp_reward: number;
  duration_hours?: number;
  total_lessons: number;
  is_published: number;
  is_premium: number;
  created_at: string;
  updated_at: string;
}

export interface ClinicalCase {
  id: number;
  title: string;
  patient_profile: string;
  chief_complaint: string;
  patient_history?: string;
  lab_results?: string;
  expected_diagnosis?: string;
  expected_treatment?: string;
  learning_points?: string;
  difficulty: string;
  specialty: string;
  tags?: string;
  xp_reward: number;
  created_at: string;
}

export interface Protocol {
  id: number;
  title: string;
  slug: string;
  description?: string;
  condition: string;
  protocol_steps: string;
  supplements?: string;
  lifestyle_recommendations?: string;
  lab_monitoring?: string;
  specialty: string;
  evidence_level?: string;
  scientific_references?: string;
  is_premium: number;
  created_at: string;
  updated_at: string;
}

// JWT Payload
export interface JWTPayload {
  sub: number;       // professional ID
  email: string;
  iat: number;
  exp: number;
}

// Resposta padronizada de erro
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

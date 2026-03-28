// ============================================================
// VALIDATORS - Zod Schemas para validação de entrada
// ============================================================

import { z } from 'zod';

// -------------------------------------------------------
// AUTH
// -------------------------------------------------------

export const RegisterSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter ao menos um número'),
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  specialty: z.enum([
    'medico',
    'nutricionista',
    'farmaceutico',
    'serumanologista',
    'saude_integrativa',
  ]),
  registration_number: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// -------------------------------------------------------
// PROFESSIONALS
// -------------------------------------------------------

export const UpdateProfessionalSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  registration_number: z.string().max(50).optional().nullable(),
  consultation_price: z.number().positive().optional().nullable(),
  marketplace_active: z.boolean().optional(),
});

// -------------------------------------------------------
// PATIENTS
// -------------------------------------------------------

export const CreatePatientSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório').max(200),
  email: z.string().email('Email inválido').optional().or(z.literal('')).nullable(),
  phone: z.string().max(20).optional().nullable(),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional()
    .nullable(),
  gender: z.enum(['masculino', 'feminino', 'outro']).optional().nullable(),
  weight: z.number().positive().max(500).optional().nullable(),
  height: z.number().positive().max(300).optional().nullable(),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional().nullable(),
  allergies: z.array(z.string()).optional().default([]),
  chronic_conditions: z.array(z.string()).optional().default([]),
  notes: z.string().max(5000).optional().nullable(),
});

export const UpdatePatientSchema = CreatePatientSchema.partial();

// -------------------------------------------------------
// CONSULTATIONS
// -------------------------------------------------------

export const CreateConsultationSchema = z.object({
  patient_id: z.number().int().positive('ID do paciente inválido'),
  consultation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Data inválida'),
  duration_minutes: z.number().int().min(15).max(480).default(60),
  chief_complaint: z.string().max(1000).optional().nullable(),
  anamnesis: z.string().max(10000).optional().nullable(),
  physical_exam: z.string().max(5000).optional().nullable(),
  diagnosis: z.string().max(2000).optional().nullable(),
  treatment_plan: z.string().max(10000).optional().nullable(),
  prescription: z.array(z.record(z.unknown())).optional().default([]),
  follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  status: z
    .enum(['agendada', 'realizada', 'cancelada', 'no_show'])
    .default('realizada'),
});

// -------------------------------------------------------
// COURSES
// -------------------------------------------------------

export const CourseProgressSchema = z.object({
  lessons_completed: z.number().int().min(0).default(0),
  progress_percentage: z.number().int().min(0).max(100).default(0),
  status: z
    .enum(['nao_iniciado', 'iniciado', 'concluido'])
    .default('iniciado'),
});

// -------------------------------------------------------
// CLINICAL CASES
// -------------------------------------------------------

export const CaseAttemptSchema = z.object({
  submitted_diagnosis: z.string().min(5, 'Diagnóstico muito curto').max(2000),
  submitted_treatment: z.array(z.record(z.unknown())).optional().default([]),
});

// -------------------------------------------------------
// PROTOCOLS
// -------------------------------------------------------

export const ApplyProtocolSchema = z.object({
  patient_id: z.number().int().positive('ID do paciente inválido'),
  consultation_id: z.number().int().positive().optional().nullable(),
  customizations: z.record(z.unknown()).optional().default({}),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .default(new Date().toISOString().split('T')[0]),
});

// -------------------------------------------------------
// MARKETPLACE
// -------------------------------------------------------

export const ConsultationRequestSchema = z.object({
  patient_name: z.string().min(2).max(200),
  patient_email: z.string().email('Email inválido'),
  patient_phone: z.string().max(20).optional().nullable(),
  professional_id: z.number().int().positive(),
  preferred_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  message: z.string().max(2000).optional().nullable(),
});

// -------------------------------------------------------
// LAB ANALYSIS
// -------------------------------------------------------

// Base object (extends-friendly — sem .refine())
export const labAnalysisBaseSchema = z.object({
  labs: z.object({
    ferritin:  z.number().optional(),
    b12:       z.number().optional(),
    tsh:       z.number().optional(),
    vitaminD:  z.number().optional(),
    insulin:   z.number().optional(),
    glucose:   z.number().optional(),
  }),
})

// Schema completo com validação de "pelo menos um marcador"
export const labAnalysisSchema = labAnalysisBaseSchema.refine(
  (data) => Object.values(data.labs).some((v) => v !== undefined),
  {
    message: 'Forneça pelo menos um marcador laboratorial em "labs"',
    path: ['labs'],
  }
)

// -------------------------------------------------------
// AI
// -------------------------------------------------------

export const AIChatSchema = z.object({
  prompt: z.string().min(3, 'Pergunta muito curta').max(2000),
  context_type: z
    .enum([
      'general_question',
      'case_analysis',
      'protocol_suggestion',
      'lab_interpretation',
      'supplement_recommendation',
    ])
    .default('general_question'),
  patient_id: z.number().int().positive().optional().nullable(),
});

// -------------------------------------------------------
// HELPER: Validar com Zod e retornar erro formatado
// -------------------------------------------------------

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) errors[path] = [];
    errors[path].push(issue.message);
  }

  return { success: false, errors };
}

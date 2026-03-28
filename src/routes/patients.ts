// ============================================================
// ROUTES - PATIENTS (CRM) - com ownership obrigatório
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { CreatePatientSchema, UpdatePatientSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const patientRoutes = new Hono<AppEnv>();

// Todas as rotas exigem autenticação
patientRoutes.use('*', authMiddleware);

// -------------------------------------------------------
// GET /api/patients  - Listar pacientes DO profissional autenticado
// -------------------------------------------------------
patientRoutes.get('/', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const search = c.req.query('search');

  let query = `
    SELECT id, name, email, phone, birth_date, gender, weight, height,
           blood_type, is_active, created_at
    FROM patients
    WHERE professional_id = ? AND is_active = 1
  `;
  const params: unknown[] = [professionalId];

  if (search) {
    query += ' AND (name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';

  const patients = await DB.prepare(query).bind(...params).all();
  return c.json(patients.results);
});

// -------------------------------------------------------
// GET /api/patients/:id - Verificar ownership
// -------------------------------------------------------
patientRoutes.get('/:id', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const patientId = c.req.param('id');
  const { DB } = c.env;

  const patient = await DB.prepare(
    'SELECT * FROM patients WHERE id = ? AND professional_id = ? AND is_active = 1'
  ).bind(patientId, professionalId).first();

  if (!patient) {
    return c.json({ error: 'Paciente não encontrado' }, 404);
  }

  // Parse JSON fields
  const parsed = {
    ...patient,
    allergies: safeJsonParse(patient.allergies as string, []),
    chronic_conditions: safeJsonParse(patient.chronic_conditions as string, []),
  };

  return c.json(parsed);
});

// -------------------------------------------------------
// POST /api/patients - Criar paciente (professional_id = autenticado)
// -------------------------------------------------------
patientRoutes.post('/', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(CreatePatientSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  const result = await DB.prepare(`
    INSERT INTO patients (
      professional_id, name, email, phone, birth_date, gender,
      weight, height, blood_type, allergies, chronic_conditions, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    professionalId,
    d.name,
    d.email ?? null,
    d.phone ?? null,
    d.birth_date ?? null,
    d.gender ?? null,
    d.weight ?? null,
    d.height ?? null,
    d.blood_type ?? null,
    JSON.stringify(d.allergies ?? []),
    JSON.stringify(d.chronic_conditions ?? []),
    d.notes ?? null,
  ).run();

  return c.json({ id: result.meta.last_row_id, success: true }, 201);
});

// -------------------------------------------------------
// PUT /api/patients/:id - Atualizar (ownership verificado)
// -------------------------------------------------------
patientRoutes.put('/:id', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const patientId = c.req.param('id');
  const { DB } = c.env;

  // Verificar ownership
  const existing = await DB.prepare(
    'SELECT id FROM patients WHERE id = ? AND professional_id = ? AND is_active = 1'
  ).bind(patientId, professionalId).first();

  if (!existing) {
    return c.json({ error: 'Paciente não encontrado' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(UpdatePatientSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  await DB.prepare(`
    UPDATE patients SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      birth_date = COALESCE(?, birth_date),
      gender = COALESCE(?, gender),
      weight = COALESCE(?, weight),
      height = COALESCE(?, height),
      blood_type = COALESCE(?, blood_type),
      allergies = COALESCE(?, allergies),
      chronic_conditions = COALESCE(?, chronic_conditions),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ? AND professional_id = ?
  `).bind(
    d.name ?? null,
    d.email ?? null,
    d.phone ?? null,
    d.birth_date ?? null,
    d.gender ?? null,
    d.weight ?? null,
    d.height ?? null,
    d.blood_type ?? null,
    d.allergies ? JSON.stringify(d.allergies) : null,
    d.chronic_conditions ? JSON.stringify(d.chronic_conditions) : null,
    d.notes ?? null,
    patientId,
    professionalId,
  ).run();

  return c.json({ success: true });
});

// -------------------------------------------------------
// DELETE /api/patients/:id - Soft delete (ownership verificado)
// -------------------------------------------------------
patientRoutes.delete('/:id', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const patientId = c.req.param('id');
  const { DB } = c.env;

  const existing = await DB.prepare(
    'SELECT id FROM patients WHERE id = ? AND professional_id = ?'
  ).bind(patientId, professionalId).first();

  if (!existing) {
    return c.json({ error: 'Paciente não encontrado' }, 404);
  }

  // Soft delete
  await DB.prepare(
    'UPDATE patients SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ? AND professional_id = ?'
  ).bind(patientId, professionalId).run();

  return c.json({ success: true });
});

// -------------------------------------------------------
// GET /api/patients/:id/consultations
// -------------------------------------------------------
patientRoutes.get('/:id/consultations', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const patientId = c.req.param('id');
  const { DB } = c.env;

  // Verificar ownership do paciente
  const patient = await DB.prepare(
    'SELECT id FROM patients WHERE id = ? AND professional_id = ?'
  ).bind(patientId, professionalId).first();

  if (!patient) {
    return c.json({ error: 'Paciente não encontrado' }, 404);
  }

  const consultations = await DB.prepare(`
    SELECT id, consultation_date, duration_minutes, chief_complaint,
           diagnosis, status, created_at
    FROM consultations
    WHERE patient_id = ? AND professional_id = ?
    ORDER BY consultation_date DESC
  `).bind(patientId, professionalId).all();

  return c.json(consultations.results);
});

// -------------------------------------------------------
// GET /api/patients/:id/lab-exams
// -------------------------------------------------------
patientRoutes.get('/:id/lab-exams', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const patientId = c.req.param('id');
  const { DB } = c.env;

  // Verificar ownership do paciente
  const patient = await DB.prepare(
    'SELECT id FROM patients WHERE id = ? AND professional_id = ?'
  ).bind(patientId, professionalId).first();

  if (!patient) {
    return c.json({ error: 'Paciente não encontrado' }, 404);
  }

  const exams = await DB.prepare(`
    SELECT id, exam_date, exam_type, lab_name, results, interpretation, ai_analysis, created_at
    FROM lab_exams
    WHERE patient_id = ?
    ORDER BY exam_date DESC
  `).bind(patientId).all();

  return c.json(exams.results);
});

// -------------------------------------------------------
// Util
// -------------------------------------------------------
function safeJsonParse(str: string | null | undefined, fallback: unknown) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default patientRoutes;

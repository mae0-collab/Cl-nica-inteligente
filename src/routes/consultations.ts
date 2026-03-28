// ============================================================
// ROUTES - CONSULTATIONS - com ownership obrigatório
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { CreateConsultationSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const consultationRoutes = new Hono<AppEnv>();

consultationRoutes.use('*', authMiddleware);

// -------------------------------------------------------
// GET /api/consultations
// -------------------------------------------------------
consultationRoutes.get('/', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;
  const patientId = c.req.query('patient_id');

  // Sempre filtra pelo professionalId autenticado
  let query = `
    SELECT c.id, c.consultation_date, c.duration_minutes, c.chief_complaint,
           c.diagnosis, c.status, c.created_at,
           p.name as patient_name, p.id as patient_id
    FROM consultations c
    JOIN patients p ON p.id = c.patient_id
    WHERE c.professional_id = ?
  `;
  const params: unknown[] = [professionalId];

  if (patientId) {
    // Verificar que o paciente pertence ao profissional
    query += ' AND c.patient_id = ?';
    params.push(patientId);
  }

  query += ' ORDER BY c.consultation_date DESC LIMIT 100';

  const consultations = await DB.prepare(query).bind(...params).all();
  return c.json(consultations.results);
});

// -------------------------------------------------------
// GET /api/consultations/:id
// -------------------------------------------------------
consultationRoutes.get('/:id', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const consultationId = c.req.param('id');
  const { DB } = c.env;

  const consultation = await DB.prepare(
    'SELECT * FROM consultations WHERE id = ? AND professional_id = ?'
  ).bind(consultationId, professionalId).first();

  if (!consultation) {
    return c.json({ error: 'Consulta não encontrada' }, 404);
  }

  return c.json({
    ...consultation,
    prescription: safeJsonParse(consultation.prescription as string, []),
  });
});

// -------------------------------------------------------
// POST /api/consultations
// -------------------------------------------------------
consultationRoutes.post('/', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(CreateConsultationSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  // Verificar que o paciente pertence ao profissional autenticado
  const patient = await DB.prepare(
    'SELECT id FROM patients WHERE id = ? AND professional_id = ? AND is_active = 1'
  ).bind(d.patient_id, professionalId).first();

  if (!patient) {
    return c.json({ error: 'Paciente não encontrado ou não pertence a este profissional' }, 404);
  }

  const result = await DB.prepare(`
    INSERT INTO consultations (
      professional_id, patient_id, consultation_date, duration_minutes,
      chief_complaint, anamnesis, physical_exam, diagnosis, treatment_plan,
      prescription, follow_up_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    professionalId,
    d.patient_id,
    d.consultation_date,
    d.duration_minutes,
    d.chief_complaint ?? null,
    d.anamnesis ?? null,
    d.physical_exam ?? null,
    d.diagnosis ?? null,
    d.treatment_plan ?? null,
    JSON.stringify(d.prescription ?? []),
    d.follow_up_date ?? null,
    d.status,
  ).run();

  // Atualizar contador de consultas do profissional
  await DB.prepare(
    'UPDATE professionals SET total_consultations = total_consultations + 1 WHERE id = ?'
  ).bind(professionalId).run();

  return c.json({ id: result.meta.last_row_id, success: true }, 201);
});

// -------------------------------------------------------
// PUT /api/consultations/:id
// -------------------------------------------------------
consultationRoutes.put('/:id', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const consultationId = c.req.param('id');
  const { DB } = c.env;

  // Verificar ownership
  const existing = await DB.prepare(
    'SELECT id FROM consultations WHERE id = ? AND professional_id = ?'
  ).bind(consultationId, professionalId).first();

  if (!existing) {
    return c.json({ error: 'Consulta não encontrada' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(CreateConsultationSchema.partial(), body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  await DB.prepare(`
    UPDATE consultations SET
      consultation_date = COALESCE(?, consultation_date),
      duration_minutes = COALESCE(?, duration_minutes),
      chief_complaint = COALESCE(?, chief_complaint),
      anamnesis = COALESCE(?, anamnesis),
      physical_exam = COALESCE(?, physical_exam),
      diagnosis = COALESCE(?, diagnosis),
      treatment_plan = COALESCE(?, treatment_plan),
      prescription = COALESCE(?, prescription),
      follow_up_date = COALESCE(?, follow_up_date),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ? AND professional_id = ?
  `).bind(
    d.consultation_date ?? null,
    d.duration_minutes ?? null,
    d.chief_complaint ?? null,
    d.anamnesis ?? null,
    d.physical_exam ?? null,
    d.diagnosis ?? null,
    d.treatment_plan ?? null,
    d.prescription ? JSON.stringify(d.prescription) : null,
    d.follow_up_date ?? null,
    d.status ?? null,
    consultationId,
    professionalId,
  ).run();

  return c.json({ success: true });
});

// -------------------------------------------------------
// Util
// -------------------------------------------------------
function safeJsonParse(str: string | null | undefined, fallback: unknown) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export default consultationRoutes;

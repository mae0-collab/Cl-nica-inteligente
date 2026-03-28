// ============================================================
// ROUTES - PROTOCOLS
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { ApplyProtocolSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const protocolRoutes = new Hono<AppEnv>();

protocolRoutes.use('*', authMiddleware);

// -------------------------------------------------------
// GET /api/protocols
// -------------------------------------------------------
protocolRoutes.get('/', async (c) => {
  const { DB } = c.env;
  const condition = c.req.query('condition');
  const specialty = c.req.query('specialty');

  let query = `
    SELECT id, title, slug, description, condition, specialty,
           evidence_level, is_premium, created_at
    FROM protocols WHERE 1=1
  `;
  const params: unknown[] = [];

  if (condition) {
    query += ' AND condition LIKE ?';
    params.push(`%${condition}%`);
  }
  if (specialty) {
    query += ' AND specialty = ?';
    params.push(specialty);
  }

  query += ' ORDER BY created_at DESC';

  const protocols = await DB.prepare(query).bind(...params).all();
  return c.json(protocols.results);
});

// -------------------------------------------------------
// GET /api/protocols/:id
// -------------------------------------------------------
protocolRoutes.get('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  const protocol = await DB.prepare(
    'SELECT * FROM protocols WHERE id = ?'
  ).bind(id).first();

  if (!protocol) {
    return c.json({ error: 'Protocolo não encontrado' }, 404);
  }

  return c.json({
    ...protocol,
    protocol_steps: safeJsonParse(protocol.protocol_steps as string, []),
    supplements: safeJsonParse(protocol.supplements as string, []),
    lifestyle_recommendations: safeJsonParse(protocol.lifestyle_recommendations as string, []),
    lab_monitoring: safeJsonParse(protocol.lab_monitoring as string, []),
  });
});

// -------------------------------------------------------
// POST /api/protocols/:id/apply
// -------------------------------------------------------
protocolRoutes.post('/:id/apply', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const protocolId = c.req.param('id');
  const { DB } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(ApplyProtocolSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  // Verificar que protocolo existe
  const protocol = await DB.prepare(
    'SELECT id FROM protocols WHERE id = ?'
  ).bind(protocolId).first();

  if (!protocol) {
    return c.json({ error: 'Protocolo não encontrado' }, 404);
  }

  // Verificar que paciente pertence ao profissional autenticado
  const patient = await DB.prepare(
    'SELECT id FROM patients WHERE id = ? AND professional_id = ? AND is_active = 1'
  ).bind(d.patient_id, professionalId).first();

  if (!patient) {
    return c.json({ error: 'Paciente não encontrado ou não pertence a este profissional' }, 404);
  }

  const result = await DB.prepare(`
    INSERT INTO protocol_applications (
      professional_id, patient_id, protocol_id, consultation_id,
      customizations, start_date
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    professionalId, d.patient_id, protocolId,
    d.consultation_id ?? null,
    JSON.stringify(d.customizations ?? {}),
    d.start_date
  ).run();

  return c.json({ id: result.meta.last_row_id, success: true }, 201);
});

// -------------------------------------------------------
// GET /api/protocols/applications/me  - aplicações do profissional
// -------------------------------------------------------
protocolRoutes.get('/applications/me', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const applications = await DB.prepare(`
    SELECT pa.id, pa.start_date, pa.is_active, pa.created_at,
           p.title as protocol_title, p.condition,
           pt.name as patient_name
    FROM protocol_applications pa
    JOIN protocols p ON p.id = pa.protocol_id
    JOIN patients pt ON pt.id = pa.patient_id
    WHERE pa.professional_id = ?
    ORDER BY pa.created_at DESC
  `).bind(professionalId).all();

  return c.json(applications.results);
});

// -------------------------------------------------------
// Util
// -------------------------------------------------------
function safeJsonParse(str: string | null | undefined, fallback: unknown) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export default protocolRoutes;

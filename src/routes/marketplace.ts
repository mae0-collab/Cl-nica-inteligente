// ============================================================
// ROUTES - MARKETPLACE
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { ConsultationRequestSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const marketplaceRoutes = new Hono<AppEnv>();

// -------------------------------------------------------
// GET /api/marketplace/professionals  (rota pública)
// -------------------------------------------------------
marketplaceRoutes.get('/professionals', async (c) => {
  const { DB } = c.env;
  const specialty = c.req.query('specialty');

  let query = `
    SELECT id, name, specialty, bio, avatar_url, consultation_price,
           rating_average, total_consultations, marketplace_featured,
           registration_number
    FROM professionals
    WHERE marketplace_active = 1 AND is_active = 1
  `;
  const params: unknown[] = [];

  if (specialty) {
    query += ' AND specialty = ?';
    params.push(specialty);
  }

  query += ' ORDER BY marketplace_featured DESC, rating_average DESC';

  const professionals = await DB.prepare(query).bind(...params).all();
  return c.json(professionals.results);
});

// -------------------------------------------------------
// GET /api/marketplace/professionals/:id  (rota pública)
// -------------------------------------------------------
marketplaceRoutes.get('/professionals/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  const professional = await DB.prepare(`
    SELECT id, name, specialty, bio, avatar_url, consultation_price,
           rating_average, total_consultations, registration_number
    FROM professionals
    WHERE id = ? AND marketplace_active = 1 AND is_active = 1
  `).bind(id).first();

  if (!professional) {
    return c.json({ error: 'Profissional não encontrado no marketplace' }, 404);
  }

  // Avaliações públicas
  const reviews = await DB.prepare(`
    SELECT rating, review_text, communication_rating, expertise_rating,
           reviewer_name, created_at
    FROM professional_reviews
    WHERE professional_id = ? AND is_visible = 1
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(id).all();

  return c.json({ ...professional, reviews: reviews.results });
});

// -------------------------------------------------------
// POST /api/marketplace/consultation-requests  (rota pública)
// -------------------------------------------------------
marketplaceRoutes.post('/consultation-requests', async (c) => {
  const { DB } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(ConsultationRequestSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  // Verificar que profissional existe e está ativo no marketplace
  const professional = await DB.prepare(
    'SELECT id FROM professionals WHERE id = ? AND marketplace_active = 1 AND is_active = 1'
  ).bind(d.professional_id).first();

  if (!professional) {
    return c.json({ error: 'Profissional não disponível no marketplace' }, 404);
  }

  const result = await DB.prepare(`
    INSERT INTO consultation_requests (
      patient_name, patient_email, patient_phone, professional_id,
      preferred_date, message
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    d.patient_name, d.patient_email, d.patient_phone ?? null,
    d.professional_id, d.preferred_date ?? null, d.message ?? null
  ).run();

  return c.json({
    id: result.meta.last_row_id,
    message: 'Solicitação enviada com sucesso. O profissional entrará em contato em breve.',
    success: true,
  }, 201);
});

// -------------------------------------------------------
// GET /api/marketplace/my-requests  (profissional autenticado vê suas solicitações)
// -------------------------------------------------------
marketplaceRoutes.get('/my-requests', authMiddleware, async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const requests = await DB.prepare(`
    SELECT id, patient_name, patient_email, patient_phone,
           preferred_date, message, status, created_at
    FROM consultation_requests
    WHERE professional_id = ?
    ORDER BY created_at DESC
  `).bind(professionalId).all();

  return c.json(requests.results);
});

// -------------------------------------------------------
// PATCH /api/marketplace/my-requests/:id/status  (profissional autenticado)
// -------------------------------------------------------
marketplaceRoutes.patch('/my-requests/:id/status', authMiddleware, async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const requestId = c.req.param('id');
  const { DB } = c.env;

  const body = await c.req.json().catch(() => ({}));
  const status = body.status;

  if (!['pendente', 'aceita', 'recusada', 'concluida'].includes(status)) {
    return c.json({ error: 'Status inválido' }, 422);
  }

  // Verificar ownership
  const request = await DB.prepare(
    'SELECT id FROM consultation_requests WHERE id = ? AND professional_id = ?'
  ).bind(requestId, professionalId).first();

  if (!request) {
    return c.json({ error: 'Solicitação não encontrada' }, 404);
  }

  await DB.prepare(
    'UPDATE consultation_requests SET status = ?, responded_at = datetime(\'now\') WHERE id = ?'
  ).bind(status, requestId).run();

  return c.json({ success: true });
});

export default marketplaceRoutes;

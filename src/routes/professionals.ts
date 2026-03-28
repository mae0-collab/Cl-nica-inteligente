// ============================================================
// ROUTES - PROFESSIONALS
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { UpdateProfessionalSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const professionalRoutes = new Hono<AppEnv>();

// Todas as rotas exigem autenticação
professionalRoutes.use('*', authMiddleware);

// -------------------------------------------------------
// GET /api/professionals/me/stats
// -------------------------------------------------------
professionalRoutes.get('/me/stats', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const [patients, consultations, coursesProgress, professional] = await Promise.all([
    DB.prepare(
      'SELECT COUNT(*) as count FROM patients WHERE professional_id = ? AND is_active = 1'
    ).bind(professionalId).first<{ count: number }>(),

    DB.prepare(
      'SELECT COUNT(*) as count FROM consultations WHERE professional_id = ?'
    ).bind(professionalId).first<{ count: number }>(),

    DB.prepare(
      'SELECT COUNT(*) as completed FROM course_progress WHERE professional_id = ? AND status = "concluido"'
    ).bind(professionalId).first<{ completed: number }>(),

    DB.prepare(
      'SELECT xp_points, level, plan_type FROM professionals WHERE id = ?'
    ).bind(professionalId).first<{ xp_points: number; level: number; plan_type: string }>(),
  ]);

  return c.json({
    total_patients: patients?.count ?? 0,
    total_consultations: consultations?.count ?? 0,
    courses_completed: coursesProgress?.completed ?? 0,
    xp_points: professional?.xp_points ?? 0,
    level: professional?.level ?? 1,
    plan_type: professional?.plan_type ?? 'free',
  });
});

// -------------------------------------------------------
// GET /api/professionals/me
// -------------------------------------------------------
professionalRoutes.get('/me', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const professional = await DB.prepare(
    `SELECT id, email, name, specialty, registration_number, phone,
            avatar_url, bio, xp_points, level, plan_type, marketplace_active,
            consultation_price, rating_average, total_consultations,
            email_verified, profile_completed, created_at
     FROM professionals WHERE id = ? AND is_active = 1`
  ).bind(professionalId).first();

  if (!professional) {
    return c.json({ error: 'Profissional não encontrado' }, 404);
  }

  return c.json(professional);
});

// -------------------------------------------------------
// PUT /api/professionals/me
// -------------------------------------------------------
professionalRoutes.put('/me', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(UpdateProfessionalSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  await DB.prepare(`
    UPDATE professionals SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      bio = COALESCE(?, bio),
      avatar_url = COALESCE(?, avatar_url),
      registration_number = COALESCE(?, registration_number),
      consultation_price = COALESCE(?, consultation_price),
      marketplace_active = COALESCE(?, marketplace_active),
      profile_completed = 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    d.name ?? null,
    d.phone ?? null,
    d.bio ?? null,
    d.avatar_url ?? null,
    d.registration_number ?? null,
    d.consultation_price ?? null,
    d.marketplace_active !== undefined ? (d.marketplace_active ? 1 : 0) : null,
    professionalId
  ).run();

  return c.json({ success: true });
});

// -------------------------------------------------------
// GET /api/professionals/me/badges
// -------------------------------------------------------
professionalRoutes.get('/me/badges', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const badges = await DB.prepare(`
    SELECT b.id, b.name, b.description, b.icon_url, b.rarity, pb.earned_at
    FROM professional_badges pb
    JOIN badges b ON b.id = pb.badge_id
    WHERE pb.professional_id = ?
    ORDER BY pb.earned_at DESC
  `).bind(professionalId).all();

  return c.json(badges.results);
});

// -------------------------------------------------------
// GET /api/professionals/me/xp-history
// -------------------------------------------------------
professionalRoutes.get('/me/xp-history', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const history = await DB.prepare(`
    SELECT id, amount, source_type, description, created_at
    FROM xp_transactions
    WHERE professional_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(professionalId).all();

  return c.json(history.results);
});

// -------------------------------------------------------
// GET /api/professionals/me/notifications
// -------------------------------------------------------
professionalRoutes.get('/me/notifications', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const notifications = await DB.prepare(`
    SELECT id, title, message, type, action_url, is_read, created_at
    FROM notifications
    WHERE professional_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(professionalId).all();

  return c.json(notifications.results);
});

// -------------------------------------------------------
// PATCH /api/professionals/me/notifications/:id/read
// -------------------------------------------------------
professionalRoutes.patch('/me/notifications/:id/read', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const notificationId = c.req.param('id');
  const { DB } = c.env;

  // Verificar ownership da notificação
  const notification = await DB.prepare(
    'SELECT id FROM notifications WHERE id = ? AND professional_id = ?'
  ).bind(notificationId, professionalId).first();

  if (!notification) {
    return c.json({ error: 'Notificação não encontrada' }, 404);
  }

  await DB.prepare(
    'UPDATE notifications SET is_read = 1, read_at = datetime(\'now\') WHERE id = ?'
  ).bind(notificationId).run();

  return c.json({ success: true });
});

export default professionalRoutes;

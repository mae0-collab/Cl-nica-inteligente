// ============================================================
// ROUTES - COURSES
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { CourseProgressSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const courseRoutes = new Hono<AppEnv>();

courseRoutes.use('*', authMiddleware);

// -------------------------------------------------------
// GET /api/courses
// -------------------------------------------------------
courseRoutes.get('/', async (c) => {
  const { DB } = c.env;
  const category = c.req.query('category');
  const difficulty = c.req.query('difficulty');

  let query = 'SELECT * FROM courses WHERE is_published = 1';
  const params: unknown[] = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (difficulty) {
    query += ' AND difficulty = ?';
    params.push(difficulty);
  }

  query += ' ORDER BY created_at DESC';

  const courses = await DB.prepare(query).bind(...params).all();
  return c.json(courses.results);
});

// -------------------------------------------------------
// GET /api/courses/:id
// -------------------------------------------------------
courseRoutes.get('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  const course = await DB.prepare(
    'SELECT * FROM courses WHERE id = ? AND is_published = 1'
  ).bind(id).first();

  if (!course) {
    return c.json({ error: 'Curso não encontrado' }, 404);
  }

  const lessons = await DB.prepare(
    'SELECT id, title, description, content_type, order_index, duration_minutes, xp_reward FROM lessons WHERE course_id = ? AND is_published = 1 ORDER BY order_index ASC'
  ).bind(id).all();

  return c.json({ ...course, lessons: lessons.results });
});

// -------------------------------------------------------
// GET /api/courses/:id/progress
// -------------------------------------------------------
courseRoutes.get('/:id/progress', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const courseId = c.req.param('id');
  const { DB } = c.env;

  const progress = await DB.prepare(
    'SELECT * FROM course_progress WHERE course_id = ? AND professional_id = ?'
  ).bind(courseId, professionalId).first();

  return c.json(progress ?? { progress_percentage: 0, status: 'nao_iniciado' });
});

// -------------------------------------------------------
// POST /api/courses/:id/progress
// -------------------------------------------------------
courseRoutes.post('/:id/progress', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const courseId = c.req.param('id');
  const { DB } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(CourseProgressSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  // Verificar se curso existe
  const course = await DB.prepare(
    'SELECT id, xp_reward FROM courses WHERE id = ? AND is_published = 1'
  ).bind(courseId).first<{ id: number; xp_reward: number }>();

  if (!course) {
    return c.json({ error: 'Curso não encontrado' }, 404);
  }

  // Upsert de progresso
  const existing = await DB.prepare(
    'SELECT id FROM course_progress WHERE course_id = ? AND professional_id = ?'
  ).bind(courseId, professionalId).first();

  if (existing) {
    await DB.prepare(`
      UPDATE course_progress SET
        lessons_completed = ?, progress_percentage = ?,
        status = ?, last_accessed_at = datetime('now'),
        completed_at = CASE WHEN ? = 'concluido' THEN datetime('now') ELSE completed_at END
      WHERE course_id = ? AND professional_id = ?
    `).bind(
      d.lessons_completed, d.progress_percentage, d.status,
      d.status, courseId, professionalId
    ).run();
  } else {
    await DB.prepare(`
      INSERT INTO course_progress (course_id, professional_id, lessons_completed, progress_percentage, status)
      VALUES (?, ?, ?, ?, ?)
    `).bind(courseId, professionalId, d.lessons_completed, d.progress_percentage, d.status).run();
  }

  // Recompensar XP ao concluir
  if (d.status === 'concluido' && !existing) {
    await DB.prepare(
      'UPDATE professionals SET xp_points = xp_points + ? WHERE id = ?'
    ).bind(course.xp_reward, professionalId).run();

    await DB.prepare(`
      INSERT INTO xp_transactions (professional_id, amount, source_type, source_id, description)
      VALUES (?, ?, 'course', ?, ?)
    `).bind(professionalId, course.xp_reward, courseId, `Curso concluído`).run();
  }

  return c.json({ success: true });
});

export default courseRoutes;

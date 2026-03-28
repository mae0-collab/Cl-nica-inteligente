// ============================================================
// ROUTES - CLINICAL CASES
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { CaseAttemptSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const clinicalCaseRoutes = new Hono<AppEnv>();

clinicalCaseRoutes.use('*', authMiddleware);

// -------------------------------------------------------
// GET /api/clinical-cases
// -------------------------------------------------------
clinicalCaseRoutes.get('/', async (c) => {
  const { DB } = c.env;
  const difficulty = c.req.query('difficulty');
  const specialty = c.req.query('specialty');

  let query = `
    SELECT id, title, patient_profile, chief_complaint, difficulty,
           specialty, tags, xp_reward, created_at
    FROM clinical_cases WHERE 1=1
  `;
  const params: unknown[] = [];

  if (difficulty) {
    query += ' AND difficulty = ?';
    params.push(difficulty);
  }
  if (specialty) {
    query += ' AND specialty = ?';
    params.push(specialty);
  }

  query += ' ORDER BY created_at DESC';

  const cases = await DB.prepare(query).bind(...params).all();
  return c.json(cases.results);
});

// -------------------------------------------------------
// GET /api/clinical-cases/:id
// -------------------------------------------------------
clinicalCaseRoutes.get('/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  const clinicalCase = await DB.prepare(
    'SELECT * FROM clinical_cases WHERE id = ?'
  ).bind(id).first();

  if (!clinicalCase) {
    return c.json({ error: 'Caso clínico não encontrado' }, 404);
  }

  // Não expor gabarito antes da tentativa
  const { expected_diagnosis, expected_treatment, ...publicData } = clinicalCase as any;
  return c.json({
    ...publicData,
    lab_results: safeJsonParse(clinicalCase.lab_results as string, {}),
    tags: safeJsonParse(clinicalCase.tags as string, []),
  });
});

// -------------------------------------------------------
// POST /api/clinical-cases/:id/attempt
// -------------------------------------------------------
clinicalCaseRoutes.post('/:id/attempt', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const caseId = c.req.param('id');
  const { DB } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(CaseAttemptSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const d = validation.data;

  const clinicalCase = await DB.prepare(
    'SELECT expected_diagnosis, expected_treatment, xp_reward, title FROM clinical_cases WHERE id = ?'
  ).bind(caseId).first<{
    expected_diagnosis: string;
    expected_treatment: string;
    xp_reward: number;
    title: string;
  }>();

  if (!clinicalCase) {
    return c.json({ error: 'Caso clínico não encontrado' }, 404);
  }

  // Scoring simples (estrutura pronta para IA)
  const diagnosisLower = d.submitted_diagnosis.toLowerCase();
  const expectedLower = (clinicalCase.expected_diagnosis ?? '').toLowerCase();

  // Verificar palavras-chave do diagnóstico esperado
  const keywords = expectedLower.split(/[\s,]+/).filter(w => w.length > 4);
  const matchCount = keywords.filter(kw => diagnosisLower.includes(kw)).length;
  const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;

  const score = Math.round(40 + matchRatio * 60); // 40-100
  const isCorrect = score >= 70;
  const xpEarned = isCorrect
    ? clinicalCase.xp_reward
    : Math.floor(clinicalCase.xp_reward * 0.3);

  const aiFeedback = isCorrect
    ? `Excelente! Você identificou corretamente: ${clinicalCase.expected_diagnosis}. Continue com o raciocínio clínico estruturado.`
    : `Quase lá! O diagnóstico esperado era: ${clinicalCase.expected_diagnosis}. Revise os dados laboratoriais e os sinais clínicos.`;

  // Salvar tentativa
  const result = await DB.prepare(`
    INSERT INTO case_attempts (
      professional_id, clinical_case_id, submitted_diagnosis,
      submitted_treatment, score, ai_feedback, is_correct, xp_earned
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    professionalId, caseId, d.submitted_diagnosis,
    JSON.stringify(d.submitted_treatment ?? []),
    score, aiFeedback, isCorrect ? 1 : 0, xpEarned
  ).run();

  // Atualizar XP
  if (xpEarned > 0) {
    await DB.prepare(
      'UPDATE professionals SET xp_points = xp_points + ? WHERE id = ?'
    ).bind(xpEarned, professionalId).run();

    await DB.prepare(`
      INSERT INTO xp_transactions (professional_id, amount, source_type, source_id, description)
      VALUES (?, ?, 'case', ?, ?)
    `).bind(
      professionalId, xpEarned, caseId,
      `Caso: ${clinicalCase.title} - ${isCorrect ? 'correto' : 'parcial'}`
    ).run();
  }

  return c.json({
    id: result.meta.last_row_id,
    score,
    is_correct: isCorrect,
    xp_earned: xpEarned,
    feedback: aiFeedback,
    expected_diagnosis: clinicalCase.expected_diagnosis,
    success: true,
  });
});

// -------------------------------------------------------
// GET /api/clinical-cases/me/attempts
// -------------------------------------------------------
clinicalCaseRoutes.get('/me/attempts', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const attempts = await DB.prepare(`
    SELECT ca.id, ca.score, ca.is_correct, ca.xp_earned, ca.submitted_at,
           cc.title as case_title, cc.difficulty
    FROM case_attempts ca
    JOIN clinical_cases cc ON cc.id = ca.clinical_case_id
    WHERE ca.professional_id = ?
    ORDER BY ca.submitted_at DESC
    LIMIT 50
  `).bind(professionalId).all();

  return c.json(attempts.results);
});

// -------------------------------------------------------
// Util
// -------------------------------------------------------
function safeJsonParse(str: string | null | undefined, fallback: unknown) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export default clinicalCaseRoutes;

// ============================================================
// ROUTES - AUTENTICAÇÃO (Register / Login / Me)
// ============================================================

import { Hono } from 'hono';
import { hashPassword, verifyPassword, generateJWT } from '../auth/crypto';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { RegisterSchema, LoginSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const authRoutes = new Hono<AppEnv>();

// -------------------------------------------------------
// POST /api/auth/register
// -------------------------------------------------------
authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Corpo da requisição inválido' }, 400);
  }

  const validation = validateBody(RegisterSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const { email, password, name, specialty, registration_number, phone } = validation.data;
  const { DB, JWT_SECRET } = c.env;

  // Verificar se email já existe
  const existing = await DB.prepare(
    'SELECT id FROM professionals WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    return c.json({ error: 'Este email já está em uso', code: 'EMAIL_IN_USE' }, 409);
  }

  // Hash da senha
  const passwordHash = await hashPassword(password);

  // Criar profissional
  const result = await DB.prepare(`
    INSERT INTO professionals (
      email, password_hash, name, specialty, registration_number, phone,
      xp_points, level, plan_type, is_active, email_verified
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'free', 1, 0)
  `).bind(email, passwordHash, name, specialty, registration_number ?? null, phone ?? null).run();

  const professionalId = result.meta.last_row_id as number;

  // Gerar JWT
  const token = await generateJWT(
    { sub: professionalId, email },
    JWT_SECRET
  );

  // Log XP de boas-vindas
  await DB.prepare(`
    INSERT INTO xp_transactions (professional_id, amount, source_type, description)
    VALUES (?, 50, 'registration', 'Bônus de boas-vindas')
  `).bind(professionalId).run();

  await DB.prepare(
    'UPDATE professionals SET xp_points = 50 WHERE id = ?'
  ).bind(professionalId).run();

  return c.json({
    token,
    professional: {
      id: professionalId,
      email,
      name,
      specialty,
      xp_points: 50,
      level: 1,
      plan_type: 'free',
    },
  }, 201);
});

// -------------------------------------------------------
// POST /api/auth/login
// -------------------------------------------------------
authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Corpo da requisição inválido' }, 400);
  }

  const validation = validateBody(LoginSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const { email, password } = validation.data;
  const { DB, JWT_SECRET } = c.env;

  // Buscar profissional
  const professional = await DB.prepare(
    'SELECT id, email, name, specialty, password_hash, xp_points, level, plan_type, is_active FROM professionals WHERE email = ?'
  ).bind(email).first() as any;

  if (!professional) {
    // Mensagem genérica para evitar enumeração de usuários
    return c.json({ error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' }, 401);
  }

  if (!professional.is_active) {
    return c.json({ error: 'Conta desativada. Entre em contato com o suporte.', code: 'ACCOUNT_DISABLED' }, 403);
  }

  // Verificar senha
  const passwordValid = await verifyPassword(password, professional.password_hash);

  if (!passwordValid) {
    return c.json({ error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' }, 401);
  }

  // Gerar JWT
  const token = await generateJWT(
    { sub: professional.id, email: professional.email },
    JWT_SECRET
  );

  return c.json({
    token,
    professional: {
      id: professional.id,
      email: professional.email,
      name: professional.name,
      specialty: professional.specialty,
      xp_points: professional.xp_points,
      level: professional.level,
      plan_type: professional.plan_type,
    },
  });
});

// -------------------------------------------------------
// GET /api/auth/me  (rota protegida)
// -------------------------------------------------------
authRoutes.get('/me', authMiddleware, async (c) => {
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
    return c.json({ error: 'Profissional não encontrado', code: 'NOT_FOUND' }, 404);
  }

  return c.json(professional);
});

// -------------------------------------------------------
// POST /api/auth/logout  (stateless JWT - apenas instrução ao cliente)
// -------------------------------------------------------
authRoutes.post('/logout', authMiddleware, (c) => {
  return c.json({ message: 'Logout realizado. Remova o token do cliente.' });
});

export default authRoutes;

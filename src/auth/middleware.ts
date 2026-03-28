// ============================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================================

import { createMiddleware } from 'hono/factory';
import { verifyJWT } from './crypto';
import type { AppEnv } from '../lib/types';

/**
 * Middleware que protege rotas autenticadas.
 * Extrai o JWT do header Authorization: Bearer <token>
 * Injeta professionalId e professionalEmail no contexto.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token de autenticação ausente', code: 'MISSING_TOKEN' }, 401);
  }

  const token = authHeader.substring(7);
  const secret = c.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET não configurado no ambiente');
    return c.json({ error: 'Erro de configuração do servidor', code: 'SERVER_ERROR' }, 500);
  }

  const decoded = await verifyJWT(token, secret);

  if (!decoded) {
    return c.json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' }, 401);
  }

  // Injetar dados do usuário no contexto
  c.set('professionalId', decoded.sub);
  c.set('professionalEmail', decoded.email);

  await next();
});

/**
 * Helper: obtém professionalId do contexto com segurança.
 * Lança erro se não estiver disponível (rota não protegida).
 */
export function getAuthProfessionalId(c: any): number {
  const id = c.get('professionalId');
  if (!id) {
    throw new Error('professionalId não disponível - rota não protegida pelo authMiddleware');
  }
  return id as number;
}

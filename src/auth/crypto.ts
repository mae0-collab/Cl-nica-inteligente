// ============================================================
// AUTH - CRYPTO UTILS (Web Crypto API - compatível com CF Workers)
// ============================================================

/**
 * Hash de senha usando PBKDF2 via Web Crypto API.
 * Compatível com Cloudflare Workers (sem Node.js).
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltArray = Array.from(salt);

  const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `pbkdf2:${saltHex}:${hashHex}`;
}

/**
 * Verificar senha contra hash PBKDF2 armazenado.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Suporte a hash demo do seed (só para dev)
    if (storedHash.startsWith('demo_password_hash')) {
      return false; // Sempre falha - forçar cadastro real
    }

    if (!storedHash.startsWith('pbkdf2:')) {
      return false;
    }

    const [, saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) return false;

    const encoder = new TextEncoder();

    const saltBytes = new Uint8Array(
      saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16))
    );
    const expectedHashBytes = new Uint8Array(
      hashHex.match(/.{2}/g)!.map(b => parseInt(b, 16))
    );

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100_000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const derivedArray = new Uint8Array(derivedBits);

    // Comparação em tempo constante (evita timing attacks)
    if (derivedArray.length !== expectedHashBytes.length) return false;

    let diff = 0;
    for (let i = 0; i < derivedArray.length; i++) {
      diff |= derivedArray[i] ^ expectedHashBytes[i];
    }

    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Gerar JWT simples usando Web Crypto API (HMAC-SHA256).
 * Compatível com Cloudflare Workers.
 */
export async function generateJWT(
  payload: { sub: number; email: string },
  secret: string,
  expiresInSeconds = 86400 * 7 // 7 dias
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = btoa(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const data = `${header}.${jwtPayload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signatureBase64}`;
}

/**
 * Verificar e decodificar JWT.
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<{ sub: number; email: string; iat: number; exp: number } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decodificar signature
    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(data)
    );

    if (!valid) return null;

    // Decodificar payload
    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Verificar expiração
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp < now) return null;

    return decodedPayload;
  } catch {
    return null;
  }
}

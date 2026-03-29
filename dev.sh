#!/bin/bash
# ============================================================
# MODO DESENVOLVIMENTO — hot reload via wrangler direto
# Lê variáveis de .dev.vars automaticamente (wrangler padrão)
# Use quando for editar código ativamente
# ============================================================
cd /home/user/webapp

echo "🔧 Modo desenvolvimento — Ctrl+C para parar"
echo "📋 Lendo variáveis de .dev.vars"
echo ""

# Verificar se .dev.vars tem chave real
if grep -q "COLE_SUA_CHAVE_AQUI" .dev.vars 2>/dev/null; then
  echo "⚠️  AVISO: OPENAI_API_KEY não configurada em .dev.vars"
  echo "   Edite .dev.vars e substitua COLE_SUA_CHAVE_AQUI pela sua chave"
  echo "   IA usará fallback local enquanto isso"
  echo ""
fi

# Rebuildar primeiro
npm run build

# Wrangler lê .dev.vars automaticamente no modo pages dev
npx wrangler pages dev ./dist \
  --d1 DB=SUBSTITUA_PELO_ID_GERADO \
  --port 3000 \
  --ip 0.0.0.0

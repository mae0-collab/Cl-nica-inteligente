#!/bin/bash
# ============================================================
# MODO DESENVOLVIMENTO — hot reload via wrangler direto
# Use quando for editar código ativamente
# ============================================================
cd /home/user/webapp

echo "🔧 Modo desenvolvimento — Ctrl+C para parar"
echo ""

# Rebuildar primeiro
npm run build

# Iniciar com binding completo
npx wrangler pages dev ./dist \
  --d1 DB=SUBSTITUA_PELO_ID_GERADO \
  --binding ENVIRONMENT=development \
  --binding JWT_SECRET=dev-secret-jwt-clinica-2024 \
  --port 3000 \
  --ip 0.0.0.0

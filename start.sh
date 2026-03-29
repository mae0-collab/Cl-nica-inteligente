#!/bin/bash
# ============================================================
# CLÍNICA INTELIGENTE — Script de Inicialização no Claw
# Execute: bash start.sh
# ============================================================

set -e
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd /home/user/webapp

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║    CLÍNICA INTELIGENTE v2.0          ║"
echo "  ║    Iniciando no Genspark Claw...     ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# 1. Parar instâncias anteriores
echo -e "${YELLOW}[1/6] Parando instâncias anteriores...${NC}"
pm2 delete clinica-inteligente 2>/dev/null || true
kill $(lsof -ti:3000) 2>/dev/null || true
sleep 1
echo -e "${GREEN}    ✓ Limpo${NC}"

# 2. Carregar variáveis de ambiente
echo -e "${YELLOW}[2/6] Carregando configurações...${NC}"
OPENAI_KEY=""
OPENAI_MDL="gpt-5.2"

if [ -f /home/user/.env.clinica ]; then
  source /home/user/.env.clinica
  OPENAI_KEY="${OPENAI_API_KEY}"
  OPENAI_MDL="${OPENAI_MODEL:-gpt-5.2}"
  echo -e "${GREEN}    ✓ OpenAI configurado (${OPENAI_MDL})${NC}"
else
  echo -e "${YELLOW}    ⚠ Sem OPENAI_API_KEY — usando fallback local${NC}"
fi

# 3. Instalar dependências
echo -e "${YELLOW}[3/6] Verificando dependências...${NC}"
if [ ! -d "node_modules" ]; then
  npm install --silent
  echo -e "${GREEN}    ✓ Instaladas${NC}"
else
  echo -e "${GREEN}    ✓ Já instaladas${NC}"
fi

# 4. Build
echo -e "${YELLOW}[4/6] Fazendo build...${NC}"
npm run build --silent
echo -e "${GREEN}    ✓ Build concluído (dist/_worker.js)${NC}"

# 5. Banco de dados
echo -e "${YELLOW}[5/6] Verificando banco de dados...${NC}"
npx wrangler d1 execute DB --local \
  --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" \
  2>/dev/null | grep -q "results" && \
  echo -e "${GREEN}    ✓ Banco D1 local pronto${NC}" || \
  (npx wrangler d1 execute DB --local --file migrations/0001_initial_schema.sql 2>/dev/null && \
   npx wrangler d1 execute DB --local --file migrations/0002_security.sql 2>/dev/null && \
   npx wrangler d1 execute DB --local --file seed.sql 2>/dev/null && \
   echo -e "${GREEN}    ✓ Schema e seed aplicados${NC}")

# 6. Iniciar servidor
echo -e "${YELLOW}[6/6] Iniciando servidor...${NC}"
mkdir -p logs

# Montar bindings
BINDINGS="--d1 DB=SUBSTITUA_PELO_ID_GERADO --binding ENVIRONMENT=development --binding JWT_SECRET=dev-secret-jwt-clinica-2024"
if [ -n "$OPENAI_KEY" ]; then
  BINDINGS="$BINDINGS --binding OPENAI_API_KEY=$OPENAI_KEY --binding OPENAI_MODEL=$OPENAI_MDL"
fi

npx wrangler pages dev ./dist $BINDINGS \
  --port 3000 --ip 0.0.0.0 \
  > logs/app-out.log 2>&1 &

sleep 6

# Verificar saúde
HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"ok"'; then
  echo -e "${GREEN}    ✓ Servidor respondendo!${NC}"
else
  echo -e "${RED}    ✗ Aguardando...${NC}"
  sleep 4
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ CLÍNICA INTELIGENTE RODANDO!                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Dashboard: http://localhost:3000/dashboard      ║${NC}"
echo -e "${GREEN}║  Login:     http://localhost:3000/login          ║${NC}"
if [ -n "$OPENAI_KEY" ]; then
echo -e "${GREEN}║  IA:        🤖 ${OPENAI_MDL} ATIVO              ║${NC}"
else
echo -e "${YELLOW}║  IA:        ⚠ Fallback local (sem API key)       ║${NC}"
fi
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  pm2 logs clinica-inteligente                    ║${NC}"
echo -e "${GREEN}║  pm2 restart clinica-inteligente                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

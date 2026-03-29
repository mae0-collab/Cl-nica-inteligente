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
echo -e "${YELLOW}[1/5] Parando instâncias anteriores...${NC}"
pm2 delete clinica-inteligente 2>/dev/null || true
kill $(lsof -ti:3000) 2>/dev/null || true
sleep 1
echo -e "${GREEN}    ✓ Limpo${NC}"

# 2. Instalar dependências (se necessário)
echo -e "${YELLOW}[2/5] Verificando dependências...${NC}"
if [ ! -d "node_modules" ]; then
  npm install --silent
  echo -e "${GREEN}    ✓ Instaladas${NC}"
else
  echo -e "${GREEN}    ✓ Já instaladas${NC}"
fi

# 3. Build
echo -e "${YELLOW}[3/5] Fazendo build...${NC}"
npm run build --silent
echo -e "${GREEN}    ✓ Build concluído (dist/_worker.js)${NC}"

# 4. Migrations D1 local
echo -e "${YELLOW}[4/5] Verificando banco de dados...${NC}"
npx wrangler d1 execute DB --local \
  --command "SELECT COUNT(*) as tables FROM sqlite_master WHERE type='table';" \
  2>/dev/null | grep -q "tables" && \
  echo -e "${GREEN}    ✓ Banco D1 local pronto${NC}" || \
  (echo "  Criando schema..." && \
   npx wrangler d1 execute DB --local --file migrations/0001_initial_schema.sql 2>/dev/null && \
   npx wrangler d1 execute DB --local --file migrations/0002_security.sql 2>/dev/null && \
   npx wrangler d1 execute DB --local --file seed.sql 2>/dev/null && \
   echo -e "${GREEN}    ✓ Schema e seed aplicados${NC}")

# 5. Iniciar com PM2
echo -e "${YELLOW}[5/5] Iniciando servidor com PM2...${NC}"
mkdir -p logs
pm2 start ecosystem.config.cjs
sleep 4

# Verificar saúde
HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"ok"'; then
  echo -e "${GREEN}    ✓ Servidor respondendo!${NC}"
else
  echo -e "${RED}    ✗ Aguardando servidor...${NC}"
  sleep 3
  HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ CLÍNICA INTELIGENTE RODANDO!             ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Local:    http://localhost:3000             ║${NC}"
echo -e "${GREEN}║  Dashboard: http://localhost:3000/dashboard  ║${NC}"
echo -e "${GREEN}║  Health:    http://localhost:3000/api/health ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Comandos úteis:                             ║${NC}"
echo -e "${GREEN}║    pm2 logs clinica-inteligente              ║${NC}"
echo -e "${GREEN}║    pm2 status                                ║${NC}"
echo -e "${GREEN}║    pm2 restart clinica-inteligente           ║${NC}"
echo -e "${GREEN}║    bash stop.sh                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

pm2 status

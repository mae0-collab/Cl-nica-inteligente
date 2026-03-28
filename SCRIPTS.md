# 🛠️ Scripts Úteis - Clínica Inteligente

## Comandos para Operação e Manutenção

---

## 📦 Desenvolvimento Local

### **Iniciar Ambiente Completo**
```bash
# 1. Buildar projeto
cd /home/user/webapp && npm run build

# 2. Aplicar migrations (se necessário)
npm run db:migrate:local

# 3. Seed do banco (se necessário)
npm run db:seed

# 4. Limpar porta 3000
fuser -k 3000/tcp 2>/dev/null || true

# 5. Iniciar servidor
pm2 start ecosystem.config.cjs

# 6. Ver logs
pm2 logs clinica-inteligente --nostream

# 7. Verificar status
pm2 list
```

### **Script All-in-One (Desenvolvimento)**
```bash
#!/bin/bash
# save as: scripts/dev-start.sh

echo "🏥 Iniciando Clínica Inteligente..."

cd /home/user/webapp

# Build
echo "📦 Building..."
npm run build

# Limpar porta
echo "🧹 Limpando porta 3000..."
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Iniciar PM2
echo "🚀 Iniciando servidor..."
pm2 delete clinica-inteligente 2>/dev/null || true
pm2 start ecosystem.config.cjs

# Status
sleep 2
pm2 logs clinica-inteligente --nostream --lines 20

echo "✅ Servidor rodando em http://localhost:3000"
echo "📊 Dashboard: http://localhost:3000/dashboard"
```

---

## 🗄️ Database Management

### **Reset Completo do Database**
```bash
# Remove database local completamente
rm -rf .wrangler/state/v3/d1

# Aplica migrations novamente
npm run db:migrate:local

# Popula com dados de exemplo
npm run db:seed

echo "✅ Database resetado com sucesso!"
```

### **Backup do Database Local**
```bash
#!/bin/bash
# save as: scripts/db-backup.sh

BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

cp -r .wrangler/state/v3/d1 $BACKUP_DIR/
echo "✅ Backup criado em: $BACKUP_DIR"
```

### **Queries Úteis**
```bash
# Ver todos os profissionais
wrangler d1 execute clinica-inteligente-production --local --command="SELECT id, name, email, specialty, xp_points, level FROM professionals"

# Ver cursos
wrangler d1 execute clinica-inteligente-production --local --command="SELECT id, title, category, difficulty, xp_reward FROM courses"

# Ver badges
wrangler d1 execute clinica-inteligente-production --local --command="SELECT name, description, rarity FROM badges"

# Ver XP total por profissional
wrangler d1 execute clinica-inteligente-production --local --command="SELECT p.name, p.xp_points, COUNT(x.id) as transactions FROM professionals p LEFT JOIN xp_transactions x ON p.id = x.professional_id GROUP BY p.id"
```

### **Adicionar Profissional via CLI**
```bash
#!/bin/bash
# save as: scripts/add-professional.sh

read -p "Nome: " name
read -p "Email: " email
read -p "Especialidade (medico/nutricionista/farmaceutico/serumanologista): " specialty

wrangler d1 execute clinica-inteligente-production --local --command="
INSERT INTO professionals (name, email, password_hash, specialty, profile_completed, email_verified)
VALUES ('$name', '$email', 'temp_password_hash', '$specialty', 1, 1)
"

echo "✅ Profissional $name adicionado!"
```

---

## 🧪 Testes de API

### **Health Check Completo**
```bash
#!/bin/bash
# save as: scripts/health-check.sh

BASE_URL="http://localhost:3000"

echo "🏥 Clínica Inteligente - Health Check"
echo "======================================"

# Test 1: Homepage
echo -n "Homepage: "
curl -s -o /dev/null -w "%{http_code}" $BASE_URL
echo ""

# Test 2: Dashboard
echo -n "Dashboard: "
curl -s -o /dev/null -w "%{http_code}" $BASE_URL/dashboard
echo ""

# Test 3: API Stats
echo -n "API Stats: "
curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/professionals/1/stats
echo ""

# Test 4: API Courses
echo -n "API Courses: "
curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/courses
echo ""

# Test 5: API Protocols
echo -n "API Protocols: "
curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/protocols
echo ""

echo "======================================"
echo "✅ Health check concluído!"
```

### **Load Test Simples (Apache Bench)**
```bash
# Instalar ab (se necessário)
# apt-get install apache2-utils

# 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3000/api/courses

# 1000 requests, 50 concurrent
ab -n 1000 -c 50 http://localhost:3000/api/professionals/1/stats
```

---

## 🚀 Deploy & Produção

### **Deploy para Cloudflare Pages**
```bash
#!/bin/bash
# save as: scripts/deploy-production.sh

echo "🚀 Deploying Clínica Inteligente para Produção"

# Build
npm run build

# Aplicar migrations em produção (primeira vez)
wrangler d1 migrations apply clinica-inteligente-production --remote

# Deploy
wrangler pages deploy dist --project-name clinica-inteligente

echo "✅ Deploy concluído!"
echo "🌐 URL: https://clinica-inteligente.pages.dev"
```

### **Rollback de Deploy**
```bash
# Ver deployments
wrangler pages deployment list --project-name clinica-inteligente

# Rollback para deployment anterior
wrangler pages deployment promote <DEPLOYMENT_ID> --project-name clinica-inteligente
```

---

## 📊 Analytics & Monitoring

### **Ver Logs de Produção**
```bash
# Tail logs em tempo real
wrangler pages deployment tail --project-name clinica-inteligente

# Filtrar por erro
wrangler pages deployment tail --project-name clinica-inteligente --format=json | grep -i "error"
```

### **Estatísticas de Uso**
```bash
#!/bin/bash
# save as: scripts/usage-stats.sh

echo "📊 Estatísticas de Uso - Clínica Inteligente"

# Total de profissionais
echo -n "Total Profissionais: "
wrangler d1 execute clinica-inteligente-production --local --command="SELECT COUNT(*) FROM professionals" | grep -oP '\d+'

# Total de pacientes
echo -n "Total Pacientes: "
wrangler d1 execute clinica-inteligente-production --local --command="SELECT COUNT(*) FROM patients" | grep -oP '\d+'

# Total de consultas
echo -n "Total Consultas: "
wrangler d1 execute clinica-inteligente-production --local --command="SELECT COUNT(*) FROM consultations" | grep -oP '\d+'

# Total de cursos iniciados
echo -n "Cursos Iniciados: "
wrangler d1 execute clinica-inteligente-production --local --command="SELECT COUNT(*) FROM course_progress" | grep -oP '\d+'

# Total XP distribuído
echo -n "Total XP Distribuído: "
wrangler d1 execute clinica-inteligente-production --local --command="SELECT SUM(xp_points) FROM professionals" | grep -oP '\d+'
```

---

## 🔐 Segurança

### **Gerar Hash de Senha (bcrypt)**
```javascript
// Node.js REPL
const bcrypt = require('bcryptjs');
const password = 'senha_segura_123';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

### **Verificar Senha**
```javascript
const bcrypt = require('bcryptjs');
const password = 'senha_segura_123';
const hash = '$2a$10$...';  // hash do banco
const isValid = bcrypt.compareSync(password, hash);
console.log(isValid);  // true/false
```

### **Rotação de Secrets (Produção)**
```bash
# Atualizar API key da OpenAI
wrangler secret put OPENAI_API_KEY --env production

# Listar secrets
wrangler secret list --env production

# Deletar secret
wrangler secret delete OLD_SECRET --env production
```

---

## 🔧 Manutenção

### **Limpar Cache de Build**
```bash
rm -rf dist
rm -rf .wrangler
npm run build
```

### **Atualizar Dependências**
```bash
# Ver dependências desatualizadas
npm outdated

# Atualizar pacote específico
npm update hono

# Atualizar todos os patches
npm update

# Atualizar majors (cuidado!)
npx npm-check-updates -u
npm install
```

### **Compactar Projeto para Backup**
```bash
#!/bin/bash
# save as: scripts/backup-project.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="clinica-inteligente-backup-$TIMESTAMP.tar.gz"

tar -czf $BACKUP_FILE \
  --exclude='node_modules' \
  --exclude='.wrangler' \
  --exclude='dist' \
  --exclude='.git' \
  .

echo "✅ Backup criado: $BACKUP_FILE"
```

---

## 📈 Performance

### **Analisar Bundle Size**
```bash
npm run build

# Ver tamanho do bundle
ls -lh dist/_worker.js

# Otimizar (se necessário)
# - Remover dependências não usadas
# - Tree shaking automático (Vite)
```

### **Benchmark Database**
```bash
#!/bin/bash
# save as: scripts/db-benchmark.sh

echo "🔬 Database Benchmark"

time wrangler d1 execute clinica-inteligente-production --local --command="SELECT * FROM professionals"

time wrangler d1 execute clinica-inteligente-production --local --command="SELECT * FROM courses WHERE category = 'saude_hormonal'"

time wrangler d1 execute clinica-inteligente-production --local --command="SELECT COUNT(*) FROM consultations GROUP BY professional_id"
```

---

## 🐛 Debug

### **Enable Debug Mode**
```bash
# Em .dev.vars
DEBUG=true
LOG_LEVEL=debug

# Restart PM2
pm2 restart clinica-inteligente
```

### **Ver Queries SQL em Tempo Real**
```bash
# Não disponível no D1, mas pode simular:
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite

# Dentro do SQLite:
.log stdout
.headers on
.mode column

SELECT * FROM professionals;
```

---

## 🎯 Automação (Cron Jobs)

### **Daily Stats Email (futuro)**
```bash
#!/bin/bash
# save as: scripts/daily-stats.sh
# Add to crontab: 0 9 * * * /path/to/daily-stats.sh

# Coletar stats
STATS=$(wrangler d1 execute clinica-inteligente-production --remote --command="
SELECT 
  (SELECT COUNT(*) FROM professionals) as professionals,
  (SELECT COUNT(*) FROM patients) as patients,
  (SELECT COUNT(*) FROM consultations WHERE DATE(created_at) = DATE('now')) as today_consultations
")

# Enviar email (usar SendGrid/Mailgun)
echo "$STATS" | mail -s "Clínica Inteligente - Daily Stats" admin@clinicainteligente.com.br
```

---

## 📝 Notas

- Sempre testar em **local** antes de produção
- Fazer **backup** antes de migrations
- Monitorar **performance** após deploys
- Revisar **logs** diariamente

---

**Última atualização:** 2026-03-20

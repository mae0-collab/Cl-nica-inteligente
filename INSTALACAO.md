# 📦 Instalação - Clínica Inteligente

## Guia Completo de Instalação e Configuração

---

## 📥 **1. Download do Projeto**

Você já baixou o arquivo: `clinica-inteligente-mvp-completo.tar.gz`

---

## 🔧 **2. Pré-requisitos**

Antes de começar, certifique-se de ter instalado:

### **Node.js 18+ (LTS)**
```bash
# Verificar versão
node --version  # Deve mostrar v18.x.x ou superior

# Se não tiver, baixe em:
# https://nodejs.org/
```

### **npm 8+**
```bash
# Verificar versão
npm --version  # Deve mostrar 8.x.x ou superior
```

### **Git**
```bash
# Verificar versão
git --version

# Se não tiver, baixe em:
# https://git-scm.com/
```

---

## 📂 **3. Extrair e Configurar**

### **Windows:**
```powershell
# Extrair arquivo (usar 7-Zip, WinRAR ou similar)
# Ou via PowerShell:
tar -xzf clinica-inteligente-mvp-completo.tar.gz

# Navegar para o diretório
cd webapp

# Instalar dependências
npm install
```

### **macOS/Linux:**
```bash
# Extrair arquivo
tar -xzf clinica-inteligente-mvp-completo.tar.gz

# Navegar para o diretório
cd webapp

# Instalar dependências
npm install
```

---

## 🗄️ **4. Configurar Banco de Dados**

```bash
# Aplicar migrations (criar tabelas)
npm run db:migrate:local

# Popular com dados de exemplo
npm run db:seed
```

**Resultado esperado:**
```
✅ 42 commands executed successfully
✅ 6 commands executed successfully
```

---

## 🚀 **5. Iniciar o Servidor**

### **Opção A: Desenvolvimento Rápido (Windows/macOS/Linux)**
```bash
# Build do projeto
npm run build

# Iniciar servidor de desenvolvimento
npm run dev:sandbox
```

### **Opção B: Com PM2 (Recomendado para Linux/macOS)**
```bash
# Instalar PM2 globalmente (apenas uma vez)
npm install -g pm2

# Build do projeto
npm run build

# Iniciar com PM2
pm2 start ecosystem.config.cjs

# Ver logs
pm2 logs clinica-inteligente --nostream
```

**Servidor iniciará em:** http://localhost:3000

---

## ✅ **6. Verificar Instalação**

### **Teste 1: Homepage**
Abra no navegador: http://localhost:3000

Você deve ver a landing page da **Clínica Inteligente**.

### **Teste 2: Dashboard**
Abra: http://localhost:3000/dashboard

Você deve ver:
- ✅ Estatísticas (Total Pacientes, Consultas, etc.)
- ✅ Menu lateral com navegação
- ✅ Ações rápidas

### **Teste 3: API**
```bash
# Teste stats
curl http://localhost:3000/api/professionals/1/stats

# Teste cursos
curl http://localhost:3000/api/courses

# Teste protocolos
curl http://localhost:3000/api/protocols
```

**Resultado esperado:** JSON com dados

---

## 🎨 **7. Explorar Funcionalidades**

### **Dashboard** (http://localhost:3000/dashboard)

Clique nos itens do menu lateral:

1. **Dashboard** - Visão geral
2. **Pacientes** - Lista de pacientes (vazia inicialmente)
3. **Cursos** - 6 cursos disponíveis
4. **Casos Clínicos** - 2 casos para resolver
5. **Protocolos** - 2 protocolos clínicos
6. **Assistente IA** - Chat simulado
7. **Marketplace** - Profissionais disponíveis

---

## 📚 **8. Ler Documentação**

Após instalação, leia os seguintes arquivos:

1. **README.md** - Visão geral completa do projeto
2. **ROADMAP.md** - Plano de desenvolvimento futuro
3. **DESENVOLVIMENTO.md** - Guia para desenvolvedores
4. **PITCH_DECK.md** - Apresentação para investidores
5. **SCRIPTS.md** - Scripts úteis de automação

---

## 🔧 **9. Comandos Úteis**

### **Desenvolvimento**
```bash
# Rebuild após mudanças
npm run build

# Reiniciar servidor (PM2)
pm2 restart clinica-inteligente

# Ver logs em tempo real
pm2 logs clinica-inteligente

# Parar servidor
pm2 stop clinica-inteligente
```

### **Database**
```bash
# Reset completo do database
npm run db:reset

# Apenas migrations
npm run db:migrate:local

# Apenas seed
npm run db:seed
```

### **Limpeza**
```bash
# Limpar porta 3000
npm run clean-port

# Limpar cache de build
rm -rf dist .wrangler
npm run build
```

---

## 🐛 **10. Troubleshooting**

### **Problema: Porta 3000 já em uso**
```bash
# Windows (PowerShell como Admin)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# macOS/Linux
npm run clean-port
# ou
fuser -k 3000/tcp
```

### **Problema: "Module not found"**
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### **Problema: "Migration failed"**
```bash
# Reset completo do database
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
npm run db:seed
```

### **Problema: "Cannot connect to database"**
```bash
# Verificar se wrangler está instalado
npx wrangler --version

# Reinstalar wrangler
npm install -D wrangler@latest
```

---

## 🌐 **11. Deploy para Produção (Opcional)**

### **Criar conta Cloudflare (Grátis)**
1. Acesse: https://dash.cloudflare.com/sign-up
2. Crie uma conta gratuita

### **Instalar Wrangler CLI**
```bash
npm install -g wrangler

# Login na Cloudflare
wrangler login
```

### **Criar Database de Produção**
```bash
# Criar D1 database
wrangler d1 create clinica-inteligente-production

# Copiar o database_id retornado
# Colar em wrangler.jsonc na linha: "database_id": "cole-aqui"
```

### **Deploy**
```bash
# Build
npm run build

# Aplicar migrations em produção
wrangler d1 migrations apply clinica-inteligente-production --remote

# Deploy para Cloudflare Pages
npm run deploy
```

**Sua aplicação estará online em:** https://clinica-inteligente.pages.dev

---

## 📊 **12. Estrutura de Arquivos**

```
webapp/
├── src/
│   ├── index.tsx              # Backend principal (800 linhas)
│   └── lib/
│       └── types.ts           # TypeScript types
│
├── public/static/
│   └── app.js                 # Frontend JavaScript
│
├── migrations/
│   └── 0001_initial_schema.sql # 19 tabelas SQL
│
├── seed.sql                   # Dados de exemplo
├── package.json               # Dependências
├── wrangler.jsonc             # Config Cloudflare
├── ecosystem.config.cjs       # Config PM2
│
├── README.md                  # Documentação principal ⭐
├── ROADMAP.md                 # Roadmap 2026-2027
├── DESENVOLVIMENTO.md         # Guia técnico
├── PITCH_DECK.md              # Pitch para investidores
├── SCRIPTS.md                 # Scripts úteis
└── INSTALACAO.md              # Este arquivo
```

---

## 🎯 **13. Dados de Demonstração**

Após `npm run db:seed`, você terá:

### **4 Profissionais:**
1. Dra. Ana Silva - Nutricionista (ID: 1)
2. Dr. Carlos Mendes - Médico (ID: 2)
3. Farm. Julia Costa - Farmacêutica (ID: 3)
4. Pedro Oliveira - SerHumanologista (ID: 4)

### **6 Cursos:**
1. Fundamentos da Saúde Hormonal
2. Nutrição Funcional 3.0
3. Exames Laboratoriais 2.0
4. Suplementação Individualizada
5. Jejum Intermitente
6. Introdução à Saúde Integrativa

### **2 Casos Clínicos:**
1. Mulher de 32 anos com SOP
2. Homem de 45 anos com fadiga crônica

### **2 Protocolos:**
1. SOP com Resistência Insulínica
2. Jejum Intermitente 16/8

### **8 Badges:**
- Primeiro Passo
- Estudante Dedicado
- Mestre do Conhecimento
- Resolvedor de Casos
- Diagnóstico Certeiro
- Clínico Experiente
- Especialista Elite
- Referência em Saúde

---

## 📧 **14. Suporte**

### **Problemas?**
- Leia o **DESENVOLVIMENTO.md** para troubleshooting
- Verifique os logs: `pm2 logs clinica-inteligente`
- Consulte o **SCRIPTS.md** para comandos úteis

### **Dúvidas sobre funcionalidades?**
- Leia o **README.md** completo
- Explore cada seção do dashboard
- Teste as APIs com curl

---

## 🎉 **15. Próximos Passos**

Após instalar com sucesso:

1. ✅ Explore todas as funcionalidades no dashboard
2. ✅ Leia a documentação completa (README.md)
3. ✅ Teste as APIs com curl ou Postman
4. ✅ Modifique o código e experimente
5. ✅ Leia o ROADMAP.md para entender evolução futura

---

## 🚀 **Começar Agora:**

```bash
# 1. Extrair projeto
tar -xzf clinica-inteligente-mvp-completo.tar.gz
cd webapp

# 2. Instalar
npm install

# 3. Configurar DB
npm run db:migrate:local
npm run db:seed

# 4. Iniciar
npm run build
npm run dev:sandbox

# 5. Abrir navegador
# http://localhost:3000/dashboard
```

---

**✨ Pronto! Você tem uma plataforma completa rodando em sua máquina!**

**Desenvolvido com ❤️ para revolucionar a saúde integrativa**

---

**Versão:** 1.0.0  
**Data:** 2026-03-20  
**Autor:** Clínica Inteligente Team

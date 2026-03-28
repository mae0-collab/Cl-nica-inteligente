# 👨‍💻 Guia de Desenvolvimento - Clínica Inteligente

## Para Desenvolvedores que vão Expandir a Plataforma

---

## 🏗️ Arquitetura da Aplicação

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (HTML/JS)                      │
│  - Dashboard interativo                                      │
│  - TailwindCSS para styling                                  │
│  - Vanilla JS (sem framework - facilita manutenção)          │
└─────────────────────────────────────────────────────────────┘
                              ↕️
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Hono Framework)                  │
│  - API REST completa                                         │
│  - Edge runtime (Cloudflare Workers)                         │
│  - TypeScript para type safety                               │
└─────────────────────────────────────────────────────────────┘
                              ↕️
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (Cloudflare D1)                   │
│  - SQLite distribuído globalmente                            │
│  - 19 tabelas principais                                     │
│  - Indexes otimizados                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Diretórios

```
webapp/
├── src/
│   ├── index.tsx              # Backend Hono principal
│   ├── lib/
│   │   └── types.ts           # TypeScript types
│   └── routes/                # Rotas modulares (futuro)
│
├── public/
│   └── static/
│       └── app.js             # Frontend JavaScript
│
├── migrations/
│   └── 0001_initial_schema.sql  # Database schema
│
├── seed.sql                   # Dados de exemplo
├── ecosystem.config.cjs       # PM2 config
├── wrangler.jsonc             # Cloudflare config
├── package.json               # Dependencies
└── README.md                  # Documentação principal
```

---

## 🔧 Setup para Desenvolvimento

### **1. Pré-requisitos**
```bash
# Node.js 18+ (LTS recomendado)
node --version  # v18.x.x ou superior

# npm 8+
npm --version   # 8.x.x ou superior
```

### **2. Instalação**
```bash
# Clone o repositório
git clone <repo-url>
cd webapp

# Instale dependências
npm install

# Configure banco de dados local
npm run db:migrate:local
npm run db:seed
```

### **3. Ambiente de Desenvolvimento**
```bash
# Build do projeto
npm run build

# Inicie o servidor (modo desenvolvimento)
npm run dev:sandbox

# Ou com PM2 (recomendado)
pm2 start ecosystem.config.cjs
pm2 logs clinica-inteligente --nostream
```

### **4. Testes**
```bash
# Teste a API
curl http://localhost:3000/api/professionals/1/stats
curl http://localhost:3000/api/courses
curl http://localhost:3000/api/protocols
```

---

## 🎨 Como Adicionar Novas Funcionalidades

### **Exemplo: Adicionar endpoint de "Prescrições"**

#### **1. Atualizar Database Schema**

Crie nova migration: `migrations/0002_add_prescriptions.sql`
```sql
CREATE TABLE prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultation_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  medications TEXT NOT NULL,  -- JSON
  dosage_instructions TEXT,
  duration_days INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_consultation ON prescriptions(consultation_id);
```

Aplicar migration:
```bash
npm run db:migrate:local
```

#### **2. Adicionar Types (TypeScript)**

Em `src/lib/types.ts`:
```typescript
export interface Prescription {
  id: number;
  consultation_id: number;
  patient_id: number;
  medications: string;
  dosage_instructions?: string;
  duration_days?: number;
  notes?: string;
  created_at: string;
}
```

#### **3. Criar API Endpoint**

Em `src/index.tsx`:
```typescript
// List prescriptions
app.get('/api/prescriptions', async (c) => {
  const { DB } = c.env
  const patientId = c.req.query('patient_id')
  
  const prescriptions = await DB.prepare(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC'
  ).bind(patientId).all()
  
  return c.json(prescriptions.results)
})

// Create prescription
app.post('/api/prescriptions', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO prescriptions (
      consultation_id, patient_id, medications,
      dosage_instructions, duration_days, notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    body.consultation_id, body.patient_id,
    JSON.stringify(body.medications),
    body.dosage_instructions, body.duration_days, body.notes
  ).run()
  
  return c.json({ id: result.meta.last_row_id, success: true })
})
```

#### **4. Atualizar Frontend**

Em `public/static/app.js`:
```javascript
// Função para carregar prescrições
async function loadPrescriptions(patientId) {
  const prescriptions = await apiFetch(`/prescriptions?patient_id=${patientId}`);
  
  const container = document.getElementById('prescriptions-list');
  container.innerHTML = prescriptions.map(p => `
    <div class="bg-white p-4 rounded-lg shadow">
      <h4 class="font-semibold">${new Date(p.created_at).toLocaleDateString()}</h4>
      <p>${p.dosage_instructions}</p>
    </div>
  `).join('');
}

// Função para criar prescrição
async function createPrescription(data) {
  const result = await apiFetch('/prescriptions', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  showNotification('Prescrição criada com sucesso!', 'success');
  return result;
}
```

#### **5. Rebuild e Teste**
```bash
npm run build
pm2 restart clinica-inteligente
curl http://localhost:3000/api/prescriptions?patient_id=1
```

---

## 🔐 Integrações Externas

### **Como Integrar OpenAI (exemplo)**

#### **1. Configurar API Key**

Em `.dev.vars` (desenvolvimento):
```
OPENAI_API_KEY=sk-...seu-key-aqui...
```

Em produção (Cloudflare):
```bash
wrangler secret put OPENAI_API_KEY
```

#### **2. Atualizar wrangler.jsonc**
```jsonc
{
  "vars": {
    "OPENAI_MODEL": "gpt-4-turbo-preview"
  }
}
```

#### **3. Criar Helper de IA**

Novo arquivo `src/lib/ai.ts`:
```typescript
export async function askOpenAI(prompt: string, env: any) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente clínico especializado em saúde integrativa.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

#### **4. Usar no Endpoint**
```typescript
import { askOpenAI } from './lib/ai'

app.post('/api/ai/chat', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  
  // Chamar OpenAI real
  const aiResponse = await askOpenAI(body.prompt, c.env)
  
  // Salvar interação
  await DB.prepare(`...`).bind(...).run()
  
  return c.json({ response: aiResponse })
})
```

---

## 📊 Performance & Otimizações

### **1. Database Indexing**
```sql
-- Sempre criar índices para colunas filtradas
CREATE INDEX idx_table_column ON table_name(column);

-- Índices compostos para queries complexas
CREATE INDEX idx_table_multi ON table_name(col1, col2);
```

### **2. Caching (Cloudflare)**
```typescript
// Cache de 1 hora para dados estáticos
app.get('/api/courses', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600')
  // ... rest of code
})
```

### **3. Lazy Loading no Frontend**
```javascript
// Carregar apenas quando necessário
async function loadDataOnDemand() {
  if (!AppState.courses.length) {
    AppState.courses = await apiFetch('/courses');
  }
  return AppState.courses;
}
```

---

## 🐛 Debugging

### **Backend (Wrangler)**
```bash
# Logs do servidor local
wrangler pages dev dist --d1=clinica-inteligente-production --local --show-interactive-dev-session

# Logs de produção
wrangler pages deployment tail
```

### **Frontend (Browser)**
```javascript
// No console do navegador
console.log('AppState:', window.AppState);
console.log('Cursos:', window.AppState.courses);
```

### **Database**
```bash
# Executar queries direto no D1
wrangler d1 execute clinica-inteligente-production --local --command="SELECT * FROM professionals"

# Console interativo
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
```

---

## 🚀 Deploy para Produção

### **1. Preparação**
```bash
# Build final
npm run build

# Verificar se não há erros
npm run preview
```

### **2. Criar D1 Database de Produção**
```bash
# Criar database
wrangler d1 create clinica-inteligente-production

# Copiar database_id gerado e atualizar wrangler.jsonc
```

### **3. Aplicar Migrations**
```bash
wrangler d1 migrations apply clinica-inteligente-production --remote
```

### **4. Deploy**
```bash
# Primeira vez
wrangler pages project create clinica-inteligente --production-branch main

# Deploys subsequentes
npm run deploy
```

### **5. Configurar Domínio (opcional)**
```bash
wrangler pages domain add seudominio.com.br --project-name clinica-inteligente
```

---

## 🧪 Testes (Futuro)

### **Unit Tests (Vitest)**
```typescript
// tests/api.test.ts
import { describe, it, expect } from 'vitest'

describe('API Professionals', () => {
  it('should return professional stats', async () => {
    const response = await fetch('/api/professionals/1/stats')
    const data = await response.json()
    expect(data).toHaveProperty('xp_points')
  })
})
```

### **E2E Tests (Playwright)**
```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test('dashboard loads correctly', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('#total-patients')).toBeVisible()
})
```

---

## 📚 Recursos Úteis

### **Documentação Oficial**
- [Hono](https://hono.dev/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### **Tutoriais Recomendados**
- [Building Edge Applications with Hono](https://hono.dev/getting-started/cloudflare-workers)
- [D1 Database Tutorial](https://developers.cloudflare.com/d1/get-started/)
- [TailwindCSS Components](https://tailwindui.com/)

---

## 🤝 Contribuindo

### **Padrões de Código**
- TypeScript strict mode
- ESLint + Prettier
- Commits semânticos (feat, fix, docs, refactor)
- Pull requests com testes

### **Git Workflow**
```bash
# Criar branch de feature
git checkout -b feature/nova-funcionalidade

# Commit com mensagem semântica
git commit -m "feat: adicionar endpoint de prescrições"

# Push e criar PR
git push origin feature/nova-funcionalidade
```

---

## 🆘 Troubleshooting Comum

### **Erro: "Migration failed"**
- Verifique sintaxe SQL
- Certifique-se de não usar palavras reservadas (ex: "references")
- Use `TEXT` em vez de `DATETIME` no D1

### **Erro: "CORS blocked"**
- Adicione `cors()` middleware no Hono
- Configure `Access-Control-Allow-Origin`

### **Erro: "Database locked"**
- Feche outras conexões ao D1
- Reinicie wrangler: `pm2 restart clinica-inteligente`

---

**Dúvidas? Contato: dev@clinicainteligente.com.br**

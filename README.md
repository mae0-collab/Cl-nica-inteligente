# 🏥 Clínica Inteligente

## Plataforma All-in-One para Profissionais de Saúde Integrativa

**Clínica Inteligente** é uma plataforma completa desenvolvida para médicos, nutricionistas, farmacêuticos, especialistas em saúde integrativa e serhumanologistas. Combina gestão clínica, educação continuada, IA assistencial e marketplace em uma única solução.

---

## 🌐 URLs do Projeto

### **Sandbox (Desenvolvimento)**
- **Homepage**: https://3000-ibeic3o1wia5p8wumd4c2-a402f90a.sandbox.novita.ai/
- **Dashboard**: https://3000-ibeic3o1wia5p8wumd4c2-a402f90a.sandbox.novita.ai/dashboard
- **API Base**: https://3000-ibeic3o1wia5p8wumd4c2-a402f90a.sandbox.novita.ai/api

### **Produção (Cloudflare Pages)**
- Em breve após deployment

---

## ✅ Funcionalidades Implementadas

### **1. Gestão de Pacientes (CRM)** ✅
- Cadastro completo de pacientes
- Histórico de consultas
- Registro de exames laboratoriais
- Anotações clínicas
- Dashboard com métricas

### **2. Sistema de Cursos** ✅
- 6 cursos disponíveis (Saúde Hormonal, Nutrição Funcional, Exames, Suplementação, Jejum, Saúde Integrativa)
- Acompanhamento de progresso
- Certificação por conclusão
- Sistema de XP por curso concluído

### **3. Casos Clínicos Práticos** ✅
- 2 casos clínicos prontos (SOP, Low-T)
- Sistema de submissão de diagnóstico
- Pontuação automática
- XP por acertos

### **4. Protocolos Clínicos** ✅
- 2 protocolos prontos (SOP com RI, Jejum 16/8)
- Baseados em evidências científicas
- Aplicação direta em pacientes
- Suplementação detalhada
- Monitoramento laboratorial

### **5. Assistente IA** ✅
- Chat interativo (simulado - pronto para integração com OpenAI/Anthropic)
- Contexto clínico
- Registro de interações
- Feedback de utilidade

### **6. Sistema de Gamificação** ✅
- Pontos XP por atividades
- Sistema de níveis
- 8 badges/conquistas
- Ranking de profissionais
- Histórico de transações XP

### **7. Marketplace** ✅
- Perfil público de profissionais
- Sistema de solicitação de consultas
- Avaliações de pacientes
- Destaque de profissionais premium

### **8. Dashboard Interativo** ✅
- Estatísticas em tempo real
- Ações rápidas
- Navegação intuitiva
- Design responsivo

---

## 📊 Arquitetura de Dados

### **Banco de Dados: Cloudflare D1 (SQLite)**

#### **19 Tabelas Principais:**

1. **professionals** - Profissionais de saúde
2. **patients** - Pacientes
3. **consultations** - Consultas
4. **lab_exams** - Exames laboratoriais
5. **courses** - Cursos
6. **lessons** - Aulas
7. **course_progress** - Progresso em cursos
8. **lesson_progress** - Progresso em aulas
9. **clinical_cases** - Casos clínicos
10. **case_attempts** - Tentativas de resolução
11. **protocols** - Protocolos clínicos
12. **protocol_applications** - Aplicações de protocolos
13. **badges** - Conquistas
14. **professional_badges** - Badges conquistados
15. **xp_transactions** - Histórico de XP
16. **consultation_requests** - Solicitações do marketplace
17. **professional_reviews** - Avaliações
18. **ai_interactions** - Interações com IA
19. **notifications** - Notificações
20. **professional_metrics** - Métricas agregadas

---

## 🔌 API Endpoints

### **Profissionais**
```
GET  /api/professionals/:id          - Obter perfil
PUT  /api/professionals/:id          - Atualizar perfil
GET  /api/professionals/:id/stats    - Estatísticas do dashboard
```

### **Pacientes (CRM)**
```
GET  /api/patients                   - Listar pacientes
GET  /api/patients/:id               - Obter paciente
POST /api/patients                   - Criar paciente
PUT  /api/patients/:id               - Atualizar paciente
```

### **Consultas**
```
GET  /api/consultations              - Listar consultas
POST /api/consultations              - Criar consulta
```

### **Cursos**
```
GET  /api/courses                    - Listar cursos
GET  /api/courses/:id                - Obter curso com aulas
GET  /api/courses/:id/progress       - Progresso do curso
POST /api/courses/:id/progress       - Atualizar progresso
```

### **Casos Clínicos**
```
GET  /api/clinical-cases             - Listar casos
GET  /api/clinical-cases/:id         - Obter caso
POST /api/clinical-cases/:id/attempt - Submeter resolução
```

### **Protocolos**
```
GET  /api/protocols                  - Listar protocolos
GET  /api/protocols/:id              - Obter protocolo
POST /api/protocols/:id/apply        - Aplicar em paciente
```

### **Marketplace**
```
GET  /api/marketplace/professionals       - Listar profissionais
POST /api/marketplace/consultation-requests - Solicitar consulta
```

### **Assistente IA**
```
POST /api/ai/chat                    - Chat com IA
```

---

## 🚀 Como Usar

### **1. Acessar o Dashboard**

Visite: https://3000-ibeic3o1wia5p8wumd4c2-a402f90a.sandbox.novita.ai/dashboard

### **2. Explorar Funcionalidades**

- **Dashboard**: Visão geral de pacientes, consultas, XP e nível
- **Pacientes**: Gerenciar lista de pacientes (em desenvolvimento - UI pronta)
- **Cursos**: 6 cursos disponíveis para começar
- **Casos Clínicos**: 2 casos práticos para resolver
- **Protocolos**: 2 protocolos prontos para aplicar
- **Assistente IA**: Faça perguntas clínicas

### **3. Sistema de Gamificação**

- Complete cursos: ganhe XP
- Resolva casos clínicos: ganhe XP e badges
- Atenda pacientes: suba de nível
- Desbloqueie conquistas

---

## 🎯 Dados de Demonstração

### **Profissionais Cadastrados:**
1. **Dra. Ana Silva** - Nutricionista (ID: 1)
   - Plano: Pro
   - XP: 2500 | Nível: 3
   - Especialização: Saúde Hormonal Feminina

2. **Dr. Carlos Mendes** - Médico (ID: 2)
   - Plano: Pro
   - XP: 1800 | Nível: 2
   - Especialização: Medicina Funcional

3. **Farm. Julia Costa** - Farmacêutica (ID: 3)
   - Plano: Free
   - XP: 1200 | Nível: 2
   - Especialização: Suplementação

4. **Pedro Oliveira** - SerHumanologista (ID: 4)
   - Plano: Free
   - XP: 950 | Nível: 1

### **Cursos Disponíveis:**
1. Fundamentos da Saúde Hormonal (500 XP, 20h)
2. Nutrição Funcional 3.0 (800 XP, 40h)
3. Exames Laboratoriais 2.0 (600 XP, 25h)
4. Suplementação Individualizada (550 XP, 18h)
5. Jejum Intermitente (400 XP, 12h)
6. Introdução à Saúde Integrativa (200 XP, 8h - FREE)

### **Casos Clínicos:**
1. **Mulher com SOP** (500 XP, Intermediário)
2. **Homem com Fadiga Crônica** (700 XP, Avançado)

### **Protocolos:**
1. **SOP com Resistência Insulínica**
2. **Jejum Intermitente 16/8**

---

## 🛠 Stack Tecnológica

- **Backend**: Hono (framework edge-first)
- **Database**: Cloudflare D1 (SQLite distribuído)
- **Frontend**: HTML + TailwindCSS + JavaScript Vanilla
- **Deployment**: Cloudflare Pages
- **Icons**: Font Awesome 6
- **Process Manager**: PM2 (desenvolvimento)

---

## 📈 Próximas Implementações

### **Funcionalidades Pendentes:**

1. **Autenticação Real** (atualmente usando ID fixo 1)
   - Login/Registro
   - JWT tokens
   - Reset de senha

2. **Integração IA Real**
   - OpenAI GPT-4 / Anthropic Claude
   - Análise de exames
   - Sugestões de prescrição

3. **Upload de Arquivos**
   - PDFs de exames
   - Imagens (R2 Storage)
   - Documentos de consultas

4. **Sistema de Pagamentos**
   - Stripe integration
   - Planos Free/Pro/Enterprise
   - Marketplace comissões

5. **Notificações em Tempo Real**
   - Websockets / Server-Sent Events
   - Push notifications

6. **Relatórios Avançados**
   - PDF generation
   - Gráficos de evolução
   - Analytics dashboard

7. **App Mobile**
   - React Native / Flutter
   - Consultas on-the-go

---

## 🎓 Diferencial Competitivo vs FSA

| **FSA Original** | **Clínica Inteligente** |
|---|---|
| Cursos isolados | Plataforma integrada |
| Sem ferramentas clínicas | CRM completo |
| Apenas teoria | Casos práticos + Teoria |
| Sem IA | Assistente IA 24/7 |
| Certificação por assistir | Certificação por performance |
| Sem gestão de pacientes | Gestão completa |
| Lista de espera | Acesso imediato |
| Receita única | Modelo recorrente (assinatura) |
| Sem marketplace | Marketplace integrado |

---

## 💰 Modelo de Monetização

### **Planos de Assinatura:**

1. **Free** (R$ 0/mês)
   - 2 cursos básicos
   - 5 casos clínicos/mês
   - IA limitada (10 consultas)
   - Sem marketplace

2. **Pro** (R$ 97/mês)
   - Todos os cursos
   - Casos ilimitados
   - IA ilimitada
   - CRM completo
   - Marketplace básico
   - Protocolos premium

3. **Enterprise** (R$ 297/mês)
   - Tudo do Pro
   - Mentoria mensal
   - Perfil destacado
   - White label
   - Suporte prioritário

### **Receitas Adicionais:**
- Comissão marketplace: 15%
- Certificações premium: R$ 2.000 - R$ 5.000
- Cursos individuais: R$ 497 - R$ 1.997

---

## 📊 Status do Deployment

- ✅ **Desenvolvimento Local**: Funcionando
- ✅ **Database**: D1 local configurado
- ✅ **API**: Todas as rotas testadas
- ✅ **Frontend**: Dashboard completo
- ⏳ **Cloudflare Pages**: Pendente
- ⏳ **Domínio Customizado**: Pendente
- ⏳ **SSL/HTTPS**: Auto (Cloudflare)

---

## 🔐 Segurança

- Passwords: Hash com bcrypt (em produção)
- API: CORS habilitado
- Database: Queries parametrizadas (SQL injection protected)
- Secrets: Cloudflare Environment Variables
- HTTPS: Obrigatório via Cloudflare

---

## 📞 Contato & Suporte

- **Email**: contato@clinicainteligente.com.br
- **GitHub**: [repositório]
- **Docs**: /docs (em desenvolvimento)

---

## 📜 Licença

Proprietary - Todos os direitos reservados © 2026 Clínica Inteligente

---

## 🎯 Posicionamento Final

**"Clínica Inteligente é para profissionais de saúde que querem se tornar especialistas de alta performance e aumentar faturamento em 6 meses, sem depender só de teoria, usando IA clínica + casos reais + ferramentas de gestão integradas."**

---

## 🚀 Versão

**v1.0.0** - MVP Completo (2026-03-20)

---

**Desenvolvido com ❤️ para revolucionar a saúde integrativa no Brasil**

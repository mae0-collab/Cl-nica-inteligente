// ============================================================
// CLÍNICA INTELIGENTE - BACKEND PRINCIPAL
// Hono + TypeScript + Cloudflare D1
// ============================================================

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Env } from './lib/types'

// Routes
import authRoutes from './routes/auth'
import professionalRoutes from './routes/professionals'
import patientRoutes from './routes/patients'
import consultationRoutes from './routes/consultations'
import courseRoutes from './routes/courses'
import clinicalCaseRoutes from './routes/clinical-cases'
import protocolRoutes from './routes/protocols'
import aiRoutes from './routes/ai'
import marketplaceRoutes from './routes/marketplace'
import clinicalIntelligenceRoutes from './routes/clinical-intelligence'

const app = new Hono<Env>()

// ============================================================
// CORS - apenas origens controladas
// ============================================================
app.use('/api/*', cors({
  origin: (origin) => {
    // Em produção, restringir ao domínio real
    // Exemplo: return origin === 'https://clinicainteligente.com.br' ? origin : null
    return origin || '*'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// ============================================================
// ARQUIVOS ESTÁTICOS
// ============================================================
app.use('/static/*', serveStatic({ root: './public' }))

// ============================================================
// DOWNLOAD DO PROJETO (apenas em desenvolvimento)
// ============================================================
app.get('/download/projeto', async (c) => {
  // Ler o arquivo ZIP diretamente do filesystem via fetch interno
  try {
    const zipContent = await fetch(new URL('/clinica-inteligente-v2-completo.zip', c.req.url).toString())
    if (zipContent.ok) {
      const blob = await zipContent.arrayBuffer()
      return new Response(blob, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="clinica-inteligente-v2-completo.zip"',
        }
      })
    }
  } catch {}
  return c.json({ error: 'Arquivo não disponível via servidor. Acesse diretamente: /clinica-inteligente-v2-completo.zip' }, 404)
})

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT ?? 'unknown',
  })
})

// ============================================================
// ROTAS DA API - Montagem modular
// ============================================================
app.route('/api/auth', authRoutes)
app.route('/api/professionals', professionalRoutes)
app.route('/api/patients', patientRoutes)
app.route('/api/consultations', consultationRoutes)
app.route('/api/courses', courseRoutes)
app.route('/api/clinical-cases', clinicalCaseRoutes)
app.route('/api/protocols', protocolRoutes)
app.route('/api/ai', aiRoutes)
app.route('/api/marketplace', marketplaceRoutes)
app.route('/api/clinical', clinicalIntelligenceRoutes)

// ============================================================
// PÁGINA DE LOGIN
// ============================================================
app.get('/login', (c) => {
  return c.html(buildLoginPage())
})

app.get('/register', (c) => {
  return c.html(buildRegisterPage())
})

// ============================================================
// DASHBOARD (requer autenticação via JS)
// ============================================================
app.get('/dashboard', (c) => {
  return c.html(buildDashboardPage())
})

// ============================================================
// MARKETPLACE (página pública)
// ============================================================
app.get('/marketplace', (c) => {
  return c.html(buildMarketplacePage())
})

// ============================================================
// HOME
// ============================================================
app.get('/', (c) => {
  return c.html(buildHomePage())
})

// ============================================================
// 404 HANDLER
// ============================================================
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Endpoint não encontrado', code: 'NOT_FOUND' }, 404)
  }
  return c.redirect('/')
})

// ============================================================
// ERROR HANDLER GLOBAL
// ============================================================
app.onError((err, c) => {
  console.error('Unhandled error:', err.message, err.stack)
  if (c.req.path.startsWith('/api/')) {
    return c.json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
    }, 500)
  }
  return c.text('Erro interno do servidor', 500)
})

// ============================================================
// PÁGINAS HTML
// ============================================================

function buildLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Clínica Inteligente</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-purple-50 to-blue-50 min-h-screen flex items-center justify-center">
  <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-5xl text-purple-600 mb-3"><i class="fas fa-heartbeat"></i></div>
      <h1 class="text-2xl font-bold text-gray-800">Clínica Inteligente</h1>
      <p class="text-gray-500 mt-1">Acesse sua conta profissional</p>
    </div>

    <div id="error-alert" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm"></div>

    <form id="login-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" id="email" required
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="seu@email.com">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Senha</label>
        <div class="relative">
          <input type="password" id="password" required
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Sua senha">
          <button type="button" onclick="togglePassword()"
            class="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
            <i class="fas fa-eye" id="eye-icon"></i>
          </button>
        </div>
      </div>
      <button type="submit" id="submit-btn"
        class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2">
        <span id="btn-text">Entrar</span>
        <i id="btn-spinner" class="fas fa-spinner fa-spin hidden"></i>
      </button>
    </form>

    <p class="text-center text-sm text-gray-500 mt-6">
      Não tem conta?
      <a href="/register" class="text-purple-600 hover:underline font-medium">Criar conta gratuita</a>
    </p>
  </div>

  <script>
    // Verificar se já está autenticado
    const existingToken = localStorage.getItem('ci_token');
    if (existingToken) window.location.href = '/dashboard';

    function togglePassword() {
      const input = document.getElementById('password');
      const icon = document.getElementById('eye-icon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
      }
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const btnText = document.getElementById('btn-text');
      const spinner = document.getElementById('btn-spinner');
      const errorAlert = document.getElementById('error-alert');

      btn.disabled = true;
      btnText.textContent = 'Entrando...';
      spinner.classList.remove('hidden');
      errorAlert.classList.add('hidden');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
          })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao fazer login');
        }

        localStorage.setItem('ci_token', data.token);
        localStorage.setItem('ci_professional', JSON.stringify(data.professional));
        window.location.href = '/dashboard';
      } catch (err) {
        errorAlert.textContent = err.message;
        errorAlert.classList.remove('hidden');
        btn.disabled = false;
        btnText.textContent = 'Entrar';
        spinner.classList.add('hidden');
      }
    });
  </script>
</body>
</html>`
}

function buildRegisterPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Criar Conta - Clínica Inteligente</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-purple-50 to-blue-50 min-h-screen flex items-center justify-center py-8">
  <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
    <div class="text-center mb-8">
      <div class="text-5xl text-purple-600 mb-3"><i class="fas fa-heartbeat"></i></div>
      <h1 class="text-2xl font-bold text-gray-800">Criar Conta</h1>
      <p class="text-gray-500 mt-1">Plataforma para profissionais de saúde</p>
    </div>

    <div id="error-alert" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm"></div>
    <div id="success-alert" class="hidden bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm"></div>

    <form id="register-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
        <input type="text" id="name" required
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Dr. João da Silva">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <input type="email" id="email" required
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="seu@email.com">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Especialidade *</label>
        <select id="specialty" required
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">Selecione sua especialidade</option>
          <option value="medico">Médico(a)</option>
          <option value="nutricionista">Nutricionista</option>
          <option value="farmaceutico">Farmacêutico(a)</option>
          <option value="serumanologista">SerHumanologista</option>
          <option value="saude_integrativa">Saúde Integrativa</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Número de Registro (CRM/CRN/CRF)</label>
        <input type="text" id="registration_number"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="CRM 12345/SP">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
        <input type="password" id="password" required
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Mínimo 8 caracteres, 1 maiúscula e 1 número">
        <p class="text-xs text-gray-400 mt-1">Mínimo 8 caracteres, com ao menos 1 letra maiúscula e 1 número</p>
      </div>
      <button type="submit" id="submit-btn"
        class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2">
        <span id="btn-text">Criar Conta Gratuita</span>
        <i id="btn-spinner" class="fas fa-spinner fa-spin hidden"></i>
      </button>
    </form>

    <p class="text-center text-sm text-gray-500 mt-6">
      Já tem conta?
      <a href="/login" class="text-purple-600 hover:underline font-medium">Fazer login</a>
    </p>
  </div>

  <script>
    const existingToken = localStorage.getItem('ci_token');
    if (existingToken) window.location.href = '/dashboard';

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const btnText = document.getElementById('btn-text');
      const spinner = document.getElementById('btn-spinner');
      const errorAlert = document.getElementById('error-alert');
      const successAlert = document.getElementById('success-alert');

      btn.disabled = true;
      btnText.textContent = 'Criando conta...';
      spinner.classList.remove('hidden');
      errorAlert.classList.add('hidden');
      successAlert.classList.add('hidden');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            specialty: document.getElementById('specialty').value,
            registration_number: document.getElementById('registration_number').value || undefined,
            password: document.getElementById('password').value,
          })
        });

        const data = await res.json();

        if (!res.ok) {
          const errMsg = data.details
            ? Object.values(data.details).flat().join(', ')
            : data.error;
          throw new Error(errMsg || 'Erro ao criar conta');
        }

        localStorage.setItem('ci_token', data.token);
        localStorage.setItem('ci_professional', JSON.stringify(data.professional));

        successAlert.textContent = 'Conta criada com sucesso! Redirecionando...';
        successAlert.classList.remove('hidden');

        setTimeout(() => window.location.href = '/dashboard', 1500);
      } catch (err) {
        errorAlert.textContent = err.message;
        errorAlert.classList.remove('hidden');
        btn.disabled = false;
        btnText.textContent = 'Criar Conta Gratuita';
        spinner.classList.add('hidden');
      }
    });
  </script>
</body>
</html>`
}

function buildDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Clínica Inteligente</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100">
  <!-- Auth check overlay -->
  <div id="auth-check" class="fixed inset-0 bg-white flex items-center justify-center z-50">
    <div class="text-center">
      <i class="fas fa-spinner fa-spin text-purple-600 text-4xl mb-3"></i>
      <p class="text-gray-600">Verificando autenticação...</p>
    </div>
  </div>

  <div class="flex h-screen" id="main-app" style="display:none!important">
    <!-- Sidebar -->
    <div class="w-64 bg-gradient-to-b from-purple-600 to-purple-800 text-white flex flex-col">
      <div class="p-6 border-b border-purple-500">
        <h1 class="text-xl font-bold"><i class="fas fa-heartbeat mr-2"></i>Clínica Inteligente</h1>
        <p id="sidebar-name" class="text-sm text-purple-200 mt-1 truncate"></p>
      </div>
      <nav class="flex-1 p-4">
        <a onclick="showView('dashboard')" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer bg-purple-700" id="nav-dashboard">
          <i class="fas fa-home mr-3"></i>Dashboard
        </a>
        <a onclick="showView('patients'); loadPatients()" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer" id="nav-patients">
          <i class="fas fa-users mr-3"></i>Pacientes
        </a>
        <a onclick="showView('courses'); loadCourses()" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer" id="nav-courses">
          <i class="fas fa-graduation-cap mr-3"></i>Cursos
        </a>
        <a onclick="showView('cases'); loadClinicalCases()" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer" id="nav-cases">
          <i class="fas fa-briefcase-medical mr-3"></i>Casos Clínicos
        </a>
        <a onclick="showView('protocols'); loadProtocols()" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer" id="nav-protocols">
          <i class="fas fa-file-medical mr-3"></i>Protocolos
        </a>
        <a onclick="showView('ai'); AIReport.renderPanel()" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer" id="nav-ai">
          <i class="fas fa-robot mr-3"></i>Assistente IA
        </a>
        <a onclick="showView('hemograma'); HemogramaSimulator.render()" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer" id="nav-hemograma">
          <i class="fas fa-tint mr-3"></i>Hemograma / FSA
        </a>
        <a href="/marketplace" class="nav-link flex items-center p-3 rounded-lg mb-2 hover:bg-purple-700 cursor-pointer">
          <i class="fas fa-store mr-3"></i>Marketplace
        </a>
      </nav>
      <div class="p-4 border-t border-purple-500">
        <div class="flex items-center mb-2">
          <i class="fas fa-star text-yellow-400 mr-2"></i>
          <span>Nível </span><span id="current-level" class="font-bold ml-1">1</span>
        </div>
        <div class="flex items-center mb-3">
          <i class="fas fa-trophy text-yellow-400 mr-2"></i>
          <span id="xp-points" class="font-bold">0</span><span class="ml-1">XP</span>
        </div>
        <button onclick="logout()" class="w-full text-left flex items-center p-2 rounded-lg hover:bg-purple-700 text-purple-200 text-sm">
          <i class="fas fa-sign-out-alt mr-2"></i>Sair
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-auto">
      <header class="bg-white shadow-sm p-4 flex justify-between items-center">
        <h2 id="page-title" class="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div class="flex items-center gap-4">
          <span class="text-sm">Plano: <span id="plan-type" class="font-semibold text-purple-600">Free</span></span>
          <button class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm">
            <i class="fas fa-user mr-1"></i><span id="header-name">Perfil</span>
          </button>
        </div>
      </header>

      <!-- Dashboard View -->
      <div id="view-dashboard" class="view-section p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500 text-sm">Total de Pacientes</p>
            <p id="total-patients" class="text-3xl font-bold text-gray-800">—</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500 text-sm">Consultas Realizadas</p>
            <p id="total-consultations" class="text-3xl font-bold text-gray-800">—</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500 text-sm">Cursos Concluídos</p>
            <p id="courses-completed" class="text-3xl font-bold text-gray-800">—</p>
          </div>
          <div class="bg-white p-6 rounded-lg shadow">
            <p class="text-gray-500 text-sm">Pontos XP</p>
            <p id="xp-points-card" class="text-3xl font-bold text-gray-800">—</p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-xl font-bold mb-4">Ações Rápidas</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onclick="showView('patients'); loadPatients()" class="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-center">
              <i class="fas fa-user-plus text-3xl text-purple-600 mb-2 block"></i>
              <p class="font-semibold">Pacientes</p>
            </button>
            <button onclick="showView('courses'); loadCourses()" class="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-center">
              <i class="fas fa-book-open text-3xl text-purple-600 mb-2 block"></i>
              <p class="font-semibold">Cursos</p>
            </button>
            <button onclick="showView('cases'); loadClinicalCases()" class="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-center">
              <i class="fas fa-stethoscope text-3xl text-purple-600 mb-2 block"></i>
              <p class="font-semibold">Casos Clínicos</p>
            </button>
            <button onclick="showView('ai'); AIReport.renderPanel()" class="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-center">
              <i class="fas fa-robot text-3xl text-purple-600 mb-2 block"></i>
              <p class="font-semibold">Assistente IA</p>
            </button>
          </div>
        </div>
      </div>

      <!-- Patients View -->
      <div id="view-patients" class="view-section p-6 hidden">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Meus Pacientes</h3>
          <button onclick="showAddPatientModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            <i class="fas fa-plus mr-2"></i>Novo Paciente
          </button>
        </div>
        <div id="patients-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <p class="text-gray-500">Carregando pacientes...</p>
        </div>
      </div>

      <!-- Courses View -->
      <div id="view-courses" class="view-section p-6 hidden">
        <h3 class="text-xl font-bold mb-6">Cursos Disponíveis</h3>
        <div id="courses-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <p class="text-gray-500">Carregando cursos...</p>
        </div>
      </div>

      <!-- Clinical Cases View -->
      <div id="view-cases" class="view-section p-6 hidden">
        <h3 class="text-xl font-bold mb-6">Casos Clínicos</h3>
        <div id="cases-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <p class="text-gray-500">Carregando casos...</p>
        </div>
      </div>

      <!-- Protocols View -->
      <div id="view-protocols" class="view-section p-6 hidden">
        <h3 class="text-xl font-bold mb-6">Protocolos Clínicos</h3>
        <div id="protocols-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <p class="text-gray-500">Carregando protocolos...</p>
        </div>
      </div>

      <!-- AI View -->
      <div id="view-ai" class="view-section p-6 hidden">
        <div class="max-w-4xl mx-auto space-y-6">
          <h3 class="text-xl font-bold">Assistente IA</h3>

          <!-- Tabs de navegação -->
          <div class="flex gap-2 border-b border-gray-200">
            <button id="ai-tab-lab" onclick="switchAITab('lab')"
              class="px-4 py-2 text-sm font-semibold text-purple-700 border-b-2 border-purple-600 -mb-px">
              <i class="fas fa-flask mr-1"></i>Análise Laboratorial
            </button>
            <button id="ai-tab-chat" onclick="switchAITab('chat')"
              class="px-4 py-2 text-sm font-semibold text-gray-500 border-b-2 border-transparent -mb-px hover:text-purple-600">
              <i class="fas fa-comments mr-1"></i>Chat Livre
            </button>
          </div>

          <!-- Painel: Análise Laboratorial com IA -->
          <div id="ai-panel-lab">
            <div id="ai-mode-banner" class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800 hidden">
              <i class="fas fa-info-circle mr-2"></i>Modo demonstração ativo. Configure OPENAI_API_KEY para relatórios com IA real.
            </div>
            <!-- O painel é injetado aqui pelo AIReport.renderPanel() -->
            <div id="ai-lab-panel"></div>
          </div>

          <!-- Painel: Chat Livre -->
          <div id="ai-panel-chat" class="hidden">
            <div id="ai-chat" class="bg-white rounded-lg shadow p-4 h-96 overflow-y-auto mb-4 flex flex-col gap-3">
              <div class="bg-purple-50 rounded-lg p-3 text-sm">
                <strong>IA:</strong> Olá! Sou o assistente clínico. Como posso ajudar com suas dúvidas sobre saúde integrativa?
              </div>
            </div>
            <div class="flex gap-2">
              <select id="ai-context" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="general_question">Pergunta geral</option>
                <option value="case_analysis">Análise de caso</option>
                <option value="lab_interpretation">Interpretação de exames</option>
                <option value="protocol_suggestion">Sugestão de protocolo</option>
                <option value="supplement_recommendation">Suplementação</option>
              </select>
              <input type="text" id="ai-input" placeholder="Digite sua pergunta clínica..."
                class="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
              <button onclick="sendAIMessage()" id="ai-send-btn"
                class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

      <!-- VIEW: Hemograma / FSA Simulator -->
      <div id="view-hemograma" class="view-section p-6 hidden">
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center gap-3 mb-6">
            <div class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <i class="fas fa-tint text-red-600 text-lg"></i>
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Simulador de Hemograma / FSA</h3>
              <p class="text-sm text-gray-500">Interpretação clínica com IA — Série Vermelha, Leucograma e Fórmula Sanguínea Ampliada</p>
            </div>
          </div>
          <!-- Painel injetado pelo HemogramaSimulator.render() -->
          <div id="hemograma-panel"></div>
        </div>
      </div>

  <!-- Modal: Novo Paciente -->
  <div id="modal-patient" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
      <h3 class="text-xl font-bold mb-4">Novo Paciente</h3>
      <form id="patient-form" class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700">Nome *</label>
          <input type="text" id="pt-name" required class="w-full border rounded-lg px-3 py-2 mt-1">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" id="pt-email" class="w-full border rounded-lg px-3 py-2 mt-1">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Telefone</label>
            <input type="text" id="pt-phone" class="w-full border rounded-lg px-3 py-2 mt-1">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Data de Nascimento</label>
            <input type="date" id="pt-birth" class="w-full border rounded-lg px-3 py-2 mt-1">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Gênero</label>
            <select id="pt-gender" class="w-full border rounded-lg px-3 py-2 mt-1">
              <option value="">Selecionar</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700">Peso (kg)</label>
            <input type="number" id="pt-weight" step="0.1" class="w-full border rounded-lg px-3 py-2 mt-1">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Altura (cm)</label>
            <input type="number" id="pt-height" class="w-full border rounded-lg px-3 py-2 mt-1">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Tipo Sanguíneo</label>
            <select id="pt-blood" class="w-full border rounded-lg px-3 py-2 mt-1">
              <option value="">-</option>
              <option>A+</option><option>A-</option>
              <option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option>
              <option>O+</option><option>O-</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Observações</label>
          <textarea id="pt-notes" rows="3" class="w-full border rounded-lg px-3 py-2 mt-1"></textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closePatientModal()" class="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
            Salvar Paciente
          </button>
        </div>
      </form>
    </div>
  </div>

  <script src="/static/app.js"></script>
</body>
</html>`
}

function buildMarketplacePage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marketplace - Clínica Inteligente</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
  <header class="bg-white shadow-sm py-4 px-6 flex justify-between items-center">
    <a href="/" class="text-xl font-bold text-purple-600">
      <i class="fas fa-heartbeat mr-2"></i>Clínica Inteligente
    </a>
    <div class="flex gap-3">
      <a href="/login" class="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50">Entrar</a>
      <a href="/register" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Criar Conta</a>
    </div>
  </header>

  <div class="max-w-6xl mx-auto px-6 py-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">Encontre Profissionais de Saúde</h1>
      <p class="text-gray-600">Conecte-se com especialistas em saúde integrativa</p>
    </div>

    <div class="flex gap-4 mb-6">
      <select id="specialty-filter"
        onchange="loadMarketplace()"
        class="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
        <option value="">Todas as especialidades</option>
        <option value="medico">Médico(a)</option>
        <option value="nutricionista">Nutricionista</option>
        <option value="farmaceutico">Farmacêutico(a)</option>
        <option value="serumanologista">SerHumanologista</option>
        <option value="saude_integrativa">Saúde Integrativa</option>
      </select>
    </div>

    <div id="professionals-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <p class="text-gray-500 col-span-3 text-center py-8">Carregando profissionais...</p>
    </div>
  </div>

  <!-- Modal: Solicitar Consulta -->
  <div id="modal-request" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 w-full max-w-md">
      <h3 class="text-xl font-bold mb-4">Solicitar Consulta</h3>
      <p id="request-professional-name" class="text-purple-600 font-semibold mb-4"></p>
      <form id="request-form" class="space-y-3">
        <input type="hidden" id="req-professional-id">
        <div>
          <label class="block text-sm font-medium text-gray-700">Seu nome *</label>
          <input type="text" id="req-name" required class="w-full border rounded-lg px-3 py-2 mt-1">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Seu email *</label>
          <input type="email" id="req-email" required class="w-full border rounded-lg px-3 py-2 mt-1">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Telefone</label>
          <input type="text" id="req-phone" class="w-full border rounded-lg px-3 py-2 mt-1">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Data preferida</label>
          <input type="date" id="req-date" class="w-full border rounded-lg px-3 py-2 mt-1">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Mensagem</label>
          <textarea id="req-message" rows="3" class="w-full border rounded-lg px-3 py-2 mt-1" placeholder="Descreva brevemente seu caso..."></textarea>
        </div>
        <div id="request-error" class="hidden text-red-600 text-sm"></div>
        <div id="request-success" class="hidden text-green-600 text-sm"></div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeRequestModal()" class="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
            Enviar Solicitação
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    async function loadMarketplace() {
      const specialty = document.getElementById('specialty-filter').value;
      const container = document.getElementById('professionals-list');
      container.innerHTML = '<p class="text-gray-500 col-span-3 text-center py-8">Carregando...</p>';

      try {
        let url = '/api/marketplace/professionals';
        if (specialty) url += '?specialty=' + encodeURIComponent(specialty);

        const res = await fetch(url);
        const professionals = await res.json();

        if (!professionals.length) {
          container.innerHTML = '<p class="text-gray-500 col-span-3 text-center py-8">Nenhum profissional disponível.</p>';
          return;
        }

        const specialtyLabels = {
          medico: 'Médico(a)',
          nutricionista: 'Nutricionista',
          farmaceutico: 'Farmacêutico(a)',
          serumanologista: 'SerHumanologista',
          saude_integrativa: 'Saúde Integrativa'
        };

        container.innerHTML = professionals.map(p => \`
          <div class="bg-white rounded-xl shadow hover:shadow-lg transition p-6">
            <div class="flex items-start gap-4 mb-4">
              <div class="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-2xl text-purple-600 font-bold flex-shrink-0">
                \${p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 class="font-bold text-lg">\${p.name}</h3>
                <span class="text-sm text-purple-600 font-medium">\${specialtyLabels[p.specialty] || p.specialty}</span>
                \${p.registration_number ? '<p class="text-xs text-gray-400 mt-0.5">'+p.registration_number+'</p>' : ''}
              </div>
            </div>
            <p class="text-gray-600 text-sm mb-4 line-clamp-3">\${p.bio || 'Profissional de saúde integrativa.'}</p>
            <div class="flex justify-between items-center mb-4 text-sm text-gray-500">
              <span><i class="fas fa-star text-yellow-400 mr-1"></i>\${p.rating_average?.toFixed(1) || '—'}</span>
              <span><i class="fas fa-calendar mr-1"></i>\${p.total_consultations || 0} consultas</span>
              \${p.consultation_price ? '<span class="font-semibold text-green-600">R$ \${p.consultation_price.toFixed(2)}</span>' : '<span class="text-gray-400">Sob consulta</span>'}
            </div>
            <button onclick="openRequestModal(\${p.id}, '\${p.name.replace(/'/g, '')}')"
              class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition">
              <i class="fas fa-calendar-plus mr-2"></i>Solicitar Consulta
            </button>
          </div>
        \`).join('');
      } catch (err) {
        container.innerHTML = '<p class="text-red-500 col-span-3 text-center py-8">Erro ao carregar profissionais.</p>';
      }
    }

    function openRequestModal(professionalId, professionalName) {
      document.getElementById('req-professional-id').value = professionalId;
      document.getElementById('request-professional-name').textContent = 'com ' + professionalName;
      document.getElementById('request-error').classList.add('hidden');
      document.getElementById('request-success').classList.add('hidden');
      document.getElementById('modal-request').classList.remove('hidden');
    }

    function closeRequestModal() {
      document.getElementById('modal-request').classList.add('hidden');
      document.getElementById('request-form').reset();
    }

    document.getElementById('request-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('request-error');
      const succEl = document.getElementById('request-success');
      errEl.classList.add('hidden');
      succEl.classList.add('hidden');

      try {
        const res = await fetch('/api/marketplace/consultation-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            professional_id: parseInt(document.getElementById('req-professional-id').value),
            patient_name: document.getElementById('req-name').value,
            patient_email: document.getElementById('req-email').value,
            patient_phone: document.getElementById('req-phone').value || null,
            preferred_date: document.getElementById('req-date').value || null,
            message: document.getElementById('req-message').value || null,
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao enviar');

        succEl.textContent = 'Solicitação enviada com sucesso!';
        succEl.classList.remove('hidden');
        document.getElementById('request-form').reset();
        setTimeout(closeRequestModal, 2000);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });

    // Carregar ao entrar na página
    loadMarketplace();
  </script>
</body>
</html>`
}

function buildHomePage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clínica Inteligente - Plataforma para Profissionais de Saúde</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-white">
  <header class="bg-white shadow-sm py-4 px-6 flex justify-between items-center">
    <div class="text-xl font-bold text-purple-600">
      <i class="fas fa-heartbeat mr-2"></i>Clínica Inteligente
    </div>
    <div class="flex gap-3">
      <a href="/marketplace" class="px-4 py-2 text-gray-600 hover:text-purple-600">Marketplace</a>
      <a href="/login" class="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50">Entrar</a>
      <a href="/register" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Criar Conta Grátis</a>
    </div>
  </header>

  <main>
    <section class="bg-gradient-to-br from-purple-600 to-purple-800 text-white py-20 px-6 text-center">
      <h1 class="text-4xl md:text-5xl font-bold mb-4">Plataforma Completa para<br>Profissionais de Saúde Integrativa</h1>
      <p class="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
        CRM de Pacientes · Cursos · Casos Clínicos · Protocolos · Assistente IA
      </p>
      <a href="/register" class="bg-white text-purple-700 font-bold px-8 py-4 rounded-xl text-lg hover:bg-purple-50 transition shadow-lg inline-block">
        Começar Grátis <i class="fas fa-arrow-right ml-2"></i>
      </a>
    </section>

    <section class="py-16 px-6 max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="text-center p-6">
          <div class="text-5xl text-purple-600 mb-4"><i class="fas fa-users"></i></div>
          <h3 class="text-xl font-bold mb-2">CRM de Pacientes</h3>
          <p class="text-gray-600">Gerencie seus pacientes com prontuários completos, histórico de consultas e exames laboratoriais.</p>
        </div>
        <div class="text-center p-6">
          <div class="text-5xl text-purple-600 mb-4"><i class="fas fa-graduation-cap"></i></div>
          <h3 class="text-xl font-bold mb-2">Cursos e Formação</h3>
          <p class="text-gray-600">Acesse cursos especializados em saúde integrativa, nutrição funcional e medicina integrativa.</p>
        </div>
        <div class="text-center p-6">
          <div class="text-5xl text-purple-600 mb-4"><i class="fas fa-robot"></i></div>
          <h3 class="text-xl font-bold mb-2">Assistente IA</h3>
          <p class="text-gray-600">Assistente clínico inteligente para auxiliar em análises, protocolos e interpretação de exames.</p>
        </div>
      </div>
    </section>
  </main>

  <footer class="bg-gray-800 text-gray-400 py-8 px-6 text-center">
    <p>&copy; 2026 Clínica Inteligente. Todos os direitos reservados.</p>
  </footer>

  <script>
    const token = localStorage.getItem('ci_token');
    if (token) {
      document.querySelector('a[href="/login"]').href = '/dashboard';
      document.querySelector('a[href="/login"]').textContent = 'Meu Dashboard';
    }
  </script>
</body>
</html>`
}

export default app

// ============================================================
// CLÍNICA INTELIGENTE - FRONTEND APPLICATION v2.0
// Com autenticação JWT real
// ============================================================

const API_BASE = '/api';

// -------------------------------------------------------
// AUTH STATE
// -------------------------------------------------------
const Auth = {
  token: null,
  professional: null,

  init() {
    this.token = localStorage.getItem('ci_token');
    try {
      const stored = localStorage.getItem('ci_professional');
      this.professional = stored ? JSON.parse(stored) : null;
    } catch {
      this.professional = null;
    }
  },

  isAuthenticated() {
    return !!this.token;
  },

  logout() {
    localStorage.removeItem('ci_token');
    localStorage.removeItem('ci_professional');
    this.token = null;
    this.professional = null;
    window.location.href = '/login';
  },

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
    };
  }
};

// -------------------------------------------------------
// ESTADO GLOBAL
// -------------------------------------------------------
const AppState = {
  currentView: 'dashboard',
  patients: [],
  courses: [],
  protocols: [],
};

// -------------------------------------------------------
// API FETCH COM AUTH
// -------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...Auth.getHeaders(),
        ...(options.headers || {}),
      },
    });

    // Token expirado ou inválido
    if (response.status === 401) {
      Auth.logout();
      return null;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    showNotification(error.message || 'Erro ao carregar dados', 'error');
    throw error;
  }
}

// -------------------------------------------------------
// NOTIFICAÇÕES
// -------------------------------------------------------
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all ${
    type === 'success' ? 'bg-green-500' : 'bg-red-500'
  } text-white max-w-sm`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3500);
}

// -------------------------------------------------------
// NAVEGAÇÃO
// -------------------------------------------------------
function showView(viewName) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('bg-purple-700'));

  const view = document.getElementById(`view-${viewName}`);
  const nav = document.getElementById(`nav-${viewName}`);

  if (view) view.classList.remove('hidden');
  if (nav) nav.classList.add('bg-purple-700');

  const titles = {
    dashboard: 'Dashboard',
    patients: 'Pacientes',
    courses: 'Cursos',
    cases: 'Casos Clínicos',
    protocols: 'Protocolos',
    ai: 'Assistente IA',
  };

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = titles[viewName] || viewName;

  AppState.currentView = viewName;
}

// -------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------
async function loadDashboardStats() {
  try {
    const stats = await apiFetch('/professionals/me/stats');
    if (!stats) return;

    document.getElementById('total-patients').textContent = stats.total_patients ?? 0;
    document.getElementById('total-consultations').textContent = stats.total_consultations ?? 0;
    document.getElementById('courses-completed').textContent = stats.courses_completed ?? 0;
    document.getElementById('xp-points').textContent = stats.xp_points ?? 0;
    document.getElementById('xp-points-card').textContent = stats.xp_points ?? 0;
    document.getElementById('current-level').textContent = stats.level ?? 1;

    const planType = document.getElementById('plan-type');
    if (planType) planType.textContent = (stats.plan_type || 'free').toUpperCase();
  } catch (err) {
    console.error('Erro ao carregar stats:', err);
  }
}

// -------------------------------------------------------
// PACIENTES
// -------------------------------------------------------
async function loadPatients() {
  const container = document.getElementById('patients-list');
  if (!container) return;

  container.innerHTML = '<p class="text-gray-400 col-span-3">Carregando...</p>';

  try {
    const patients = await apiFetch('/patients');
    AppState.patients = patients || [];

    if (!patients || patients.length === 0) {
      container.innerHTML = `
        <div class="col-span-3 text-center py-12 text-gray-500">
          <i class="fas fa-user-plus text-4xl mb-3 text-gray-300"></i>
          <p>Nenhum paciente cadastrado ainda.</p>
          <button onclick="showAddPatientModal()" class="mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            Adicionar primeiro paciente
          </button>
        </div>`;
      return;
    }

    container.innerHTML = patients.map(p => `
      <div class="bg-white p-4 rounded-lg shadow hover:shadow-md transition cursor-pointer" onclick="viewPatient(${p.id})">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-semibold text-lg">${escapeHtml(p.name)}</h3>
            <p class="text-gray-600 text-sm">${p.email ? escapeHtml(p.email) : '<span class="text-gray-400">Sem email</span>'}</p>
            <p class="text-gray-500 text-sm">${p.phone ? escapeHtml(p.phone) : '<span class="text-gray-400">Sem telefone</span>'}</p>
          </div>
          <div class="text-right">
            <span class="text-xs text-gray-400">Cadastrado em</span>
            <p class="text-sm">${formatDate(p.created_at)}</p>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-red-500 col-span-3">Erro ao carregar pacientes.</p>';
  }
}

function viewPatient(id) {
  const patient = AppState.patients.find(p => p.id === id);
  if (!patient) return;
  showNotification(`Paciente: ${patient.name}`, 'success');
  // TODO: abrir modal de detalhes
}

function showAddPatientModal() {
  document.getElementById('modal-patient').classList.remove('hidden');
}

function closePatientModal() {
  document.getElementById('modal-patient').classList.add('hidden');
  document.getElementById('patient-form').reset();
}

async function submitPatient(e) {
  e.preventDefault();

  const birthValue = document.getElementById('pt-birth').value;
  const weightValue = parseFloat(document.getElementById('pt-weight').value);
  const heightValue = parseFloat(document.getElementById('pt-height').value);

  const data = {
    name: document.getElementById('pt-name').value,
    email: document.getElementById('pt-email').value || null,
    phone: document.getElementById('pt-phone').value || null,
    birth_date: birthValue || null,
    gender: document.getElementById('pt-gender').value || null,
    weight: isNaN(weightValue) ? null : weightValue,
    height: isNaN(heightValue) ? null : heightValue,
    blood_type: document.getElementById('pt-blood').value || null,
    notes: document.getElementById('pt-notes').value || null,
  };

  try {
    await apiFetch('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    showNotification('Paciente cadastrado com sucesso!');
    closePatientModal();
    await loadPatients();
  } catch (err) {
    showNotification(err.message || 'Erro ao salvar paciente', 'error');
  }
}

// -------------------------------------------------------
// CURSOS
// -------------------------------------------------------
async function loadCourses() {
  const container = document.getElementById('courses-list');
  if (!container) return;

  container.innerHTML = '<p class="text-gray-400 col-span-3">Carregando...</p>';

  try {
    const courses = await apiFetch('/courses');
    AppState.courses = courses || [];

    if (!courses || courses.length === 0) {
      container.innerHTML = '<p class="text-gray-500 col-span-3 text-center py-8">Nenhum curso disponível.</p>';
      return;
    }

    container.innerHTML = courses.map(course => `
      <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
        <div class="mb-3">
          <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full ${
            course.difficulty === 'iniciante' ? 'bg-green-100 text-green-800' :
            course.difficulty === 'intermediario' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }">${capitalize(course.difficulty)}</span>
          ${course.is_premium ? '<span class="ml-2 inline-block px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Premium</span>' : '<span class="ml-2 inline-block px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Grátis</span>'}
        </div>
        <h3 class="font-bold text-lg mb-2">${escapeHtml(course.title)}</h3>
        <p class="text-gray-600 text-sm mb-4 line-clamp-2">${escapeHtml(course.description || '')}</p>
        <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
          <span><i class="fas fa-clock mr-1"></i>${course.duration_hours}h</span>
          <span><i class="fas fa-book mr-1"></i>${course.total_lessons} aulas</span>
          <span class="text-purple-600 font-semibold"><i class="fas fa-star mr-1"></i>${course.xp_reward} XP</span>
        </div>
        <button onclick="startCourse(${course.id})" class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition">
          Iniciar Curso
        </button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-red-500 col-span-3">Erro ao carregar cursos.</p>';
  }
}

async function startCourse(id) {
  try {
    await apiFetch(`/courses/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ status: 'iniciado', lessons_completed: 0, progress_percentage: 0 }),
    });
    showNotification('Curso iniciado! Bom aprendizado!');
  } catch (err) {
    showNotification('Erro ao iniciar curso', 'error');
  }
}

// -------------------------------------------------------
// PROTOCOLOS
// -------------------------------------------------------
async function loadProtocols() {
  const container = document.getElementById('protocols-list');
  if (!container) return;

  container.innerHTML = '<p class="text-gray-400 col-span-3">Carregando...</p>';

  try {
    const protocols = await apiFetch('/protocols');
    AppState.protocols = protocols || [];

    if (!protocols || protocols.length === 0) {
      container.innerHTML = '<p class="text-gray-500 col-span-3 text-center py-8">Nenhum protocolo disponível.</p>';
      return;
    }

    container.innerHTML = protocols.map(p => `
      <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
        <h3 class="font-bold text-lg mb-2">${escapeHtml(p.title)}</h3>
        <p class="text-gray-600 text-sm mb-3 line-clamp-2">${escapeHtml(p.description || '')}</p>
        <div class="mb-4 flex gap-2 flex-wrap">
          <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">${escapeHtml(p.condition)}</span>
          <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">${escapeHtml(p.specialty)}</span>
          ${p.is_premium ? '<span class="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Premium</span>' : ''}
        </div>
        <button onclick="viewProtocol(${p.id})" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
          Ver Protocolo
        </button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-red-500 col-span-3">Erro ao carregar protocolos.</p>';
  }
}

async function viewProtocol(id) {
  try {
    const protocol = await apiFetch(`/protocols/${id}`);
    if (!protocol) return;

    const steps = Array.isArray(protocol.protocol_steps)
      ? protocol.protocol_steps.map((s, i) => `${i + 1}. ${s.action || s}`).join('\n')
      : 'Ver protocolo completo no sistema.';

    alert(`${protocol.title}\n\nCondição: ${protocol.condition}\n\nPassos:\n${steps}`);
  } catch {
    showNotification('Erro ao carregar protocolo', 'error');
  }
}

// -------------------------------------------------------
// CASOS CLÍNICOS
// -------------------------------------------------------
async function loadClinicalCases() {
  const container = document.getElementById('cases-list');
  if (!container) return;

  container.innerHTML = '<p class="text-gray-400 col-span-3">Carregando...</p>';

  try {
    const cases = await apiFetch('/clinical-cases');

    if (!cases || cases.length === 0) {
      container.innerHTML = '<p class="text-gray-500 col-span-3 text-center py-8">Nenhum caso disponível.</p>';
      return;
    }

    container.innerHTML = cases.map(c => `
      <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
        <div class="mb-3 flex gap-2 flex-wrap">
          <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full ${
            c.difficulty === 'iniciante' ? 'bg-green-100 text-green-800' :
            c.difficulty === 'intermediario' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }">${capitalize(c.difficulty)}</span>
          <span class="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">${escapeHtml(c.specialty)}</span>
        </div>
        <h3 class="font-bold text-lg mb-2">${escapeHtml(c.title)}</h3>
        <p class="text-gray-700 text-sm mb-2"><strong>Perfil:</strong> ${escapeHtml(c.patient_profile)}</p>
        <p class="text-gray-600 text-sm mb-4 line-clamp-2">${escapeHtml(c.chief_complaint)}</p>
        <div class="flex justify-between items-center mb-4">
          <span class="text-sm text-purple-600 font-semibold"><i class="fas fa-star mr-1"></i>${c.xp_reward} XP</span>
        </div>
        <button onclick="attemptCase(${c.id}, '${escapeHtml(c.title)}')" class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition">
          Resolver Caso
        </button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-red-500 col-span-3">Erro ao carregar casos.</p>';
  }
}

async function attemptCase(id, title) {
  const diagnosis = prompt(`Caso: ${title}\n\nDigite seu diagnóstico:`);
  if (!diagnosis || diagnosis.trim().length < 5) {
    showNotification('Diagnóstico muito curto', 'error');
    return;
  }

  try {
    const result = await apiFetch(`/clinical-cases/${id}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ submitted_diagnosis: diagnosis }),
    });

    if (!result) return;

    const msg = `Pontuação: ${result.score}/100\n${result.is_correct ? '✅ Correto!' : '⚠️ Parcial'}\nXP Ganho: ${result.xp_earned}\n\n${result.feedback}`;
    alert(msg);

    if (result.xp_earned > 0) {
      await loadDashboardStats();
    }
  } catch (err) {
    showNotification('Erro ao enviar tentativa', 'error');
  }
}

// -------------------------------------------------------
// ASSISTENTE IA — Chat livre
// -------------------------------------------------------
async function sendAIMessage() {
  const input   = document.getElementById('ai-input');
  const context = document.getElementById('ai-context');
  const chat    = document.getElementById('ai-chat');
  const sendBtn = document.getElementById('ai-send-btn');

  const prompt = input.value.trim();
  if (!prompt) return;

  chat.innerHTML += `
    <div class="bg-blue-50 rounded-lg p-3 text-sm self-end">
      <strong>Você:</strong> ${escapeHtml(prompt)}
    </div>
    <div class="bg-gray-50 rounded-lg p-3 text-sm" id="ai-loading">
      <i class="fas fa-spinner fa-spin text-purple-600"></i> Processando...
    </div>`;
  chat.scrollTop = chat.scrollHeight;
  input.value   = '';
  sendBtn.disabled = true;

  try {
    const result = await apiFetch('/ai/chat', {
      method: 'POST',
      body:   JSON.stringify({ prompt, context_type: context.value }),
    });

    document.getElementById('ai-loading')?.remove();

    if (result) {
      chat.innerHTML += `
        <div class="bg-purple-50 rounded-lg p-3 text-sm">
          <strong>IA${result.is_mock ? ' <span class="text-xs text-yellow-600">[demo]</span>' : ''}:</strong>
          <div class="mt-1 whitespace-pre-wrap">${escapeHtml(result.response)}</div>
        </div>`;
      if (result.is_mock) document.getElementById('ai-mode-banner')?.classList.remove('hidden');
      chat.scrollTop = chat.scrollHeight;
    }
  } catch {
    document.getElementById('ai-loading')?.remove();
  } finally {
    sendBtn.disabled = false;
  }
}

// -------------------------------------------------------
// RELATÓRIO DE IA — Fluxo completo: labs → motor → IA
// -------------------------------------------------------
const AIReport = {

  // Renderiza o painel de análise laboratorial + IA
  renderPanel() {
    const container = document.getElementById('ai-lab-panel');
    if (!container) return;

    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <i class="fas fa-flask text-purple-600"></i>
          </div>
          <div>
            <h2 class="text-lg font-bold text-gray-800">Análise Laboratorial com IA</h2>
            <p class="text-sm text-gray-500">Motor clínico + relatório gerado por IA</p>
          </div>
        </div>

        <!-- Formulário de exames -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          ${[
            { key: 'ferritin',  label: 'Ferritina',        unit: 'ng/mL',  ph: 'ex: 45'  },
            { key: 'b12',       label: 'Vitamina B12',     unit: 'pg/mL',  ph: 'ex: 380' },
            { key: 'tsh',       label: 'TSH',              unit: 'mUI/L',  ph: 'ex: 2.8' },
            { key: 'vitaminD',  label: 'Vitamina D',       unit: 'ng/mL',  ph: 'ex: 25'  },
            { key: 'insulin',   label: 'Insulina Jejum',   unit: 'mUI/L',  ph: 'ex: 10'  },
            { key: 'glucose',   label: 'Glicose Jejum',    unit: 'mg/dL',  ph: 'ex: 102' },
          ].map(f => `
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">
                ${f.label} <span class="text-gray-400 font-normal">(${f.unit})</span>
              </label>
              <input type="number" step="0.1" id="lab-${f.key}"
                placeholder="${f.ph}"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition">
            </div>`).join('')}
        </div>

        <!-- Metadados opcionais -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Nome do Paciente (opcional)</label>
            <input type="text" id="lab-patient-name" placeholder="ex: Maria Silva"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Modo do Relatório</label>
            <select id="lab-mode"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none">
              <option value="clinical">Clínico (para profissional)</option>
              <option value="patient">Paciente (linguagem simples)</option>
            </select>
          </div>
        </div>

        <!-- Botão -->
        <button id="lab-report-btn" onclick="AIReport.generate()"
          class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold
                 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
          <i class="fas fa-brain"></i>
          Gerar Relatório com IA
        </button>
      </div>

      <!-- Resultado -->
      <div id="lab-report-result" class="hidden mt-6"></div>
    `;
  },

  // Coleta os valores do formulário
  collectLabs() {
    const keys  = ['ferritin', 'b12', 'tsh', 'vitaminD', 'insulin', 'glucose'];
    const labs  = {};
    keys.forEach(k => {
      const v = parseFloat(document.getElementById(`lab-${k}`)?.value || '');
      if (!isNaN(v)) labs[k] = v;
    });
    return labs;
  },

  // Executa a análise
  async generate() {
    const labs = this.collectLabs();

    if (Object.keys(labs).length === 0) {
      showNotification('Preencha pelo menos um exame para analisar.', 'error');
      return;
    }

    const btn       = document.getElementById('lab-report-btn');
    const resultDiv = document.getElementById('lab-report-result');

    // Loading state
    btn.disabled   = true;
    btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> Analisando...';
    resultDiv.classList.add('hidden');
    resultDiv.innerHTML = '';

    try {
      const payload = {
        labs,
        patientName: document.getElementById('lab-patient-name')?.value?.trim() || undefined,
        mode:        document.getElementById('lab-mode')?.value || 'clinical',
      };

      const res = await apiFetch('/ai/lab-report', {
        method: 'POST',
        body:   JSON.stringify(payload),
      });

      if (!res || !res.success) throw new Error(res?.error || 'Erro na análise');

      this.renderResult(resultDiv, res.data);
      resultDiv.classList.remove('hidden');
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      showNotification(err.message || 'Erro ao gerar relatório', 'error');
    } finally {
      btn.disabled  = false;
      btn.innerHTML = '<i class="fas fa-brain"></i> Gerar Relatório com IA';
    }
  },

  // Renderiza o resultado completo
  renderResult(container, data) {
    const { health_score, markers_analyzed, findings, combination_alerts, suggestions, ai_report } = data;

    // Cores do score
    const scoreColor = health_score >= 80 ? 'text-green-600'
                     : health_score >= 50 ? 'text-yellow-600'
                     :                       'text-red-600';
    const scoreBg    = health_score >= 80 ? 'bg-green-50 border-green-200'
                     : health_score >= 50 ? 'bg-yellow-50 border-yellow-200'
                     :                       'bg-red-50 border-red-200';

    // Badge de status
    const statusBadge = (status) => {
      const map = {
        ok:         'bg-green-100 text-green-800',
        low:        'bg-blue-100 text-blue-800',
        high:       'bg-red-100 text-red-800',
        borderline: 'bg-yellow-100 text-yellow-800',
      };
      const labels = { ok: 'Normal', low: 'Baixo', high: 'Elevado', borderline: 'Limítrofe' };
      return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-800'}">${labels[status] || status}</span>`;
    };

    // Badge de prioridade
    const priorityBadge = (p) => {
      const map = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };
      const labels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
      return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${map[p] || ''}">${labels[p] || p}</span>`;
    };

    // Badge gerado por
    const aiBadge = ai_report.generated_by === 'openai'
      ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700"><i class="fas fa-robot mr-1"></i>GPT-4o</span>'
      : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"><i class="fas fa-cog mr-1"></i>Motor Local</span>';

    container.innerHTML = `
      <!-- Score geral -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p class="text-sm text-gray-500 mb-1">Score de Saúde</p>
            <p class="text-5xl font-black ${scoreColor}">${health_score}<span class="text-2xl text-gray-400">/100</span></p>
            <p class="text-xs text-gray-400 mt-1">${markers_analyzed} marcador(es) analisado(s)</p>
          </div>
          <div class="${scoreBg} border rounded-xl p-4 flex-1 max-w-sm">
            <p class="text-sm font-semibold text-gray-700 mb-1">Resumo Clínico ${aiBadge}</p>
            <p class="text-sm text-gray-600">${escapeHtml(ai_report.summary)}</p>
          </div>
        </div>
      </div>

      <!-- Achados individuais -->
      ${findings.length > 0 ? `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-microscope text-purple-500"></i> Achados por Marcador
        </h3>
        <div class="space-y-3">
          ${findings.map(f => `
            <div class="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold text-sm text-gray-800">${escapeHtml(f.marker)}</span>
                  ${statusBadge(f.status)}
                  ${f.status !== 'ok' ? `<span class="text-xs text-gray-500 font-medium">${f.value} ${f.unit}</span>` : ''}
                </div>
                <p class="text-xs text-gray-600">${escapeHtml(f.message)}</p>
                <p class="text-xs text-gray-400 mt-0.5">Ref: ${escapeHtml(f.reference)}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Alertas combinados -->
      ${combination_alerts.length > 0 ? `
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <h3 class="font-bold text-amber-800 mb-3 flex items-center gap-2">
          <i class="fas fa-exclamation-triangle"></i> Alertas de Combinação
        </h3>
        ${combination_alerts.map(a => `
          <div class="flex items-start gap-2 mb-2 last:mb-0">
            <i class="fas fa-exclamation-circle text-amber-500 mt-0.5 flex-shrink-0"></i>
            <div>
              <p class="text-sm font-semibold text-amber-900">${escapeHtml(a.marker.replace('Alerta Combinado: ',''))}</p>
              <p class="text-xs text-amber-700">${escapeHtml(a.message)}</p>
            </div>
          </div>`).join('')}
      </div>` : ''}

      <!-- Relatório IA -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-brain text-purple-500"></i> Relatório de IA ${aiBadge}
        </h3>

        <!-- Interpretação clínica -->
        ${ai_report.clinicalInterpretation?.length > 0 ? `
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Interpretação Clínica</p>
          <ul class="space-y-1">
            ${ai_report.clinicalInterpretation.map(item =>
              `<li class="text-sm text-gray-700 flex items-start gap-2">
                <i class="fas fa-circle text-purple-400 text-xs mt-1.5 flex-shrink-0"></i>
                ${escapeHtml(item)}
              </li>`).join('')}
          </ul>
        </div>` : ''}

        <!-- Explicação para paciente -->
        <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p class="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            <i class="fas fa-user mr-1"></i> Explicação para o Paciente
          </p>
          <p class="text-sm text-blue-900">${escapeHtml(ai_report.patientFriendlyExplanation)}</p>
        </div>

        <!-- Próximas investigações -->
        ${ai_report.followUpQuestions?.length > 0 ? `
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Próximas Investigações</p>
          <ul class="space-y-1">
            ${ai_report.followUpQuestions.map(q =>
              `<li class="text-sm text-gray-700 flex items-start gap-2">
                <i class="fas fa-question-circle text-blue-400 text-xs mt-1.5 flex-shrink-0"></i>
                ${escapeHtml(q)}
              </li>`).join('')}
          </ul>
        </div>` : ''}

        <!-- Aviso -->
        <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p class="text-xs text-gray-500 flex items-start gap-1.5">
            <i class="fas fa-info-circle mt-0.5 flex-shrink-0"></i>
            ${escapeHtml(ai_report.caution)}
          </p>
        </div>
      </div>

      <!-- Sugestões -->
      ${suggestions.length > 0 ? `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-lightbulb text-yellow-500"></i> Sugestões Clínicas
        </h3>
        <div class="space-y-3">
          ${suggestions.map(s => `
            <div class="p-3 rounded-lg border border-gray-100 hover:border-purple-200 transition">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                ${priorityBadge(s.priority)}
                <span class="text-xs text-gray-500 capitalize">${escapeHtml(s.category.replace('_',' '))}</span>
                <span class="font-semibold text-sm text-gray-800">${escapeHtml(s.title)}</span>
              </div>
              <p class="text-xs text-gray-600">${escapeHtml(s.detail)}</p>
            </div>`).join('')}
        </div>
      </div>` : ''}
    `;
  },
};

// Atalho global para o frontend (compatível com onclick="generateAIReport()")
async function generateAIReport() {
  await AIReport.generate();
}

// -------------------------------------------------------
// ALTERNÂNCIA DE TABS no painel IA
// -------------------------------------------------------
function switchAITab(tab) {
  const labPanel  = document.getElementById('ai-panel-lab');
  const chatPanel = document.getElementById('ai-panel-chat');
  const tabLab    = document.getElementById('ai-tab-lab');
  const tabChat   = document.getElementById('ai-tab-chat');

  if (tab === 'lab') {
    labPanel?.classList.remove('hidden');
    chatPanel?.classList.add('hidden');
    tabLab?.classList.add('text-purple-700', 'border-purple-600');
    tabLab?.classList.remove('text-gray-500', 'border-transparent');
    tabChat?.classList.add('text-gray-500', 'border-transparent');
    tabChat?.classList.remove('text-purple-700', 'border-purple-600');
    // Garante que o painel foi renderizado
    if (!document.getElementById('lab-report-btn')) AIReport.renderPanel();
  } else {
    chatPanel?.classList.remove('hidden');
    labPanel?.classList.add('hidden');
    tabChat?.classList.add('text-purple-700', 'border-purple-600');
    tabChat?.classList.remove('text-gray-500', 'border-transparent');
    tabLab?.classList.add('text-gray-500', 'border-transparent');
    tabLab?.classList.remove('text-purple-700', 'border-purple-600');
  }
}

// Permitir Enter no chat AI
document.addEventListener('DOMContentLoaded', () => {
  const aiInput = document.getElementById('ai-input');
  if (aiInput) {
    aiInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAIMessage();
      }
    });
  }
});

// -------------------------------------------------------
// LOGOUT
// -------------------------------------------------------
function logout() {
  if (confirm('Deseja sair da plataforma?')) {
    Auth.logout();
  }
}

// -------------------------------------------------------
// UTILS
// -------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

// -------------------------------------------------------
// INICIALIZAÇÃO
// -------------------------------------------------------
async function initApp() {
  Auth.init();

  const authCheck = document.getElementById('auth-check');
  const mainApp = document.getElementById('main-app');

  if (!Auth.isAuthenticated()) {
    window.location.href = '/login';
    return;
  }

  // Preencher dados do profissional na UI
  if (Auth.professional) {
    const name = Auth.professional.name || 'Profissional';
    const sidebarName = document.getElementById('sidebar-name');
    const headerName = document.getElementById('header-name');
    if (sidebarName) sidebarName.textContent = name;
    if (headerName) headerName.textContent = name.split(' ')[0];
  }

  // Mostrar app
  if (authCheck) authCheck.style.display = 'none';
  if (mainApp) mainApp.style.removeProperty('display');

  // Conectar form de paciente
  const patientForm = document.getElementById('patient-form');
  if (patientForm) patientForm.addEventListener('submit', submitPatient);

  // Carregar dados iniciais
  await loadDashboardStats();
}

// Iniciar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

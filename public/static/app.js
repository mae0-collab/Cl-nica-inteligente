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
    cases: 'Casos Clínicos',
    ai: 'Assistente IA',
    hemograma: 'Hemograma / FSA',
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
    const exEl = document.getElementById('exames-realizados');
    if (exEl) exEl.textContent = stats.ai_interactions_count ?? '—';
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

// ============================================================
// HEMOGRAMA SIMULATOR — Simulador de Hemograma + FSA com IA
// ============================================================
const HemogramaSimulator = {

  currentTab: 'upload',

  render() {
    this.switchTab(this.currentTab || 'upload');
  },

  switchTab(tab) {
    this.currentTab = tab;
    // Atualizar estilos das abas
    const tabUpload = document.getElementById('hg-tab-upload');
    const tabManual = document.getElementById('hg-tab-manual');
    if (tabUpload) {
      tabUpload.className = tab === 'upload'
        ? 'px-4 py-2 text-sm font-semibold text-red-700 border-b-2 border-red-500 -mb-px flex items-center gap-1'
        : 'px-4 py-2 text-sm font-semibold text-gray-500 border-b-2 border-transparent -mb-px hover:text-red-600 flex items-center gap-1';
    }
    if (tabManual) {
      tabManual.className = tab === 'manual'
        ? 'px-4 py-2 text-sm font-semibold text-red-700 border-b-2 border-red-500 -mb-px flex items-center gap-1'
        : 'px-4 py-2 text-sm font-semibold text-gray-500 border-b-2 border-transparent -mb-px hover:text-red-600 flex items-center gap-1';
    }
    if (tab === 'upload') this.renderUpload();
    else this.renderManual();
  },

  renderUpload() {
    const panel = document.getElementById('hemograma-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- UPLOAD FORM -->
        <div class="space-y-4">

          <!-- Drag & Drop -->
          <div id="hg-dropzone"
            class="bg-white rounded-xl border-2 border-dashed border-red-300 p-8 text-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition"
            onclick="document.getElementById('hg-file-input').click()"
            ondrop="HemogramaSimulator.onDrop(event)"
            ondragover="event.preventDefault(); this.classList.add('border-red-500','bg-red-50')"
            ondragleave="this.classList.remove('border-red-500','bg-red-50')">
            <i class="fas fa-file-medical text-5xl text-red-400 mb-3"></i>
            <p class="font-semibold text-gray-700 mb-1">Arraste o laudo aqui</p>
            <p class="text-sm text-gray-500 mb-3">ou clique para selecionar</p>
            <p class="text-xs text-gray-400">Suportado: PDF (com texto) · JPG · PNG · WEBP · até 10 MB</p>
            <input type="file" id="hg-file-input" accept=".pdf,.jpg,.jpeg,.png,.webp"
              class="hidden" onchange="HemogramaSimulator.onFileSelect(event)">
          </div>

          <!-- Preview do arquivo selecionado -->
          <div id="hg-file-preview" class="hidden bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div class="flex items-center gap-3">
              <div id="hg-file-icon" class="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                <i class="fas fa-file text-red-600"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p id="hg-file-name" class="text-sm font-semibold text-gray-800 truncate"></p>
                <p id="hg-file-size" class="text-xs text-gray-400"></p>
              </div>
              <button onclick="HemogramaSimulator.clearFile()"
                class="text-gray-400 hover:text-red-500 p-1">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div id="hg-img-preview-wrap" class="mt-3 hidden">
              <img id="hg-img-preview" class="max-h-48 rounded-lg border border-gray-100 mx-auto" src="" alt="Preview">
            </div>
          </div>

          <!-- Dados opcionais -->
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i class="fas fa-user-circle text-purple-400"></i> Dados do Paciente (opcional)
            </h4>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input type="text" id="hg-up-name" placeholder="Ex: João Silva"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Sexo</label>
                <select id="hg-up-sexo" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Idade</label>
                <input type="number" id="hg-up-idade" placeholder="35" min="0" max="120"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-xs font-medium text-gray-600 mb-1">Modo de relatório</label>
              <select id="hg-up-mode" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="clinical">🩺 Clínico (profissional)</option>
                <option value="patient">👤 Paciente (linguagem simples)</option>
              </select>
            </div>
          </div>

          <!-- Botão Analisar -->
          <button onclick="HemogramaSimulator.uploadAnalisar()"
            id="hg-up-btn"
            class="w-full bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold py-3 rounded-xl
                   hover:from-red-700 hover:to-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            <i class="fas fa-upload"></i>
            Enviar Laudo e Analisar com GPT-5.2
          </button>

          <p class="text-xs text-center text-gray-400">
            <i class="fas fa-lock mr-1"></i>O arquivo é processado e descartado — não é armazenado.
          </p>
        </div>

        <!-- RESULTADO -->
        <div id="hg-up-resultado" class="space-y-4">
          <div class="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 h-full flex items-center justify-center">
            <div>
              <i class="fas fa-file-upload text-4xl mb-3 opacity-30"></i>
              <p class="text-sm">Faça upload do laudo<br>para iniciar a análise</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  onFileSelect(event) {
    const file = event.target.files?.[0];
    if (file) this._showFilePreview(file);
  },

  onDrop(event) {
    event.preventDefault();
    document.getElementById('hg-dropzone')?.classList.remove('border-red-500','bg-red-50');
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      document.getElementById('hg-file-input').files = event.dataTransfer.files;
      this._showFilePreview(file);
    }
  },

  _showFilePreview(file) {
    const preview = document.getElementById('hg-file-preview');
    const nameEl  = document.getElementById('hg-file-name');
    const sizeEl  = document.getElementById('hg-file-size');
    const iconEl  = document.getElementById('hg-file-icon');
    const imgWrap = document.getElementById('hg-img-preview-wrap');
    const imgEl   = document.getElementById('hg-img-preview');
    if (!preview) return;

    preview.classList.remove('hidden');
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';

    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (iconEl) {
      iconEl.innerHTML = isPDF
        ? '<i class="fas fa-file-pdf text-red-600"></i>'
        : '<i class="fas fa-file-image text-blue-500"></i>';
      iconEl.className = `w-10 h-10 rounded-lg flex items-center justify-center ${isPDF ? 'bg-red-100' : 'bg-blue-100'}`;
    }

    // Preview de imagem
    if (!isPDF && imgWrap && imgEl) {
      imgWrap.classList.remove('hidden');
      const reader = new FileReader();
      reader.onload = (e) => { imgEl.src = e.target.result; };
      reader.readAsDataURL(file);
    } else if (imgWrap) {
      imgWrap.classList.add('hidden');
    }
  },

  clearFile() {
    const input = document.getElementById('hg-file-input');
    if (input) input.value = '';
    document.getElementById('hg-file-preview')?.classList.add('hidden');
    document.getElementById('hg-img-preview-wrap')?.classList.add('hidden');
  },

  async uploadAnalisar() {
    const input = document.getElementById('hg-file-input');
    const file  = input?.files?.[0];
    if (!file) { showNotification('Selecione um arquivo primeiro.', 'warning'); return; }

    const btn       = document.getElementById('hg-up-btn');
    const resultado = document.getElementById('hg-up-resultado');

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando com GPT-5.2...'; }
    if (resultado) resultado.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <i class="fas fa-spinner fa-spin text-red-500 text-3xl mb-3"></i>
        <p class="text-gray-600 font-medium">Lendo laudo + GPT-5.2 interpretando...</p>
        <p class="text-xs text-gray-400 mt-2">PDF: ~10s · Imagem: ~15–25s</p>
      </div>`;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const patientName = document.getElementById('hg-up-name')?.value?.trim();
      const sexo  = document.getElementById('hg-up-sexo')?.value;
      const idade = document.getElementById('hg-up-idade')?.value;
      const mode  = document.getElementById('hg-up-mode')?.value || 'clinical';

      if (patientName) formData.append('patientName', patientName);
      if (sexo)        formData.append('sexo', sexo);
      if (idade)       formData.append('idade', idade);
      formData.append('mode', mode);

      // Upload sem Content-Type (browser define multipart boundary)
      const token = Auth.token;
      const resp = await fetch('/api/ai/hemograma/upload', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await resp.json();

      if (!data.success) throw new Error(data.error || 'Erro no upload');

      // Mostrar valores extraídos + resultado
      const valores = data.valores_extraidos || {};
      const camposFormatados = Object.entries(valores)
        .filter(([k]) => !['sexo','idade'].includes(k))
        .map(([k,v]) => `<span class="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-100">
          <span class="font-medium">${k}</span>: ${v}
        </span>`).join('');

      const valoresHtml = camposFormatados ? `
        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
          <p class="text-xs font-bold text-blue-700 uppercase mb-2">
            <i class="fas fa-magic mr-1"></i> Valores extraídos do laudo (${data.source === 'pdf_texto' ? 'PDF' : 'Imagem'})
            ${data.patient_name_detected ? `· Paciente: <strong>${escapeHtml(data.patient_name_detected)}</strong>` : ''}
          </p>
          <div class="flex flex-wrap gap-2">${camposFormatados}</div>
        </div>` : '';

      if (resultado) resultado.innerHTML = valoresHtml;

      // Renderizar resultado completo
      this._renderResultado(data.data, data.patient_name_detected || patientName, mode, resultado);

    } catch (err) {
      if (resultado) resultado.innerHTML = `
        <div class="bg-red-50 rounded-xl border border-red-200 p-6 text-red-700">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <strong>Erro:</strong> ${escapeHtml(err.message || 'Falha no upload')}
          <p class="text-xs mt-2 text-red-500">Verifique se o arquivo é um laudo válido e tente novamente.</p>
        </div>`;
      showNotification('Erro ao processar laudo.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload"></i> Enviar Laudo e Analisar com GPT-5.2'; }
    }
  },

  renderManual() {
    const panel = document.getElementById('hemograma-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- FORMULÁRIO -->
        <div class="space-y-4">

          <!-- Identificação do Paciente -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i class="fas fa-user-circle text-purple-500"></i> Identificação (opcional)
            </h4>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome do Paciente</label>
                <input type="text" id="hg-patient-name" placeholder="Ex: João Silva"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Sexo</label>
                <select id="hg-sexo" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Idade (anos)</label>
                <input type="number" id="hg-idade" placeholder="Ex: 35" min="0" max="120"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none">
              </div>
            </div>
          </div>

          <!-- Série Vermelha -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i class="fas fa-circle text-red-500 text-xs"></i>
              Série Vermelha (Eritrograma)
            </h4>
            <div class="grid grid-cols-2 gap-3">
              ${this._field('hg-hemoglobina',  'Hemoglobina',   'g/dL',      '13,0–17,5 / 12,0–16,0')}
              ${this._field('hg-hematocrito',  'Hematócrito',   '%',         '39–54 / 36–48')}
              ${this._field('hg-eritrocitos',  'Eritrócitos',   'milhões/µL','4,2–6,0 / 3,8–5,2')}
              ${this._field('hg-vcm',          'VCM',           'fL',        '80–100')}
              ${this._field('hg-hcm',          'HCM',           'pg',        '27–33')}
              ${this._field('hg-chcm',         'CHCM',          'g/dL',      '32–36')}
              ${this._field('hg-rdw',          'RDW',           '%',         '11,5–14,5')}
            </div>
          </div>

          <!-- Leucograma -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i class="fas fa-circle text-blue-500 text-xs"></i>
              Leucograma
            </h4>
            <div class="grid grid-cols-2 gap-3">
              ${this._field('hg-leucocitos',  'Leucócitos Totais', '/µL',  '4.000–11.000')}
            </div>
          </div>

          <!-- FSA -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i class="fas fa-circle text-blue-300 text-xs"></i>
              FSA — Fórmula Sanguínea Ampliada (valores absolutos)
            </h4>
            <div class="grid grid-cols-2 gap-3">
              ${this._field('hg-neutrofilos',  'Neutrófilos',    '/µL', '1.800–7.500')}
              ${this._field('hg-linfocitos',   'Linfócitos',     '/µL', '1.000–4.500')}
              ${this._field('hg-monocitos',    'Monócitos',      '/µL', '200–1.000')}
              ${this._field('hg-eosinofilos',  'Eosinófilos',    '/µL', '50–500')}
              ${this._field('hg-basofilos',    'Basófilos',      '/µL', '0–100')}
              ${this._field('hg-bastoes',      'Bastões',        '/µL', '< 500')}
            </div>
          </div>

          <!-- Plaquetas -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <i class="fas fa-circle text-yellow-500 text-xs"></i>
              Plaquetas
            </h4>
            <div class="grid grid-cols-2 gap-3">
              ${this._field('hg-plaquetas', 'Plaquetas', '/µL', '150.000–400.000')}
            </div>
          </div>

          <!-- Modo e Botão -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div class="flex items-center gap-3 mb-4">
              <label class="block text-sm font-medium text-gray-700">Modo de relatório:</label>
              <select id="hg-mode" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="clinical">🩺 Clínico (profissional)</option>
                <option value="patient">👤 Paciente (linguagem simples)</option>
              </select>
            </div>
            <button onclick="HemogramaSimulator.analisar()"
              id="hg-btn-analisar"
              class="w-full bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold py-3 rounded-xl
                     hover:from-red-700 hover:to-red-600 transition-all flex items-center justify-center gap-2">
              <i class="fas fa-microscope"></i>
              Analisar Hemograma com IA (GPT-5.2)
            </button>
          </div>
        </div>

        <!-- RESULTADO -->
        <div id="hg-resultado" class="space-y-4">
          <div class="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 h-full flex items-center justify-center">
            <div>
              <i class="fas fa-microscope text-4xl mb-3 opacity-30"></i>
              <p class="text-sm">Preencha os valores do hemograma<br>e clique em Analisar</p>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  _field(id, label, unit, ref) {
    return `
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">
          ${label} <span class="text-gray-400">(${unit})</span>
        </label>
        <input type="number" id="${id}" step="any" placeholder="${ref}"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
          title="Referência: ${ref}">
      </div>`;
  },

  _val(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    const v = parseFloat(el.value);
    return isNaN(v) ? undefined : v;
  },

  async analisar() {
    const payload = {
      hemoglobina:  this._val('hg-hemoglobina'),
      hematocrito:  this._val('hg-hematocrito'),
      eritrocitos:  this._val('hg-eritrocitos'),
      vcm:          this._val('hg-vcm'),
      hcm:          this._val('hg-hcm'),
      chcm:         this._val('hg-chcm'),
      rdw:          this._val('hg-rdw'),
      leucocitos:   this._val('hg-leucocitos'),
      neutrofilos:  this._val('hg-neutrofilos'),
      linfocitos:   this._val('hg-linfocitos'),
      monocitos:    this._val('hg-monocitos'),
      eosinofilos:  this._val('hg-eosinofilos'),
      basofilos:    this._val('hg-basofilos'),
      bastoes:      this._val('hg-bastoes'),
      plaquetas:    this._val('hg-plaquetas'),
    };

    const sexo  = document.getElementById('hg-sexo')?.value || undefined;
    const idade = this._val('hg-idade');
    const mode  = document.getElementById('hg-mode')?.value || 'clinical';
    const patientName = document.getElementById('hg-patient-name')?.value?.trim() || undefined;

    if (sexo)  payload.sexo  = sexo;
    if (idade) payload.idade = idade;
    if (patientName) payload.patientName = patientName;
    payload.mode = mode;

    // Verificar se ao menos 1 campo foi preenchido
    const temDados = Object.values(payload).some(
      (v) => typeof v === 'number' && !isNaN(v)
    );
    if (!temDados) {
      showNotification('Preencha pelo menos um parâmetro do hemograma.', 'warning');
      return;
    }

    // Loading state
    const btn = document.getElementById('hg-btn-analisar');
    const resultado = document.getElementById('hg-resultado');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando com GPT-5.2...'; }
    if (resultado) resultado.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <i class="fas fa-spinner fa-spin text-red-500 text-3xl mb-3"></i>
        <p class="text-gray-600">Consultando motor hematológico + GPT-5.2...</p>
        <p class="text-xs text-gray-400 mt-1">Aguarde ~15–20 segundos</p>
      </div>`;

    try {
      const data = await apiFetch('/ai/hemograma', { method: 'POST', body: JSON.stringify(payload) });
      if (data.success) {
        this._renderResultado(data.data, patientName, mode);
      } else {
        throw new Error(data.error || 'Erro ao analisar');
      }
    } catch (err) {
      if (resultado) resultado.innerHTML = `
        <div class="bg-red-50 rounded-xl border border-red-200 p-6 text-red-700">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <strong>Erro:</strong> ${escapeHtml(err.message || 'Falha na análise')}
        </div>`;
      showNotification('Erro ao analisar hemograma.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-microscope"></i> Analisar Hemograma com IA (GPT-5.2)'; }
    }
  },

  _renderResultado(data, patientName, mode, containerEl) {
    const resultado = containerEl || document.getElementById('hg-resultado');
    if (!resultado) return;

    const ia     = data.relatorio_ia || {};
    const score  = data.score_global ?? 0;
    const scoreColor = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
    const scoreLabel = score >= 80 ? 'Ótimo' : score >= 50 ? 'Atenção' : 'Alterado';

    // Alertas críticos
    const alertasCriticos = (data.alertas_criticos || []).length > 0
      ? `<div class="bg-red-50 border border-red-300 rounded-xl p-4 mb-4">
          <h5 class="font-bold text-red-700 flex items-center gap-2 mb-2">
            <i class="fas fa-exclamation-triangle"></i> ⚠️ ALERTAS CRÍTICOS
          </h5>
          <ul class="space-y-1">
            ${(data.alertas_criticos || []).map(a => `<li class="text-red-700 text-sm font-medium">${escapeHtml(a)}</li>`).join('')}
          </ul>
        </div>` : '';

    // Padrões diagnósticos
    const padroesHtml = (data.padroes || []).length > 0
      ? `<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
          <h5 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <i class="fas fa-search text-purple-500"></i> Padrões Diagnósticos Detectados
          </h5>
          <div class="space-y-2">
            ${(data.padroes || []).map(p => `
              <div class="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <p class="font-semibold text-purple-800 text-sm">${escapeHtml(p.nome)}</p>
                <p class="text-xs text-purple-600 mt-1">${escapeHtml(p.descricao)}</p>
                <span class="inline-block mt-1 text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                  Confiança: ${escapeHtml(p.confianca)}
                </span>
              </div>`).join('')}
          </div>
        </div>` : '';

    // Achados por série
    const categorias = ['serie_vermelha', 'indices', 'leucograma', 'fsa', 'plaquetas'];
    const catLabels  = {
      serie_vermelha: '🔴 Série Vermelha',
      indices:        '📊 Índices Hematimétricos',
      leucograma:     '⚪ Leucograma',
      fsa:            '🔵 FSA — Fórmula Sanguínea Ampliada',
      plaquetas:      '🟡 Plaquetas',
    };
    const statusColor = {
      ok:         'bg-green-50 border-green-200 text-green-800',
      borderline: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      low:        'bg-orange-50 border-orange-200 text-orange-800',
      high:       'bg-red-50 border-red-200 text-red-800',
      critical:   'bg-red-100 border-red-400 text-red-900',
    };
    const statusIcon = {
      ok:         '✅',
      borderline: '🟡',
      low:        '⬇️',
      high:       '⬆️',
      critical:   '🚨',
    };

    let achadosHtml = '';
    for (const cat of categorias) {
      const grupo = (data.achados || []).filter(a => a.categoria === cat);
      if (grupo.length === 0) continue;
      achadosHtml += `
        <div class="mb-3">
          <h6 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${catLabels[cat]}</h6>
          <div class="space-y-2">
            ${grupo.map(a => `
              <div class="flex items-start gap-3 p-3 rounded-lg border text-sm ${statusColor[a.status] || 'bg-gray-50'}">
                <span class="text-base">${statusIcon[a.status] || '○'}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold">${escapeHtml(a.parametro)}</span>
                    <span class="font-mono text-xs bg-white bg-opacity-60 px-2 py-0.5 rounded">
                      ${a.valor} ${escapeHtml(a.unidade)}
                    </span>
                    <span class="text-xs opacity-70">Ref: ${escapeHtml(a.referencia)}</span>
                  </div>
                  <p class="mt-1 text-xs opacity-80">${escapeHtml(a.interpretacao)}</p>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }

    // Relatório IA
    const relatorioHtml = ia.resumo_executivo ? `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        <div class="flex items-center justify-between mb-3">
          <h5 class="font-semibold text-gray-800 flex items-center gap-2">
            <i class="fas fa-robot text-purple-500"></i>
            Interpretação por GPT-5.2
          </h5>
          <span class="text-xs ${ia.generated_by === 'openai' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded-full">
            ${ia.generated_by === 'openai' ? `✅ OpenAI ${ia.model || ''}` : '⚙️ Motor local'}
            ${ia.response_time_ms ? ` · ${(ia.response_time_ms/1000).toFixed(1)}s` : ''}
          </span>
        </div>

        <div class="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
          <h6 class="text-xs font-bold text-blue-700 uppercase mb-2">Resumo Executivo</h6>
          <p class="text-sm text-blue-900">${escapeHtml(ia.resumo_executivo || '')}</p>
        </div>

        ${ia.interpretacao_series?.length > 0 ? `
          <div class="mb-4">
            <h6 class="text-xs font-bold text-gray-600 uppercase mb-2">Interpretação por Série</h6>
            <ul class="space-y-1">
              ${ia.interpretacao_series.map(l => `<li class="text-sm text-gray-700 flex gap-2"><span class="text-purple-400">▸</span>${escapeHtml(l)}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${ia.padroes_diagnosticos?.length > 0 ? `
          <div class="mb-4">
            <h6 class="text-xs font-bold text-gray-600 uppercase mb-2">Padrões Diagnósticos</h6>
            <ul class="space-y-1">
              ${ia.padroes_diagnosticos.map(l => `<li class="text-sm text-gray-700 flex gap-2"><span class="text-orange-400">▸</span>${escapeHtml(l)}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${ia.diagnosticos_diferenciais?.length > 0 ? `
          <div class="mb-4">
            <h6 class="text-xs font-bold text-gray-600 uppercase mb-2">Diagnósticos Diferenciais</h6>
            <ul class="space-y-1">
              ${ia.diagnosticos_diferenciais.map(l => `<li class="text-sm text-gray-700 flex gap-2"><span class="text-red-400">▸</span>${escapeHtml(l)}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${ia.investigacao_recomendada?.length > 0 ? `
          <div class="mb-4">
            <h6 class="text-xs font-bold text-gray-600 uppercase mb-2">Investigação Recomendada</h6>
            <ul class="space-y-1">
              ${ia.investigacao_recomendada.map(l => `<li class="text-sm text-gray-700 flex gap-2"><span class="text-green-500">▸</span>${escapeHtml(l)}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${mode === 'patient' && ia.explicacao_paciente ? `
          <div class="bg-green-50 rounded-lg p-4 mb-3 border border-green-100">
            <h6 class="text-xs font-bold text-green-700 uppercase mb-2">Explicação para o Paciente</h6>
            <p class="text-sm text-green-900">${escapeHtml(ia.explicacao_paciente)}</p>
          </div>` : ''}

        ${ia.aviso ? `
          <div class="bg-yellow-50 rounded-lg p-3 border border-yellow-100 text-xs text-yellow-700">
            ${escapeHtml(ia.aviso)}
          </div>` : ''}
      </div>` : '';

    // Sugestões clínicas
    const priorColors = {
      urgente: 'bg-red-600 text-white',
      alta:    'bg-orange-500 text-white',
      media:   'bg-yellow-400 text-gray-900',
      baixa:   'bg-gray-200 text-gray-700',
    };
    const sugestoesHtml = (data.sugestoes || []).length > 0 ? `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        <h5 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <i class="fas fa-clipboard-list text-blue-500"></i> Condutas Sugeridas
        </h5>
        <div class="space-y-2">
          ${(data.sugestoes || []).map(s => `
            <div class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span class="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${priorColors[s.prioridade] || 'bg-gray-200'}">
                ${(s.prioridade || '').toUpperCase()}
              </span>
              <div>
                <p class="text-sm font-semibold text-gray-800">${escapeHtml(s.titulo)}</p>
                <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(s.detalhe)}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>` : '';

    resultado.innerHTML = `
      <!-- Score -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Score Hematológico</p>
            ${patientName ? `<p class="text-xs text-gray-400">${escapeHtml(patientName)}</p>` : ''}
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold text-${scoreColor}-600">${score}<span class="text-lg text-gray-400">/100</span></div>
            <div class="text-xs font-medium text-${scoreColor}-600 uppercase">${scoreLabel}</div>
          </div>
        </div>
        <div class="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-${scoreColor}-500 rounded-full transition-all duration-700" style="width:${score}%"></div>
        </div>
        <p class="text-xs text-gray-400 mt-2">${data.parametros_analisados || 0} parâmetro(s) analisado(s)</p>
      </div>

      ${alertasCriticos}
      ${padroesHtml}
      ${relatorioHtml}

      <!-- Achados -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        <h5 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <i class="fas fa-list-alt text-red-500"></i> Achados por Série
        </h5>
        ${achadosHtml || '<p class="text-sm text-gray-400">Nenhum parâmetro analisado.</p>'}
      </div>

      ${sugestoesHtml}

      <!-- Botão nova análise -->
      <button onclick="HemogramaSimulator.limpar()"
        class="w-full mt-2 border border-gray-200 text-gray-600 font-medium py-2 rounded-xl hover:bg-gray-50 text-sm transition">
        <i class="fas fa-redo mr-2"></i>Nova Análise
      </button>
    `;
  },

  limpar() {
    if (this.currentTab === 'upload') {
      this.clearFile();
      ['hg-up-name','hg-up-sexo','hg-up-idade'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const res = document.getElementById('hg-up-resultado');
      if (res) res.innerHTML = `
        <div class="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 h-full flex items-center justify-center">
          <div>
            <i class="fas fa-file-upload text-4xl mb-3 opacity-30"></i>
            <p class="text-sm">Faça upload do laudo<br>para iniciar a análise</p>
          </div>
        </div>`;
    } else {
      const ids = [
        'hg-patient-name','hg-sexo','hg-idade',
        'hg-hemoglobina','hg-hematocrito','hg-eritrocitos','hg-vcm','hg-hcm','hg-chcm','hg-rdw',
        'hg-leucocitos',
        'hg-neutrofilos','hg-linfocitos','hg-monocitos','hg-eosinofilos','hg-basofilos','hg-bastoes',
        'hg-plaquetas',
      ];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const resultado = document.getElementById('hg-resultado');
      if (resultado) resultado.innerHTML = `
        <div class="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 h-full flex items-center justify-center">
          <div>
            <i class="fas fa-microscope text-4xl mb-3 opacity-30"></i>
            <p class="text-sm">Preencha os valores do hemograma<br>e clique em Analisar</p>
          </div>
        </div>`;
    }
  },
};

// Iniciar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

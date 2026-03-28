// ============================================================
// CLINICAL INTELLIGENCE — Interpretação Laboratorial + IA Real
// Rota base: /api/clinical
//
// POST /analyze   → regras clínicas + relatório OpenAI (GPT-4o)
// GET  /ranges    → tabela de referências funcionais (público)
// ============================================================

import { Hono } from 'hono'
import { authMiddleware } from '../auth/middleware'
import { labAnalysisSchema, validateBody } from '../validators/schemas'
import type { AppEnv } from '../lib/types'

const app = new Hono<AppEnv>()

// ─────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────

interface Finding {
  marker: string
  value: number
  unit: string
  status: 'low' | 'high' | 'borderline' | 'ok'
  reference: string
  message: string
  severity: 'low' | 'medium' | 'high'
}

interface Suggestion {
  category: 'nutrition' | 'supplementation' | 'lifestyle' | 'further_testing' | 'clinical_referral'
  title: string
  detail: string
  priority: 'low' | 'medium' | 'high'
}

interface LabInput {
  ferritin?: number
  b12?: number
  tsh?: number
  vitaminD?: number
  insulin?: number
  glucose?: number
}

// ─────────────────────────────────────────────────────────────
// MOTOR DE REGRAS CLÍNICAS
// Referências: SBME, SBD, ABE&M, UpToDate
// ─────────────────────────────────────────────────────────────

function evaluateMarkers(labs: LabInput): {
  findings: Finding[]
  suggestions: Suggestion[]
} {
  const findings: Finding[] = []
  const suggestions: Suggestion[] = []
  const { ferritin, b12, tsh, vitaminD, insulin, glucose } = labs

  // ── FERRITINA ─────────────────────────────────────────────
  if (ferritin !== undefined) {
    if (ferritin < 20) {
      findings.push({ marker: 'Ferritina', value: ferritin, unit: 'ng/mL', status: 'low',
        reference: '< 20 ng/mL = depleção grave',
        message: 'Ferritina criticamente baixa — depleção grave de ferro. Risco elevado de anemia ferropriva.',
        severity: 'high' })
      suggestions.push({ category: 'supplementation', priority: 'high',
        title: 'Suplementação de Ferro Urgente',
        detail: 'Ferro quelado (bisglitinato ferroso) 30–60 mg/dia em jejum. Solicitar hemograma completo, reticulócitos e VCM. Investigar causa (sangramento, má absorção).' })
    } else if (ferritin < 70) {
      findings.push({ marker: 'Ferritina', value: ferritin, unit: 'ng/mL', status: 'low',
        reference: 'Ideal funcional: 70–150 ng/mL',
        message: 'Ferritina abaixo do ideal funcional. Pode causar fadiga, queda capilar e redução cognitiva mesmo sem anemia instalada.',
        severity: 'medium' })
      suggestions.push({ category: 'supplementation', priority: 'medium',
        title: 'Reposição de Ferro',
        detail: 'Ferro quelado 15–30 mg/dia + vitamina C para absorção. Aumentar fontes heme (carne vermelha magra, fígado). Evitar cálcio e chá preto próximos à dose.' })
      suggestions.push({ category: 'further_testing', priority: 'medium',
        title: 'Avaliar Causa da Ferritina Baixa',
        detail: 'Solicitar PCR (inflamação pode mascarar deficiência), saturação de transferrina e ferro sérico.' })
    } else if (ferritin > 200) {
      findings.push({ marker: 'Ferritina', value: ferritin, unit: 'ng/mL', status: 'high',
        reference: '> 200 ng/mL = elevada',
        message: 'Ferritina elevada — pode indicar inflamação crônica, sobrecarga de ferro ou síndrome metabólica.',
        severity: 'medium' })
      suggestions.push({ category: 'further_testing', priority: 'medium',
        title: 'Investigar Causa da Ferritina Elevada',
        detail: 'Solicitar PCR, VHS, saturação de transferrina, mutação HFE (hemocromatose) e função hepática (TGO, TGP, GGT).' })
    } else {
      findings.push({ marker: 'Ferritina', value: ferritin, unit: 'ng/mL', status: 'ok',
        reference: '70–200 ng/mL', message: 'Ferritina dentro da faixa funcional ideal.', severity: 'low' })
    }
  }

  // ── VITAMINA B12 ──────────────────────────────────────────
  if (b12 !== undefined) {
    if (b12 < 300) {
      findings.push({ marker: 'Vitamina B12', value: b12, unit: 'pg/mL', status: 'low',
        reference: '< 300 pg/mL = deficiência',
        message: 'B12 com deficiência confirmada — alto risco neurológico. Pode causar neuropatia periférica, déficit cognitivo e megaloblastose.',
        severity: 'high' })
      suggestions.push({ category: 'supplementation', priority: 'high',
        title: 'Reposição de B12 Urgente',
        detail: 'Metilcobalamina sublingual 1.000–5.000 mcg/dia ou intramuscular se má absorção confirmada. Investigar metformina, IBP ou doença gástrica como causa.' })
    } else if (b12 < 500) {
      findings.push({ marker: 'Vitamina B12', value: b12, unit: 'pg/mL', status: 'borderline',
        reference: 'Ideal funcional: ≥ 500 pg/mL',
        message: 'B12 abaixo do ideal funcional. Pode causar sintomas neurológicos subclínicos: formigamento, esquecimento, fadiga.',
        severity: 'medium' })
      suggestions.push({ category: 'supplementation', priority: 'medium',
        title: 'Suplementação de B12',
        detail: 'Metilcobalamina 500–1.000 mcg/dia. Evitar cianocobalamina (menor biodisponibilidade). Incluir ovos, laticínios e carnes na dieta.' })
    } else {
      findings.push({ marker: 'Vitamina B12', value: b12, unit: 'pg/mL', status: 'ok',
        reference: '≥ 500 pg/mL', message: 'Vitamina B12 na faixa funcional ideal.', severity: 'low' })
    }
  }

  // ── TSH ───────────────────────────────────────────────────
  if (tsh !== undefined) {
    if (tsh < 0.4) {
      findings.push({ marker: 'TSH', value: tsh, unit: 'mUI/L', status: 'low',
        reference: '< 0,4 mUI/L = hipertireoidismo',
        message: 'TSH suprimido — sugere hipertireoidismo ou excesso de hormônio tireoidiano exógeno. Requer investigação urgente.',
        severity: 'high' })
      suggestions.push({ category: 'clinical_referral', priority: 'high',
        title: 'Encaminhamento Endocrinológico Urgente',
        detail: 'TSH suprimido requer avaliação endocrinológica. Solicitar T4 livre, T3 total, anti-TPO e cintilografia se indicado.' })
    } else if (tsh > 4.0) {
      findings.push({ marker: 'TSH', value: tsh, unit: 'mUI/L', status: 'high',
        reference: '> 4,0 mUI/L = hipotireoidismo',
        message: 'TSH elevado — confirma hipotireoidismo. Necessita avaliação clínica e possível tratamento.',
        severity: 'high' })
      suggestions.push({ category: 'clinical_referral', priority: 'high',
        title: 'Avaliação Endocrinológica',
        detail: 'Solicitar T4 livre, anti-TPO e anti-Tg. Discutir com endocrinologista indicação de levotiroxina.' })
    } else if (tsh > 2.0) {
      findings.push({ marker: 'TSH', value: tsh, unit: 'mUI/L', status: 'borderline',
        reference: 'Ideal funcional: 1,0–2,0 mUI/L',
        message: 'TSH acima do ideal funcional (ainda dentro do convencional). Possível hipotireoidismo subclínico — pode causar cansaço, ganho de peso e lentidão cognitiva.',
        severity: 'medium' })
      suggestions.push({ category: 'further_testing', priority: 'medium',
        title: 'Investigação Tireoidiana Completa',
        detail: 'Solicitar T4 livre, T3 livre, anti-TPO e anti-Tg. Verificar status de selênio e iodo.' })
      suggestions.push({ category: 'supplementation', priority: 'low',
        title: 'Suporte Nutricional para Tireoide',
        detail: 'Selênio 100–200 mcg/dia (selenometionina), zinco 10–30 mg/dia, iodo adequado na dieta. Evitar excesso de crucíferas cruas e soja.' })
    } else {
      findings.push({ marker: 'TSH', value: tsh, unit: 'mUI/L', status: 'ok',
        reference: '0,4–2,0 mUI/L', message: 'TSH dentro da faixa funcional adequada.', severity: 'low' })
    }
  }

  // ── VITAMINA D ────────────────────────────────────────────
  if (vitaminD !== undefined) {
    if (vitaminD < 20) {
      findings.push({ marker: 'Vitamina D', value: vitaminD, unit: 'ng/mL', status: 'low',
        reference: '< 20 ng/mL = deficiência grave',
        message: 'Vitamina D criticamente baixa — impacto direto em imunidade, massa óssea, humor e resistência à insulina.',
        severity: 'high' })
      suggestions.push({ category: 'supplementation', priority: 'high',
        title: 'Reposição de Vitamina D3 Urgente',
        detail: 'Colecalciferol 10.000–50.000 UI/dia por 8–12 semanas (supervisão médica). Associar K2-MK7 100–200 mcg/dia. Repetir dosagem em 3 meses.' })
    } else if (vitaminD < 40) {
      findings.push({ marker: 'Vitamina D', value: vitaminD, unit: 'ng/mL', status: 'low',
        reference: 'Ideal funcional: 60–80 ng/mL',
        message: 'Vitamina D deficiente — associada a fadiga, infecções frequentes e risco aumentado de doenças autoimunes.',
        severity: 'medium' })
      suggestions.push({ category: 'supplementation', priority: 'medium',
        title: 'Suplementação de Vitamina D3',
        detail: 'Colecalciferol 5.000–10.000 UI/dia com gordura alimentar. Associar K2-MK7 100 mcg/dia. Exposição solar 15–20 min/dia. Reavaliar em 3 meses.' })
    } else if (vitaminD > 100) {
      findings.push({ marker: 'Vitamina D', value: vitaminD, unit: 'ng/mL', status: 'high',
        reference: '> 100 ng/mL = risco de toxicidade',
        message: 'Vitamina D acima de 100 ng/mL — avaliar risco de hipervitaminose D com hipercalcemia.',
        severity: 'medium' })
      suggestions.push({ category: 'further_testing', priority: 'medium',
        title: 'Monitorar Cálcio e PTH',
        detail: 'Suspender ou reduzir suplementação de D3. Solicitar cálcio sérico, cálcio urinário e PTH.' })
    } else {
      findings.push({ marker: 'Vitamina D', value: vitaminD, unit: 'ng/mL', status: 'ok',
        reference: '40–100 ng/mL', message: 'Vitamina D em nível adequado.', severity: 'low' })
    }
  }

  // ── INSULINA DE JEJUM ─────────────────────────────────────
  if (insulin !== undefined) {
    if (insulin > 15) {
      findings.push({ marker: 'Insulina de Jejum', value: insulin, unit: 'mUI/L', status: 'high',
        reference: '> 15 mUI/L = resistência insulínica significativa',
        message: 'Insulina de jejum muito elevada — resistência à insulina confirmada. Alto risco de pré-diabetes, SOP e ganho de peso abdominal.',
        severity: 'high' })
      suggestions.push({ category: 'lifestyle', priority: 'high',
        title: 'Intervenção no Estilo de Vida',
        detail: 'Reduzir carboidratos refinados. Jejum intermitente 16:8 se tolerado. Exercícios de resistência 3–4x/semana.' })
      suggestions.push({ category: 'supplementation', priority: 'high',
        title: 'Suplementação Sensibilizadora de Insulina',
        detail: 'Berberina 500 mg 2x/dia ou Inositol (mio + D-chiro) 4g/dia. Cromo picolinato 200–400 mcg/dia. Magnésio quelado 300–400 mg/dia.' })
      suggestions.push({ category: 'further_testing', priority: 'medium',
        title: 'Perfil Metabólico Completo',
        detail: 'HOMA-IR (insulina × glicose / 405), HbA1c, lipidograma, PCR ultrassensível, testosterona/DHEA se feminina (rastrear SOP).' })
    } else if (insulin > 7) {
      findings.push({ marker: 'Insulina de Jejum', value: insulin, unit: 'mUI/L', status: 'borderline',
        reference: 'Ideal funcional: < 7 mUI/L',
        message: 'Insulina acima do ideal funcional — possível início de resistência insulínica. Frequentemente assintomática nesta fase.',
        severity: 'medium' })
      suggestions.push({ category: 'lifestyle', priority: 'medium',
        title: 'Ajuste Alimentar Preventivo',
        detail: 'Reduzir índice glicêmico: priorizar fibras, proteínas e gorduras boas. Caminhar 20–30 min após refeições. Reduzir açúcar e álcool.' })
      suggestions.push({ category: 'supplementation', priority: 'low',
        title: 'Suporte Metabólico',
        detail: 'Magnésio quelado 300 mg/dia, cromo picolinato 200 mcg/dia e canela de Ceilão 500–1.000 mg/dia.' })
    } else {
      findings.push({ marker: 'Insulina de Jejum', value: insulin, unit: 'mUI/L', status: 'ok',
        reference: '< 7 mUI/L', message: 'Insulina de jejum dentro da faixa funcional ideal.', severity: 'low' })
    }
  }

  // ── GLICOSE DE JEJUM ──────────────────────────────────────
  if (glucose !== undefined) {
    if (glucose >= 126) {
      findings.push({ marker: 'Glicose de Jejum', value: glucose, unit: 'mg/dL', status: 'high',
        reference: '≥ 126 mg/dL = critério diagnóstico de DM',
        message: 'Glicose no critério diagnóstico de diabetes mellitus. Necessita atenção médica imediata.',
        severity: 'high' })
      suggestions.push({ category: 'clinical_referral', priority: 'high',
        title: 'Avaliação Médica Urgente',
        detail: 'Confirmar diagnóstico com segunda dosagem ou TTGO. Solicitar HbA1c, função renal e lipidograma.' })
    } else if (glucose >= 100) {
      findings.push({ marker: 'Glicose de Jejum', value: glucose, unit: 'mg/dL', status: 'borderline',
        reference: '100–125 mg/dL = pré-diabetes',
        message: 'Glicose na faixa de pré-diabetes. ~30% progridem para DM2 em 5 anos sem intervenção.',
        severity: 'high' })
      suggestions.push({ category: 'lifestyle', priority: 'high',
        title: 'Reversão de Pré-Diabetes',
        detail: 'Perda de 7–10% do peso reduz risco em até 58% (estudo DPP). Dieta de baixo IG, rica em fibras. Exercício 150 min/semana.' })
      suggestions.push({ category: 'further_testing', priority: 'medium',
        title: 'Rastreio Metabólico Completo',
        detail: 'HbA1c, insulina de jejum, HOMA-IR e TTGO. Pressão arterial, lipidograma e circunferência abdominal.' })
    } else if (glucose >= 90) {
      findings.push({ marker: 'Glicose de Jejum', value: glucose, unit: 'mg/dL', status: 'borderline',
        reference: 'Ideal funcional: < 90 mg/dL',
        message: 'Glicose levemente acima do ideal funcional. Não configura pré-diabetes, mas merece atenção preventiva.',
        severity: 'low' })
      suggestions.push({ category: 'nutrition', priority: 'low',
        title: 'Ajuste Dietético Preventivo',
        detail: 'Reduzir açúcar adicionado e farinhas refinadas. Incluir mais vegetais, leguminosas e proteínas magras.' })
    } else {
      findings.push({ marker: 'Glicose de Jejum', value: glucose, unit: 'mg/dL', status: 'ok',
        reference: '70–89 mg/dL', message: 'Glicose de jejum dentro da faixa funcional ideal.', severity: 'low' })
    }
  }

  // ── REGRAS COMBINADAS ─────────────────────────────────────

  // Ferritina + B12 baixos → má absorção intestinal
  if (ferritin !== undefined && ferritin < 70 && b12 !== undefined && b12 < 500) {
    findings.push({ marker: 'Alerta Combinado: Ferritina + B12', value: 0, unit: '',
      status: 'low', reference: 'Ambos abaixo do ideal funcional', severity: 'high',
      message: 'Ferritina e B12 simultaneamente baixos — possível problema de absorção intestinal (disbiose, gastrite atrófica, doença celíaca ou uso de IBP).' })
    suggestions.push({ category: 'further_testing', priority: 'high',
      title: 'Investigação de Má Absorção Intestinal',
      detail: 'Anti-transglutaminase IgA + IgG total (doença celíaca), calprotectina fecal, pepsinogênio I/II, H. pylori (teste respiratório). Considerar endoscopia alta com biópsia.' })
    suggestions.push({ category: 'supplementation', priority: 'medium',
      title: 'Suporte à Mucosa Intestinal',
      detail: 'Enzimas digestivas com HCl betaína antes das refeições. Probióticos multiestirpe 10–50 bilhões UFC/dia. L-glutamina 5–15 g/dia em jejum.' })
  }

  // Insulina + Glicose elevados → síndrome metabólica
  if (insulin !== undefined && insulin > 7 && glucose !== undefined && glucose >= 100) {
    findings.push({ marker: 'Alerta Combinado: Insulina + Glicose', value: 0, unit: '',
      status: 'high', reference: 'Padrão de síndrome metabólica', severity: 'high',
      message: 'Insulina elevada + glicose ≥ 100 mg/dL — padrão de síndrome metabólica. Risco elevado de progressão para DM2.' })
    suggestions.push({ category: 'lifestyle', priority: 'high',
      title: 'Intervenção Metabólica Intensiva',
      detail: 'Restrição de carboidratos processados, jejum intermitente supervisionado, exercício de resistência + cardio, otimização do sono (< 6h aumenta resistência à insulina em 40%). Acompanhamento multidisciplinar.' })
  }

  // Ordenar sugestões por prioridade
  const order = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => order[a.priority] - order[b.priority])

  return { findings, suggestions }
}

// ─────────────────────────────────────────────────────────────
// CAMADA DE IA — OpenAI GPT-4o (com fallback local)
// ─────────────────────────────────────────────────────────────

interface AIReport {
  summary: string           // resumo executivo para o profissional
  patient_explanation: string  // linguagem simples para o paciente
  priority_actions: string[]   // lista de ações prioritárias
  generated_by: 'openai' | 'local'
}

async function generateAIReport(
  labs: LabInput,
  findings: Finding[],
  suggestions: Suggestion[],
  openaiApiKey: string | undefined,
): Promise<AIReport> {

  // Se não tiver chave, usar fallback local estruturado
  if (!openaiApiKey) {
    return buildLocalReport(labs, findings, suggestions)
  }

  // Preparar contexto para o GPT
  const labLines = Object.entries(labs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const findingLines = findings
    .filter(f => f.status !== 'ok' && !f.marker.startsWith('Alerta'))
    .map(f => `- ${f.marker} (${f.status.toUpperCase()}, severidade: ${f.severity}): ${f.message}`)
    .join('\n')

  const combinedAlerts = findings
    .filter(f => f.marker.startsWith('Alerta'))
    .map(f => `- ${f.marker}: ${f.message}`)
    .join('\n')

  const suggestionLines = suggestions
    .filter(s => s.priority === 'high')
    .map(s => `- [${s.category}] ${s.title}: ${s.detail}`)
    .join('\n')

  const systemPrompt = `Você é um médico especialista em medicina funcional, nutrição clínica e medicina integrativa.
Analise os exames laboratoriais e os achados clínicos fornecidos.
Responda SEMPRE em português brasileiro.
Seja preciso, empático e clinicamente correto.
Use linguagem técnica no resumo do profissional e linguagem simples para o paciente.`

  const userPrompt = `## Exames Laboratoriais
${labLines}

## Achados Clínicos Identificados
${findingLines || 'Nenhuma alteração individual significativa.'}

## Alertas de Combinação
${combinedAlerts || 'Nenhum alerta combinado.'}

## Principais Sugestões
${suggestionLines || 'Nenhuma sugestão prioritária.'}

Responda em JSON com exatamente esta estrutura:
{
  "summary": "Resumo técnico para o profissional de saúde (2–4 frases, incluindo correlações clínicas e raciocínio diagnóstico)",
  "patient_explanation": "Explicação em linguagem simples para o paciente (3–5 frases, sem termos técnicos, tom encorajador e sem alarmar)",
  "priority_actions": ["Ação 1 objetiva", "Ação 2 objetiva", "Ação 3 objetiva"]
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.3,   // baixo para consistência clínica
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', response.status, errorText)
      return buildLocalReport(labs, findings, suggestions)
    }

    const json = await response.json() as {
      choices: Array<{ message: { content: string } }>
      usage?: { total_tokens: number }
    }

    const content = json.choices?.[0]?.message?.content
    if (!content) {
      return buildLocalReport(labs, findings, suggestions)
    }

    const parsed = JSON.parse(content) as Partial<AIReport>

    return {
      summary: parsed.summary ?? 'Relatório indisponível.',
      patient_explanation: parsed.patient_explanation ?? 'Explicação indisponível.',
      priority_actions: Array.isArray(parsed.priority_actions) ? parsed.priority_actions : [],
      generated_by: 'openai',
    }
  } catch (err) {
    console.error('OpenAI call failed, using local fallback:', err)
    return buildLocalReport(labs, findings, suggestions)
  }
}

// ─────────────────────────────────────────────────────────────
// FALLBACK LOCAL — relatório estruturado sem IA externa
// ─────────────────────────────────────────────────────────────

function buildLocalReport(
  _labs: LabInput,
  findings: Finding[],
  suggestions: Suggestion[],
): AIReport {
  const abnormal = findings.filter(f => f.status !== 'ok' && !f.marker.startsWith('Alerta'))
  const high = abnormal.filter(f => f.severity === 'high')
  const alerts = findings.filter(f => f.marker.startsWith('Alerta'))

  // Resumo técnico
  let summary: string
  if (abnormal.length === 0) {
    summary = 'Perfil laboratorial dentro dos parâmetros funcionais ideais. Nenhuma intervenção imediata indicada.'
  } else {
    const markers = abnormal.map(f => f.marker).join(', ')
    const alertText = alerts.length > 0
      ? ` Detectado(s) ${alerts.length} alerta(s) de combinação que merecem atenção especial.`
      : ''
    summary = `Foram identificadas alterações em: ${markers}.${alertText} ${
      high.length > 0
        ? `${high.length} marcador(es) com severidade alta requerem atenção prioritária.`
        : 'As alterações são de severidade moderada a leve.'
    }`
  }

  // Explicação para o paciente
  let patientExplanation: string
  if (abnormal.length === 0) {
    patientExplanation = 'Seus exames estão dentro dos valores ideais. Continue mantendo seus hábitos saudáveis e faça acompanhamento periódico com seu profissional de saúde.'
  } else {
    patientExplanation = `Seus exames mostraram alguns pontos que merecem atenção. ${
      high.length > 0
        ? 'Há itens importantes que devem ser acompanhados de perto pelo seu profissional de saúde.'
        : 'Os ajustes necessários são simples e podem fazer grande diferença no seu bem-estar.'
    } Siga as orientações do seu profissional e não se preocupe — com os cuidados certos você verá melhora.`
  }

  // Ações prioritárias a partir das sugestões de alta prioridade
  const priorityActions = suggestions
    .filter(s => s.priority === 'high')
    .slice(0, 5)
    .map(s => s.title)

  if (priorityActions.length === 0) {
    priorityActions.push('Manter hábitos saudáveis e acompanhamento periódico.')
  }

  return {
    summary,
    patient_explanation: patientExplanation,
    priority_actions: priorityActions,
    generated_by: 'local',
  }
}

// ─────────────────────────────────────────────────────────────
// POST /analyze
// ─────────────────────────────────────────────────────────────

app.post('/analyze', authMiddleware, async (c) => {
  try {
    const body = await c.req.json()

    const validated = validateBody(labAnalysisSchema, body)
    if (!validated.success) {
      return c.json({
        success: false,
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: validated.errors,
      }, 400)
    }

    const labs = validated.data.labs

    // Motor de regras clínicas
    const { findings, suggestions } = evaluateMarkers(labs)

    // Score de saúde (0–100)
    const individual = findings.filter(f => !f.marker.startsWith('Alerta'))
    const abnormalCount = individual.filter(f => f.status !== 'ok').length
    const healthScore = individual.length > 0
      ? Math.round(((individual.length - abnormalCount) / individual.length) * 100)
      : 100

    // Separar alertas combinados
    const individualFindings = individual
    const combinationAlerts = findings.filter(f => f.marker.startsWith('Alerta'))

    // Gerar relatório com IA (ou fallback)
    const aiReport = await generateAIReport(
      labs,
      findings,
      suggestions,
      c.env.OPENAI_API_KEY,
    )

    // Registrar interação no banco (não bloqueia resposta em caso de falha)
    const professionalId = c.get('professionalId')
    try {
      const markersAnalyzed = Object.keys(labs)
        .filter(k => (labs as Record<string, unknown>)[k] !== undefined)
        .join(', ')
      await c.env.DB.prepare(`
        INSERT INTO ai_interactions
          (professional_id, patient_id, context_type, prompt, response, tokens_used, created_at)
        VALUES (?, NULL, 'lab_interpretation', ?, ?, 0, CURRENT_TIMESTAMP)
      `).bind(
        professionalId,
        `Análise laboratorial: ${markersAnalyzed}`,
        JSON.stringify({
          health_score: healthScore,
          findings_count: individualFindings.length,
          suggestions_count: suggestions.length,
          generated_by: aiReport.generated_by,
        }),
      ).run()
    } catch {
      // Falha no log não interrompe a resposta
    }

    // ── Resposta padrão do sistema: { success, data } ──────
    return c.json({
      success: true,
      data: {
        health_score: healthScore,
        markers_analyzed: Object.keys(labs).filter(
          k => (labs as Record<string, unknown>)[k] !== undefined
        ).length,
        findings: individualFindings,
        combination_alerts: combinationAlerts,
        suggestions,
        ai_report: aiReport,
        disclaimer:
          'Esta análise é uma ferramenta de apoio clínico e não substitui a avaliação médica individualizada.',
      },
    })

  } catch (err) {
    console.error('Clinical intelligence error:', err)
    return c.json({
      success: false,
      error: 'Erro interno ao processar análise clínica.',
      code: 'INTERNAL_ERROR',
    }, 500)
  }
})

// ─────────────────────────────────────────────────────────────
// GET /ranges  — tabela de referências (público)
// ─────────────────────────────────────────────────────────────

app.get('/ranges', (c) => {
  return c.json({
    success: true,
    data: {
      note: 'Valores de referência funcionais (podem diferir dos laboratoriais convencionais)',
      markers: {
        ferritin:  { unit: 'ng/mL',  optimal: '70–150',  low: '20–69',   critically_low: '< 20',  high: '> 200' },
        b12:       { unit: 'pg/mL',  optimal: '≥ 500',   borderline: '300–499', deficient: '< 300' },
        tsh:       { unit: 'mUI/L',  optimal: '1,0–2,0', borderline: '2,1–4,0', hypothyroid: '> 4,0', hyperthyroid: '< 0,4' },
        vitaminD:  { unit: 'ng/mL',  optimal: '60–80',   adequate: '40–59',      deficient: '20–39',  critically_deficient: '< 20', excessive: '> 100' },
        insulin:   { unit: 'mUI/L',  optimal: '< 5',     acceptable: '5–7',      borderline: '7–15',  resistant: '> 15' },
        glucose:   { unit: 'mg/dL',  optimal: '70–89',   acceptable: '90–99',    prediabetes: '100–125', diabetes: '≥ 126' },
      },
    },
  })
})

export default app

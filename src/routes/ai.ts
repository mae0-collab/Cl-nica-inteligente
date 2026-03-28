// ============================================================
// ROUTES - AI ASSISTANT
// Responses API + Structured Outputs (JSON Schema estrito)
// store: false — sem retenção do objeto de resposta no OpenAI
// ============================================================

import { Hono } from 'hono'
import OpenAI from 'openai'
import { z } from 'zod'
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware'
import { AIChatSchema, validateBody } from '../validators/schemas'
import type { AppEnv } from '../lib/types'

const aiRoutes = new Hono<AppEnv>()

aiRoutes.use('*', authMiddleware)

// ─────────────────────────────────────────────────────────────
// Schema da nova rota /clinical-report
// ─────────────────────────────────────────────────────────────

const ClinicalReportSchema = z.object({
  patientName: z.string().min(1).max(120).optional(),
  findings:    z.array(z.string().min(1)).min(1, 'Pelo menos um achado é obrigatório'),
  suggestions: z.array(z.string().min(1)).default([]),
  labs:        z.record(z.union([z.number(), z.string(), z.null()])).default({}),
  mode:        z.enum(['clinical', 'patient']).default('clinical'),
})

// ─────────────────────────────────────────────────────────────
// Structured Output schema (JSON Schema estrito)
// ─────────────────────────────────────────────────────────────

const CLINICAL_REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
    },
    clinicalInterpretation: {
      type: 'array',
      items: { type: 'string' },
    },
    patientFriendlyExplanation: {
      type: 'string',
    },
    followUpQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
    caution: {
      type: 'string',
    },
  },
  required: [
    'summary',
    'clinicalInterpretation',
    'patientFriendlyExplanation',
    'followUpQuestions',
    'caution',
  ],
} as const

// Tipo TypeScript derivado do schema
interface ClinicalReportOutput {
  summary: string
  clinicalInterpretation: string[]
  patientFriendlyExplanation: string
  followUpQuestions: string[]
  caution: string
}

// ─────────────────────────────────────────────────────────────
// Factory: inicializar cliente OpenAI
// Cloudflare Workers não expõe process.env — usa c.env (Bindings)
// ─────────────────────────────────────────────────────────────

function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    // Cloudflare Workers: desativar tentativas de ler env do Node.js
    dangerouslyAllowBrowser: false,
  })
}

// ─────────────────────────────────────────────────────────────
// System prompts por modo
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(mode: 'clinical' | 'patient'): string {
  if (mode === 'patient') {
    return [
      'Você é um assistente de apoio clínico.',
      'Explique os achados em linguagem simples, sem jargão desnecessário.',
      'Não dê diagnóstico definitivo.',
      'Não prescreva como autoridade médica.',
      'Não invente dados não fornecidos.',
      'Seja claro, cauteloso e encorajador.',
      'Deixe explícito que a decisão final cabe ao profissional de saúde.',
      'Responda em português brasileiro.',
    ].join(' ')
  }

  return [
    'Você é um assistente de apoio à decisão clínica para profissionais de saúde.',
    'Sua função é organizar e interpretar os achados laboratoriais e clínicos recebidos.',
    'Não dê diagnóstico definitivo nem substitua julgamento médico.',
    'Não invente exames, sintomas ou histórico não fornecidos.',
    'Seja técnico, conciso e cauteloso.',
    'Aponte limitações quando faltarem dados para uma conclusão completa.',
    'Baseie-se em evidências científicas.',
    'Responda em português brasileiro.',
  ].join(' ')
}

// ─────────────────────────────────────────────────────────────
// Fallback local (sem API key ou em caso de falha)
// ─────────────────────────────────────────────────────────────

function buildLocalClinicalReport(
  findings: string[],
  suggestions: string[],
  mode: 'clinical' | 'patient',
): ClinicalReportOutput {
  const topFindings = findings.slice(0, 3).join('; ')

  return {
    summary:
      mode === 'clinical'
        ? `Foram identificados ${findings.length} achado(s) clínico(s): ${topFindings}. Avaliação e conduta ficam a critério do profissional responsável.`
        : `Seus exames mostram alguns pontos que seu profissional de saúde vai analisar com você.`,

    clinicalInterpretation: findings.map(
      (f) => `Achado identificado: ${f}`,
    ),

    patientFriendlyExplanation:
      mode === 'patient'
        ? `Seu profissional identificou alguns pontos nos seus exames. ${
            findings.length > 0
              ? 'Existem itens que merecem atenção — siga as orientações do seu profissional de saúde.'
              : 'No geral, seus exames estão dentro do esperado.'
          } Com os cuidados certos, você verá melhora.`
        : `${findings.length} achado(s) identificado(s). Avalie individualmente cada ponto com o paciente.`,

    followUpQuestions:
      suggestions.length > 0
        ? suggestions.slice(0, 3).map((s) => `Considerar: ${s}`)
        : ['Reavaliar após intervenções recomendadas.', 'Repetir exames em 60–90 dias.'],

    caution:
      'Este relatório é gerado por um sistema de apoio à decisão clínica e não substitui a avaliação médica individualizada. Configure OPENAI_API_KEY para relatórios com IA real.',
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/ai/clinical-report  — Responses API + Structured Outputs
// ─────────────────────────────────────────────────────────────

aiRoutes.post('/clinical-report', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY, OPENAI_MODEL } = c.env

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ success: false, error: 'Corpo da requisição inválido' }, 400)

  const validation = validateBody(ClinicalReportSchema, body)
  if (!validation.success) {
    return c.json({ success: false, error: 'Dados inválidos', details: validation.errors }, 400)
  }

  const { patientName, findings, suggestions, labs, mode } = validation.data
  const model = OPENAI_MODEL ?? 'gpt-4o'
  const startTime = Date.now()

  let report: ClinicalReportOutput
  let generatedBy: 'openai' | 'local' = 'local'
  let tokensUsed = 0

  if (OPENAI_API_KEY) {
    try {
      const client = createOpenAIClient(OPENAI_API_KEY)

      const userContent = JSON.stringify({
        generatedByUserId: professionalId,
        patientName:       patientName ?? null,
        findings,
        suggestions,
        labs,
        instruction:
          mode === 'patient'
            ? 'Gere explicação para o paciente em linguagem acessível.'
            : 'Gere relatório clínico técnico para o profissional de saúde.',
      })

      // Responses API com Structured Outputs (JSON Schema estrito)
      const response = await client.responses.create({
        model,
        store: false,    // sem retenção do objeto no OpenAI
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: buildSystemPrompt(mode) }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: userContent }],
          },
        ],
        text: {
          format: {
            type:   'json_schema',
            name:   'clinical_report',
            strict: true,
            schema: CLINICAL_REPORT_JSON_SCHEMA,
          },
        },
      })

      const raw = response.output_text

      // Parse seguro — Structured Outputs garante JSON válido,
      // mas defensivamente tratamos possíveis falhas
      try {
        report = JSON.parse(raw) as ClinicalReportOutput
        generatedBy = 'openai'
        // usage pode não estar disponível em todas as versões da Responses API
        tokensUsed = (response as any).usage?.total_tokens ?? 0
      } catch {
        console.error('Responses API retornou JSON inválido, usando fallback:', raw)
        report = buildLocalClinicalReport(findings, suggestions, mode)
      }
    } catch (err) {
      console.error('Falha na chamada OpenAI Responses API:', err)
      report = buildLocalClinicalReport(findings, suggestions, mode)
    }
  } else {
    // Sem API key — fallback local estruturado
    report = buildLocalClinicalReport(findings, suggestions, mode)
  }

  const responseTimeMs = Date.now() - startTime

  // Registrar interação no banco
  try {
    await DB.prepare(`
      INSERT INTO ai_interactions
        (professional_id, context_type, patient_id, user_prompt, ai_response, tokens_used, response_time_ms)
      VALUES (?, 'lab_interpretation', NULL, ?, ?, ?, ?)
    `).bind(
      professionalId,
      JSON.stringify({ findings, labs, mode }),
      JSON.stringify(report),
      tokensUsed,
      responseTimeMs,
    ).run()
  } catch {
    // Falha no log não interrompe a resposta
  }

  return c.json({
    success: true,
    data: {
      model:            OPENAI_API_KEY ? model : null,
      generated_by:     generatedBy,
      response_time_ms: responseTimeMs,
      report,
    },
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/ai/lab-report  — FLUXO COMPLETO
// Motor clínico (regras) + Relatório IA em um único endpoint
// Frontend envia os labs → backend interpreta + gera relatório
// ─────────────────────────────────────────────────────────────

import { labAnalysisBaseSchema } from '../validators/schemas'

// Schema estendido: labs + metadados opcionais
// Usa labAnalysisBaseSchema (ZodObject) para poder chamar .extend()
// A validação de "pelo menos um marcador" é feita na própria rota
const LabReportSchema = labAnalysisBaseSchema.extend({
  patientName: z.string().min(1).max(120).optional(),
  mode:        z.enum(['clinical', 'patient']).default('clinical'),
})

aiRoutes.post('/lab-report', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY, OPENAI_MODEL } = c.env

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ success: false, error: 'Corpo da requisição inválido' }, 400)

  const validation = validateBody(LabReportSchema, body)
  if (!validation.success) {
    return c.json({ success: false, error: 'Dados inválidos', details: validation.errors }, 400)
  }

  const { labs, patientName, mode } = validation.data

  // Garantir que ao menos um marcador foi fornecido
  const hasAnyMarker = Object.values(labs).some(v => v !== undefined)
  if (!hasAnyMarker) {
    return c.json({ success: false, error: 'Dados inválidos', details: { labs: ['Forneça pelo menos um marcador laboratorial em "labs"'] } }, 400)
  }

  // ── Passo 1: Motor de regras clínicas ──────────────────────
  const { findings: rawFindings, suggestions } = evaluateClinicalMarkers(labs)

  const individual    = rawFindings.filter(f => !f.marker.startsWith('Alerta'))
  const combos        = rawFindings.filter(f =>  f.marker.startsWith('Alerta'))
  const abnormal      = individual.filter(f => f.status !== 'ok')
  const healthScore   = individual.length > 0
    ? Math.round(((individual.length - abnormal.length) / individual.length) * 100)
    : 100

  // Converter achados para strings para o relatório de IA
  const findingStrings = [
    ...individual.filter(f => f.status !== 'ok').map(
      f => `${f.marker} (${f.status}): ${f.message}`
    ),
    ...combos.map(f => `⚠ ${f.marker}: ${f.message}`),
  ]

  const suggestionStrings = suggestions
    .filter(s => s.priority === 'high' || s.priority === 'medium')
    .map(s => `[${s.category}] ${s.title}: ${s.detail}`)

  // ── Passo 2: Relatório de IA ────────────────────────────────
  const model      = OPENAI_MODEL ?? 'gpt-4o'
  const startTime  = Date.now()
  let report: ClinicalReportOutput
  let generatedBy: 'openai' | 'local' = 'local'
  let tokensUsed = 0

  if (OPENAI_API_KEY && findingStrings.length > 0) {
    try {
      const client      = createOpenAIClient(OPENAI_API_KEY)
      const userContent = JSON.stringify({
        generatedByUserId: professionalId,
        patientName:       patientName ?? null,
        labs,
        healthScore,
        findings:    findingStrings,
        suggestions: suggestionStrings,
        instruction:
          mode === 'patient'
            ? 'Gere explicação para o paciente em linguagem acessível.'
            : 'Gere relatório clínico técnico para o profissional de saúde.',
      })

      const response = await client.responses.create({
        model,
        store: false,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: buildSystemPrompt(mode) }] },
          { role: 'user',   content: [{ type: 'input_text', text: userContent }] },
        ],
        text: {
          format: {
            type:   'json_schema',
            name:   'clinical_report',
            strict: true,
            schema: CLINICAL_REPORT_JSON_SCHEMA,
          },
        },
      })

      const raw = response.output_text
      try {
        report      = JSON.parse(raw) as ClinicalReportOutput
        generatedBy = 'openai'
        tokensUsed  = (response as any).usage?.total_tokens ?? 0
      } catch {
        report = buildLocalClinicalReport(findingStrings, suggestionStrings, mode)
      }
    } catch (err) {
      console.error('lab-report OpenAI error:', err)
      report = buildLocalClinicalReport(findingStrings, suggestionStrings, mode)
    }
  } else {
    // Sem achados anormais ou sem API key
    report = buildLocalClinicalReport(
      findingStrings.length > 0 ? findingStrings : ['Todos os marcadores dentro da faixa ideal.'],
      suggestionStrings,
      mode,
    )
  }

  const responseTimeMs = Date.now() - startTime

  // Registrar interação
  try {
    const markersAnalyzed = Object.keys(labs)
      .filter(k => (labs as Record<string, unknown>)[k] !== undefined)
      .join(', ')
    await DB.prepare(`
      INSERT INTO ai_interactions
        (professional_id, context_type, patient_id, user_prompt, ai_response, tokens_used, response_time_ms)
      VALUES (?, 'lab_interpretation', NULL, ?, ?, ?, ?)
    `).bind(
      professionalId,
      `Lab report: ${markersAnalyzed}`,
      JSON.stringify({ health_score: healthScore, generated_by: generatedBy }),
      tokensUsed,
      responseTimeMs,
    ).run()
  } catch { /* log não bloqueia */ }

  // ── Resposta unificada ──────────────────────────────────────
  return c.json({
    success: true,
    data: {
      health_score:      healthScore,
      markers_analyzed:  Object.keys(labs).filter(k => (labs as Record<string, unknown>)[k] !== undefined).length,
      findings:          individual,
      combination_alerts: combos,
      suggestions,
      ai_report: {
        ...report,
        generated_by:     generatedBy,
        model:            OPENAI_API_KEY ? model : null,
        response_time_ms: responseTimeMs,
      },
    },
  })
})

// ─────────────────────────────────────────────────────────────
// Motor de regras clínicas (inline — mantém ai.ts autossuficiente)
// Mesmas regras de clinical-intelligence.ts, reutilizadas aqui
// ─────────────────────────────────────────────────────────────

interface Finding { marker: string; value: number; unit: string; status: string; reference: string; message: string; severity: string }
interface Suggestion { category: string; title: string; detail: string; priority: 'high' | 'medium' | 'low' }

function evaluateClinicalMarkers(labs: Record<string, number | undefined>): { findings: Finding[]; suggestions: Suggestion[] } {
  const findings: Finding[]     = []
  const suggestions: Suggestion[] = []
  const { ferritin, b12, tsh, vitaminD, insulin, glucose } = labs as Record<string, number | undefined>

  if (ferritin !== undefined) {
    if (ferritin < 20)       { findings.push({ marker:'Ferritina',value:ferritin,unit:'ng/mL',status:'low',reference:'< 20 = depleção grave',message:'Ferritina criticamente baixa — depleção grave de ferro.',severity:'high' }); suggestions.push({ category:'supplementation',priority:'high',title:'Suplementação de Ferro Urgente',detail:'Ferro quelado 30–60 mg/dia. Solicitar hemograma, investigar causa.' }) }
    else if (ferritin < 70)  { findings.push({ marker:'Ferritina',value:ferritin,unit:'ng/mL',status:'low',reference:'Ideal: 70–150 ng/mL',message:'Ferritina abaixo do ideal funcional — fadiga, queda capilar.',severity:'medium' }); suggestions.push({ category:'supplementation',priority:'medium',title:'Reposição de Ferro',detail:'Ferro quelado 15–30 mg/dia + vitamina C.' }) }
    else if (ferritin > 200) { findings.push({ marker:'Ferritina',value:ferritin,unit:'ng/mL',status:'high',reference:'> 200 ng/mL = elevada',message:'Ferritina elevada — inflamação ou sobrecarga de ferro.',severity:'medium' }); suggestions.push({ category:'further_testing',priority:'medium',title:'Investigar Ferritina Elevada',detail:'PCR, saturação de transferrina, função hepática.' }) }
    else                     { findings.push({ marker:'Ferritina',value:ferritin,unit:'ng/mL',status:'ok',reference:'70–200 ng/mL',message:'Ferritina dentro da faixa funcional ideal.',severity:'low' }) }
  }

  if (b12 !== undefined) {
    if (b12 < 300)      { findings.push({ marker:'Vitamina B12',value:b12,unit:'pg/mL',status:'low',reference:'< 300 = deficiência',message:'B12 deficiente — risco neurológico.',severity:'high' }); suggestions.push({ category:'supplementation',priority:'high',title:'Reposição B12 Urgente',detail:'Metilcobalamina sublingual 1.000–5.000 mcg/dia.' }) }
    else if (b12 < 500) { findings.push({ marker:'Vitamina B12',value:b12,unit:'pg/mL',status:'borderline',reference:'Ideal: ≥ 500 pg/mL',message:'B12 abaixo do ideal funcional — risco neurológico subclínico.',severity:'medium' }); suggestions.push({ category:'supplementation',priority:'medium',title:'Suplementação B12',detail:'Metilcobalamina 500–1.000 mcg/dia.' }) }
    else                { findings.push({ marker:'Vitamina B12',value:b12,unit:'pg/mL',status:'ok',reference:'≥ 500 pg/mL',message:'B12 na faixa ideal.',severity:'low' }) }
  }

  if (tsh !== undefined) {
    if (tsh < 0.4)      { findings.push({ marker:'TSH',value:tsh,unit:'mUI/L',status:'low',reference:'< 0,4 = hipertireoidismo',message:'TSH suprimido — avaliar hipertireoidismo.',severity:'high' }); suggestions.push({ category:'clinical_referral',priority:'high',title:'Encaminhamento Endocrinológico',detail:'T4 livre, T3, anti-TPO urgente.' }) }
    else if (tsh > 4.0) { findings.push({ marker:'TSH',value:tsh,unit:'mUI/L',status:'high',reference:'> 4,0 = hipotireoidismo',message:'TSH elevado — hipotireoidismo.',severity:'high' }); suggestions.push({ category:'clinical_referral',priority:'high',title:'Avaliação Endocrinológica',detail:'T4 livre, anti-TPO, discutir levotiroxina.' }) }
    else if (tsh > 2.0) { findings.push({ marker:'TSH',value:tsh,unit:'mUI/L',status:'borderline',reference:'Ideal: 1,0–2,0 mUI/L',message:'TSH acima do ideal funcional — hipotireoidismo subclínico.',severity:'medium' }); suggestions.push({ category:'further_testing',priority:'medium',title:'Investigação Tireoidiana',detail:'T4 livre, T3 livre, anti-TPO, anti-Tg.' }) }
    else                { findings.push({ marker:'TSH',value:tsh,unit:'mUI/L',status:'ok',reference:'0,4–2,0 mUI/L',message:'TSH dentro da faixa ideal.',severity:'low' }) }
  }

  if (vitaminD !== undefined) {
    if (vitaminD < 20)       { findings.push({ marker:'Vitamina D',value:vitaminD,unit:'ng/mL',status:'low',reference:'< 20 = deficiência grave',message:'Vitamina D criticamente baixa.',severity:'high' }); suggestions.push({ category:'supplementation',priority:'high',title:'Reposição Vitamina D3 Urgente',detail:'10.000–50.000 UI/dia + K2-MK7 100–200 mcg/dia.' }) }
    else if (vitaminD < 40)  { findings.push({ marker:'Vitamina D',value:vitaminD,unit:'ng/mL',status:'low',reference:'Ideal: 60–80 ng/mL',message:'Vitamina D deficiente.',severity:'medium' }); suggestions.push({ category:'supplementation',priority:'medium',title:'Suplementação Vitamina D3',detail:'5.000–10.000 UI/dia + K2-MK7 100 mcg/dia.' }) }
    else if (vitaminD > 100) { findings.push({ marker:'Vitamina D',value:vitaminD,unit:'ng/mL',status:'high',reference:'> 100 = risco toxicidade',message:'Vitamina D elevada — risco de hipercalcemia.',severity:'medium' }); suggestions.push({ category:'further_testing',priority:'medium',title:'Monitorar Cálcio e PTH',detail:'Suspender/reduzir suplementação, solicitar cálcio e PTH.' }) }
    else                     { findings.push({ marker:'Vitamina D',value:vitaminD,unit:'ng/mL',status:'ok',reference:'40–100 ng/mL',message:'Vitamina D adequada.',severity:'low' }) }
  }

  if (insulin !== undefined) {
    if (insulin > 15)    { findings.push({ marker:'Insulina de Jejum',value:insulin,unit:'mUI/L',status:'high',reference:'> 15 = resistência',message:'Resistência à insulina confirmada.',severity:'high' }); suggestions.push({ category:'lifestyle',priority:'high',title:'Intervenção no Estilo de Vida',detail:'Reduzir carboidratos refinados, exercícios de resistência 3–4x/semana.' }); suggestions.push({ category:'supplementation',priority:'high',title:'Sensibilizadores de Insulina',detail:'Berberina 500 mg 2x/dia ou Inositol 4g/dia.' }) }
    else if (insulin > 7){ findings.push({ marker:'Insulina de Jejum',value:insulin,unit:'mUI/L',status:'borderline',reference:'Ideal: < 7 mUI/L',message:'Insulina acima do ideal — início de resistência.',severity:'medium' }); suggestions.push({ category:'lifestyle',priority:'medium',title:'Ajuste Alimentar',detail:'Reduzir índice glicêmico, caminhar após refeições.' }) }
    else                 { findings.push({ marker:'Insulina de Jejum',value:insulin,unit:'mUI/L',status:'ok',reference:'< 7 mUI/L',message:'Insulina dentro da faixa ideal.',severity:'low' }) }
  }

  if (glucose !== undefined) {
    if (glucose >= 126)      { findings.push({ marker:'Glicose de Jejum',value:glucose,unit:'mg/dL',status:'high',reference:'≥ 126 = DM',message:'Glicose no critério diagnóstico de diabetes.',severity:'high' }); suggestions.push({ category:'clinical_referral',priority:'high',title:'Avaliação Médica Urgente',detail:'Confirmar com segunda dosagem ou TTGO. Solicitar HbA1c.' }) }
    else if (glucose >= 100) { findings.push({ marker:'Glicose de Jejum',value:glucose,unit:'mg/dL',status:'borderline',reference:'100–125 = pré-diabetes',message:'Glicose na faixa de pré-diabetes.',severity:'high' }); suggestions.push({ category:'lifestyle',priority:'high',title:'Reversão de Pré-Diabetes',detail:'Perda 7–10% do peso, dieta IG baixo, exercício 150 min/semana.' }) }
    else if (glucose >= 90)  { findings.push({ marker:'Glicose de Jejum',value:glucose,unit:'mg/dL',status:'borderline',reference:'Ideal: < 90 mg/dL',message:'Glicose levemente acima do ideal funcional.',severity:'low' }); suggestions.push({ category:'nutrition',priority:'low',title:'Ajuste Dietético',detail:'Reduzir açúcar adicionado e farinhas refinadas.' }) }
    else                     { findings.push({ marker:'Glicose de Jejum',value:glucose,unit:'mg/dL',status:'ok',reference:'70–89 mg/dL',message:'Glicose dentro da faixa ideal.',severity:'low' }) }
  }

  // Regras combinadas
  if (ferritin !== undefined && ferritin < 70 && b12 !== undefined && b12 < 500) {
    findings.push({ marker:'Alerta Combinado: Ferritina + B12',value:0,unit:'',status:'low',reference:'Ambos abaixo do ideal',message:'Possível má absorção intestinal — investigar.',severity:'high' })
    suggestions.push({ category:'further_testing',priority:'high',title:'Investigação de Má Absorção',detail:'Anti-transglutaminase IgA, calprotectina fecal, H. pylori, pepsinogênio.' })
  }
  if (insulin !== undefined && insulin > 7 && glucose !== undefined && glucose >= 100) {
    findings.push({ marker:'Alerta Combinado: Insulina + Glicose',value:0,unit:'',status:'high',reference:'Síndrome metabólica',message:'Insulina elevada + glicose ≥ 100 — padrão de síndrome metabólica.',severity:'high' })
    suggestions.push({ category:'lifestyle',priority:'high',title:'Intervenção Metabólica Intensiva',detail:'Restrição de carboidratos processados, jejum intermitente supervisionado, exercício.' })
  }

  const order = { high: 0, medium: 1, low: 2 } as Record<string, number>
  suggestions.sort((a, b) => order[a.priority] - order[b.priority])
  return { findings, suggestions }
}

// ─────────────────────────────────────────────────────────────
// POST /api/ai/chat  — chat livre (mantido, com fallback para mock)
// ─────────────────────────────────────────────────────────────

aiRoutes.post('/chat', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY } = c.env

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Corpo inválido' }, 400)

  const validation = validateBody(AIChatSchema, body)
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422)
  }

  const { prompt, context_type, patient_id } = validation.data

  // Verificar ownership do paciente
  if (patient_id) {
    const patient = await DB.prepare(
      'SELECT id FROM patients WHERE id = ? AND professional_id = ?',
    ).bind(patient_id, professionalId).first()

    if (!patient) {
      return c.json({ error: 'Paciente não encontrado ou não pertence a este profissional' }, 404)
    }
  }

  const startTime = Date.now()
  let aiResponse: string
  let tokensUsed: number | null = null

  if (OPENAI_API_KEY) {
    try {
      // Chat livre usa Chat Completions API (texto puro, sem structured output necessário)
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model:       'gpt-4o-mini',
          temperature: 0.7,
          max_tokens:  800,
          messages: [
            { role: 'system', content: buildChatSystemPrompt(context_type) },
            { role: 'user',   content: prompt },
          ],
        }),
      })

      if (!openaiRes.ok) {
        throw new Error(`OpenAI API error: ${openaiRes.status}`)
      }

      const data = await openaiRes.json() as any
      aiResponse = data.choices?.[0]?.message?.content ?? 'Sem resposta da IA.'
      tokensUsed = data.usage?.total_tokens ?? null
    } catch (err) {
      console.error('Falha no chat OpenAI:', err)
      aiResponse = buildMockResponse(prompt, context_type)
    }
  } else {
    aiResponse = buildMockResponse(prompt, context_type)
  }

  const responseTimeMs = Date.now() - startTime

  // Salvar interação
  const result = await DB.prepare(`
    INSERT INTO ai_interactions
      (professional_id, context_type, patient_id, user_prompt, ai_response, tokens_used, response_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    professionalId, context_type, patient_id ?? null,
    prompt, aiResponse, tokensUsed, responseTimeMs,
  ).run()

  return c.json({
    response:         aiResponse,
    interaction_id:   result.meta.last_row_id,
    is_mock:          !OPENAI_API_KEY,
    response_time_ms: responseTimeMs,
  })
})

// ─────────────────────────────────────────────────────────────
// GET /api/ai/history
// ─────────────────────────────────────────────────────────────

aiRoutes.get('/history', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const { DB } = c.env

  const history = await DB.prepare(`
    SELECT id, context_type, user_prompt, ai_response,
           tokens_used, response_time_ms, was_helpful, created_at
    FROM ai_interactions
    WHERE professional_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).bind(professionalId).all()

  return c.json(history.results)
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/ai/history/:id/feedback
// ─────────────────────────────────────────────────────────────

aiRoutes.patch('/history/:id/feedback', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const interactionId  = c.req.param('id')
  const { DB } = c.env

  const body = await c.req.json().catch(() => ({}))
  const wasHelpful    = typeof body.was_helpful === 'boolean' ? (body.was_helpful ? 1 : 0) : null
  const feedbackText  = typeof body.feedback_text === 'string' ? body.feedback_text.slice(0, 500) : null

  const interaction = await DB.prepare(
    'SELECT id FROM ai_interactions WHERE id = ? AND professional_id = ?',
  ).bind(interactionId, professionalId).first()

  if (!interaction) {
    return c.json({ error: 'Interação não encontrada' }, 404)
  }

  await DB.prepare(
    'UPDATE ai_interactions SET was_helpful = ?, feedback_text = ? WHERE id = ?',
  ).bind(wasHelpful, feedbackText, interactionId).run()

  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────

function buildChatSystemPrompt(contextType: string): string {
  const base = `Você é um assistente especializado em saúde integrativa para profissionais de saúde.
Responda de forma técnica, baseada em evidências, em português brasileiro.
IMPORTANTE: Sempre recomende que o profissional avalie individualmente cada paciente.
Nunca faça diagnósticos definitivos.`

  const contexts: Record<string, string> = {
    general_question:         `${base} Responda perguntas gerais sobre saúde integrativa.`,
    case_analysis:            `${base} Analise casos clínicos de forma estruturada: anamnese, exames, hipóteses diagnósticas e conduta sugerida.`,
    protocol_suggestion:      `${base} Sugira protocolos clínicos baseados em evidências.`,
    lab_interpretation:       `${base} Ajude na interpretação de exames laboratoriais no contexto funcional e integrativo.`,
    supplement_recommendation:`${base} Sugira suplementação individualizada com base em evidências científicas, dosagens e interações.`,
  }

  return contexts[contextType] ?? base
}

function buildMockResponse(prompt: string, contextType: string): string {
  const preview = prompt.substring(0, 60)

  const responses: Record<string, string> = {
    general_question:
      `Sobre "${preview}...": Considere anamnese completa, causas funcionais antes de tratar sintomas e investigação de micronutrientes.\n\n⚠️ *Modo demonstração — configure OPENAI_API_KEY para respostas personalizadas.*`,
    case_analysis:
      `Análise: "${preview}..."\n\n**Hipóteses:** Síndrome metabólica, disfunção tireoidiana, deficiências nutricionais.\n**Conduta:** Exames laboratoriais completos, avaliação nutricional, revisão de hábitos.\n\n⚠️ *Modo demonstração.*`,
    lab_interpretation:
      `Para "${preview}...": Avalie os valores dentro do contexto clínico. Valores na faixa de referência nem sempre indicam função ótima.\n\n⚠️ *Modo demonstração.*`,
    protocol_suggestion:
      `Protocolo para "${preview}...": 1. Avaliação clínica completa 2. Ajustes nutricionais 3. Suplementação conforme exames 4. Atividade física adequada 5. Manejo do estresse.\n\n⚠️ *Modo demonstração.*`,
    supplement_recommendation:
      `Suplementação para "${preview}...": Avalie deficiências em exames, interações medicamentosas, dose por peso e condição. Reavaliar em 60–90 dias.\n\n⚠️ *Modo demonstração.*`,
  }

  return responses[contextType] ?? responses['general_question']
}

export default aiRoutes

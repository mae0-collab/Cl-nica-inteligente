// ============================================================
// ROUTES — AI ASSISTANT
// Rota só orquestra — engine decide — OpenAI explica
//
// Arquitetura:
//   route  →  engine (analyzeClinicalLabs)
//          →  openai (generateAIClinicalReport | buildLocalFallbackReport)
//          →  response JSON
// ============================================================

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware'
import { AIChatSchema, labAnalysisBaseSchema, validateBody } from '../validators/schemas'
import type { AppEnv } from '../lib/types'

// ── Módulos de domínio ──────────────────────────────────────
import { analyzeClinicalLabs } from '../modules/clinical-intelligence/engine'
import {
  buildLocalFallbackReport,
  generateAIClinicalReport,
  generateChatResponse,
} from '../modules/ai/openai'
import {
  buildClinicalSystemPrompt,
  buildUserContent,
} from '../modules/ai/prompts'
import type { AIReportOutput } from '../modules/clinical-intelligence/types'

// ── Módulo Hemograma ────────────────────────────────────────
import { analisarHemograma } from '../modules/hemograma/engine'
import {
  buildHemogramaSystemPrompt,
  buildHemogramaUserContent,
  HEMOGRAMA_REPORT_JSON_SCHEMA,
} from '../modules/hemograma/prompts'
import type { HemogramaReportOutput } from '../modules/hemograma/prompts'
import type { HemogramaInput } from '../modules/hemograma/types'

const aiRoutes = new Hono<AppEnv>()
aiRoutes.use('*', authMiddleware)

// ─────────────────────────────────────────────────────────────
// Schema: /clinical-report (findings arbitrários → IA)
// ─────────────────────────────────────────────────────────────
const ClinicalReportSchema = z.object({
  patientName: z.string().min(1).max(120).optional(),
  findings:    z.array(z.string().min(1)).min(1, 'Pelo menos um achado é obrigatório'),
  suggestions: z.array(z.string().min(1)).default([]),
  labs:        z.record(z.union([z.number(), z.string(), z.null()])).default({}),
  mode:        z.enum(['clinical', 'patient']).default('clinical'),
})

// Schema: /lab-report (labs → engine → IA)
const LabReportSchema = labAnalysisBaseSchema.extend({
  patientName: z.string().min(1).max(120).optional(),
  mode:        z.enum(['clinical', 'patient']).default('clinical'),
})

// ─────────────────────────────────────────────────────────────
// POST /api/ai/lab-report
// Fluxo completo: labs → engine clínico → relatório IA
// ─────────────────────────────────────────────────────────────
aiRoutes.post('/lab-report', async (c) => {
  const professionalId             = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY, OPENAI_MODEL } = c.env

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ success: false, error: 'Corpo da requisição inválido' }, 400)

  const validation = validateBody(LabReportSchema, body)
  if (!validation.success) {
    return c.json({ success: false, error: 'Dados inválidos', details: validation.errors }, 400)
  }

  const { labs, patientName, mode } = validation.data

  // Garantir ao menos um marcador
  const hasAnyMarker = Object.values(labs).some((v) => v !== undefined)
  if (!hasAnyMarker) {
    return c.json({
      success: false,
      error:   'Dados inválidos',
      details: { labs: ['Forneça pelo menos um marcador laboratorial em "labs"'] },
    }, 400)
  }

  const startTime = Date.now()

  // ── 1. Motor clínico ────────────────────────────────────────
  const clinicalResult = analyzeClinicalLabs(labs)

  // ── 2. Separar achados ricos de alertas combinados ──────────
  const individual = clinicalResult.richFindings.filter(
    (f) => !f.marker.startsWith('Alerta')
  )
  const combos = clinicalResult.richFindings.filter(
    (f) => f.marker.startsWith('Alerta')
  )

  // ── 3. Relatório de IA ──────────────────────────────────────
  const model = OPENAI_MODEL ?? 'gpt-5.2'
  let report:      AIReportOutput
  let generatedBy: 'openai' | 'local' = 'local'
  let tokensUsed   = 0

  if (OPENAI_API_KEY && clinicalResult.findings.length > 0) {
    try {
      const result = await generateAIClinicalReport({
        apiKey:         OPENAI_API_KEY,
        model,
        patientName,
        clinicalResult,
        labs:           labs as Record<string, number | undefined>,
        mode,
      })
      report       = result.report
      tokensUsed   = result.tokensUsed
      generatedBy  = 'openai'
    } catch (err) {
      console.error('[lab-report] OpenAI error — usando fallback:', err)
      report = buildLocalFallbackReport(clinicalResult, mode)
    }
  } else {
    report = buildLocalFallbackReport(clinicalResult, mode)
  }

  const responseTimeMs = Date.now() - startTime

  // ── 4. Registrar interação ──────────────────────────────────
  try {
    const markerKeys = Object.keys(labs)
      .filter((k) => (labs as Record<string, unknown>)[k] !== undefined)
      .join(', ')

    await DB.prepare(`
      INSERT INTO ai_interactions
        (professional_id, context_type, patient_id, user_prompt, ai_response, tokens_used, response_time_ms)
      VALUES (?, 'lab_interpretation', NULL, ?, ?, ?, ?)
    `).bind(
      professionalId,
      `Lab report [${markerKeys}] | score: ${clinicalResult.healthScore}`,
      JSON.stringify({ health_score: clinicalResult.healthScore, generated_by: generatedBy }),
      tokensUsed,
      responseTimeMs,
    ).run()
  } catch { /* log não bloqueia resposta */ }

  // ── 5. Resposta unificada ───────────────────────────────────
  return c.json({
    success: true,
    data: {
      health_score:       clinicalResult.healthScore,
      markers_analyzed:   clinicalResult.markersAnalyzed,
      findings:           individual,
      combination_alerts: combos,
      suggestions:        clinicalResult.richSuggestions,
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
// POST /api/ai/clinical-report
// Findings arbitrários → relatório IA estruturado
// ─────────────────────────────────────────────────────────────
aiRoutes.post('/clinical-report', async (c) => {
  const professionalId             = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY, OPENAI_MODEL } = c.env

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ success: false, error: 'Corpo da requisição inválido' }, 400)

  const validation = validateBody(ClinicalReportSchema, body)
  if (!validation.success) {
    return c.json({ success: false, error: 'Dados inválidos', details: validation.errors }, 400)
  }

  const { patientName, findings, suggestions, labs, mode } = validation.data
  const model     = OPENAI_MODEL ?? 'gpt-5.2'
  const startTime = Date.now()

  let report:      AIReportOutput
  let generatedBy: 'openai' | 'local' = 'local'
  let tokensUsed   = 0

  if (OPENAI_API_KEY) {
    try {
      // Usar fetch direto — compatível com Cloudflare Workers
      const { CLINICAL_REPORT_JSON_SCHEMA: schema } = await import('../modules/ai/prompts')
      const systemPrompt = buildClinicalSystemPrompt(mode)
      const userContent  = buildUserContent({ patientName, findings, suggestions, combinationAlerts: [], labs, mode })

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent  },
          ],
          response_format: {
            type:        'json_schema',
            json_schema: { name: 'clinical_report', strict: true, schema },
          },
        }),
      })

      if (!res.ok) throw new Error(`OpenAI ${res.status}`)
      const data  = await res.json() as any
      const raw   = data.choices?.[0]?.message?.content ?? ''
      report      = JSON.parse(raw) as AIReportOutput
      generatedBy = 'openai'
      tokensUsed  = data.usage?.total_tokens ?? 0
    } catch (err) {
      console.error('[clinical-report] OpenAI error — usando fallback:', err)
      report = {
        summary:                    `${findings.length} achado(s): ${findings.slice(0,2).join('; ')}.`,
        clinicalInterpretation:     findings.map((f) => `Achado: ${f}`),
        patientFriendlyExplanation: mode === 'patient'
          ? 'Seu profissional identificou pontos nos seus exames. Siga as orientações.'
          : `${findings.length} achado(s). Avalie cada ponto com o paciente.`,
        followUpQuestions:          suggestions.slice(0,3).map((s) => `Considerar: ${s}`),
        caution:                    'Relatório de apoio clínico — não substitui avaliação médica.',
      }
    }
  } else {
    report = {
      summary:                    `${findings.length} achado(s): ${findings.slice(0,2).join('; ')}.`,
      clinicalInterpretation:     findings.map((f) => `Achado: ${f}`),
      patientFriendlyExplanation: mode === 'patient'
        ? 'Seu profissional identificou pontos nos seus exames. Siga as orientações.'
        : `${findings.length} achado(s). Avalie cada ponto com o paciente.`,
      followUpQuestions:          suggestions.slice(0,3).map((s) => `Considerar: ${s}`),
      caution:                    'Configure OPENAI_API_KEY para relatórios com IA real.',
    }
  }

  const responseTimeMs = Date.now() - startTime

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
  } catch { /* log não bloqueia resposta */ }

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
// POST /api/ai/chat — Chat livre (mantido com fallback mock)
// ─────────────────────────────────────────────────────────────
aiRoutes.post('/chat', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY, OPENAI_MODEL } = c.env

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Corpo inválido' }, 400)

  const validation = validateBody(AIChatSchema, body)
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422)
  }

  const { prompt, context_type, patient_id } = validation.data

  if (patient_id) {
    const patient = await DB.prepare(
      'SELECT id FROM patients WHERE id = ? AND professional_id = ?',
    ).bind(patient_id, professionalId).first()
    if (!patient) {
      return c.json({ error: 'Paciente não encontrado ou não pertence a este profissional' }, 404)
    }
  }

  const startTime  = Date.now()
  let aiResponse: string
  let tokensUsed: number | null = null

  if (OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model:       OPENAI_MODEL ?? 'gpt-5.2',
          temperature: 0.7,
          max_completion_tokens: 800,
          messages: [
            { role: 'system', content: buildChatSystemPrompt(context_type) },
            { role: 'user',   content: prompt },
          ],
        }),
      })

      if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
      const data   = await res.json() as any
      aiResponse   = data.choices?.[0]?.message?.content ?? 'Sem resposta da IA.'
      tokensUsed   = data.usage?.total_tokens ?? null
    } catch (err) {
      console.error('[chat] OpenAI error:', err)
      aiResponse = buildMockResponse(prompt, context_type)
    }
  } else {
    aiResponse = buildMockResponse(prompt, context_type)
  }

  const responseTimeMs = Date.now() - startTime

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

  const body         = await c.req.json().catch(() => ({}))
  const wasHelpful   = typeof body.was_helpful   === 'boolean' ? (body.was_helpful ? 1 : 0) : null
  const feedbackText = typeof body.feedback_text === 'string'  ? body.feedback_text.slice(0, 500) : null

  const interaction = await DB.prepare(
    'SELECT id FROM ai_interactions WHERE id = ? AND professional_id = ?',
  ).bind(interactionId, professionalId).first()

  if (!interaction) return c.json({ error: 'Interação não encontrada' }, 404)

  await DB.prepare(
    'UPDATE ai_interactions SET was_helpful = ?, feedback_text = ? WHERE id = ?',
  ).bind(wasHelpful, feedbackText, interactionId).run()

  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────
// Helpers internos (chat livre)
// ─────────────────────────────────────────────────────────────
function buildChatSystemPrompt(contextType: string): string {
  const base = `Você é um assistente especializado em saúde integrativa para profissionais de saúde.
Responda de forma técnica, baseada em evidências, em português brasileiro.
IMPORTANTE: Sempre recomende que o profissional avalie individualmente cada paciente.
Nunca faça diagnósticos definitivos.`

  const contexts: Record<string, string> = {
    general_question:          `${base} Responda perguntas gerais sobre saúde integrativa.`,
    case_analysis:             `${base} Analise casos clínicos de forma estruturada.`,
    protocol_suggestion:       `${base} Sugira protocolos clínicos baseados em evidências.`,
    lab_interpretation:        `${base} Ajude na interpretação de exames laboratoriais no contexto funcional.`,
    supplement_recommendation: `${base} Sugira suplementação individualizada com base em evidências.`,
  }

  return contexts[contextType] ?? base
}

function buildMockResponse(prompt: string, contextType: string): string {
  const preview = prompt.substring(0, 60)

  const responses: Record<string, string> = {
    general_question:
      `Sobre "${preview}...": Considere anamnese completa, causas funcionais e investigação de micronutrientes.\n\n⚠️ *Modo demonstração — configure OPENAI_API_KEY para respostas personalizadas.*`,
    case_analysis:
      `Análise: "${preview}..."\n\n**Hipóteses:** Síndrome metabólica, disfunção tireoidiana, deficiências nutricionais.\n**Conduta:** Exames laboratoriais completos, avaliação nutricional.\n\n⚠️ *Modo demonstração.*`,
    lab_interpretation:
      `Para "${preview}...": Avalie dentro do contexto clínico. Valores na faixa de referência nem sempre indicam função ótima.\n\n⚠️ *Modo demonstração.*`,
    protocol_suggestion:
      `Protocolo para "${preview}...": 1. Avaliação clínica 2. Ajustes nutricionais 3. Suplementação por exames 4. Atividade física 5. Manejo do estresse.\n\n⚠️ *Modo demonstração.*`,
    supplement_recommendation:
      `Suplementação para "${preview}...": Avalie deficiências, interações medicamentosas e dose por condição. Reavaliar em 60–90 dias.\n\n⚠️ *Modo demonstração.*`,
  }

  return responses[contextType] ?? responses['general_question']
}

// ─────────────────────────────────────────────────────────────
// POST /api/ai/hemograma — Simulador FSA / Hemograma Completo
// ─────────────────────────────────────────────────────────────
const HemogramaSchema = z.object({
  // Série Vermelha
  hematocrito:  z.number().min(0).max(100).optional(),
  hemoglobina:  z.number().min(0).max(30).optional(),
  eritrocitos:  z.number().min(0).max(12).optional(),
  vcm:          z.number().min(50).max(150).optional(),
  hcm:          z.number().min(10).max(50).optional(),
  chcm:         z.number().min(20).max(45).optional(),
  rdw:          z.number().min(5).max(30).optional(),
  // Leucograma
  leucocitos:   z.number().min(0).max(200000).optional(),
  // FSA (absolutos)
  neutrofilos:  z.number().min(0).max(100000).optional(),
  linfocitos:   z.number().min(0).max(100000).optional(),
  monocitos:    z.number().min(0).max(20000).optional(),
  eosinofilos:  z.number().min(0).max(50000).optional(),
  basofilos:    z.number().min(0).max(5000).optional(),
  bastoes:      z.number().min(0).max(50000).optional(),
  // Plaquetas
  plaquetas:    z.number().min(0).max(3000000).optional(),
  // Contexto
  sexo:         z.enum(['M', 'F']).optional(),
  idade:        z.number().min(0).max(120).optional(),
  patientName:  z.string().max(120).optional(),
  mode:         z.enum(['clinical', 'patient']).default('clinical'),
}).refine(
  (d) => {
    const campos = [
      d.hematocrito, d.hemoglobina, d.eritrocitos, d.vcm, d.hcm, d.chcm, d.rdw,
      d.leucocitos, d.neutrofilos, d.linfocitos, d.monocitos, d.eosinofilos, d.basofilos, d.bastoes,
      d.plaquetas,
    ]
    return campos.some((v) => v !== undefined)
  },
  { message: 'Forneça pelo menos um parâmetro do hemograma' }
)

aiRoutes.post('/hemograma', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY, OPENAI_MODEL } = c.env

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ success: false, error: 'Corpo inválido' }, 400)

  const validation = HemogramaSchema.safeParse(body)
  if (!validation.success) {
    return c.json({
      success: false,
      error:   'Dados inválidos',
      details: validation.error.flatten().fieldErrors,
    }, 400)
  }

  const { patientName, mode, ...hemogramaInput } = validation.data
  const startTime = Date.now()

  // ── 1. Motor de regras hematológicas ──────────────────────
  const resultado = analisarHemograma(hemogramaInput)

  // ── 2. Gerar relatório com IA ──────────────────────────────
  const model = OPENAI_MODEL ?? 'gpt-5.2'
  let relatorioIA: HemogramaReportOutput
  let generatedBy: 'openai' | 'local' = 'local'
  let tokensUsed = 0

  if (OPENAI_API_KEY) {
    try {
      const systemPrompt = buildHemogramaSystemPrompt(mode)
      const userContent  = buildHemogramaUserContent(hemogramaInput, resultado, patientName, mode)

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_completion_tokens: 1500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userContent  },
          ],
          response_format: {
            type:        'json_schema',
            json_schema: {
              name:   'hemograma_report',
              strict: true,
              schema: HEMOGRAMA_REPORT_JSON_SCHEMA,
            },
          },
        }),
      })

      if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)

      const data    = await res.json() as any
      const raw     = data.choices?.[0]?.message?.content ?? ''
      if (!raw) throw new Error('Resposta vazia')

      relatorioIA = JSON.parse(raw) as HemogramaReportOutput
      tokensUsed  = data.usage?.total_tokens ?? 0
      generatedBy = 'openai'
    } catch (err) {
      console.error('[hemograma] OpenAI error:', err)
      // Fallback local
      relatorioIA = buildLocalHemogramaReport(resultado, mode)
    }
  } else {
    relatorioIA = buildLocalHemogramaReport(resultado, mode)
  }

  const responseTimeMs = Date.now() - startTime

  // ── 3. Salvar interação ────────────────────────────────────
  try {
    await DB.prepare(`
      INSERT INTO ai_interactions
        (professional_id, context_type, input_summary, output_summary, model_used, tokens_used, response_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      professionalId,
      'hemograma_interpretation',
      JSON.stringify({ parametros: resultado.parametrosAnalisados, score: resultado.scoreGlobal }),
      relatorioIA.resumo_executivo.slice(0, 500),
      generatedBy === 'openai' ? model : 'local',
      tokensUsed,
      responseTimeMs,
    ).run()
  } catch { /* não bloquear resposta por erro de log */ }

  return c.json({
    success: true,
    data: {
      score_global:          resultado.scoreGlobal,
      parametros_analisados: resultado.parametrosAnalisados,
      achados:               resultado.achados,
      padroes:               resultado.padroes,
      sugestoes:             resultado.sugestoes,
      alertas_criticos:      resultado.alertasCriticos,
      alertas_combinados:    resultado.alertasCombinados,
      relatorio_ia: {
        generated_by:    generatedBy,
        model:           generatedBy === 'openai' ? model : null,
        response_time_ms: responseTimeMs,
        tokens_used:     tokensUsed,
        ...relatorioIA,
      },
    },
  })
})

// ── Fallback local para hemograma ────────────────────────────
// ─────────────────────────────────────────────────────────────
// POST /api/ai/hemograma/upload — Upload de laudo (PDF/Imagem)
// Extrai valores do documento e devolve análise completa
// ─────────────────────────────────────────────────────────────
aiRoutes.post('/hemograma/upload', async (c) => {
  const professionalId = getAuthProfessionalId(c)
  const { DB, OPENAI_API_KEY, OPENAI_MODEL } = c.env

  if (!OPENAI_API_KEY) {
    return c.json({ success: false, error: 'OPENAI_API_KEY não configurada — upload requer IA ativa.' }, 400)
  }

  // ── 1. Ler multipart ─────────────────────────────────────
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ success: false, error: 'Envie o arquivo como multipart/form-data com campo "file".' }, 400)
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return c.json({ success: false, error: 'Campo "file" não encontrado no formulário.' }, 400)
  }

  const maxSizeMB = 10
  if (file.size > maxSizeMB * 1024 * 1024) {
    return c.json({ success: false, error: `Arquivo muito grande. Máximo: ${maxSizeMB} MB.` }, 400)
  }

  const mime     = file.type?.toLowerCase() || ''
  const fileName = (file.name || '').toLowerCase()
  const isPDF    = mime === 'application/pdf' || fileName.endsWith('.pdf')
  const isImage  = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/.test(fileName)

  if (!isPDF && !isImage) {
    return c.json({
      success: false,
      error: 'Formato não suportado. Envie PDF ou imagem (JPG, PNG, WEBP).',
    }, 400)
  }

  const startTime = Date.now()
  const model = OPENAI_MODEL ?? 'gpt-5.2'

  // ── 2. Extrair conteúdo do arquivo ───────────────────────
  const patientName = (formData.get('patientName') as string | null)?.trim() || undefined
  const sexo        = (formData.get('sexo') as string | null) as 'M' | 'F' | undefined
  const idadeStr    = formData.get('idade') as string | null
  const idade       = idadeStr ? parseInt(idadeStr) : undefined
  const mode        = ((formData.get('mode') as string | null) ?? 'clinical') as 'clinical' | 'patient'

  let extractedText = ''
  let imageBase64   = ''
  let contentType   = ''

  if (isPDF) {
    // PDF: extrair texto embutido via parse manual (compatível com Cloudflare Workers)
    try {
      const arrayBuf = await file.arrayBuffer()
      const uint8    = new Uint8Array(arrayBuf)
      const pdfStr   = new TextDecoder('latin1').decode(uint8)

      // ── Método 1: Tj direto (busca global — mais confiável) ─────────────────
      // Evita o bug do BT..ET ser cortado por palavras como "COMPLETO", "GABARITO"
      const rawTexts: string[] = []

      // Captura todos os operadores Tj e TJ diretamente
      const tjDirect = pdfStr.matchAll(/\(([^)]{1,300})\)\s*Tj\b/g)
      for (const m of tjDirect) rawTexts.push(m[1])

      const tjArrays = pdfStr.matchAll(/\[([^\]]{1,500})\]\s*TJ\b/g)
      for (const m of tjArrays) {
        const parts = m[1].matchAll(/\(([^)]*)\)/g)
        for (const p of parts) rawTexts.push(p[1])
      }

      // ── Método 2: fallback — texto legível dentro de streams ────────────────
      if (rawTexts.length === 0) {
        // Extrai blocos stream...endstream e busca texto imprimível
        const streams = pdfStr.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)
        for (const s of streams) {
          const printable = s[1].replace(/[^\x20-\x7E\n]/g, ' ').trim()
          if (printable.length > 50) rawTexts.push(printable)
        }
      }

      extractedText = rawTexts
        .join('\n')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\r/g, '')
        .trim()

      // Se mesmo assim não extraiu texto suficiente → PDF escaneado
      if (extractedText.length < 80) {
        return c.json({
          success: false,
          error: 'Este PDF parece ser escaneado (sem texto selecionável). Envie uma imagem (JPG/PNG) do laudo.',
          tip: 'Tire uma foto ou screenshot do laudo e envie como imagem.',
        }, 422)
      }
    } catch (err) {
      console.error('[upload] PDF parse error:', err)
      return c.json({ success: false, error: 'Erro ao processar PDF. Tente converter para imagem.' }, 500)
    }
  } else {
    // Imagem: converter para base64
    try {
      const arrayBuf  = await file.arrayBuffer()
      const uint8     = new Uint8Array(arrayBuf)
      imageBase64     = btoa(String.fromCharCode(...uint8))
      contentType     = mime || 'image/jpeg'
    } catch {
      return c.json({ success: false, error: 'Erro ao processar imagem.' }, 500)
    }
  }

  // ── 3. GPT extrai os valores do hemograma ────────────────
  const extractionSystemPrompt = `Você é um especialista em leitura de laudos laboratoriais hematológicos.
Sua tarefa: extrair SOMENTE os valores numéricos do hemograma/FSA do texto ou imagem fornecida.
Retorne APENAS um JSON válido com os campos disponíveis, sem texto adicional.
Campos possíveis (use apenas os que estão no laudo, ignore os ausentes):
hemoglobina (g/dL), hematocrito (%), eritrocitos (milhões/µL), vcm (fL), hcm (pg), chcm (g/dL), rdw (%),
leucocitos (/µL), neutrofilos (/µL), linfocitos (/µL), monocitos (/µL), eosinofilos (/µL), basofilos (/µL), bastoes (/µL),
plaquetas (/µL), patientName (string, se encontrado no laudo).
IMPORTANTE: neutrófilos, linfócitos etc. devem ser valores ABSOLUTOS (/µL), não percentuais.
Se o laudo mostrar apenas percentuais e o total de leucócitos, calcule os valores absolutos.
Exemplo: leucocitos=8000, neutrofilos_pct=65% → neutrofilos=5200.`

  let hemogramaValues: HemogramaInput = {}
  let detectedPatientName = patientName

  try {
    const messages: any[] = [{ role: 'system', content: extractionSystemPrompt }]

    if (isPDF && extractedText) {
      messages.push({
        role: 'user',
        content: `Extraia os valores do hemograma deste laudo:\n\n${extractedText.slice(0, 8000)}`,
      })
    } else {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Extraia os valores do hemograma desta imagem de laudo:' },
          {
            type: 'image_url',
            image_url: { url: `data:${contentType};base64,${imageBase64}`, detail: 'high' },
          },
        ],
      })
    }

    const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: 600,
        messages,
        response_format: { type: 'json_object' },
      }),
    })

    if (!extractRes.ok) throw new Error(`OpenAI error ${extractRes.status}`)
    const extractData = await extractRes.json() as any
    const rawJson = extractData.choices?.[0]?.message?.content ?? '{}'
    const parsed  = JSON.parse(rawJson)

    // Extrair nome do paciente se a IA encontrou
    if (!detectedPatientName && parsed.patientName) {
      detectedPatientName = parsed.patientName
      delete parsed.patientName
    }

    // Mapear campos numéricos
    const campos: (keyof HemogramaInput)[] = [
      'hemoglobina', 'hematocrito', 'eritrocitos', 'vcm', 'hcm', 'chcm', 'rdw',
      'leucocitos', 'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos', 'bastoes',
      'plaquetas',
    ]
    for (const campo of campos) {
      const v = parsed[campo]
      if (v !== undefined && v !== null && !isNaN(Number(v))) {
        (hemogramaValues as any)[campo] = Number(v)
      }
    }
    if (sexo)  hemogramaValues.sexo  = sexo
    if (idade) hemogramaValues.idade = idade

  } catch (err) {
    console.error('[upload] GPT extraction error:', err)
    return c.json({ success: false, error: 'Falha ao extrair valores do documento. Tente inserir manualmente.' }, 500)
  }

  // ── 4. Verificar se ao menos 1 valor foi extraído ────────
  const temValores = Object.entries(hemogramaValues)
    .filter(([k]) => !['sexo', 'idade'].includes(k))
    .some(([, v]) => v !== undefined)

  if (!temValores) {
    return c.json({
      success: false,
      error: 'Não foi possível identificar valores de hemograma no documento. Verifique se o arquivo contém um laudo hematológico.',
    }, 422)
  }

  // ── 5. Motor hematológico + IA ────────────────────────────
  const resultado = analisarHemograma(hemogramaValues)

  let relatorioIA: HemogramaReportOutput
  let generatedBy: 'openai' | 'local' = 'local'
  let tokensUsed = 0

  try {
    const systemPrompt = buildHemogramaSystemPrompt(mode)
    const userContent  = buildHemogramaUserContent(hemogramaValues, resultado, detectedPatientName, mode)

    const analysisRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_completion_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userContent  },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'hemograma_report',
            strict: true,
            schema: HEMOGRAMA_REPORT_JSON_SCHEMA,
          },
        },
      }),
    })

    if (!analysisRes.ok) throw new Error(`OpenAI analysis error ${analysisRes.status}`)
    const analysisData = await analysisRes.json() as any
    const raw = analysisData.choices?.[0]?.message?.content ?? ''
    if (!raw) throw new Error('Resposta vazia')
    relatorioIA = JSON.parse(raw) as HemogramaReportOutput
    tokensUsed  = analysisData.usage?.total_tokens ?? 0
    generatedBy = 'openai'
  } catch (err) {
    console.error('[upload] analysis error:', err)
    relatorioIA = buildLocalHemogramaReport(resultado, mode)
  }

  const responseTimeMs = Date.now() - startTime

  // ── 6. Log ───────────────────────────────────────────────
  try {
    await DB.prepare(`
      INSERT INTO ai_interactions
        (professional_id, context_type, input_summary, output_summary, model_used, tokens_used, response_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      professionalId,
      'hemograma_upload',
      JSON.stringify({ source: isPDF ? 'pdf' : 'image', parametros: resultado.parametrosAnalisados, score: resultado.scoreGlobal }),
      relatorioIA.resumo_executivo.slice(0, 500),
      generatedBy === 'openai' ? model : 'local',
      tokensUsed,
      responseTimeMs,
    ).run()
  } catch { /* não bloquear */ }

  return c.json({
    success: true,
    source:  isPDF ? 'pdf_texto' : 'imagem',
    valores_extraidos: hemogramaValues,
    patient_name_detected: detectedPatientName ?? null,
    data: {
      score_global:          resultado.scoreGlobal,
      parametros_analisados: resultado.parametrosAnalisados,
      achados:               resultado.achados,
      padroes:               resultado.padroes,
      sugestoes:             resultado.sugestoes,
      alertas_criticos:      resultado.alertasCriticos,
      alertas_combinados:    resultado.alertasCombinados,
      relatorio_ia: {
        generated_by:     generatedBy,
        model:            generatedBy === 'openai' ? model : null,
        response_time_ms: responseTimeMs,
        tokens_used:      tokensUsed,
        ...relatorioIA,
      },
    },
  })
})

function buildLocalHemogramaReport(
  resultado: ReturnType<typeof analisarHemograma>,
  mode: 'clinical' | 'patient',
): HemogramaReportOutput {
  const alterados = resultado.achados.filter((a) => a.status !== 'ok')
  const criticos  = resultado.achados.filter((a) => a.status === 'critical')

  const resumo = criticos.length > 0
    ? `⚠️ ATENÇÃO: ${criticos.length} parâmetro(s) em valores críticos. ${alterados.length} alteração(ões) total detectada(s) no hemograma.`
    : alterados.length > 0
      ? `Hemograma com ${alterados.length} alteração(ões). Score geral: ${resultado.scoreGlobal}/100.`
      : `Hemograma sem alterações significativas. Score: ${resultado.scoreGlobal}/100.`

  return {
    resumo_executivo: resumo,
    interpretacao_series: resultado.resumoTexto.length > 0
      ? resultado.resumoTexto
      : ['Parâmetros dentro dos valores de referência.'],
    padroes_diagnosticos: resultado.padroes.length > 0
      ? resultado.padroes.map((p) => `${p.nome}: ${p.descricao}`)
      : ['Nenhum padrão diagnóstico combinado detectado.'],
    diagnosticos_diferenciais: alterados.length > 0
      ? alterados.map((a) => `${a.parametro}: ${a.interpretacao}`)
      : ['Sem alterações para diagnóstico diferencial.'],
    investigacao_recomendada: resultado.sugestoes.slice(0, 5).map((s) => `${s.titulo}: ${s.detalhe}`),
    explicacao_paciente: mode === 'patient'
      ? `Seu hemograma foi analisado. ${alterados.length > 0 ? `Foram encontrados ${alterados.length} ponto(s) que seu médico irá avaliar com você.` : 'Os resultados estão dentro dos valores esperados.'} Sempre consulte seu profissional de saúde para a interpretação completa.`
      : `Relatório gerado pelo motor clínico local. Configure OPENAI_API_KEY para interpretação com ${model ?? 'gpt-5.2'}.`,
    aviso: '⚠️ Este relatório é uma ferramenta de apoio à decisão clínica. Não substitui avaliação médica individualizada.',
  }
}

export default aiRoutes

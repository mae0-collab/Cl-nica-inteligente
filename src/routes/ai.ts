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

export default aiRoutes

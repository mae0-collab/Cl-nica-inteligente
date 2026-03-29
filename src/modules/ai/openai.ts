// ============================================================
// AI MODULE — OpenAI Integration
// Usa fetch direto para Chat Completions API (compatível com
// Cloudflare Workers — client.responses.create não funciona)
// Structured Outputs via response_format: json_schema
// ============================================================

import type { AIReportOutput, ClinicalResult } from '../clinical-intelligence/types'
import type { ReportMode } from './prompts'
import {
  CLINICAL_REPORT_JSON_SCHEMA,
  buildClinicalSystemPrompt,
  buildUserContent,
} from './prompts'

// ─────────────────────────────────────────────────────────────
// Gera relatório clínico via Chat Completions + Structured Outputs
// Compatível com Cloudflare Workers (fetch nativo)
// ─────────────────────────────────────────────────────────────
export async function generateAIClinicalReport(params: {
  apiKey:         string
  model:          string
  patientName?:   string
  clinicalResult: ClinicalResult
  labs:           Record<string, number | undefined>
  mode:           ReportMode
}): Promise<{ report: AIReportOutput; tokensUsed: number }> {

  const systemPrompt = buildClinicalSystemPrompt(params.mode)
  const userContent  = buildUserContent({
    patientName:       params.patientName,
    findings:          params.clinicalResult.findings,
    suggestions:       params.clinicalResult.suggestions,
    combinationAlerts: params.clinicalResult.combinationAlerts,
    labs:              params.labs as Record<string, number | string | null | undefined>,
    mode:              params.mode,
  })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       params.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      response_format: {
        type:        'json_schema',
        json_schema: {
          name:   'clinical_report',
          strict: true,
          schema: CLINICAL_REPORT_JSON_SCHEMA,
        },
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errText}`)
  }

  const data = await response.json() as any

  const raw        = data.choices?.[0]?.message?.content ?? ''
  const tokensUsed = data.usage?.total_tokens ?? 0

  if (!raw) throw new Error('OpenAI retornou resposta vazia')

  const report = JSON.parse(raw) as AIReportOutput
  return { report, tokensUsed }
}

// ─────────────────────────────────────────────────────────────
// Fallback local (sem API key ou em caso de erro na API)
// ─────────────────────────────────────────────────────────────
export function buildLocalFallbackReport(
  clinicalResult: ClinicalResult,
  mode: ReportMode,
): AIReportOutput {
  const { findings, suggestions, combinationAlerts, healthScore } = clinicalResult
  const topFindings = findings.slice(0, 3).join('; ')

  return {
    summary:
      mode === 'clinical'
        ? findings.length > 0
          ? `Foram identificados ${findings.length} achado(s): ${topFindings}. Avaliação e conduta ficam a critério do profissional.`
          : `Perfil laboratorial dentro dos parâmetros funcionais ideais. Score de saúde: ${healthScore}/100.`
        : findings.length > 0
          ? `Seus exames mostram alguns pontos que seu profissional de saúde vai analisar com você.`
          : `Seus exames estão dentro dos parâmetros esperados. Continue mantendo hábitos saudáveis.`,

    clinicalInterpretation:
      findings.length > 0
        ? findings.map((f) => `Achado: ${f}`)
        : ['Todos os marcadores analisados estão dentro da faixa funcional ideal.'],

    patientFriendlyExplanation:
      mode === 'patient'
        ? findings.length > 0
          ? `Seu profissional identificou ${findings.length} ponto(s) nos seus exames que merecem atenção. Siga as orientações do seu profissional.`
          : `Seus exames estão ótimos! Continue com seus hábitos saudáveis.`
        : `${findings.length > 0 ? findings.length + ' achado(s) identificado(s).' : 'Sem achados anormais.'} Avalie individualmente com o paciente.`,

    followUpQuestions:
      combinationAlerts.length > 0
        ? combinationAlerts.map((a) => `Investigar: ${a}`)
        : suggestions.length > 0
          ? suggestions.slice(0, 3).map((s) => `Considerar: ${s}`)
          : ['Reavaliar após intervenções recomendadas.', 'Repetir exames em 60–90 dias.'],

    caution:
      'Este relatório é gerado por um sistema de apoio à decisão clínica e não substitui a avaliação médica individualizada.',
  }
}

// ─────────────────────────────────────────────────────────────
// Chat livre via Chat Completions (fetch direto)
// ─────────────────────────────────────────────────────────────
export async function generateChatResponse(params: {
  apiKey:      string
  model:       string
  systemPrompt: string
  userPrompt:  string
}): Promise<{ response: string; tokensUsed: number }> {

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       params.model,
      temperature: 0.7,
      max_completion_tokens: 800,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user',   content: params.userPrompt   },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI chat error ${res.status}`)
  }

  const data      = await res.json() as any
  const response  = data.choices?.[0]?.message?.content ?? 'Sem resposta.'
  const tokensUsed = data.usage?.total_tokens ?? 0

  return { response, tokensUsed }
}

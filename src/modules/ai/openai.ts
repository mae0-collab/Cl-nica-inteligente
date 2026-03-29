// ============================================================
// AI MODULE — OpenAI Integration
// Integração real com OpenAI Responses API + Structured Outputs
// Cloudflare Workers: API key vem de c.env (não process.env)
// ============================================================

import OpenAI from 'openai'
import type { AIReportOutput, ClinicalResult } from '../clinical-intelligence/types'
import type { ReportMode } from './prompts'
import {
  CLINICAL_REPORT_JSON_SCHEMA,
  buildClinicalSystemPrompt,
  buildUserContent,
} from './prompts'

// ─────────────────────────────────────────────────────────────
// Factory: cria cliente OpenAI com a chave do Cloudflare env
// dangerouslyAllowBrowser: false — Workers não são browsers
// ─────────────────────────────────────────────────────────────
export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: false,
  })
}

// ─────────────────────────────────────────────────────────────
// Gera relatório clínico via OpenAI Responses API
// store: false — sem retenção de dados no OpenAI
// ─────────────────────────────────────────────────────────────
export async function generateAIClinicalReport(params: {
  apiKey:        string
  model:         string
  patientName?:  string
  clinicalResult: ClinicalResult
  labs:          Record<string, number | undefined>
  mode:          ReportMode
}): Promise<{ report: AIReportOutput; tokensUsed: number }> {
  const client = createOpenAIClient(params.apiKey)

  const systemPrompt = buildClinicalSystemPrompt(params.mode)
  const userContent  = buildUserContent({
    patientName:       params.patientName,
    findings:          params.clinicalResult.findings,
    suggestions:       params.clinicalResult.suggestions,
    combinationAlerts: params.clinicalResult.combinationAlerts,
    labs:              params.labs as Record<string, number | string | null | undefined>,
    mode:              params.mode,
  })

  const response = await client.responses.create({
    model:  params.model,
    store:  false,   // sem retenção no OpenAI
    input: [
      {
        role:    'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role:    'user',
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
  const report = JSON.parse(raw) as AIReportOutput
  const tokensUsed = (response as any).usage?.total_tokens ?? 0

  return { report, tokensUsed }
}

// ─────────────────────────────────────────────────────────────
// Fallback local (sem API key ou em caso de erro na API)
// Mantém a mesma estrutura de AIReportOutput
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
          ? `Seu profissional identificou ${findings.length} ponto(s) nos seus exames que merecem atenção. Siga as orientações do seu profissional de saúde para os próximos passos.`
          : `Seus exames estão ótimos! Continue com seus hábitos saudáveis.`
        : `${findings.length > 0 ? findings.length + ' achado(s) identificado(s).' : 'Sem achados anormais.'} Avalie individualmente com o paciente.`,

    followUpQuestions:
      combinationAlerts.length > 0
        ? combinationAlerts.map((a) => `Investigar: ${a}`)
        : suggestions.length > 0
          ? suggestions.slice(0, 3).map((s) => `Considerar: ${s}`)
          : ['Reavaliar após intervenções recomendadas.', 'Repetir exames em 60–90 dias se houver alterações.'],

    caution:
      'Este relatório é gerado por um sistema de apoio à decisão clínica e não substitui a avaliação médica individualizada. Para relatórios com IA real, configure OPENAI_API_KEY.',
  }
}

// ============================================================
// AI MODULE — Prompts
// Prompts do sistema para cada modo de relatório
// Mantidos separados para facilitar iteração e versionamento
// ============================================================

export type ReportMode = 'clinical' | 'patient'

export function buildClinicalSystemPrompt(mode: ReportMode): string {
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

  // Modo clínico (profissional de saúde)
  return [
    'Você é um assistente de apoio à decisão clínica para profissionais de saúde.',
    'Sua função é organizar e interpretar os achados laboratoriais e clínicos recebidos.',
    'Não dê diagnóstico definitivo nem substitua julgamento médico.',
    'Não invente exames, sintomas ou histórico não fornecidos.',
    'Seja técnico, conciso e cauteloso.',
    'Aponte limitações quando faltarem dados para uma conclusão completa.',
    'Baseie-se apenas nos dados recebidos — não faça suposições.',
    'Baseie-se em evidências científicas.',
    'Responda em português brasileiro.',
  ].join(' ')
}

export function buildUserContent(input: {
  patientName?:      string
  findings:          string[]
  suggestions:       string[]
  combinationAlerts: string[]
  labs:              Record<string, number | string | null | undefined>
  mode:              ReportMode
}): string {
  return JSON.stringify({
    patientName:       input.patientName ?? null,
    labs:              input.labs,
    findings:          input.findings,
    combinationAlerts: input.combinationAlerts,
    suggestions:       input.suggestions,
    instruction:
      input.mode === 'patient'
        ? 'Gere explicação para o paciente em linguagem acessível e encorajadora.'
        : 'Gere relatório clínico técnico e conciso para o profissional de saúde.',
  })
}

// JSON Schema estrito para Structured Outputs
export const CLINICAL_REPORT_JSON_SCHEMA = {
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

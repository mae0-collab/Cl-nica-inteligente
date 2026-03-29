// ============================================================
// HEMOGRAMA MODULE — Prompts IA
// System prompt especializado em hematologia clínica
// ============================================================

import type { HemogramaInput, HemogramaResult } from './types'

export function buildHemogramaSystemPrompt(mode: 'clinical' | 'patient'): string {
  if (mode === 'patient') {
    return [
      'Você é um assistente especializado em hemogramas, criado para explicar resultados de exames de sangue para pacientes.',
      'Use linguagem simples, sem jargões médicos desnecessários.',
      'Seja encorajador, nunca alarmista — mesmo quando há alterações.',
      'Sempre lembre que o profissional de saúde irá interpretar os resultados definitivamente.',
      'Não faça diagnósticos. Não prescreva tratamentos.',
      'Responda em português brasileiro.',
    ].join(' ')
  }

  return [
    'Você é um hematologista clínico especialista em interpretação de hemogramas e FSA (Fórmula Sanguínea Ampliada).',
    'Sua função: interpretar os dados do hemograma fornecidos, correlacionar achados, identificar padrões diagnósticos e gerar hipóteses clínicas fundamentadas.',
    'Estruture sua resposta com: (1) Resumo executivo, (2) Interpretação série a série, (3) Padrões diagnósticos, (4) Diagnósticos diferenciais prioritários, (5) Investigação recomendada.',
    'Base-se apenas nos dados fornecidos. Não invente valores não informados.',
    'Indique quando a ausência de dados limita a interpretação.',
    'Use terminologia hematológica precisa.',
    'Cite correlações clínicas relevantes (ex: VCM + HCM + RDW para tipagem da anemia).',
    'Seja conciso e objetivo — profissional de saúde lê para tomar decisão clínica.',
    'Responda em português brasileiro.',
  ].join(' ')
}

export function buildHemogramaUserContent(
  input: HemogramaInput,
  result: HemogramaResult,
  patientName?: string,
  mode: 'clinical' | 'patient' = 'clinical',
): string {
  const labLines: string[] = []

  // Série vermelha
  if (input.hemoglobina !== undefined) labLines.push(`Hemoglobina: ${input.hemoglobina} g/dL`)
  if (input.hematocrito !== undefined) labLines.push(`Hematócrito: ${input.hematocrito}%`)
  if (input.eritrocitos !== undefined) labLines.push(`Eritrócitos: ${input.eritrocitos} milhões/µL`)
  if (input.vcm        !== undefined) labLines.push(`VCM: ${input.vcm} fL`)
  if (input.hcm        !== undefined) labLines.push(`HCM: ${input.hcm} pg`)
  if (input.chcm       !== undefined) labLines.push(`CHCM: ${input.chcm} g/dL`)
  if (input.rdw        !== undefined) labLines.push(`RDW: ${input.rdw}%`)
  // Leucograma
  if (input.leucocitos  !== undefined) labLines.push(`Leucócitos: ${input.leucocitos}/µL`)
  if (input.neutrofilos !== undefined) labLines.push(`Neutrófilos: ${input.neutrofilos}/µL`)
  if (input.linfocitos  !== undefined) labLines.push(`Linfócitos: ${input.linfocitos}/µL`)
  if (input.monocitos   !== undefined) labLines.push(`Monócitos: ${input.monocitos}/µL`)
  if (input.eosinofilos !== undefined) labLines.push(`Eosinófilos: ${input.eosinofilos}/µL`)
  if (input.basofilos   !== undefined) labLines.push(`Basófilos: ${input.basofilos}/µL`)
  if (input.bastoes     !== undefined) labLines.push(`Bastões: ${input.bastoes}/µL`)
  // Plaquetas
  if (input.plaquetas !== undefined) labLines.push(`Plaquetas: ${input.plaquetas}/µL`)

  const anadosAlterados = result.achados
    .filter((a) => a.status !== 'ok')
    .map((a) => `• ${a.parametro} (${a.status.toUpperCase()}): ${a.interpretacao}`)

  const padroesList = result.padroes.map((p) => `• ${p.nome} — ${p.descricao}`)

  const instrucao = mode === 'patient'
    ? 'Explique os resultados em linguagem simples para o paciente. Seja encorajador.'
    : 'Gere interpretação clínica técnica e completa para o profissional de saúde.'

  return JSON.stringify({
    paciente: patientName ?? null,
    sexo:     input.sexo ?? null,
    idade:    input.idade ?? null,
    resultados_laboratoriais: labLines,
    achados_alterados: anadosAlterados.length > 0 ? anadosAlterados : ['Nenhum achado alterado detectado'],
    padroes_diagnosticos: padroesList.length > 0 ? padroesList : ['Nenhum padrão combinado detectado'],
    score_global: result.scoreGlobal,
    alertas_criticos: result.alertasCriticos,
    instrucao,
  }, null, 2)
}

// JSON Schema para Structured Outputs do Hemograma
export const HEMOGRAMA_REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resumo_executivo: { type: 'string' },
    interpretacao_series: {
      type: 'array',
      items: { type: 'string' },
    },
    padroes_diagnosticos: {
      type: 'array',
      items: { type: 'string' },
    },
    diagnosticos_diferenciais: {
      type: 'array',
      items: { type: 'string' },
    },
    investigacao_recomendada: {
      type: 'array',
      items: { type: 'string' },
    },
    explicacao_paciente: { type: 'string' },
    aviso: { type: 'string' },
  },
  required: [
    'resumo_executivo',
    'interpretacao_series',
    'padroes_diagnosticos',
    'diagnosticos_diferenciais',
    'investigacao_recomendada',
    'explicacao_paciente',
    'aviso',
  ],
} as const

export interface HemogramaReportOutput {
  resumo_executivo:          string
  interpretacao_series:      string[]
  padroes_diagnosticos:      string[]
  diagnosticos_diferenciais: string[]
  investigacao_recomendada:  string[]
  explicacao_paciente:       string
  aviso:                     string
}

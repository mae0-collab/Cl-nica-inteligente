// ============================================================
// CLINICAL INTELLIGENCE — Engine
// Orquestra rules + scoring + alertas combinados
// Ponto único de entrada para análise laboratorial
// ============================================================

import type { ClinicalResult, LabInput } from './types'
import { evaluateCombinationAlerts, evaluateFindings } from './rules'
import { calculateHealthScore } from './scoring'

export function analyzeClinicalLabs(labs: LabInput): ClinicalResult {
  // 1. Avaliar cada marcador individualmente
  const { textFindings, textSuggestions, richFindings, richSuggestions } =
    evaluateFindings(labs)

  // 2. Avaliar regras combinadas
  const { textAlerts, richAlerts } = evaluateCombinationAlerts(labs)

  // 3. Calcular score de saúde
  const healthScore = calculateHealthScore(labs)

  // 4. Contar marcadores fornecidos
  const markersAnalyzed = Object.values(labs).filter(
    (v) => v !== undefined && v !== null
  ).length

  // 5. Ordenar sugestões ricas por prioridade
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const sortedRichSuggestions = [...richSuggestions].sort(
    (a, b) => order[a.priority] - order[b.priority]
  )

  return {
    healthScore,
    markersAnalyzed,
    findings:          textFindings,
    combinationAlerts: textAlerts,
    suggestions:       textSuggestions,
    richFindings:      [...richFindings, ...richAlerts],
    richSuggestions:   sortedRichSuggestions,
  }
}

// ============================================================
// HEMOGRAMA ENGINE
// Orquestra todos os módulos de análise
// ============================================================

import type { HemogramaInput, HemogramaResult } from './types'
import {
  avaliarFSA,
  avaliarIndices,
  avaliarLeucograma,
  avaliarPlaquetas,
  avaliarSerieVermelha,
  detectarPadroes,
} from './rules'

export function analisarHemograma(input: HemogramaInput): HemogramaResult {
  // 1. Executar cada bloco de análise
  const serieVermelha = avaliarSerieVermelha(input)
  const indices       = avaliarIndices(input)
  const leucograma    = avaliarLeucograma(input)
  const fsa           = avaliarFSA(input)
  const plaquetas     = avaliarPlaquetas(input)
  const padroes       = detectarPadroes(input)

  // 2. Consolidar achados
  const todosAchados = [
    ...serieVermelha.achados,
    ...indices.achados,
    ...leucograma.achados,
    ...fsa.achados,
    ...plaquetas.achados,
  ]

  // 3. Consolidar sugestões (deduplicar por título)
  const todasSugestoes = [
    ...serieVermelha.sugestoes,
    ...indices.sugestoes,
    ...leucograma.sugestoes,
    ...fsa.sugestoes,
    ...plaquetas.sugestoes,
  ]
  const sugestoesUnicas = todasSugestoes.filter(
    (s, i, arr) => arr.findIndex((x) => x.titulo === s.titulo) === i
  )

  // 4. Ordenar sugestões por prioridade
  const ordemPrioridade: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
  const sugestoesSorted = [...sugestoesUnicas].sort(
    (a, b) => ordemPrioridade[a.prioridade] - ordemPrioridade[b.prioridade]
  )

  // 5. Alertas críticos e combinados
  const alertasCriticos = [
    ...serieVermelha.alertasCriticos,
    ...leucograma.alertasCriticos,
    ...fsa.alertasCriticos,
    ...plaquetas.alertasCriticos,
  ]

  // Alertas combinados dos padrões
  const alertasCombinados = padroes.map(
    (p) => `${p.nome}: ${p.descricao}`
  )

  // 6. Textos para IA
  const textos = [
    ...serieVermelha.textos,
    ...indices.textos,
    ...leucograma.textos,
    ...fsa.textos,
    ...plaquetas.textos,
  ]

  // 7. Contar parâmetros fornecidos
  const campos: (keyof HemogramaInput)[] = [
    'hematocrito', 'hemoglobina', 'eritrocitos', 'vcm', 'hcm', 'chcm', 'rdw',
    'leucocitos', 'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos', 'bastoes',
    'plaquetas',
  ]
  const parametrosAnalisados = campos.filter((k) => input[k] !== undefined && input[k] !== null).length

  // 8. Score global (porcentagem de parâmetros normais)
  const achadosComValor = todosAchados.filter((a) => a.parametro !== 'Bastões' || true)
  const normais = achadosComValor.filter((a) => a.status === 'ok').length
  const total   = achadosComValor.length
  const scoreGlobal = total > 0 ? Math.round((normais / total) * 100) : 0

  return {
    scoreGlobal,
    parametrosAnalisados,
    achados:          todosAchados,
    padroes,
    sugestoes:        sugestoesSorted,
    alertasCriticos,
    alertasCombinados,
    resumoTexto:      textos,
  }
}

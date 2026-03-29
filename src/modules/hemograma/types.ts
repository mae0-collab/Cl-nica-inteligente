// ============================================================
// HEMOGRAMA MODULE — Types
// Série Vermelha, Leucograma completo, Plaquetas, FSA
// ============================================================

// ── Entrada completa do hemograma ───────────────────────────
export interface HemogramaInput {
  // Série Vermelha
  hematocrito?:   number   // %
  hemoglobina?:   number   // g/dL
  eritrocitos?:   number   // milhões/µL  ex: 4.8
  vcm?:           number   // fL  (Volume Corpuscular Médio)
  hcm?:           number   // pg  (Hemoglobina Corpuscular Média)
  chcm?:          number   // g/dL (Concentração HCM)
  rdw?:           number   // %   (Amplitude de Distribuição)

  // Leucograma (contagem total)
  leucocitos?:    number   // /µL  ex: 7000

  // FSA — Fórmula Sanguínea Ampliada (valores absolutos /µL)
  neutrofilos?:   number   // /µL
  linfocitos?:    number   // /µL
  monocitos?:     number   // /µL
  eosinofilos?:   number   // /µL
  basofilos?:     number   // /µL
  bastoes?:       number   // /µL  (neutrófilos em bastão = desvio à esquerda)

  // Plaquetas
  plaquetas?:     number   // /µL  ex: 220000

  // Contexto do paciente (opcional, melhora interpretação)
  sexo?:          'M' | 'F'
  idade?:         number   // anos
}

// ── Status de cada item ─────────────────────────────────────
export type ItemStatus = 'ok' | 'low' | 'high' | 'borderline' | 'critical'
export type Severity   = 'low' | 'medium' | 'high' | 'critical'

// ── Achado individual ───────────────────────────────────────
export interface HemogramaFinding {
  parametro:   string
  valor:       number
  unidade:     string
  status:      ItemStatus
  referencia:  string
  interpretacao: string
  severidade:  Severity
  categoria:   'serie_vermelha' | 'leucograma' | 'fsa' | 'plaquetas' | 'indices' | 'combinado'
}

// ── Sugestão clínica ────────────────────────────────────────
export interface HemogramaSuggestion {
  titulo:     string
  detalhe:    string
  prioridade: 'urgente' | 'alta' | 'media' | 'baixa'
  categoria:  string
}

// ── Padrão diagnóstico detectado ───────────────────────────
export interface HemogramaPattern {
  nome:        string
  descricao:   string
  confianca:   'alta' | 'media' | 'baixa'
  marcadores:  string[]
}

// ── Resultado completo do engine ────────────────────────────
export interface HemogramaResult {
  scoreGlobal:      number          // 0–100
  parametrosAnalisados: number
  achados:          HemogramaFinding[]
  padroes:          HemogramaPattern[]
  sugestoes:        HemogramaSuggestion[]
  alertasCriticos:  string[]
  alertasCombinados: string[]
  resumoTexto:      string[]        // para a IA
}

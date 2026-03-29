// ============================================================
// CLINICAL INTELLIGENCE — Types
// Contratos de entrada e saída do motor clínico
// ============================================================

export type LabInput = {
  ferritin?:  number
  b12?:       number
  tsh?:       number
  vitaminD?:  number
  insulin?:   number
  glucose?:   number
}

// Achado individual por marcador (rico — para a rota legada /lab-report)
export interface Finding {
  marker:    string
  value:     number
  unit:      string
  status:    'ok' | 'low' | 'high' | 'borderline'
  reference: string
  message:   string
  severity:  'low' | 'medium' | 'high'
}

// Sugestão clínica priorizada (rica — para a rota legada /lab-report)
export interface Suggestion {
  category: string
  title:    string
  detail:   string
  priority: 'high' | 'medium' | 'low'
}

// Resultado simplificado do engine (usado por /analyze e geração de IA)
export interface ClinicalResult {
  healthScore:        number
  markersAnalyzed:    number
  findings:           string[]          // textos simples para a IA
  combinationAlerts:  string[]          // alertas de combinação
  suggestions:        string[]          // sugestões em texto
  richFindings:       Finding[]         // achados ricos para o frontend
  richSuggestions:    Suggestion[]      // sugestões ricas para o frontend
}

// Resposta estruturada da IA (JSON Schema estrito)
export interface AIReportOutput {
  summary:                   string
  clinicalInterpretation:    string[]
  patientFriendlyExplanation: string
  followUpQuestions:         string[]
  caution:                   string
}

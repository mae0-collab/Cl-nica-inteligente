// ============================================================
// CLINICAL INTELLIGENCE — Rules
// Regras clínicas puras: sem dependências externas, sem I/O
// Cada função é testável de forma isolada
// ============================================================

import type { Finding, LabInput, Suggestion } from './types'

// ─────────────────────────────────────────────────────────────
// Avalia cada marcador individualmente
// Retorna achados simples (strings) + achados ricos (Finding[])
// ─────────────────────────────────────────────────────────────
export function evaluateFindings(labs: LabInput): {
  textFindings:    string[]
  textSuggestions: string[]
  richFindings:    Finding[]
  richSuggestions: Suggestion[]
} {
  const textFindings:    string[]     = []
  const textSuggestions: string[]     = []
  const richFindings:    Finding[]    = []
  const richSuggestions: Suggestion[] = []

  // ── Ferritina ───────────────────────────────────────────────
  if (labs.ferritin !== undefined) {
    if (labs.ferritin < 20) {
      textFindings.push('Deficiência grave de ferro — ferritina criticamente baixa')
      textSuggestions.push('Reposição urgente de ferro quelado + vitamina C; investigar causa')
      richFindings.push({ marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL', status: 'low', reference: '< 20 = depleção grave', message: 'Ferritina criticamente baixa — depleção grave de ferro.', severity: 'high' })
      richSuggestions.push({ category: 'supplementation', priority: 'high', title: 'Suplementação de Ferro Urgente', detail: 'Ferro quelado 30–60 mg/dia + vitamina C. Solicitar hemograma e investigar causa.' })
    } else if (labs.ferritin < 70) {
      textFindings.push('Deficiência funcional de ferro — ferritina abaixo da faixa ideal')
      textSuggestions.push('Considerar estratégia para ferro com cofatores adequados (vitamina C, B6)')
      richFindings.push({ marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL', status: 'low', reference: 'Ideal: 70–150 ng/mL', message: 'Ferritina abaixo do ideal funcional — fadiga, queda capilar.', severity: 'medium' })
      richSuggestions.push({ category: 'supplementation', priority: 'medium', title: 'Reposição de Ferro', detail: 'Ferro quelado 15–30 mg/dia + vitamina C. Avaliar causa.' })
    } else if (labs.ferritin > 200) {
      textFindings.push('Ferritina elevada — possível inflamação ou sobrecarga de ferro')
      textSuggestions.push('Investigar PCR, saturação de transferrina e função hepática')
      richFindings.push({ marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL', status: 'high', reference: '> 200 ng/mL = elevada', message: 'Ferritina elevada — inflamação ou sobrecarga de ferro.', severity: 'medium' })
      richSuggestions.push({ category: 'further_testing', priority: 'medium', title: 'Investigar Ferritina Elevada', detail: 'PCR, saturação de transferrina, função hepática.' })
    } else {
      richFindings.push({ marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL', status: 'ok', reference: '70–200 ng/mL', message: 'Ferritina dentro da faixa funcional ideal.', severity: 'low' })
    }
  }

  // ── Vitamina B12 ────────────────────────────────────────────
  if (labs.b12 !== undefined) {
    if (labs.b12 < 300) {
      textFindings.push('Deficiência de vitamina B12 — risco neurológico')
      textSuggestions.push('Metilcobalamina sublingual 1.000–5.000 mcg/dia; investigar absorção e metilação')
      richFindings.push({ marker: 'Vitamina B12', value: labs.b12, unit: 'pg/mL', status: 'low', reference: '< 300 = deficiência', message: 'B12 deficiente — risco neurológico.', severity: 'high' })
      richSuggestions.push({ category: 'supplementation', priority: 'high', title: 'Reposição B12 Urgente', detail: 'Metilcobalamina sublingual 1.000–5.000 mcg/dia.' })
    } else if (labs.b12 < 500) {
      textFindings.push('Vitamina B12 abaixo da faixa funcional ideal — risco neurológico subclínico')
      textSuggestions.push('Investigar metilação, absorção e necessidade de suporte para B12')
      richFindings.push({ marker: 'Vitamina B12', value: labs.b12, unit: 'pg/mL', status: 'borderline', reference: 'Ideal: ≥ 500 pg/mL', message: 'B12 abaixo do ideal funcional — risco neurológico subclínico.', severity: 'medium' })
      richSuggestions.push({ category: 'supplementation', priority: 'medium', title: 'Suplementação B12', detail: 'Metilcobalamina 500–1.000 mcg/dia.' })
    } else {
      richFindings.push({ marker: 'Vitamina B12', value: labs.b12, unit: 'pg/mL', status: 'ok', reference: '≥ 500 pg/mL', message: 'B12 na faixa ideal.', severity: 'low' })
    }
  }

  // ── TSH ─────────────────────────────────────────────────────
  if (labs.tsh !== undefined) {
    if (labs.tsh < 0.4) {
      textFindings.push('TSH suprimido — avaliar hipertireoidismo')
      textSuggestions.push('Solicitar T4 livre, T3 livre, anti-TPO com urgência')
      richFindings.push({ marker: 'TSH', value: labs.tsh, unit: 'mUI/L', status: 'low', reference: '< 0,4 = hipertireoidismo', message: 'TSH suprimido — avaliar hipertireoidismo.', severity: 'high' })
      richSuggestions.push({ category: 'clinical_referral', priority: 'high', title: 'Encaminhamento Endocrinológico', detail: 'T4 livre, T3, anti-TPO urgente.' })
    } else if (labs.tsh > 4.0) {
      textFindings.push('TSH elevado — hipotireoidismo confirmado')
      textSuggestions.push('Avaliar T4 livre, anti-TPO e discutir reposição com levotiroxina')
      richFindings.push({ marker: 'TSH', value: labs.tsh, unit: 'mUI/L', status: 'high', reference: '> 4,0 = hipotireoidismo', message: 'TSH elevado — hipotireoidismo.', severity: 'high' })
      richSuggestions.push({ category: 'clinical_referral', priority: 'high', title: 'Avaliação Endocrinológica', detail: 'T4 livre, anti-TPO, discutir levotiroxina.' })
    } else if (labs.tsh > 2.0) {
      textFindings.push('Possível padrão de hipotireoidismo funcional — TSH acima do ideal funcional')
      textSuggestions.push('Avaliar painel tireoidiano completo: T4 livre, T3 livre, anti-TPO, anti-Tg')
      richFindings.push({ marker: 'TSH', value: labs.tsh, unit: 'mUI/L', status: 'borderline', reference: 'Ideal: 1,0–2,0 mUI/L', message: 'TSH acima do ideal funcional — hipotireoidismo subclínico.', severity: 'medium' })
      richSuggestions.push({ category: 'further_testing', priority: 'medium', title: 'Investigação Tireoidiana', detail: 'T4 livre, T3 livre, anti-TPO, anti-Tg.' })
    } else {
      richFindings.push({ marker: 'TSH', value: labs.tsh, unit: 'mUI/L', status: 'ok', reference: '0,4–2,0 mUI/L', message: 'TSH dentro da faixa ideal.', severity: 'low' })
    }
  }

  // ── Vitamina D ──────────────────────────────────────────────
  if (labs.vitaminD !== undefined) {
    if (labs.vitaminD < 20) {
      textFindings.push('Vitamina D criticamente baixa — deficiência grave')
      textSuggestions.push('Reposição urgente: 10.000–50.000 UI/dia de D3 + K2-MK7 100–200 mcg/dia')
      richFindings.push({ marker: 'Vitamina D', value: labs.vitaminD, unit: 'ng/mL', status: 'low', reference: '< 20 = deficiência grave', message: 'Vitamina D criticamente baixa.', severity: 'high' })
      richSuggestions.push({ category: 'supplementation', priority: 'high', title: 'Reposição Vitamina D3 Urgente', detail: '10.000–50.000 UI/dia + K2-MK7 100–200 mcg/dia.' })
    } else if (labs.vitaminD < 40) {
      textFindings.push('Vitamina D abaixo da faixa funcional desejável')
      textSuggestions.push('Rever exposição solar e suporte de vitamina D3 + K2')
      richFindings.push({ marker: 'Vitamina D', value: labs.vitaminD, unit: 'ng/mL', status: 'low', reference: 'Ideal: 60–80 ng/mL', message: 'Vitamina D deficiente.', severity: 'medium' })
      richSuggestions.push({ category: 'supplementation', priority: 'medium', title: 'Suplementação Vitamina D3', detail: '5.000–10.000 UI/dia + K2-MK7 100 mcg/dia.' })
    } else if (labs.vitaminD > 100) {
      textFindings.push('Vitamina D elevada — risco de hipercalcemia')
      textSuggestions.push('Suspender ou reduzir suplementação; monitorar cálcio e PTH')
      richFindings.push({ marker: 'Vitamina D', value: labs.vitaminD, unit: 'ng/mL', status: 'high', reference: '> 100 = risco toxicidade', message: 'Vitamina D elevada — risco de hipercalcemia.', severity: 'medium' })
      richSuggestions.push({ category: 'further_testing', priority: 'medium', title: 'Monitorar Cálcio e PTH', detail: 'Suspender/reduzir suplementação, solicitar cálcio e PTH.' })
    } else {
      richFindings.push({ marker: 'Vitamina D', value: labs.vitaminD, unit: 'ng/mL', status: 'ok', reference: '40–100 ng/mL', message: 'Vitamina D adequada.', severity: 'low' })
    }
  }

  // ── Insulina de Jejum ───────────────────────────────────────
  if (labs.insulin !== undefined) {
    if (labs.insulin > 15) {
      textFindings.push('Sinal de resistência à insulina — insulina de jejum elevada')
      textSuggestions.push('Considerar berberina 500 mg 2×/dia ou inositol 4 g/dia; reduzir carboidratos refinados')
      richFindings.push({ marker: 'Insulina de Jejum', value: labs.insulin, unit: 'mUI/L', status: 'high', reference: '> 15 = resistência', message: 'Resistência à insulina confirmada.', severity: 'high' })
      richSuggestions.push({ category: 'lifestyle', priority: 'high', title: 'Intervenção no Estilo de Vida', detail: 'Reduzir carboidratos refinados, exercícios de resistência 3–4×/semana.' })
      richSuggestions.push({ category: 'supplementation', priority: 'high', title: 'Sensibilizadores de Insulina', detail: 'Berberina 500 mg 2×/dia ou Inositol 4 g/dia.' })
    } else if (labs.insulin > 7) {
      textFindings.push('Sinal de resistência à insulina — insulina acima do ideal funcional')
      textSuggestions.push('Considerar estratégia para sensibilidade insulínica e ajuste alimentar')
      richFindings.push({ marker: 'Insulina de Jejum', value: labs.insulin, unit: 'mUI/L', status: 'borderline', reference: 'Ideal: < 7 mUI/L', message: 'Insulina acima do ideal — início de resistência.', severity: 'medium' })
      richSuggestions.push({ category: 'lifestyle', priority: 'medium', title: 'Ajuste Alimentar', detail: 'Reduzir índice glicêmico, caminhar após refeições.' })
    } else {
      richFindings.push({ marker: 'Insulina de Jejum', value: labs.insulin, unit: 'mUI/L', status: 'ok', reference: '< 7 mUI/L', message: 'Insulina dentro da faixa ideal.', severity: 'low' })
    }
  }

  // ── Glicose de Jejum ────────────────────────────────────────
  if (labs.glucose !== undefined) {
    if (labs.glucose >= 126) {
      textFindings.push('Glicose no critério diagnóstico de diabetes mellitus')
      textSuggestions.push('Confirmar com segunda dosagem ou TTGO; solicitar HbA1c e avaliação médica urgente')
      richFindings.push({ marker: 'Glicose de Jejum', value: labs.glucose, unit: 'mg/dL', status: 'high', reference: '≥ 126 = DM', message: 'Glicose no critério diagnóstico de diabetes.', severity: 'high' })
      richSuggestions.push({ category: 'clinical_referral', priority: 'high', title: 'Avaliação Médica Urgente', detail: 'Confirmar com segunda dosagem ou TTGO. Solicitar HbA1c.' })
    } else if (labs.glucose >= 100) {
      textFindings.push('Glicose acima do ideal funcional — faixa de pré-diabetes')
      textSuggestions.push('Rever padrão alimentar e contexto metabólico; perda de 7–10% do peso reduz risco')
      richFindings.push({ marker: 'Glicose de Jejum', value: labs.glucose, unit: 'mg/dL', status: 'borderline', reference: '100–125 = pré-diabetes', message: 'Glicose na faixa de pré-diabetes.', severity: 'high' })
      richSuggestions.push({ category: 'lifestyle', priority: 'high', title: 'Reversão de Pré-Diabetes', detail: 'Perda 7–10% do peso, dieta IG baixo, exercício 150 min/semana.' })
    } else if (labs.glucose >= 90) {
      textFindings.push('Glicose levemente acima do ideal funcional')
      textSuggestions.push('Rever padrão alimentar: reduzir açúcar adicionado e farinhas refinadas')
      richFindings.push({ marker: 'Glicose de Jejum', value: labs.glucose, unit: 'mg/dL', status: 'borderline', reference: 'Ideal: < 90 mg/dL', message: 'Glicose levemente acima do ideal funcional.', severity: 'low' })
      richSuggestions.push({ category: 'nutrition', priority: 'low', title: 'Ajuste Dietético', detail: 'Reduzir açúcar adicionado e farinhas refinadas.' })
    } else {
      richFindings.push({ marker: 'Glicose de Jejum', value: labs.glucose, unit: 'mg/dL', status: 'ok', reference: '70–89 mg/dL', message: 'Glicose dentro da faixa ideal.', severity: 'low' })
    }
  }

  return { textFindings, textSuggestions, richFindings, richSuggestions }
}

// ─────────────────────────────────────────────────────────────
// Regras combinadas — avalia padrões cruzados entre marcadores
// ─────────────────────────────────────────────────────────────
export function evaluateCombinationAlerts(labs: LabInput): {
  textAlerts:  string[]
  richAlerts:  import('./types').Finding[]
} {
  const textAlerts:  string[]                         = []
  const richAlerts:  import('./types').Finding[]      = []

  // Ferro baixo + B12 baixa → má absorção intestinal
  if (
    labs.ferritin !== undefined && labs.ferritin < 70 &&
    labs.b12      !== undefined && labs.b12      < 500
  ) {
    textAlerts.push('Ferro baixo + B12 baixa: investigar absorção intestinal e estado nutricional global (disbiose, gastrite atrófica, doença celíaca, uso de IBPs)')
    richAlerts.push({ marker: 'Alerta Combinado: Ferritina + B12', value: 0, unit: '', status: 'low', reference: 'Ambos abaixo do ideal', message: 'Possível má absorção intestinal — investigar.', severity: 'high' })
  }

  // Insulina elevada + glicose elevada → síndrome metabólica
  if (
    labs.insulin !== undefined && labs.insulin > 7  &&
    labs.glucose !== undefined && labs.glucose >= 100
  ) {
    textAlerts.push('Insulina elevada + glicose ≥ 100: forte atenção para disfunção metabólica — padrão de síndrome metabólica')
    richAlerts.push({ marker: 'Alerta Combinado: Insulina + Glicose', value: 0, unit: '', status: 'high', reference: 'Síndrome metabólica', message: 'Insulina elevada + glicose ≥ 100 — padrão de síndrome metabólica.', severity: 'high' })
  }

  return { textAlerts, richAlerts }
}

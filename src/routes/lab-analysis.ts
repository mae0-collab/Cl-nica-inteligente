// ============================================================
// LAB ANALYSIS - Interpretação de Exames Laboratoriais
// POST /api/lab/analyze  (requer autenticação)
// ============================================================

import { Hono } from 'hono'
import { authMiddleware } from '../auth/middleware'
import { labAnalysisSchema, validateBody } from '../validators/schemas'
import type { Env } from '../lib/types'

const app = new Hono<Env>()

// -------------------------------------------------------
// Tipos internos
// -------------------------------------------------------

interface Finding {
  marker: string        // nome do marcador (ex: "Ferritina")
  value: number         // valor fornecido
  unit: string          // unidade de medida
  status: 'low' | 'high' | 'borderline' | 'ok'
  reference: string     // referência clínica usada
  message: string       // achado clínico em PT-BR
  severity: 'low' | 'medium' | 'high'  // severidade do achado
}

interface Suggestion {
  category: 'nutrition' | 'supplementation' | 'lifestyle' | 'further_testing' | 'clinical_referral'
  title: string
  detail: string
  priority: 'low' | 'medium' | 'high'
}

// -------------------------------------------------------
// Regras clínicas por marcador
// Referências: SBME, FMRP-USP, UpToDate
// -------------------------------------------------------

function evaluateMarkers(data: Record<string, number | undefined>): {
  findings: Finding[]
  suggestions: Suggestion[]
} {
  const findings: Finding[] = []
  const suggestions: Suggestion[] = []

  const { ferritin, b12, tsh, vitaminD, insulin, glucose } = data

  // ─────────────────────────────────────────
  // FERRITINA
  // Referência funcional: 70–150 ng/mL (não apenas "dentro do normal")
  // ─────────────────────────────────────────
  if (ferritin !== undefined) {
    if (ferritin < 20) {
      findings.push({
        marker: 'Ferritina',
        value: ferritin,
        unit: 'ng/mL',
        status: 'low',
        reference: '< 20 ng/mL = depleção grave',
        message: 'Ferritina criticamente baixa — depleção grave de ferro. Risco elevado de anemia ferropriva.',
        severity: 'high',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Suplementação de Ferro Urgente',
        detail: 'Considerar ferro quelado (bisglitinato ferroso) 30–60 mg/dia em jejum. Avaliar causa da depleção grave (sangramento, má absorção). Solicitar hemograma completo, reticulócitos e VCM.',
        priority: 'high',
      })
    } else if (ferritin < 70) {
      findings.push({
        marker: 'Ferritina',
        value: ferritin,
        unit: 'ng/mL',
        status: 'low',
        reference: '70–150 ng/mL = faixa funcional ideal',
        message: 'Ferritina abaixo do ideal funcional — possível deficiência de ferro sem anemia ainda instalada. Pode causar fadiga, queda capilar e redução cognitiva.',
        severity: 'medium',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Reposição de Ferro',
        detail: 'Suplementar ferro quelado 15–30 mg/dia. Aumentar consumo de fontes heme (carne vermelha magra, fígado). Associar vitamina C para melhorar absorção. Evitar cálcio e chá preto próximos à refeição com ferro.',
        priority: 'medium',
      })
      suggestions.push({
        category: 'further_testing',
        title: 'Avaliar Absorção Intestinal',
        detail: 'Investigar causa da ferritina baixa: solicitar PCR (inflamação eleva ferritina mascarando deficiência), satTS, ferro sérico e capacidade de ligação.',
        priority: 'medium',
      })
    } else if (ferritin > 200) {
      findings.push({
        marker: 'Ferritina',
        value: ferritin,
        unit: 'ng/mL',
        status: 'high',
        reference: '> 200 ng/mL = elevada',
        message: 'Ferritina elevada — pode indicar inflamação crônica, sobrecarga de ferro ou síndrome metabólica. Não é necessariamente positivo.',
        severity: 'medium',
      })
      suggestions.push({
        category: 'further_testing',
        title: 'Investigar Causa da Ferritina Elevada',
        detail: 'Solicitar PCR, VHS, saturação de transferrina e mutação HFE (hemocromatose hereditária). Avaliar função hepática (TGO, TGP, GGT).',
        priority: 'medium',
      })
    } else {
      findings.push({
        marker: 'Ferritina',
        value: ferritin,
        unit: 'ng/mL',
        status: 'ok',
        reference: '70–200 ng/mL',
        message: 'Ferritina dentro da faixa funcional ideal.',
        severity: 'low',
      })
    }
  }

  // ─────────────────────────────────────────
  // VITAMINA B12
  // Referência funcional: > 500 pg/mL (não apenas > 200 do convencional)
  // ─────────────────────────────────────────
  if (b12 !== undefined) {
    if (b12 < 300) {
      findings.push({
        marker: 'Vitamina B12',
        value: b12,
        unit: 'pg/mL',
        status: 'low',
        reference: '< 300 pg/mL = deficiência',
        message: 'B12 com deficiência confirmada — alto risco neurológico. Pode causar neuropatia periférica, déficit cognitivo e megaloblastose.',
        severity: 'high',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Reposição de B12 Urgente',
        detail: 'Metilcobalamina sublingual 1.000–5.000 mcg/dia ou via intramuscular se má absorção confirmada. Investigar uso de metformina, IBP ou doença gástrica como causas.',
        priority: 'high',
      })
    } else if (b12 < 500) {
      findings.push({
        marker: 'Vitamina B12',
        value: b12,
        unit: 'pg/mL',
        status: 'borderline',
        reference: '> 500 pg/mL = faixa funcional ideal',
        message: 'B12 abaixo do ideal funcional — possível risco neurológico subclínico. Níveis entre 300–500 pg/mL ainda podem causar sintomas como formigamento, esquecimento e fadiga.',
        severity: 'medium',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Suplementação de B12',
        detail: 'Metilcobalamina ou adenosilcobalamina 500–1.000 mcg/dia. Evitar cianocobalamina por menor biodisponibilidade. Incluir ovos, laticínios e carnes na dieta.',
        priority: 'medium',
      })
    } else {
      findings.push({
        marker: 'Vitamina B12',
        value: b12,
        unit: 'pg/mL',
        status: 'ok',
        reference: '≥ 500 pg/mL',
        message: 'Vitamina B12 na faixa funcional ideal.',
        severity: 'low',
      })
    }
  }

  // ─────────────────────────────────────────
  // TSH (Hormônio Estimulante da Tireoide)
  // Referência funcional: 1.0–2.0 mUI/L (ideal); convencional 0.4–4.0
  // ─────────────────────────────────────────
  if (tsh !== undefined) {
    if (tsh < 0.4) {
      findings.push({
        marker: 'TSH',
        value: tsh,
        unit: 'mUI/L',
        status: 'low',
        reference: '< 0,4 mUI/L = hipertireoidismo',
        message: 'TSH suprimido — sugere hipertireoidismo ou excesso de hormônio tireoidiano exógeno. Investigar urgentemente.',
        severity: 'high',
      })
      suggestions.push({
        category: 'clinical_referral',
        title: 'Encaminhamento para Endocrinologia',
        detail: 'TSH suprimido requer avaliação endocrinológica urgente. Solicitar T4 livre, T3 total, anti-TPO e cintilografia se indicado.',
        priority: 'high',
      })
    } else if (tsh > 2.0 && tsh <= 4.0) {
      findings.push({
        marker: 'TSH',
        value: tsh,
        unit: 'mUI/L',
        status: 'borderline',
        reference: '1,0–2,0 mUI/L = faixa funcional ideal',
        message: 'TSH acima da faixa funcional ideal (ainda dentro do convencional). Pode indicar hipotireoidismo subclínico. Sintomas como cansaço, ganho de peso e lentidão cognitiva são comuns.',
        severity: 'medium',
      })
      suggestions.push({
        category: 'further_testing',
        title: 'Investigação Tireoidiana Completa',
        detail: 'Solicitar T4 livre, T3 livre, anti-TPO e anti-Tg. Avaliar sintomas clínicos de hipotireoidismo subclínico. Verificar status de selênio e iodo, essenciais para função tireoidiana.',
        priority: 'medium',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Suporte Nutricional para Tireoide',
        detail: 'Selênio 100–200 mcg/dia (selenometionina), zinco 10–30 mg/dia e iodo adequado na dieta. Evitar excesso de crucíferas cruas e soja que podem interferir na função tireoidiana.',
        priority: 'low',
      })
    } else if (tsh > 4.0) {
      findings.push({
        marker: 'TSH',
        value: tsh,
        unit: 'mUI/L',
        status: 'high',
        reference: '> 4,0 mUI/L = hipotireoidismo',
        message: 'TSH elevado — confirma hipotireoidismo. Necessita avaliação clínica e possível tratamento medicamentoso.',
        severity: 'high',
      })
      suggestions.push({
        category: 'clinical_referral',
        title: 'Avaliação Endocrinológica',
        detail: 'Hipotireoidismo confirmado. Solicitar T4 livre, anti-TPO e anti-Tg. Discutir com endocrinologista indicação de levotiroxina.',
        priority: 'high',
      })
    } else {
      findings.push({
        marker: 'TSH',
        value: tsh,
        unit: 'mUI/L',
        status: 'ok',
        reference: '0,4–2,0 mUI/L',
        message: 'TSH dentro da faixa funcional adequada.',
        severity: 'low',
      })
    }
  }

  // ─────────────────────────────────────────
  // VITAMINA D (25-OH-D3)
  // Referência funcional: 60–80 ng/mL (não apenas > 30)
  // ─────────────────────────────────────────
  if (vitaminD !== undefined) {
    if (vitaminD < 20) {
      findings.push({
        marker: 'Vitamina D',
        value: vitaminD,
        unit: 'ng/mL',
        status: 'low',
        reference: '< 20 ng/mL = deficiência grave',
        message: 'Vitamina D criticamente baixa — deficiência grave. Impacto direto em imunidade, massa óssea, humor, resistência à insulina e função muscular.',
        severity: 'high',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Reposição de Vitamina D3 Urgente',
        detail: 'Colecalciferol (D3) 10.000–50.000 UI/dia por 8–12 semanas sob supervisão médica. Associar vitamina K2 (MK-7) 100–200 mcg/dia para direcionar cálcio aos ossos. Repetir dosagem em 3 meses.',
        priority: 'high',
      })
    } else if (vitaminD < 40) {
      findings.push({
        marker: 'Vitamina D',
        value: vitaminD,
        unit: 'ng/mL',
        status: 'low',
        reference: '60–80 ng/mL = faixa funcional ideal',
        message: 'Vitamina D deficiente — abaixo do ideal funcional. Associada a fadiga, infecções frequentes, distúrbios do humor e risco aumentado de doenças autoimunes.',
        severity: 'medium',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Suplementação de Vitamina D3',
        detail: 'Colecalciferol 5.000–10.000 UI/dia com gordura alimentar para melhor absorção. Associar K2 (MK-7) 100 mcg/dia. Exposição solar moderada (15–20 min/dia). Reavaliar em 3 meses.',
        priority: 'medium',
      })
    } else if (vitaminD > 100) {
      findings.push({
        marker: 'Vitamina D',
        value: vitaminD,
        unit: 'ng/mL',
        status: 'high',
        reference: '> 100 ng/mL = possível toxicidade',
        message: 'Vitamina D acima de 100 ng/mL — avaliar risco de hipervitaminose D com hipercalcemia.',
        severity: 'medium',
      })
      suggestions.push({
        category: 'further_testing',
        title: 'Monitorar Cálcio e PTH',
        detail: 'Suspender ou reduzir suplementação de D3. Solicitar cálcio sérico, cálcio urinário e PTH para descartar toxicidade.',
        priority: 'medium',
      })
    } else {
      findings.push({
        marker: 'Vitamina D',
        value: vitaminD,
        unit: 'ng/mL',
        status: 'ok',
        reference: '40–100 ng/mL',
        message: 'Vitamina D em nível adequado.',
        severity: 'low',
      })
    }
  }

  // ─────────────────────────────────────────
  // INSULINA DE JEJUM
  // Referência funcional: < 7 mUI/L (ideal < 5)
  // ─────────────────────────────────────────
  if (insulin !== undefined) {
    if (insulin > 15) {
      findings.push({
        marker: 'Insulina de Jejum',
        value: insulin,
        unit: 'mUI/L',
        status: 'high',
        reference: '> 15 mUI/L = resistência insulínica significativa',
        message: 'Insulina de jejum muito elevada — resistência à insulina confirmada. Alto risco de pré-diabetes, SOP, acantose nigricans e ganho de peso abdominal.',
        severity: 'high',
      })
      suggestions.push({
        category: 'lifestyle',
        title: 'Intervenção no Estilo de Vida',
        detail: 'Reduzir carboidratos refinados e ultraprocessados. Protocolo de jejum intermitente 16:8 se tolerado. Exercícios de resistência (musculação) 3–4x/semana comprovadamente reduzem insulina basal.',
        priority: 'high',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Suplementação Sensibilizadora de Insulina',
        detail: 'Berberina 500 mg 2x/dia ou Inositol (mio-inositol + D-chiro) 4g/dia. Cromo picolinato 200–400 mcg/dia. Magnésio quelado 300–400 mg/dia (deficiência de magnésio agrava resistência).',
        priority: 'high',
      })
      suggestions.push({
        category: 'further_testing',
        title: 'Perfil Metabólico Completo',
        detail: 'Solicitar HOMA-IR (calculado: insulina × glicose / 405), HbA1c, lipidograma, PCR ultrassensível e testosterona/DHEA se paciente feminina (rastrear SOP).',
        priority: 'medium',
      })
    } else if (insulin > 7) {
      findings.push({
        marker: 'Insulina de Jejum',
        value: insulin,
        unit: 'mUI/L',
        status: 'borderline',
        reference: '< 7 mUI/L = faixa funcional ideal',
        message: 'Insulina de jejum acima do ideal funcional — possível início de resistência insulínica. Frequentemente assintomática nesta fase.',
        severity: 'medium',
      })
      suggestions.push({
        category: 'lifestyle',
        title: 'Ajuste Alimentar Preventivo',
        detail: 'Reduzir índice glicêmico da dieta: priorizar fibras, proteínas e gorduras boas. Caminhar 20–30 min após refeições principais. Reduzir consumo de açúcar e álcool.',
        priority: 'medium',
      })
      suggestions.push({
        category: 'supplementation',
        title: 'Suporte Metabólico',
        detail: 'Magnésio quelado 300 mg/dia, cromo picolinato 200 mcg/dia e canela de Ceilão 500–1000 mg/dia podem auxiliar na sensibilidade à insulina.',
        priority: 'low',
      })
    } else {
      findings.push({
        marker: 'Insulina de Jejum',
        value: insulin,
        unit: 'mUI/L',
        status: 'ok',
        reference: '< 7 mUI/L',
        message: 'Insulina de jejum dentro da faixa funcional ideal.',
        severity: 'low',
      })
    }
  }

  // ─────────────────────────────────────────
  // GLICOSE DE JEJUM
  // Referência: < 99 mg/dL (ideal < 90)
  // ─────────────────────────────────────────
  if (glucose !== undefined) {
    if (glucose >= 126) {
      findings.push({
        marker: 'Glicose de Jejum',
        value: glucose,
        unit: 'mg/dL',
        status: 'high',
        reference: '≥ 126 mg/dL = critério diagnóstico de diabetes',
        message: 'Glicose de jejum no nível diagnóstico de diabetes mellitus (≥ 126 mg/dL em 2 dosagens). Necessita atenção médica imediata.',
        severity: 'high',
      })
      suggestions.push({
        category: 'clinical_referral',
        title: 'Avaliação Médica Urgente',
        detail: 'Confirmar diagnóstico de diabetes com segunda dosagem de glicemia em jejum ou TTGO (75g). Solicitar HbA1c, função renal (creatinina, ureia) e lipidograma.',
        priority: 'high',
      })
    } else if (glucose >= 100 && glucose < 126) {
      findings.push({
        marker: 'Glicose de Jejum',
        value: glucose,
        unit: 'mg/dL',
        status: 'borderline',
        reference: '100–125 mg/dL = pré-diabetes',
        message: 'Glicose de jejum na faixa de pré-diabetes (impaired fasting glucose). Sem intervenção, ~30% progridem para diabetes em 5 anos.',
        severity: 'high',
      })
      suggestions.push({
        category: 'lifestyle',
        title: 'Reversão de Pré-Diabetes',
        detail: 'Perda de 7–10% do peso corporal reduz risco em até 58% (estudo DPP). Priorizar dieta com baixo índice glicêmico, rica em fibras. Exercício aeróbico + resistência 150 min/semana.',
        priority: 'high',
      })
      suggestions.push({
        category: 'further_testing',
        title: 'Rastreio Metabólico Completo',
        detail: 'Solicitar HbA1c, insulina de jejum, HOMA-IR e TTGO. Avaliar pressão arterial, lipidograma e circunferência abdominal.',
        priority: 'medium',
      })
    } else if (glucose >= 90 && glucose < 100) {
      findings.push({
        marker: 'Glicose de Jejum',
        value: glucose,
        unit: 'mg/dL',
        status: 'borderline',
        reference: '< 90 mg/dL = faixa funcional ideal',
        message: 'Glicose de jejum levemente acima do ideal funcional. Não configura pré-diabetes, mas merece atenção preventiva.',
        severity: 'low',
      })
      suggestions.push({
        category: 'nutrition',
        title: 'Ajuste Dietético Preventivo',
        detail: 'Reduzir açúcar adicionado, bebidas açucaradas e farinhas refinadas. Incluir mais vegetais, leguminosas e proteínas magras. Manter atividade física regular.',
        priority: 'low',
      })
    } else {
      findings.push({
        marker: 'Glicose de Jejum',
        value: glucose,
        unit: 'mg/dL',
        status: 'ok',
        reference: '70–89 mg/dL',
        message: 'Glicose de jejum dentro da faixa funcional ideal.',
        severity: 'low',
      })
    }
  }

  // ─────────────────────────────────────────
  // REGRA COMBINADA: Ferritina + B12 baixos
  // Possível problema de absorção intestinal
  // ─────────────────────────────────────────
  if (
    ferritin !== undefined && ferritin < 70 &&
    b12 !== undefined && b12 < 500
  ) {
    findings.push({
      marker: 'Combinação Ferritina + B12',
      value: 0,
      unit: '',
      status: 'low',
      reference: 'Ambos abaixo do ideal funcional',
      message: 'Ferritina e B12 simultaneamente baixos — possível problema de absorção intestinal (má absorção, disbiose, gastrite atrófica, doença celíaca ou uso de IBP).',
      severity: 'high',
    })
    suggestions.push({
      category: 'further_testing',
      title: 'Investigação de Má Absorção Intestinal',
      detail: 'Solicitar: anti-transglutaminase IgA + IgG total (doença celíaca), calprotectina fecal (inflamação intestinal), pepsinogênio I/II + gastrina (gastrite atrófica), teste respiratório para H. pylori, e avaliação de permeabilidade intestinal. Considerar endoscopia alta com biópsia.',
      priority: 'high',
    })
    suggestions.push({
      category: 'supplementation',
      title: 'Suporte à Absorção',
      detail: 'Enzimas digestivas com HCl betaína antes das refeições principais. Probióticos multiestirpe 10–50 bilhões UFC/dia. L-glutamina 5–15 g/dia em jejum para integridade da mucosa intestinal.',
      priority: 'medium',
    })
  }

  // ─────────────────────────────────────────
  // REGRA COMBINADA: Insulina alta + Glicose elevada
  // Síndrome metabólica / risco DM2
  // ─────────────────────────────────────────
  if (
    insulin !== undefined && insulin > 7 &&
    glucose !== undefined && glucose >= 100
  ) {
    findings.push({
      marker: 'Combinação Insulina + Glicose',
      value: 0,
      unit: '',
      status: 'high',
      reference: 'Padrão de resistência insulínica com hiperglicemia',
      message: 'Insulina elevada combinada com glicose acima de 100 mg/dL — padrão de síndrome metabólica. Risco elevado de progressão para diabetes tipo 2.',
      severity: 'high',
    })
    suggestions.push({
      category: 'lifestyle',
      title: 'Intervenção Metabólica Intensiva',
      detail: 'Protocolo completo de reversão metabólica: dieta com restrição de carboidratos processados, jejum intermitente supervisionado, exercício de resistência + cardio, gerenciamento do sono (< 6h de sono aumenta resistência à insulina em até 40%). Considerar acompanhamento com nutricionista e endocrinologista.',
      priority: 'high',
    })
  }

  return { findings, suggestions }
}

// -------------------------------------------------------
// POST /analyze
// -------------------------------------------------------

app.post('/analyze', authMiddleware, async (c) => {
  try {
    const body = await c.req.json()

    const validated = validateBody(labAnalysisSchema, body)
    if (!validated.success) {
      return c.json({
        success: false,
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: validated.errors,
      }, 400)
    }

    // Os marcadores estão aninhados em `labs`
    const input = validated.data.labs

    const { findings, suggestions } = evaluateMarkers(input)

    // Calcular score geral de saúde (0-100) baseado nos achados
    const total = findings.filter((f) => f.marker !== 'Combinação Ferritina + B12' && f.marker !== 'Combinação Insulina + Glicose').length
    const abnormal = findings.filter((f) => f.status !== 'ok' && !f.marker.startsWith('Combinação')).length
    const healthScore = total > 0 ? Math.round(((total - abnormal) / total) * 100) : 100

    // Separar combinações dos achados individuais
    const individualFindings = findings.filter((f) => !f.marker.startsWith('Combinação'))
    const combinationFindings = findings.filter((f) => f.marker.startsWith('Combinação'))

    // Ordenar sugestões por prioridade
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    // Salvar interação de IA (análise laboratorial)
    try {
      const db = c.env.DB
      // Obter ID do profissional autenticado (injetado pelo authMiddleware)
      const professionalId = (c as any).get?.('professionalId') ?? null
      const markersAnalyzed = Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined && (input as Record<string, unknown>)[k] !== null)
      await db.prepare(`
        INSERT INTO ai_interactions 
          (professional_id, patient_id, context_type, prompt, response, tokens_used, created_at)
        VALUES (?, NULL, 'lab_interpretation', ?, ?, 0, CURRENT_TIMESTAMP)
      `).bind(
        professionalId,
        `Análise laboratorial: ${markersAnalyzed.join(', ')}`,
        JSON.stringify({ findings: individualFindings.length, suggestions: suggestions.length, healthScore }),
      ).run()
    } catch {
      // Não falhar a requisição por erro de log
    }

    return c.json({
      success: true,
      health_score: healthScore,
      markers_analyzed: Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined && (input as Record<string, unknown>)[k] !== null).length,
      findings: individualFindings,
      combination_alerts: combinationFindings,
      suggestions,
      disclaimer:
        'Esta análise é uma ferramenta de apoio clínico e não substitui a avaliação médica individualizada. Os valores de referência funcionais podem diferir dos laboratoriais convencionais.',
    })
  } catch (err) {
    console.error('Lab analysis error:', err)
    return c.json({
      success: false,
      error: 'Erro interno ao processar análise laboratorial.',
      code: 'INTERNAL_ERROR',
    }, 500)
  }
})

// -------------------------------------------------------
// GET /ranges  — retorna as referências usadas (público)
// -------------------------------------------------------
app.get('/ranges', (c) => {
  return c.json({
    success: true,
    note: 'Valores de referência funcionais (podem diferir dos laboratoriais convencionais)',
    markers: {
      ferritin: {
        unit: 'ng/mL',
        optimal: '70–150',
        low_borderline: '20–69',
        critically_low: '< 20',
        elevated: '> 200',
      },
      b12: {
        unit: 'pg/mL',
        optimal: '≥ 500',
        borderline: '300–499',
        deficient: '< 300',
      },
      tsh: {
        unit: 'mUI/L',
        optimal: '1,0–2,0',
        borderline_high: '2,1–4,0',
        hypothyroid: '> 4,0',
        hyperthyroid: '< 0,4',
      },
      vitaminD: {
        unit: 'ng/mL',
        optimal: '60–80',
        adequate: '40–59',
        deficient: '20–39',
        critically_deficient: '< 20',
        excessive: '> 100',
      },
      insulin: {
        unit: 'mUI/L',
        optimal: '< 5',
        acceptable: '5–7',
        borderline: '7–15',
        insulin_resistant: '> 15',
      },
      glucose: {
        unit: 'mg/dL',
        optimal: '70–89',
        acceptable: '90–99',
        prediabetes: '100–125',
        diabetes: '≥ 126',
      },
    },
  })
})

export default app

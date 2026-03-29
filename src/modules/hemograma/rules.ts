// ============================================================
// HEMOGRAMA — Regras Clínicas
// Série Vermelha, Índices Hematimétricos, Leucograma,
// FSA completa, Plaquetas + Padrões combinados
// Baseado em valores de referência hematológicos brasileiros
// ============================================================

import type {
  HemogramaFinding,
  HemogramaInput,
  HemogramaPattern,
  HemogramaSuggestion,
  ItemStatus,
  Severity,
} from './types'

// ── Helper: criar achado ─────────────────────────────────────
function achado(
  parametro: string,
  valor: number,
  unidade: string,
  status: ItemStatus,
  referencia: string,
  interpretacao: string,
  severidade: Severity,
  categoria: HemogramaFinding['categoria'],
): HemogramaFinding {
  return { parametro, valor, unidade, status, referencia, interpretacao, severidade, categoria }
}

// ── Helper: criar sugestão ───────────────────────────────────
function sug(
  titulo: string,
  detalhe: string,
  prioridade: HemogramaSuggestion['prioridade'],
  categoria: string,
): HemogramaSuggestion {
  return { titulo, detalhe, prioridade, categoria }
}

// ─────────────────────────────────────────────────────────────
// SÉRIE VERMELHA
// ─────────────────────────────────────────────────────────────
export function avaliarSerieVermelha(h: HemogramaInput): {
  achados: HemogramaFinding[]
  sugestoes: HemogramaSuggestion[]
  alertasCriticos: string[]
  textos: string[]
} {
  const achados:  HemogramaFinding[]      = []
  const sugestoes: HemogramaSuggestion[]  = []
  const alertasCriticos: string[]         = []
  const textos: string[]                  = []

  const sexoF = h.sexo === 'F'

  // ── Hemoglobina ──────────────────────────────────────────
  if (h.hemoglobina !== undefined) {
    const hbLowCrit = sexoF ? 7.0  : 7.0
    const hbLow     = sexoF ? 12.0 : 13.0
    const hbBorder  = sexoF ? 12.5 : 13.5
    const hbHigh    = sexoF ? 16.0 : 17.5
    const hbRef     = sexoF ? '12,0–16,0 g/dL' : '13,0–17,5 g/dL'

    if (h.hemoglobina < hbLowCrit) {
      alertasCriticos.push(`⚠️ Hemoglobina CRÍTICA (${h.hemoglobina} g/dL) — anemia grave, avaliar transfusão`)
      achados.push(achado('Hemoglobina', h.hemoglobina, 'g/dL', 'critical', hbRef, 'Anemia grave — risco de descompensação cardiovascular. Avaliar transfusão urgente.', 'critical', 'serie_vermelha'))
      sugestoes.push(sug('Avaliação Urgente — Anemia Grave', 'Avaliar necessidade de transfusão. ECG, função cardíaca. Investigar causa primária.', 'urgente', 'encaminhamento'))
      textos.push(`Hemoglobina CRÍTICA ${h.hemoglobina} g/dL — anemia grave, risco de descompensação`)
    } else if (h.hemoglobina < hbLow) {
      achados.push(achado('Hemoglobina', h.hemoglobina, 'g/dL', 'low', hbRef, 'Anemia confirmada. Investigar tipo (microcítica/normocítica/macrocítica) pelos índices.', 'high', 'serie_vermelha'))
      sugestoes.push(sug('Investigação Tipo de Anemia', 'Correlacionar com VCM, HCM, RDW. Solicitar ferro sérico, ferritina, B12, ácido fólico.', 'alta', 'diagnostico'))
      textos.push(`Hemoglobina baixa (${h.hemoglobina} g/dL) — anemia confirmada`)
    } else if (h.hemoglobina < hbBorder) {
      achados.push(achado('Hemoglobina', h.hemoglobina, 'g/dL', 'borderline', hbRef, 'Hemoglobina no limite inferior — anemia leve ou limítrofe.', 'medium', 'serie_vermelha'))
      textos.push(`Hemoglobina limítrofe (${h.hemoglobina} g/dL)`)
    } else if (h.hemoglobina > hbHigh) {
      achados.push(achado('Hemoglobina', h.hemoglobina, 'g/dL', 'high', hbRef, 'Poliglobulia — investigar policitemia vera, DPOC, tabagismo, doping (EPO).', 'high', 'serie_vermelha'))
      sugestoes.push(sug('Investigar Poliglobulia', 'Solicitar eritropoietina, saturação O₂, EPO sérica. Descartar policitemia vera (JAK2).', 'alta', 'diagnostico'))
      textos.push(`Hemoglobina elevada (${h.hemoglobina} g/dL) — poliglobulia`)
    } else {
      achados.push(achado('Hemoglobina', h.hemoglobina, 'g/dL', 'ok', hbRef, 'Hemoglobina dentro da faixa de referência.', 'low', 'serie_vermelha'))
    }
  }

  // ── Hematócrito ──────────────────────────────────────────
  if (h.hematocrito !== undefined) {
    const htRef  = sexoF ? '36–48%' : '39–54%'
    const htLow  = sexoF ? 36 : 39
    const htHigh = sexoF ? 48 : 54

    if (h.hematocrito < htLow) {
      achados.push(achado('Hematócrito', h.hematocrito, '%', 'low', htRef, 'Hematócrito reduzido — compatível com anemia.', 'medium', 'serie_vermelha'))
      textos.push(`Hematócrito baixo (${h.hematocrito}%)`)
    } else if (h.hematocrito > htHigh) {
      achados.push(achado('Hematócrito', h.hematocrito, '%', 'high', htRef, 'Hematócrito elevado — desidratação ou poliglobulia.', 'medium', 'serie_vermelha'))
      textos.push(`Hematócrito elevado (${h.hematocrito}%)`)
    } else {
      achados.push(achado('Hematócrito', h.hematocrito, '%', 'ok', htRef, 'Hematócrito normal.', 'low', 'serie_vermelha'))
    }
  }

  // ── Eritrócitos ──────────────────────────────────────────
  if (h.eritrocitos !== undefined) {
    const erRef  = sexoF ? '3,8–5,2 milhões/µL' : '4,2–6,0 milhões/µL'
    const erLow  = sexoF ? 3.8 : 4.2
    const erHigh = sexoF ? 5.2 : 6.0

    if (h.eritrocitos < erLow) {
      achados.push(achado('Eritrócitos', h.eritrocitos, 'milhões/µL', 'low', erRef, 'Eritrócitos reduzidos — anemia quantitativa.', 'medium', 'serie_vermelha'))
      textos.push(`Eritrócitos baixos (${h.eritrocitos} milhões/µL)`)
    } else if (h.eritrocitos > erHigh) {
      achados.push(achado('Eritrócitos', h.eritrocitos, 'milhões/µL', 'high', erRef, 'Eritrocitose — confirmar com hematócrito e Hb.', 'medium', 'serie_vermelha'))
      textos.push(`Eritrócitos elevados (${h.eritrocitos} milhões/µL)`)
    } else {
      achados.push(achado('Eritrócitos', h.eritrocitos, 'milhões/µL', 'ok', erRef, 'Eritrócitos dentro do esperado.', 'low', 'serie_vermelha'))
    }
  }

  return { achados, sugestoes, alertasCriticos, textos }
}

// ─────────────────────────────────────────────────────────────
// ÍNDICES HEMATIMÉTRICOS (VCM, HCM, CHCM, RDW)
// ─────────────────────────────────────────────────────────────
export function avaliarIndices(h: HemogramaInput): {
  achados: HemogramaFinding[]
  sugestoes: HemogramaSuggestion[]
  textos: string[]
} {
  const achados:  HemogramaFinding[]     = []
  const sugestoes: HemogramaSuggestion[] = []
  const textos: string[]                 = []

  // ── VCM (Volume Corpuscular Médio) ────────────────────────
  if (h.vcm !== undefined) {
    if (h.vcm < 80) {
      achados.push(achado('VCM', h.vcm, 'fL', 'low', '80–100 fL', 'Microcitose — sugere anemia ferropriva, talassemia ou anemia de doença crônica.', 'high', 'indices'))
      sugestoes.push(sug('Investigação da Microcitose', 'Solicitar: ferro sérico, ferritina, capacidade de ligação (TIBC), eletroforese de Hb (se suspeita de talassemia).', 'alta', 'diagnostico'))
      textos.push(`VCM baixo (${h.vcm} fL) — microcitose`)
    } else if (h.vcm > 100) {
      achados.push(achado('VCM', h.vcm, 'fL', 'high', '80–100 fL', 'Macrocitose — principais causas: deficiência de B12, folato, hipotireoidismo, hepatopatia, alcoolismo.', 'high', 'indices'))
      sugestoes.push(sug('Investigação da Macrocitose', 'Solicitar: B12, ácido fólico, TSH, função hepática (GGT, TGO, TGP). Anamnese sobre alcoolismo.', 'alta', 'diagnostico'))
      textos.push(`VCM elevado (${h.vcm} fL) — macrocitose`)
    } else {
      achados.push(achado('VCM', h.vcm, 'fL', 'ok', '80–100 fL', 'Normocitose — eritrócitos com tamanho normal.', 'low', 'indices'))
    }
  }

  // ── HCM ──────────────────────────────────────────────────
  if (h.hcm !== undefined) {
    if (h.hcm < 27) {
      achados.push(achado('HCM', h.hcm, 'pg', 'low', '27–33 pg', 'Hipocromia — eritrócitos com pouca hemoglobina. Sugere deficiência de ferro ou talassemia.', 'medium', 'indices'))
      textos.push(`HCM baixo (${h.hcm} pg) — hipocromia`)
    } else if (h.hcm > 33) {
      achados.push(achado('HCM', h.hcm, 'pg', 'high', '27–33 pg', 'Hipercromia — pode indicar esferocitose hereditária. Correlacionar com esfregaço.', 'medium', 'indices'))
      textos.push(`HCM elevado (${h.hcm} pg) — hipercromia`)
    } else {
      achados.push(achado('HCM', h.hcm, 'pg', 'ok', '27–33 pg', 'HCM dentro do esperado.', 'low', 'indices'))
    }
  }

  // ── CHCM ─────────────────────────────────────────────────
  if (h.chcm !== undefined) {
    if (h.chcm < 32) {
      achados.push(achado('CHCM', h.chcm, 'g/dL', 'low', '32–36 g/dL', 'CHCM reduzido — hipocromia eritrocitária (anemia ferropriva, talassemia).', 'medium', 'indices'))
      textos.push(`CHCM baixo (${h.chcm} g/dL) — hipocromia`)
    } else if (h.chcm > 36) {
      achados.push(achado('CHCM', h.chcm, 'g/dL', 'high', '32–36 g/dL', 'CHCM elevado — esferocitose hereditária ou erro analítico. Solicitar esfregaço.', 'high', 'indices'))
      sugestoes.push(sug('Solicitar Esfregaço do Sangue Periférico', 'CHCM > 36 g/dL pode indicar esferocitose. Avaliar morfologia eritrocitária.', 'alta', 'diagnostico'))
      textos.push(`CHCM elevado (${h.chcm} g/dL)`)
    } else {
      achados.push(achado('CHCM', h.chcm, 'g/dL', 'ok', '32–36 g/dL', 'CHCM normal.', 'low', 'indices'))
    }
  }

  // ── RDW ──────────────────────────────────────────────────
  if (h.rdw !== undefined) {
    if (h.rdw > 14.5) {
      achados.push(achado('RDW', h.rdw, '%', 'high', '11,5–14,5%', 'Anisocitose — variação anormal do tamanho dos eritrócitos. Encontrada em deficiências nutricionais, hemólise e síndromes mistas.', 'medium', 'indices'))
      sugestoes.push(sug('Investigar Causa da Anisocitose', 'Correlacionar com VCM: RDW alto + VCM baixo = ferropriva; RDW alto + VCM alto = B12/folato; RDW alto + VCM normal = anemia mista ou hemólise.', 'media', 'diagnostico'))
      textos.push(`RDW elevado (${h.rdw}%) — anisocitose`)
    } else if (h.rdw < 11.5) {
      achados.push(achado('RDW', h.rdw, '%', 'borderline', '11,5–14,5%', 'RDW abaixo do limite inferior — eritrócitos muito uniformes (talassemia minor).', 'low', 'indices'))
      textos.push(`RDW baixo (${h.rdw}%) — pode indicar talassemia minor`)
    } else {
      achados.push(achado('RDW', h.rdw, '%', 'ok', '11,5–14,5%', 'RDW normal — eritrócitos com variação de tamanho dentro do esperado.', 'low', 'indices'))
    }
  }

  return { achados, sugestoes, textos }
}

// ─────────────────────────────────────────────────────────────
// LEUCOGRAMA — Contagem total de leucócitos
// ─────────────────────────────────────────────────────────────
export function avaliarLeucograma(h: HemogramaInput): {
  achados: HemogramaFinding[]
  sugestoes: HemogramaSuggestion[]
  alertasCriticos: string[]
  textos: string[]
} {
  const achados:  HemogramaFinding[]     = []
  const sugestoes: HemogramaSuggestion[] = []
  const alertasCriticos: string[]        = []
  const textos: string[]                 = []

  if (h.leucocitos === undefined) return { achados, sugestoes, alertasCriticos, textos }

  const leu = h.leucocitos

  if (leu < 2000) {
    alertasCriticos.push(`⚠️ Leucopenia GRAVE (${leu}/µL) — risco infeccioso elevado, avaliar urgentemente`)
    achados.push(achado('Leucócitos', leu, '/µL', 'critical', '4.000–11.000/µL', 'Leucopenia grave — imunossupressão severa, risco de infecções oportunistas.', 'critical', 'leucograma'))
    sugestoes.push(sug('Avaliação Urgente — Leucopenia Grave', 'Investigar: aplasia medular, leucemia (exame de medula), uso de drogas mielossupressoras, infecções virais (HIV, EBV, CMV).', 'urgente', 'encaminhamento'))
    textos.push(`Leucócitos CRÍTICOS ${leu}/µL — leucopenia grave`)
  } else if (leu < 4000) {
    achados.push(achado('Leucócitos', leu, '/µL', 'low', '4.000–11.000/µL', 'Leucopenia — causas: viroses, medicamentos, lúpus, síndrome de Felty.', 'high', 'leucograma'))
    sugestoes.push(sug('Investigação de Leucopenia', 'Hemograma seriado, pesquisa viral (HIV, EBV, CMV, dengue), FAN para colagenoses, revisão de medicamentos.', 'alta', 'diagnostico'))
    textos.push(`Leucócitos baixos (${leu}/µL) — leucopenia`)
  } else if (leu > 30000) {
    alertasCriticos.push(`⚠️ Leucocitose EXTREMA (${leu}/µL) — suspeita de leucemia, avaliar urgentemente`)
    achados.push(achado('Leucócitos', leu, '/µL', 'critical', '4.000–11.000/µL', 'Leucocitose extrema — reação leucemoide ou leucemia. Solicitar mielograma com urgência.', 'critical', 'leucograma'))
    sugestoes.push(sug('Avaliação Urgente — Leucocitose Extrema', 'Encaminhar para hematologia. Solicitar: esfregaço periférico, LDH, ácido úrico, mielograma.', 'urgente', 'encaminhamento'))
    textos.push(`Leucócitos CRÍTICOS ${leu}/µL — leucocitose extrema, suspeita de neoplasia`)
  } else if (leu > 11000) {
    achados.push(achado('Leucócitos', leu, '/µL', 'high', '4.000–11.000/µL', 'Leucocitose — principais causas: infecção bacteriana, estresse, corticosteroides, tabagismo, inflamação.', 'medium', 'leucograma'))
    sugestoes.push(sug('Investigação de Leucocitose', 'Correlacionar com FSA (neutrofilia = infecção bacteriana; linfocitose = viral). PCR, VHS. Anamnese sobre infecções e medicamentos.', 'media', 'diagnostico'))
    textos.push(`Leucócitos elevados (${leu}/µL) — leucocitose`)
  } else {
    achados.push(achado('Leucócitos', leu, '/µL', 'ok', '4.000–11.000/µL', 'Contagem de leucócitos dentro da faixa normal.', 'low', 'leucograma'))
  }

  return { achados, sugestoes, alertasCriticos, textos }
}

// ─────────────────────────────────────────────────────────────
// FSA — Fórmula Sanguínea Ampliada (valores absolutos)
// ─────────────────────────────────────────────────────────────
export function avaliarFSA(h: HemogramaInput): {
  achados: HemogramaFinding[]
  sugestoes: HemogramaSuggestion[]
  alertasCriticos: string[]
  textos: string[]
} {
  const achados:  HemogramaFinding[]     = []
  const sugestoes: HemogramaSuggestion[] = []
  const alertasCriticos: string[]        = []
  const textos: string[]                 = []

  // ── Neutrófilos ───────────────────────────────────────────
  if (h.neutrofilos !== undefined) {
    const n = h.neutrofilos
    if (n < 500) {
      alertasCriticos.push(`⚠️ Neutropenia GRAVE (${n}/µL) — risco de infecção fatal, isolamento reverso`)
      achados.push(achado('Neutrófilos', n, '/µL', 'critical', '1.800–7.500/µL', 'Neutropenia grave — risco iminente de infecção bacteriana fatal.', 'critical', 'fsa'))
      sugestoes.push(sug('Neutropenia Grave — Urgência Médica', 'Hospitalização, isolamento reverso, considerar G-CSF. Investigar: aplasia, quimioterapia, agranulocitose medicamentosa.', 'urgente', 'encaminhamento'))
      textos.push(`Neutrófilos CRÍTICOS ${n}/µL — neutropenia grave`)
    } else if (n < 1800) {
      achados.push(achado('Neutrófilos', n, '/µL', 'low', '1.800–7.500/µL', 'Neutropenia — risco aumentado de infecções bacterianas.', 'high', 'fsa'))
      sugestoes.push(sug('Investigação de Neutropenia', 'Hemograma seriado, B12, cobre, revisão de medicamentos. Considerar neutropenia étnica benigna.', 'alta', 'diagnostico'))
      textos.push(`Neutrófilos baixos (${n}/µL) — neutropenia`)
    } else if (n > 7500) {
      achados.push(achado('Neutrófilos', n, '/µL', 'high', '1.800–7.500/µL', 'Neutrofilia — fortemente sugestivo de infecção bacteriana aguda. Também: corticoides, infarto, tabagismo.', 'medium', 'fsa'))
      sugestoes.push(sug('Investigação de Neutrofilia', 'Anamnese dirigida para foco infeccioso. PCR, VHS, hemocultura se febre. Revisar uso de corticosteroides.', 'media', 'diagnostico'))
      textos.push(`Neutrófilos elevados (${n}/µL) — neutrofilia`)
    } else {
      achados.push(achado('Neutrófilos', n, '/µL', 'ok', '1.800–7.500/µL', 'Neutrófilos em faixa normal.', 'low', 'fsa'))
    }
  }

  // ── Linfócitos ────────────────────────────────────────────
  if (h.linfocitos !== undefined) {
    const l = h.linfocitos
    if (l < 500) {
      alertasCriticos.push(`⚠️ Linfopenia GRAVE (${l}/µL) — suspeita de imunodeficiência, investigar HIV`)
      achados.push(achado('Linfócitos', l, '/µL', 'critical', '1.000–4.500/µL', 'Linfopenia grave — imunodeficiência severa. Investigar HIV, corticoterapia prolongada, radiação.', 'critical', 'fsa'))
      sugestoes.push(sug('Investigação Urgente — Linfopenia Grave', 'Sorologias: HIV, CD4/CD8. Investigar uso de corticoides, radioterapia, quimioterapia. Considerar imunodeficiência primária.', 'urgente', 'diagnostico'))
      textos.push(`Linfócitos CRÍTICOS ${l}/µL — linfopenia grave`)
    } else if (l < 1000) {
      achados.push(achado('Linfócitos', l, '/µL', 'low', '1.000–4.500/µL', 'Linfopenia — causas: corticoterapia, estresse, infecção viral aguda, HIV, LES.', 'high', 'fsa'))
      textos.push(`Linfócitos baixos (${l}/µL) — linfopenia`)
    } else if (l > 4500) {
      achados.push(achado('Linfócitos', l, '/µL', 'high', '1.000–4.500/µL', 'Linfocitose — principal causa: infecção viral (EBV, CMV, hepatite). Considerar LLC se > 5000 persistente.', 'medium', 'fsa'))
      sugestoes.push(sug('Investigação de Linfocitose', 'Sorologia EBV (mononucleose), CMV. Se > 5.000 persistente: considerar LLC (imunofenotipagem).', 'media', 'diagnostico'))
      textos.push(`Linfócitos elevados (${l}/µL) — linfocitose`)
    } else {
      achados.push(achado('Linfócitos', l, '/µL', 'ok', '1.000–4.500/µL', 'Linfócitos dentro da faixa normal.', 'low', 'fsa'))
    }
  }

  // ── Monócitos ─────────────────────────────────────────────
  if (h.monocitos !== undefined) {
    const m = h.monocitos
    if (m > 1000) {
      achados.push(achado('Monócitos', m, '/µL', 'high', '200–1.000/µL', 'Monocitose — causas: tuberculose, doenças granulomatosas, endocardite, LMC, doenças inflamatórias crônicas.', 'medium', 'fsa'))
      sugestoes.push(sug('Investigação de Monocitose', 'PPD/IGRA (tuberculose), hemoculturas (endocardite). Se persistente > 3 meses, considerar neoplasia hematológica (CMML).', 'media', 'diagnostico'))
      textos.push(`Monócitos elevados (${m}/µL) — monocitose`)
    } else if (m < 200) {
      achados.push(achado('Monócitos', m, '/µL', 'low', '200–1.000/µL', 'Monocitopenia — aplasia medular, hairy cell leukemia, corticoterapia.', 'medium', 'fsa'))
      textos.push(`Monócitos baixos (${m}/µL) — monocitopenia`)
    } else {
      achados.push(achado('Monócitos', m, '/µL', 'ok', '200–1.000/µL', 'Monócitos normais.', 'low', 'fsa'))
    }
  }

  // ── Eosinófilos ───────────────────────────────────────────
  if (h.eosinofilos !== undefined) {
    const e = h.eosinofilos
    if (e > 1500) {
      alertasCriticos.push(`⚠️ Eosinofilia GRAVE (${e}/µL) — síndrome hipereosinofílica, investigar urgentemente`)
      achados.push(achado('Eosinófilos', e, '/µL', 'critical', '50–500/µL', 'Eosinofilia grave — síndrome hipereosinofílica: risco cardíaco e neurológico.', 'critical', 'fsa'))
      sugestoes.push(sug('Síndrome Hipereosinofílica — Urgente', 'Encaminhar hematologia. Ecocardiograma. Pesquisa parasitária: Toxocara, Strongyloides. Pesquisa de PDGFRA/PDGFRB.', 'urgente', 'encaminhamento'))
      textos.push(`Eosinófilos CRÍTICOS ${e}/µL — eosinofilia grave`)
    } else if (e > 500) {
      achados.push(achado('Eosinófilos', e, '/µL', 'high', '50–500/µL', 'Eosinofilia — causas principais: parasitoses (helmintos), alergias, atopia, doenças autoimunes, medicamentos.', 'high', 'fsa'))
      sugestoes.push(sug('Investigação de Eosinofilia', 'Pesquisa parasitológica de fezes (3 amostras), IgE total, sorologias específicas (Toxocara, Strongyloides). Revisar alergias e medicamentos.', 'alta', 'diagnostico'))
      textos.push(`Eosinófilos elevados (${e}/µL) — eosinofilia`)
    } else {
      achados.push(achado('Eosinófilos', e, '/µL', 'ok', '50–500/µL', 'Eosinófilos dentro da faixa normal.', 'low', 'fsa'))
    }
  }

  // ── Basófilos ─────────────────────────────────────────────
  if (h.basofilos !== undefined) {
    const b = h.basofilos
    if (b > 200) {
      achados.push(achado('Basófilos', b, '/µL', 'high', '0–100/µL', 'Basofilia — associada a doenças mieloproliferativas (LMC), hipotireoidismo, reações alérgicas graves.', 'high', 'fsa'))
      sugestoes.push(sug('Investigação de Basofilia', 'BCR-ABL para LMC. TSH. Correlacionar com clínica. Basofilia > 1000/µL: urgência hematológica.', 'alta', 'diagnostico'))
      textos.push(`Basófilos elevados (${b}/µL) — basofilia`)
    } else {
      achados.push(achado('Basófilos', b, '/µL', 'ok', '0–100/µL', 'Basófilos dentro do esperado.', 'low', 'fsa'))
    }
  }

  // ── Bastões (desvio à esquerda) ───────────────────────────
  if (h.bastoes !== undefined) {
    const ba = h.bastoes
    if (ba > 500) {
      achados.push(achado('Bastões (Neutrófilos em Bastão)', ba, '/µL', 'high', '< 500/µL', 'Desvio à esquerda com bastões elevados — infecção bacteriana grave ou sepse em curso.', 'high', 'fsa'))
      sugestoes.push(sug('Desvio à Esquerda — Investigar Infecção', 'PCR, VHS, hemocultura, urocultura. Se febre + bastões elevados: considerar sepse (critérios SOFA).', 'alta', 'diagnostico'))
      textos.push(`Bastões elevados (${ba}/µL) — desvio à esquerda, infecção bacteriana`)
    } else if (ba > 200) {
      achados.push(achado('Bastões (Neutrófilos em Bastão)', ba, '/µL', 'borderline', '< 500/µL', 'Leve desvio à esquerda — infecção incipiente ou estresse medular.', 'medium', 'fsa'))
      textos.push(`Bastões limítrofes (${ba}/µL) — leve desvio à esquerda`)
    } else {
      achados.push(achado('Bastões', ba, '/µL', 'ok', '< 500/µL', 'Sem desvio à esquerda.', 'low', 'fsa'))
    }
  }

  return { achados, sugestoes, alertasCriticos, textos }
}

// ─────────────────────────────────────────────────────────────
// PLAQUETAS
// ─────────────────────────────────────────────────────────────
export function avaliarPlaquetas(h: HemogramaInput): {
  achados: HemogramaFinding[]
  sugestoes: HemogramaSuggestion[]
  alertasCriticos: string[]
  textos: string[]
} {
  const achados:  HemogramaFinding[]     = []
  const sugestoes: HemogramaSuggestion[] = []
  const alertasCriticos: string[]        = []
  const textos: string[]                 = []

  if (h.plaquetas === undefined) return { achados, sugestoes, alertasCriticos, textos }

  const p = h.plaquetas

  if (p < 20000) {
    alertasCriticos.push(`⚠️ Plaquetas CRÍTICAS (${p.toLocaleString('pt-BR')}/µL) — risco de hemorragia espontânea, internação urgente`)
    achados.push(achado('Plaquetas', p, '/µL', 'critical', '150.000–400.000/µL', 'Plaquetopenia grave — risco de hemorragia espontânea e AVC hemorrágico.', 'critical', 'plaquetas'))
    sugestoes.push(sug('Plaquetopenia Grave — Urgência', 'Internação. Investigar: PTI, PTT, CIVD, dengue grave, leucemia. Considerar transfusão de plaquetas.', 'urgente', 'encaminhamento'))
    textos.push(`Plaquetas CRÍTICAS ${p}/µL — risco hemorrágico grave`)
  } else if (p < 100000) {
    achados.push(achado('Plaquetas', p, '/µL', 'low', '150.000–400.000/µL', 'Plaquetopenia moderada — investigar: PTI, dengue, hiperesplenismo, medicamentos, LES.', 'high', 'plaquetas'))
    sugestoes.push(sug('Investigação de Plaquetopenia', 'Sorologia dengue (se epidemia), anticoagulante lúpico, FAN, coagulograma. Revisar medicamentos (heparina, quinino).', 'alta', 'diagnostico'))
    textos.push(`Plaquetas baixas (${p}/µL) — plaquetopenia moderada`)
  } else if (p < 150000) {
    achados.push(achado('Plaquetas', p, '/µL', 'borderline', '150.000–400.000/µL', 'Plaquetas no limite inferior — acompanhar. Pode ser variante normal ou plaquetopenia leve.', 'medium', 'plaquetas'))
    textos.push(`Plaquetas limítrofes (${p}/µL)`)
  } else if (p > 1000000) {
    alertasCriticos.push(`⚠️ Trombocitose EXTREMA (${p.toLocaleString('pt-BR')}/µL) — trombocitemia essencial ou crise mieloproliferativa`)
    achados.push(achado('Plaquetas', p, '/µL', 'critical', '150.000–400.000/µL', 'Trombocitose extrema — trombocitemia essencial ou síndrome mieloproliferativa.', 'critical', 'plaquetas'))
    sugestoes.push(sug('Trombocitose Extrema — Urgência Hematológica', 'Encaminhar hematologia. Pesquisa JAK2 V617F, calreticulina. Risco trombótico e hemorrágico paradoxal.', 'urgente', 'encaminhamento'))
    textos.push(`Plaquetas CRÍTICAS ${p}/µL — trombocitose extrema`)
  } else if (p > 400000) {
    achados.push(achado('Plaquetas', p, '/µL', 'high', '150.000–400.000/µL', 'Trombocitose — causas reativas: ferropenia, inflamação, infecção, pós-esplenectomia. Raramente primária.', 'medium', 'plaquetas'))
    sugestoes.push(sug('Investigação de Trombocitose', 'Trombocitose reativa é frequente. Investigar ferropenia, processo inflamatório. Se > 600.000 ou persistente, considerar pesquisa JAK2.', 'media', 'diagnostico'))
    textos.push(`Plaquetas elevadas (${p}/µL) — trombocitose`)
  } else {
    achados.push(achado('Plaquetas', p, '/µL', 'ok', '150.000–400.000/µL', 'Plaquetas dentro da faixa normal.', 'low', 'plaquetas'))
  }

  return { achados, sugestoes, alertasCriticos, textos }
}

// ─────────────────────────────────────────────────────────────
// PADRÕES DIAGNÓSTICOS — correlaciona múltiplos parâmetros
// ─────────────────────────────────────────────────────────────
export function detectarPadroes(h: HemogramaInput): HemogramaPattern[] {
  const padroes: HemogramaPattern[] = []

  // Anemia ferropriva: Hb baixa + VCM baixo + HCM baixo + RDW alto
  const anemiaMicro =
    (h.hemoglobina !== undefined && h.hemoglobina < (h.sexo === 'F' ? 12 : 13)) &&
    (h.vcm !== undefined && h.vcm < 80) &&
    (h.hcm !== undefined && h.hcm < 27)

  if (anemiaMicro) {
    padroes.push({
      nome: '🔴 Anemia Microcítica Hipocrômica',
      descricao: 'Hb baixa + VCM < 80 fL + HCM < 27 pg. Padrão clássico de anemia ferropriva. Diagnóstico diferencial: talassemia minor (RDW normal), anemia de doença crônica.',
      confianca: 'alta',
      marcadores: ['Hemoglobina', 'VCM', 'HCM'],
    })
  }

  // Anemia megaloblástica: Hb baixa + VCM alto + RDW alto
  const anemiaMacro =
    (h.hemoglobina !== undefined && h.hemoglobina < (h.sexo === 'F' ? 12 : 13)) &&
    (h.vcm !== undefined && h.vcm > 100) &&
    (h.rdw !== undefined && h.rdw > 14.5)

  if (anemiaMacro) {
    padroes.push({
      nome: '🔴 Anemia Macrocítica com Anisocitose',
      descricao: 'Hb baixa + VCM > 100 fL + RDW elevado. Padrão de anemia megaloblástica — investigar B12 e ácido fólico com prioridade. Outras causas: hipotireoidismo, hepatopatia.',
      confianca: 'alta',
      marcadores: ['Hemoglobina', 'VCM', 'RDW'],
    })
  }

  // Infecção bacteriana aguda: leucocitose + neutrofilia + bastões
  const infeccaoBacteriana =
    (h.leucocitos !== undefined && h.leucocitos > 11000) &&
    (h.neutrofilos !== undefined && h.neutrofilos > 7500) &&
    (h.bastoes !== undefined && h.bastoes > 500)

  if (infeccaoBacteriana) {
    padroes.push({
      nome: '🟠 Perfil de Infecção Bacteriana Aguda',
      descricao: 'Leucocitose + neutrofilia + desvio à esquerda (bastões ↑). Padrão fortemente sugestivo de infecção bacteriana ou sepse. Correlacionar com PCR, hemocultura e clínica.',
      confianca: 'alta',
      marcadores: ['Leucócitos', 'Neutrófilos', 'Bastões'],
    })
  }

  // Infecção viral: leucopenia + linfocitose relativa
  const infeccaoViral =
    (h.leucocitos !== undefined && h.leucocitos < 5000) &&
    (h.linfocitos !== undefined && h.linfocitos > 3000)

  if (infeccaoViral) {
    padroes.push({
      nome: '🟡 Perfil Sugestivo de Infecção Viral',
      descricao: 'Leucopenia relativa + linfocitose. Padrão frequente em viroses (influenza, EBV/mononucleose, CMV, dengue). Solicitar sorologias específicas se indicado.',
      confianca: 'media',
      marcadores: ['Leucócitos', 'Linfócitos'],
    })
  }

  // Mononucleose infecciosa: linfocitose intensa + eosinofilia
  const mono =
    (h.linfocitos !== undefined && h.linfocitos > 4500) &&
    (h.eosinofilos !== undefined && h.eosinofilos > 300)

  if (mono) {
    padroes.push({
      nome: '🟡 Perfil Compatível com Mononucleose',
      descricao: 'Linfocitose intensa + eosinofilia. Considerar EBV (mononucleose infecciosa) ou CMV. Solicitar monoteste, IgM anti-VCA, IgM anti-CMV.',
      confianca: 'media',
      marcadores: ['Linfócitos', 'Eosinófilos'],
    })
  }

  // Pancitopenia: todas as séries baixas — aplasia ou infiltração medular
  const pancitopenia =
    (h.hemoglobina !== undefined && h.hemoglobina < (h.sexo === 'F' ? 12 : 13)) &&
    (h.leucocitos  !== undefined && h.leucocitos  < 4000) &&
    (h.plaquetas   !== undefined && h.plaquetas   < 150000)

  if (pancitopenia) {
    padroes.push({
      nome: '🔴 Pancitopenia — Urgência Hematológica',
      descricao: 'Redução das três séries hematológicas. Causas: aplasia medular, mielodisplasia, leucemia, infiltração por neoplasias, LES, B12/folato grave. Encaminhar hematologia com urgência.',
      confianca: 'alta',
      marcadores: ['Hemoglobina', 'Leucócitos', 'Plaquetas'],
    })
  }

  // Poliglobulia vera: Hb alta + Ht alto + leucocitose + trombocitose
  const poliglobulia =
    (h.hemoglobina !== undefined && h.hemoglobina > (h.sexo === 'F' ? 16 : 17.5)) &&
    (h.leucocitos  !== undefined && h.leucocitos  > 12000) &&
    (h.plaquetas   !== undefined && h.plaquetas   > 450000)

  if (poliglobulia) {
    padroes.push({
      nome: '🔴 Perfil Sugestivo de Policitemia Vera',
      descricao: 'Poliglobulia + leucocitose + trombocitose — tríade sugestiva de policitemia vera (neoplasia mieloproliferativa). Pesquisar JAK2 V617F com urgência.',
      confianca: 'media',
      marcadores: ['Hemoglobina', 'Leucócitos', 'Plaquetas'],
    })
  }

  return padroes
}

// ============================================================
// LAB ANALYZER - ENGINE DE ANÁLISE CLÍNICA
// Regras baseadas em medicina funcional / integrativa
// Separado da rota para facilitar testes e manutenção
// ============================================================

export interface LabValues {
  // Hematologia
  ferritin?: number        // ng/mL
  hemoglobin?: number      // g/dL
  hematocrit?: number      // %
  // Vitaminas e minerais
  b12?: number             // pg/mL
  vitaminD?: number        // ng/mL
  folate?: number          // ng/mL
  zinc?: number            // µg/dL
  magnesium?: number       // mg/dL
  // Tireoide
  tsh?: number             // µUI/mL
  t4Free?: number          // ng/dL
  t3Free?: number          // pg/mL
  // Glicemia / resistência insulínica
  glucose?: number         // mg/dL
  insulin?: number         // µUI/mL
  homaIr?: number          // calculado: (glicose x insulina) / 405
  hba1c?: number           // %
  // Hormônios
  testosteroneTotal?: number   // ng/dL
  testosteroneFree?: number    // pg/mL
  dhea?: number                // µg/dL
  cortisol?: number            // µg/dL (manhã)
  lh?: number                  // mUI/mL
  fsh?: number                 // mUI/mL
  estradiol?: number           // pg/mL
  progesterone?: number        // ng/mL
  // Inflamação
  crp?: number             // mg/L (PCR ultrassensível)
  homocysteine?: number    // µmol/L
  // Perfil lipídico
  totalCholesterol?: number  // mg/dL
  ldl?: number               // mg/dL
  hdl?: number               // mg/dL
  triglycerides?: number     // mg/dL
  // Função hepática / renal
  tgo?: number   // U/L (AST)
  tgp?: number   // U/L (ALT)
  ggt?: number   // U/L
  creatinine?: number  // mg/dL
  uricAcid?: number    // mg/dL
}

export interface LabFinding {
  marker: string
  value: number
  unit: string
  status: 'critico' | 'baixo' | 'limítrofe' | 'normal' | 'elevado' | 'alto'
  finding: string
  suggestion: string
  priority: 'alta' | 'media' | 'baixa'
}

export interface LabCombination {
  markers: string[]
  finding: string
  suggestion: string
  priority: 'alta' | 'media' | 'baixa'
}

export interface LabAnalysisResult {
  findings: LabFinding[]
  combinations: LabCombination[]
  summary: string
  risk_level: 'alto' | 'moderado' | 'baixo' | 'sem_alteracoes'
  total_alerts: number
}

// ============================================================
// FUNÇÃO PRINCIPAL DE ANÁLISE
// ============================================================
export function analyzeLabValues(labs: LabValues): LabAnalysisResult {
  const findings: LabFinding[] = []
  const combinations: LabCombination[] = []

  // -------------------------------------------------------
  // 1. FERRO E HEMATOLOGIA
  // -------------------------------------------------------
  if (labs.ferritin !== undefined) {
    if (labs.ferritin < 30) {
      findings.push({
        marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL',
        status: 'critico',
        finding: 'Deficiência grave de ferritina — estoques de ferro criticamente baixos',
        suggestion: 'Suplementação de ferro parenteral ou oral em dose terapêutica. Investigar causa da depleção (sangramento, má absorção, dieta).',
        priority: 'alta'
      })
    } else if (labs.ferritin < 70) {
      findings.push({
        marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL',
        status: 'baixo',
        finding: 'Deficiência funcional de ferro — ferritina abaixo do ideal funcional (70 ng/mL)',
        suggestion: 'Suplementar ferro com vitamina C para melhorar absorção. Evitar cálcio e cafeína próximo à suplementação.',
        priority: 'alta'
      })
    } else if (labs.ferritin >= 70 && labs.ferritin <= 150) {
      findings.push({
        marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL',
        status: 'normal',
        finding: 'Ferritina dentro da faixa funcional ideal',
        suggestion: 'Manter monitoramento semestral.',
        priority: 'baixa'
      })
    } else if (labs.ferritin > 300) {
      findings.push({
        marker: 'Ferritina', value: labs.ferritin, unit: 'ng/mL',
        status: 'alto',
        finding: 'Ferritina elevada — possível inflamação crônica, sobrecarga de ferro ou hemocromatose',
        suggestion: 'Investigar PCR, processo inflamatório ou hemocromatose hereditária. Evitar suplementação de ferro.',
        priority: 'alta'
      })
    }
  }

  if (labs.hemoglobin !== undefined) {
    const lowF = 12.0, lowM = 13.5
    // Usando limiar feminino como padrão (mais conservador)
    if (labs.hemoglobin < lowF) {
      findings.push({
        marker: 'Hemoglobina', value: labs.hemoglobin, unit: 'g/dL',
        status: 'baixo',
        finding: 'Anemia — hemoglobina abaixo do limite inferior',
        suggestion: 'Investigar tipo de anemia (ferropriva, megaloblástica, inflamatória). Avaliar ferritina, B12 e folato.',
        priority: 'alta'
      })
    }
  }

  // -------------------------------------------------------
  // 2. VITAMINAS E MINERAIS
  // -------------------------------------------------------
  if (labs.b12 !== undefined) {
    if (labs.b12 < 300) {
      findings.push({
        marker: 'Vitamina B12', value: labs.b12, unit: 'pg/mL',
        status: 'critico',
        finding: 'Deficiência grave de B12 — risco neurológico e hematológico',
        suggestion: 'Suplementar B12 na forma de metilcobalamina (sublingual ou IM). Investigar gastrite atrófica ou uso de metformina.',
        priority: 'alta'
      })
    } else if (labs.b12 < 500) {
      findings.push({
        marker: 'Vitamina B12', value: labs.b12, unit: 'pg/mL',
        status: 'baixo',
        finding: 'B12 subótima — risco de sintomas neurológicos mesmo com valor "normal" no laudo',
        suggestion: 'Suplementar B12 (metilcobalamina 1000 mcg/dia sublingual). Reavaliar em 90 dias.',
        priority: 'media'
      })
    } else if (labs.b12 > 1000) {
      findings.push({
        marker: 'Vitamina B12', value: labs.b12, unit: 'pg/mL',
        status: 'elevado',
        finding: 'B12 elevada — pode indicar uso de suplementos, doença hepática ou mieloproliferativa',
        suggestion: 'Avaliar se há suplementação em uso. Se não houver, investigar função hepática e hemograma.',
        priority: 'media'
      })
    }
  }

  if (labs.vitaminD !== undefined) {
    if (labs.vitaminD < 20) {
      findings.push({
        marker: 'Vitamina D', value: labs.vitaminD, unit: 'ng/mL',
        status: 'critico',
        finding: 'Deficiência grave de vitamina D — impacto imunológico, ósseo e metabólico',
        suggestion: 'Repor com doses de ataque (50.000 UI/semana por 8 semanas), depois manutenção 5.000–10.000 UI/dia + vitamina K2.',
        priority: 'alta'
      })
    } else if (labs.vitaminD < 40) {
      findings.push({
        marker: 'Vitamina D', value: labs.vitaminD, unit: 'ng/mL',
        status: 'baixo',
        finding: 'Deficiência de vitamina D — abaixo do nível funcional ideal (40–80 ng/mL)',
        suggestion: 'Suplementar vitamina D3 5.000 UI/dia com vitamina K2 (MK-7). Reavaliar em 90 dias.',
        priority: 'media'
      })
    } else if (labs.vitaminD > 100) {
      findings.push({
        marker: 'Vitamina D', value: labs.vitaminD, unit: 'ng/mL',
        status: 'alto',
        finding: 'Vitamina D muito elevada — risco de toxicidade (hipercalcemia)',
        suggestion: 'Suspender suplementação. Avaliar cálcio sérico e função renal.',
        priority: 'alta'
      })
    }
  }

  if (labs.folate !== undefined) {
    if (labs.folate < 4) {
      findings.push({
        marker: 'Folato', value: labs.folate, unit: 'ng/mL',
        status: 'baixo',
        finding: 'Deficiência de folato — risco de anemia megaloblástica e hiperhomocisteinemia',
        suggestion: 'Suplementar ácido folínico ou metilfolato (L-5-MTHF) 400–800 mcg/dia. Investigar polimorfismo MTHFR.',
        priority: 'media'
      })
    }
  }

  if (labs.magnesium !== undefined) {
    if (labs.magnesium < 2.0) {
      findings.push({
        marker: 'Magnésio', value: labs.magnesium, unit: 'mg/dL',
        status: 'baixo',
        finding: 'Magnésio sérico baixo — atenção: magnésio sérico é pouco sensível (apenas 1% é extracelular)',
        suggestion: 'Suplementar magnésio bisglicinato ou treonato 300–400 mg/dia. Reduzir açúcar, cafeína e estresse.',
        priority: 'media'
      })
    }
  }

  if (labs.zinc !== undefined) {
    if (labs.zinc < 70) {
      findings.push({
        marker: 'Zinco', value: labs.zinc, unit: 'µg/dL',
        status: 'baixo',
        finding: 'Deficiência de zinco — impacto imunológico, hormonal e cutâneo',
        suggestion: 'Suplementar zinco quelado (bisglicinato ou orotato) 25–40 mg/dia. Separar de ferro e cálcio.',
        priority: 'media'
      })
    }
  }

  // -------------------------------------------------------
  // 3. TIREOIDE
  // -------------------------------------------------------
  if (labs.tsh !== undefined) {
    if (labs.tsh > 4.5) {
      findings.push({
        marker: 'TSH', value: labs.tsh, unit: 'µUI/mL',
        status: 'alto',
        finding: 'Hipotireoidismo — TSH acima do limite superior do laboratório',
        suggestion: 'Encaminhar para endocrinologista. Solicitar T4 livre, T3 livre, Anti-TPO e Anti-Tg.',
        priority: 'alta'
      })
    } else if (labs.tsh > 2.5) {
      findings.push({
        marker: 'TSH', value: labs.tsh, unit: 'µUI/mL',
        status: 'limítrofe',
        finding: 'Hipotireoidismo funcional — TSH acima do ideal funcional (0.5–2.5 µUI/mL)',
        suggestion: 'Investigar sintomas (fadiga, ganho de peso, queda de cabelo). Solicitar T4 e T3 livres e anticorpos tireoidianos.',
        priority: 'media'
      })
    } else if (labs.tsh < 0.4) {
      findings.push({
        marker: 'TSH', value: labs.tsh, unit: 'µUI/mL',
        status: 'baixo',
        finding: 'Hipertireoidismo ou supressão de TSH',
        suggestion: 'Investigar hipertireoidismo. Solicitar T4 livre, T3 livre e cintilografia tireoidiana se necessário.',
        priority: 'alta'
      })
    }
  }

  if (labs.t4Free !== undefined) {
    if (labs.t4Free < 1.0) {
      findings.push({
        marker: 'T4 Livre', value: labs.t4Free, unit: 'ng/dL',
        status: 'baixo',
        finding: 'T4 livre baixo — pode confirmar hipotireoidismo primário',
        suggestion: 'Correlacionar com TSH e T3 livre. Investigar causas: autoimune, nutricional (iodo, selênio), estresse.',
        priority: 'alta'
      })
    }
  }

  if (labs.t3Free !== undefined) {
    if (labs.t3Free < 2.3) {
      findings.push({
        marker: 'T3 Livre', value: labs.t3Free, unit: 'pg/mL',
        status: 'baixo',
        finding: 'T3 livre baixo — possível síndrome do T3 baixo ou conversão periférica prejudicada',
        suggestion: 'Investigar deficiências de selênio, zinco e ferro (cofatores da conversão T4→T3). Avaliar carga de estresse e cortisol.',
        priority: 'media'
      })
    }
  }

  // -------------------------------------------------------
  // 4. GLICEMIA E RESISTÊNCIA INSULÍNICA
  // -------------------------------------------------------
  if (labs.glucose !== undefined) {
    if (labs.glucose >= 126) {
      findings.push({
        marker: 'Glicose jejum', value: labs.glucose, unit: 'mg/dL',
        status: 'critico',
        finding: 'Glicose compatível com diagnóstico de Diabetes Mellitus tipo 2',
        suggestion: 'Encaminhar para endocrinologista imediatamente. Confirmar com segundo exame. Iniciar mudanças urgentes no estilo de vida.',
        priority: 'alta'
      })
    } else if (labs.glucose >= 100) {
      findings.push({
        marker: 'Glicose jejum', value: labs.glucose, unit: 'mg/dL',
        status: 'elevado',
        finding: 'Pré-diabetes — glicemia de jejum alterada (100–125 mg/dL)',
        suggestion: 'Reduzir carboidratos refinados, aumentar proteínas e fibras. Exercício físico regular. Considerar berberina 500 mg 2x/dia.',
        priority: 'alta'
      })
    } else if (labs.glucose > 90) {
      findings.push({
        marker: 'Glicose jejum', value: labs.glucose, unit: 'mg/dL',
        status: 'limítrofe',
        finding: 'Glicose limítrofe — acima do ideal funcional (70–90 mg/dL)',
        suggestion: 'Atenção à qualidade dos carboidratos. Monitorar glicemia e solicitar insulina em jejum.',
        priority: 'media'
      })
    }
  }

  if (labs.insulin !== undefined) {
    if (labs.insulin > 15) {
      findings.push({
        marker: 'Insulina jejum', value: labs.insulin, unit: 'µUI/mL',
        status: 'alto',
        finding: 'Hiperinsulinemia grave — forte indicador de resistência insulínica estabelecida',
        suggestion: 'Dieta low-carb/cetogênica. Jejum intermitente. Exercício resistido. Considerar metformina ou berberina. Investigar SOP se mulher.',
        priority: 'alta'
      })
    } else if (labs.insulin > 7) {
      findings.push({
        marker: 'Insulina jejum', value: labs.insulin, unit: 'µUI/mL',
        status: 'elevado',
        finding: 'Resistência insulínica — insulina acima do ideal funcional (< 7 µUI/mL)',
        suggestion: 'Reduzir carga glicêmica da dieta, aumentar atividade física, suplementar myo-inositol, magnésio e berberina.',
        priority: 'alta'
      })
    }
  }

  if (labs.homaIr !== undefined) {
    if (labs.homaIr > 2.7) {
      findings.push({
        marker: 'HOMA-IR', value: labs.homaIr, unit: '',
        status: 'elevado',
        finding: 'HOMA-IR elevado — resistência insulínica confirmada por índice calculado',
        suggestion: 'Protocolo completo anti-resistência insulínica: dieta, exercício, sono, suplementação (myo-inositol, berberina, magnésio, cromo).',
        priority: 'alta'
      })
    }
  }

  if (labs.hba1c !== undefined) {
    if (labs.hba1c >= 6.5) {
      findings.push({
        marker: 'HbA1c', value: labs.hba1c, unit: '%',
        status: 'critico',
        finding: 'HbA1c compatível com Diabetes Mellitus',
        suggestion: 'Encaminhar para endocrinologista. Monitoramento glicêmico contínuo. Intervenção imediata no estilo de vida.',
        priority: 'alta'
      })
    } else if (labs.hba1c >= 5.7) {
      findings.push({
        marker: 'HbA1c', value: labs.hba1c, unit: '%',
        status: 'elevado',
        finding: 'HbA1c na faixa de pré-diabetes (5.7–6.4%)',
        suggestion: 'Intervenção intensiva no estilo de vida. Reavaliar em 3 meses.',
        priority: 'alta'
      })
    }
  }

  // -------------------------------------------------------
  // 5. HORMÔNIOS
  // -------------------------------------------------------
  if (labs.testosteroneTotal !== undefined) {
    // Referência masculina (padrão conservador)
    if (labs.testosteroneTotal < 400) {
      findings.push({
        marker: 'Testosterona Total', value: labs.testosteroneTotal, unit: 'ng/dL',
        status: 'baixo',
        finding: 'Testosterona total abaixo do ideal funcional em homens (400–800 ng/dL)',
        suggestion: 'Investigar causas: excesso de estresse, obesidade, deficiência de zinco/vitamina D/magnésio, disfunção hipofisária. Solicitar LH, FSH, prolactina.',
        priority: 'alta'
      })
    }
  }

  if (labs.cortisol !== undefined) {
    if (labs.cortisol > 20) {
      findings.push({
        marker: 'Cortisol matinal', value: labs.cortisol, unit: 'µg/dL',
        status: 'elevado',
        finding: 'Cortisol matinal elevado — possível estresse crônico ou hipercortisolismo',
        suggestion: 'Investigar causas de hipercortisolismo. Técnicas de manejo de estresse, adapotógenos (ashwagandha, rhodiola). Excluir Síndrome de Cushing se persistente.',
        priority: 'media'
      })
    } else if (labs.cortisol < 8) {
      findings.push({
        marker: 'Cortisol matinal', value: labs.cortisol, unit: 'µg/dL',
        status: 'baixo',
        finding: 'Cortisol matinal baixo — possível insuficiência adrenal',
        suggestion: 'Investigar insuficiência adrenal. Solicitar teste de estimulação com ACTH. Encaminhar para endocrinologista.',
        priority: 'alta'
      })
    }
  }

  if (labs.dhea !== undefined) {
    if (labs.dhea < 100) {
      findings.push({
        marker: 'DHEA-S', value: labs.dhea, unit: 'µg/dL',
        status: 'baixo',
        finding: 'DHEA baixo — possível depleção adrenal e envelhecimento hormonal acelerado',
        suggestion: 'Investigar estresse crônico e fadiga adrenal. Suporte adrenal com adaptógenos. Considerar suplementação de DHEA com acompanhamento médico.',
        priority: 'media'
      })
    }
  }

  if (labs.lh !== undefined && labs.fsh !== undefined) {
    const ratio = labs.lh / labs.fsh
    if (ratio > 2) {
      findings.push({
        marker: 'Relação LH/FSH', value: parseFloat(ratio.toFixed(2)), unit: '',
        status: 'elevado',
        finding: `Relação LH/FSH elevada (${ratio.toFixed(2)}:1) — sugestiva de Síndrome dos Ovários Policísticos (SOP)`,
        suggestion: 'Correlacionar com sintomas clínicos de SOP (irregularidade menstrual, hiperandrogenismo). Solicitar testosterona, DHEA, 17-OH progesterona e ultrassom pélvico.',
        priority: 'alta'
      })
    }
  }

  // -------------------------------------------------------
  // 6. INFLAMAÇÃO
  // -------------------------------------------------------
  if (labs.crp !== undefined) {
    if (labs.crp > 3) {
      findings.push({
        marker: 'PCR ultrassensível', value: labs.crp, unit: 'mg/L',
        status: 'alto',
        finding: 'Inflamação sistêmica de alto grau — PCR acima de 3 mg/L',
        suggestion: 'Investigar fonte inflamatória (intestinal, periodontal, alimentar). Dieta anti-inflamatória, ômega-3 em doses terapêuticas (3–4 g/dia EPA+DHA).',
        priority: 'alta'
      })
    } else if (labs.crp > 1) {
      findings.push({
        marker: 'PCR ultrassensível', value: labs.crp, unit: 'mg/L',
        status: 'elevado',
        finding: 'Inflamação crônica de baixo grau — PCR entre 1–3 mg/L',
        suggestion: 'Protocolo anti-inflamatório: dieta, ômega-3 (2 g/dia), curcumina, redução de açúcar e ultraprocessados.',
        priority: 'media'
      })
    }
  }

  if (labs.homocysteine !== undefined) {
    if (labs.homocysteine > 15) {
      findings.push({
        marker: 'Homocisteína', value: labs.homocysteine, unit: 'µmol/L',
        status: 'alto',
        finding: 'Hiperhomocisteinemia grave — risco cardiovascular e neurodegenerativo elevado',
        suggestion: 'Suplementar metilfolato (L-5-MTHF), metilcobalamina (B12) e piridoxal-5-fosfato (B6). Investigar polimorfismo MTHFR.',
        priority: 'alta'
      })
    } else if (labs.homocysteine > 10) {
      findings.push({
        marker: 'Homocisteína', value: labs.homocysteine, unit: 'µmol/L',
        status: 'elevado',
        finding: 'Homocisteína elevada — risco cardiovascular aumentado',
        suggestion: 'Suplementar B12, folato e B6. Aumentar consumo de vegetais folhosos. Reavaliar em 60 dias.',
        priority: 'media'
      })
    }
  }

  // -------------------------------------------------------
  // 7. PERFIL LIPÍDICO
  // -------------------------------------------------------
  if (labs.triglycerides !== undefined) {
    if (labs.triglycerides > 200) {
      findings.push({
        marker: 'Triglicerídeos', value: labs.triglycerides, unit: 'mg/dL',
        status: 'alto',
        finding: 'Hipertrigliceridemia — risco cardiovascular e metabólico elevado',
        suggestion: 'Eliminar açúcar, frutose e carboidratos refinados. Ômega-3 em doses terapêuticas (4 g/dia). Avaliar insulina e glicose.',
        priority: 'alta'
      })
    } else if (labs.triglycerides > 150) {
      findings.push({
        marker: 'Triglicerídeos', value: labs.triglycerides, unit: 'mg/dL',
        status: 'elevado',
        finding: 'Triglicerídeos acima do ideal — indica resistência insulínica ou excesso de carboidratos',
        suggestion: 'Reduzir carboidratos refinados e álcool. Ômega-3 2 g/dia.',
        priority: 'media'
      })
    }
  }

  if (labs.hdl !== undefined) {
    if (labs.hdl < 40) {
      findings.push({
        marker: 'HDL', value: labs.hdl, unit: 'mg/dL',
        status: 'baixo',
        finding: 'HDL criticamente baixo — fator de risco cardiovascular independente',
        suggestion: 'Exercício aeróbico regular, ômega-3, reduzir carboidratos refinados. Investigar resistência insulínica.',
        priority: 'alta'
      })
    }
  }

  if (labs.ldl !== undefined) {
    if (labs.ldl > 190) {
      findings.push({
        marker: 'LDL', value: labs.ldl, unit: 'mg/dL',
        status: 'alto',
        finding: 'LDL muito elevado — investigar hipercolesterolemia familiar',
        suggestion: 'Encaminhar para cardiologista. Avaliar risco cardiovascular global. Dieta e avaliação de estatinas.',
        priority: 'alta'
      })
    } else if (labs.ldl > 130) {
      findings.push({
        marker: 'LDL', value: labs.ldl, unit: 'mg/dL',
        status: 'elevado',
        finding: 'LDL elevado — aumenta risco cardiovascular',
        suggestion: 'Reduzir gorduras trans e saturadas em excesso. Aumentar fibras solúveis. Avaliar risco cardiovascular global antes de medicar.',
        priority: 'media'
      })
    }
  }

  // -------------------------------------------------------
  // 8. COMBINAÇÕES CLÍNICAS (Padrões Complexos)
  // -------------------------------------------------------

  // SOP Pattern
  if (
    labs.insulin !== undefined && labs.insulin > 7 &&
    labs.lh !== undefined && labs.fsh !== undefined && (labs.lh / labs.fsh) > 2
  ) {
    combinations.push({
      markers: ['Insulina', 'LH/FSH'],
      finding: '🔴 Padrão fortemente sugestivo de SOP com resistência insulínica',
      suggestion: 'Protocolo SOP: myo-inositol (4 g/dia), dieta low-carb, exercício HIIT, vitamina D, ômega-3 e magnésio. Considerar consulta com ginecologista endocrinologista.',
      priority: 'alta'
    })
  }

  // Má absorção intestinal
  if (
    labs.ferritin !== undefined && labs.ferritin < 70 &&
    labs.b12 !== undefined && labs.b12 < 500 &&
    labs.vitaminD !== undefined && labs.vitaminD < 40
  ) {
    combinations.push({
      markers: ['Ferritina', 'B12', 'Vitamina D'],
      finding: '🔴 Múltiplas deficiências simultâneas — forte suspeita de síndrome de má absorção intestinal',
      suggestion: 'Investigar disbiose, SIBO, doença celíaca ou DII. Solicitar calprotectina fecal, anticorpo anti-gliadina, anti-transglutaminase. Protocolo de restauração intestinal.',
      priority: 'alta'
    })
  }

  // Síndrome metabólica completa
  if (
    labs.triglycerides !== undefined && labs.triglycerides > 150 &&
    labs.hdl !== undefined && labs.hdl < 40 &&
    labs.glucose !== undefined && labs.glucose > 100 &&
    labs.insulin !== undefined && labs.insulin > 7
  ) {
    combinations.push({
      markers: ['Triglicerídeos', 'HDL', 'Glicose', 'Insulina'],
      finding: '🔴 Síndrome metabólica confirmada — 4 critérios presentes',
      suggestion: 'Intervenção intensiva e urgente: dieta low-carb, exercício resistido diário, sono 7–8h, berberina, ômega-3 em dose terapêutica. Avaliar risco cardiovascular com escore de Framingham.',
      priority: 'alta'
    })
  }

  // Hipotireoidismo + deficiência de selênio/zinco (inferida)
  if (
    labs.tsh !== undefined && labs.tsh > 2.5 &&
    labs.t3Free !== undefined && labs.t3Free < 2.3
  ) {
    combinations.push({
      markers: ['TSH', 'T3 Livre'],
      finding: '🟡 Hipotireoidismo funcional com conversão T4→T3 prejudicada',
      suggestion: 'Investigar deficiência de selênio (cofator da deiodinase) e zinco. Suplementar selênio 200 mcg/dia + zinco 30 mg/dia. Avaliar possibilidade de T3 combinado com endocrinologista.',
      priority: 'media'
    })
  }

  // Tríade da fadiga crônica
  if (
    labs.ferritin !== undefined && labs.ferritin < 70 &&
    labs.vitaminD !== undefined && labs.vitaminD < 40 &&
    labs.cortisol !== undefined && labs.cortisol < 10
  ) {
    combinations.push({
      markers: ['Ferritina', 'Vitamina D', 'Cortisol'],
      finding: '🟡 Tríade de fadiga crônica — deficiências múltiplas + cortisol baixo',
      suggestion: 'Protocolo de restauração energética: ferro, vitamina D, suporte adrenal (ashwagandha, panax ginseng), sono restaurador e manejo de estresse.',
      priority: 'media'
    })
  }

  // Risco cardiovascular elevado
  if (
    labs.homocysteine !== undefined && labs.homocysteine > 10 &&
    labs.crp !== undefined && labs.crp > 1 &&
    labs.ldl !== undefined && labs.ldl > 130
  ) {
    combinations.push({
      markers: ['Homocisteína', 'PCR', 'LDL'],
      finding: '🔴 Múltiplos marcadores de risco cardiovascular elevados',
      suggestion: 'Avaliação cardiológica urgente. Calcular escore de risco cardiovascular global. Intervenção nutricional intensiva e avaliação de estatina.',
      priority: 'alta'
    })
  }

  // -------------------------------------------------------
  // CALCULAR NÍVEL DE RISCO E RESUMO
  // -------------------------------------------------------
  const highPriority = [
    ...findings.filter(f => f.priority === 'alta'),
    ...combinations.filter(c => c.priority === 'alta')
  ].length

  const mediumPriority = [
    ...findings.filter(f => f.priority === 'media'),
    ...combinations.filter(c => c.priority === 'media')
  ].length

  let risk_level: LabAnalysisResult['risk_level']
  if (findings.length === 0 && combinations.length === 0) {
    risk_level = 'sem_alteracoes'
  } else if (highPriority >= 3) {
    risk_level = 'alto'
  } else if (highPriority >= 1 || mediumPriority >= 2) {
    risk_level = 'moderado'
  } else {
    risk_level = 'baixo'
  }

  const summaryMap: Record<typeof risk_level, string> = {
    sem_alteracoes: '✅ Exames dentro dos parâmetros. Manter monitoramento periódico.',
    baixo: `⚠️ ${findings.length} marcador(es) com atenção, sem urgência clínica imediata.`,
    moderado: `🟡 ${findings.length} alteração(ões) encontrada(s) — intervenção recomendada.`,
    alto: `🔴 Alterações significativas em ${highPriority} marcador(es) crítico(s) — ação prioritária necessária.`,
  }

  return {
    findings,
    combinations,
    summary: summaryMap[risk_level],
    risk_level,
    total_alerts: findings.length + combinations.length,
  }
}

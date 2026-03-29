// ============================================================
// CLINICAL INTELLIGENCE — Scoring
// Calcula o score de saúde (0–100) com base nos marcadores
// Lógica isolada, testável independentemente
// ============================================================

import type { LabInput } from './types'

interface MarkerPenalty {
  key:       keyof LabInput
  condition: (v: number) => boolean
  penalty:   number
  label:     string
}

// Tabela de penalidades por marcador
const PENALTIES: MarkerPenalty[] = [
  { key: 'ferritin',  condition: v => v < 20,   penalty: 20, label: 'Ferritina criticamente baixa'    },
  { key: 'ferritin',  condition: v => v < 70,   penalty: 10, label: 'Ferritina abaixo do ideal'       },
  { key: 'ferritin',  condition: v => v > 200,  penalty:  5, label: 'Ferritina elevada'               },
  { key: 'b12',       condition: v => v < 300,  penalty: 20, label: 'B12 deficiente'                  },
  { key: 'b12',       condition: v => v < 500,  penalty: 10, label: 'B12 abaixo do ideal'             },
  { key: 'tsh',       condition: v => v < 0.4,  penalty: 20, label: 'TSH suprimido'                   },
  { key: 'tsh',       condition: v => v > 4.0,  penalty: 20, label: 'TSH hipotireoidismo'             },
  { key: 'tsh',       condition: v => v > 2.0,  penalty: 10, label: 'TSH funcional elevado'           },
  { key: 'vitaminD',  condition: v => v < 20,   penalty: 20, label: 'Vitamina D criticamente baixa'  },
  { key: 'vitaminD',  condition: v => v < 40,   penalty: 10, label: 'Vitamina D deficiente'          },
  { key: 'vitaminD',  condition: v => v > 100,  penalty:  5, label: 'Vitamina D elevada'             },
  { key: 'insulin',   condition: v => v > 15,   penalty: 20, label: 'Resistência à insulina'          },
  { key: 'insulin',   condition: v => v > 7,    penalty: 10, label: 'Insulina borderline'             },
  { key: 'glucose',   condition: v => v >= 126, penalty: 25, label: 'Diabetes'                        },
  { key: 'glucose',   condition: v => v >= 100, penalty: 15, label: 'Pré-diabetes'                    },
  { key: 'glucose',   condition: v => v >= 90,  penalty:  5, label: 'Glicose acima do ideal'          },
]

export function calculateHealthScore(labs: LabInput): number {
  let score    = 100
  const applied = new Set<string>()  // evitar dupla penalidade no mesmo marcador

  for (const p of PENALTIES) {
    const value = labs[p.key]
    if (value === undefined) continue

    // Só aplica a penalidade mais severa por marcador (a primeira que bater)
    if (applied.has(p.key)) continue

    if (p.condition(value)) {
      score -= p.penalty
      applied.add(p.key)
    }
  }

  return Math.max(0, Math.min(100, score))
}

// Retorna label textual do score
export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excelente'
  if (score >= 75) return 'Bom'
  if (score >= 50) return 'Atenção'
  if (score >= 25) return 'Preocupante'
  return 'Crítico'
}

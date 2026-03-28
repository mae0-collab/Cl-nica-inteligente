// ============================================================
// ROUTES - AI ASSISTANT
// Estrutura pronta para OpenAI real - mock enquanto não há chave
// ============================================================

import { Hono } from 'hono';
import { authMiddleware, getAuthProfessionalId } from '../auth/middleware';
import { AIChatSchema, validateBody } from '../validators/schemas';
import type { AppEnv } from '../lib/types';

const aiRoutes = new Hono<AppEnv>();

aiRoutes.use('*', authMiddleware);

// -------------------------------------------------------
// POST /api/ai/chat
// -------------------------------------------------------
aiRoutes.post('/chat', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB, OPENAI_API_KEY } = c.env;

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Corpo inválido' }, 400);

  const validation = validateBody(AIChatSchema, body);
  if (!validation.success) {
    return c.json({ error: 'Dados inválidos', details: validation.errors }, 422);
  }

  const { prompt, context_type, patient_id } = validation.data;

  // Se patient_id fornecido, verificar ownership
  if (patient_id) {
    const patient = await DB.prepare(
      'SELECT id FROM patients WHERE id = ? AND professional_id = ?'
    ).bind(patient_id, professionalId).first();

    if (!patient) {
      return c.json({ error: 'Paciente não encontrado ou não pertence a este profissional' }, 404);
    }
  }

  const startTime = Date.now();
  let aiResponse: string;
  let tokensUsed: number | null = null;

  // -------------------------------------------------------
  // INTEGRAÇÃO OPENAI (ativada quando OPENAI_API_KEY estiver configurada)
  // -------------------------------------------------------
  if (OPENAI_API_KEY) {
    try {
      const systemPrompt = buildSystemPrompt(context_type);

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
      });

      if (!openaiRes.ok) {
        const errBody = await openaiRes.text();
        console.error('OpenAI error:', errBody);
        throw new Error(`OpenAI API error: ${openaiRes.status}`);
      }

      const openaiData = await openaiRes.json() as any;
      aiResponse = openaiData.choices?.[0]?.message?.content ?? 'Sem resposta da IA.';
      tokensUsed = openaiData.usage?.total_tokens ?? null;
    } catch (err) {
      console.error('Falha na chamada OpenAI:', err);
      // Fallback para mock em caso de erro
      aiResponse = buildMockResponse(prompt, context_type);
    }
  } else {
    // -------------------------------------------------------
    // MOCK - Resposta simulada (sem chave OpenAI)
    // -------------------------------------------------------
    aiResponse = buildMockResponse(prompt, context_type);
  }

  const responseTimeMs = Date.now() - startTime;

  // Salvar interação
  const result = await DB.prepare(`
    INSERT INTO ai_interactions (
      professional_id, context_type, patient_id,
      user_prompt, ai_response, tokens_used, response_time_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    professionalId, context_type, patient_id ?? null,
    prompt, aiResponse, tokensUsed, responseTimeMs
  ).run();

  return c.json({
    response: aiResponse,
    interaction_id: result.meta.last_row_id,
    is_mock: !OPENAI_API_KEY,
    response_time_ms: responseTimeMs,
  });
});

// -------------------------------------------------------
// GET /api/ai/history
// -------------------------------------------------------
aiRoutes.get('/history', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const { DB } = c.env;

  const history = await DB.prepare(`
    SELECT id, context_type, user_prompt, ai_response,
           tokens_used, response_time_ms, was_helpful, created_at
    FROM ai_interactions
    WHERE professional_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).bind(professionalId).all();

  return c.json(history.results);
});

// -------------------------------------------------------
// PATCH /api/ai/history/:id/feedback
// -------------------------------------------------------
aiRoutes.patch('/history/:id/feedback', async (c) => {
  const professionalId = getAuthProfessionalId(c);
  const interactionId = c.req.param('id');
  const { DB } = c.env;

  const body = await c.req.json().catch(() => ({}));
  const wasHelpful = typeof body.was_helpful === 'boolean' ? (body.was_helpful ? 1 : 0) : null;
  const feedbackText = typeof body.feedback_text === 'string' ? body.feedback_text.slice(0, 500) : null;

  // Verificar ownership
  const interaction = await DB.prepare(
    'SELECT id FROM ai_interactions WHERE id = ? AND professional_id = ?'
  ).bind(interactionId, professionalId).first();

  if (!interaction) {
    return c.json({ error: 'Interação não encontrada' }, 404);
  }

  await DB.prepare(
    'UPDATE ai_interactions SET was_helpful = ?, feedback_text = ? WHERE id = ?'
  ).bind(wasHelpful, feedbackText, interactionId).run();

  return c.json({ success: true });
});

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function buildSystemPrompt(contextType: string): string {
  const basePrompt = `Você é um assistente especializado em saúde integrativa para profissionais de saúde.
Responda de forma técnica, baseada em evidências, em português brasileiro.
IMPORTANTE: Sempre recomende que o profissional avalie individualmente cada paciente.
Nunca faça diagnósticos definitivos. Forneça orientações e sugestões para o raciocínio clínico.`;

  const contextPrompts: Record<string, string> = {
    general_question: `${basePrompt}\nResponda perguntas gerais sobre saúde integrativa.`,
    case_analysis: `${basePrompt}\nAnalise casos clínicos de forma estruturada: anamnese, exames, hipóteses diagnósticas e conduta sugerida.`,
    protocol_suggestion: `${basePrompt}\nSugira protocolos clínicos baseados em evidências para as condições apresentadas.`,
    lab_interpretation: `${basePrompt}\nAjude na interpretação de exames laboratoriais considerando o contexto funcional e integrativo.`,
    supplement_recommendation: `${basePrompt}\nSugira suplementação individualizada com base em evidências científicas, dosagens e interações.`,
  };

  return contextPrompts[contextType] ?? basePrompt;
}

function buildMockResponse(prompt: string, contextType: string): string {
  const preview = prompt.substring(0, 60);

  const responses: Record<string, string> = {
    general_question: `Com base na sua pergunta sobre "${preview}...", posso oferecer as seguintes considerações clínicas:\n\n1. **Avaliação inicial**: Considere uma anamnese completa incluindo histórico familiar, hábitos de vida e uso de medicamentos.\n\n2. **Abordagem integrativa**: Avalie possíveis causas funcionais antes de tratar apenas sintomas.\n\n3. **Exames sugeridos**: Dependendo do contexto, considere painel hormonal, marcadores inflamatórios e micronutrientes.\n\n⚠️ *Este é um assistente em modo de demonstração. Conecte uma chave OpenAI para respostas personalizadas.*`,
    
    case_analysis: `Análise do caso: "${preview}..."\n\n**Hipóteses Diagnósticas:**\n- Avaliar síndrome metabólica se houver alterações glicêmicas\n- Investigar disfunção tireoidiana\n- Considerar deficiências nutricionais como vitamina D, B12, ferro\n\n**Conduta Sugerida:**\n1. Solicitar exames laboratoriais completos\n2. Avaliação nutricional detalhada\n3. Revisão de hábitos de sono e atividade física\n\n⚠️ *Modo demonstração - configure OPENAI_API_KEY para análise real.*`,
    
    lab_interpretation: `Interpretação laboratorial para: "${preview}..."\n\n**Pontos de atenção:**\n- Avalie os valores dentro do contexto clínico do paciente\n- Valores na faixa de referência nem sempre indicam função ótima\n- Considere correlações entre diferentes marcadores\n\n⚠️ *Modo demonstração - configure OPENAI_API_KEY para análise real.*`,
    
    protocol_suggestion: `Protocolo para: "${preview}..."\n\n**Sugestão básica:**\n1. Avaliação clínica completa\n2. Ajustes nutricionais baseados em evidências\n3. Suplementação individualizada conforme exames\n4. Atividade física adequada ao perfil\n5. Manejo do estresse e qualidade do sono\n\n⚠️ *Modo demonstração - configure OPENAI_API_KEY para protocolos detalhados.*`,
    
    supplement_recommendation: `Suplementação para: "${preview}..."\n\n**Base para prescrição individualizada:**\n- Avalie deficiências identificadas em exames\n- Considere interações medicamentosas\n- Dose baseada no peso e condição clínica\n- Reavaliar após 60-90 dias\n\n⚠️ *Modo demonstração - configure OPENAI_API_KEY para recomendações específicas.*`,
  };

  return responses[contextType] ?? responses['general_question'];
}

export default aiRoutes;

-- ============================================================
-- SEED SEGURO - CLÍNICA INTELIGENTE v2.0
-- Dados de teste com senhas em hash real (PBKDF2)
-- Para desenvolvimento local
-- ============================================================
-- ATENÇÃO: Este seed é apenas para desenvolvimento/testes.
-- Para produção, crie profissionais via /api/auth/register
-- ============================================================

-- Limpar dados existentes (SOMENTE em desenvolvimento)
DELETE FROM professionals WHERE email IN (
  'dr.teste@clinica.com',
  'dra.ana@clinica.com'
);

-- Profissional de teste com senha: Senha@123
-- Hash gerado via PBKDF2:SHA-256 (100.000 iterações)
-- Para gerar novo hash: use POST /api/auth/register
INSERT INTO professionals (
  email, password_hash, name, specialty, registration_number,
  phone, bio, xp_points, level, plan_type,
  marketplace_active, consultation_price,
  profile_completed, email_verified, is_active
) VALUES (
  'dr.teste@clinica.com',
  'REGISTER_VIA_API',
  'Dr. Teste Silva',
  'medico',
  'CRM 99999/SP',
  '(11) 99999-0000',
  'Profissional de teste para desenvolvimento. Use /api/auth/register para criar conta real.',
  100,
  1,
  'pro',
  1,
  250.00,
  1,
  1,
  1
);

-- ============================================================
-- CURSOS (dados de produção - sem dados sensíveis)
-- ============================================================

INSERT OR IGNORE INTO courses (title, slug, description, category, difficulty, xp_reward, duration_hours, total_lessons, is_published, is_premium) VALUES
('Fundamentos da Saúde Hormonal', 'fundamentos-saude-hormonal', 'Aprenda os princípios fundamentais da saúde hormonal e como atender casos hormonais com segurança em até 3 meses.', 'saude_hormonal', 'intermediario', 500, 20, 15, 1, 1),
('Nutrição Funcional 3.0', 'nutricao-funcional-3.0', 'A nova era da Nutrição Funcional. Transforme sua forma de pensar, prescrever e se posicionar como profissional.', 'nutricao_funcional', 'avancado', 800, 40, 30, 1, 1),
('Exames Laboratoriais 2.0', 'exames-laboratoriais-2.0', 'Domine correlações entre exames que revelam o que o laudo esconde e torne-se referência clínica.', 'exames_laboratoriais', 'intermediario', 600, 25, 20, 1, 1),
('Suplementação Individualizada', 'suplementacao-individualizada', 'Do papel em branco à prescrição de suplementos individualizada com base em evidências.', 'suplementacao', 'intermediario', 550, 18, 12, 1, 1),
('Jejum Intermitente na Prática Clínica', 'jejum-intermitente', 'Domine e aplique o jejum na prática clínica com segurança.', 'jejum', 'avancado', 400, 12, 10, 1, 0),
('Introdução à Saúde Integrativa', 'intro-saude-integrativa', 'Conceitos básicos de saúde integrativa para todos os profissionais da área da saúde.', 'geral', 'iniciante', 200, 8, 6, 1, 0);

-- ============================================================
-- AULAS (primeiro curso)
-- ============================================================

INSERT OR IGNORE INTO lessons (course_id, title, slug, description, content_type, order_index, duration_minutes, xp_reward, is_published) VALUES
(1, 'Introdução à Saúde Hormonal', 'introducao-saude-hormonal', 'Entenda o que é saúde hormonal e sua importância na prática clínica.', 'video', 1, 45, 50, 1),
(1, 'Eixo HPO: Hipotálamo-Pituitária-Ovário', 'eixo-hpo', 'Aprenda o funcionamento do eixo hormonal feminino.', 'video', 2, 60, 50, 1),
(1, 'Avaliação Clínica de Casos Hormonais', 'avaliacao-clinica', 'Como fazer uma avaliação clínica completa.', 'video', 3, 55, 50, 1),
(1, 'Exames Laboratoriais em Saúde Hormonal', 'exames-hormonais', 'Quais exames solicitar e como interpretá-los.', 'video', 4, 70, 50, 1),
(1, 'Caso Clínico: SOP e Resistência Insulínica', 'caso-sop', 'Análise detalhada de caso clínico de SOP.', 'case_study', 5, 90, 100, 1);

-- ============================================================
-- CASOS CLÍNICOS
-- ============================================================

INSERT OR IGNORE INTO clinical_cases (title, patient_profile, chief_complaint, patient_history, lab_results, expected_diagnosis, expected_treatment, learning_points, difficulty, specialty, tags, xp_reward) VALUES
(
  'Mulher de 32 anos com SOP e ganho de peso',
  'Mulher, 32 anos, IMC 28, sedentária',
  'Ganho de peso progressivo nos últimos 2 anos, ciclos menstruais irregulares (45-60 dias), acne facial, queda de cabelo.',
  'Paciente relata que tentou várias dietas sem sucesso. Histórico familiar de diabetes tipo 2. Sono não reparador.',
  '{"glicemia_jejum": 98, "insulina_jejum": 18.5, "homa_ir": 4.2, "testosterona_total": 65, "lh": 12.8, "fsh": 4.2}',
  'Síndrome dos Ovários Policísticos (SOP) com resistência insulínica',
  '{"suplementos": ["myo_inositol_2g_2x", "omega_3_2g", "vitamina_d_5000ui"], "dieta": "low_carb_moderado"}',
  'Identificar SOP através da relação LH/FSH, HOMA-IR elevado, e sinais clínicos.',
  'intermediario',
  'nutricionista',
  '["sop", "resistencia_insulinica", "saude_hormonal"]',
  500
),
(
  'Homem de 45 anos com fadiga crônica',
  'Homem, 45 anos, executivo, estresse alto',
  'Fadiga persistente há 6 meses, baixa libido, dificuldade de concentração.',
  'Trabalha 12h/dia, dorme 5-6h/noite. Sedentário.',
  '{"testosterona_total": 320, "vitamina_d": 18, "cortisol_am": 28}',
  'Hipogonadismo tardio (Low T) com deficiências nutricionais',
  '{"suplementos": ["vitamina_d_10000ui", "zinco_30mg", "ashwagandha_600mg"]}',
  'Avaliar eixo HPT, cortisol e cofatores nutricionais.',
  'avancado',
  'medico',
  '["low_t", "fadiga", "hormonal_masculino"]',
  700
);

-- ============================================================
-- PROTOCOLOS
-- ============================================================

INSERT OR IGNORE INTO protocols (title, slug, description, condition, protocol_steps, supplements, lifestyle_recommendations, lab_monitoring, specialty, evidence_level, is_premium) VALUES
(
  'Protocolo SOP com Resistência Insulínica',
  'protocolo-sop-ri',
  'Protocolo completo para tratamento de SOP associada a resistência insulínica.',
  'SOP',
  '[{"step": 1, "action": "Avaliação inicial completa", "duration": "1 consulta", "details": "Anamnese, exame físico, solicitar exames"}, {"step": 2, "action": "Dieta low carb moderado", "duration": "30 dias", "details": "40% carb, 30% prot, 30% gord"}, {"step": 3, "action": "Suplementação inicial", "duration": "60 dias", "details": "Myo-inositol + Ômega-3 + Vitamina D"}]',
  '[{"name": "Myo-inositol", "dose": "2g 2x/dia", "timing": "manhã e noite"}, {"name": "Ômega-3", "dose": "2g/dia", "timing": "com refeição"}, {"name": "Vitamina D", "dose": "5000 UI/dia", "timing": "manhã"}]',
  '[{"category": "sono", "recommendation": "7-8 horas por noite"}, {"category": "exercicio", "recommendation": "HIIT 3x/semana + musculação 2x/semana"}]',
  '[{"exam": "HOMA-IR", "interval": "90 dias"}, {"exam": "Testosterona total", "interval": "90 dias"}]',
  'nutricionista',
  'A',
  1
),
(
  'Protocolo Jejum Intermitente 16/8',
  'jejum-intermitente-16-8',
  'Implementação segura do jejum intermitente 16/8 na prática clínica.',
  'Obesidade/Síndrome Metabólica',
  '[{"step": 1, "action": "Avaliação de contraindicações", "duration": "1 consulta", "details": "Excluir gestação, DM1, histórico de TCA"}, {"step": 2, "action": "Adaptação progressiva", "duration": "2 semanas", "details": "Iniciar com 12h, progredir para 16h"}, {"step": 3, "action": "Ajuste nutricional", "duration": "contínuo", "details": "Priorizar proteína e gorduras boas na janela alimentar"}]',
  '[{"name": "Magnésio", "dose": "400mg/dia", "timing": "noite"}, {"name": "Eletrólitos", "dose": "conforme necessidade", "timing": "durante jejum"}]',
  '[{"category": "hidratacao", "recommendation": "2-3L de água durante o jejum"}, {"category": "exercicio", "recommendation": "Exercício no final do jejum ou durante janela alimentar"}]',
  '[{"exam": "Glicemia de jejum", "interval": "60 dias"}, {"exam": "Insulina", "interval": "60 dias"}]',
  'medico',
  'B',
  0
);

-- ============================================================
-- BADGES
-- ============================================================

INSERT OR IGNORE INTO badges (name, slug, description, criteria_type, criteria_value, rarity) VALUES
('Bem-vindo!', 'welcome', 'Criou sua conta na plataforma', 'registration', 1, 'comum'),
('Primeiro Paciente', 'first-patient', 'Cadastrou seu primeiro paciente', 'patients_count', 1, 'comum'),
('Estudante Dedicado', 'dedicated-student', 'Iniciou 3 cursos', 'courses_started', 3, 'incomum'),
('Clínico Experiente', 'experienced-clinician', 'Realizou 10 consultas', 'consultations', 10, 'incomum'),
('Mestre dos Casos', 'case-master', 'Resolveu 5 casos clínicos corretamente', 'cases_correct', 5, 'raro'),
('Nível 5', 'level-5', 'Atingiu o nível 5 na plataforma', 'level', 5, 'raro'),
('Especialista IA', 'ai-specialist', 'Fez 20 consultas ao assistente IA', 'ai_interactions', 20, 'incomum'),
('Elite', 'elite', 'Atingiu 10.000 pontos de XP', 'xp_points', 10000, 'lendario');

CREATE TABLE "conquista" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text NOT NULL,
	"criterio" text NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"patente_id" uuid,
	"pontos" integer DEFAULT 0 NOT NULL,
	"imagem_path" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criada_por" uuid,
	CONSTRAINT "conquista_titulo_unique" UNIQUE("titulo"),
	CONSTRAINT "conquista_criterio_check" CHECK ("conquista"."criterio" in ('aprs_completas', 'responsavel_apr', 'execucoes_concluidas', 'preventivas_em_dia', 'locais_criticos', 'os_retomadas', 'os_apoio', 'tecnicos_novos', 'locais_diferentes', 'ciencias_no_prazo', 'intervalos_definidos', 'campo_de_treino', 'pontos_gerais', 'pontos_numa_temporada', 'patente', 'posicao', 'temporadas', 'aprs_da_equipe', 'execucoes_da_equipe', 'preventivas_em_dia_da_equipe', 'pontos_gerais_da_equipe', 'patente_da_equipe', 'posicao_da_equipe', 'temporadas_impecaveis')),
	CONSTRAINT "conquista_quantidade_check" CHECK ("conquista"."quantidade" >= 1),
	CONSTRAINT "conquista_pontos_check" CHECK ("conquista"."pontos" between 0 and 1000),
	CONSTRAINT "conquista_titulo_preenchido" CHECK (btrim("conquista"."titulo") <> ''),
	CONSTRAINT "conquista_patente_so_no_criterio" CHECK (("conquista"."criterio" in ('patente', 'patente_da_equipe')) = ("conquista"."patente_id" is not null)),
	CONSTRAINT "conquista_equipe_sem_pontos" CHECK ("conquista"."pontos" = 0 or "conquista"."criterio" not in ('aprs_da_equipe', 'execucoes_da_equipe', 'preventivas_em_dia_da_equipe', 'pontos_gerais_da_equipe', 'patente_da_equipe', 'posicao_da_equipe', 'temporadas_impecaveis'))
);
--> statement-breakpoint
ALTER TABLE "conquista" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conquista_equipe" (
	"conquista_id" uuid NOT NULL,
	"equipe_id" uuid NOT NULL,
	"obtida_em" timestamp with time zone NOT NULL,
	CONSTRAINT "conquista_equipe_pkey" PRIMARY KEY("conquista_id","equipe_id")
);
--> statement-breakpoint
ALTER TABLE "conquista_equipe" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conquista_usuario" (
	"conquista_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"obtida_em" timestamp with time zone NOT NULL,
	"vista_em" timestamp with time zone,
	CONSTRAINT "conquista_usuario_pkey" PRIMARY KEY("conquista_id","usuario_id")
);
--> statement-breakpoint
ALTER TABLE "conquista_usuario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lancamento_equipe" (
	"lancamento_id" uuid NOT NULL,
	"equipe_id" uuid NOT NULL,
	CONSTRAINT "lancamento_equipe_pkey" PRIMARY KEY("lancamento_id","equipe_id")
);
--> statement-breakpoint
ALTER TABLE "lancamento_equipe" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lancamento_pontos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"regra" text NOT NULL,
	"pontos" integer NOT NULL,
	"chave" text NOT NULL,
	"os_id" uuid,
	"ocorrido_em" timestamp with time zone NOT NULL,
	"temporada" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_pontos_usuario_chave_key" UNIQUE("usuario_id","chave"),
	CONSTRAINT "lancamento_pontos_pontos_check" CHECK ("lancamento_pontos"."pontos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "lancamento_pontos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "patente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"pontos_necessarios" integer NOT NULL,
	"imagem_path" text NOT NULL,
	"cor" text NOT NULL,
	"descricao" text,
	"ativa" boolean DEFAULT true NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patente_nome_unique" UNIQUE("nome"),
	CONSTRAINT "patente_pontos_check" CHECK ("patente"."pontos_necessarios" >= 0),
	CONSTRAINT "patente_cor_check" CHECK ("patente"."cor" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "patente_nome_preenchido" CHECK (btrim("patente"."nome") <> '')
);
--> statement-breakpoint
ALTER TABLE "patente" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "regra_pontuacao" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text NOT NULL,
	"pontos" integer DEFAULT 0 NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_por" uuid,
	CONSTRAINT "regra_pontuacao_codigo_check" CHECK ("regra_pontuacao"."codigo" in ('apr_completa', 'responsavel_apr', 'execucao_concluida', 'preventiva_em_dia', 'local_critico', 'resgate', 'apoio', 'tecnico_novo', 'assinatura_cadastrada', 'treinamento_concluido', 'ciencia_no_prazo', 'intervalo_definido', 'conquista_obtida')),
	CONSTRAINT "regra_pontuacao_pontos_check" CHECK ("regra_pontuacao"."pontos" between 0 and 1000)
);
--> statement-breakpoint
ALTER TABLE "regra_pontuacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "temporada" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"fechada_em" timestamp with time zone,
	CONSTRAINT "temporada_codigo_check" CHECK ("temporada"."codigo" ~ '^[0-9]{4}-T[1-4]$'),
	CONSTRAINT "temporada_fim_apos_inicio" CHECK ("temporada"."fim" > "temporada"."inicio")
);
--> statement-breakpoint
ALTER TABLE "temporada" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "temporada_equipe" (
	"temporada" text NOT NULL,
	"equipe_id" uuid NOT NULL,
	"pontos" integer NOT NULL,
	"membros" integer NOT NULL,
	"media" numeric(12, 2) NOT NULL,
	"patente_id" uuid,
	"posicao" integer NOT NULL,
	"impecavel" boolean DEFAULT false NOT NULL,
	CONSTRAINT "temporada_equipe_pkey" PRIMARY KEY("temporada","equipe_id")
);
--> statement-breakpoint
ALTER TABLE "temporada_equipe" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "temporada_usuario" (
	"temporada" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"pontos" integer NOT NULL,
	"patente_id" uuid,
	"posicao" integer NOT NULL,
	CONSTRAINT "temporada_usuario_pkey" PRIMARY KEY("temporada","usuario_id")
);
--> statement-breakpoint
ALTER TABLE "temporada_usuario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "ranking_anonimo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "patente_avisada_id" uuid;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "patente_avisada_temporada" text;--> statement-breakpoint
ALTER TABLE "conquista" ADD CONSTRAINT "conquista_patente_id_patente_id_fk" FOREIGN KEY ("patente_id") REFERENCES "public"."patente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conquista" ADD CONSTRAINT "conquista_criada_por_usuario_id_fk" FOREIGN KEY ("criada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conquista_equipe" ADD CONSTRAINT "conquista_equipe_conquista_id_conquista_id_fk" FOREIGN KEY ("conquista_id") REFERENCES "public"."conquista"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conquista_equipe" ADD CONSTRAINT "conquista_equipe_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conquista_usuario" ADD CONSTRAINT "conquista_usuario_conquista_id_conquista_id_fk" FOREIGN KEY ("conquista_id") REFERENCES "public"."conquista"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conquista_usuario" ADD CONSTRAINT "conquista_usuario_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_equipe" ADD CONSTRAINT "lancamento_equipe_lancamento_id_lancamento_pontos_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamento_pontos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_equipe" ADD CONSTRAINT "lancamento_equipe_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_regra_regra_pontuacao_codigo_fk" FOREIGN KEY ("regra") REFERENCES "public"."regra_pontuacao"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_pontos" ADD CONSTRAINT "lancamento_pontos_temporada_temporada_codigo_fk" FOREIGN KEY ("temporada") REFERENCES "public"."temporada"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regra_pontuacao" ADD CONSTRAINT "regra_pontuacao_atualizada_por_usuario_id_fk" FOREIGN KEY ("atualizada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporada_equipe" ADD CONSTRAINT "temporada_equipe_temporada_temporada_codigo_fk" FOREIGN KEY ("temporada") REFERENCES "public"."temporada"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporada_equipe" ADD CONSTRAINT "temporada_equipe_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporada_equipe" ADD CONSTRAINT "temporada_equipe_patente_id_patente_id_fk" FOREIGN KEY ("patente_id") REFERENCES "public"."patente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporada_usuario" ADD CONSTRAINT "temporada_usuario_temporada_temporada_codigo_fk" FOREIGN KEY ("temporada") REFERENCES "public"."temporada"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporada_usuario" ADD CONSTRAINT "temporada_usuario_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporada_usuario" ADD CONSTRAINT "temporada_usuario_patente_id_patente_id_fk" FOREIGN KEY ("patente_id") REFERENCES "public"."patente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conquista_patente_idx" ON "conquista" USING btree ("patente_id") WHERE "conquista"."patente_id" is not null;--> statement-breakpoint
CREATE INDEX "conquista_equipe_equipe_idx" ON "conquista_equipe" USING btree ("equipe_id");--> statement-breakpoint
CREATE INDEX "conquista_usuario_usuario_idx" ON "conquista_usuario" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "conquista_usuario_pendentes_idx" ON "conquista_usuario" USING btree ("usuario_id") WHERE "conquista_usuario"."vista_em" is null;--> statement-breakpoint
CREATE INDEX "lancamento_equipe_equipe_idx" ON "lancamento_equipe" USING btree ("equipe_id");--> statement-breakpoint
CREATE INDEX "lancamento_pontos_temporada_usuario_idx" ON "lancamento_pontos" USING btree ("temporada","usuario_id");--> statement-breakpoint
CREATE INDEX "lancamento_pontos_usuario_data_idx" ON "lancamento_pontos" USING btree ("usuario_id","ocorrido_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lancamento_pontos_regra_idx" ON "lancamento_pontos" USING btree ("regra","usuario_id");--> statement-breakpoint
CREATE INDEX "lancamento_pontos_os_idx" ON "lancamento_pontos" USING btree ("os_id") WHERE "lancamento_pontos"."os_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "patente_pontos_ativas_idx" ON "patente" USING btree ("pontos_necessarios") WHERE "patente"."ativa";--> statement-breakpoint
CREATE INDEX "temporada_equipe_equipe_idx" ON "temporada_equipe" USING btree ("equipe_id");--> statement-breakpoint
CREATE INDEX "temporada_usuario_usuario_idx" ON "temporada_usuario" USING btree ("usuario_id");--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao', 'plano_preventiva', 'patente', 'conquista', 'regra_pontuacao'));
--> statement-breakpoint
-- Carga inicial da gamificação (escrita à mão): as 13 tarefas que pontuam, com os valores da seção 2 do gameficacao.md, as 5
-- patentes e as 23 conquistas. Entram só aqui, uma vez por banco: o que o admin ajustar ou apagar depois não volta. As imagens
-- (`imagem_path` = id do arquivo no bucket `gamificacao`) são gravadas pela subida da api. O extrato do histórico (APRs,
-- execuções, ciências, treinos, assinaturas e planos já gravados) é preenchido pela api na primeira subida com esta migração.
INSERT INTO "regra_pontuacao" ("codigo", "nome", "descricao", "pontos") VALUES
('apr_completa', 'APR completa', 'Preencher e registrar a APR da OS.', 10),
('execucao_concluida', 'Execução concluída', 'Concluir o serviço da OS, encerrado ou interrompido por risco.', 10),
('responsavel_apr', 'Responsável pela APR', 'Liderar a APR: quem a lidera responde por ela.', 5),
('preventiva_em_dia', 'Preventiva em dia', 'Encerrar a preventiva dentro do prazo, ou com atraso justificado.', 5),
('local_critico', 'Local crítico', 'Trabalhar num local que a gerência prioriza.', 5),
('resgate', 'Resgate', 'Retomar uma OS que ficou pendente por APR bloqueada ou por interrupção de outras pessoas.', 5),
('apoio', 'Apoio a outra equipe', 'Ajudar quem precisou, concluindo uma OS de apoio.', 5),
('tecnico_novo', 'Técnico novo acompanhado', 'Levar para campo quem está chegando.', 5),
('assinatura_cadastrada', 'Assinatura cadastrada', 'Cadastrar a assinatura no perfil.', 5),
('treinamento_concluido', 'Campo de treino concluído', 'Concluir o Campo de treino.', 10),
('ciencia_no_prazo', 'Ciência no prazo', 'Dar a ciência da OS encerrada em até 72 horas.', 3),
('intervalo_definido', 'Intervalo de preventiva definido', 'Definir o intervalo de um plano de preventiva que estava sem.', 3),
('conquista_obtida', 'Conquista obtida', 'Ganhar um troféu. O valor vem de cada conquista.', 0);
--> statement-breakpoint
INSERT INTO "patente" ("id", "nome", "pontos_necessarios", "imagem_path", "cor", "descricao") VALUES
('a0000000-0000-4000-8000-000000000001', 'Bronze', 0, 'a1000000-0000-4000-8000-000000000001', '#CD7F32', 'O ponto de partida de toda temporada.'),
('a0000000-0000-4000-8000-000000000002', 'Prata', 300, 'a1000000-0000-4000-8000-000000000002', '#A8A9AD', 'Primeira subida: o ritmo de campo já aparece.'),
('a0000000-0000-4000-8000-000000000003', 'Ouro', 1500, 'a1000000-0000-4000-8000-000000000003', '#D4AF37', 'Constância ao longo das semanas.'),
('a0000000-0000-4000-8000-000000000004', 'Platina', 3000, 'a1000000-0000-4000-8000-000000000004', '#9DB4C0', 'Perto do fim da temporada, com muito serviço feito.'),
('a0000000-0000-4000-8000-000000000005', 'Diamante', 5000, 'a1000000-0000-4000-8000-000000000005', '#4FC3F7', 'O topo: só quem rende bem acima da média.');
--> statement-breakpoint
INSERT INTO "conquista" ("id", "titulo", "descricao", "criterio", "quantidade", "patente_id", "pontos", "imagem_path") VALUES
('c0000000-0000-4000-8000-000000000001', 'Primeiro passo', 'Todo serviço seguro começa com uma APR.', 'aprs_completas', 1, NULL, 25, 'c1000000-0000-4000-8000-000000000001'),
('c0000000-0000-4000-8000-000000000002', 'Olho vivo', 'Cinquenta análises antes de pôr a mão no serviço.', 'aprs_completas', 50, NULL, 50, 'c1000000-0000-4000-8000-000000000002'),
('c0000000-0000-4000-8000-000000000003', 'Guardião da APR', 'A segurança virou hábito.', 'aprs_completas', 500, NULL, 100, 'c1000000-0000-4000-8000-000000000003'),
('c0000000-0000-4000-8000-000000000004', 'Líder de campo', 'Liderou a equipe na APR.', 'responsavel_apr', 50, NULL, 50, 'c1000000-0000-4000-8000-000000000004'),
('c0000000-0000-4000-8000-000000000005', 'Mão na massa', 'Cinquenta serviços concluídos em campo.', 'execucoes_concluidas', 50, NULL, 50, 'c1000000-0000-4000-8000-000000000005'),
('c0000000-0000-4000-8000-000000000006', 'Veterano de campo', 'Quinhentos serviços concluídos em campo.', 'execucoes_concluidas', 500, NULL, 100, 'c1000000-0000-4000-8000-000000000006'),
('c0000000-0000-4000-8000-000000000007', 'Relógio suíço', 'O plano de manutenção em dia.', 'preventivas_em_dia', 25, NULL, 50, 'c1000000-0000-4000-8000-000000000007'),
('c0000000-0000-4000-8000-000000000008', 'Ponto crítico', 'De confiança onde a operação não pode parar.', 'locais_criticos', 25, NULL, 50, 'c1000000-0000-4000-8000-000000000008'),
('c0000000-0000-4000-8000-000000000009', 'Resgate', 'Retomou o que ficou pendente.', 'os_retomadas', 5, NULL, 50, 'c1000000-0000-4000-8000-000000000009'),
('c0000000-0000-4000-8000-000000000010', 'Reforço', 'Apoiou outra equipe quando ela precisou.', 'os_apoio', 3, NULL, 50, 'c1000000-0000-4000-8000-000000000010'),
('c0000000-0000-4000-8000-000000000011', 'Mentor', 'Levou quem está chegando para aprender em campo.', 'tecnicos_novos', 10, NULL, 50, 'c1000000-0000-4000-8000-000000000011'),
('c0000000-0000-4000-8000-000000000012', 'Explorador', 'Conhece a operação de ponta a ponta.', 'locais_diferentes', 20, NULL, 50, 'c1000000-0000-4000-8000-000000000012'),
('c0000000-0000-4000-8000-000000000013', 'Pronto para o campo', 'Treinou antes de ir a campo.', 'campo_de_treino', 1, NULL, 25, 'c1000000-0000-4000-8000-000000000013'),
('c0000000-0000-4000-8000-000000000014', 'De olho na equipe', 'Acompanhou de perto o trabalho da equipe.', 'ciencias_no_prazo', 50, NULL, 50, 'c1000000-0000-4000-8000-000000000014'),
('c0000000-0000-4000-8000-000000000015', 'Planejador', 'Deixou o ciclo das preventivas pronto para avisar.', 'intervalos_definidos', 10, NULL, 50, 'c1000000-0000-4000-8000-000000000015'),
('c0000000-0000-4000-8000-000000000016', 'Pódio', 'Entre os três melhores da temporada.', 'posicao', 3, NULL, 100, 'c1000000-0000-4000-8000-000000000016'),
('c0000000-0000-4000-8000-000000000017', 'Brilho de diamante', 'Chegou ao topo numa temporada.', 'patente', 1, 'a0000000-0000-4000-8000-000000000005', 100, 'c1000000-0000-4000-8000-000000000017'),
('c0000000-0000-4000-8000-000000000018', 'Equipe em campo', 'Cem serviços concluídos juntos.', 'execucoes_da_equipe', 100, NULL, 0, 'c1000000-0000-4000-8000-000000000018'),
('c0000000-0000-4000-8000-000000000019', 'Plano em dia', 'Cem preventivas em dia.', 'preventivas_em_dia_da_equipe', 100, NULL, 0, 'c1000000-0000-4000-8000-000000000019'),
('c0000000-0000-4000-8000-000000000020', 'Temporada impecável', 'Uma temporada sem preventiva atrasada sem justificativa.', 'temporadas_impecaveis', 1, NULL, 0, 'c1000000-0000-4000-8000-000000000020'),
('c0000000-0000-4000-8000-000000000021', 'Equipe de ouro', 'A média da equipe chegou ao Ouro.', 'patente_da_equipe', 1, 'a0000000-0000-4000-8000-000000000003', 0, 'c1000000-0000-4000-8000-000000000021'),
('c0000000-0000-4000-8000-000000000022', 'Equipe diamante', 'A média da equipe chegou ao Diamante.', 'patente_da_equipe', 1, 'a0000000-0000-4000-8000-000000000005', 0, 'c1000000-0000-4000-8000-000000000022'),
('c0000000-0000-4000-8000-000000000023', 'Campeã da temporada', 'A melhor equipe da temporada.', 'posicao_da_equipe', 1, NULL, 0, 'c1000000-0000-4000-8000-000000000023');

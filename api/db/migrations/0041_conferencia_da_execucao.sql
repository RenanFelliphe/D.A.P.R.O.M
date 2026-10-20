CREATE TABLE "conferencia_assinatura" (
	"conferencia_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"assinatura_path" text,
	"ressalva" text,
	"assinada_em" timestamp with time zone NOT NULL,
	CONSTRAINT "conferencia_assinatura_pkey" PRIMARY KEY("conferencia_id","usuario_id"),
	CONSTRAINT "conferencia_assinatura_tipo_check" CHECK ("conferencia_assinatura"."tipo" in ('ciencia', 'assinatura')),
	CONSTRAINT "conferencia_assinatura_com_imagem" CHECK (("conferencia_assinatura"."tipo" = 'assinatura') = ("conferencia_assinatura"."assinatura_path" is not null))
);
--> statement-breakpoint
ALTER TABLE "conferencia_assinatura" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conferencia_decisao" (
	"conferencia_id" uuid NOT NULL,
	"campo" text NOT NULL,
	"escolha" text NOT NULL,
	"decidida_por" uuid,
	"decidida_em" timestamp with time zone NOT NULL,
	CONSTRAINT "conferencia_decisao_pkey" PRIMARY KEY("conferencia_id","campo")
);
--> statement-breakpoint
ALTER TABLE "conferencia_decisao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conferencia_execucao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execucao_id" uuid NOT NULL,
	"estado" text DEFAULT 'aguardando_sincronizacao' NOT NULL,
	"tipo" text,
	"criada_em" timestamp with time zone NOT NULL,
	"libera_fechar_em" timestamp with time zone NOT NULL,
	"limite_em" timestamp with time zone NOT NULL,
	"avisada24h_em" timestamp with time zone,
	"avisada48h_em" timestamp with time zone,
	"montada_em" timestamp with time zone,
	"snapshot" jsonb,
	"responsavel_id" uuid,
	"decidida_por" uuid,
	"decidida_em" timestamp with time zone,
	"aplicada_em" timestamp with time zone,
	"faltaram" jsonb,
	"fechada_em" timestamp with time zone,
	"fechada_por" uuid,
	CONSTRAINT "conferencia_estado_check" CHECK ("conferencia_execucao"."estado" in ('aguardando_sincronizacao', 'aguardando_responsavel', 'aguardando_assinaturas', 'concluida', 'fechada_sem_todos')),
	CONSTRAINT "conferencia_tipo_check" CHECK ("conferencia_execucao"."tipo" in ('resumo', 'com_divergencia')),
	CONSTRAINT "conferencia_tipo_montada" CHECK ("conferencia_execucao"."estado" = 'aguardando_sincronizacao' or "conferencia_execucao"."tipo" is not null),
	CONSTRAINT "conferencia_prazos" CHECK ("conferencia_execucao"."libera_fechar_em" > "conferencia_execucao"."criada_em" and "conferencia_execucao"."limite_em" > "conferencia_execucao"."libera_fechar_em"),
	CONSTRAINT "conferencia_fim_completo" CHECK (("conferencia_execucao"."estado" in ('concluida', 'fechada_sem_todos')) = ("conferencia_execucao"."fechada_em" is not null))
);
--> statement-breakpoint
ALTER TABLE "conferencia_execucao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_tipo_check";--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_alvo";--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "ultima_sincronizacao_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "fila_na_sincronizacao" jsonb;--> statement-breakpoint
ALTER TABLE "evento_campo" ADD COLUMN "execucao_id" uuid;--> statement-breakpoint
ALTER TABLE "evento_campo" ADD COLUMN "so_versao" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conferencia_assinatura" ADD CONSTRAINT "conferencia_assinatura_conferencia_id_conferencia_execucao_id_fk" FOREIGN KEY ("conferencia_id") REFERENCES "public"."conferencia_execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_assinatura" ADD CONSTRAINT "conferencia_assinatura_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_decisao" ADD CONSTRAINT "conferencia_decisao_conferencia_id_conferencia_execucao_id_fk" FOREIGN KEY ("conferencia_id") REFERENCES "public"."conferencia_execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_decisao" ADD CONSTRAINT "conferencia_decisao_decidida_por_usuario_id_fk" FOREIGN KEY ("decidida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_execucao" ADD CONSTRAINT "conferencia_execucao_execucao_id_execucao_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_execucao" ADD CONSTRAINT "conferencia_execucao_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_execucao" ADD CONSTRAINT "conferencia_execucao_decidida_por_usuario_id_fk" FOREIGN KEY ("decidida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_execucao" ADD CONSTRAINT "conferencia_execucao_fechada_por_usuario_id_fk" FOREIGN KEY ("fechada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conferencia_execucao_unica_idx" ON "conferencia_execucao" USING btree ("execucao_id");--> statement-breakpoint
CREATE INDEX "conferencia_abertas_idx" ON "conferencia_execucao" USING btree ("limite_em") WHERE "conferencia_execucao"."estado" in ('aguardando_sincronizacao', 'aguardando_responsavel', 'aguardando_assinaturas');--> statement-breakpoint
ALTER TABLE "evento_campo" ADD CONSTRAINT "evento_campo_execucao_id_execucao_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evento_campo_execucao_idx" ON "evento_campo" USING btree ("execucao_id","ocorrido_em") WHERE "evento_campo"."execucao_id" is not null;--> statement-breakpoint
CREATE INDEX "evento_campo_id_do_payload_idx" ON "evento_campo" USING btree (("payload"->>'id')) WHERE "evento_campo"."tipo" in ('execucao_iniciada', 'pausa_iniciada');--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_tipo_check" CHECK ("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'falha_importacao', 'preventiva_proxima', 'preventiva_vencida', 'inspecao_com_pendencia', 'pedido_de_acao', 'pedido_decidido', 'acao_de_participante', 'conferencia_aberta', 'conferencia_cobranca', 'conferencia_para_decidir', 'conferencia_para_assinar', 'conferencia_ressalva', 'conferencia_tempo_esgotado', 'apr_para_assinar', 'direito_de_recusa', 'lesao_ou_enfermidade', 'os_para_assinar', 'ausencia_pedida', 'ausencia_aprovada', 'ausencia_recusada', 'ausencia_registrada', 'ausencia_fim_pedido', 'ausencia_fim_respondido', 'ausencia_alterada', 'ausencia_vencida', 'ausencia_cancelada', 'representacao_iniciada', 'representacao_encerrada', 'os_reservada', 'os_reserva_desfeita', 'os_ciencia', 'pdf_os_falhou', 'conta_criada', 'acesso_liberado', 'acesso_recusado', 'senha_redefinida', 'cadastro_pendente', 'cadastro_liberado', 'cadastro_recusado', 'membro_desativado', 'funcionario_readmitido', 'equipe_sem_supervisor', 'rh_leitura_falhou', 'vitoria_sem_ia', 'treinamento_publicado', 'treinamento_problema', 'sugestao_materiais_nova', 'contestacao_materiais_nova', 'sugestao_materiais_aceita', 'sugestao_materiais_recusada', 'materiais_atualizados'));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_alvo" CHECK (("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'preventiva_proxima', 'preventiva_vencida', 'inspecao_com_pendencia', 'pedido_de_acao', 'pedido_decidido', 'acao_de_participante', 'conferencia_aberta', 'conferencia_cobranca', 'conferencia_para_decidir', 'conferencia_para_assinar', 'conferencia_ressalva', 'conferencia_tempo_esgotado', 'apr_para_assinar', 'direito_de_recusa', 'lesao_ou_enfermidade', 'os_para_assinar', 'os_reservada', 'os_reserva_desfeita', 'os_ciencia', 'pdf_os_falhou') and "alerta"."os_id" is not null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('falha_importacao') and "alerta"."os_id" is null and "alerta"."importacao_id" is not null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('ausencia_pedida', 'ausencia_aprovada', 'ausencia_recusada', 'ausencia_registrada', 'ausencia_fim_pedido', 'ausencia_fim_respondido', 'ausencia_alterada', 'ausencia_vencida', 'ausencia_cancelada') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is not null and "alerta"."usuario_alvo_id" is not null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('representacao_iniciada', 'representacao_encerrada', 'equipe_sem_supervisor') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is not null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('conta_criada', 'acesso_liberado', 'acesso_recusado', 'senha_redefinida', 'cadastro_pendente', 'cadastro_liberado', 'cadastro_recusado', 'membro_desativado', 'funcionario_readmitido') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is not null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('rh_leitura_falhou') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is not null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('treinamento_publicado', 'treinamento_problema') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is not null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('sugestao_materiais_nova', 'contestacao_materiais_nova', 'sugestao_materiais_aceita', 'sugestao_materiais_recusada') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is not null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('materiais_atualizados') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is not null) or ("alerta"."tipo" in ('vitoria_sem_ia') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null));
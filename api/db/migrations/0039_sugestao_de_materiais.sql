CREATE TABLE "sugestao_materiais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"atividade_codigo" text NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"autor_id" uuid NOT NULL,
	"equipe_responsavel_id" uuid,
	"motivo" text,
	"tem_lista" boolean NOT NULL,
	"lista_base" jsonb NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"avaliada_por" uuid,
	"avaliada_em" timestamp with time zone,
	"resposta" text,
	"ajustada" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sugestao_materiais_tipo_check" CHECK ("sugestao_materiais"."tipo" in ('sugestao', 'contestacao')),
	CONSTRAINT "sugestao_materiais_estado_check" CHECK ("sugestao_materiais"."estado" in ('pendente', 'aceita', 'recusada', 'cancelada')),
	CONSTRAINT "sugestao_materiais_contestacao_com_motivo" CHECK ("sugestao_materiais"."tipo" <> 'contestacao' or nullif(btrim("sugestao_materiais"."motivo"), '') is not null),
	CONSTRAINT "sugestao_materiais_sugestao_com_lista" CHECK ("sugestao_materiais"."tipo" <> 'sugestao' or "sugestao_materiais"."tem_lista"),
	CONSTRAINT "sugestao_materiais_avaliacao_completa" CHECK (("sugestao_materiais"."estado" in ('aceita', 'recusada')) = ("sugestao_materiais"."avaliada_em" is not null and "sugestao_materiais"."avaliada_por" is not null)),
	CONSTRAINT "sugestao_materiais_recusa_com_resposta" CHECK ("sugestao_materiais"."estado" <> 'recusada' or nullif(btrim("sugestao_materiais"."resposta"), '') is not null)
);
--> statement-breakpoint
ALTER TABLE "sugestao_materiais" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sugestao_materiais_item" (
	"sugestao_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"material_id" uuid,
	"descricao" text,
	"unidade" text,
	"categoria" text,
	"quantidade" numeric(12, 3),
	"observacao" text,
	CONSTRAINT "sugestao_materiais_item_pkey" PRIMARY KEY("sugestao_id","ordem"),
	CONSTRAINT "sugestao_materiais_item_categoria_check" CHECK ("sugestao_materiais_item"."categoria" is null or "sugestao_materiais_item"."categoria" in ('material', 'ferramenta', 'epi')),
	CONSTRAINT "sugestao_materiais_item_origem" CHECK (("sugestao_materiais_item"."material_id" is not null and "sugestao_materiais_item"."descricao" is null and "sugestao_materiais_item"."unidade" is null and "sugestao_materiais_item"."categoria" is null) or ("sugestao_materiais_item"."material_id" is null and nullif(btrim("sugestao_materiais_item"."descricao"), '') is not null and nullif(btrim("sugestao_materiais_item"."unidade"), '') is not null and "sugestao_materiais_item"."categoria" is not null)),
	CONSTRAINT "sugestao_materiais_item_quantidade_check" CHECK ("sugestao_materiais_item"."quantidade" is null or "sugestao_materiais_item"."quantidade" > 0)
);
--> statement-breakpoint
ALTER TABLE "sugestao_materiais_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_tipo_check";--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_alvo";--> statement-breakpoint
ALTER TABLE "regra_pontuacao" DROP CONSTRAINT "regra_pontuacao_codigo_check";--> statement-breakpoint
ALTER TABLE "alerta" ADD COLUMN "sugestao_materiais_id" uuid;--> statement-breakpoint
ALTER TABLE "alerta" ADD COLUMN "atividade_codigo" text;--> statement-breakpoint
ALTER TABLE "sugestao_materiais" ADD CONSTRAINT "sugestao_materiais_atividade_codigo_atividade_codigo_fk" FOREIGN KEY ("atividade_codigo") REFERENCES "public"."atividade"("codigo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestao_materiais" ADD CONSTRAINT "sugestao_materiais_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestao_materiais" ADD CONSTRAINT "sugestao_materiais_equipe_responsavel_id_equipe_id_fk" FOREIGN KEY ("equipe_responsavel_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestao_materiais" ADD CONSTRAINT "sugestao_materiais_avaliada_por_usuario_id_fk" FOREIGN KEY ("avaliada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestao_materiais_item" ADD CONSTRAINT "sugestao_materiais_item_sugestao_id_sugestao_materiais_id_fk" FOREIGN KEY ("sugestao_id") REFERENCES "public"."sugestao_materiais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestao_materiais_item" ADD CONSTRAINT "sugestao_materiais_item_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sugestao_materiais_pendente_idx" ON "sugestao_materiais" USING btree ("autor_id","atividade_codigo") WHERE "sugestao_materiais"."estado" = 'pendente';--> statement-breakpoint
CREATE INDEX "sugestao_materiais_atividade_idx" ON "sugestao_materiais" USING btree ("atividade_codigo","criada_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sugestao_materiais_equipe_pendentes_idx" ON "sugestao_materiais" USING btree ("equipe_responsavel_id") WHERE "sugestao_materiais"."estado" = 'pendente';--> statement-breakpoint
CREATE INDEX "sugestao_materiais_autor_idx" ON "sugestao_materiais" USING btree ("autor_id","criada_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sugestao_materiais_item_material_idx" ON "sugestao_materiais_item" USING btree ("material_id") WHERE "sugestao_materiais_item"."material_id" is not null;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_sugestao_materiais_id_sugestao_materiais_id_fk" FOREIGN KEY ("sugestao_materiais_id") REFERENCES "public"."sugestao_materiais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_atividade_codigo_atividade_codigo_fk" FOREIGN KEY ("atividade_codigo") REFERENCES "public"."atividade"("codigo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao', 'plano_preventiva', 'patente', 'conquista', 'regra_pontuacao', 'rh', 'ausencia', 'treinamento', 'sugestao_materiais'));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_tipo_check" CHECK ("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'falha_importacao', 'preventiva_proxima', 'preventiva_vencida', 'inspecao_com_pendencia', 'apr_para_assinar', 'direito_de_recusa', 'lesao_ou_enfermidade', 'os_para_assinar', 'ausencia_pedida', 'ausencia_aprovada', 'ausencia_recusada', 'ausencia_registrada', 'ausencia_fim_pedido', 'ausencia_fim_respondido', 'ausencia_alterada', 'ausencia_vencida', 'ausencia_cancelada', 'representacao_iniciada', 'representacao_encerrada', 'os_reservada', 'os_reserva_desfeita', 'os_ciencia', 'pdf_os_falhou', 'conta_criada', 'acesso_liberado', 'acesso_recusado', 'senha_redefinida', 'cadastro_pendente', 'cadastro_liberado', 'cadastro_recusado', 'membro_desativado', 'funcionario_readmitido', 'equipe_sem_supervisor', 'rh_leitura_falhou', 'vitoria_sem_ia', 'treinamento_publicado', 'treinamento_problema', 'sugestao_materiais_nova', 'contestacao_materiais_nova', 'sugestao_materiais_aceita', 'sugestao_materiais_recusada', 'materiais_atualizados'));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_alvo" CHECK (("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'preventiva_proxima', 'preventiva_vencida', 'inspecao_com_pendencia', 'apr_para_assinar', 'direito_de_recusa', 'lesao_ou_enfermidade', 'os_para_assinar', 'os_reservada', 'os_reserva_desfeita', 'os_ciencia', 'pdf_os_falhou') and "alerta"."os_id" is not null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('falha_importacao') and "alerta"."os_id" is null and "alerta"."importacao_id" is not null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('ausencia_pedida', 'ausencia_aprovada', 'ausencia_recusada', 'ausencia_registrada', 'ausencia_fim_pedido', 'ausencia_fim_respondido', 'ausencia_alterada', 'ausencia_vencida', 'ausencia_cancelada') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is not null and "alerta"."usuario_alvo_id" is not null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('representacao_iniciada', 'representacao_encerrada', 'equipe_sem_supervisor') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is not null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('conta_criada', 'acesso_liberado', 'acesso_recusado', 'senha_redefinida', 'cadastro_pendente', 'cadastro_liberado', 'cadastro_recusado', 'membro_desativado', 'funcionario_readmitido') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is not null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('rh_leitura_falhou') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is not null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('treinamento_publicado', 'treinamento_problema') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is not null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('sugestao_materiais_nova', 'contestacao_materiais_nova', 'sugestao_materiais_aceita', 'sugestao_materiais_recusada') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is not null and "alerta"."atividade_codigo" is null) or ("alerta"."tipo" in ('materiais_atualizados') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is not null) or ("alerta"."tipo" in ('vitoria_sem_ia') and "alerta"."os_id" is null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null and "alerta"."usuario_alvo_id" is null and "alerta"."equipe_id" is null and "alerta"."leitura_rh_id" is null and "alerta"."treinamento_id" is null and "alerta"."sugestao_materiais_id" is null and "alerta"."atividade_codigo" is null));--> statement-breakpoint
ALTER TABLE "regra_pontuacao" ADD CONSTRAINT "regra_pontuacao_codigo_check" CHECK ("regra_pontuacao"."codigo" in ('apr_completa', 'responsavel_apr', 'execucao_concluida', 'preventiva_em_dia', 'preventiva_concluida', 'local_critico', 'resgate', 'apoio', 'tecnico_novo', 'assinatura_cadastrada', 'treinamento_concluido', 'ciencia_no_prazo', 'intervalo_definido', 'conquista_obtida', 'treinamento_servico_concluido', 'treinamento_servico_fases', 'sugestao_materiais_aceita', 'sugestao_materiais_avaliada'));--> statement-breakpoint
-- Carga das duas tarefas novas que pontuam (escrita à mão, seção 12 do sugestao-de-materiais.md): a sugestão aceita e a avaliação.
INSERT INTO "regra_pontuacao" ("codigo", "nome", "descricao", "pontos") VALUES
('sugestao_materiais_aceita', 'Sugestão de materiais aceita', 'Ter a sugestão (ou a contestação) da lista de materiais de um serviço aceita pelo supervisor.', 30),
('sugestao_materiais_avaliada', 'Sugestão de materiais avaliada', 'Avaliar (aceitar ou recusar) a sugestão ou a contestação da lista de materiais de um serviço.', 3);

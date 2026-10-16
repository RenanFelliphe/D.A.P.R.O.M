CREATE TABLE "ausencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"equipe_id" uuid NOT NULL,
	"supervisor_id" uuid,
	"motivo" text NOT NULL,
	"inicio" date NOT NULL,
	"retorno" date NOT NULL,
	"dias_informados" integer,
	"estado" text NOT NULL,
	"origem" text NOT NULL,
	"fim_pedido_data" date,
	"fim_pedido_em" timestamp with time zone,
	"encerrada_em" timestamp with time zone,
	"encerrada_por" uuid,
	"forma_encerramento" text,
	"inicio_aplicado_em" timestamp with time zone,
	"vencida_avisada_em" timestamp with time zone,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ausencia_estado_check" CHECK ("ausencia"."estado" in ('pedida', 'aguardando_confirmacao', 'confirmada', 'encerrada', 'recusada', 'cancelada')),
	CONSTRAINT "ausencia_origem_check" CHECK ("ausencia"."origem" in ('pedido', 'supervisor', 'propria')),
	CONSTRAINT "ausencia_forma_encerramento_check" CHECK ("ausencia"."forma_encerramento" in ('retorno', 'antecipada', 'supervisor', 'emergencia')),
	CONSTRAINT "ausencia_periodo" CHECK ("ausencia"."retorno" > "ausencia"."inicio"),
	CONSTRAINT "ausencia_motivo_check" CHECK (nullif(btrim("ausencia"."motivo"), '') is not null and char_length("ausencia"."motivo") <= 500),
	CONSTRAINT "ausencia_dias_check" CHECK ("ausencia"."dias_informados" is null or "ausencia"."dias_informados" between 1 and 365),
	CONSTRAINT "ausencia_encerramento_coerente" CHECK (("ausencia"."estado" in ('encerrada', 'recusada', 'cancelada')) = ("ausencia"."encerrada_em" is not null) and ("ausencia"."estado" = 'encerrada') = ("ausencia"."forma_encerramento" is not null)),
	CONSTRAINT "ausencia_supervisor_check" CHECK ("ausencia"."estado" not in ('aguardando_confirmacao', 'confirmada') or "ausencia"."supervisor_id" is not null),
	CONSTRAINT "ausencia_fim_pedido_completo" CHECK (("ausencia"."fim_pedido_em" is null) = ("ausencia"."fim_pedido_data" is null))
);
--> statement-breakpoint
ALTER TABLE "ausencia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ausencia_ato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ausencia_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"autor_id" uuid,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	"assinatura_path" text,
	"dados" jsonb,
	CONSTRAINT "ausencia_ato_tipo_check" CHECK ("ausencia_ato"."tipo" in ('pedido', 'registro', 'aprovacao', 'recusa', 'confirmacao', 'recusa_ajuste', 'cancelamento', 'cancelamento_automatico', 'inicio', 'fim_pedido', 'fim_aprovado', 'fim_recusado', 'prorrogacao', 'encerramento', 'retorno'))
);
--> statement-breakpoint
ALTER TABLE "ausencia_ato" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_tipo_check";--> statement-breakpoint
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_alvo";--> statement-breakpoint
ALTER TABLE "alerta" ADD COLUMN "ausencia_id" uuid;--> statement-breakpoint
ALTER TABLE "alerta" ADD COLUMN "usuario_alvo_id" uuid;--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_supervisor_id_usuario_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_encerrada_por_usuario_id_fk" FOREIGN KEY ("encerrada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia_ato" ADD CONSTRAINT "ausencia_ato_ausencia_id_ausencia_id_fk" FOREIGN KEY ("ausencia_id") REFERENCES "public"."ausencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia_ato" ADD CONSTRAINT "ausencia_ato_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ausencia_usuario_idx" ON "ausencia" USING btree ("usuario_id","inicio" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ausencia_equipe_idx" ON "ausencia" USING btree ("equipe_id","inicio" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ausencia_abertas_idx" ON "ausencia" USING btree ("usuario_id") WHERE "ausencia"."estado" in ('pedida', 'aguardando_confirmacao', 'confirmada');--> statement-breakpoint
CREATE INDEX "ausencia_confirmadas_idx" ON "ausencia" USING btree ("inicio") WHERE "ausencia"."estado" = 'confirmada';--> statement-breakpoint
CREATE INDEX "ausencia_ato_ausencia_idx" ON "ausencia_ato" USING btree ("ausencia_id","em");--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_ausencia_id_ausencia_id_fk" FOREIGN KEY ("ausencia_id") REFERENCES "public"."ausencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_usuario_alvo_id_usuario_id_fk" FOREIGN KEY ("usuario_alvo_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerta_ausencia_idx" ON "alerta" USING btree ("ausencia_id") WHERE "alerta"."ausencia_id" is not null;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao', 'plano_preventiva', 'patente', 'conquista', 'regra_pontuacao', 'rh', 'ausencia'));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_alvo_da_ausencia" CHECK (("alerta"."ausencia_id" is null) = ("alerta"."usuario_alvo_id" is null));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_tipo_check" CHECK ("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'falha_importacao', 'preventiva_proxima', 'preventiva_vencida', 'inspecao_com_pendencia', 'ausencia_pedida', 'ausencia_aprovada', 'ausencia_recusada', 'ausencia_registrada', 'ausencia_fim_pedido', 'ausencia_fim_respondido', 'ausencia_alterada', 'ausencia_vencida', 'ausencia_cancelada'));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_alvo" CHECK (("alerta"."tipo" = 'falha_importacao' and "alerta"."importacao_id" is not null and "alerta"."os_id" is null and "alerta"."ausencia_id" is null) or ("alerta"."tipo" in ('ausencia_pedida', 'ausencia_aprovada', 'ausencia_recusada', 'ausencia_registrada', 'ausencia_fim_pedido', 'ausencia_fim_respondido', 'ausencia_alterada', 'ausencia_vencida', 'ausencia_cancelada') and "alerta"."ausencia_id" is not null and "alerta"."os_id" is null and "alerta"."importacao_id" is null) or ("alerta"."tipo" <> 'falha_importacao' and not "alerta"."tipo" in ('ausencia_pedida', 'ausencia_aprovada', 'ausencia_recusada', 'ausencia_registrada', 'ausencia_fim_pedido', 'ausencia_fim_respondido', 'ausencia_alterada', 'ausencia_vencida', 'ausencia_cancelada') and "alerta"."os_id" is not null and "alerta"."importacao_id" is null and "alerta"."ausencia_id" is null));
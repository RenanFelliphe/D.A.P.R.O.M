CREATE TABLE "funcionario_simulado" (
	"matricula" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"cargo" text NOT NULL,
	"centro_trabalho" text NOT NULL,
	"setor" text NOT NULL,
	"registro_profissional" text,
	"situacao" text DEFAULT 'ativo' NOT NULL,
	"data_admissao" date,
	"data_nascimento" date,
	"telefone" text,
	"gestor_matricula" text,
	"lotacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"alterado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funcionario_simulado_email_unique" UNIQUE("email"),
	CONSTRAINT "funcionario_simulado_situacao_check" CHECK ("funcionario_simulado"."situacao" in ('ativo', 'afastado', 'desligado')),
	CONSTRAINT "funcionario_simulado_email_minusculo" CHECK ("funcionario_simulado"."email" = lower("funcionario_simulado"."email"))
);
--> statement-breakpoint
ALTER TABLE "funcionario_simulado" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leitura_rh" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origem" text NOT NULL,
	"usuario_id" uuid,
	"dia" date,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	"conferidos" integer DEFAULT 0 NOT NULL,
	"atualizados" integer DEFAULT 0 NOT NULL,
	"desativados" integer DEFAULT 0 NOT NULL,
	"erro" text,
	CONSTRAINT "leitura_rh_origem_check" CHECK ("leitura_rh"."origem" in ('agendada', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "leitura_rh" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "tarefa" DROP CONSTRAINT "tarefa_tipo_check";--> statement-breakpoint
ALTER TABLE "auditoria" ALTER COLUMN "ator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "situacao_registro" text;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "registro_conferido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leitura_rh" ADD CONSTRAINT "leitura_rh_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leitura_rh_dia_unico" ON "leitura_rh" USING btree ("dia") WHERE "leitura_rh"."dia" is not null;--> statement-breakpoint
CREATE INDEX "leitura_rh_iniciada_idx" ON "leitura_rh" USING btree ("iniciada_em" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao', 'plano_preventiva', 'patente', 'conquista', 'regra_pontuacao', 'rh'));--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_tipo_check" CHECK ("tarefa"."tipo" in ('pdf_os', 'email_alerta', 'leitura_sap', 'leitura_rh', 'conferencia_rh'));--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_situacao_registro_check" CHECK ("usuario"."situacao_registro" in ('ativo', 'afastado', 'desligado', 'fora_do_registro'));
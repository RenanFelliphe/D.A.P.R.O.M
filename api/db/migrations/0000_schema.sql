CREATE TABLE "tarefa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"referencia_id" uuid,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"proxima_em" timestamp with time zone DEFAULT now() NOT NULL,
	"erro" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tarefa_tipo_check" CHECK ("tarefa"."tipo" in ('pdf_os', 'email_alerta', 'leitura_sap')),
	CONSTRAINT "tarefa_estado_check" CHECK ("tarefa"."estado" in ('pendente', 'em_andamento', 'concluida', 'falhou')),
	CONSTRAINT "tarefa_tentativas_check" CHECK ("tarefa"."tentativas" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tarefa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "equipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"centro_trabalho" text NOT NULL,
	"supervisor_id" uuid,
	CONSTRAINT "equipe_centroTrabalho_unique" UNIQUE("centro_trabalho")
);
--> statement-breakpoint
ALTER TABLE "equipe" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"matricula" text NOT NULL,
	"email" text,
	"cargo" text,
	"registro_profissional" text,
	"perfil" text NOT NULL,
	"equipe_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"senha_provisoria" boolean DEFAULT true NOT NULL,
	"assinatura_path" text,
	"assinatura_em" timestamp with time zone,
	CONSTRAINT "usuario_matricula_unique" UNIQUE("matricula"),
	CONSTRAINT "usuario_perfil_check" CHECK ("usuario"."perfil" in ('tecnico', 'supervisor', 'analista', 'seguranca', 'admin')),
	CONSTRAINT "usuario_supervisor_com_email" CHECK ("usuario"."perfil" <> 'supervisor' or "usuario"."email" is not null),
	CONSTRAINT "usuario_assinatura_completa" CHECK (("usuario"."assinatura_path" is null) = ("usuario"."assinatura_em" is null))
);
--> statement-breakpoint
ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "atividade" (
	"codigo" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"modelo_apr_codigo" text,
	"provisorio" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atividade" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "item_modelo_apr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo_apr_id" uuid NOT NULL,
	"secao" text NOT NULL,
	"risco_id" uuid,
	"ordem" integer NOT NULL,
	"texto" text NOT NULL,
	"resposta_bloqueante" text,
	"tipo" text NOT NULL,
	"evidencia" text DEFAULT 'foto' NOT NULL,
	"permite_na" boolean DEFAULT false NOT NULL,
	CONSTRAINT "item_modelo_apr_modelo_apr_id_ordem_key" UNIQUE("modelo_apr_id","ordem"),
	CONSTRAINT "item_modelo_apr_secao_check" CHECK ("item_modelo_apr"."secao" in ('verificacao', 'medida_preventiva')),
	CONSTRAINT "item_modelo_apr_resposta_bloqueante_check" CHECK ("item_modelo_apr"."resposta_bloqueante" in ('sim', 'nao')),
	CONSTRAINT "item_modelo_apr_tipo_check" CHECK ("item_modelo_apr"."tipo" in ('eliminatorio', 'alerta')),
	CONSTRAINT "item_modelo_apr_evidencia_check" CHECK ("item_modelo_apr"."evidencia" in ('foto', 'texto')),
	CONSTRAINT "item_modelo_apr_risco_da_medida" CHECK (("item_modelo_apr"."secao" = 'medida_preventiva') = ("item_modelo_apr"."risco_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "item_modelo_apr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "modelo_apr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"versao" integer NOT NULL,
	"data_documento" date,
	"titulo" text NOT NULL,
	"pae" jsonb,
	"publicado_em" timestamp with time zone,
	CONSTRAINT "modelo_apr_codigo_versao_key" UNIQUE("codigo","versao"),
	CONSTRAINT "modelo_apr_versao_check" CHECK ("modelo_apr"."versao" > 0)
);
--> statement-breakpoint
ALTER TABLE "modelo_apr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risco_modelo_apr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modelo_apr_id" uuid NOT NULL,
	"classificacao" text NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	CONSTRAINT "risco_modelo_apr_modelo_apr_id_ordem_key" UNIQUE("modelo_apr_id","ordem")
);
--> statement-breakpoint
ALTER TABLE "risco_modelo_apr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "importacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origem" text NOT NULL,
	"arquivo" text,
	"usuario_id" uuid,
	"criadas" integer DEFAULT 0 NOT NULL,
	"atualizadas" integer DEFAULT 0 NOT NULL,
	"ignoradas" integer DEFAULT 0 NOT NULL,
	"detalhe_ignoradas" jsonb,
	"erro" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "importacao_origem_check" CHECK ("importacao"."origem" in ('api', 'planilha')),
	CONSTRAINT "importacao_criadas_check" CHECK ("importacao"."criadas" >= 0),
	CONSTRAINT "importacao_atualizadas_check" CHECK ("importacao"."atualizadas" >= 0),
	CONSTRAINT "importacao_ignoradas_check" CHECK ("importacao"."ignoradas" >= 0)
);
--> statement-breakpoint
ALTER TABLE "importacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "local_instalacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"endereco" text,
	"plus_code" text,
	"cliente" text,
	"critico" boolean DEFAULT false NOT NULL,
	CONSTRAINT "local_instalacao_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "local_instalacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "os" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_ordem" text,
	"numero_nota" text,
	"tipo" text NOT NULL,
	"tipo_atividade" text,
	"codigo_atividade" text,
	"titulo" text NOT NULL,
	"descricao" text,
	"equipamento" text,
	"local_instalacao_id" uuid NOT NULL,
	"equipe_id" uuid NOT NULL,
	"plano_manutencao" text,
	"item_manutencao" text,
	"prioridade" text,
	"data_inicio_prog" date NOT NULL,
	"data_fim_prog" date,
	"status" text DEFAULT 'liberada' NOT NULL,
	"data_ordem" date,
	"criado_por_sap" text,
	"status_sap" text,
	"solicitante" text,
	"os_origem_id" uuid,
	"origem" text NOT NULL,
	"pdf_path" text,
	"pdf_em" timestamp with time zone,
	"ciencia_por" uuid,
	"ciencia_em" timestamp with time zone,
	"exportada_sap_em" timestamp with time zone,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "os_numeroOrdem_unique" UNIQUE("numero_ordem"),
	CONSTRAINT "os_tipo_check" CHECK ("os"."tipo" in ('corretiva', 'preventiva')),
	CONSTRAINT "os_status_check" CHECK ("os"."status" in ('liberada', 'pendente', 'em_execucao', 'encerrada', 'cancelada')),
	CONSTRAINT "os_origem_check" CHECK ("os"."origem" in ('sap', 'planilha', 'manual')),
	CONSTRAINT "os_numero_ordem_obrigatorio" CHECK ("os"."numero_ordem" is not null or "os"."origem" = 'manual'),
	CONSTRAINT "os_datas_programadas" CHECK ("os"."data_fim_prog" is null or "os"."data_fim_prog" >= "os"."data_inicio_prog"),
	CONSTRAINT "os_apoio_nao_aponta_para_si" CHECK ("os"."os_origem_id" is null or "os"."os_origem_id" <> "os"."id"),
	CONSTRAINT "os_ciencia_completa" CHECK (("os"."ciencia_por" is null) = ("os"."ciencia_em" is null)),
	CONSTRAINT "os_pdf_completo" CHECK (("os"."pdf_path" is null) = ("os"."pdf_em" is null))
);
--> statement-breakpoint
ALTER TABLE "os" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "apr" (
	"id" uuid PRIMARY KEY NOT NULL,
	"os_id" uuid NOT NULL,
	"modelo_apr_id" uuid NOT NULL,
	"preenchida_por" uuid NOT NULL,
	"resultado" text NOT NULL,
	"observacao_geral" text,
	"concluida_em" timestamp with time zone NOT NULL,
	CONSTRAINT "apr_resultado_check" CHECK ("apr"."resultado" in ('aprovada', 'bloqueada'))
);
--> statement-breakpoint
ALTER TABLE "apr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "apr_participante" (
	"apr_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"funcao" text NOT NULL,
	"assinatura_path" text NOT NULL,
	"assinada_em" timestamp with time zone NOT NULL,
	CONSTRAINT "apr_participante_pkey" PRIMARY KEY("apr_id","usuario_id"),
	CONSTRAINT "apr_participante_funcao_check" CHECK ("apr_participante"."funcao" in ('responsavel', 'executor'))
);
--> statement-breakpoint
ALTER TABLE "apr_participante" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "apr_resposta" (
	"apr_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"resposta" text NOT NULL,
	"observacao" text,
	"respondida_em" timestamp with time zone NOT NULL,
	CONSTRAINT "apr_resposta_pkey" PRIMARY KEY("apr_id","item_id"),
	CONSTRAINT "apr_resposta_resposta_check" CHECK ("apr_resposta"."resposta" in ('sim', 'nao', 'na')),
	CONSTRAINT "apr_resposta_na_com_observacao" CHECK ("apr_resposta"."resposta" <> 'na' or nullif(btrim("apr_resposta"."observacao"), '') is not null)
);
--> statement-breakpoint
ALTER TABLE "apr_resposta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "apr_risco" (
	"apr_id" uuid NOT NULL,
	"risco_id" uuid NOT NULL,
	CONSTRAINT "apr_risco_pkey" PRIMARY KEY("apr_id","risco_id")
);
--> statement-breakpoint
ALTER TABLE "apr_risco" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evidencia" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execucao_id" uuid,
	"apr_id" uuid,
	"item_id" uuid,
	"foto_path" text NOT NULL,
	"capturada_em" timestamp with time zone NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	CONSTRAINT "evidencia_tem_dono" CHECK ("evidencia"."execucao_id" is not null or "evidencia"."apr_id" is not null),
	CONSTRAINT "evidencia_item_da_apr" CHECK (("evidencia"."apr_id" is null) = ("evidencia"."item_id" is null)),
	CONSTRAINT "evidencia_gps_completo" CHECK (("evidencia"."latitude" is null) = ("evidencia"."longitude" is null)),
	CONSTRAINT "evidencia_latitude_check" CHECK ("evidencia"."latitude" between -90 and 90),
	CONSTRAINT "evidencia_longitude_check" CHECK ("evidencia"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "evidencia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "execucao" (
	"id" uuid PRIMARY KEY NOT NULL,
	"os_id" uuid NOT NULL,
	"apr_id" uuid NOT NULL,
	"executor_id" uuid NOT NULL,
	"numero_pessoas" integer NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"resultado" text,
	"descricao_atividade" text,
	"motivo" text,
	"dados_inspecao" jsonb,
	CONSTRAINT "execucao_resultado_check" CHECK ("execucao"."resultado" in ('encerrada', 'interrompida', 'suspensa', 'cancelada')),
	CONSTRAINT "execucao_numero_pessoas_check" CHECK ("execucao"."numero_pessoas" >= 1),
	CONSTRAINT "execucao_fim_apos_inicio" CHECK ("execucao"."fim" is null or "execucao"."fim" >= "execucao"."inicio"),
	CONSTRAINT "execucao_encerrada_completa" CHECK ("execucao"."resultado" is distinct from 'encerrada' or ("execucao"."fim" is not null and nullif(btrim("execucao"."descricao_atividade"), '') is not null)),
	CONSTRAINT "execucao_interrompida_com_motivo" CHECK ("execucao"."resultado" is distinct from 'interrompida' or ("execucao"."fim" is not null and nullif(btrim("execucao"."motivo"), '') is not null)),
	CONSTRAINT "execucao_suspensa_com_fim" CHECK ("execucao"."resultado" is distinct from 'suspensa' or "execucao"."fim" is not null)
);
--> statement-breakpoint
ALTER TABLE "execucao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "execucao_assinatura" (
	"execucao_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"assinatura_path" text NOT NULL,
	"assinada_em" timestamp with time zone NOT NULL,
	CONSTRAINT "execucao_assinatura_pkey" PRIMARY KEY("execucao_id","usuario_id")
);
--> statement-breakpoint
ALTER TABLE "execucao_assinatura" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "execucao_pausa" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execucao_id" uuid NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"motivo" text,
	CONSTRAINT "execucao_pausa_motivo_check" CHECK ("execucao_pausa"."motivo" in ('almoco', 'descanso', 'outro')),
	CONSTRAINT "execucao_pausa_fim_apos_inicio" CHECK ("execucao_pausa"."fim" is null or "execucao_pausa"."fim" >= "execucao_pausa"."inicio")
);
--> statement-breakpoint
ALTER TABLE "execucao_pausa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evento_campo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"os_id" uuid,
	"payload" jsonb NOT NULL,
	"ocorrido_em" timestamp with time zone NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_campo_tipo_check" CHECK ("evento_campo"."tipo" in ('apr_concluida', 'execucao_iniciada', 'pausa_iniciada', 'pausa_encerrada', 'execucao_encerrada', 'execucao_interrompida', 'execucao_suspensa', 'execucao_cancelada'))
);
--> statement-breakpoint
ALTER TABLE "evento_campo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "alerta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"os_id" uuid NOT NULL,
	"destinatario_id" uuid NOT NULL,
	"detalhe" text NOT NULL,
	"email_enviado_em" timestamp with time zone,
	"lido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alerta_tipo_check" CHECK ("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado'))
);
--> statement-breakpoint
ALTER TABLE "alerta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reprogramacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"data_anterior" date NOT NULL,
	"data_nova" date NOT NULL,
	"equipe_anterior_id" uuid,
	"equipe_nova_id" uuid,
	"justificativa" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reprogramacao_justificativa_check" CHECK (nullif(btrim("reprogramacao"."justificativa"), '') is not null)
);
--> statement-breakpoint
ALTER TABLE "reprogramacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_supervisor_id_usuario_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_modelo_apr" ADD CONSTRAINT "item_modelo_apr_modelo_apr_id_modelo_apr_id_fk" FOREIGN KEY ("modelo_apr_id") REFERENCES "public"."modelo_apr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_modelo_apr" ADD CONSTRAINT "item_modelo_apr_risco_id_risco_modelo_apr_id_fk" FOREIGN KEY ("risco_id") REFERENCES "public"."risco_modelo_apr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risco_modelo_apr" ADD CONSTRAINT "risco_modelo_apr_modelo_apr_id_modelo_apr_id_fk" FOREIGN KEY ("modelo_apr_id") REFERENCES "public"."modelo_apr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_codigo_atividade_atividade_codigo_fk" FOREIGN KEY ("codigo_atividade") REFERENCES "public"."atividade"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_local_instalacao_id_local_instalacao_id_fk" FOREIGN KEY ("local_instalacao_id") REFERENCES "public"."local_instalacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_os_origem_id_os_id_fk" FOREIGN KEY ("os_origem_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_ciencia_por_usuario_id_fk" FOREIGN KEY ("ciencia_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr" ADD CONSTRAINT "apr_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr" ADD CONSTRAINT "apr_modelo_apr_id_modelo_apr_id_fk" FOREIGN KEY ("modelo_apr_id") REFERENCES "public"."modelo_apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr" ADD CONSTRAINT "apr_preenchida_por_usuario_id_fk" FOREIGN KEY ("preenchida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr_participante" ADD CONSTRAINT "apr_participante_apr_id_apr_id_fk" FOREIGN KEY ("apr_id") REFERENCES "public"."apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr_participante" ADD CONSTRAINT "apr_participante_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr_resposta" ADD CONSTRAINT "apr_resposta_apr_id_apr_id_fk" FOREIGN KEY ("apr_id") REFERENCES "public"."apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr_resposta" ADD CONSTRAINT "apr_resposta_item_id_item_modelo_apr_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item_modelo_apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr_risco" ADD CONSTRAINT "apr_risco_apr_id_apr_id_fk" FOREIGN KEY ("apr_id") REFERENCES "public"."apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr_risco" ADD CONSTRAINT "apr_risco_risco_id_risco_modelo_apr_id_fk" FOREIGN KEY ("risco_id") REFERENCES "public"."risco_modelo_apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_execucao_id_execucao_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_apr_id_apr_id_fk" FOREIGN KEY ("apr_id") REFERENCES "public"."apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_item_id_item_modelo_apr_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item_modelo_apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_resposta_fk" FOREIGN KEY ("apr_id","item_id") REFERENCES "public"."apr_resposta"("apr_id","item_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao" ADD CONSTRAINT "execucao_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao" ADD CONSTRAINT "execucao_apr_id_apr_id_fk" FOREIGN KEY ("apr_id") REFERENCES "public"."apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao" ADD CONSTRAINT "execucao_executor_id_usuario_id_fk" FOREIGN KEY ("executor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao_assinatura" ADD CONSTRAINT "execucao_assinatura_execucao_id_execucao_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao_assinatura" ADD CONSTRAINT "execucao_assinatura_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao_pausa" ADD CONSTRAINT "execucao_pausa_execucao_id_execucao_id_fk" FOREIGN KEY ("execucao_id") REFERENCES "public"."execucao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_campo" ADD CONSTRAINT "evento_campo_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_campo" ADD CONSTRAINT "evento_campo_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_destinatario_id_usuario_id_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprogramacao" ADD CONSTRAINT "reprogramacao_os_id_os_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."os"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprogramacao" ADD CONSTRAINT "reprogramacao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprogramacao" ADD CONSTRAINT "reprogramacao_equipe_anterior_id_equipe_id_fk" FOREIGN KEY ("equipe_anterior_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprogramacao" ADD CONSTRAINT "reprogramacao_equipe_nova_id_equipe_id_fk" FOREIGN KEY ("equipe_nova_id") REFERENCES "public"."equipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tarefa_pendentes_idx" ON "tarefa" USING btree ("proxima_em") WHERE "tarefa"."estado" = 'pendente';--> statement-breakpoint
CREATE INDEX "tarefa_referencia_idx" ON "tarefa" USING btree ("tipo","referencia_id");--> statement-breakpoint
CREATE INDEX "equipe_supervisor_idx" ON "equipe" USING btree ("supervisor_id");--> statement-breakpoint
CREATE INDEX "usuario_equipe_idx" ON "usuario" USING btree ("equipe_id") WHERE "usuario"."ativo";--> statement-breakpoint
CREATE INDEX "usuario_perfil_idx" ON "usuario" USING btree ("perfil") WHERE "usuario"."ativo";--> statement-breakpoint
CREATE INDEX "atividade_sem_modelo_idx" ON "atividade" USING btree ("codigo") WHERE "atividade"."modelo_apr_codigo" is null;--> statement-breakpoint
CREATE INDEX "item_modelo_apr_risco_idx" ON "item_modelo_apr" USING btree ("risco_id") WHERE "item_modelo_apr"."risco_id" is not null;--> statement-breakpoint
CREATE INDEX "importacao_criada_idx" ON "importacao" USING btree ("criada_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "os_equipe_status_idx" ON "os" USING btree ("equipe_id","status");--> statement-breakpoint
CREATE INDEX "os_local_idx" ON "os" USING btree ("local_instalacao_id");--> statement-breakpoint
CREATE INDEX "os_atualizada_idx" ON "os" USING btree ("atualizada_em");--> statement-breakpoint
CREATE INDEX "os_equipamento_idx" ON "os" USING btree ("equipamento");--> statement-breakpoint
CREATE INDEX "os_data_inicio_idx" ON "os" USING btree ("data_inicio_prog");--> statement-breakpoint
CREATE INDEX "os_atividade_idx" ON "os" USING btree ("codigo_atividade");--> statement-breakpoint
CREATE INDEX "os_origem_idx" ON "os" USING btree ("os_origem_id") WHERE "os"."os_origem_id" is not null;--> statement-breakpoint
CREATE INDEX "os_a_exportar_idx" ON "os" USING btree ("id") WHERE "os"."status" = 'encerrada' and "os"."exportada_sap_em" is null;--> statement-breakpoint
CREATE INDEX "apr_os_idx" ON "apr" USING btree ("os_id","concluida_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "apr_preenchida_por_idx" ON "apr" USING btree ("preenchida_por");--> statement-breakpoint
CREATE INDEX "apr_modelo_idx" ON "apr" USING btree ("modelo_apr_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apr_um_responsavel_idx" ON "apr_participante" USING btree ("apr_id") WHERE "apr_participante"."funcao" = 'responsavel';--> statement-breakpoint
CREATE INDEX "apr_participante_usuario_idx" ON "apr_participante" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "apr_resposta_item_idx" ON "apr_resposta" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "apr_risco_risco_idx" ON "apr_risco" USING btree ("risco_id");--> statement-breakpoint
CREATE INDEX "evidencia_execucao_idx" ON "evidencia" USING btree ("execucao_id") WHERE "evidencia"."execucao_id" is not null;--> statement-breakpoint
CREATE INDEX "evidencia_apr_idx" ON "evidencia" USING btree ("apr_id","item_id") WHERE "evidencia"."apr_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "execucao_apr_unica_idx" ON "execucao" USING btree ("apr_id") WHERE "execucao"."resultado" is distinct from 'cancelada';--> statement-breakpoint
CREATE INDEX "execucao_os_idx" ON "execucao" USING btree ("os_id");--> statement-breakpoint
CREATE INDEX "execucao_executor_idx" ON "execucao" USING btree ("executor_id","inicio" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "execucao_abertas_idx" ON "execucao" USING btree ("inicio") WHERE "execucao"."resultado" is null;--> statement-breakpoint
CREATE INDEX "execucao_pausa_execucao_idx" ON "execucao_pausa" USING btree ("execucao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "execucao_pausa_unica_aberta_idx" ON "execucao_pausa" USING btree ("execucao_id") WHERE "execucao_pausa"."fim" is null;--> statement-breakpoint
CREATE INDEX "evento_campo_os_idx" ON "evento_campo" USING btree ("os_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "evento_campo_usuario_idx" ON "evento_campo" USING btree ("usuario_id","recebido_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "alerta_destinatario_idx" ON "alerta" USING btree ("destinatario_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "alerta_nao_lidos_idx" ON "alerta" USING btree ("destinatario_id") WHERE "alerta"."lido_em" is null;--> statement-breakpoint
CREATE INDEX "alerta_os_idx" ON "alerta" USING btree ("os_id");--> statement-breakpoint
CREATE INDEX "reprogramacao_os_idx" ON "reprogramacao" USING btree ("os_id","criada_em" DESC NULLS LAST);
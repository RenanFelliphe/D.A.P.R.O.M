CREATE TABLE "vitoria_pergunta_sem_resposta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pergunta" text NOT NULL,
	"tela" text NOT NULL,
	"perfil" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"tratada_em" timestamp with time zone,
	"tratada_por" uuid,
	CONSTRAINT "vitoria_pergunta_sem_resposta_pergunta_preenchida" CHECK (btrim("vitoria_pergunta_sem_resposta"."pergunta") <> ''),
	CONSTRAINT "vitoria_pergunta_sem_resposta_perfil_check" CHECK ("vitoria_pergunta_sem_resposta"."perfil" in ('tecnico', 'admin')),
	CONSTRAINT "vitoria_pergunta_sem_resposta_tratamento" CHECK (("vitoria_pergunta_sem_resposta"."tratada_em" is null) = ("vitoria_pergunta_sem_resposta"."tratada_por" is null))
);
--> statement-breakpoint
ALTER TABLE "vitoria_pergunta_sem_resposta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vitoria_uso" (
	"usuario_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"mensagens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vitoria_uso_pkey" PRIMARY KEY("usuario_id","dia"),
	CONSTRAINT "vitoria_uso_mensagens_check" CHECK ("vitoria_uso"."mensagens" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vitoria_uso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vitoria_pergunta_sem_resposta" ADD CONSTRAINT "vitoria_pergunta_sem_resposta_tratada_por_usuario_id_fk" FOREIGN KEY ("tratada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitoria_uso" ADD CONSTRAINT "vitoria_uso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vitoria_pergunta_sem_resposta_pendentes_idx" ON "vitoria_pergunta_sem_resposta" USING btree ("criada_em") WHERE "vitoria_pergunta_sem_resposta"."tratada_em" is null;--> statement-breakpoint
CREATE INDEX "vitoria_uso_dia_idx" ON "vitoria_uso" USING btree ("dia");
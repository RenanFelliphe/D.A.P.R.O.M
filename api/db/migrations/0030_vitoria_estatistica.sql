CREATE TABLE "vitoria_estatistica" (
	"dia" date PRIMARY KEY NOT NULL,
	"respondidas" integer DEFAULT 0 NOT NULL,
	"nao_sei" integer DEFAULT 0 NOT NULL,
	"com_acao" integer DEFAULT 0 NOT NULL,
	"idas_a_tela" integer DEFAULT 0 NOT NULL,
	"respostas_com_ia" integer DEFAULT 0 NOT NULL,
	"tempo_ia_ms" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "vitoria_estatistica_nao_negativos" CHECK ("vitoria_estatistica"."respondidas" >= 0 and "vitoria_estatistica"."nao_sei" >= 0 and "vitoria_estatistica"."com_acao" >= 0 and "vitoria_estatistica"."idas_a_tela" >= 0 and "vitoria_estatistica"."respostas_com_ia" >= 0 and "vitoria_estatistica"."tempo_ia_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vitoria_estatistica" ENABLE ROW LEVEL SECURITY;
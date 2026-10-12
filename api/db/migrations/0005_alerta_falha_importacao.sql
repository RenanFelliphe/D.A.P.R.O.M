-- Falha de importação vira alerta no sino: a sincronização com a API ou a planilha que falha não mexe em nenhuma OS e
-- avisa quem a iniciou. Esse alerta aponta para o registro da importação (`importacao_id`), não para uma OS; os demais
-- tipos continuam exigindo a OS.
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_tipo_check";--> statement-breakpoint
ALTER TABLE "alerta" ALTER COLUMN "os_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alerta" ADD COLUMN "importacao_id" uuid;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_alvo" CHECK (("alerta"."tipo" = 'falha_importacao' and "alerta"."importacao_id" is not null and "alerta"."os_id" is null) or ("alerta"."tipo" <> 'falha_importacao' and "alerta"."os_id" is not null and "alerta"."importacao_id" is null));--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_tipo_check" CHECK ("alerta"."tipo" in ('bloqueio', 'conflito_planejamento', 'execucao_duplicada', 'apoio_encerrado', 'falha_importacao'));
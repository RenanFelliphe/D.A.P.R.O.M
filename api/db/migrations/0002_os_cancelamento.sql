ALTER TABLE "os" ADD COLUMN "cancelada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "cancelada_por" uuid;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "justificativa_cancelamento" text;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_cancelada_por_usuario_id_fk" FOREIGN KEY ("cancelada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_cancelamento_justificado" CHECK ("os"."cancelada_por" is null or ("os"."cancelada_em" is not null and nullif(btrim("os"."justificativa_cancelamento"), '') is not null));
ALTER TABLE "os" DROP CONSTRAINT "os_status_check";--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "responsavel_id" uuid;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "reservada_por" uuid;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "reservada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "devolvida_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "devolvida_por" uuid;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "justificativa_devolucao" text;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "devolucao_exportada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_reservada_por_usuario_id_fk" FOREIGN KEY ("reservada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_devolvida_por_usuario_id_fk" FOREIGN KEY ("devolvida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "os_devolvida_a_exportar_idx" ON "os" USING btree ("id") WHERE "os"."status" = 'devolvida' and "os"."devolucao_exportada_em" is null;--> statement-breakpoint
CREATE INDEX "os_responsavel_idx" ON "os" USING btree ("responsavel_id") WHERE "os"."responsavel_id" is not null;--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_reserva_completa" CHECK (("os"."responsavel_id" is null) = ("os"."reservada_por" is null) and ("os"."responsavel_id" is null) = ("os"."reservada_em" is null));--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_devolucao_justificada" CHECK (("os"."devolvida_por" is null) = ("os"."devolvida_em" is null) and ("os"."devolvida_por" is null or nullif(btrim("os"."justificativa_devolucao"), '') is not null));--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_devolvida_registrada" CHECK ("os"."status" <> 'devolvida' or "os"."devolvida_em" is not null);--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_status_check" CHECK ("os"."status" in ('liberada', 'pendente', 'em_execucao', 'encerrada', 'cancelada', 'devolvida'));
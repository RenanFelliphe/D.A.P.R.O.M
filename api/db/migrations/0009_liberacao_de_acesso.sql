ALTER TABLE "usuario" ADD COLUMN "liberacao" text DEFAULT 'liberado' NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "criado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "liberado_por_id" uuid;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "liberado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "recusa_motivo" text;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_criado_por_id_usuario_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_liberado_por_id_usuario_id_fk" FOREIGN KEY ("liberado_por_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usuario_liberacao_pendente_idx" ON "usuario" USING btree ("liberacao") WHERE "usuario"."liberacao" = 'pendente';--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_liberacao_check" CHECK ("usuario"."liberacao" in ('liberado', 'pendente', 'recusado'));
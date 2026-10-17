ALTER TABLE "usuario" ADD COLUMN "liberacao_assinatura_path" text;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "ciencia_assinatura_path" text;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "cancelada_assinatura_path" text;--> statement-breakpoint
ALTER TABLE "os" ADD COLUMN "devolvida_assinatura_path" text;--> statement-breakpoint
ALTER TABLE "execucao" ADD COLUMN "assinatura_do_resultado_path" text;--> statement-breakpoint
ALTER TABLE "reprogramacao" ADD COLUMN "assinatura_path" text;
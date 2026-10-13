-- O PDF da OS impressa pelo SAP vira mais uma forma de a OS entrar (Importação de OS, cartão Arquivo): origem `pdf` na OS
-- e no registro da importação. Só amplia a lista: nenhuma linha muda.
ALTER TABLE "importacao" DROP CONSTRAINT "importacao_origem_check";--> statement-breakpoint
ALTER TABLE "os" DROP CONSTRAINT "os_origem_check";--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_origem_check" CHECK ("importacao"."origem" in ('api', 'planilha', 'pdf'));--> statement-breakpoint
ALTER TABLE "os" ADD CONSTRAINT "os_origem_check" CHECK ("os"."origem" in ('sap', 'planilha', 'pdf', 'apoio'));
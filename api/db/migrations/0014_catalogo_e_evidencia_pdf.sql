-- Catálogo de serviço (materiais, ferramentas e EPIs de cada atividade) e evidência em PDF: `evidencia.tipo` (`foto` ou
-- `pdf`) e `nome_arquivo`, `pdf` na evidência que o item do modelo exige e `material` na auditoria. As linhas que já
-- existem viram `foto`; nenhuma outra muda.
CREATE TABLE "atividade_material" (
	"atividade_codigo" text NOT NULL,
	"material_id" uuid NOT NULL,
	"quantidade" numeric(12, 3),
	"observacao" text,
	"ordem" integer NOT NULL,
	CONSTRAINT "atividade_material_pkey" PRIMARY KEY("atividade_codigo","material_id"),
	CONSTRAINT "atividade_material_atividade_codigo_ordem_key" UNIQUE("atividade_codigo","ordem"),
	CONSTRAINT "atividade_material_quantidade_check" CHECK ("atividade_material"."quantidade" is null or "atividade_material"."quantidade" > 0)
);
--> statement-breakpoint
ALTER TABLE "atividade_material" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "material" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text,
	"descricao" text NOT NULL,
	"unidade" text NOT NULL,
	"categoria" text DEFAULT 'material' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "material_categoria_check" CHECK ("material"."categoria" in ('material', 'ferramenta', 'epi')),
	CONSTRAINT "material_descricao_preenchida" CHECK (btrim("material"."descricao") <> ''),
	CONSTRAINT "material_unidade_preenchida" CHECK (btrim("material"."unidade") <> '')
);
--> statement-breakpoint
ALTER TABLE "material" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_entidade_check";--> statement-breakpoint
ALTER TABLE "item_modelo_apr" DROP CONSTRAINT "item_modelo_apr_evidencia_check";--> statement-breakpoint
ALTER TABLE "evidencia" ADD COLUMN "tipo" text DEFAULT 'foto' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidencia" ADD COLUMN "nome_arquivo" text;--> statement-breakpoint
ALTER TABLE "atividade_material" ADD CONSTRAINT "atividade_material_atividade_codigo_atividade_codigo_fk" FOREIGN KEY ("atividade_codigo") REFERENCES "public"."atividade"("codigo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_material" ADD CONSTRAINT "atividade_material_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atividade_material_material_idx" ON "atividade_material" USING btree ("material_id");--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_entidade_check" CHECK ("auditoria"."entidade" in ('usuario', 'equipe', 'modelo_apr', 'atividade', 'material', 'os', 'importacao', 'exportacao'));--> statement-breakpoint
ALTER TABLE "item_modelo_apr" ADD CONSTRAINT "item_modelo_apr_evidencia_check" CHECK ("item_modelo_apr"."evidencia" in ('foto', 'texto', 'pdf'));--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_tipo_check" CHECK ("evidencia"."tipo" in ('foto', 'pdf'));--> statement-breakpoint
ALTER TABLE "evidencia" ADD CONSTRAINT "evidencia_nome_so_no_pdf" CHECK ("evidencia"."nome_arquivo" is null or "evidencia"."tipo" = 'pdf');
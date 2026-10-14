-- Conferência dos materiais do serviço na APR: `atividade_material.obrigatorio` (o item que exige a foto de comprovação)
-- e `apr_material` (o que o técnico disse que levou e a foto dele, por APR). As linhas que já existem ficam como estão:
-- nenhum item vira obrigatório sozinho.
CREATE TABLE "apr_material" (
	"apr_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"obrigatorio" boolean NOT NULL,
	"levou" boolean NOT NULL,
	"foto_path" text,
	"capturada_em" timestamp with time zone,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	CONSTRAINT "apr_material_pkey" PRIMARY KEY("apr_id","material_id"),
	CONSTRAINT "apr_material_foto_so_se_levou" CHECK ("apr_material"."levou" or "apr_material"."foto_path" is null),
	CONSTRAINT "apr_material_foto_completa" CHECK (("apr_material"."foto_path" is null) = ("apr_material"."capturada_em" is null)),
	CONSTRAINT "apr_material_gps_completo" CHECK (("apr_material"."latitude" is null) = ("apr_material"."longitude" is null)),
	CONSTRAINT "apr_material_latitude_check" CHECK ("apr_material"."latitude" between -90 and 90),
	CONSTRAINT "apr_material_longitude_check" CHECK ("apr_material"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "apr_material" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "atividade_material" ADD COLUMN "obrigatorio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "apr_material" ADD CONSTRAINT "apr_material_apr_id_apr_id_fk" FOREIGN KEY ("apr_id") REFERENCES "public"."apr"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apr_material" ADD CONSTRAINT "apr_material_material_id_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."material"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apr_material_material_idx" ON "apr_material" USING btree ("material_id");
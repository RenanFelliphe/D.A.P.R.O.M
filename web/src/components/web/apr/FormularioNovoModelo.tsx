"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { z } from "zod";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { Panel } from "@/components/web/Panel";
import { ajudaParticipantesComAssinatura, rotuloParticipantesComAssinatura } from "@/data/modelos";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { dataOpcional, inteiroEntre } from "@/lib/validacao";
import { useToast } from "@/state/toast";

const limparCodigo = (codigo: string) => codigo.trim().replace(/s+/g, " ");

/** O código tem de ser livre: o repetido (ou o excluído, que só volta restaurado) e o reservado "NOVO" não passam. */
function esquemaDoModelo(existentes: FormularioNovoModeloProps["existentes"]) {
  return z.object({
    codigo: z
      .string()
      .max(40, "O código pode ter até 40 caracteres.")
      .superRefine((valor, ctx) => {
        const limpo = limparCodigo(valor);
        if (!limpo) return ctx.addIssue({ code: "custom", message: "Informe o código do modelo, como APR 10." });
        const repetido = existentes.find((e) => e.codigo.toLowerCase() === limpo.toLowerCase());
        if (repetido) {
          return ctx.addIssue({
            code: "custom",
            message: repetido.excluido
              ? `O ${repetido.codigo} foi excluído. Restaure-o na aba Modelos em vez de criar outro.`
              : `Já existe o ${repetido.codigo}. Para mudá-lo, abra o modelo e crie uma nova versão.`,
          });
        }
        if (limpo.toLowerCase() === "novo") ctx.addIssue({ code: "custom", message: "Escolha outro código." });
      }),
    versao: inteiroEntre(1, 999, "Informe a versão, um número inteiro de 1 a 999."),
    titulo: z.string().trim().min(1, "Informe o título do modelo."),
    dataDocumento: dataOpcional,
    copiarDe: z.string(),
    comAssinatura: z.boolean(),
  });
}

interface FormularioNovoModeloProps {
  /** Próximo código livre no padrão dos documentos (`APR 10`). */
  sugestao: string;
  /** Códigos já usados, com a situação de cada um (o excluído só volta restaurado). */
  existentes: { codigo: string; excluido: boolean }[];
  /** Modelos publicados que servem de ponto de partida. */
  modelos: { codigo: string; titulo: string }[];
}

/**
 * Cadastro de um modelo novo (`POST /modelos-apr/{codigo}/versoes`): código, título, a revisão e a data do documento
 * em papel, e o ponto de partida (em branco ou copiando outro modelo). Nasce como rascunho e abre no editor.
 */
export function FormularioNovoModelo({ sugestao, existentes, modelos }: FormularioNovoModeloProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const esquema = useMemo(() => esquemaDoModelo(existentes), [existentes]);
  // O modelo novo em branco começa com a coluna Assinatura; ao copiar outro modelo, a folha segue a dele.
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { codigo: sugestao, versao: "1", titulo: "", dataDocumento: "", copiarDe: "", comAssinatura: true });
  const { register, formState } = form;
  const erros = formState.errors;
  const [copiarDe] = useValorDoForm(form, "copiarDe");

  return (
    <form
      ref={ref}
      noValidate
      onSubmit={enviar(async (v) => {
        const codigo = limparCodigo(v.codigo).toUpperCase();
        const base = { titulo: v.titulo.trim(), versao: Number(v.versao), data_documento: v.dataDocumento || null };
        await chamar("POST", `/modelos-apr/${encodeURIComponent(codigo)}/versoes`, v.copiarDe ? { ...base, copiar_de: v.copiarDe } : { ...base, participantes_com_assinatura: v.comAssinatura, riscos: [], itens: [] });
        exibirAviso(`Rascunho do ${codigo} criado. Ajuste os itens e publique.`);
        router.push(rotas.web.modelo(codigo));
        router.refresh();
      })}
    >
      <Panel style={{ padding: "20px 22px", gap: 16, maxWidth: 760 }}>
        <div className="grade2">
          <Field label="Código" htmlFor="nm-codigo" erro={erros.codigo?.message}>
            <input className="input mono" maxLength={40} style={{ textTransform: "uppercase" }} disabled={enviando} {...register("codigo")} {...ligarAoErro("nm-codigo", erros.codigo?.message)} />
            <span className="small">Como no documento em papel: APR 01, APR 02…</span>
          </Field>
          <Field label="Primeira versão (revisão do documento)" htmlFor="nm-versao" erro={erros.versao?.message}>
            <input className="input" type="number" disabled={enviando} {...register("versao")} {...ligarAoErro("nm-versao", erros.versao?.message)} />
            <span className="small">O &quot;REV 03&quot; do papel vira a versão 3.</span>
          </Field>
        </div>
        <Field label="Título" htmlFor="nm-titulo" erro={erros.titulo?.message}>
          <input className="input" placeholder="ESPAÇO CONFINADO E/OU TRABALHO EM ALTURA" disabled={enviando} {...register("titulo")} {...ligarAoErro("nm-titulo", erros.titulo?.message)} />
        </Field>
        <div className="grade2">
          <Field label="Data do documento" htmlFor="nm-data" erro={erros.dataDocumento?.message}>
            <input className="input" type="date" disabled={enviando} {...register("dataDocumento")} {...ligarAoErro("nm-data", erros.dataDocumento?.message)} />
          </Field>
          <Field label="Ponto de partida" htmlFor="nm-base">
            <select id="nm-base" className="select" disabled={enviando} {...register("copiarDe")}>
              <option value="">Em branco</option>
              {modelos.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {`Copiar do ${m.codigo} — ${m.titulo}`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {copiarDe ? (
          <span className="small">A coluna Assinatura da tabela de participantes segue o modelo copiado; ajuste no editor, se precisar.</span>
        ) : (
          <div className="stack g4">
            <label className="row g8" style={{ alignItems: "center" }}>
              <input type="checkbox" disabled={enviando} {...register("comAssinatura")} />
              {rotuloParticipantesComAssinatura}
            </label>
            <span className="small">{ajudaParticipantesComAssinatura}</span>
          </div>
        )}
        <Notice tone="info" icon="info">
          {copiarDe
            ? `O rascunho começa com os itens, riscos, medidas e o PAE da versão em uso do ${copiarDe}; o ${copiarDe} não muda.`
            : "O rascunho começa vazio: os itens de verificação, os riscos e as medidas são adicionados no editor."}{" "}
          O técnico só vê o modelo depois de publicado. Escreva a orientação na tela do modelo: é com ela que o técnico escolhe e que o sistema o recomenda.
        </Notice>
        <ErroDeEnvio mensagem={erroEnvio} />
        <div className="row g8" style={{ justifyContent: "flex-end" }}>
          <LinkButton variant="line" sm href={rotas.web.modelos}>
            Cancelar
          </LinkButton>
          <Button variant="p" sm type="submit" aria-busy={enviando} disabled={enviando}>
            {enviando ? "Criando…" : "Criar rascunho"}
          </Button>
        </div>
      </Panel>
    </form>
  );
}

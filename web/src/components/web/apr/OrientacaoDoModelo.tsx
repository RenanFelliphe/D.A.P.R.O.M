"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { Panel } from "@/components/web/Panel";
import type { OrientacaoDoModelo as Orientacao } from "@/data/modelos";
import { chamar } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import { useToast } from "@/state/toast";

/** Limites da `api` (`PUT /modelos-apr/{codigo}/orientacao`). */
const MAX_DESCRICAO = 1000;
const MAX_EXEMPLOS = 20;
const MAX_PALAVRAS = 80;
const MAX_LINHA = 200;

/** Um texto por linha, sem espaços nas pontas nem linhas vazias (a `api` tira também as repetidas). */
const linhas = (texto: string) =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Uma lista de linhas (exemplos, palavras-chave) com os limites da `api`: quantidade e tamanho de cada linha. */
function listaDeLinhas(maximo: number, nome: string) {
  return z.string().superRefine((texto, ctx) => {
    const itens = linhas(texto);
    if (itens.length > maximo) ctx.addIssue({ code: "custom", message: `Use no máximo ${maximo} ${nome}.` });
    else if (itens.some((l) => l.length > MAX_LINHA)) ctx.addIssue({ code: "custom", message: `Cada linha pode ter até ${MAX_LINHA} caracteres.` });
  });
}

const esquema = z.object({
  descricao: z.string().trim().max(MAX_DESCRICAO, `A descrição pode ter até ${MAX_DESCRICAO} caracteres.`),
  exemplos: listaDeLinhas(MAX_EXEMPLOS, "exemplos"),
  palavras: listaDeLinhas(MAX_PALAVRAS, "palavras-chave"),
});

interface OrientacaoDoModeloProps {
  codigo: string;
  orientacao: Orientacao;
  /** Administrador, num modelo não excluído: edita no lugar. */
  podeEditar: boolean;
}

/**
 * Orientação para o técnico: a descrição dos serviços que o modelo atende, exemplos e as palavras-chave com que o sistema lê
 * a OS e recomenda um modelo. Todos leem; o admin edita (`PUT /modelos-apr/{codigo}/orientacao`), e vale na hora, para todas
 * as versões, sem publicar.
 */
export function OrientacaoDoModelo({ codigo, orientacao, podeEditar }: OrientacaoDoModeloProps) {
  const exibirAviso = useToast();
  const [salva, setSalva] = useState(orientacao);
  const [editando, setEditando] = useState(false);
  const valoresDe = (o: Orientacao) => ({ descricao: o.descricao, exemplos: o.exemplos.join("\n"), palavras: o.palavras_chave.join("\n") });
  const { form, ref, enviar, enviando: ocupado, erroEnvio, limparErroEnvio } = useFormulario(esquema, valoresDe(orientacao));
  const { register, formState } = form;
  const erros = formState.errors;
  const [descricao] = useValorDoForm(form, "descricao");
  const [exemplos] = useValorDoForm(form, "exemplos");
  const [palavras] = useValorDoForm(form, "palavras");
  const listaDeExemplos = linhas(exemplos);
  const listaDePalavras = linhas(palavras);
  const vazia = !salva.descricao && salva.exemplos.length === 0 && salva.palavras_chave.length === 0;

  function abrir() {
    form.reset(valoresDe(salva));
    limparErroEnvio();
    setEditando(true);
  }

  const salvar = enviar(async (v) => {
    const nova = await chamar<Orientacao>("PUT", `/modelos-apr/${encodeURIComponent(codigo)}/orientacao`, {
      descricao: v.descricao.trim(),
      exemplos: linhas(v.exemplos),
      palavras_chave: linhas(v.palavras),
    });
    setSalva(nova);
    setEditando(false);
    exibirAviso(`Orientação do ${codigo} salva. Já vale para as APRs novas, em todas as versões.`);
  });

  return (
    <Panel style={{ padding: "20px 22px", gap: 14 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g4">
          <h2 style={{ fontSize: 15 }}>Orientação para o técnico</h2>
          <span className="small">
            É o que o técnico vê ao escolher o modelo da APR e o que o sistema usa para recomendar um.
            {editando ? " Vale na hora, para todas as versões, sem publicar." : ""}
          </span>
        </div>
        {podeEditar && !editando && (
          <Button variant="line" sm style={{ height: 32 }} onClick={abrir}>
            {vazia ? "Escrever orientação" : "Editar orientação"}
          </Button>
        )}
      </div>

      {editando ? (
        <form ref={ref} noValidate onSubmit={salvar} className="stack g12">
          <Field label={`Descrição dos serviços que o modelo atende · ${descricao.length} de ${MAX_DESCRICAO}`} htmlFor="orientacao-descricao" erro={erros.descricao?.message}>
            <textarea
              className="textarea"
              rows={3}
              maxLength={MAX_DESCRICAO}
              {...register("descricao")}
              {...ligarAoErro("orientacao-descricao", erros.descricao?.message)}
              placeholder="Serviços em válvulas de segurança e alívio: calibração, teste e troca."
            />
          </Field>
          <div className="grade2">
            <Field label={`Exemplos de serviço (um por linha) · ${listaDeExemplos.length} de ${MAX_EXEMPLOS}`} htmlFor="orientacao-exemplos" erro={erros.exemplos?.message}>
              <textarea className="textarea" rows={6} {...register("exemplos")} {...ligarAoErro("orientacao-exemplos", erros.exemplos?.message)} placeholder="Calibração de PSV" />
            </Field>
            <Field label={`Palavras-chave (uma por linha) · ${listaDePalavras.length} de ${MAX_PALAVRAS}`} htmlFor="orientacao-palavras" erro={erros.palavras?.message}>
              <textarea className="textarea" rows={6} {...register("palavras")} {...ligarAoErro("orientacao-palavras", erros.palavras?.message)} placeholder={"calibr\nPSV\nválvula de segurança"} />
            </Field>
          </div>
          <span className="small muted">
            Palavras-chave valem sem acento nem maiúsculas. Com 4 letras ou mais, valem também como começo de palavra (“calibr” acha “calibração”); as
            curtas, só a palavra inteira (“PSV”, “tê”). Pesos: título da OS 3, serviço do catálogo 2, descrição da OS 1. O modelo com mais pontos é o
            recomendado; empate no topo não recomenda nenhum.
          </span>
          <ErroDeEnvio mensagem={erroEnvio} />
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <Button variant="line" sm onClick={() => setEditando(false)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button variant="p" sm type="submit" aria-busy={ocupado} disabled={ocupado}>
              {ocupado ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      ) : vazia ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          {podeEditar
            ? "Ninguém escreveu a orientação deste modelo ainda: o técnico vê só o título, e o sistema não o recomenda."
            : "Ninguém escreveu a orientação deste modelo ainda."}
        </p>
      ) : (
        <div className="stack g12">
          {salva.descricao && <p style={{ fontSize: 14 }}>{salva.descricao}</p>}
          {salva.exemplos.length > 0 && (
            <section className="stack g6" aria-label="Exemplos de serviço">
              <h3 className="uso-t">Exemplos de serviço</h3>
              <ul className="uso-lista">
                {salva.exemplos.map((exemplo) => (
                  <li key={exemplo}>{exemplo}</li>
                ))}
              </ul>
            </section>
          )}
          {salva.palavras_chave.length > 0 && (
            <section className="stack g6" aria-label="Palavras-chave">
              <h3 className="uso-t">Palavras-chave</h3>
              <div className="row g6 wrap">
                {salva.palavras_chave.map((palavra) => (
                  <span key={palavra} className="pill line">
                    {palavra}
                  </span>
                ))}
              </div>
            </section>
          )}
          {salva.atualizada_em && <span className="small">{`Atualizada em ${dataHora(salva.atualizada_em)}`}</span>}
        </div>
      )}
    </Panel>
  );
}

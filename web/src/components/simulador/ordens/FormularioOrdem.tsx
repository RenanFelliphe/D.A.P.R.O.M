"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, idDoErro, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { dataOpcional, diaExiste } from "@/lib/validacao";
import { useToast } from "@/state/toast";
import { efeitoDaEdicao, type CatalogoDeOrdens, type Ordem } from "./tipos";

const vazioParaNulo = (v: string) => v.trim() || null;
const LIVRE = "__livre__";

/** As regras da `api` (`esquemaOrdem`): número, título, centro de trabalho, local e início programado são obrigatórios; o fim não pode vir antes do início. */
const esquema = z
  .object({
    numero: z.string().trim().min(1, "Informe o número da ordem."),
    nota: z.string(),
    tipo: z.enum(["YBA1", "YBA2"], "Escolha o tipo da ordem."),
    tipoAtividade: z.string(),
    titulo: z.string().trim().min(1, "Informe o título da ordem."),
    descricao: z.string(),
    centro: z.string().trim().min(1, "Escolha o centro de trabalho."),
    atividadeEscolhida: z.string(),
    atividade: z.string(),
    localEscolhido: z.string(),
    localCodigo: z.string().trim().min(1, "Informe o código do local de instalação."),
    localEndereco: z.string(),
    localPlusCode: z.string(),
    localCliente: z.string(),
    equipamento: z.string(),
    prioridade: z.string(),
    inicio: z.string().min(1, "Informe o início programado.").refine(diaExiste, "Informe uma data válida."),
    fim: dataOpcional,
    status: z.string(),
    solicitante: z.string(),
    criadoPor: z.string(),
    plano: z.string(),
    item: z.string(),
    intervalo: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.atividadeEscolhida === LIVRE && !v.atividade.trim()) ctx.addIssue({ code: "custom", path: ["atividade"], message: "Informe o código da atividade." });
    if (v.fim && diaExiste(v.inicio) && v.fim < v.inicio) ctx.addIssue({ code: "custom", path: ["fim"], message: "O fim programado não pode ser anterior ao início." });
  });

/**
 * Cadastro manual e edição de uma ordem do SAP simulado (`POST` e `PATCH /sap-simulado/gestao/ordens`). O número vem sugerido e não muda
 * depois de criado; o status começa em `LIB IMPR` e aceita as opções prontas ou texto livre; o centro de trabalho e a atividade (as que
 * o SYNQ OS já tem, ou outra digitada) saem de listas, e o local de instalação do catálogo ou digitado. Na edição, avisa o que o SYNQ OS fará.
 */
export function FormularioOrdem({ ordem, catalogo, aoConcluir }: { ordem?: Ordem; catalogo: CatalogoDeOrdens; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const editando = Boolean(ordem);
  const localInicial = ordem?.local_instalacao.codigo ?? catalogo.locais[0]?.codigo ?? "";
  const localDoCatalogo = catalogo.locais.find((l) => l.codigo === localInicial);
  const atividadeInicial = ordem?.codigo_atividade ?? "";
  const { form, ref, enviar, enviando: ocupado, erroEnvio } = useFormulario(esquema, {
    numero: ordem?.numero_ordem ?? catalogo.proximo_numero,
    nota: ordem?.numero_nota ?? "",
    tipo: ordem?.tipo_ordem ?? "YBA1",
    tipoAtividade: ordem?.tipo_atividade ?? "Z01-Manutenção Corretiva",
    titulo: ordem?.titulo ?? "",
    descricao: ordem?.descricao ?? "",
    centro: ordem?.centro_trabalho ?? catalogo.centros_de_trabalho[0]?.centro_trabalho ?? "",
    atividadeEscolhida: atividadeInicial && !catalogo.atividades.some((a) => a.codigo === atividadeInicial) ? LIVRE : atividadeInicial,
    atividade: atividadeInicial,
    localEscolhido: ordem && !localDoCatalogo ? LIVRE : localInicial,
    localCodigo: localInicial,
    localEndereco: ordem?.local_instalacao.endereco ?? localDoCatalogo?.endereco ?? "",
    localPlusCode: ordem?.local_instalacao.plus_code ?? localDoCatalogo?.plus_code ?? "",
    localCliente: ordem?.local_instalacao.cliente ?? localDoCatalogo?.cliente ?? "",
    equipamento: ordem?.equipamento ?? "",
    prioridade: ordem?.prioridade ?? "Médio",
    inicio: ordem?.data_inicio_prog ?? new Date().toISOString().slice(0, 10),
    fim: ordem?.data_fim_prog ?? "",
    status: ordem?.status_sap ?? "LIB IMPR",
    solicitante: ordem?.solicitante ?? "",
    criadoPor: ordem?.criado_por ?? "",
    plano: ordem?.plano_manutencao ?? "",
    item: ordem?.item_manutencao ?? "",
    intervalo: typeof ordem?.intervalo_ciclo === "string" ? ordem.intervalo_ciclo : ordem?.intervalo_ciclo ? `${ordem.intervalo_ciclo.quantidade} ${ordem.intervalo_ciclo.unidade}` : "",
  });
  const { register, formState, getValues, setValue } = form;
  const erros = formState.errors;
  const [tipo] = useValorDoForm(form, "tipo");
  const [centro] = useValorDoForm(form, "centro");
  const [atividadeEscolhida] = useValorDoForm(form, "atividadeEscolhida");
  const [atividade] = useValorDoForm(form, "atividade");
  const [localEscolhido] = useValorDoForm(form, "localEscolhido");
  const [status, definirStatus] = useValorDoForm(form, "status");

  const centroEscolhido = catalogo.centros_de_trabalho.find((c) => c.centro_trabalho === centro);
  const atividadeDoCatalogo = catalogo.atividades.find((a) => a.codigo === atividade);
  const statusPronto = catalogo.status_prontos.some((s) => s.codigo === status);
  const efeito = ordem ? efeitoDaEdicao(ordem.no_synq_os.situacao) : null;

  function escolherLocal(codigo: string) {
    const l = catalogo.locais.find((x) => x.codigo === codigo);
    const novo = codigo === LIVRE ? { localCodigo: "", localEndereco: "", localPlusCode: "", localCliente: "" } : l ? { localCodigo: l.codigo, localEndereco: l.endereco, localPlusCode: l.plus_code, localCliente: l.cliente ?? "" } : null;
    if (!novo) return;
    for (const [campo, valor] of Object.entries(novo)) setValue(campo as keyof typeof novo, valor ?? "", { shouldValidate: Boolean(formState.errors.localCodigo) && campo === "localCodigo" });
  }

  function escolherAtividade(codigo: string) {
    setValue("atividade", codigo === LIVRE ? "" : codigo, { shouldValidate: Boolean(formState.errors.atividade) });
  }

  function trocarTipo(novo: string) {
    const atual = getValues("tipoAtividade");
    if (atual === "Z01-Manutenção Corretiva" || atual === "Z02-Manutenção Preventiva") setValue("tipoAtividade", novo === "YBA1" ? "Z01-Manutenção Corretiva" : "Z02-Manutenção Preventiva");
  }

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        const dados = {
          numero_nota: vazioParaNulo(v.nota),
          tipo_ordem: v.tipo,
          tipo_atividade: vazioParaNulo(v.tipoAtividade),
          codigo_atividade: vazioParaNulo(v.atividade),
          titulo: v.titulo.trim(),
          descricao: vazioParaNulo(v.descricao),
          centro_trabalho: v.centro.trim(),
          local_instalacao: { codigo: v.localCodigo.trim(), endereco: vazioParaNulo(v.localEndereco), plus_code: vazioParaNulo(v.localPlusCode), cliente: vazioParaNulo(v.localCliente) },
          equipamento: vazioParaNulo(v.equipamento),
          prioridade: vazioParaNulo(v.prioridade),
          data_inicio_prog: v.inicio,
          data_fim_prog: vazioParaNulo(v.fim),
          status_sap: vazioParaNulo(v.status),
          solicitante: vazioParaNulo(v.solicitante),
          criado_por: vazioParaNulo(v.criadoPor),
          plano_manutencao: vazioParaNulo(v.plano),
          item_manutencao: vazioParaNulo(v.item),
          intervalo_ciclo: vazioParaNulo(v.intervalo),
        };
        if (ordem) await chamar("PATCH", `/sap-simulado/gestao/ordens/${encodeURIComponent(ordem.numero_ordem)}`, dados);
        else await chamar("POST", "/sap-simulado/gestao/ordens", { ...dados, numero_ordem: v.numero.trim() });
        exibirAviso(editando ? "Ordem atualizada." : "Ordem criada.");
        router.refresh();
        aoConcluir();
      })}
    >
      {efeito && (
        <Notice tone="info" icon="info">
          <b>No SYNQ OS:</b> {efeito}
        </Notice>
      )}
      <div className="grade2">
        <Field label="Número da ordem" htmlFor="ordem-numero" erro={erros.numero?.message}>
          <input
            className="input mono"
            {...register("numero")}
            {...ligarAoErro("ordem-numero", erros.numero?.message)}
            readOnly={editando}
            aria-readonly={editando}
            style={editando ? { background: "var(--surface2)" } : undefined}
            autoComplete="off"
          />
        </Field>
        <Field label="Nota" htmlFor="ordem-nota">
          <input className="input mono" id="ordem-nota" {...register("nota")} autoComplete="off" />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Tipo da ordem" htmlFor="ordem-tipo" erro={erros.tipo?.message}>
          <select className="input" {...register("tipo", { onChange: (e) => trocarTipo(e.target.value) })} {...ligarAoErro("ordem-tipo", erros.tipo?.message)}>
            <option value="YBA1">YBA1 · Corretiva</option>
            <option value="YBA2">YBA2 · Preventiva</option>
          </select>
        </Field>
        <Field label="Tipo de atividade" htmlFor="ordem-tipo-atividade">
          <input className="input" id="ordem-tipo-atividade" {...register("tipoAtividade")} />
        </Field>
      </div>
      <Field label="Título" htmlFor="ordem-titulo" erro={erros.titulo?.message}>
        <input className="input" {...register("titulo")} {...ligarAoErro("ordem-titulo", erros.titulo?.message)} autoComplete="off" />
      </Field>
      <Field label="Descrição (instruções, materiais e ferramentas)" htmlFor="ordem-descricao">
        <textarea className="input" id="ordem-descricao" rows={3} {...register("descricao")} />
      </Field>
      <div className="grade2">
        <Field label="Centro de trabalho" htmlFor="ordem-centro" erro={erros.centro?.message}>
          <select className="input" {...register("centro")} {...ligarAoErro("ordem-centro", erros.centro?.message)}>
            {!centroEscolhido && centro && <option value={centro}>{centro}</option>}
            {catalogo.centros_de_trabalho.map((c) => (
              <option key={c.centro_trabalho} value={c.centro_trabalho}>
                {c.centro_trabalho} · {c.nome}
              </option>
            ))}
          </select>
          {centroEscolhido && !centroEscolhido.equipe_no_synq_os && <span className="small">Este centro não tem equipe no SYNQ OS: a leitura vai ignorar a ordem.</span>}
        </Field>
        <Field label="Atividade" htmlFor="ordem-atividade-escolhida" erro={erros.atividade?.message}>
          <select className="input" id="ordem-atividade-escolhida" {...register("atividadeEscolhida", { onChange: (e) => escolherAtividade(e.target.value) })}>
            <option value="">Sem atividade</option>
            {catalogo.atividades.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.codigo} · {a.descricao}
              </option>
            ))}
            <option value={LIVRE}>Outra (digitar)…</option>
          </select>
          {atividadeEscolhida === LIVRE && <input className="input" aria-label="Código da atividade" placeholder="Código da atividade" {...register("atividade")} {...ligarAoErro("ordem-atividade", erros.atividade?.message)} aria-describedby={erros.atividade ? idDoErro("ordem-atividade-escolhida") : undefined} data-foco-erro />}
          {atividade && !atividadeDoCatalogo && <span className="small">Atividade que o SYNQ OS não conhece: a leitura a cadastra, com o título da ordem como descrição.</span>}
        </Field>
      </div>
      <div className="grade2">
        <Field label="Local de instalação" htmlFor="ordem-local-escolhido" erro={erros.localCodigo?.message}>
          <select className="input" id="ordem-local-escolhido" {...register("localEscolhido", { onChange: (e) => escolherLocal(e.target.value) })}>
            {catalogo.locais.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.codigo}
              </option>
            ))}
            <option value={LIVRE}>Outro (digitar)…</option>
          </select>
          {localEscolhido === LIVRE && <input className="input" aria-label="Código do local" placeholder="Código do local" {...register("localCodigo")} {...ligarAoErro("ordem-local-codigo", erros.localCodigo?.message)} aria-describedby={erros.localCodigo ? idDoErro("ordem-local-escolhido") : undefined} data-foco-erro />}
        </Field>
        <Field label="Cliente" htmlFor="ordem-local-cliente">
          <input className="input" id="ordem-local-cliente" {...register("localCliente")} />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Endereço do local" htmlFor="ordem-local-endereco">
          <input className="input" id="ordem-local-endereco" {...register("localEndereco")} />
        </Field>
        <Field label="Plus code" htmlFor="ordem-local-plus-code">
          <input className="input" id="ordem-local-plus-code" {...register("localPlusCode")} />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Equipamento" htmlFor="ordem-equipamento">
          <input className="input" id="ordem-equipamento" {...register("equipamento")} autoComplete="off" />
        </Field>
        <Field label="Prioridade" htmlFor="ordem-prioridade">
          <input className="input" id="ordem-prioridade" list="prioridades-sap" {...register("prioridade")} />
          <datalist id="prioridades-sap">
            {["Muito alto", "Alto", "Médio", "Baixo"].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grade2">
        <Field label="Início programado" htmlFor="ordem-inicio" erro={erros.inicio?.message}>
          <input className="input" type="date" {...register("inicio")} {...ligarAoErro("ordem-inicio", erros.inicio?.message)} />
        </Field>
        <Field label="Fim programado" htmlFor="ordem-fim" erro={erros.fim?.message}>
          <input className="input" type="date" {...register("fim")} {...ligarAoErro("ordem-fim", erros.fim?.message)} />
        </Field>
      </div>
      <Field label="Status SAP" htmlFor="ordem-status">
        <select className="input" id="ordem-status" value={statusPronto ? status : LIVRE} onChange={(e) => definirStatus(e.target.value === LIVRE ? "" : e.target.value)}>
          {catalogo.status_prontos.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.rotulo} ({s.codigo})
            </option>
          ))}
          <option value={LIVRE}>Outro (texto livre)…</option>
        </select>
        {!statusPronto && <input className="input" aria-label="Status SAP em texto livre" placeholder="Códigos separados por espaço, como LIB IMPR CAPC" {...register("status")} />}
        <span className="small">{(status ?? "").toUpperCase().split(/\s+/).includes("LIB") ? "Com LIB: o SYNQ OS lê a ordem como liberada." : "Sem LIB: o SYNQ OS não cria a OS (e cancela a que já tem)."}</span>
      </Field>
      <div className="grade2">
        <Field label="Solicitante" htmlFor="ordem-solicitante">
          <input className="input" id="ordem-solicitante" {...register("solicitante")} />
        </Field>
        <Field label="Criado por" htmlFor="ordem-criado-por">
          <input className="input" id="ordem-criado-por" {...register("criadoPor")} placeholder="RFAVARO" />
        </Field>
      </div>
      {tipo === "YBA2" && (
        <div className="grade2">
          <Field label="Plano de manutenção" htmlFor="ordem-plano">
            <input className="input mono" id="ordem-plano" {...register("plano")} />
          </Field>
          <Field label="Item de manutenção" htmlFor="ordem-item">
            <input className="input mono" id="ordem-item" {...register("item")} />
          </Field>
          <Field label="Intervalo entre ciclos" htmlFor="ordem-intervalo">
            <input className="input" id="ordem-intervalo" {...register("intervalo")} placeholder="3 MES, trimestral…" />
          </Field>
        </div>
      )}
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" aria-busy={ocupado} disabled={ocupado}>
          {ocupado ? "Salvando…" : editando ? "Salvar" : "Criar ordem"}
        </Button>
      </div>
    </form>
  );
}

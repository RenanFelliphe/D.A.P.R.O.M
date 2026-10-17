"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { efeitoDaEdicao, type CatalogoDeOrdens, type Ordem } from "./tipos";

const vazioParaNulo = (v: string) => v.trim() || null;
const LIVRE = "__livre__";

/**
 * Cadastro manual e edição de uma ordem do SAP simulado (`POST` e `PATCH /sap-simulado/gestao/ordens`). O número vem sugerido e não muda
 * depois de criado; o status começa em `LIB IMPR` e aceita as opções prontas ou texto livre; o centro de trabalho e a atividade (as que
 * o SYNC OS já tem, ou outra digitada) saem de listas, e o local de instalação do catálogo ou digitado. Na edição, avisa o que o SYNC OS fará.
 */
export function FormularioOrdem({ ordem, catalogo, aoConcluir }: { ordem?: Ordem; catalogo: CatalogoDeOrdens; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const editando = Boolean(ordem);
  const [numero, setNumero] = useState(ordem?.numero_ordem ?? catalogo.proximo_numero);
  const [nota, setNota] = useState(ordem?.numero_nota ?? "");
  const [tipo, setTipo] = useState<"YBA1" | "YBA2">(ordem?.tipo_ordem ?? "YBA1");
  const [tipoAtividade, setTipoAtividade] = useState(ordem?.tipo_atividade ?? "Z01-Manutenção Corretiva");
  const [titulo, setTitulo] = useState(ordem?.titulo ?? "");
  const [descricao, setDescricao] = useState(ordem?.descricao ?? "");
  const [centro, setCentro] = useState(ordem?.centro_trabalho ?? catalogo.centros_de_trabalho[0]?.centro_trabalho ?? "");
  const localInicial = ordem?.local_instalacao.codigo ?? catalogo.locais[0]?.codigo ?? "";
  const [localEscolhido, setLocalEscolhido] = useState(ordem && !catalogo.locais.some((l) => l.codigo === localInicial) ? LIVRE : localInicial);
  const [local, setLocal] = useState({
    codigo: localInicial,
    endereco: ordem?.local_instalacao.endereco ?? catalogo.locais.find((l) => l.codigo === localInicial)?.endereco ?? "",
    plus_code: ordem?.local_instalacao.plus_code ?? catalogo.locais.find((l) => l.codigo === localInicial)?.plus_code ?? "",
    cliente: ordem?.local_instalacao.cliente ?? catalogo.locais.find((l) => l.codigo === localInicial)?.cliente ?? "",
  });
  const atividadeInicial = ordem?.codigo_atividade ?? "";
  const [atividadeEscolhida, setAtividadeEscolhida] = useState(atividadeInicial && !catalogo.atividades.some((a) => a.codigo === atividadeInicial) ? LIVRE : atividadeInicial);
  const [atividade, setAtividade] = useState(atividadeInicial);
  const [equipamento, setEquipamento] = useState(ordem?.equipamento ?? "");
  const [prioridade, setPrioridade] = useState(ordem?.prioridade ?? "Médio");
  const [inicio, setInicio] = useState(ordem?.data_inicio_prog ?? new Date().toISOString().slice(0, 10));
  const [fim, setFim] = useState(ordem?.data_fim_prog ?? "");
  const [status, setStatus] = useState(ordem?.status_sap ?? "LIB IMPR");
  const [solicitante, setSolicitante] = useState(ordem?.solicitante ?? "");
  const [criadoPor, setCriadoPor] = useState(ordem?.criado_por ?? "");
  const [plano, setPlano] = useState(ordem?.plano_manutencao ?? "");
  const [item, setItem] = useState(ordem?.item_manutencao ?? "");
  const [intervalo, setIntervalo] = useState(typeof ordem?.intervalo_ciclo === "string" ? ordem.intervalo_ciclo : ordem?.intervalo_ciclo ? `${ordem.intervalo_ciclo.quantidade} ${ordem.intervalo_ciclo.unidade}` : "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const centroEscolhido = catalogo.centros_de_trabalho.find((c) => c.centro_trabalho === centro);
  const atividadeDoCatalogo = catalogo.atividades.find((a) => a.codigo === atividade);
  const statusPronto = catalogo.status_prontos.some((s) => s.codigo === status);
  const efeito = ordem ? efeitoDaEdicao(ordem.no_sync_os.situacao) : null;

  function escolherLocal(codigo: string) {
    setLocalEscolhido(codigo);
    if (codigo === LIVRE) return setLocal({ codigo: "", endereco: "", plus_code: "", cliente: "" });
    const l = catalogo.locais.find((x) => x.codigo === codigo);
    if (l) setLocal({ codigo: l.codigo, endereco: l.endereco, plus_code: l.plus_code, cliente: l.cliente ?? "" });
  }

  function escolherAtividade(codigo: string) {
    setAtividadeEscolhida(codigo);
    setAtividade(codigo === LIVRE ? "" : codigo);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setOcupado(true);
    const dados = {
      numero_nota: vazioParaNulo(nota),
      tipo_ordem: tipo,
      tipo_atividade: vazioParaNulo(tipoAtividade),
      codigo_atividade: vazioParaNulo(atividade),
      titulo: titulo.trim(),
      descricao: vazioParaNulo(descricao),
      centro_trabalho: centro.trim(),
      local_instalacao: { codigo: local.codigo.trim(), endereco: vazioParaNulo(local.endereco), plus_code: vazioParaNulo(local.plus_code), cliente: vazioParaNulo(local.cliente) },
      equipamento: vazioParaNulo(equipamento),
      prioridade: vazioParaNulo(prioridade),
      data_inicio_prog: inicio,
      data_fim_prog: vazioParaNulo(fim),
      status_sap: vazioParaNulo(status),
      solicitante: vazioParaNulo(solicitante),
      criado_por: vazioParaNulo(criadoPor),
      plano_manutencao: vazioParaNulo(plano),
      item_manutencao: vazioParaNulo(item),
      intervalo_ciclo: vazioParaNulo(intervalo),
    };
    try {
      if (ordem) await chamar("PATCH", `/sap-simulado/gestao/ordens/${encodeURIComponent(ordem.numero_ordem)}`, dados);
      else await chamar("POST", "/sap-simulado/gestao/ordens", { ...dados, numero_ordem: numero.trim() });
      exibirAviso(editando ? "Ordem atualizada." : "Ordem criada.");
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a ordem");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="stack g12">
      {efeito && (
        <Notice tone="info" icon="info">
          <b>No SYNC OS:</b> {efeito}
        </Notice>
      )}
      <div className="grade2">
        <Field label="Número da ordem">
          <input className="input mono" required value={numero} onChange={(e) => setNumero(e.target.value)} readOnly={editando} aria-readonly={editando} style={editando ? { background: "var(--surface2)" } : undefined} autoComplete="off" />
        </Field>
        <Field label="Nota">
          <input className="input mono" value={nota} onChange={(e) => setNota(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Tipo da ordem">
          <select
            className="input"
            value={tipo}
            onChange={(e) => {
              const novo = e.target.value as "YBA1" | "YBA2";
              setTipo(novo);
              if (tipoAtividade === "Z01-Manutenção Corretiva" || tipoAtividade === "Z02-Manutenção Preventiva") setTipoAtividade(novo === "YBA1" ? "Z01-Manutenção Corretiva" : "Z02-Manutenção Preventiva");
            }}
          >
            <option value="YBA1">YBA1 · Corretiva</option>
            <option value="YBA2">YBA2 · Preventiva</option>
          </select>
        </Field>
        <Field label="Tipo de atividade">
          <input className="input" value={tipoAtividade} onChange={(e) => setTipoAtividade(e.target.value)} />
        </Field>
      </div>
      <Field label="Título">
        <input className="input" required value={titulo} onChange={(e) => setTitulo(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Descrição (instruções, materiais e ferramentas)">
        <textarea className="input" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Field>
      <div className="grade2">
        <Field label="Centro de trabalho">
          <select className="input" value={centro} onChange={(e) => setCentro(e.target.value)}>
            {!centroEscolhido && centro && <option value={centro}>{centro}</option>}
            {catalogo.centros_de_trabalho.map((c) => (
              <option key={c.centro_trabalho} value={c.centro_trabalho}>
                {c.centro_trabalho} · {c.nome}
              </option>
            ))}
          </select>
          {centroEscolhido && !centroEscolhido.equipe_no_sync_os && <span className="small">Este centro não tem equipe no SYNC OS: a leitura vai ignorar a ordem.</span>}
        </Field>
        <Field label="Atividade">
          <select className="input" value={atividadeEscolhida} onChange={(e) => escolherAtividade(e.target.value)}>
            <option value="">Sem atividade</option>
            {catalogo.atividades.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.codigo} · {a.descricao}
              </option>
            ))}
            <option value={LIVRE}>Outra (digitar)…</option>
          </select>
          {atividadeEscolhida === LIVRE && <input className="input" aria-label="Código da atividade" value={atividade} onChange={(e) => setAtividade(e.target.value)} placeholder="Código da atividade" />}
          {atividade && !atividadeDoCatalogo && <span className="small">Atividade que o SYNC OS não conhece: a leitura a cadastra, com o título da ordem como descrição.</span>}
        </Field>
      </div>
      <div className="grade2">
        <Field label="Local de instalação">
          <select className="input" value={localEscolhido} onChange={(e) => escolherLocal(e.target.value)}>
            {catalogo.locais.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.codigo}
              </option>
            ))}
            <option value={LIVRE}>Outro (digitar)…</option>
          </select>
          {localEscolhido === LIVRE && <input className="input" aria-label="Código do local" required value={local.codigo} onChange={(e) => setLocal({ ...local, codigo: e.target.value })} placeholder="Código do local" />}
        </Field>
        <Field label="Cliente">
          <input className="input" value={local.cliente} onChange={(e) => setLocal({ ...local, cliente: e.target.value })} />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Endereço do local">
          <input className="input" value={local.endereco} onChange={(e) => setLocal({ ...local, endereco: e.target.value })} />
        </Field>
        <Field label="Plus code">
          <input className="input" value={local.plus_code} onChange={(e) => setLocal({ ...local, plus_code: e.target.value })} />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Equipamento">
          <input className="input" value={equipamento} onChange={(e) => setEquipamento(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Prioridade">
          <input className="input" list="prioridades-sap" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
          <datalist id="prioridades-sap">
            {["Muito alto", "Alto", "Médio", "Baixo"].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grade2">
        <Field label="Início programado">
          <input className="input" type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </Field>
        <Field label="Fim programado">
          <input className="input" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </Field>
      </div>
      <Field label="Status SAP">
        <select className="input" value={statusPronto ? status : LIVRE} onChange={(e) => setStatus(e.target.value === LIVRE ? "" : e.target.value)}>
          {catalogo.status_prontos.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.rotulo} ({s.codigo})
            </option>
          ))}
          <option value={LIVRE}>Outro (texto livre)…</option>
        </select>
        {!statusPronto && <input className="input" aria-label="Status SAP em texto livre" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Códigos separados por espaço, como LIB IMPR CAPC" />}
        <span className="small">{(status ?? "").toUpperCase().split(/\s+/).includes("LIB") ? "Com LIB: o SYNC OS lê a ordem como liberada." : "Sem LIB: o SYNC OS não cria a OS (e cancela a que já tem)."}</span>
      </Field>
      <div className="grade2">
        <Field label="Solicitante">
          <input className="input" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} />
        </Field>
        <Field label="Criado por">
          <input className="input" value={criadoPor} onChange={(e) => setCriadoPor(e.target.value)} placeholder="RFAVARO" />
        </Field>
      </div>
      {tipo === "YBA2" && (
        <div className="grade2">
          <Field label="Plano de manutenção">
            <input className="input mono" value={plano} onChange={(e) => setPlano(e.target.value)} />
          </Field>
          <Field label="Item de manutenção">
            <input className="input mono" value={item} onChange={(e) => setItem(e.target.value)} />
          </Field>
          <Field label="Intervalo entre ciclos">
            <input className="input" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} placeholder="3 MES, trimestral…" />
          </Field>
        </div>
      )}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" disabled={ocupado}>
          {ocupado ? "Salvando…" : editando ? "Salvar" : "Criar ordem"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { rotuloDaSituacaoNoSyncOs, type AcaoEmMassaDeOrdens, type CatalogoDeOrdens, type ListaDeOrdens, type RecusadaEmMassa, type SituacaoNoSyncOs } from "./tipos";

export interface FiltrosDaBusca {
  busca?: string;
  tipo?: string;
  centro_trabalho?: string;
  no_sync_os?: string;
}

interface JanelaEmMassaOrdensProps {
  acao: AcaoEmMassaDeOrdens;
  catalogo: CatalogoDeOrdens;
  numeros: string[];
  todosDaBusca: boolean;
  filtros: FiltrosDaBusca;
  /** Os da página: a situação no SYNC OS de cada um, para o resumo sem nova consulta. */
  daPagina: { numero: string; situacao: SituacaoNoSyncOs }[];
  aoFechar: (concluiu: boolean) => void;
}

const titulos: Record<AcaoEmMassaDeOrdens, string> = { mudar_status: "Mudar o status SAP", mudar_centro: "Mudar o centro de trabalho", reprogramar: "Reprogramar", excluir: "Excluir ordens" };

type Contagem = { total: number; porSituacao: Partial<Record<SituacaoNoSyncOs, number>> };

/** A situação no SYNC OS das ordens da busca inteira: lê todas as páginas (a seleção pode passar da página). */
async function contarDaBusca(f: FiltrosDaBusca): Promise<Contagem> {
  const porSituacao: Contagem["porSituacao"] = {};
  let total = 0;
  for (let pagina = 1; pagina <= 100; pagina++) {
    const consulta = new URLSearchParams({ pagina: String(pagina), tamanho: "200" });
    for (const [k, v] of Object.entries(f)) if (v) consulta.set(k, v);
    const r = await chamar<ListaDeOrdens>("GET", `/sap-simulado/gestao/ordens?${consulta}`);
    total = r.total;
    for (const o of r.ordens) porSituacao[o.no_sync_os.situacao] = (porSituacao[o.no_sync_os.situacao] ?? 0) + 1;
    if (pagina * 200 >= r.total) break;
  }
  return { total, porSituacao };
}

/**
 * Confirmação de uma ação em massa (`POST /sap-simulado/gestao/ordens/em-massa`). Antes de aplicar, diz quantas das ordens selecionadas já
 * estão no SYNC OS e o efeito nelas, pelas regras da leitura: tirar o `LIB` cancela a OS (ou gera conflito se está em execução), a
 * reprogramação no SYNC OS vence, a OS encerrada ou cancelada o SAP só acompanha. Excluir recusa as que o SYNC OS tem.
 */
export function JanelaEmMassaOrdens({ acao, catalogo, numeros, todosDaBusca, filtros, daPagina, aoFechar }: JanelaEmMassaOrdensProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [status, setStatus] = useState("LIB IMPR");
  const [centro, setCentro] = useState(catalogo.centros_de_trabalho[0]?.centro_trabalho ?? "");
  const [modo, setModo] = useState<"dias" | "data">("dias");
  const [dias, setDias] = useState(7);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [contagem, setContagem] = useState<Contagem | null>(() => {
    if (todosDaBusca) return null;
    const porSituacao: Contagem["porSituacao"] = {};
    for (const n of numeros) {
      const s = daPagina.find((o) => o.numero === n)?.situacao ?? "nao_lida";
      porSituacao[s] = (porSituacao[s] ?? 0) + 1;
    }
    return { total: numeros.length, porSituacao };
  });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recusadas, setRecusadas] = useState<RecusadaEmMassa[] | null>(null);

  // Os filtros chegam como objeto novo a cada renderização do pai: a chave evita refazer a contagem sem necessidade.
  const chaveDosFiltros = JSON.stringify(filtros);
  useEffect(() => {
    if (!todosDaBusca) return;
    let ativo = true;
    contarDaBusca(JSON.parse(chaveDosFiltros) as FiltrosDaBusca)
      .then((r) => ativo && setContagem(r))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : "Não foi possível contar as ordens"));
    return () => {
      ativo = false;
    };
  }, [todosDaBusca, chaveDosFiltros]);

  async function aplicar() {
    setErro(null);
    setOcupado(true);
    try {
      const corpo = {
        ...(todosDaBusca ? { todos_da_busca: true, ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)) } : { numeros }),
        acao,
        ...(acao === "mudar_status" ? { valor: status } : acao === "mudar_centro" ? { valor: centro } : acao === "reprogramar" ? (modo === "dias" ? { dias } : { data }) : {}),
      };
      const r = await chamar<{ afetadas: number; recusadas: RecusadaEmMassa[] }>("POST", "/sap-simulado/gestao/ordens/em-massa", corpo);
      exibirAviso(r.afetadas === 1 ? "1 ordem atualizada." : `${r.afetadas} ordens atualizadas.`);
      router.refresh();
      if (r.recusadas.length > 0) setRecusadas(r.recusadas);
      else aoFechar(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aplicar a ação");
    } finally {
      setOcupado(false);
    }
  }

  if (recusadas) {
    return (
      <JanelaModal titulo={titulos[acao]} aoFechar={() => aoFechar(true)}>
        <Notice tone="al" icon="alert">
          {recusadas.length === 1 ? "1 ordem foi recusada:" : `${recusadas.length} ordens foram recusadas:`}
        </Notice>
        <ul className="sim-recusados">
          {recusadas.map((r) => (
            <li key={r.numero_ordem}>
              <span className="mono">{r.numero_ordem}</span> — {r.motivo}
            </li>
          ))}
        </ul>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="p" sm onClick={() => aoFechar(true)}>
            Fechar
          </Button>
        </div>
      </JanelaModal>
    );
  }

  const p = contagem?.porSituacao ?? {};
  const noSyncOs = contagem ? contagem.total - (p.nao_lida ?? 0) - (p.ignorada ?? 0) : 0;
  const ativas = (p.liberada ?? 0) + (p.pendente ?? 0);
  const emExecucao = p.em_execucao ?? 0;
  const acompanhadas = (p.encerrada ?? 0) + (p.cancelada ?? 0);
  const quantas = contagem?.total ?? numeros.length;
  const resumo = (...partes: [number, string][]) => partes.filter(([n]) => n > 0).map(([n, texto]) => `${n} ${texto}`).join("; ");

  return (
    <JanelaModal titulo={titulos[acao]} aoFechar={() => aoFechar(false)}>
      <p style={{ fontSize: 14 }}>
        {acao === "excluir" ? "Excluir" : acao === "reprogramar" ? "Reprogramar" : "Mudar"} {contagem ? `${quantas} ${quantas === 1 ? "ordem" : "ordens"}` : "as ordens selecionadas"}
        {acao === "excluir" ? " do SAP?" : "."}
      </p>
      {acao === "mudar_status" && (
        <Field label="Novo status SAP">
          <select className="input" value={catalogo.status_prontos.some((s) => s.codigo === status) ? status : ""} onChange={(e) => setStatus(e.target.value)}>
            {catalogo.status_prontos.map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.rotulo} ({s.codigo})
              </option>
            ))}
          </select>
        </Field>
      )}
      {acao === "mudar_centro" && (
        <Field label="Novo centro de trabalho">
          <select className="input" value={centro} onChange={(e) => setCentro(e.target.value)}>
            {catalogo.centros_de_trabalho.map((c) => (
              <option key={c.centro_trabalho} value={c.centro_trabalho}>
                {c.centro_trabalho} · {c.nome}
                {c.equipe_no_sync_os ? "" : " (sem equipe no SYNC OS)"}
              </option>
            ))}
          </select>
        </Field>
      )}
      {acao === "reprogramar" && (
        <div className="stack g8">
          <div className="row g12 wrap">
            <label className="row g4">
              <input type="radio" name="modo" checked={modo === "dias"} onChange={() => setModo("dias")} /> Deslocar as datas
            </label>
            <label className="row g4">
              <input type="radio" name="modo" checked={modo === "data"} onChange={() => setModo("data")} /> Definir uma data nova
            </label>
          </div>
          {modo === "dias" ? (
            <Field label="Dias a deslocar (negativo adianta)">
              <input className="input" type="number" min={-3650} max={3650} value={Number.isFinite(dias) ? dias : ""} onChange={(e) => setDias(e.target.valueAsNumber)} style={{ maxWidth: 140 }} />
            </Field>
          ) : (
            <Field label="Novo início programado (o fim acompanha, com a mesma duração)">
              <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ maxWidth: 200 }} />
            </Field>
          )}
        </div>
      )}
      {contagem === null && !erro && <p className="small">Conferindo quantas já estão no SYNC OS…</p>}
      {contagem && (
        <Notice tone={noSyncOs > 0 && acao !== "reprogramar" ? "al" : "info"} icon={noSyncOs > 0 ? "alert" : "info"}>
          <div className="stack g4">
            <span>
              {noSyncOs === 0
                ? "Nenhuma delas está no SYNC OS: nada muda lá até a próxima leitura criar as OS."
                : `${noSyncOs} ${noSyncOs === 1 ? "já está" : "já estão"} no SYNC OS (${resumo([ativas, "liberada(s) ou pendente(s)"], [emExecucao, "em execução"], [acompanhadas, "encerrada(s) ou cancelada(s)"])}).`}
            </span>
            {acao === "excluir" && noSyncOs > 0 && <span>Estas não serão excluídas: no SAP uma ordem não é apagada, ela é encerrada (tire o LIB do status).</span>}
            {acao === "mudar_status" && noSyncOs > 0 && !status.toUpperCase().split(/\s+/).includes("LIB") && (
              <span>
                Sem o LIB, na próxima leitura o SYNC OS cancela as {ativas} OS liberadas ou pendentes
                {emExecucao > 0 ? ` e gera um alerta de conflito nas ${emExecucao} em execução, que seguem` : ""}. {acompanhadas > 0 ? `As ${acompanhadas} encerradas ou canceladas só são acompanhadas.` : ""}
              </span>
            )}
            {acao === "mudar_status" && noSyncOs > 0 && status.toUpperCase().split(/\s+/).includes("LIB") && <span>Com o LIB, o planejamento das OS que o SYNC OS já tem é atualizado na próxima leitura.</span>}
            {acao === "mudar_centro" && noSyncOs > 0 && <span>Na próxima leitura, o SYNC OS atualiza o planejamento (a equipe) das OS que já tem.</span>}
            {acao === "reprogramar" && noSyncOs > 0 && <span>Se a OS foi reprogramada no SYNC OS, uma data diferente no SAP faz a leitura ignorá-la: a reprogramação vence.</span>}
          </div>
        </Notice>
      )}
      {contagem && (p.ignorada ?? 0) > 0 && acao !== "excluir" && <p className="small">{p.ignorada} {p.ignorada === 1 ? "foi ignorada" : "foram ignoradas"} na última leitura ({rotuloDaSituacaoNoSyncOs.ignorada.toLowerCase()}); o SYNC OS confere de novo na próxima.</p>}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={() => aoFechar(false)} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant={acao === "excluir" ? "d" : "p"} sm onClick={aplicar} disabled={ocupado || (todosDaBusca && contagem === null)}>
          {ocupado ? "Aplicando…" : acao === "excluir" ? "Excluir" : "Aplicar"}
        </Button>
      </div>
    </JanelaModal>
  );
}

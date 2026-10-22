import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DocumentosAnexados } from "@/components/ui/DocumentosAnexados";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { Panel } from "@/components/web/Panel";
import type { ExecucaoDaOs } from "@/data/detalhe";
import { itensDaInspecao } from "@/lib/checklist-inspecao";
import { dataHora, duracao, hora } from "@/lib/formatar";
import { ROTULO_DO_ESTADO_DO_PEDIDO, ROTULO_DO_PEDIDO } from "@/lib/execucao-pedidos";
import { descreverMotivo, ehMotivoDeSaude, rotuloDoMotivoDaSuspensao } from "@/lib/motivos-de-parada";
import { BlocoDeClima } from "./ClimaDaExecucao";
import { ChecklistDaExecucao } from "./ChecklistDaExecucao";
import { FotosDaEvidencia } from "./FotosDaEvidencia";
import { LocalizacaoNoMapa } from "./LocalizacaoNoMapa";
import { PausasDaExecucao } from "./PausasDaExecucao";

const rotuloMedida = { color: "var(--ink4)" } as const;
const colunaAssinatura = { maxWidth: 260, minWidth: 0, flex: "1 1 160px" } as const;

export const resultado: Record<NonNullable<ExecucaoDaOs["resultado"]>, { rotulo: string; tom: BadgeTone }> = {
  encerrada: { rotulo: "Encerrada", tom: "enc" },
  interrompida: { rotulo: "Interrompida por risco", tom: "blq" },
  suspensa: { rotulo: "Suspensa", tom: "al" },
  cancelada: { rotulo: "Cancelada por engano", tom: "neu" },
};

export function Medida({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="small" style={rotuloMedida}>
        {rotulo}
      </div>
      <strong style={{ fontSize: 14 }}>{valor}</strong>
    </div>
  );
}

function ExecucaoCartao({ execucao: e, numero, total }: { execucao: ExecucaoDaOs; numero: number; total: number }) {
  // A encerrada sem a assinatura do responsável ainda está `encerrando`: o tempo parou, mas o preenchimento não foi assinado.
  const r = e.resultado === "encerrada" && !e.encerramento_assinado_em ? { rotulo: "Encerrando: aguarda o responsável", tom: "exe" as const } : e.resultado ? resultado[e.resultado] : null;
  const inspecao = itensDaInspecao(e.dados_inspecao);
  const totalMin = e.fim ? (new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60_000 : null;
  return (
    <div className="stack g12" style={{ padding: 14, borderRadius: 10, background: "#fff", border: "1px solid var(--line)" }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>
            Execução {numero}
            {total > 1 ? ` de ${total}` : ""} · {e.executor.nome}
          </h3>
          <span className="muted">APR #{e.apr_id.slice(0, 8)} · mat. {e.executor.matricula}</span>
        </div>
        {r ? <Badge tone={r.tom}>{r.rotulo}</Badge> : <Badge tone="exe">Em andamento</Badge>}
      </div>

      <div className="medidas">
        <Medida rotulo="Início" valor={dataHora(e.inicio)} />
        <Medida rotulo="Fim" valor={e.fim ? dataHora(e.fim) : "em andamento"} />
        <Medida rotulo="Tempo total" valor={duracao(totalMin)} />
        <Medida
          rotulo="Pausas"
          valor={e.pausas.length === 0 ? "sem pausas" : `${duracao(e.pausa_min)} · ${e.pausas.length} ${e.pausas.length === 1 ? "pausa" : "pausas"}`}
        />
        <Medida rotulo="Tempo líquido" valor={duracao(e.tempo_liquido_min)} />
        <Medida rotulo="Pessoas" valor={String(e.numero_pessoas)} />
      </div>

      <PausasDaExecucao pausas={e.pausas} executorId={e.executor.id} />

      {e.finalizada_por && e.finalizada_por.id !== e.executor.id && e.resultado && (
        <p style={{ fontSize: 14.5 }}>
          <strong>{e.resultado === "encerrada" ? "Encerrada" : e.resultado === "suspensa" ? "Suspensa" : "Interrompida"} por {e.finalizada_por.nome}</strong>, participante da APR
          {e.resultado === "encerrada" ? "; quem encerra assina o encerramento." : "."}
        </p>
      )}

      {e.pedidos && e.pedidos.length > 0 && (
        <div className="stack g8" style={{ fontSize: 13.5 }}>
          <div className="small" style={rotuloMedida}>
            Pedidos de participantes ao responsável
          </div>
          {e.pedidos.map((p) => (
            <div key={p.id} className="stack g4" style={{ paddingBottom: 8, borderBottom: "1px solid var(--line2)" }}>
              <span>
                <span className="mono">{hora(p.criado_em)}</span> · <strong>{p.solicitante.nome}</strong> pediu para {ROTULO_DO_PEDIDO[p.tipo]}
                {p.tipo === "suspender" && ` (${descreverMotivo(rotuloDoMotivoDaSuspensao, p.motivo, p.complemento)})`}
              </span>
              <span className="small">
                {ROTULO_DO_ESTADO_DO_PEDIDO[p.estado]}
                {p.decidido_por && ` (${p.decidido_por.nome})`}
                {p.decidido_em && ` · ${hora(p.decidido_em)}`}
                {p.motivo_recusa && `: “${p.motivo_recusa}”`}
                {p.apoios.length > 0 && ` · apoiado por ${p.apoios.map((a) => a.nome).join(", ")}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {e.resultado === "suspensa" && (
        <div>
          <div className="small" style={rotuloMedida}>
            Motivo da suspensão
          </div>
          <p style={{ fontSize: 14.5, ...(ehMotivoDeSaude(e.suspensao_motivo) ? { color: "var(--blq)", fontWeight: 600 } : undefined) }}>
            {descreverMotivo(rotuloDoMotivoDaSuspensao, e.suspensao_motivo, e.suspensao_complemento)}
            {ehMotivoDeSaude(e.suspensao_motivo) && " · ocorrência de saúde"}
          </p>
        </div>
      )}

      {(e.localizacao_inicio || e.localizacao_fim) && (
        <div className="row g12 wrap">
          <LocalizacaoNoMapa titulo="Localização do início" ponto={e.localizacao_inicio} compacta />
          {e.fim && <LocalizacaoNoMapa titulo="Localização do fim" ponto={e.localizacao_fim} compacta />}
        </div>
      )}

      {e.motivo && (
        <div>
          <div className="small" style={rotuloMedida}>
            Motivo
          </div>
          <p style={{ fontSize: 14.5 }}>{e.motivo}</p>
        </div>
      )}

      {e.descricao_atividade && (
        <div>
          <div className="small" style={rotuloMedida}>
            Descrição da atividade
          </div>
          <p style={{ fontSize: 14.5 }}>{e.descricao_atividade}</p>
        </div>
      )}

      {inspecao && inspecao.length > 0 && <ChecklistDaExecucao itens={inspecao} />}

      <FotosDaEvidencia fotos={e.fotos} descricao="Foto da execução" />
      <DocumentosAnexados documentos={e.documentos ?? []} />

      {e.clima && <BlocoDeClima titulo="Condições no encerramento" clima={e.clima} />}

      {e.assinaturas.length > 0 && (
        <div className="row g12 wrap">
          {e.assinaturas.map((a) => (
            <div key={a.usuario_id} className="stack g4" style={colunaAssinatura}>
              <div className="small" style={rotuloMedida}>
                {a.usuario_id === e.executor.id ? "Executante · responsável" : "Executante"}
              </div>
              <div className="sig-box" style={{ background: "#fff" }}>
                <ImagemArquivo id={a.assinatura_path} alt={`Assinatura de ${a.nome}`} style={{ width: "100%", height: 56, objectFit: "contain" }} />
              </div>
              <div className="small">
                {a.nome} · mat. {a.matricula} · {hora(a.assinada_em)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Execuções da OS, com pausas, tempo líquido, fotos, PDFs e assinaturas. */
export function ExecucoesDaOs({ execucoes }: { execucoes: ExecucaoDaOs[] }) {
  return (
    <Panel>
      <h2>Execução{execucoes.length > 1 ? `: ${execucoes.length} tentativas` : ""}</h2>
      {execucoes.length === 0 ? (
        <p className="muted">Nenhuma execução iniciada ainda.</p>
      ) : (
        execucoes.map((e, i) => <ExecucaoCartao key={e.id} execucao={e} numero={i + 1} total={execucoes.length} />)
      )}
    </Panel>
  );
}

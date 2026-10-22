import { Badge } from "@/components/ui/Badge";
import { DocumentosAnexados } from "@/components/ui/DocumentosAnexados";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import type { AprDaOs, ExecucaoDaOs, OsDetalhe } from "@/data/detalhe";
import { itensDaInspecao } from "@/lib/checklist-inspecao";
import { dataHora, duracao, hora } from "@/lib/formatar";
import { descreverMotivo, ehMotivoDeSaude, rotuloDoMotivoDaPausa, rotuloDoMotivoDaSuspensao } from "@/lib/motivos-de-parada";
import { urlDoRelatorio } from "@/lib/rotas";
import { AssinaturasDaApr } from "./AssinaturasDaApr";
import { CondicoesClimaticas } from "./ClimaDaExecucao";
import { ChecklistDaExecucao } from "./ChecklistDaExecucao";
import { Medida, resultado } from "./ExecucoesDaOs";
import { FotosDaEvidencia } from "./FotosDaEvidencia";
import { LocalizacaoNoMapa } from "./LocalizacaoNoMapa";
import { PausasDaExecucao } from "./PausasDaExecucao";

const rotuloMedida = { color: "var(--ink4)" } as const;

/** Ao terminar sem nada a registrar, o PDF e a planilha de baixa trazem este texto; o relatório o repete para não parecer lacuna. */
const SEM_OCORRENCIAS = "Executado conforme a OS, sem ocorrências";

const minutosEntre = (inicio: string, fim: string) => (new Date(fim).getTime() - new Date(inicio).getTime()) / 60_000;

interface OcorrenciaDeSaude {
  chave: string;
  quando: string;
  texto: string;
  quem: string;
}

/** Pausas e suspensões por lesão ou enfermidade, de todas as execuções: o relatório as põe em destaque no topo. */
function ocorrenciasDeSaude(execucoes: ExecucaoDaOs[]): OcorrenciaDeSaude[] {
  const lista: OcorrenciaDeSaude[] = [];
  for (const e of execucoes) {
    for (const p of e.pausas) {
      if (ehMotivoDeSaude(p.motivo)) {
        lista.push({ chave: p.id, quando: p.inicio, texto: `Pausa por ${descreverMotivo(rotuloDoMotivoDaPausa, p.motivo, p.complemento).toLowerCase()}`, quem: e.executor.nome });
      }
    }
    if (e.resultado === "suspensa" && ehMotivoDeSaude(e.suspensao_motivo) && e.fim) {
      lista.push({ chave: e.id, quando: e.fim, texto: `Suspensão por ${descreverMotivo(rotuloDoMotivoDaSuspensao, e.suspensao_motivo, e.suspensao_complemento).toLowerCase()}`, quem: e.executor.nome });
    }
  }
  return lista.sort((a, b) => (a.quando < b.quando ? -1 : 1));
}

/** Rótulo do ponto onde a execução terminou, conforme o jeito que terminou. */
const tituloDoFim: Record<NonNullable<ExecucaoDaOs["resultado"]>, string> = {
  encerrada: "Localização do encerramento",
  suspensa: "Localização da suspensão",
  interrompida: "Localização da interrupção",
  cancelada: "Localização do fim",
};

function ExecucaoDoRelatorio({ execucao: e, apr, numero, total, endereco }: { execucao: ExecucaoDaOs; apr: AprDaOs | undefined; numero: number; total: number; endereco: string | null }) {
  const r = e.resultado ? resultado[e.resultado] : null;
  const inspecao = itensDaInspecao(e.dados_inspecao);
  const totalMin = e.fim ? minutosEntre(e.inicio, e.fim) : null;
  return (
    <div className="stack g12" style={{ padding: 14, borderRadius: 10, background: "#fff", border: "1px solid var(--line)" }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>
            Execução {numero}
            {total > 1 ? ` de ${total}` : ""} · {e.executor.nome}
          </h3>
          <span className="muted">
            {dataHora(e.inicio)} a {e.fim ? dataHora(e.fim) : "em andamento"} · {e.numero_pessoas} {e.numero_pessoas === 1 ? "pessoa" : "pessoas"}
          </span>
        </div>
        {r ? <Badge tone={r.tom}>{r.rotulo}</Badge> : <Badge tone="exe">Em andamento</Badge>}
      </div>

      <div className="medidas">
        <Medida rotulo="Tempo total" valor={duracao(totalMin)} />
        <Medida rotulo="Tempo pausado" valor={e.pausas.length === 0 ? "sem pausas" : duracao(e.pausa_min)} />
        <Medida rotulo="Tempo líquido" valor={duracao(e.tempo_liquido_min)} />
      </div>

      <div className="row g12 wrap" style={{ alignItems: "flex-start" }}>
        <LocalizacaoNoMapa titulo="Localização do início" ponto={e.localizacao_inicio} endereco={endereco} />
        {e.fim && e.resultado && <LocalizacaoNoMapa titulo={tituloDoFim[e.resultado]} ponto={e.localizacao_fim} endereco={endereco} />}
      </div>

      <CondicoesClimaticas apr={apr} execucao={e} />

      <PausasDaExecucao pausas={e.pausas} />

      {e.resultado === "suspensa" && (
        <div>
          <div className="small" style={rotuloMedida}>
            Motivo da suspensão
          </div>
          <p style={{ fontSize: 14.5, ...(ehMotivoDeSaude(e.suspensao_motivo) ? { color: "var(--blq)", fontWeight: 600 } : undefined) }}>
            {descreverMotivo(rotuloDoMotivoDaSuspensao, e.suspensao_motivo, e.suspensao_complemento)}
          </p>
        </div>
      )}

      {e.resultado === "interrompida" && (
        <div>
          <div className="small" style={rotuloMedida}>
            Motivo da interrupção por risco
          </div>
          <p style={{ fontSize: 14.5 }}>{e.motivo ?? "Sem motivo registrado."}</p>
        </div>
      )}

      {e.resultado === "encerrada" && (
        <div>
          <div className="small" style={rotuloMedida}>
            Descrição da atividade
          </div>
          <p style={{ fontSize: 14.5 }}>{e.descricao_atividade?.trim() || SEM_OCORRENCIAS}</p>
        </div>
      )}

      {inspecao && inspecao.length > 0 && <ChecklistDaExecucao itens={inspecao} />}

      <FotosDaEvidencia fotos={e.fotos} descricao="Foto da execução" />
      <DocumentosAnexados documentos={e.documentos ?? []} />
    </div>
  );
}

/**
 * O relatório da execução, na tela, para o supervisor e o admin: tudo o que o SYNQ OS acrescenta ao papel (o PDF da OS reproduz só a
 * folha do SAP e a APR). Traz os tempos, cada pausa com motivo e localização, suspensões e interrupções, o ponto de início e de
 * fim ao lado do endereço da OS, fotos e PDFs, o checklist de inspeção, as assinaturas da APR e, em destaque, as ocorrências de
 * saúde. O mesmo conteúdo sai em PDF (`GET /os/{id}/relatorio-execucao`), que o supervisor lê antes de assinar.
 */
export function RelatorioDaExecucao({ os, aprs, execucoes }: { os: OsDetalhe; aprs: AprDaOs[]; execucoes: ExecucaoDaOs[] }) {
  const finalizadas = execucoes.filter((e) => e.fim);
  const nome = `Relatorio-OS-${os.numero_ordem ?? os.id.slice(0, 8)}.pdf`;
  const saude = ocorrenciasDeSaude(execucoes);
  const total = finalizadas.reduce((s, e) => s + minutosEntre(e.inicio, e.fim!), 0);
  const pausado = finalizadas.reduce((s, e) => s + (e.pausa_min ?? 0), 0);
  const liquido = finalizadas.reduce((s, e) => s + (e.tempo_liquido_min ?? 0), 0);
  // As assinaturas da APR que valeram: as das execuções (uma APR aprovada por tentativa).
  const idsDasAprs = new Set(execucoes.map((e) => e.apr_id));
  const aprsDaExecucao = aprs.filter((a) => idsDasAprs.has(a.id) && a.resultado === "aprovada");
  const endereco = os.local_instalacao.endereco;

  return (
    <>
      <Panel>
        <div className="row between wrap" style={{ alignItems: "flex-start" }}>
          <div className="stack" style={{ gap: 2 }}>
            <h2>Relatório da execução</h2>
            <span className="muted">
              {finalizadas.length === 1 ? "1 execução finalizada" : `${finalizadas.length} execuções finalizadas`} · só o supervisor da equipe e o admin veem este relatório
            </span>
          </div>
          <div className="row g8 wrap">
            <a className="btn btn-p btn-sm" href={urlDoRelatorio(os.id)} target="_blank" rel="noreferrer">
              <Icon name="file" size={16} />
              Abrir o PDF
            </a>
            <a className="btn btn-line btn-sm" href={urlDoRelatorio(os.id)} download={nome}>
              <Icon name="download" size={16} />
              Baixar
            </a>
          </div>
        </div>

        {saude.length > 0 && (
          <Notice tone="blq" icon="alert" role="status">
            <div className="stack g4">
              <strong>Ocorrência de saúde: lesão ou enfermidade na execução.</strong>
              {saude.map((o) => (
                <span key={o.chave}>
                  {o.texto} às {hora(o.quando)} ({o.quem}). A lesão no trabalho, mesmo leve, é acidente de trabalho e precisa ser registrada pela empresa.
                </span>
              ))}
            </div>
          </Notice>
        )}

        <div className="medidas">
          <Medida rotulo="Tempo total (com as pausas)" valor={duracao(total)} />
          <Medida rotulo="Tempo pausado" valor={duracao(pausado)} />
          <Medida rotulo="Tempo líquido" valor={duracao(liquido)} />
        </div>
        {finalizadas.length > 1 && <span className="small">Soma das {finalizadas.length} execuções; cada uma aparece abaixo.</span>}
      </Panel>

      <Panel>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Execuções, pausas e localização</h2>
          <span className="muted">
            Endereço da OS: {os.local_instalacao.codigo}
            {endereco ? ` — ${endereco}` : " (sem endereço cadastrado)"}. O mapa mostra onde a pessoa estava; no notebook a posição vem da rede e é aproximada.
          </span>
        </div>
        {finalizadas.map((e, i) => (
          <ExecucaoDoRelatorio key={e.id} execucao={e} apr={aprs.find((a) => a.id === e.apr_id)} numero={i + 1} total={finalizadas.length} endereco={endereco} />
        ))}
      </Panel>

      <Panel>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Assinaturas da APR</h2>
          <span className="muted">Cada participante assina na própria conta, só no começo. Quem recusou saiu da APR e deixou o motivo.</span>
        </div>
        {aprsDaExecucao.length === 0 ? <p className="muted">Nenhuma APR aprovada ligada às execuções.</p> : aprsDaExecucao.map((a) => <AssinaturasDaApr key={a.id} apr={a} />)}
      </Panel>
    </>
  );
}

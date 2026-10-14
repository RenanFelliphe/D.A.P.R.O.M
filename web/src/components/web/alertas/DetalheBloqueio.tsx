import { DocumentosAnexados } from "@/components/ui/DocumentosAnexados";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { MateriaisDaApr } from "@/components/ui/MateriaisDaApr";
import { faltouComprovar } from "@/lib/catalogo";
import { dataHora } from "@/lib/formatar";
import type { AprDaOs, ExecucaoDaOs, FotoDaOs } from "./tipos";

const rotuloBloqueio = { color: "#6B2A23" } as const;
const respostaEscrita = { sim: "Sim", nao: "Não", na: "Não se aplica" } as const;

function Fotos({ fotos }: { fotos: FotoDaOs[] }) {
  if (fotos.length === 0) return null;
  return (
    <div className="row g8 wrap">
      {fotos.map((f) => (
        <figure key={f.id} className="stack g4" style={{ margin: 0 }}>
          <ImagemArquivo
            id={f.foto_path}
            alt="Foto do impedimento"
            className="photo"
            style={{ display: "block", height: 120, width: "100%", maxWidth: 160, objectFit: "cover", borderRadius: 8 }}
          />
          <figcaption className="small">{dataHora(f.capturada_em)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Uma APR bloqueada: quem preencheu, os itens reprovados com a observação do técnico, as fotos e os PDFs. */
function AprBloqueada({ apr }: { apr: AprDaOs }) {
  const nomes = apr.participantes.map((p) => p.nome).join(", ");
  return (
    <div className="blockbox" style={{ flexDirection: "column" }}>
      <div className="small" style={rotuloBloqueio}>
        APR bloqueada · {apr.modelo.codigo} · {dataHora(apr.concluida_em)}
        {nomes ? ` · equipe: ${nomes}` : ""}
      </div>
      {apr.itens_reprovados.length === 0 && !apr.materiais.some(faltouComprovar) && <span style={{ fontSize: 14.5 }}>Sem item reprovado registrado.</span>}
      <MateriaisDaApr materiais={apr.materiais} />
      {apr.itens_reprovados.map((item) => (
        <div key={item.item_id} className="stack g8" style={{ minWidth: 0 }}>
          <div>
            <div className="small" style={rotuloBloqueio}>
              Item que bloqueou
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>
              {item.texto} <span style={{ color: "var(--blq)" }}>{respostaEscrita[item.resposta]}</span>
            </div>
          </div>
          {item.observacao && (
            <div>
              <div className="small" style={rotuloBloqueio}>
                Observação do técnico
              </div>
              <div style={{ fontSize: 14.5 }}>“{item.observacao}”</div>
            </div>
          )}
          <Fotos fotos={item.fotos} />
          <DocumentosAnexados documentos={item.documentos ?? []} />
        </div>
      ))}
      {apr.observacao_geral && apr.observacao_geral !== "Sem observações" && (
        <div>
          <div className="small" style={rotuloBloqueio}>
            Observação geral
          </div>
          <div style={{ fontSize: 14.5 }}>{apr.observacao_geral}</div>
        </div>
      )}
    </div>
  );
}

/** Uma execução interrompida por condição de risco: motivo, fotos e PDFs. */
function ExecucaoInterrompida({ execucao }: { execucao: ExecucaoDaOs }) {
  return (
    <div className="blockbox" style={{ flexDirection: "column" }}>
      <div className="small" style={rotuloBloqueio}>
        Execução interrompida · {dataHora(execucao.fim)} · {execucao.executor.nome}
      </div>
      <div>
        <div className="small" style={rotuloBloqueio}>
          Motivo da interrupção
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{execucao.motivo ?? "Sem motivo registrado."}</div>
      </div>
      <Fotos fotos={execucao.fotos} />
      <DocumentosAnexados documentos={execucao.documentos ?? []} />
    </div>
  );
}

/** O que causou o impedimento: as APRs bloqueadas e as execuções interrompidas da OS, da mais recente para a mais antiga. */
export function CausaDoBloqueio({ aprs, execucoes }: { aprs: AprDaOs[]; execucoes: ExecucaoDaOs[] }) {
  const causas = [
    ...aprs.filter((a) => a.resultado === "bloqueada").map((a) => ({ em: a.concluida_em, no: <AprBloqueada key={a.id} apr={a} /> })),
    ...execucoes
      .filter((e) => e.resultado === "interrompida")
      .map((e) => ({ em: e.fim ?? "", no: <ExecucaoInterrompida key={e.id} execucao={e} /> })),
  ].sort((a, b) => (a.em < b.em ? 1 : -1));

  if (causas.length === 0) return <p className="muted">Não há APR bloqueada nem execução interrompida registrada nesta OS.</p>;
  return <div className="stack g8">{causas.map((c) => c.no)}</div>;
}

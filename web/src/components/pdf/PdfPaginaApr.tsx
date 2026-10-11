import { aprIdentificacao, aprParticipantes } from "@/data/pdf";
import { perguntasApr03, respostaDemo, type PerguntaApr } from "@/data/checklist";
import { cx } from "@/lib/cx";
import { PdfAssinatura, PdfCabecalho, PdfCelulas, PdfRodape, PdfSecao } from "./PdfBlocos";
import { PdfFolha } from "./PdfPaginas";

function rotuloTipo(pergunta: PerguntaApr): string {
  if (pergunta.tipo === "elim") return "Eliminatório";
  return pergunta.critica ? "Alerta" : "Medida preventiva";
}

/** Gera o alerta quando a resposta dada é justamente a que o modelo marca como crítica. */
function geraAlerta(pergunta: PerguntaApr): boolean {
  return pergunta.tipo === "alerta" && pergunta.critica !== null && respostaDemo(pergunta) === pergunta.critica;
}

function rotuloResposta(pergunta: PerguntaApr): string {
  const base = respostaDemo(pergunta) === "sim" ? "Sim" : "Não";
  return geraAlerta(pergunta) ? `${base} · ALERTA` : base;
}

/** Página 1 do PDF: identificação, checklist respondido e participantes da APR. */
export function PdfPaginaApr() {
  return (
    <PdfFolha pagina={1}>
      <PdfCabecalho subtitulo="Análise Preliminar de Risco" pagina={1} />
      <PdfSecao titulo="1 · Identificação da APR">
        <PdfCelulas celulas={aprIdentificacao} />
      </PdfSecao>
      <PdfSecao titulo="2 · Checklist · 18 itens">
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}>Nº</th>
              <th>Item</th>
              <th style={{ width: 110 }}>Tipo</th>
              <th style={{ width: 92 }}>Resposta</th>
            </tr>
          </thead>
          <tbody>
            {perguntasApr03.map((pergunta, i) => (
              <tr key={pergunta.texto} className={cx(geraAlerta(pergunta) && "al")}>
                <td className="mono">{i + 1}</td>
                <td>{pergunta.texto}</td>
                <td>{rotuloTipo(pergunta)}</td>
                <td>
                  <b>{rotuloResposta(pergunta)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <span style={{ fontSize: 10.5, color: "var(--ink3)" }}>
          18 itens respondidos · 17 conformes · 1 alerta (item 5) · nenhum item eliminatório reprovado.
        </span>
      </PdfSecao>
      <PdfSecao titulo="3 · Participantes">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {aprParticipantes.map((participante) => (
            <PdfAssinatura key={participante.pessoa} {...participante} />
          ))}
        </div>
      </PdfSecao>
      <PdfRodape />
    </PdfFolha>
  );
}

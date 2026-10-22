import { BotaoPdfAssinado } from "@/components/assinatura/BotaoPdfAssinado";
import { SeloDaAssinatura } from "@/components/assinatura/SeloDaAssinatura";
import { Panel } from "@/components/web/Panel";
import { api } from "@/lib/api";
import type { AssinaturaJuridicaDaOs } from "@/lib/assinatura-juridica";
import { dataHora } from "@/lib/formatar";

/**
 * As assinaturas com validade jurídica dos atos desta OS (`GET /os/{id}/assinaturas-juridicas`): quem assinou, o quê, quando, a situação
 * e o PDF assinado. Aparece para quem já vê a OS; sem o provedor ligado e sem nenhuma assinatura, não desenha nada. É um quadro de
 * apoio: se a consulta falhar (ou no Campo de treino, onde a `api` fictícia não a conhece), a tela segue sem ele.
 */
export async function AssinaturasJuridicasDaOs({ osId, ligada }: { osId: string; ligada: boolean }) {
  let assinaturas: AssinaturaJuridicaDaOs[];
  try {
    assinaturas = (await api<{ assinaturas: AssinaturaJuridicaDaOs[] }>(`/os/${osId}/assinaturas-juridicas`)).assinaturas;
  } catch {
    return null;
  }
  if (assinaturas.length === 0 && !ligada) return null;

  return (
    <Panel style={{ gap: 8 }}>
      <h2>Assinaturas com validade jurídica</h2>
      {assinaturas.length === 0 ? (
        <p className="muted">Nenhum ato desta OS foi assinado no provedor ainda.</p>
      ) : (
        <ul className="stack g8" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {assinaturas.map((a) => (
            <li key={a.id} className="stack g4" style={{ padding: 10, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line2)" }}>
              <div className="row between wrap g8">
                <strong className="small">{a.titulo}</strong>
                <SeloDaAssinatura situacao={a.situacao} />
              </div>
              <span className="small muted">
                {a.usuario.nome} · {dataHora(a.assinada_em ?? a.criada_em)}
                {a.origem_offline ? " · ato feito sem sinal" : ""}
              </span>
              {a.situacao === "assinada" && a.pdf_pronto && <BotaoPdfAssinado id={a.id} />}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

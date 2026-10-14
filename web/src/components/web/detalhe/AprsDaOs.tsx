import { Badge } from "@/components/ui/Badge";
import { DocumentosAnexados } from "@/components/ui/DocumentosAnexados";
import { Icon } from "@/components/ui/Icon";
import { MateriaisDaApr } from "@/components/ui/MateriaisDaApr";
import { Panel, TableWrap } from "@/components/web/Panel";
import type { AprDaOs, RespostaApr } from "@/data/detalhe";
import { dataHora, hora } from "@/lib/formatar";
import { iniciaisDe } from "@/lib/tipos";
import { FotosDaEvidencia } from "./FotosDaEvidencia";

const cartaoPessoa = {
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  borderRadius: 10,
  background: "var(--surface2)",
  border: "1px solid var(--line2)",
} as const;

const rotuloDoTipo: Record<string, string> = { eliminatorio: "Eliminatório", alerta: "Alerta", informativo: "Informativo" };
const rotuloDaResposta = { sim: "Sim", nao: "Não", na: "Não se aplica" } as const;

/** Tom da resposta na tabela: reprovado em vermelho, alerta marcado em âmbar, o resto em verde. */
function tomDaResposta(r: RespostaApr) {
  if (r.reprovado) return "var(--blq)";
  if (r.alerta_marcado) return "var(--al)";
  return "var(--enc)";
}

function AprCartao({ apr, numero, total }: { apr: AprDaOs; numero: number; total: number }) {
  const bloqueada = apr.resultado === "bloqueada";
  const reprovados = apr.respostas.filter((r) => r.reprovado).length;
  const alertas = apr.respostas.filter((r) => r.alerta_marcado).length;
  // Sem o tipo (só o admin o recebe) a tabela não traz a coluna Tipo nem separa os alertas.
  const comTipo = apr.respostas.some((r) => r.tipo !== undefined);
  const conformes = apr.respostas.length - reprovados - alertas;
  return (
    <div
      className="stack g12"
      style={{
        padding: 14,
        borderRadius: 10,
        background: bloqueada ? "#FDF3F1" : "#fff",
        border: `1px solid ${bloqueada ? "#F0C9C3" : "var(--line)"}`,
      }}
    >
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>
            APR <span className="mono">#{apr.id.slice(0, 8)}</span> · {apr.modelo.codigo} — {apr.modelo.titulo}, versão {apr.modelo.versao}
          </h3>
          <span className="muted">
            Concluída em {dataHora(apr.concluida_em)} por {apr.preenchida_por.nome} · {numero}ª de {total} APR{total > 1 ? "s" : ""} desta OS
          </span>
        </div>
        {bloqueada ? (
          <Badge tone="blq">Bloqueada</Badge>
        ) : (
          <Badge tone="enc">
            <Icon name="check" size={13} />
            Aprovada
          </Badge>
        )}
      </div>

      <div className="row g8 wrap">
        {apr.participantes.map((p) => (
          <div key={p.usuario_id} className="row g12" style={cartaoPessoa}>
            <span className={p.funcao === "responsavel" ? "avatar" : "avatar av2"} style={{ width: 34, height: 34, fontSize: 12 }}>
              {iniciaisDe(p.nome)}
            </span>
            <span className="stack" style={{ lineHeight: 1.3 }}>
              <strong style={{ fontSize: 14 }}>{p.nome}</strong>
              <span className="small">
                {p.funcao === "responsavel" ? "Responsável" : "Executor"} · mat. {p.matricula}
                {p.assinada_em ? ` · assinou ${hora(p.assinada_em)}` : ""}
              </span>
            </span>
          </div>
        ))}
      </div>

      {apr.riscos.length > 0 && (
        <div className="row wrap g8" style={{ fontSize: 13 }}>
          <span className="small" style={{ color: "var(--ink4)" }}>
            Riscos:
          </span>
          {apr.riscos.map((r) => (
            <span key={r.id} className="tag" style={{ background: "var(--chip)" }} title={r.classificacao}>
              {r.nome}
            </span>
          ))}
        </div>
      )}

      <div className="row wrap g8" style={{ fontSize: 13 }}>
        <span className="tag" style={{ background: "var(--chip)" }}>
          {apr.respostas.length} itens respondidos
        </span>
        <span className="tag" style={{ background: "var(--enc-bg)", color: "var(--enc)", fontWeight: 600 }}>
          {conformes} conformes
        </span>
        {alertas > 0 && (
          <span className="tag" style={{ background: "var(--al-bg)", color: "var(--al)", fontWeight: 600 }}>
            <Icon name="alert" size={13} /> {alertas} {alertas === 1 ? "alerta" : "alertas"}
          </span>
        )}
        <span
          className="tag"
          style={reprovados > 0 ? { background: "var(--blq-bg)", color: "var(--blq)", fontWeight: 600 } : { background: "var(--chip)" }}
        >
          {reprovados} {reprovados === 1 ? "reprovado" : "reprovados"}
        </span>
      </div>

      {apr.itens_reprovados.map((item) => (
        <div key={item.item_id} className="stack g8" style={{ padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #F0C9C3" }}>
          <span style={{ fontSize: 13.5 }}>
            <b>Item reprovado</b> · {item.texto} <b style={{ color: "var(--blq)" }}>{rotuloDaResposta[item.resposta as keyof typeof rotuloDaResposta] ?? item.resposta}</b>
            {item.observacao && <> — “{item.observacao}”</>}
          </span>
          <FotosDaEvidencia fotos={item.fotos} descricao="Evidência do item reprovado" />
          <DocumentosAnexados documentos={item.documentos ?? []} />
        </div>
      ))}

      <MateriaisDaApr materiais={apr.materiais} />

      {apr.observacao_geral && (
        <span style={{ fontSize: 13.5 }}>
          <span className="small" style={{ color: "var(--ink4)" }}>
            Observação geral:{" "}
          </span>
          {apr.observacao_geral}
        </span>
      )}

      <details>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--brand)" }}>
          Ver os {apr.respostas.length} itens respondidos
        </summary>
        <div style={{ marginTop: 10 }}>
          <TableWrap>
            <table className="tb">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Item</th>
                  {comTipo && <th style={{ width: 130 }}>Tipo</th>}
                  <th style={{ width: 110 }}>Resposta</th>
                </tr>
              </thead>
              <tbody>
                {apr.respostas.map((r) => (
                  <tr key={r.item_id} className={r.reprovado || r.alerta_marcado ? "al" : undefined}>
                    <td className="mono" style={{ color: "var(--ink4)" }}>
                      {r.ordem}
                    </td>
                    <td>
                      {r.texto}
                      {r.observacao && <div className="small">Obs.: {r.observacao}</div>}
                    </td>
                    {comTipo && <td>{r.tipo ? (rotuloDoTipo[r.tipo] ?? r.tipo) : ""}</td>}
                    <td style={{ color: tomDaResposta(r), fontWeight: 600 }}>
                      {rotuloDaResposta[r.resposta]}
                      {r.reprovado ? " · reprovado" : r.alerta_marcado ? " · alerta" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </details>
    </div>
  );
}

/** Todas as APRs da OS (bloqueadas e aprovadas), da mais antiga para a mais recente. */
export function AprsDaOs({ aprs }: { aprs: AprDaOs[] }) {
  return (
    <Panel>
      <div className="stack" style={{ gap: 2 }}>
        <h2>APRs desta OS · {aprs.length}</h2>
        <span className="muted">Cada tentativa tem a própria APR; as bloqueadas ficam no histórico.</span>
      </div>
      {aprs.length === 0 ? (
        <p className="muted">Nenhuma APR registrada ainda.</p>
      ) : (
        aprs.map((apr, i) => <AprCartao key={apr.id} apr={apr} numero={i + 1} total={aprs.length} />)
      )}
    </Panel>
  );
}

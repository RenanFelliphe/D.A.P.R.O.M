import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ROTULO_DO_ESTADO_DA_CONFERENCIA, pedeAcaoDoUsuario, prazoDaConferencia, rotuloDaAcao, type ConferenciaResumo } from "@/lib/conferencia";
import { rotas } from "@/lib/rotas";

const seloDoEstado = { aguardando_sincronizacao: "al", aguardando_responsavel: "al", aguardando_assinaturas: "lib", concluida: "enc", fechada_sem_todos: "neu" } as const;

/**
 * "Para conferir": as conferências da execução em aberto de quem está logado, com o estado, o prazo e o que falta dele (escolher, dar a ciência,
 * assinar, fechar ou só acompanhar). Cada linha leva à tela da conferência. Some quando não há nenhuma.
 */
export function ParaConferir({ conferencias, agora }: { conferencias: ConferenciaResumo[]; agora: Date }) {
  if (conferencias.length === 0) return null;
  return (
    <section className="stack g8" data-treino="perfil-para-conferir">
      <h2>Para conferir</h2>
      <div className="list-box">
        {conferencias.map((c) => (
          <div key={c.id} className="list-row" style={{ minHeight: 64, flexWrap: "wrap" }}>
            <span className="stack" style={{ flex: 1, minWidth: 200, lineHeight: 1.3 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                {c.os.numero_ordem ? `OS ${c.os.numero_ordem}` : "OS sem número"}
              </span>
              <span style={{ fontSize: 14 }}>{c.os.titulo}</span>
              <span className="small">{prazoDaConferencia(c, agora) ?? "Concluída"}</span>
            </span>
            <Badge tone={seloDoEstado[c.estado]}>{ROTULO_DO_ESTADO_DA_CONFERENCIA[c.estado]}</Badge>
            <Link className={pedeAcaoDoUsuario(c) ? "btn btn-p btn-sm" : "btn btn-line btn-sm"} href={rotas.app.conferencia(c.os.id, c.id)}>
              {rotuloDaAcao(c.minha_acao)}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

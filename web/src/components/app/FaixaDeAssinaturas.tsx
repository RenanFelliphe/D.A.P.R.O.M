import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { hora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

/** Uma APR de hoje que espera a assinatura de quem pergunta (`GET /me/aprs-para-assinar`). */
interface AprParaAssinar {
  apr_id: string;
  os_id: string;
  numero_ordem: string | null;
  titulo: string;
  local_codigo: string;
  concluida_em: string;
  preenchida_por: string;
  preenchida_por_nome: string;
  funcao: "responsavel" | "executor";
}

/**
 * Faixa "APR aguardando a sua assinatura": as APRs aprovadas de hoje em que a pessoa é participante e ainda não assinou nem recusou,
 * cada uma com o link para a tela de assinatura. Fica acima do quadro de OS e no detalhe da OS (com `osId`, só a APR dessa OS); sem
 * APR pendente não desenha nada. É um aviso de apoio: se a consulta falhar, a tela segue sem ele.
 */
export async function FaixaDeAssinaturas({ osId }: { osId?: string }) {
  let aprs: AprParaAssinar[] = [];
  try {
    aprs = (await api<{ aprs: AprParaAssinar[] }>("/me/aprs-para-assinar")).aprs;
  } catch {
    return null;
  }
  if (osId) aprs = aprs.filter((a) => a.os_id === osId);
  if (aprs.length === 0) return null;

  return (
    <section className="notice n-al" aria-label="APR aguardando a sua assinatura" data-treino="faixa-assinaturas" style={{ flexDirection: "column" }}>
      <div className="row g8">
        <Icon name="clip" size={18} />
        <strong>{aprs.length === 1 ? "APR aguardando a sua assinatura" : `${aprs.length} APRs aguardando a sua assinatura`}</strong>
      </div>
      <p>A execução só começa quando todos os participantes assinam, cada um na própria conta. Assine, ou recuse se não concorda (direito de recusa).</p>
      <div className="stack g6" style={{ width: "100%" }}>
        {aprs.map((a) => (
          <div key={a.apr_id} className="row between wrap g8">
            <span>
              <strong className="mono">{a.numero_ordem ? `OS ${a.numero_ordem}` : "OS sem número"}</strong> · {a.titulo} · {a.local_codigo}
              <span className="small"> · APR de {a.preenchida_por_nome} às {hora(a.concluida_em)}</span>
            </span>
            <Link className="btn btn-p btn-sm" href={rotas.app.aprovada(a.os_id)}>
              Assinar a APR
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

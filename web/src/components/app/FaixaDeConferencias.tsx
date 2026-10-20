import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { apiOuNulo } from "@/lib/api";
import { pedeAtencaoNaFaixa, rotuloDaAcao, type ConferenciaResumo } from "@/lib/conferencia";
import { rotas } from "@/lib/rotas";

/**
 * Faixa "Conferência da execução esperando você": as conferências em que falta a escolha, a ciência ou a assinatura de quem pergunta
 * (`GET /me/conferencias`), cada uma com o link para a tela. Fica acima do quadro de OS e no detalhe da OS (com `osId`, só a dessa OS);
 * sem pendência não desenha nada. É um aviso de apoio: lê uma vez na carga da página (que já se atualiza sozinha) e, se a consulta
 * falhar ou não existir (Campo de treino), a tela segue sem ele.
 */
export async function FaixaDeConferencias({ osId }: { osId?: string }) {
  let lista: ConferenciaResumo[] = [];
  try {
    lista = (await apiOuNulo<{ conferencias: ConferenciaResumo[] }>("/me/conferencias"))?.conferencias ?? [];
  } catch {
    return null;
  }
  lista = lista.filter((c) => pedeAtencaoNaFaixa(c) && (!osId || c.os.id === osId));
  if (lista.length === 0) return null;

  return (
    <section className="notice n-al" aria-label="Conferência da execução esperando você" data-treino="faixa-conferencias" style={{ flexDirection: "column" }}>
      <div className="row g8">
        <Icon name="checks" size={18} />
        <strong>{lista.length === 1 ? "Conferência da execução esperando você" : `${lista.length} conferências da execução esperando você`}</strong>
      </div>
      <p>A equipe registrou parte do serviço sem sinal, em aparelhos diferentes. Confira o que cada aparelho guardou.</p>
      <div className="stack g6" style={{ width: "100%" }}>
        {lista.map((c) => (
          <div key={c.id} className="row between wrap g8">
            <span>
              <strong className="mono">{c.os.numero_ordem ? `OS ${c.os.numero_ordem}` : "OS sem número"}</strong> · {c.os.titulo}
            </span>
            <Link className="btn btn-p btn-sm" href={rotas.app.conferencia(c.os.id, c.id)}>
              {rotuloDaAcao(c.minha_acao)}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

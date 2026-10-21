import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { VitoriaNaCena } from "@/components/web/treinamento-servico/vitoria/VitoriaNaCena";
import { rotas } from "@/lib/rotas";
import { codigoDaRota } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Treinamento indisponível" };

/**
 * Para onde as telas do editor levam quem a `api` recusou: o rascunho é de outra pessoa (só o autor e o admin o editam) ou a pessoa
 * não cria treinamento neste serviço. A mensagem vem da própria `api`, com o nome do autor.
 */
export default async function TreinamentoIndisponivelPage({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ motivo?: string; detalhe?: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const { motivo, detalhe } = await searchParams;
  const outroAutor = motivo === "outro_autor";

  return (
    <section className="panel ts-sem-rascunho">
      <VitoriaNaCena chave="indisponivel" reacao="atencao" tamanho={96}>
        <strong className="ts-balao-titulo">{outroAutor ? "O rascunho é de outra pessoa" : "Você não pode editar este treinamento"}</strong>
        <p>
          {outroAutor
            ? (detalhe?.slice(0, 200) ?? "Só quem começou o rascunho (e o administrador) o edita, para duas pessoas não mudarem o mesmo treinamento ao mesmo tempo.")
            : "Cria treinamento o administrador e o supervisor de uma equipe que já faz o serviço."}
        </p>
      </VitoriaNaCena>
      <div className="row g8 wrap">
        <LinkButton variant="line" href={rotas.app.catalogo}>
          <Icon name="left" size={16} />
          Voltar ao catálogo
        </LinkButton>
        <LinkButton variant="ghost" href={rotas.app.treinamentoServico(codigo, "validar")}>
          Ver a validação
        </LinkButton>
      </div>
    </section>
  );
}

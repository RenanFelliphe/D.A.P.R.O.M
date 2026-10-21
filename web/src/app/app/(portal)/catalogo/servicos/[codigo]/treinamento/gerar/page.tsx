import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { FaixaDaValidacao } from "@/components/web/treinamento-servico/editor/FaixaDaValidacao";
import { GerarComVitoria } from "@/components/web/treinamento-servico/editor/GerarComVitoria";
import { rotas } from "@/lib/rotas";
import { codigoDaRota, rascunhoDoTreinamento, servicoDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Gerar com a Vitória" };

/** Gerar com a Vitória: o texto do procedimento vira um rascunho, que o admin valida em seguida. */
export default async function GerarTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [servico, rascunho] = await Promise.all([servicoDoTreinamento(codigo), rascunhoDoTreinamento(codigo)]);
  const materiais = (servico?.materiais ?? []).filter((m) => m.ativo).map((m) => m.descricao);

  return (
    <>
      <Link className="ts-voltar" href={rotas.app.treinamentoServico(codigo, "criar")}>
        <Icon name="left" size={16} />
        Voltar à escolha
      </Link>
      <FaixaDaValidacao codigo={codigo} travar>
      {rascunho.ia.disponivel ? (
        <GerarComVitoria codigo={codigo} rascunho={rascunho} materiais={materiais} />
      ) : (
        <Notice tone="al" icon="alert">
          <span className="stack g8">
            <span>{rascunho.ia.motivo ?? "A IA não está configurada neste ambiente"}, então a Vitória não monta rascunhos. O editor manual funciona normalmente.</span>
            <LinkButton variant="line" sm href={rotas.app.treinamentoServico(codigo, "explicacao")}>
              Criar manualmente
            </LinkButton>
          </span>
        </Notice>
      )}
      </FaixaDaValidacao>
    </>
  );
}

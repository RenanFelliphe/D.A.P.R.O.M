import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PublicarTreinamento } from "@/components/web/treinamento-servico/editor/PublicarTreinamento";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { codigoDaRota, rascunhoSeHouver, servicoDoTreinamento, versoesDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Publicar treinamento" };

/**
 * Publicar: requisitos, termo e assinatura do perfil. Não cria rascunho: depois de publicar a tela se atualiza sem rascunho
 * (e mostra a comemoração), em vez de abrir a versão seguinte.
 */
export default async function PublicarTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [{ usuario }, servico, versoes, rascunho] = await Promise.all([usuarioAtual(), servicoDoTreinamento(codigo), versoesDoTreinamento(codigo), rascunhoSeHouver(codigo)]);
  const noAr = versoes.find((v) => v.estado === "publicada")?.versao ?? null;

  return (
    <>
      <Link className="ts-voltar" href={rotas.app.treinamentoServico(codigo, "revisao")}>
        <Icon name="left" size={16} />
        Voltar à revisão
      </Link>
      <PublicarTreinamento codigo={codigo} descricao={servico?.descricao ?? codigo} rascunho={rascunho} versaoNoAr={noAr} assinaturaPath={usuario.assinatura_path} />
    </>
  );
}

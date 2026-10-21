import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PublicarTreinamento } from "@/components/web/treinamento-servico/editor/PublicarTreinamento";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin } from "@/lib/tipos";
import { codigoDaRota, rascunhoSeHouver, servicoDoTreinamento, validacaoDoTreinamento, versoesDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Enviar para validação · Treinamento" };

/**
 * Publicar: requisitos, quem valida, termo e assinatura do perfil (enviar para a validação dos supervisores; o admin também publica direto). Não cria rascunho: depois de publicar a tela se atualiza sem rascunho
 * (e mostra a comemoração), em vez de abrir a versão seguinte.
 */
export default async function PublicarTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [{ usuario }, servico, versoes, rascunho, validacao] = await Promise.all([
    usuarioAtual(),
    servicoDoTreinamento(codigo),
    versoesDoTreinamento(codigo),
    rascunhoSeHouver(codigo),
    validacaoDoTreinamento(codigo),
  ]);
  const noAr = versoes.find((v) => v.estado === "publicada")?.versao ?? null;

  return (
    <>
      <Link className="ts-voltar" href={rotas.app.treinamentoServico(codigo, "revisao")}>
        <Icon name="left" size={16} />
        Voltar à revisão
      </Link>
      <PublicarTreinamento
        codigo={codigo}
        descricao={servico?.descricao ?? codigo}
        rascunho={rascunho}
        versaoNoAr={noAr}
        assinaturaPath={usuario.assinatura_path}
        validacao={validacao}
        admin={ehAdmin(usuario)}
      />
    </>
  );
}

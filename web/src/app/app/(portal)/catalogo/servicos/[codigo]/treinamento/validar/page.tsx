import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ValidarTreinamento } from "@/components/web/treinamento-servico/editor/ValidarTreinamento";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { codigoDaRota, materiaisDoCatalogo, servicoDoTreinamento, validacaoDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Validar treinamento" };

/**
 * Validar: o treinamento enviado pelo autor, com as respostas certas, para o supervisor de uma das equipes escolhidas aprovar (com a
 * assinatura do perfil) ou recusar (com o motivo). Quem não participa da validação vê o aviso, sem erro.
 */
export default async function ValidarTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [{ usuario }, servico, validacao, catalogo] = await Promise.all([usuarioAtual(), servicoDoTreinamento(codigo), validacaoDoTreinamento(codigo), materiaisDoCatalogo()]);
  const nomes = Object.fromEntries([...catalogo.map((m) => [m.id, m.descricao] as const), ...(servico?.materiais ?? []).map((m) => [m.material_id, m.descricao] as const)]);

  return (
    <>
      <Link className="ts-voltar" href={rotas.app.treinamentosParaValidar}>
        <Icon name="left" size={16} />
        Treinamentos para validar
      </Link>
      <ValidarTreinamento codigo={codigo} descricao={servico?.descricao ?? codigo} validacao={validacao} nomes={nomes} assinaturaPath={usuario.assinatura_path ?? null} />
    </>
  );
}

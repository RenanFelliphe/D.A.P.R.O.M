import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { editaCatalogo } from "@/components/web/catalogo/secao";
import { AssistenteDeSugestao } from "@/components/web/sugestao/AssistenteDeSugestao";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { APRESENTACAO_DA_SUGESTAO } from "@/lib/sugestao-materiais";
import { equipesDoServico, servicoDoCatalogo } from "@/lib/sugestao-materiais-servidor";
import { codigoDaRota } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Sugerir materiais" };

/**
 * Sugerir uma lista ou contestar a lista recomendada de um serviço (`?tipo=sugestao|contestacao`). O administrador não passa por
 * aqui: edita a lista direto no catálogo.
 */
export default async function SugerirMateriaisPage({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const { tipo: tipoPedido } = await searchParams;
  const { usuario } = await usuarioAtual();
  if (editaCatalogo(usuario)) redirect(`${rotas.app.catalogo}?busca=${encodeURIComponent(codigo)}`);
  const tipo = tipoPedido === "contestacao" ? "contestacao" : "sugestao";
  const [servico, equipes] = await Promise.all([servicoDoCatalogo(codigo), equipesDoServico(codigo)]);
  if (!servico) notFound();

  return (
    <>
      <Link className="ts-voltar" href={`${rotas.app.catalogo}?busca=${encodeURIComponent(codigo)}`}>
        <Icon name="left" size={16} />
        Voltar ao serviço
      </Link>
      <div className="stack g4">
        <h2 className="sg-titulo-fluxo">{APRESENTACAO_DA_SUGESTAO[tipo].titulo}</h2>
        <p className="muted small" style={{ maxWidth: 720 }}>
          {APRESENTACAO_DA_SUGESTAO[tipo].texto}
        </p>
      </div>
      <AssistenteDeSugestao key={tipo} tipo={tipo} codigo={codigo} descricao={servico.descricao} atual={servico.materiais} equipes={equipes} />
    </>
  );
}

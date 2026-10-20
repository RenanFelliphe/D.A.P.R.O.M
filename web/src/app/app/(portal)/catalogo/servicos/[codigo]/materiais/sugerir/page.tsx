import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { editaCatalogo } from "@/components/web/catalogo/secao";
import { AssistenteDeSugestao } from "@/components/web/sugestao/AssistenteDeSugestao";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
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
        <h2 className="sg-titulo-fluxo">{tipo === "sugestao" ? "Sugerir uma lista de materiais" : "Contestar a lista recomendada"}</h2>
        <p className="muted small" style={{ maxWidth: 720 }}>
          {tipo === "sugestao"
            ? "Quem faz o serviço no campo sabe o que ele pede. Monte a lista que você acha certa; o supervisor da equipe que mais faz este serviço avalia."
            : "Se a lista recomendada está errada, diga por quê. O supervisor da equipe que mais faz este serviço avalia, e você pode já sugerir a lista certa."}
        </p>
      </div>
      <AssistenteDeSugestao key={tipo} tipo={tipo} codigo={codigo} descricao={servico.descricao} atual={servico.materiais} equipes={equipes} />
    </>
  );
}

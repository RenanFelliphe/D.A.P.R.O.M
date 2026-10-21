import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { codigoDaRota, meusServicosDeTreinamento, servicoDoTreinamento, validacaoDoTreinamento, versoesDoTreinamento } from "@/lib/treinamento-servico-servidor";
import { textoDoAndamento } from "@/lib/treinamento-validacao";
import { ehAdmin } from "@/lib/tipos";

/**
 * O treinamento de serviço de quem cria (seção 3.5 do `vitoria.md` e `validacao-de-treinamento.md`): o admin, e o supervisor de
 * equipe que faz o serviço. O caminho, o título e a situação (no ar, rascunho em edição, em validação) valem para todas as telas.
 * As abas ficam em `(painel)`; Criar, Gerar, Publicar e Validar são telas de fluxo, sem abas, com a volta para a visão geral.
 * Quem não pode criar neste serviço vê o porquê, em vez de ser mandado para outra tela sem explicação.
 */
export default async function TreinamentoServicoLayout({ children, params }: { children: ReactNode; params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const { usuario } = await usuarioAtual();
  const meus = await meusServicosDeTreinamento();
  const ehQuemCria = ehAdmin(usuario) || meus.admin || meus.servicos.includes(codigo);
  // Quem não cria pode estar aqui para validar (a `api` só devolve a validação a quem participa dela).
  const validacao = await validacaoDoTreinamento(codigo);
  if (!ehQuemCria && !validacao) return <SemAcesso />;

  const servico = await servicoDoTreinamento(codigo);
  if (!servico) notFound();
  const versoes = await versoesDoTreinamento(codigo);
  const publicada = versoes.find((v) => v.estado === "publicada");
  const rascunho = versoes.find((v) => v.estado === "rascunho");

  return (
    <Screen className="ts-pagina">
      <nav className="crumb" aria-label="Caminho">
        <Link href={rotas.app.catalogo}>Catálogo</Link>
        <span aria-hidden="true">/</span>
        <span className="mono">{codigo}</span>
        <span aria-hidden="true">/</span>
        <Link href={rotas.app.treinamentoServico(codigo)}>Treinamento</Link>
      </nav>
      <header className="ts-cabecalho">
        <div className="ts-cabecalho-texto">
          <span className="lbl">Treinamento de serviço</span>
          <h1>{servico.descricao}</h1>
        </div>
        <div className="ts-cabecalho-selos">
          {publicada ? <Badge tone="enc">No ar · versão {publicada.versao}</Badge> : <Badge tone="neu">Não publicado</Badge>}
          {rascunho && (validacao?.em_validacao ? <Badge tone="exe">Em validação · {textoDoAndamento(validacao)}</Badge> : <Badge tone="al">Rascunho · versão {rascunho.versao}</Badge>)}
        </div>
      </header>
      {children}
    </Screen>
  );
}

function SemAcesso() {
  return (
    <Screen className="ts-pagina">
      <section className="panel ts-sem-acesso" role="status">
        <Notice tone="info" icon="info">
          <span className="stack g8">
            <strong>Você não cria treinamento para este serviço</strong>
            <span>
              Cria treinamento o administrador e o supervisor de uma equipe que já faz o serviço. Se você supervisiona uma equipe que o faz e mesmo assim não vê as telas, avise o
              administrador.
            </span>
          </span>
        </Notice>
        <div className="row g8 wrap">
          <LinkButton variant="line" href={rotas.app.catalogo}>
            <Icon name="left" size={16} />
            Voltar ao catálogo
          </LinkButton>
        </div>
      </section>
    </Screen>
  );
}

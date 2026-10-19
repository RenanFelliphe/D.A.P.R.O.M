"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { Notice } from "@/components/ui/Notice";
import { rotas } from "@/lib/rotas";
import { REACOES_DO_PASSO, infoDoTipo, reacaoNormal, requisitosDePublicacao, type ConteudoDoRascunho, type ExpressaoVitoria, type MetaIA, type RascunhoComIA } from "@/lib/treinamento-servico";
import { useToast } from "@/state/toast";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { AvisoDeVersaoNova } from "./AvisoDeVersaoNova";
import { BotaoTestar } from "./BotaoTestar";
import { ChatDeAjustes } from "./ChatDeAjustes";
import { GabaritoDaFase } from "./GabaritoDaFase";
import { OrigemDaVitoria, SeloDoItem, situacaoDoItem } from "./OrigemDaVitoria";
import { useRascunho } from "./useRascunho";
import { useRascunhoIA } from "./useRascunhoIA";

interface RevisaoDoRascunhoProps {
  codigo: string;
  descricao: string;
  rascunho: RascunhoComIA;
  nomes: Record<string, string>;
}

const rotuloDaReacao = (expressao: ExpressaoVitoria) => (reacaoNormal(expressao) ? "Normal" : (REACOES_DO_PASSO.find((r) => r.expressao === expressao)?.rotulo ?? "Normal"));

/**
 * A validação do rascunho (aba Revisão): o treinamento inteiro como o técnico vai ver, com a resposta certa de cada fase. Nos
 * itens da Vitória, o trecho de origem e as pendências, que somem ao editar o item ou ao confirmá-lo como está (grava na hora).
 * Ao lado, os ajustes pelo chat e o caminho até publicar: testar o jogo e assinar.
 */
export function RevisaoDoRascunho({ codigo, descricao, rascunho: inicial, nomes }: RevisaoDoRascunhoProps) {
  const roteador = useRouter();
  const exibirAviso = useToast();
  const r = useRascunho(codigo, inicial);
  const ia = useRascunhoIA(codigo, inicial.ia, {
    salvarAntes: r.garantirSalvo,
    aoConcluir: (resultado) => {
      r.substituir(resultado.rascunho);
      exibirAviso(resultado.rascunho.pendencias.length > 0 ? "A Vitória atualizou o rascunho. Confira as pendências." : "A Vitória atualizou o rascunho.");
      roteador.refresh();
    },
  });
  const [filtro, setFiltro] = useState<"tudo" | "pendentes">("tudo");
  const { explicacao, fases } = r.conteudo;
  const travado = r.salvando || ia.trabalhando;
  const pendentes = r.pendencias.length;
  const itensDaVitoria = [...explicacao, ...fases].filter((i) => i.ia);
  const conferidos = itensDaVitoria.filter((i) => situacaoDoItem(i) !== "pendente").length;
  const requisitos = requisitosDePublicacao(r.conteudo, pendentes);
  const publicavel = requisitos.every((q) => q.ok);
  const nomeDoMaterial = (id: string) => nomes[id] ?? "Material fora da lista";
  const mostrar = (item: { ia?: MetaIA | null }) => filtro === "tudo" || situacaoDoItem(item) === "pendente";

  function confirmar(parte: "passo" | "fase", indice: number) {
    const conferir = <T extends { ia?: MetaIA | null }>(item: T, i: number): T => (i === indice && item.ia ? { ...item, ia: { ...item.ia, conferido: true } } : item);
    const novo: ConteudoDoRascunho = parte === "passo" ? { ...r.conteudo, explicacao: explicacao.map(conferir) } : { ...r.conteudo, fases: fases.map(conferir) };
    void r.trocarESalvar(novo);
  }

  if (explicacao.length + fases.length === 0) {
    return (
      <div className="ts-vazio ts-vazio-grande">
        <Icon name="list" size={24} />
        <strong>Ainda não há o que revisar</strong>
        <span className="small">Gere o rascunho com a Vitória ou escreva a explicação e as fases à mão.</span>
        <LinkButton variant="p" sm href={rotas.app.treinamentoServico(codigo, "criar")}>
          Criar o conteúdo
        </LinkButton>
      </div>
    );
  }

  const fala =
    itensDaVitoria.length === 0
      ? { reacao: null, titulo: "Confira tudo como o técnico vai ver", texto: "As falas, as perguntas e as respostas certas. Se algo estiver errado, toque em Editar no item." }
      : pendentes > 0
        ? {
            reacao: "pensando" as const,
            titulo: pendentes === 1 ? "Encontrei 1 ponto para você conferir" : `Encontrei ${pendentes} pontos para você conferir`,
            texto: "Cada item mostra o trecho do procedimento de onde eu tirei. Edite o item ou confirme-o como está.",
          }
        : { reacao: "certo" as const, titulo: "Tudo conferido!", texto: "Agora teste o jogo como o técnico vai jogar e publique quando estiver de acordo." };

  return (
    <div className="ts-editor">
      <AvisoDeVersaoNova rascunho={inicial} />
      <section className="panel ts-revisao-topo">
        <VitoriaNaCena chave={`revisao-${fala.reacao}`} reacao={fala.reacao} tamanho={92}>
          <strong className="ts-balao-titulo">{fala.titulo}</strong>
          <p>{fala.texto}</p>
        </VitoriaNaCena>
        <dl className="ts-numeros">
          <div>
            <dt>Passos</dt>
            <dd>{explicacao.length}</dd>
          </div>
          <div>
            <dt>Fases</dt>
            <dd>{fases.length}</dd>
          </div>
          <div data-alerta={pendentes > 0 || undefined}>
            <dt>Pendências</dt>
            <dd>{pendentes}</dd>
          </div>
          {itensDaVitoria.length > 0 && (
            <div>
              <dt>Validados</dt>
              <dd>
                {conferidos}/{itensDaVitoria.length}
              </dd>
            </div>
          )}
        </dl>
        {itensDaVitoria.length > 0 && (
          <div className="progress ts-revisao-barra" aria-hidden="true">
            <i style={{ width: `${Math.round((conferidos / itensDaVitoria.length) * 100)}%` }} />
          </div>
        )}
      </section>

      {r.erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {r.erro}
        </Notice>
      )}

      <div className="ts-editor-grade">
        <div className="ts-editor-principal">
          {itensDaVitoria.length > 0 && (
            <div className="ts-filtro" role="tablist" aria-label="Filtrar os itens">
              <button type="button" role="tab" aria-selected={filtro === "tudo"} onClick={() => setFiltro("tudo")}>
                Tudo
              </button>
              <button type="button" role="tab" aria-selected={filtro === "pendentes"} onClick={() => setFiltro("pendentes")}>
                Com pendência <span className="ts-filtro-qtd">{pendentes}</span>
              </button>
            </div>
          )}
          {filtro === "pendentes" && pendentes === 0 && (
            <div className="ts-vazio">
              <Icon name="check" size={24} />
              <strong>Nenhuma pendência</strong>
              <span className="small">Todos os itens da Vitória foram editados ou confirmados.</span>
            </div>
          )}

          <SecaoDaRevisao titulo="Parte 1 · Explicação" vazia={!explicacao.some(mostrar)} link={rotas.app.treinamentoServico(codigo, "explicacao")}>
            {explicacao.map((passo, i) =>
              mostrar(passo) ? (
                <ItemDaRevisao
                  key={`p${i}`}
                  rotulo={`Passo ${i + 1}`}
                  numero={i + 1}
                  item={passo}
                  editar={`${rotas.app.treinamentoServico(codigo, "explicacao")}#passo-${i + 1}`}
                  aoConfirmar={() => confirmar("passo", i)}
                  travado={travado}
                >
                  <div className="ts-revisao-passo">
                    <span className="ts-chip">Reação: {rotuloDaReacao(passo.expressao)}</span>
                    <p>{passo.texto}</p>
                    {passo.imagem_path && (
                      <span className="ts-revisao-imagem">
                        <ImagemArquivo id={passo.imagem_path} alt={`Imagem do passo ${i + 1}`} />
                      </span>
                    )}
                  </div>
                </ItemDaRevisao>
              ) : null,
            )}
          </SecaoDaRevisao>

          <SecaoDaRevisao titulo="Parte 2 · Jogo" vazia={!fases.some(mostrar)} link={rotas.app.treinamentoServico(codigo, "fases")}>
            {fases.map((fase, i) =>
              mostrar(fase) ? (
                <ItemDaRevisao
                  key={`f${i}`}
                  rotulo={`Fase ${i + 1} · ${infoDoTipo(fase.tipo).rotulo}`}
                  numero={i + 1}
                  item={fase}
                  editar={`${rotas.app.treinamentoServico(codigo, "fases")}#fase-${i + 1}`}
                  aoConfirmar={() => confirmar("fase", i)}
                  travado={travado}
                  acoes={
                    ia.situacao.pode_ajustar && (
                      <Button variant="ghost" sm onClick={() => ia.regerarFase(i)} disabled={travado}>
                        <Icon name="sparkle" size={13} />
                        Regerar com a Vitória
                      </Button>
                    )
                  }
                >
                  <GabaritoDaFase fase={fase} nomeDoMaterial={nomeDoMaterial} />
                </ItemDaRevisao>
              ) : null,
            )}
          </SecaoDaRevisao>
        </div>

        <aside className="ts-editor-lado" aria-label="Ajustes e próximos passos">
          <section className="panel ts-proximos">
            <h3>Depois da revisão</h3>
            <ol className="ts-proximos-lista">
              <li>
                <span className="ts-proximo-num">1</span>
                <div className="stack g8">
                  <span>Jogue o rascunho como o técnico vai jogar. O teste não pontua.</span>
                  <BotaoTestar codigo={codigo} descricao={descricao} conteudo={r.conteudo} salvarAntes={r.garantirSalvo} desabilitado={travado} block />
                </div>
              </li>
              <li>
                <span className="ts-proximo-num">2</span>
                <div className="stack g8">
                  <span>Publique com a sua assinatura.</span>
                  {publicavel ? (
                    <LinkButton variant="p" block href={rotas.app.treinamentoServico(codigo, "publicar")}>
                      Ir para a publicação
                      <Icon name="right" size={16} />
                    </LinkButton>
                  ) : (
                    <>
                      <Button variant="p" block disabled>
                        Ir para a publicação
                      </Button>
                      <ul className="ts-faltando">
                        {requisitos
                          .filter((q) => !q.ok)
                          .map((q) => (
                            <li key={q.chave}>
                              <Icon name="x" size={13} />
                              {q.rotulo} <span className="small">({q.detalhe})</span>
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                </div>
              </li>
            </ol>
          </section>
          {ia.situacao.disponivel && ia.situacao.usa_ia && <ChatDeAjustes ia={ia} desabilitado={r.salvando} />}
        </aside>
      </div>
    </div>
  );
}

function SecaoDaRevisao({ titulo, vazia, link, children }: { titulo: string; vazia: boolean; link: string; children: ReactNode }) {
  if (vazia) return null;
  return (
    <section className="ts-secao-lista">
      <div className="ts-secao-cab">
        <h2>{titulo}</h2>
        <LinkButton variant="ghost" sm href={link}>
          <Icon name="pencil" size={13} />
          Abrir o editor
        </LinkButton>
      </div>
      <ol className="ts-lista-itens">{children}</ol>
    </section>
  );
}

function ItemDaRevisao({
  rotulo,
  numero,
  item,
  editar,
  aoConfirmar,
  travado,
  acoes,
  children,
}: {
  rotulo: string;
  numero: number;
  item: { ia?: MetaIA | null };
  editar: string;
  aoConfirmar: () => void;
  travado: boolean;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="ts-item-editor ts-revisao-item" data-estado={situacaoDoItem(item)}>
      <div className="ts-item-cab">
        <span className="ts-item-num">{numero}</span>
        <strong className="ts-item-titulo">{rotulo}</strong>
        <SeloDoItem item={item} />
        <LinkButton variant="ghost" sm href={editar} className="ts-item-editar">
          <Icon name="pencil" size={13} />
          Editar
        </LinkButton>
      </div>
      {children}
      <OrigemDaVitoria item={item} aoConfirmar={aoConfirmar} acoes={acoes} desabilitado={travado} />
    </li>
  );
}

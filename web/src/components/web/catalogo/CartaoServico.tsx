"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BotaoEquipesDoServico } from "@/components/web/sugestao/BotaoEquipesDoServico";
import { BotaoVerRanking } from "@/components/web/treinamento-servico/BotaoVerRanking";
import { BotaoTreinar } from "@/components/web/treinamento-servico/jogo/BotaoTreinar";
import { TreinamentoNoCartao } from "@/components/web/treinamento-servico/TreinamentoNoCartao";
import type { ServicoDoCatalogo } from "@/lib/catalogo";
import { rotas } from "@/lib/rotas";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";
import { EditorDoServico } from "./EditorDoServico";
import { ListaDoServico } from "./ListaDoServico";

/**
 * Um serviço do catálogo: o código, a descrição e o rodapé em duas linhas: "Equipes do serviço" e "Ver materiais" lado a
 * lado e, embaixo, ocupando a linha toda, "Jogar treinamento" (o jogo numa janela; só com treinamento publicado). "Ver
 * materiais" sempre aparece e abre no próprio cartão a lista do que o serviço leva para o campo e, para quem não é admin,
 * "Sugerir lista" e "Contestar lista" (o supervisor da equipe que mais faz o serviço avalia). Com treinamento publicado, o
 * cartãozinho da Vitória fica à vista, com "Ver ranking". O admin edita a lista aqui mesmo e, em vez de jogar, abre o
 * treinamento no editor (ou o cria).
 */
export function CartaoServico({
  servico,
  podeEditar,
  treinamento = null,
  colaboracao = true,
}: {
  servico: ServicoDoCatalogo;
  podeEditar: boolean;
  treinamento?: TreinamentoResumo | null;
  /** Sugerir, contestar e ver as equipes: desligado no Campo de treino, onde a API fictícia não conhece as sugestões. */
  colaboracao?: boolean;
}) {
  const idLista = useId();
  const [editando, setEditando] = useState(false);
  const [verMateriais, setVerMateriais] = useState(false);
  const total = servico.materiais.length;
  const temMateriais = total > 0;

  return (
    <section className="panel cartao-servico" aria-label={`Serviço ${servico.codigo}`}>
      <div className="cartao-servico-cab">
        <div className="cartao-servico-titulo">
          <span className="mono small cartao-servico-codigo">
            {servico.codigo}
            {servico.provisorio && (
              <Badge tone="al" style={{ padding: "0 7px", fontSize: 11 }}>
                Provisório
              </Badge>
            )}
          </span>
          <h2>{servico.descricao}</h2>
          <span className="small">{total === 0 ? "Nenhum material na lista" : total === 1 ? "1 item na lista" : `${total} itens na lista`}</span>
        </div>
        {podeEditar && !editando && (
          <Button variant="line" sm className="cartao-servico-editar" onClick={() => setEditando(true)}>
            <Icon name="pencil" size={13} />
            Editar lista
          </Button>
        )}
      </div>

      {treinamento && (
        <TreinamentoNoCartao treinamento={treinamento} admin={podeEditar} acao={<BotaoVerRanking codigo={servico.codigo} descricao={servico.descricao} sm />} />
      )}

      {editando ? (
        <EditorDoServico servico={servico} aoFechar={() => setEditando(false)} />
      ) : (
        <>
            <div className="cartao-servico-acoes">
              {colaboracao && <BotaoEquipesDoServico codigo={servico.codigo} descricao={servico.descricao} sm />}
              {/* O texto não muda ao abrir (a seta vira): um texto mais largo empurraria o botão para outra linha. */}
              <Button
                variant="line"
                sm
                className={colaboracao ? undefined : "cartao-servico-largo"}
                aria-expanded={verMateriais}
                aria-controls={idLista}
                title={verMateriais ? "Ocultar os materiais" : undefined}
                onClick={() => setVerMateriais((v) => !v)}
              >
                <Icon name="box" size={13} />
                Ver materiais
                <Icon name="down" size={13} className="cartao-servico-seta" />
              </Button>
              {/* O painel abre entre as duas linhas: "Ver materiais" fica onde está, e o treinamento desce. */}
              {verMateriais && (
                <div id={idLista} className="cartao-servico-lista">
                  {temMateriais ? <ListaDoServico materiais={servico.materiais} /> : <p className="small muted">Nenhum material na lista deste serviço ainda.</p>}
                  {colaboracao && !podeEditar && (
                    <div className="cartao-servico-colaborar">
                      <LinkButton variant="line" sm href={rotas.app.sugerirMateriais(servico.codigo, "sugestao")}>
                        <Icon name="pencil" size={13} />
                        Sugerir lista
                      </LinkButton>
                      {temMateriais && (
                        <LinkButton variant="line" sm href={rotas.app.sugerirMateriais(servico.codigo, "contestacao")}>
                          <Icon name="alert" size={13} />
                          Contestar lista
                        </LinkButton>
                      )}
                    </div>
                  )}
                </div>
              )}
              {treinamento &&
                (podeEditar ? (
                  <LinkButton variant="p" sm className="cartao-servico-treinar" href={rotas.app.treinamentoServico(servico.codigo)}>
                    <Icon name="pencil" size={13} />
                    Abrir treinamento
                  </LinkButton>
                ) : (
                  <BotaoTreinar codigo={servico.codigo} jaConcluiu={treinamento.concluido} rotulo="Jogar treinamento" sm className="cartao-servico-treinar" />
                ))}
              {!treinamento && podeEditar && (
                <LinkButton variant="ghost" sm className="cartao-servico-treinar" href={rotas.app.treinamentoServico(servico.codigo)}>
                  <Icon name="plus" size={13} />
                  Criar treinamento
                </LinkButton>
              )}
            </div>
        </>
      )}
    </section>
  );
}

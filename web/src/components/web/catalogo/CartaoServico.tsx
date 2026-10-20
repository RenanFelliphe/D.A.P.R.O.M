"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { BotaoEquipesDoServico } from "@/components/web/sugestao/BotaoEquipesDoServico";
import { JanelaDeSugestao } from "@/components/web/sugestao/JanelaDeSugestao";
import { BotaoVerRanking } from "@/components/web/treinamento-servico/BotaoVerRanking";
import { BotaoTreinar } from "@/components/web/treinamento-servico/jogo/BotaoTreinar";
import { TreinamentoNoCartao } from "@/components/web/treinamento-servico/TreinamentoNoCartao";
import type { ServicoDoCatalogo } from "@/lib/catalogo";
import { rotas } from "@/lib/rotas";
import type { TipoDeSugestao } from "@/lib/sugestao-materiais";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";
import { EditorDoServico } from "./EditorDoServico";
import { ListaDoServico } from "./ListaDoServico";

/**
 * Um serviço do catálogo: o código, a descrição e o rodapé em duas linhas: "Equipes do serviço" e "Ver materiais" lado a
 * lado e, embaixo, ocupando a linha toda, "Jogar treinamento" (o jogo numa janela; só com treinamento publicado). "Ver
 * materiais" sempre aparece e abre no próprio cartão a lista do que o serviço leva para o campo e, embaixo dela, as ações
 * da lista, cada uma numa janela: para o admin, "Editar lista" (ou "Adicionar materiais", sem nenhum); para os outros,
 * "Sugerir lista" e "Contestar lista" (o supervisor da equipe que mais faz o serviço avalia). Com treinamento
 * publicado, o cartãozinho da Vitória fica à vista, com "Ver ranking". O admin, em vez de jogar, abre o treinamento no
 * editor (ou o cria).
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
  /** A janela aberta a partir do painel de "Ver materiais": o editor da lista (admin), a sugestão ou a contestação. */
  const [janela, setJanela] = useState<"editar" | TipoDeSugestao | null>(null);
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
      </div>

      {treinamento && (
        <TreinamentoNoCartao treinamento={treinamento} admin={podeEditar} acao={<BotaoVerRanking codigo={servico.codigo} descricao={servico.descricao} sm />} />
      )}

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
            {podeEditar && (
              <div className="cartao-servico-colaborar">
                <Button variant="line" sm onClick={() => setJanela("editar")}>
                  <Icon name={temMateriais ? "pencil" : "plus"} size={13} />
                  {temMateriais ? "Editar lista" : "Adicionar materiais"}
                </Button>
              </div>
            )}
            {colaboracao && !podeEditar && (
              <div className="cartao-servico-colaborar">
                <Button variant="line" sm onClick={() => setJanela("sugestao")}>
                  <Icon name="pencil" size={13} />
                  Sugerir lista
                </Button>
                {temMateriais && (
                  <Button variant="line" sm onClick={() => setJanela("contestacao")}>
                    <Icon name="alert" size={13} />
                    Contestar lista
                  </Button>
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

      {janela === "editar" && (
        <JanelaSobreposta titulo={`${temMateriais ? "Editar a lista" : "Adicionar materiais"} · ${servico.descricao}`} aoFechar={() => setJanela(null)} className="dlg-lista-servico">
          <EditorDoServico servico={servico} aoFechar={() => setJanela(null)} />
        </JanelaSobreposta>
      )}
      {(janela === "sugestao" || janela === "contestacao") && (
        <JanelaDeSugestao tipo={janela} codigo={servico.codigo} descricao={servico.descricao} atual={servico.materiais} aoFechar={() => setJanela(null)} />
      )}
    </section>
  );
}

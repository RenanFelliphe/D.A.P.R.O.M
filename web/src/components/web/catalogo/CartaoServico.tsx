"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BotaoVerRanking } from "@/components/web/treinamento-servico/BotaoVerRanking";
import { BotaoTreinar } from "@/components/web/treinamento-servico/jogo/BotaoTreinar";
import { TreinamentoNoCartao } from "@/components/web/treinamento-servico/TreinamentoNoCartao";
import type { ServicoDoCatalogo } from "@/lib/catalogo";
import { rotas } from "@/lib/rotas";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";
import { EditorDoServico } from "./EditorDoServico";
import { ListaDoServico } from "./ListaDoServico";

/**
 * Um serviço do catálogo: o código, a descrição e, só quando existem, "Ver materiais" (a lista do que o serviço leva para o
 * campo, que abre no próprio cartão), "Jogar treinamento" (o jogo numa janela) e "Ver ranking" (o ranking dele, também numa janela). Com treinamento publicado, o cartãozinho da
 * Vitória fica à vista. O admin edita a lista aqui mesmo e, em vez de jogar, abre o treinamento no editor (ou o cria).
 */
export function CartaoServico({ servico, podeEditar, treinamento = null }: { servico: ServicoDoCatalogo; podeEditar: boolean; treinamento?: TreinamentoResumo | null }) {
  const idLista = useId();
  const [editando, setEditando] = useState(false);
  const [verMateriais, setVerMateriais] = useState(false);
  const total = servico.materiais.length;
  const temMateriais = total > 0;
  const temAcoes = temMateriais || Boolean(treinamento) || podeEditar;

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

      {treinamento && <TreinamentoNoCartao treinamento={treinamento} admin={podeEditar} />}

      {editando ? (
        <EditorDoServico servico={servico} aoFechar={() => setEditando(false)} />
      ) : (
        temAcoes && (
          <>
            <div className="cartao-servico-acoes">
              {temMateriais && (
                <Button variant="line" sm aria-expanded={verMateriais} aria-controls={idLista} onClick={() => setVerMateriais((v) => !v)}>
                  <Icon name="box" size={13} />
                  {verMateriais ? "Ocultar materiais" : "Ver materiais"}
                  <Icon name="down" size={13} className="cartao-servico-seta" />
                </Button>
              )}
              {treinamento &&
                (podeEditar ? (
                  <LinkButton variant="p" sm href={rotas.app.treinamentoServico(servico.codigo)}>
                    <Icon name="pencil" size={13} />
                    Abrir treinamento
                  </LinkButton>
                ) : (
                  <BotaoTreinar codigo={servico.codigo} jaConcluiu={treinamento.concluido} rotulo="Jogar treinamento" sm />
                ))}
              {treinamento && <BotaoVerRanking codigo={servico.codigo} descricao={servico.descricao} sm />}
              {!treinamento && podeEditar && (
                <LinkButton variant="ghost" sm href={rotas.app.treinamentoServico(servico.codigo)}>
                  <Icon name="plus" size={13} />
                  Criar treinamento
                </LinkButton>
              )}
            </div>
            {temMateriais && verMateriais && (
              <div id={idLista} className="cartao-servico-lista">
                <ListaDoServico materiais={servico.materiais} />
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}

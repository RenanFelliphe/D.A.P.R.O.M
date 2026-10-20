"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { Panel, TableWrap } from "@/components/web/Panel";
import type { ModoUsuarios } from "@/data/usuarios";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import { useToast } from "@/state/toast";
import { FormularioUsuario, type OpcaoEquipe } from "./FormularioUsuario";

/** Um pedido de conta pendente (`GET /solicitacoes-conta`). */
export interface PedidoDeConta {
  id: string;
  nome: string;
  email: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  criada_em: string;
}

/**
 * Os pedidos de conta feitos na tela de entrada por quem ainda não tem conta (`solicitacao-de-conta.md`). O admin vê todos; quem
 * supervisiona, os que escolheram uma equipe dele. "Cadastrar" abre o cadastro de sempre com o e-mail preenchido (a matrícula
 * vem do registro de funcionários), e a conta criada atende o pedido sozinha; "Descartar" é para quem não é funcionário ou pediu
 * por engano. O aviso `conta_solicitada` leva até aqui (`#solicitacoes`).
 */
export function PainelPedidosDeConta({ pedidos, equipes, modo = "admin" }: { pedidos: PedidoDeConta[]; equipes: OpcaoEquipe[]; modo?: ModoUsuarios }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [cadastrando, setCadastrando] = useState<PedidoDeConta | null>(null);
  const [descartando, setDescartando] = useState<PedidoDeConta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (pedidos.length === 0) return null;

  async function descartar(p: PedidoDeConta) {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("POST", `/solicitacoes-conta/${p.id}/descartar`);
      exibirAviso(`O pedido de ${p.nome} foi descartado.`);
      setDescartando(null);
      router.refresh();
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível descartar o pedido agora.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div id="solicitacoes">
      <Panel className="painel-pendentes">
        <div className="stack g4">
          <h2 id="solicitacoes-titulo">{`Pedidos de conta · ${pedidos.length}`}</h2>
          <span className="small">
            Pessoas que pediram uma conta na tela de entrada. Confira a matrícula no registro de funcionários e cadastre: a conta criada com o mesmo e-mail atende o pedido.
          </span>
        </div>
        <TableWrap>
          <table className="tb" aria-labelledby="solicitacoes-titulo">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Equipe informada</th>
                <th>Pedido em</th>
                <th style={{ width: 210 }} />
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{p.nome}</span>
                    <div className="small">{p.email}</div>
                  </td>
                  <td>{p.equipe_nome ?? "—"}</td>
                  <td className="small">{dataHora(p.criada_em)}</td>
                  <td className="acoes-linha">
                    <span className="row g8" style={{ justifyContent: "flex-end" }}>
                      <Button variant="p" sm onClick={() => setCadastrando(p)}>
                        Cadastrar
                      </Button>
                      <Button variant="line" sm onClick={() => setDescartando(p)}>
                        Descartar
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Panel>

      {cadastrando && (
        <JanelaModal titulo={`Cadastrar ${cadastrando.nome}`} aoFechar={() => setCadastrando(null)}>
          <FormularioUsuario equipes={equipes} modo={modo} emailInicial={cadastrando.email} aoConcluir={() => setCadastrando(null)} />
        </JanelaModal>
      )}
      {descartando && (
        <JanelaModal titulo="Descartar o pedido de conta" aoFechar={() => setDescartando(null)}>
          <p style={{ fontSize: 14 }}>
            Descartar o pedido de <b>{descartando.nome}</b> ({descartando.email})? Use quando a pessoa não é funcionária ou pediu por engano. Ela pode pedir de novo.
          </p>
          {erro && (
            <Notice tone="blq" icon="alert">
              {erro}
            </Notice>
          )}
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <Button variant="line" sm onClick={() => setDescartando(null)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button variant="d" sm onClick={() => void descartar(descartando)} disabled={ocupado}>
              {ocupado ? "Descartando…" : "Descartar"}
            </Button>
          </div>
        </JanelaModal>
      )}
    </div>
  );
}

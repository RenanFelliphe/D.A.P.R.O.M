"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BotaoExcluir } from "@/components/web/BotaoExcluir";
import { FormularioConquista } from "@/components/web/gamificacao/FormularioConquista";
import { FormularioPatente } from "@/components/web/gamificacao/FormularioPatente";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import type { Conquista, CriterioDeConquista, Patente } from "@/lib/gamificacao";
import { useToast } from "@/state/toast";

/** Botão "Nova patente": abre o formulário numa janela. Só o admin o vê. */
export function NovaPatente() {
  const router = useRouter();
  const exibirAviso = useToast();
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <Button variant="p" sm onClick={() => setAberta(true)}>
        <Icon name="plus" size={16} />
        Nova patente
      </Button>
      {aberta && (
        <JanelaModal titulo="Nova patente" aoFechar={() => setAberta(false)}>
          <FormularioPatente
            aoCancelar={() => setAberta(false)}
            aoConcluir={(mensagem) => {
              exibirAviso(mensagem);
              setAberta(false);
              router.refresh();
            }}
          />
        </JanelaModal>
      )}
    </>
  );
}

/** Editar, desativar e excluir uma patente (só o admin). Excluir só vale para a patente que nunca foi gravada numa temporada fechada nem é meta de uma conquista. */
export function BotoesDaPatente({ patente }: { patente: Patente }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PATCH", `/gamificacao/patentes/${patente.id}`, { ativa: !patente.ativa });
      exibirAviso(`Patente "${patente.nome}" ${patente.ativa ? "desativada" : "reativada"}.`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar a patente");
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    await chamar("DELETE", `/gamificacao/patentes/${patente.id}`);
    exibirAviso(`Patente "${patente.nome}" excluída.`);
    router.refresh();
  }

  return (
    <>
      <Button variant="line" sm style={{ height: 32 }} onClick={() => setEditando(true)} disabled={ocupado}>
        Editar
      </Button>
      <Button variant="line" sm style={{ height: 32 }} onClick={alternar} disabled={ocupado}>
        {patente.ativa ? "Desativar" : "Reativar"}
      </Button>
      <BotaoExcluir rotulo="Excluir" pergunta={`Excluir a patente "${patente.nome}"?`} aoExcluir={excluir} desabilitado={ocupado} />
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)", flexBasis: "100%" }}>
          {erro}
        </span>
      )}
      {editando && (
        <JanelaModal titulo={`Editar patente · ${patente.nome}`} aoFechar={() => setEditando(false)}>
          <FormularioPatente
            patente={patente}
            aoCancelar={() => setEditando(false)}
            aoConcluir={(mensagem) => {
              exibirAviso(mensagem);
              setEditando(false);
              router.refresh();
            }}
          />
        </JanelaModal>
      )}
    </>
  );
}

interface DadosDoCadastroDeConquistas {
  criterios: CriterioDeConquista[];
  patentes: { id: string; nome: string }[];
}

/** Botão "Nova conquista": abre o formulário numa janela. Só o admin o vê. */
export function NovaConquista({ criterios, patentes }: DadosDoCadastroDeConquistas) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <Button variant="p" sm onClick={() => setAberta(true)}>
        <Icon name="plus" size={16} />
        Nova conquista
      </Button>
      {aberta && (
        <JanelaModal titulo="Nova conquista" aoFechar={() => setAberta(false)} className="dlg-larga">
          <FormularioConquista
            criterios={criterios}
            patentes={patentes}
            aoCancelar={() => setAberta(false)}
            aoConcluir={(mensagem) => {
              exibirAviso(mensagem);
              setAberta(false);
              router.refresh();
            }}
          />
        </JanelaModal>
      )}
    </>
  );
}

/** Editar, desativar e excluir uma conquista (só o admin). Excluir só vale se ninguém a tem. */
export function BotoesDaConquista({ conquista, criterios, patentes }: { conquista: Conquista } & DadosDoCadastroDeConquistas) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PATCH", `/gamificacao/conquistas/${conquista.id}`, { ativa: !conquista.ativa });
      exibirAviso(`Conquista "${conquista.titulo}" ${conquista.ativa ? "desativada" : "reativada"}.`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar a conquista");
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    await chamar("DELETE", `/gamificacao/conquistas/${conquista.id}`);
    exibirAviso(`Conquista "${conquista.titulo}" excluída.`);
    router.refresh();
  }

  return (
    <>
      <Button variant="line" sm style={{ height: 32 }} onClick={() => setEditando(true)} disabled={ocupado}>
        Editar
      </Button>
      <Button variant="line" sm style={{ height: 32 }} onClick={alternar} disabled={ocupado}>
        {conquista.ativa ? "Desativar" : "Reativar"}
      </Button>
      <BotaoExcluir rotulo="Excluir" pergunta={`Excluir "${conquista.titulo}"?`} aoExcluir={excluir} desabilitado={ocupado} />
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)", flexBasis: "100%" }}>
          {erro}
        </span>
      )}
      {editando && (
        <JanelaModal titulo={`Editar conquista · ${conquista.titulo}`} aoFechar={() => setEditando(false)} className="dlg-larga">
          <FormularioConquista
            conquista={conquista}
            criterios={criterios}
            patentes={patentes}
            aoCancelar={() => setEditando(false)}
            aoConcluir={(mensagem) => {
              exibirAviso(mensagem);
              setEditando(false);
              router.refresh();
            }}
          />
        </JanelaModal>
      )}
    </>
  );
}

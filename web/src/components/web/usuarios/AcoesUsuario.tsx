"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MenuAcoes } from "@/components/ui/MenuAcoes";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import type { ModoUsuarios } from "@/data/usuarios";
import type { Usuario } from "@/lib/tipos";
import { useToast } from "@/state/toast";
import { FormularioUsuario, type OpcaoEquipe } from "./FormularioUsuario";
import { JanelaRecusar, useLiberar } from "./liberacao";

type Janela = "editar" | "senha" | "remover" | "recusar" | null;

interface AcoesUsuarioProps {
  usuario: Usuario;
  equipes: OpcaoEquipe[];
  modo?: ModoUsuarios;
  /** Id de quem está logado: o supervisor só mexe nos pendentes que ele mesmo cadastrou. */
  meuId?: string;
}

/**
 * Ações da linha do usuário, num menu de três pontos. Admin: liberar e recusar (pendente), editar, redefinir a senha (mostrada uma
 * única vez), desativar/reativar e remover; o recusado só pode ser excluído (isso libera e-mail e matrícula). Supervisor: editar
 * nome, cargo e registro e cancelar o cadastro, só dos pendentes que ele criou.
 */
export function AcoesUsuario({ usuario, equipes, modo = "admin", meuId }: AcoesUsuarioProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [janela, setJanela] = useState<Janela>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaNova, setSenhaNova] = useState<string | null>(null);
  const { liberar, ocupado: liberando, erro: erroDeLiberar } = useLiberar(usuario);
  const supervisor = modo === "supervisor";
  const pendente = usuario.liberacao === "pendente";
  const recusado = usuario.liberacao === "recusado";

  async function alternarAtivo() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PATCH", `/usuarios/${usuario.id}`, { ativo: !usuario.ativo });
      exibirAviso(usuario.ativo ? `${usuario.nome} foi desativado(a).` : `${usuario.nome} foi reativado(a).`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar a situação");
    } finally {
      setOcupado(false);
    }
  }

  async function redefinirSenha() {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await chamar<{ senha_inicial: string }>("POST", `/usuarios/${usuario.id}/redefinir-senha`);
      setSenhaNova(resposta.senha_inicial);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível redefinir a senha");
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("DELETE", `/usuarios/${usuario.id}`);
      exibirAviso(supervisor ? `O cadastro de ${usuario.nome} foi cancelado.` : `${usuario.nome} foi removido(a).`);
      fechar();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover o usuário");
    } finally {
      setOcupado(false);
    }
  }

  function fechar() {
    setJanela(null);
    setSenhaNova(null);
    setErro(null);
  }

  // Supervisor: só os pendentes que ele cadastrou têm ação; as demais linhas ficam sem menu.
  if (supervisor && !(pendente && meuId && usuario.criado_por_id === meuId)) return null;

  const itens = supervisor
    ? [
        { rotulo: "Editar", aoClicar: () => setJanela("editar") },
        { rotulo: "Cancelar cadastro", aoClicar: () => setJanela("remover"), perigo: true },
      ]
    : recusado
      ? [{ rotulo: "Excluir cadastro", aoClicar: () => setJanela("remover"), perigo: true }]
      : [
          ...(pendente ? [{ rotulo: "Liberar", aoClicar: liberar }, { rotulo: "Recusar…", aoClicar: () => setJanela("recusar") }] : []),
          { rotulo: "Editar", aoClicar: () => setJanela("editar") },
          { rotulo: "Redefinir senha", aoClicar: () => setJanela("senha") },
          ...(pendente ? [] : [{ rotulo: usuario.ativo ? "Desativar" : "Reativar", aoClicar: alternarAtivo }]),
          { rotulo: "Remover", aoClicar: () => setJanela("remover"), perigo: true },
        ];
  const mensagemDeErro = erro ?? erroDeLiberar;

  return (
    <>
      <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
        <MenuAcoes rotulo={`Ações de ${usuario.nome}`} desabilitado={ocupado || liberando} itens={itens} />
      </span>
      {mensagemDeErro && janela === null && (
        <div role="alert" className="small" style={{ color: "var(--blq)", textAlign: "right", marginTop: 4, whiteSpace: "normal" }}>
          {mensagemDeErro}
        </div>
      )}
      {janela === "editar" && (
        <JanelaModal titulo={`Editar ${usuario.nome}`} aoFechar={fechar}>
          <FormularioUsuario usuario={usuario} equipes={equipes} modo={modo} aoConcluir={fechar} />
        </JanelaModal>
      )}
      {janela === "recusar" && <JanelaRecusar usuario={usuario} aoFechar={fechar} />}
      {janela === "remover" && supervisor && (
        <JanelaModal titulo="Cancelar cadastro" aoFechar={fechar}>
          <p style={{ fontSize: 14 }}>
            Cancelar o cadastro de <b>{usuario.nome}</b> (matrícula {usuario.matricula})? Como o acesso ainda não foi liberado, o cadastro é apagado e a matrícula e o e-mail ficam livres para um novo cadastro.
          </p>
          {erro && (
            <Notice tone="blq" icon="alert">
              {erro}
            </Notice>
          )}
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <Button variant="line" sm onClick={fechar} disabled={ocupado}>
              Manter cadastro
            </Button>
            <Button variant="d" sm onClick={remover} disabled={ocupado}>
              {ocupado ? "Cancelando…" : "Cancelar cadastro"}
            </Button>
          </div>
        </JanelaModal>
      )}
      {janela === "remover" && !supervisor && (
        <JanelaModal titulo={recusado ? "Excluir cadastro" : "Remover usuário"} aoFechar={fechar}>
          <p style={{ fontSize: 14 }}>
            Remover <b>{usuario.nome}</b> ({usuario.email ?? `matrícula ${usuario.matricula}`}) de vez? O cadastro e o acesso são apagados e não dá para desfazer. Quem já participou de APR ou de execução,
            ou supervisiona uma equipe, tem histórico e não pode ser removido: nesse caso, desative.
          </p>
          {erro && (
            <Notice tone="blq" icon="alert">
              {erro}
            </Notice>
          )}
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <Button variant="line" sm onClick={fechar} disabled={ocupado}>
              Cancelar
            </Button>
            <Button variant="d" sm onClick={remover} disabled={ocupado}>
              {ocupado ? "Removendo…" : "Remover"}
            </Button>
          </div>
        </JanelaModal>
      )}
      {janela === "senha" && (
        <JanelaModal titulo="Redefinir senha" aoFechar={fechar}>
          {senhaNova ? (
            <>
              <Notice tone="ok" icon="check">
                Nova senha inicial de {usuario.nome} ({usuario.email ?? `matrícula ${usuario.matricula}`}). Ela aparece só agora: repasse à pessoa, que vai trocá-la no próximo acesso.
              </Notice>
              <div className="senha-nova">{senhaNova}</div>
              <div className="row g8" style={{ justifyContent: "flex-end" }}>
                <Button variant="line" sm onClick={() => navigator.clipboard?.writeText(senhaNova).then(() => exibirAviso("Senha copiada."))}>
                  Copiar
                </Button>
                <Button variant="p" sm onClick={fechar}>
                  Concluir
                </Button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14 }}>
                Gerar uma nova senha inicial para <b>{usuario.nome}</b> ({usuario.email ?? `matrícula ${usuario.matricula}`})? A senha atual deixa de valer e a pessoa terá de definir uma nova no próximo
                acesso.
              </p>
              {erro && (
                <Notice tone="blq" icon="alert">
                  {erro}
                </Notice>
              )}
              <div className="row g8" style={{ justifyContent: "flex-end" }}>
                <Button variant="line" sm onClick={fechar} disabled={ocupado}>
                  Cancelar
                </Button>
                <Button variant="p" sm onClick={redefinirSenha} disabled={ocupado}>
                  {ocupado ? "Gerando…" : "Gerar nova senha"}
                </Button>
              </div>
            </>
          )}
        </JanelaModal>
      )}
    </>
  );
}

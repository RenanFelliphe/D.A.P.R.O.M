"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MenuAcoes } from "@/components/ui/MenuAcoes";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import type { Usuario } from "@/lib/tipos";
import { useToast } from "@/state/toast";
import { FormularioUsuario, type OpcaoEquipe } from "./FormularioUsuario";

type Janela = "editar" | "senha" | "remover" | null;

/** Ações da linha do usuário, num menu de três pontos: editar, redefinir a senha (mostrada uma única vez), desativar/reativar e remover. */
export function AcoesUsuario({ usuario, equipes }: { usuario: Usuario; equipes: OpcaoEquipe[] }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [janela, setJanela] = useState<Janela>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senhaNova, setSenhaNova] = useState<string | null>(null);

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
      exibirAviso(`${usuario.nome} foi removido(a).`);
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

  return (
    <>
      <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
        <MenuAcoes
          rotulo={`Ações de ${usuario.nome}`}
          desabilitado={ocupado}
          itens={[
            { rotulo: "Editar", aoClicar: () => setJanela("editar") },
            { rotulo: "Redefinir senha", aoClicar: () => setJanela("senha") },
            { rotulo: usuario.ativo ? "Desativar" : "Reativar", aoClicar: alternarAtivo },
            { rotulo: "Remover", aoClicar: () => setJanela("remover"), perigo: true },
          ]}
        />
      </span>
      {erro && janela === null && (
        <div role="alert" className="small" style={{ color: "var(--blq)", textAlign: "right", marginTop: 4, whiteSpace: "normal" }}>
          {erro}
        </div>
      )}
      {janela === "editar" && (
        <JanelaModal titulo={`Editar ${usuario.nome}`} aoFechar={fechar}>
          <FormularioUsuario usuario={usuario} equipes={equipes} aoConcluir={fechar} />
        </JanelaModal>
      )}
      {janela === "remover" && (
        <JanelaModal titulo="Remover usuário" aoFechar={fechar}>
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

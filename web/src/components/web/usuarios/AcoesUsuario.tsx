"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import type { Usuario } from "@/lib/tipos";
import { useToast } from "@/state/toast";
import { FormularioUsuario, type OpcaoEquipe } from "./FormularioUsuario";

type Janela = "editar" | "senha" | null;

/** Ações da linha do usuário: editar, ativar/desativar e redefinir a senha (mostrada uma única vez). */
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

  function fechar() {
    setJanela(null);
    setSenhaNova(null);
    setErro(null);
  }

  return (
    <>
      <span className="row g6" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
        <Button variant="line" sm style={{ height: 32 }} onClick={() => setJanela("editar")} disabled={ocupado}>
          Editar
        </Button>
        <Button variant="line" sm style={{ height: 32 }} onClick={() => setJanela("senha")} disabled={ocupado}>
          Redefinir senha
        </Button>
        <Button variant="line" sm style={{ height: 32 }} onClick={alternarAtivo} disabled={ocupado}>
          {usuario.ativo ? "Desativar" : "Reativar"}
        </Button>
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
      {janela === "senha" && (
        <JanelaModal titulo="Redefinir senha" aoFechar={fechar}>
          {senhaNova ? (
            <>
              <Notice tone="ok" icon="check">
                Nova senha inicial de {usuario.nome} (matrícula {usuario.matricula}). Ela aparece só agora: repasse à pessoa, que vai trocá-la no próximo acesso.
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
                Gerar uma nova senha inicial para <b>{usuario.nome}</b> (matrícula {usuario.matricula})? A senha atual deixa de valer e a pessoa terá de definir uma nova no próximo
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

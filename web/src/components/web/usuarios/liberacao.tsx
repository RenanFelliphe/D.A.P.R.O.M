"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import type { Usuario } from "@/lib/tipos";
import { useToast } from "@/state/toast";

/** Libera o cadastro pendente (`POST /usuarios/{id}/liberar`). Devolve `erro` para a tela mostrar perto do botão. */
export function useLiberar(usuario: Pick<Usuario, "id" | "nome">) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function liberar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("POST", `/usuarios/${usuario.id}/liberar`);
      exibirAviso(`${usuario.nome} foi liberado(a): o acesso geral já vale.`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível liberar o acesso");
    } finally {
      setOcupado(false);
    }
  }
  return { liberar, ocupado, erro };
}

/** Janela para recusar um cadastro pendente: o motivo é obrigatório e vai para quem for tentar entrar (`POST /usuarios/{id}/recusar`). */
export function JanelaRecusar({ usuario, aoFechar }: { usuario: Pick<Usuario, "id" | "nome">; aoFechar: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const idMotivo = useId();
  const idErro = useId();
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const texto = motivo.trim();
    if (texto.length < 3) return setErro("Informe o motivo da recusa.");
    setOcupado(true);
    setErro(null);
    try {
      await chamar("POST", `/usuarios/${usuario.id}/recusar`, { motivo: texto });
      exibirAviso(`O cadastro de ${usuario.nome} foi recusado.`);
      router.refresh();
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível recusar o cadastro");
      setOcupado(false);
    }
  }

  return (
    <JanelaModal titulo="Recusar cadastro" aoFechar={aoFechar}>
      <form onSubmit={enviar} className="stack g12">
        <p style={{ fontSize: 14 }}>
          Recusar o cadastro de <b>{usuario.nome}</b>? A pessoa deixa de entrar no sistema e vê o motivo abaixo ao tentar. Depois você pode excluir o cadastro para liberar o e-mail e a matrícula.
        </p>
        <div className="field">
          <label htmlFor={idMotivo}>Motivo da recusa (obrigatório)</label>
          <textarea
            id={idMotivo}
            className="textarea"
            rows={3}
            required
            maxLength={500}
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? idErro : undefined}
          />
        </div>
        {erro && (
          <div id={idErro}>
            <Notice tone="blq" icon="alert">
              {erro}
            </Notice>
          </div>
        )}
        <div className="row g8" style={{ justifyContent: "flex-end" }}>
          <Button variant="line" sm onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button variant="d" sm type="submit" disabled={ocupado}>
            {ocupado ? "Recusando…" : "Recusar cadastro"}
          </Button>
        </div>
      </form>
    </JanelaModal>
  );
}

/** Botões "Liberar" e "Recusar" de um cadastro pendente (painel de pendentes do admin). */
export function BotoesLiberacao({ usuario }: { usuario: Pick<Usuario, "id" | "nome"> }) {
  const { liberar, ocupado, erro } = useLiberar(usuario);
  const [recusando, setRecusando] = useState(false);
  return (
    <span className="stack g4" style={{ alignItems: "flex-end" }}>
      <span className="row g8">
        <Button variant="p" sm onClick={liberar} disabled={ocupado} aria-label={`Liberar ${usuario.nome}`}>
          {ocupado ? "Liberando…" : "Liberar"}
        </Button>
        <Button variant="line" sm onClick={() => setRecusando(true)} disabled={ocupado} aria-label={`Recusar ${usuario.nome}`}>
          Recusar
        </Button>
      </span>
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)", whiteSpace: "normal", textAlign: "right" }}>
          {erro}
        </span>
      )}
      {recusando && <JanelaRecusar usuario={usuario} aoFechar={() => setRecusando(false)} />}
    </span>
  );
}

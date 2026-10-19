"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Button } from "@/components/ui/Button";
import { MensagemDeErro } from "@/components/ui/Field";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { rotas } from "@/lib/rotas";

interface JanelaDeAssinaturaProps {
  titulo: string;
  /** O que a pessoa está assinando, em uma frase. */
  resumo?: ReactNode;
  rotuloConfirmar: string;
  /** `d` para o que desfaz algo (recusar, cancelar, encerrar). */
  tom?: "p" | "d";
  /** A assinatura do perfil de quem age; `null` = ainda não cadastrou. */
  assinaturaPath: string | null;
  /** Sem assinatura: o pedido inicial da ausência não é assinado (o técnico assina ao confirmar o que o supervisor aprovar). */
  semAssinatura?: boolean;
  /** Os campos da ação, mostrados antes da assinatura. */
  children?: ReactNode;
  /**
   * Confere os campos acima antes de assinar (o `validar` do `useFormulario`): se algo estiver errado, a mensagem já está junto do
   * campo e a janela não envia. O botão não fica desativado por isso.
   */
  validar?: () => Promise<boolean>;
  /**
   * Faz a chamada à `api`; uma falha vira a mensagem da janela. Devolver um texto mantém a janela aberta com ele, como
   * aviso de que deu certo, em vez de fechá-la.
   */
  aoConfirmar: () => Promise<string | void>;
  aoFechar: () => void;
}

/**
 * Janela das ações assinadas (ausência, APR, encerramento, interrupção…): os campos da ação e a confirmação da assinatura do
 * perfil (a mesma imagem que a APR usa). Sem assinatura cadastrada, o cadastro vem antes, no perfil. Depois de confirmar, a tela
 * se atualiza. O botão de confirmar só fica desativado enquanto envia: o que falta (a confirmação, a assinatura, um campo) vem
 * como mensagem junto do que falta, e a falha devolvida pela `api` aparece acima do botão.
 */
export function JanelaDeAssinatura({
  titulo,
  resumo,
  rotuloConfirmar,
  tom = "p",
  assinaturaPath,
  semAssinatura = false,
  children,
  validar,
  aoConfirmar,
  aoFechar,
}: JanelaDeAssinaturaProps) {
  const roteador = useRouter();
  const [assino, setAssino] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** O que impediu de enviar (antes de chamar a `api`), mostrado junto do que falta. */
  const [pendencia, setPendencia] = useState<{ onde: "confirmacao"; texto: string } | null>(null);
  const caixa = useRef<HTMLInputElement>(null);

  const faltaAssinatura = !semAssinatura && !assinaturaPath;

  async function confirmar() {
    setErro(null);
    setPendencia(null);
    if (validar && !(await validar())) return;
    if (faltaAssinatura) {
      setPendencia({ onde: "confirmacao", texto: "Cadastre a sua assinatura no perfil para poder assinar." });
      return;
    }
    if (!semAssinatura && !assino) {
      setPendencia({ onde: "confirmacao", texto: "Marque a confirmação para assinar com a sua assinatura do perfil." });
      caixa.current?.focus();
      return;
    }
    setOcupado(true);
    try {
      const texto = await aoConfirmar();
      roteador.refresh();
      if (texto) setAviso(texto);
      else aoFechar();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <JanelaModal titulo={titulo} aoFechar={aoFechar}>
      {aviso ? (
        <>
          <Notice tone="al" icon="info">
            {aviso}
          </Notice>
          <div className="row g8">
            <Button variant="p" onClick={aoFechar}>
              Entendi
            </Button>
          </div>
        </>
      ) : (
        <>
          {resumo && <p>{resumo}</p>}
          {children}
          {!semAssinatura &&
            (faltaAssinatura ? (
              <Notice tone="al" icon="alert">
                Você ainda não cadastrou a assinatura. Cadastre-a no <Link href={rotas.app.perfil}>seu perfil</Link> antes de continuar.
              </Notice>
            ) : (
              <div className="stack g8">
                <span className="lbl">Sua assinatura</span>
                <div className="sig-box">
                  <ImagemArquivo id={assinaturaPath} alt="Sua assinatura" style={{ height: 56, maxWidth: "100%", objectFit: "contain" }} />
                </div>
                <label className="row g8 small" style={{ alignItems: "flex-start" }}>
                  <input
                    ref={caixa}
                    type="checkbox"
                    checked={assino}
                    aria-invalid={pendencia?.onde === "confirmacao" ? true : undefined}
                    onChange={(e) => {
                      setAssino(e.target.checked);
                      if (e.target.checked) setPendencia(null);
                    }}
                    style={{ marginTop: 3 }}
                  />
                  <span>Confirmo esta ação e a assino com a minha assinatura do perfil.</span>
                </label>
                {pendencia?.onde === "confirmacao" && !faltaAssinatura && <MensagemDeErro>{pendencia.texto}</MensagemDeErro>}
              </div>
            ))}
          {pendencia && faltaAssinatura && <MensagemDeErro>{pendencia.texto}</MensagemDeErro>}
          {erro && (
            <Notice tone="blq" icon="alert" role="alert">
              {erro}
            </Notice>
          )}
          <div className="row g8 wrap">
            <Button variant={tom} onClick={confirmar} disabled={ocupado} aria-busy={ocupado}>
              {ocupado ? "Enviando…" : rotuloConfirmar}
            </Button>
            <Button variant="ghost" onClick={aoFechar} disabled={ocupado}>
              Voltar
            </Button>
          </div>
        </>
      )}
    </JanelaModal>
  );
}

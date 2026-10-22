"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { abrirAbaDeAssinatura, levarAbaParaAAssinatura, useEsperarAssinatura } from "@/components/assinatura/useEsperarAssinatura";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Button } from "@/components/ui/Button";
import { MensagemDeErro } from "@/components/ui/Field";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import {
  definirAssinaturaJuridicaAtiva,
  erroDaAssinaturaJuridica,
  LIMITE_DO_RESUMO_DA_ASSINATURA,
  limparAssinaturaJuridicaAtiva,
  VALIDADE_DA_ASSINATURA_JURIDICA_MIN,
  type AssinaturaJuridica,
  type NovaAssinaturaJuridica,
} from "@/lib/assinatura-juridica";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useConfigDaAssinaturaJuridica } from "@/state/minha-assinatura";

interface JanelaDeAssinaturaProps {
  titulo: string;
  /** O que a pessoa está assinando, em uma frase. Quando é um texto, vai também para o termo que o provedor de assinatura mostra. */
  resumo?: ReactNode;
  rotuloConfirmar: string;
  /** `d` para o que desfaz algo (recusar, cancelar, encerrar). */
  tom?: "p" | "d";
  /** A assinatura do perfil de quem age; `null` = ainda não cadastrou. */
  assinaturaPath: string | null;
  /** Sem assinatura: o pedido inicial da ausência não é assinado (o técnico assina ao confirmar o que o supervisor aprovar). */
  semAssinatura?: boolean;
  /** A OS de que o ato trata, quando há: o termo do provedor mostra o número e o serviço. */
  osId?: string;
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
 * Janela das ações assinadas (ausência, APR, encerramento, interrupção…): os campos da ação e a confirmação da assinatura. Sem o
 * provedor de assinatura com validade jurídica, a pessoa confirma com a assinatura do perfil (a mesma imagem que a APR usa); com ele
 * (`GET /me`, fora do Campo de treino), confirmar abre a página do provedor em outra aba, a janela espera a assinatura chegar e só então
 * faz a chamada do ato, levando o código da assinatura (`lib/assinatura-juridica.ts`). Sem assinatura cadastrada, o cadastro vem antes,
 * no perfil. Depois de confirmar, a tela se atualiza. O botão de confirmar só fica desativado enquanto envia: o que falta (a
 * confirmação, a assinatura, um campo) vem como mensagem junto do que falta, e a falha devolvida pela `api` aparece acima do botão.
 */
export function JanelaDeAssinatura({
  titulo,
  resumo,
  rotuloConfirmar,
  tom = "p",
  assinaturaPath,
  semAssinatura = false,
  osId,
  children,
  validar,
  aoConfirmar,
  aoFechar,
}: JanelaDeAssinaturaProps) {
  const roteador = useRouter();
  const juridica = useConfigDaAssinaturaJuridica();
  const [assino, setAssino] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** O que impediu de enviar (antes de chamar a `api`), mostrado junto do que falta. */
  const [pendencia, setPendencia] = useState<{ onde: "confirmacao"; texto: string } | null>(null);
  /** A assinatura criada no provedor que a janela espera (a pessoa está na outra aba). */
  const [esperando, setEsperando] = useState<AssinaturaJuridica | null>(null);
  /** O código da assinatura já confirmada que ainda não serviu: se o ato falhar por outro motivo, ela vale de novo (30 min, um ato só). */
  const [assinadaId, setAssinadaId] = useState<string | null>(null);
  const concluindo = useRef(false);
  const caixa = useRef<HTMLInputElement>(null);

  const faltaAssinatura = !semAssinatura && !assinaturaPath;
  const noProvedor = juridica.ligada && !semAssinatura;

  /** A chamada do ato e o que vem depois dela: atualizar a tela e fechar a janela (ou mostrar o aviso que o ato devolveu). */
  async function fazerOAto() {
    const texto = await aoConfirmar();
    roteador.refresh();
    if (texto) setAviso(texto);
    else aoFechar();
  }

  /** A assinatura chegou: faz o ato levando o código dela no cabeçalho (rotas) e no `payload` (eventos), e o larga ao terminar. */
  async function concluirComAssinatura(id: string) {
    if (concluindo.current) return;
    concluindo.current = true;
    setEsperando(null);
    setAssinadaId(id);
    setOcupado(true);
    setErro(null);
    definirAssinaturaJuridicaAtiva(id);
    try {
      await fazerOAto();
      setAssinadaId(null);
    } catch (e) {
      // A `api` recusou por causa da assinatura (já usada, vencida…): a que a janela tinha não serve mais, e a pessoa assina de novo.
      if (erroDaAssinaturaJuridica(e)) setAssinadaId(null);
      setErro(mensagemDoErro(e));
    } finally {
      limparAssinaturaJuridicaAtiva();
      concluindo.current = false;
      setOcupado(false);
    }
  }

  useEsperarAssinatura(
    esperando?.id ?? null,
    (a) => {
      if (a.situacao === "aguardando") setEsperando(a);
      else if (a.situacao === "assinada") void concluirComAssinatura(a.id);
      else {
        setEsperando(null);
        setErro(a.situacao === "recusada" ? "A assinatura foi recusada na página do provedor. Se foi sem querer, confirme de novo." : "O provedor não conseguiu concluir a assinatura. Confirme de novo.");
      }
    },
    (e) => {
      setEsperando(null);
      setErro(mensagemDoErro(e));
    },
  );

  async function confirmar() {
    setErro(null);
    setPendencia(null);
    // A aba do provedor abre já, no clique: depois de uma ida à `api` o navegador a barraria como janela sem pedido.
    const aba = noProvedor && !assinadaId ? abrirAbaDeAssinatura() : null;
    if (validar && !(await validar())) {
      aba?.close();
      return;
    }
    if (faltaAssinatura) {
      aba?.close();
      setPendencia({ onde: "confirmacao", texto: "Cadastre a sua assinatura nas configurações para poder assinar." });
      return;
    }
    if (!noProvedor && !semAssinatura && !assino) {
      setPendencia({ onde: "confirmacao", texto: "Marque a confirmação para assinar com a sua assinatura do perfil." });
      caixa.current?.focus();
      return;
    }
    if (noProvedor && assinadaId) {
      await concluirComAssinatura(assinadaId);
      return;
    }
    setOcupado(true);
    try {
      if (!noProvedor) {
        await fazerOAto();
        return;
      }
      const pedido: NovaAssinaturaJuridica = {
        titulo,
        ...(typeof resumo === "string" && resumo.trim() ? { resumo: resumo.trim().slice(0, LIMITE_DO_RESUMO_DA_ASSINATURA) } : {}),
        ...(osId ? { os_id: osId } : {}),
      };
      const nova = await chamar<AssinaturaJuridica>("POST", "/assinaturas-juridicas", pedido);
      levarAbaParaAAssinatura(aba, nova.url_assinatura);
      setEsperando(nova);
    } catch (e) {
      aba?.close();
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const abrirDeNovo = () => {
    if (esperando?.url_assinatura) window.open(esperando.url_assinatura, "_blank", "noopener");
  };

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
      ) : esperando ? (
        <>
          {resumo && <p>{resumo}</p>}
          <Notice tone="info" icon="clock" role="status">
            <strong>Aguardando a sua assinatura na página que abriu…</strong> Assine lá e volte a esta janela: ela segue sozinha quando a assinatura chegar.
          </Notice>
          {juridica.simulada && (
            <Notice tone="al" icon="alert">
              Provedor simulado: a assinatura é de demonstração e não tem validade jurídica.
            </Notice>
          )}
          <div className="row g8 wrap">
            <Button variant="p" onClick={abrirDeNovo} disabled={!esperando.url_assinatura}>
              Abrir de novo
            </Button>
            <Button variant="ghost" onClick={() => setEsperando(null)}>
              Cancelar
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
                Você ainda não cadastrou a assinatura. Cadastre-a nas <Link href={rotas.app.configuracoesConta}>configurações</Link> antes de continuar.
              </Notice>
            ) : noProvedor ? (
              <div className="stack g8">
                <Notice tone="info" icon="shield">
                  {assinadaId ? (
                    <>
                      <strong>Você já assinou no provedor.</strong> Corrija o que faltou e confirme de novo: a mesma assinatura vale por {VALIDADE_DA_ASSINATURA_JURIDICA_MIN} minutos, para este ato.
                    </>
                  ) : (
                    <>
                      <strong>Assinatura com validade jurídica.</strong> Ao confirmar, a página do provedor de assinatura abre em outra aba para você assinar. Depois, volte a esta
                      janela: o ato é registrado sozinho.
                    </>
                  )}
                </Notice>
                {juridica.simulada && (
                  <Notice tone="al" icon="alert">
                    Provedor simulado: a assinatura é de demonstração e não tem validade jurídica.
                  </Notice>
                )}
              </div>
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

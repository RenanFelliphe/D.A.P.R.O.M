"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { dataHora, hora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

/** Intervalo da consulta automática da liberação. */
const ATUALIZAR_A_CADA_MS = 30_000;

interface TelaAguardandoProps {
  /** O admin já liberou (lido na `api` real). Fora do treino o servidor já redireciona; no treino a pessoa escolhe quando sair. */
  liberado: boolean;
  /** O Campo de treino está ligado nesta sessão. */
  emTreino: boolean;
  equipe: string | null;
  criadoPor: string | null;
  criadoEm: string | null;
}

/**
 * Tela de espera do técnico cadastrado por um supervisor: explica a situação, leva ao Campo de treino e confere a liberação
 * (botão e a cada ~30 s). A conferência é um `router.refresh()` numa transição: o servidor relê o `/me` real e, liberado, redireciona
 * para a lista; a tela não pisca porque o conteúdo atual segue na tela até a resposta chegar.
 */
export function TelaAguardando({ liberado, emTreino, equipe, criadoPor, criadoEm }: TelaAguardandoProps) {
  const router = useRouter();
  const [verificando, iniciar] = useTransition();
  const [manual, setManual] = useState(false);
  const [conferidoEm, setConferidoEm] = useState<Date | null>(null);
  const eraVerificando = useRef(false);

  // Atualização automática; pausa com a aba escondida e confere de novo ao voltar a ela.
  useEffect(() => {
    if (liberado) return;
    const conferir = () => {
      if (document.visibilityState === "visible") iniciar(() => router.refresh());
    };
    const temporizador = window.setInterval(conferir, ATUALIZAR_A_CADA_MS);
    document.addEventListener("visibilitychange", conferir);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, [liberado, router]);

  // Marca a hora da última conferência quando a transição termina.
  useEffect(() => {
    if (eraVerificando.current && !verificando) setConferidoEm(new Date());
    eraVerificando.current = verificando;
  }, [verificando]);

  function verificar() {
    setManual(true);
    iniciar(() => router.refresh());
  }

  return (
    <div className="aguardando">
      <div className="aguardando-icone" aria-hidden="true">
        <Icon name={liberado ? "check" : "clock"} size={24} />
      </div>
      <div className="stack g8">
        <h1>{liberado ? "Seu acesso foi liberado" : "Seu acesso está aguardando liberação"}</h1>
        {liberado ? (
          <p className="muted">Um administrador aprovou o seu cadastro. Saia do Campo de treino para entrar no sistema com os dados reais.</p>
        ) : (
          <p className="muted">Um administrador precisa aprovar o seu cadastro. Enquanto isso, que tal conhecer o sistema no Campo de treino?</p>
        )}
      </div>

      {(criadoPor || criadoEm || equipe) && !liberado && (
        <dl className="aguardando-dados">
          {criadoPor && (
            <div>
              <dt>Cadastrado por</dt>
              <dd>{criadoPor}</dd>
            </div>
          )}
          {criadoEm && (
            <div>
              <dt>Quando</dt>
              <dd>{dataHora(criadoEm)}</dd>
            </div>
          )}
          {equipe && (
            <div>
              <dt>Equipe</dt>
              <dd>{equipe}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="row g8 wrap">
        {liberado ? (
          // Navegação completa: a rota apaga o cookie do treino e leva à lista real.
          <a className="btn btn-p" href={rotas.app.treinoSair}>
            Entrar no sistema
          </a>
        ) : (
          <>
            {emTreino ? (
              <Link className="btn btn-p" href={rotas.app.treino}>
                Continuar no Campo de treino
              </Link>
            ) : (
              // Navegação completa: a rota liga o cookie do treino.
              <a className="btn btn-p" href={rotas.app.treinoEntrar()}>
                Ir para o Campo de treino
              </a>
            )}
            <button type="button" className="btn btn-line" onClick={verificar} disabled={verificando} aria-busy={verificando}>
              <Icon name="refresh" size={16} />
              {verificando ? "Verificando…" : "Verificar liberação"}
            </button>
          </>
        )}
      </div>

      <div role="status" aria-live="polite" className="small">
        {!liberado && manual && !verificando && conferidoEm && `Ainda aguardando. Última conferência às ${hora(conferidoEm)}.`}
      </div>
      {!liberado && (
        <Notice tone="info" icon="info" style={{ fontSize: 14 }}>
          Esta página confere a liberação sozinha a cada 30 segundos. Quando o acesso for aprovado, você vai direto para a lista de OS.
        </Notice>
      )}
    </div>
  );
}

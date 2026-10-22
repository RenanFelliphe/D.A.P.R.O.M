"use client";

import { useEffect, useState } from "react";
import { mensagemDoConvite } from "@/components/app/convites/useConvitesDaOs";
import { useAgora } from "@/components/app/execucao/useAgora";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { faltaNoMotivoDaRecusa, LIMITE_DO_MOTIVO_DO_CONVITE, PRAZO_DO_CONVITE_MIN, restanteDoConvite, type ConviteRecebido } from "@/lib/apr-convite";
import { chamar } from "@/lib/cliente-api";

/** De quanto em quanto tempo a página, aberta em qualquer tela, pergunta se algum colega convidou a pessoa para uma APR (o convite vale por minutos). */
const PERGUNTAR_A_CADA_MS = 10_000;

/**
 * A faixa no alto de toda tela de campo para quem foi convidado a participar de uma APR e ainda não respondeu: quem convidou, a OS, quanto
 * tempo falta e as duas respostas ("Aceito" e "Não posso", com o motivo). Aceitar é "eu vou": a assinatura da APR continua no fim, na conta
 * de cada um, e o direito de recusa também. O convite aceito fica à vista até o responsável registrar a APR. Só pergunta com a aba visível.
 */
export function FaixaDeConvites() {
  const [convites, setConvites] = useState<ConviteRecebido[]>([]);

  const reler = async () => {
    try {
      setConvites((await chamar<{ convites: ConviteRecebido[] }>("GET", "/me/apr-convites")).convites);
    } catch {
      /* sem sinal ou sessão em transição: tenta de novo na próxima volta */
    }
  };

  useEffect(() => {
    let ativo = true;
    const perguntar = async () => {
      if (document.visibilityState !== "visible" || !ativo) return;
      try {
        const { convites: recebidos } = await chamar<{ convites: ConviteRecebido[] }>("GET", "/me/apr-convites");
        if (ativo) setConvites(recebidos);
      } catch {
        /* idem */
      }
    };
    void perguntar();
    const temporizador = window.setInterval(() => void perguntar(), PERGUNTAR_A_CADA_MS);
    document.addEventListener("visibilitychange", perguntar);
    return () => {
      ativo = false;
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", perguntar);
    };
  }, []);

  if (convites.length === 0) return null;
  return (
    <div className="stack g8" style={{ marginBottom: 12 }} data-treino="faixa-convites">
      {convites.map((c) => (
        <Convite key={c.id} convite={c} aoResponder={reler} />
      ))}
    </div>
  );
}

function Convite({ convite, aoResponder }: { convite: ConviteRecebido; aoResponder: () => Promise<void> }) {
  const agora = useAgora();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const aceito = convite.situacao === "aceito";
  const restante = agora === null ? null : restanteDoConvite(convite.expira_em, agora);
  const rotuloDaOs = convite.os.numero_ordem ? `OS ${convite.os.numero_ordem}` : convite.os.titulo;

  async function responder(caminho: "aceitar" | "recusar") {
    setErro(null);
    setEnviando(true);
    try {
      await chamar("POST", `/apr-convites/${convite.id}/${caminho}`, caminho === "recusar" ? { motivo: motivo.trim() } : {});
      await aoResponder();
    } catch (e) {
      setErro(mensagemDoConvite(e));
    } finally {
      setEnviando(false);
    }
  }

  const falta = recusando ? faltaNoMotivoDaRecusa(motivo) : null;

  if (aceito) {
    return (
      <Notice tone="ok" icon="check" role="status">
        <strong>Você aceitou participar da APR da {rotuloDaOs}.</strong> Aguardando {convite.convidado_por.nome} registrar a APR; você assina no fim, na sua conta.
      </Notice>
    );
  }
  return (
    <Notice tone="al" icon="users" role="status">
      <div className="stack g8" style={{ width: "100%" }}>
        <span>
          <strong>
            {convite.convidado_por.nome} convidou você para a APR da {rotuloDaOs}
            {restante ? ` — ${restante}` : ""}
          </strong>{" "}
          · {convite.os.titulo} · {convite.os.local}. Aceitar é confirmar que você vai; a sua assinatura vem no fim, depois de ler os riscos. O convite vale por {PRAZO_DO_CONVITE_MIN} minutos.
        </span>
        {erro && <span role="alert">{erro}</span>}
        {!recusando ? (
          <div className="row g8 wrap">
            <Button variant="p" sm disabled={enviando} onClick={() => void responder("aceitar")}>
              Aceito
            </Button>
            <Button variant="line" sm disabled={enviando} onClick={() => setRecusando(true)}>
              Não posso
            </Button>
          </div>
        ) : (
          <div className="stack g6">
            <label className="stack g4">
              <span className="small">Por que você não pode? O responsável lê para trocar a pessoa.</span>
              <input className="input" value={motivo} maxLength={LIMITE_DO_MOTIVO_DO_CONVITE} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: estou em outro serviço" />
            </label>
            {falta && motivo.length > 0 && <span className="small">{falta}</span>}
            <div className="row g8 wrap">
              <Button variant="p" sm disabled={enviando || Boolean(falta)} onClick={() => void responder("recusar")}>
                Enviar a recusa
              </Button>
              <Button variant="ghost" sm onClick={() => setRecusando(false)}>
                Voltar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Notice>
  );
}

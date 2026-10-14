"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";

/** Resposta de `GET /sap/sincronizacao`. */
export interface SincronizacaoSap {
  ultima_leitura_sem_erro_em: string | null;
  automatica: boolean;
  intervalo_min: number;
}

/** Uma leitura de `GET /importacoes` (as da API; o `detalhe_ignoradas` guarda o motivo de cada ordem ignorada). */
export interface LeituraSap {
  id: string;
  origem: string;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  detalhe_ignoradas: { numero_ordem?: string; motivo: string }[] | null;
  erro: string | null;
  criada_em: string;
}

const INTERVALO_MS = 2_000;
const TENTATIVAS = 40;

/**
 * Cartão "Sincronização com o DAPROM" da tela das ordens: a última leitura sem erro, se a automática está ligada, o intervalo e a
 * próxima prevista (`GET /sap/sincronizacao`), e o "Ler agora" (`POST /sap/leituras`). Quando a leitura termina, mostra o resultado
 * (OS criadas, atualizadas e as ordens ignoradas com o motivo, de `GET /importacoes`) e a coluna "No DAPROM" se atualiza. O DAPROM só lê
 * o SAP, por intervalo ou sob demanda: o SAP real não avisa, então não há sincronização em tempo real.
 */
export function CartaoSincronizacaoSap({ inicial, ultimaLeitura }: { inicial: SincronizacaoSap; ultimaLeitura: LeituraSap | null }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [sinc, setSinc] = useState(inicial);
  const [leitura, setLeitura] = useState(ultimaLeitura);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  async function lerAgora() {
    setErro(null);
    setLendo(true);
    try {
      const { importacao_id } = await chamar<{ importacao_id: string }>("POST", "/sap/leituras");
      // O executor de tarefas roda a cada ~5 s: espera a leitura pedida terminar (sem erro, ou com o erro dela).
      for (let i = 0; i < TENTATIVAS && ativo.current; i++) {
        await new Promise((ok) => setTimeout(ok, INTERVALO_MS));
        const [atual, historico] = await Promise.all([chamar<SincronizacaoSap>("GET", "/sap/sincronizacao"), chamar<{ importacoes: LeituraSap[] }>("GET", "/importacoes?tamanho=10")]);
        setSinc(atual);
        const l = historico.importacoes.find((x) => x.id === importacao_id);
        if (!l) continue;
        const terminou = Boolean(l.erro) || (atual.ultima_leitura_sem_erro_em !== null && new Date(atual.ultima_leitura_sem_erro_em) >= new Date(l.criada_em));
        if (terminou) {
          setLeitura(l);
          exibirAviso(l.erro ? "A leitura terminou com erro." : `Leitura concluída: ${l.criadas} OS criadas, ${l.atualizadas} atualizadas, ${l.ignoradas} ignoradas.`);
          router.refresh();
          return;
        }
      }
      if (ativo.current) setErro("A leitura ainda não terminou. Atualize a página em instantes.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível pedir a leitura");
    } finally {
      if (ativo.current) setLendo(false);
    }
  }

  const proxima = sinc.automatica && sinc.ultima_leitura_sem_erro_em ? new Date(new Date(sinc.ultima_leitura_sem_erro_em).getTime() + sinc.intervalo_min * 60_000) : null;
  const ignoradas = leitura?.detalhe_ignoradas ?? [];
  return (
    <Panel>
      <div className="row between wrap">
        <div className="stack g4">
          <h2>Sincronização com o DAPROM</h2>
          <span className="small">
            {sinc.automatica ? `O DAPROM lê o SAP a cada ${sinc.intervalo_min} minutos` : "A leitura automática está desligada"}
            {sinc.ultima_leitura_sem_erro_em ? ` · última sem erro em ${dataHora(sinc.ultima_leitura_sem_erro_em)}` : " · ainda sem leitura"}
            {proxima ? ` · próxima prevista para ${dataHora(proxima)}` : ""}
          </span>
        </div>
        <div className="row g8">
          <Link className="btn btn-ghost btn-sm" href={rotas.web.importacao}>
            Histórico na Importação
          </Link>
          <Button variant="line" sm onClick={lerAgora} disabled={lendo}>
            {lendo ? "Lendo…" : "Ler agora"}
          </Button>
        </div>
      </div>
      {leitura && (
        <div className="stack g4" aria-live="polite">
          <div className="row g8 wrap">
            <Badge tone={leitura.erro ? "blq" : "enc"}>{leitura.erro ? "Falhou" : "Concluída"}</Badge>
            <span>Leitura de {dataHora(leitura.criada_em)}</span>
          </div>
          {leitura.erro ? (
            <span role="alert" style={{ color: "var(--blq)" }}>
              {leitura.erro}
            </span>
          ) : (
            <span className="muted">
              {leitura.criadas} OS criadas · {leitura.atualizadas} atualizadas · {leitura.ignoradas} ordens ignoradas
            </span>
          )}
          {ignoradas.length > 0 && (
            <details>
              <summary className="small">Ver as ordens ignoradas e o motivo</summary>
              <ul className="sim-recusados">
                {ignoradas.map((i, n) => (
                  <li key={`${i.numero_ordem ?? n}`}>
                    <span className="mono">{i.numero_ordem ?? "—"}</span> — {i.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </Panel>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import { useToast } from "@/state/toast";

export interface LeituraDoRegistro {
  id: string;
  origem: "agendada" | "manual";
  iniciada_em: string;
  concluida_em: string | null;
  conferidos: number;
  atualizados: number;
  desativados: number;
  erro: string | null;
  situacao: "concluida" | "falhou" | "tentando_de_novo" | "em_andamento";
}

/** Resposta de `GET /rh/sincronizacao`. */
export interface SincronizacaoDoRegistro {
  ultima_leitura: LeituraDoRegistro | null;
  configurado: boolean;
  leitura_hora: number;
}

const situacoes: Record<LeituraDoRegistro["situacao"], { rotulo: string; tom: BadgeTone }> = {
  concluida: { rotulo: "Concluída", tom: "enc" },
  falhou: { rotulo: "Falhou", tom: "blq" },
  tentando_de_novo: { rotulo: "Tentando de novo", tom: "al" },
  em_andamento: { rotulo: "Em andamento", tom: "exe" },
};

const INTERVALO_MS = 2_000;
const TENTATIVAS = 40;

/**
 * Cartão "Registro de funcionários" (tela de usuários, para o admin) e "Sincronização com o DAPROM" (tela do simulador): a última
 * leitura completa do registro, com o resultado (conferidos, atualizados, desativados e o erro), e o botão "Ler agora"
 * (`POST /rh/leituras`). Depois do clique, consulta `GET /rh/sincronizacao` até a leitura terminar.
 */
export function CartaoRegistro({ inicial, titulo = "Registro de funcionários" }: { inicial: SincronizacaoDoRegistro; titulo?: string }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [sinc, setSinc] = useState(inicial);
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
      const { leitura_id } = await chamar<{ leitura_id: string }>("POST", "/rh/leituras");
      // O executor de tarefas roda a cada ~5 s: espera a leitura pedida terminar.
      for (let i = 0; i < TENTATIVAS && ativo.current; i++) {
        await new Promise((ok) => setTimeout(ok, INTERVALO_MS));
        const atual = await chamar<SincronizacaoDoRegistro>("GET", "/rh/sincronizacao");
        setSinc(atual);
        const l = atual.ultima_leitura;
        if (l?.id === leitura_id && (l.situacao === "concluida" || l.situacao === "falhou")) {
          exibirAviso(l.situacao === "concluida" ? `Leitura concluída: ${l.conferidos} conferidos, ${l.atualizados} atualizados, ${l.desativados} desativados.` : "A leitura terminou com erro.");
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

  const l = sinc.ultima_leitura;
  return (
    <Panel>
      <div className="row between wrap">
        <div className="stack g4">
          <h2>{titulo}</h2>
          <span className="small">
            {sinc.configurado ? `Leitura completa todo dia às ${sinc.leitura_hora}h (horário de São Paulo); o desligamento chega na hora pelo aviso do registro.` : "O registro de funcionários não está configurado: o cadastro de usuários fica indisponível."}
          </span>
        </div>
        <Button variant="line" sm onClick={lerAgora} disabled={lendo || !sinc.configurado}>
          {lendo ? "Lendo…" : "Ler agora"}
        </Button>
      </div>
      {l ? (
        <div className="stack g4" aria-live="polite">
          <div className="row g8 wrap">
            <Badge tone={situacoes[l.situacao].tom}>{situacoes[l.situacao].rotulo}</Badge>
            <span>
              {l.origem === "manual" ? "Pedida" : "Agendada"} em {dataHora(l.iniciada_em)}
              {l.concluida_em && ` · terminou às ${dataHora(l.concluida_em).slice(-5)}`}
            </span>
          </div>
          {l.situacao === "concluida" && (
            <span className="muted">
              {l.conferidos} conferidos · {l.atualizados} atualizados · {l.desativados} desativados
            </span>
          )}
          {l.erro && (
            <span role="alert" style={{ color: "var(--blq)" }}>
              {l.erro}
            </span>
          )}
        </div>
      ) : (
        <span className="muted">Nenhuma leitura ainda.</span>
      )}
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </Panel>
  );
}

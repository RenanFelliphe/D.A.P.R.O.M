"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import type { ResponsavelDaOs } from "@/lib/tipos";

interface AtribuicaoDaOsProps {
  osId: string;
  /** Quem está com a OS reservada agora; `null` = a OS é da equipe toda. */
  responsavel: ResponsavelDaOs | null;
  /** Os técnicos ativos da equipe da OS, a quem o supervisor pode reservá-la. */
  colegas: ResponsavelDaOs[];
}

/**
 * Atribuição individual (`PUT` e `DELETE /os/{id}/responsavel`): o supervisor da equipe reserva a OS a uma pessoa. A OS segue no
 * quadro da equipe, com a marca; só o responsável inicia a APR e a execução. Vale enquanto a OS não começou.
 */
export function AtribuicaoDaOs({ osId, responsavel, colegas }: AtribuicaoDaOsProps) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function executar(acao: () => Promise<unknown>, falha: string) {
    setErro(null);
    setEnviando(true);
    try {
      await acao();
      setEscolhido("");
      iniciar(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : falha);
    } finally {
      setEnviando(false);
    }
  }

  const opcoes = colegas.filter((c) => c.id !== responsavel?.id);

  return (
    <Panel style={{ gap: 10 }}>
      <h2>Quem faz esta OS</h2>
      {responsavel ? (
        <p>
          Reservada para <strong>{responsavel.nome}</strong>. A OS continua no quadro da equipe, mas só essa pessoa inicia a APR e a execução.
        </p>
      ) : (
        <p className="muted">Hoje a OS é da equipe toda: qualquer pessoa dela pode iniciar a APR. Reserve a uma pessoa para garantir quem vai fazê-la.</p>
      )}
      <label className="small" htmlFor={`responsavel-${osId}`} style={{ color: "var(--ink3)" }}>
        {responsavel ? "Trocar o responsável" : "Reservar para"}
      </label>
      <select id={`responsavel-${osId}`} className="select" value={escolhido} onChange={(e) => setEscolhido(e.target.value)} disabled={enviando || opcoes.length === 0}>
        <option value="">{opcoes.length === 0 ? "Nenhuma outra pessoa na equipe" : "Escolha a pessoa"}</option>
        {opcoes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <div className="row wrap g8">
        <button
          className="btn btn-p btn-sm"
          type="button"
          disabled={enviando || !escolhido}
          onClick={() => executar(() => chamar("PUT", `/os/${osId}/responsavel`, { usuario_id: escolhido }), "Não foi possível reservar a OS")}
        >
          {enviando ? "Salvando…" : responsavel ? "Trocar responsável" : "Reservar a OS"}
        </button>
        {responsavel && (
          <button
            className="btn btn-line btn-sm"
            type="button"
            disabled={enviando}
            onClick={() => executar(() => chamar("DELETE", `/os/${osId}/responsavel`), "Não foi possível liberar a OS")}
          >
            Liberar para a equipe toda
          </button>
        )}
      </div>
      {erro && (
        <span role="alert" style={{ color: "var(--blq)", fontSize: 13.5 }}>
          {erro}
        </span>
      )}
    </Panel>
  );
}

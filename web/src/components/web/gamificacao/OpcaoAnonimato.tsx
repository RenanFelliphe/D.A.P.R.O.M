"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { chamar } from "@/lib/cliente-api";
import { caminhosDaApi } from "@/lib/gamificacao";

/**
 * "Aparecer como anônimo no ranking": quem marca aparece como "Participante anônimo" para os outros (a própria pessoa e o admin
 * veem o nome). Os pontos continuam valendo para a pessoa e para a equipe, e a patente e as conquistas somem do perfil para os outros.
 */
export function OpcaoAnonimato({ anonimo }: { anonimo: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(anonimo);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alterar(novo: boolean) {
    setOcupado(true);
    setErro(null);
    const anterior = valor;
    setValor(novo);
    try {
      await chamar("PUT", caminhosDaApi.rankingAnonimo, { anonimo: novo });
      router.refresh();
    } catch (e) {
      setValor(anterior);
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a opção");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="stack g6">
      <label className="opcao-anonimo">
        <input type="checkbox" checked={valor} disabled={ocupado} onChange={(e) => void alterar(e.target.checked)} />
        <span>
          <strong>Aparecer como anônimo no ranking</strong>
          <br />
          <span className="muted small">Os outros veem “Participante anônimo”. Seus pontos continuam valendo para você e para a sua equipe.</span>
        </span>
      </label>
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}

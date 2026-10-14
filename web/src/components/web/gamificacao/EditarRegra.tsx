"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { chamar } from "@/lib/cliente-api";
import { numero, type RegraDePontuacao } from "@/lib/gamificacao";
import { useToast } from "@/state/toast";

/**
 * O valor de uma tarefa e, para o admin, o editor no lugar: muda os pontos e liga ou desliga a tarefa (`PATCH
 * /gamificacao/regras/{codigo}`). A mudança vale dali em diante; o extrato antigo não muda. "Conquista obtida" não tem valor
 * próprio (os pontos vêm de cada conquista): só liga ou desliga.
 */
export function EditarRegra({ regra, podeEditar }: { regra: RegraDePontuacao; podeEditar: boolean }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(regra.pontos));
  const [ativa, setAtiva] = useState(regra.ativa);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PATCH", `/gamificacao/regras/${regra.codigo}`, regra.valor_proprio ? { pontos: Number(valor), ativa } : { ativa });
      exibirAviso(`"${regra.nome}" salva. O novo valor vale dali em diante.`);
      setEditando(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a tarefa");
    } finally {
      setOcupado(false);
    }
  }

  function cancelar() {
    setEditando(false);
    setErro(null);
    setValor(String(regra.pontos));
    setAtiva(regra.ativa);
  }

  const resumo = regra.valor_proprio ? (
    <strong>{numero(regra.pontos)}</strong>
  ) : (
    <span className="muted" title="Os pontos vêm de cada conquista">
      da conquista
    </span>
  );

  if (!editando) {
    return (
      <span className="row g8 wrap">
        {resumo}
        {!regra.ativa && <Badge tone="neu">Desativada</Badge>}
        {podeEditar && (
          <Button variant="line" sm style={{ height: 30 }} onClick={() => setEditando(true)}>
            Editar
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="stack g6">
      <span className="regra-editar">
        {regra.valor_proprio && (
          <input className="input" aria-label={`Pontos de ${regra.nome}`} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))} />
        )}
        <label className="row g6 small">
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
          Ativa
        </label>
      </span>
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)", whiteSpace: "normal" }}>
          {erro}
        </span>
      )}
      <span className="row g6">
        <Button variant="p" sm style={{ height: 30 }} onClick={salvar} disabled={ocupado || (regra.valor_proprio && (valor === "" || Number(valor) > 1000))}>
          {ocupado ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="line" sm style={{ height: 30 }} onClick={cancelar} disabled={ocupado}>
          Cancelar
        </Button>
      </span>
    </span>
  );
}

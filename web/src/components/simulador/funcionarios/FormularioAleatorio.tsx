"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { rotuloDaSituacao, type CatalogoDeFuncionarios, type SituacaoFuncionario } from "./tipos";

const LIMITE = 200;

interface Linha {
  chave: number;
  quantidade: number;
  centro: string;
  cargo: string;
  situacao: SituacaoFuncionario;
}

/**
 * Criação aleatória em lotes (`POST /rh-simulado/gestao/funcionarios/aleatorios`): cada linha pede uma quantidade, com setor, cargo e
 * situação opcionais, então "10 mecânicos e 5 eletricistas" sai num envio só. No máximo 200 por envio.
 */
export function FormularioAleatorio({ catalogo, aoConcluir }: { catalogo: CatalogoDeFuncionarios; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([{ chave: 1, quantidade: 10, centro: "", cargo: "", situacao: "ativo" }]);
  const [proxima, setProxima] = useState(2);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = linhas.reduce((soma, l) => soma + (Number.isFinite(l.quantidade) ? l.quantidade : 0), 0);
  const excede = total > LIMITE;

  const mudar = (chave: number, parte: Partial<Linha>) => setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (excede) return setErro(`No máximo ${LIMITE} funcionários por envio.`);
    setOcupado(true);
    try {
      const lotes = linhas.map((l) => ({
        quantidade: l.quantidade,
        ...(l.centro ? { centro_trabalho: l.centro } : {}),
        ...(l.cargo ? { cargo: l.cargo } : {}),
        ...(l.situacao !== "ativo" ? { situacao: l.situacao } : {}),
      }));
      const { criados } = await chamar<{ criados: number }>("POST", "/rh-simulado/gestao/funcionarios/aleatorios", { lotes });
      exibirAviso(criados === 1 ? "1 funcionário criado." : `${criados} funcionários criados.`);
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar os funcionários");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="stack g12">
      <p className="small">Nomes, datas e e-mails são inventados. Deixe o setor ou o cargo em branco para sortear.</p>
      <div className="stack g8">
        {linhas.map((l, i) => {
          const cargos = catalogo.setores.find((s) => s.centro_trabalho === l.centro)?.cargos ?? [];
          return (
            <div key={l.chave} className="sim-lote">
              <label className="field">
                <span className="small">Quantidade</span>
                <input className="input" type="number" min={1} max={LIMITE} required value={Number.isFinite(l.quantidade) ? l.quantidade : ""} onChange={(e) => mudar(l.chave, { quantidade: e.target.valueAsNumber })} aria-label={`Quantidade da linha ${i + 1}`} />
              </label>
              <label className="field">
                <span className="small">Setor</span>
                <select className="input" value={l.centro} onChange={(e) => mudar(l.chave, { centro: e.target.value, cargo: "" })} aria-label={`Setor da linha ${i + 1}`}>
                  <option value="">Qualquer</option>
                  {catalogo.setores.map((s) => (
                    <option key={s.centro_trabalho} value={s.centro_trabalho}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="small">Cargo</span>
                <select className="input" value={l.cargo} onChange={(e) => mudar(l.chave, { cargo: e.target.value })} disabled={!l.centro} aria-label={`Cargo da linha ${i + 1}`}>
                  <option value="">{l.centro ? "Qualquer do setor" : "Escolha o setor"}</option>
                  {cargos.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="small">Situação</span>
                <select className="input" value={l.situacao} onChange={(e) => mudar(l.chave, { situacao: e.target.value as SituacaoFuncionario })} aria-label={`Situação da linha ${i + 1}`}>
                  {catalogo.situacoes.map((s) => (
                    <option key={s} value={s}>
                      {rotuloDaSituacao[s]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="ibtn del" aria-label={`Remover a linha ${i + 1}`} disabled={linhas.length === 1} onClick={() => setLinhas((atual) => atual.filter((x) => x.chave !== l.chave))}>
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="row between wrap">
        <Button
          variant="line"
          sm
          onClick={() => {
            setLinhas((atual) => [...atual, { chave: proxima, quantidade: 5, centro: "", cargo: "", situacao: "ativo" }]);
            setProxima((n) => n + 1);
          }}
        >
          Adicionar linha
        </Button>
        <span className={excede ? "small" : "muted"} style={excede ? { color: "var(--blq)" } : undefined}>
          Total: {total} de no máximo {LIMITE}
        </span>
      </div>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" disabled={ocupado || excede || total < 1}>
          {ocupado ? "Criando…" : `Criar ${total} funcionário${total === 1 ? "" : "s"}`}
        </Button>
      </div>
    </form>
  );
}

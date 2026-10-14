"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import type { CatalogoDeOrdens } from "./tipos";

const LIMITE = 200;
const DIAS_PADRAO = 14;

interface Linha {
  chave: number;
  quantidade: number;
  tipo: "" | "corretiva" | "preventiva";
  centro: string;
  status: "liberada" | "criada";
  atividade: "qualquer" | "com_modelo" | "sem_modelo";
}

const nova = (chave: number, quantidade: number): Linha => ({ chave, quantidade, tipo: "", centro: "", status: "liberada", atividade: "qualquer" });

/**
 * Criação aleatória em lotes (`POST /sap-simulado/gestao/ordens/aleatorias`): cada linha pede uma quantidade, com tipo, centro de
 * trabalho, status (liberada ou criada) e atividade (com modelo de APR, sem modelo ou qualquer uma). O início programado é sorteado nos
 * próximos N dias. No máximo 200 por envio: "10 preventivas liberadas para Serviços Especiais e 5 corretivas criadas para Instrumentação"
 * sai num envio só.
 */
export function FormularioOrdensAleatorias({ catalogo, aoConcluir }: { catalogo: CatalogoDeOrdens; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([nova(1, 10)]);
  const [proxima, setProxima] = useState(2);
  const [dias, setDias] = useState(DIAS_PADRAO);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = linhas.reduce((soma, l) => soma + (Number.isFinite(l.quantidade) ? l.quantidade : 0), 0);
  const excede = total > LIMITE;
  const temModelo = catalogo.atividades.some((a) => a.com_modelo);
  const mudar = (chave: number, parte: Partial<Linha>) => setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (excede) return setErro(`No máximo ${LIMITE} ordens por envio.`);
    setOcupado(true);
    try {
      const lotes = linhas.map((l) => ({
        quantidade: l.quantidade,
        ...(l.tipo ? { tipo: l.tipo } : {}),
        ...(l.centro ? { centro_trabalho: l.centro } : {}),
        status: l.status,
        atividade: l.atividade,
      }));
      const { criadas } = await chamar<{ criadas: number }>("POST", "/sap-simulado/gestao/ordens/aleatorias", { lotes, dias: Number.isFinite(dias) ? dias : DIAS_PADRAO });
      exibirAviso(criadas === 1 ? "1 ordem criada." : `${criadas} ordens criadas.`);
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar as ordens");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="stack g12">
      <p className="small">Serviços, locais, números e datas são inventados. A atividade “com modelo” sai das do DAPROM que têm modelo de APR; “sem modelo” faz a OS entrar com o aviso “Atividade sem modelo de APR”.</p>
      <div className="stack g8">
        {linhas.map((l, i) => (
          <div key={l.chave} className="sim-lote sim-lote-ordem">
            <label className="field">
              <span className="small">Quantidade</span>
              <input className="input" type="number" min={1} max={LIMITE} required value={Number.isFinite(l.quantidade) ? l.quantidade : ""} onChange={(e) => mudar(l.chave, { quantidade: e.target.valueAsNumber })} aria-label={`Quantidade da linha ${i + 1}`} />
            </label>
            <label className="field">
              <span className="small">Tipo</span>
              <select className="input" value={l.tipo} onChange={(e) => mudar(l.chave, { tipo: e.target.value as Linha["tipo"] })} aria-label={`Tipo da linha ${i + 1}`}>
                <option value="">Qualquer</option>
                <option value="corretiva">Corretiva</option>
                <option value="preventiva">Preventiva</option>
              </select>
            </label>
            <label className="field">
              <span className="small">Centro de trabalho</span>
              <select className="input" value={l.centro} onChange={(e) => mudar(l.chave, { centro: e.target.value })} aria-label={`Centro de trabalho da linha ${i + 1}`}>
                <option value="">Qualquer</option>
                {catalogo.centros_de_trabalho.map((c) => (
                  <option key={c.centro_trabalho} value={c.centro_trabalho}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="small">Status</span>
              <select className="input" value={l.status} onChange={(e) => mudar(l.chave, { status: e.target.value as Linha["status"] })} aria-label={`Status da linha ${i + 1}`}>
                <option value="liberada">Liberada</option>
                <option value="criada">Criada</option>
              </select>
            </label>
            <label className="field">
              <span className="small">Atividade</span>
              <select className="input" value={l.atividade} onChange={(e) => mudar(l.chave, { atividade: e.target.value as Linha["atividade"] })} aria-label={`Atividade da linha ${i + 1}`}>
                <option value="qualquer">Qualquer</option>
                <option value="com_modelo" disabled={!temModelo}>
                  Com modelo
                </option>
                <option value="sem_modelo">Sem modelo</option>
              </select>
            </label>
            <button type="button" className="ibtn del" aria-label={`Remover a linha ${i + 1}`} disabled={linhas.length === 1} onClick={() => setLinhas((atual) => atual.filter((x) => x.chave !== l.chave))}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="row between wrap">
        <Button
          variant="line"
          sm
          onClick={() => {
            setLinhas((atual) => [...atual, nova(proxima, 5)]);
            setProxima((n) => n + 1);
          }}
        >
          Adicionar linha
        </Button>
        <span className={excede ? "small" : "muted"} style={excede ? { color: "var(--blq)" } : undefined}>
          Total: {total} de no máximo {LIMITE}
        </span>
      </div>
      <Field label="Início programado sorteado nos próximos (dias)">
        <input className="input" type="number" min={0} max={365} value={Number.isFinite(dias) ? dias : ""} onChange={(e) => setDias(e.target.valueAsNumber)} style={{ maxWidth: 140 }} />
      </Field>
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
          {ocupado ? "Criando…" : `Criar ${total} ordem${total === 1 ? "" : "s"}`}
        </Button>
      </div>
    </form>
  );
}

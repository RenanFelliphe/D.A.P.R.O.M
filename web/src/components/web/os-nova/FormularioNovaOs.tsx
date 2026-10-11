"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Req } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import type { Equipe } from "@/lib/tipos";
import { SeletorLocal } from "./SeletorLocal";
import { PRIORIDADES, type Atividade, type LocalEscolhido } from "./tipos";

const rotulo = { fontSize: 12 } as const;

interface FormularioNovaOsProps {
  /** Distingue os ids dos campos quando houver mais de um formulário na página. */
  prefixo: string;
  equipes: Equipe[];
  atividades: Atividade[];
  /** OS que originou esta (OS de apoio). Sem ela, é uma OS manual. */
  osOrigemId?: string;
  localInicial?: LocalEscolhido | null;
  tituloInicial?: string;
  descricaoInicial?: string;
  /** Equipe já definida (supervisor criando OS manual da própria equipe): o campo some. */
  equipeFixaId?: string | null;
  /** Hoje (`AAAA-MM-DD`), como data inicial sugerida. */
  hoje: string;
  permitirNovoLocal?: boolean;
  mostrarSolicitante?: boolean;
  rotuloEnviar: string;
  /** Texto da confirmação depois de criada. */
  mensagemCriada: string;
  /** Se quem criou pode abrir a OS nova (o supervisor só enxerga as OS da própria equipe). */
  podeAbrirOs: (equipeId: string) => boolean;
}

/** Formulário de OS nova: a manual (corretiva urgente fora do SAP) e a de apoio (`os_origem_id`), as duas por `POST /os`. */
export function FormularioNovaOs(p: FormularioNovaOsProps) {
  const [tipo, setTipo] = useState<"corretiva" | "preventiva">("corretiva");
  const [titulo, setTitulo] = useState(p.tituloInicial ?? "");
  const [descricao, setDescricao] = useState(p.descricaoInicial ?? "");
  const [atividade, setAtividade] = useState("");
  const [local, setLocal] = useState<LocalEscolhido | null>(p.localInicial ?? null);
  const [equipeId, setEquipeId] = useState(p.equipeFixaId ?? "");
  const [data, setData] = useState(p.hoje);
  const [prioridade, setPrioridade] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [criada, setCriada] = useState<{ id: string; equipeId: string } | null>(null);

  function escolherAtividade(codigo: string) {
    setAtividade(codigo);
    const a = p.atividades.find((x) => x.codigo === codigo);
    if (a && !titulo.trim()) setTitulo(a.descricao);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!titulo.trim()) return setErro("Informe o título da OS.");
    if (!local) return setErro("Escolha o local de instalação.");
    if (local.tipo === "novo" && !local.codigo.trim()) return setErro("Informe o código do local novo.");
    if (!equipeId) return setErro("Escolha a equipe.");
    if (!data) return setErro("Informe a data programada.");
    setErro(null);
    setEnviando(true);
    try {
      let localId: string;
      if (local.tipo === "novo") {
        const novo = await chamar<{ id: string }>("POST", "/locais", {
          codigo: local.codigo.trim(),
          endereco: local.endereco.trim() || undefined,
          plus_code: local.plus_code.trim() || undefined,
          cliente: local.cliente.trim() || undefined,
        });
        localId = novo.id;
        // O local já existe: se a OS falhar, a nova tentativa não cadastra de novo.
        setLocal({ tipo: "existente", id: localId, codigo: local.codigo.trim(), endereco: local.endereco.trim() || null });
      } else {
        localId = local.id;
      }
      const nova = await chamar<{ id: string }>("POST", "/os", {
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        codigo_atividade: atividade || undefined,
        local_instalacao_id: localId,
        equipe_id: equipeId,
        data_inicio_prog: data,
        prioridade: prioridade || undefined,
        solicitante: solicitante.trim() || undefined,
        os_origem_id: p.osOrigemId,
      });
      setCriada({ id: nova.id, equipeId });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a OS.");
    } finally {
      setEnviando(false);
    }
  }

  function outra() {
    setCriada(null);
    setTitulo(p.tituloInicial ?? "");
    setDescricao(p.descricaoInicial ?? "");
    setAtividade("");
    setPrioridade("");
    setSolicitante("");
  }

  if (criada) {
    return (
      <div className="stack g8">
        <Notice tone="ok" icon="check" style={{ fontSize: 14 }}>
          {p.mensagemCriada}
        </Notice>
        <div className="row g8 wrap">
          {p.podeAbrirOs(criada.equipeId) && (
            <Link href={rotas.web.os(criada.id)} style={{ fontSize: 14, fontWeight: 600 }}>
              Abrir a OS nova
            </Link>
          )}
          <Button variant="ghost" sm onClick={outra}>
            Criar outra
          </Button>
        </div>
      </div>
    );
  }

  const id = (campo: string) => `${p.prefixo}-${campo}`;
  return (
    <form className="stack g12" onSubmit={enviar} noValidate>
      <div className="row g8 wrap">
        <Field label="Tipo" htmlFor={id("tp")} labelStyle={rotulo} className="grow">
          <select className="select" id={id("tp")} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="corretiva">Corretiva</option>
            <option value="preventiva">Preventiva</option>
          </select>
        </Field>
        <Field label="Prioridade" htmlFor={id("pr")} labelStyle={rotulo} className="grow">
          <select className="select" id={id("pr")} value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
            <option value="">Sem prioridade</option>
            {PRIORIDADES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label={
          <>
            Atividade <Req>· define o modelo de APR</Req>
          </>
        }
        htmlFor={id("at")}
        labelStyle={rotulo}
      >
        <select className="select" id={id("at")} value={atividade} onChange={(e) => escolherAtividade(e.target.value)}>
          <option value="">Sem atividade</option>
          {p.atividades.map((a) => (
            <option key={a.codigo} value={a.codigo}>
              {a.descricao}
              {a.modelo_apr_codigo ? "" : " (sem modelo de APR)"}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={
          <>
            Título <Req>· obrigatório</Req>
          </>
        }
        htmlFor={id("ti")}
        labelStyle={rotulo}
      >
        <input className="input" id={id("ti")} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </Field>
      <Field label="Descrição" htmlFor={id("ds")} labelStyle={rotulo}>
        <textarea className="textarea" id={id("ds")} rows={2} style={{ fontSize: 14 }} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Field>
      <SeletorLocal prefixo={p.prefixo} valor={local} onChange={setLocal} permitirCadastrar={p.permitirNovoLocal} />
      <div className="row g8 wrap">
        {!p.equipeFixaId && (
          <Field label="Equipe" htmlFor={id("eq")} labelStyle={rotulo} className="grow">
            <select className="select" id={id("eq")} value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
              <option value="">Escolha a equipe</option>
              {p.equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Data programada" htmlFor={id("dt")} labelStyle={rotulo} className="grow">
          <input className="input" type="date" id={id("dt")} value={data} onChange={(e) => setData(e.target.value)} style={{ height: 40 }} />
        </Field>
      </div>
      {p.mostrarSolicitante && (
        <Field label="Solicitante" htmlFor={id("so")} labelStyle={rotulo}>
          <input className="input" id={id("so")} value={solicitante} onChange={(e) => setSolicitante(e.target.value)} style={{ height: 40 }} />
        </Field>
      )}
      {erro && (
        <Notice tone="blq" icon="alert" style={{ fontSize: 14 }}>
          <span role="alert">{erro}</span>
        </Notice>
      )}
      <div>
        <Button type="submit" variant="p" sm style={{ height: 44 }} disabled={enviando}>
          {enviando ? "Criando…" : p.rotuloEnviar}
        </Button>
      </div>
    </form>
  );
}

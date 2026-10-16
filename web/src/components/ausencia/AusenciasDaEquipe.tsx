"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MOTIVO_DO_AUSENTE, type Ausencia } from "@/lib/ausencia";
import type { QuemAge } from "./AcoesDaAusencia";
import { CartaoDaAusencia } from "./CartaoDaAusencia";
import { FormularioDeAusencia } from "./FormularioDeAusencia";

export interface PessoaDaEquipe {
  id: string;
  nome: string;
  /** É quem está logado (o supervisor registra a própria ausência por aqui também). */
  eu?: boolean;
}

interface BotaoRegistrarAusenciaProps {
  pessoas: PessoaDaEquipe[];
  /** Registra de uma pessoa só (o botão de um membro): o formulário já vem com ela escolhida. */
  pessoaInicial?: string;
  assinaturaPath: string | null;
  /** O supervisor está ausente: o botão fica desabilitado, com o motivo. */
  ausente: boolean;
  rotulo?: string;
  pequeno?: boolean;
}

/** "Registrar ausência": o supervisor registra a de um membro (ou a própria) sem pedido, assinando. Vale na hora. */
export function BotaoRegistrarAusencia({ pessoas, pessoaInicial, assinaturaPath, ausente, rotulo = "Registrar ausência", pequeno = false }: BotaoRegistrarAusenciaProps) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="line" sm={pequeno} onClick={() => setAberto(true)} disabled={ausente} title={ausente ? MOTIVO_DO_AUSENTE : undefined}>
        {rotulo}
      </Button>
      {aberto && (
        <FormularioDeAusencia
          modo="registrar"
          assinaturaPath={assinaturaPath}
          pessoas={pessoaInicial ? pessoas.filter((p) => p.id === pessoaInicial) : pessoas}
          pessoaInicial={pessoaInicial}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

const GRUPOS: { chave: string; titulo: string; vazio?: string; pertence: (a: Ausencia) => boolean }[] = [
  { chave: "pedidas", titulo: "Pedidos a responder", pertence: (a) => a.situacao === "pedida" },
  { chave: "fim", titulo: "Fim antecipado pedido", pertence: (a) => a.situacao === "em_curso" && Boolean(a.fim_pedido_em) },
  { chave: "vencidas", titulo: "Vencidas: o retorno não foi confirmado", pertence: (a) => a.situacao === "vencida" },
  { chave: "em_curso", titulo: "Em curso", pertence: (a) => a.situacao === "em_curso" && !a.fim_pedido_em },
  { chave: "agendadas", titulo: "Agendadas", pertence: (a) => a.situacao === "agendada" },
  { chave: "aguardando", titulo: "Aguardando a confirmação do funcionário", pertence: (a) => a.situacao === "aguardando_confirmacao" },
];

interface AusenciasDaEquipeProps {
  ausencias: Ausencia[];
  eu: QuemAge;
  /** Quem olha supervisiona a equipe (o admin só consulta: sem botões e sem "Registrar"). */
  supervisaEquipe: boolean;
  pessoas: PessoaDaEquipe[];
  equipeNome: string;
}

/**
 * A seção "Ausências" da equipe, para o supervisor: os pedidos a responder, os fins antecipados, as vencidas, as em curso e as
 * agendadas, cada uma com o que ele pode fazer, e o botão de registrar a ausência de um membro (ou a própria).
 */
export function AusenciasDaEquipe({ ausencias, eu, supervisaEquipe, pessoas, equipeNome }: AusenciasDaEquipeProps) {
  const grupos = GRUPOS.map((g) => ({ ...g, itens: ausencias.filter(g.pertence) })).filter((g) => g.itens.length > 0);
  return (
    <section className="panel" id="ausencias" aria-labelledby="ausencias-da-equipe">
      <div className="row between wrap g8">
        <h2 id="ausencias-da-equipe">Ausências</h2>
        {supervisaEquipe && <BotaoRegistrarAusencia pessoas={pessoas} assinaturaPath={eu.assinaturaPath} ausente={eu.ausente} />}
      </div>
      {grupos.length === 0 ? (
        <p className="muted">{`Ninguém da equipe ${equipeNome} tem ausência pedida, agendada ou em curso.`}</p>
      ) : (
        grupos.map((g) => (
          <div key={g.chave} className="stack g8">
            <h3 className="lbl" style={{ fontSize: 13 }}>{`${g.titulo} · ${g.itens.length}`}</h3>
            {g.itens.map((a) => (
              <CartaoDaAusencia key={a.id} ausencia={a} eu={eu} supervisaEquipe={supervisaEquipe} comPessoa />
            ))}
          </div>
        ))
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { MOTIVO_DA_REPRESENTACAO, REGRA_DO_REPRESENTANTE, desdeDaRepresentacao, type RepresentacaoDaEquipe } from "@/lib/representacao";
import { rotas } from "@/lib/rotas";
import { iniciaisDe } from "@/lib/tipos";

export interface CandidatoARepresentante {
  id: string;
  nome: string;
}

interface RepresentanteDaEquipeProps {
  equipeId: string;
  representante: { id: string; nome: string; matricula: string } | null;
  /** Em vigor quando o supervisor está ausente ou parado: o representante já responde pela equipe. */
  representacao: RepresentacaoDaEquipe | null;
  /** Os técnicos ativos da equipe que não são o supervisor. */
  candidatos: CandidatoARepresentante[];
  /** O supervisor da equipe e o admin designam (não o representante no comando, nem quem está ausente). */
  podeDesignar: boolean;
}

/**
 * "Representante": quem substitui o supervisor da equipe. Toda equipe com gente tem um (o sistema escolhe o técnico mais
 * antigo, até o supervisor ou o admin designar outro). Ele assume sozinho quando o supervisor registra uma ausência ou
 * fica 3 dias sem usar o sistema.
 */
export function RepresentanteDaEquipe({ equipeId, representante, representacao, candidatos, podeDesignar }: RepresentanteDaEquipeProps) {
  const router = useRouter();
  const idDoCampo = useId();
  const atualId = representante?.id;
  const esquema = useMemo(
    () => z.object({ escolhido: z.string().min(1, "Escolha o técnico.").refine((v) => v !== atualId, "Este já é o representante. Escolha outro técnico.") }),
    [atualId],
  );
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { escolhido: atualId ?? candidatos[0]?.id ?? "" });
  const erro = form.formState.errors.escolhido?.message;

  return (
    <section className="panel" aria-labelledby="representante-da-equipe" id="representante">
      <h2 id="representante-da-equipe">Representante</h2>
      {representante ? (
        <Link href={rotas.app.perfilDe(representante.id)} className="perfil-membro">
          <span className="avatar">{iniciaisDe(representante.nome)}</span>
          <span className="stack" style={{ minWidth: 0, lineHeight: 1.25 }}>
            <strong style={{ fontSize: 14 }}>{representante.nome}</strong>
            <span className="small">mat. {representante.matricula}</span>
          </span>
        </Link>
      ) : (
        <p className="muted">Esta equipe ainda não tem um técnico que possa representar o supervisor.</p>
      )}
      {representacao ? (
        <Notice tone="info" icon="users" style={{ fontSize: 14 }}>
          {representacao.motivo === "sem_supervisor"
            ? `${MOTIVO_DA_REPRESENTACAO.sem_supervisor} Ele responde desde ${desdeDaRepresentacao(representacao)}.`
            : `${MOTIVO_DA_REPRESENTACAO[representacao.motivo]} O representante responde pela equipe desde ${desdeDaRepresentacao(representacao)} e a devolve quando o supervisor voltar.`}
        </Notice>
      ) : (
        <p className="small muted">{REGRA_DO_REPRESENTANTE}</p>
      )}
      {podeDesignar && candidatos.length > 0 && (
        <form
          ref={ref}
          noValidate
          className="stack g8"
          style={{ marginTop: 8 }}
          onSubmit={enviar(async (v) => {
            await chamar("PUT", `/equipes/${equipeId}/representante`, { usuario_id: v.escolhido });
            router.refresh();
          })}
        >
          <Field label="Designar outro representante" htmlFor={idDoCampo} labelStyle={{ fontSize: 12, fontWeight: 600 }} erro={erro}>
          <div className="row g8 wrap">
            <select className="select" disabled={enviando} style={{ flex: 1, minWidth: 180 }} {...form.register("escolhido")} {...ligarAoErro(idDoCampo, erro)}>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.id === representante?.id ? " (atual)" : ""}
                </option>
              ))}
            </select>
            <Button variant="line" sm type="submit" aria-busy={enviando} disabled={enviando}>
              {enviando ? "Designando…" : "Designar"}
            </Button>
          </div>
          </Field>
          <ErroDeEnvio mensagem={erroEnvio} />
        </form>
      )}
    </section>
  );
}

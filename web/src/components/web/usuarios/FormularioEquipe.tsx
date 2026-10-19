"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { BotaoExcluir } from "@/components/web/BotaoExcluir";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

export interface OpcaoSupervisor {
  id: string;
  nome: string;
}

interface FormularioEquipeProps {
  /** Sem `equipe`, cria (`POST /equipes`); com ela, edita nome e supervisor (`PATCH /equipes/{id}`). */
  equipe?: { id: string; nome: string; centro_trabalho: string; supervisor_id: string | null };
  /** Usuários ativos, de qualquer perfil: quem a equipe aponta passa a supervisioná-la. */
  supervisores: OpcaoSupervisor[];
  aoConcluir: () => void;
}

const esquemaDeEdicao = z.object({
  nome: z.string().trim().min(1, "Informe o nome da equipe."),
  centro: z.string(),
  supervisorId: z.string(),
});
/** Ao criar, o centro de trabalho também é pedido; ao editar ele não muda. */
const esquemaDeCriacao = esquemaDeEdicao.extend({ centro: z.string().trim().min(1, "Informe o centro de trabalho (a chave da equipe no SAP).") });

/** Formulário de equipe do administrador. O centro de trabalho é a chave do SAP e não muda depois de criado. */
export function FormularioEquipe({ equipe, supervisores, aoConcluir }: FormularioEquipeProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando: ocupado, erroEnvio } = useFormulario(equipe ? esquemaDeEdicao : esquemaDeCriacao, { nome: equipe?.nome ?? "", centro: "", supervisorId: equipe?.supervisor_id ?? "" });
  const { register, formState } = form;
  const erros = formState.errors;

  async function excluir() {
    if (!equipe) return;
    await chamar("DELETE", `/equipes/${equipe.id}`);
    exibirAviso(`Equipe ${equipe.nome} excluída.`);
    router.refresh();
    aoConcluir();
  }

  // o supervisor atual pode ter sido desativado: mantém a opção visível para o admin trocá-lo conscientemente
  const opcoes = equipe?.supervisor_id && !supervisores.some((s) => s.id === equipe.supervisor_id) ? [{ id: equipe.supervisor_id, nome: "Supervisor atual (inativo)" }, ...supervisores] : supervisores;

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        if (equipe) {
          await chamar("PATCH", `/equipes/${equipe.id}`, { nome: v.nome.trim(), supervisor_id: v.supervisorId || null });
          exibirAviso("Equipe atualizada.");
        } else {
          await chamar("POST", "/equipes", { nome: v.nome.trim(), centro_trabalho: v.centro.trim(), supervisor_id: v.supervisorId || null });
          exibirAviso("Equipe criada.");
        }
        router.refresh();
        aoConcluir();
      })}
    >
      <Field label="Nome da equipe" htmlFor="equipe-nome" erro={erros.nome?.message}>
        <input className="input" {...register("nome")} {...ligarAoErro("equipe-nome", erros.nome?.message)} autoComplete="off" />
      </Field>
      <Field label="Centro de trabalho (chave do SAP)" htmlFor="equipe-centro" erro={erros.centro?.message}>
        {equipe ? (
          <>
            <input className="input mono" id="equipe-centro" value={equipe.centro_trabalho} readOnly aria-readonly="true" style={{ background: "var(--surface2)" }} />
            <span className="small">O centro de trabalho não muda: é por ele que a leitura do SAP encontra a equipe.</span>
          </>
        ) : (
          <>
            <input className="input mono" {...register("centro")} {...ligarAoErro("equipe-centro", erros.centro?.message)} placeholder="SERV_ESP" autoComplete="off" />
            <span className="small">Igual ao centro de trabalho da OS no SAP. Não poderá ser alterado depois.</span>
          </>
        )}
      </Field>
      <Field label="Supervisor" htmlFor="equipe-supervisor">
        <select className="input" id="equipe-supervisor" {...register("supervisorId")}>
          <option value="">Sem supervisor (os alertas ficam só com o admin)</option>
          {opcoes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </Field>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row between g8" style={{ alignItems: "flex-start" }}>
        {equipe ? <BotaoExcluir rotulo="Excluir equipe" pergunta="Excluir esta equipe? Só é possível se nenhum usuário nem OS estiver ligado a ela." aoExcluir={excluir} desabilitado={ocupado} /> : <span />}
        <span className="row g8">
          <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
            Cancelar
          </Button>
          <Button variant="p" sm type="submit" aria-busy={ocupado} disabled={ocupado}>
            {ocupado ? "Salvando…" : equipe ? "Salvar" : "Criar equipe"}
          </Button>
        </span>
      </div>
    </form>
  );
}

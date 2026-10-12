"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
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

/** Formulário de equipe do administrador. O centro de trabalho é a chave do SAP e não muda depois de criado. */
export function FormularioEquipe({ equipe, supervisores, aoConcluir }: FormularioEquipeProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [nome, setNome] = useState(equipe?.nome ?? "");
  const [centro, setCentro] = useState("");
  const [supervisorId, setSupervisorId] = useState(equipe?.supervisor_id ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      if (equipe) {
        await chamar("PATCH", `/equipes/${equipe.id}`, { nome: nome.trim(), supervisor_id: supervisorId || null });
        exibirAviso("Equipe atualizada.");
      } else {
        await chamar("POST", "/equipes", { nome: nome.trim(), centro_trabalho: centro.trim(), supervisor_id: supervisorId || null });
        exibirAviso("Equipe criada.");
      }
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a equipe");
    } finally {
      setOcupado(false);
    }
  }

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
    <form onSubmit={enviar} className="stack g12">
      <Field label="Nome da equipe">
        <input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Centro de trabalho (chave do SAP)">
        {equipe ? (
          <>
            <input className="input mono" value={equipe.centro_trabalho} readOnly aria-readonly="true" style={{ background: "var(--surface2)" }} />
            <span className="small">O centro de trabalho não muda: é por ele que a leitura do SAP encontra a equipe.</span>
          </>
        ) : (
          <>
            <input className="input mono" required value={centro} onChange={(e) => setCentro(e.target.value)} placeholder="SERV_ESP" autoComplete="off" />
            <span className="small">Igual ao centro de trabalho da OS no SAP. Não poderá ser alterado depois.</span>
          </>
        )}
      </Field>
      <Field label="Supervisor">
        <select className="input" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
          <option value="">Sem supervisor (os alertas ficam só com o admin)</option>
          {opcoes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </Field>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row between g8" style={{ alignItems: "flex-start" }}>
        {equipe ? <BotaoExcluir rotulo="Excluir equipe" pergunta="Excluir esta equipe? Só é possível se nenhum usuário nem OS estiver ligado a ela." aoExcluir={excluir} desabilitado={ocupado} /> : <span />}
        <span className="row g8">
          <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
            Cancelar
          </Button>
          <Button variant="p" sm type="submit" disabled={ocupado}>
            {ocupado ? "Salvando…" : equipe ? "Salvar" : "Criar equipe"}
          </Button>
        </span>
      </div>
    </form>
  );
}

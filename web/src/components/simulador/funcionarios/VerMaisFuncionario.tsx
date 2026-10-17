"use client";

import { useEffect, useState } from "react";
import { JanelaVerMais } from "@/components/simulador/JanelaVerMais";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia, dataHora } from "@/lib/formatar";
import { rotuloDoPerfil } from "@/lib/tipos";
import { rotuloDaSituacao, type Funcionario, type ListaDeFuncionarios } from "./tipos";

/** "Ver mais" do funcionário: todos os campos do registro (com o nome do gestor) e, se houver, a conta dele no SYNC OS. */
export function VerMaisFuncionario({ funcionario: f, nomesDeEquipe, aoFechar }: { funcionario: Funcionario; nomesDeEquipe: Record<string, string>; aoFechar: () => void }) {
  const [gestor, setGestor] = useState<string | null>(null);

  useEffect(() => {
    if (!f.gestor_matricula) return;
    let ativo = true;
    chamar<ListaDeFuncionarios>("GET", `/rh-simulado/gestao/funcionarios?busca=${encodeURIComponent(f.gestor_matricula)}&tamanho=10`)
      .then((r) => ativo && setGestor(r.funcionarios.find((x) => x.matricula === f.gestor_matricula)?.nome ?? null))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [f.gestor_matricula]);

  const conta = f.conta_no_sync_os;
  return (
    <JanelaVerMais
      titulo={f.nome}
      aoFechar={aoFechar}
      secoes={[
        {
          titulo: "No registro de funcionários",
          itens: [
            { rotulo: "Matrícula", valor: <span className="mono">{f.matricula}</span> },
            { rotulo: "Situação", valor: rotuloDaSituacao[f.situacao] },
            { rotulo: "E-mail institucional", valor: f.email },
            { rotulo: "Cargo", valor: f.cargo },
            { rotulo: "Setor", valor: `${f.centro_trabalho} · ${f.setor}` },
            { rotulo: "Registro profissional", valor: f.registro_profissional },
            { rotulo: "Data de admissão", valor: dataDoDia(f.data_admissao) },
            { rotulo: "Data de nascimento", valor: dataDoDia(f.data_nascimento) },
            { rotulo: "Telefone corporativo", valor: f.telefone },
            { rotulo: "Gestor imediato", valor: f.gestor_matricula ? (gestor ? `${gestor} (${f.gestor_matricula})` : f.gestor_matricula) : null },
            { rotulo: "Lotação", valor: f.lotacao },
            { rotulo: "Última alteração", valor: dataHora(f.alterado_em) },
          ],
        },
        {
          titulo: "No SYNC OS",
          itens: conta
            ? [
                { rotulo: "Conta", valor: conta.ativo ? "Ativa" : "Desativada" },
                { rotulo: "Perfil", valor: rotuloDoPerfil[conta.perfil] },
                { rotulo: "Equipe", valor: conta.equipe_id ? (nomesDeEquipe[conta.equipe_id] ?? "—") : "Sem equipe" },
                { rotulo: "Acesso", valor: conta.liberacao === "liberado" ? "Liberado" : conta.liberacao === "pendente" ? "Aguarda liberação" : "Recusado" },
              ]
            : [{ rotulo: "Conta", valor: "Ainda não tem conta no SYNC OS" }],
        },
      ]}
    />
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { caminhoDaConfiguracao, type ContatosDoPaeDoSistema } from "@/lib/configuracoes";
import { CONTATOS_PUBLICOS, MAX_CONTATOS_DO_PAE, telefoneValido } from "@/lib/emergencia";
import { dataHora } from "@/lib/formatar";

interface Linha {
  nome: string;
  telefone: string;
  descricao: string;
}

const vazia = (): Linha => ({ nome: "", telefone: "", descricao: "" });
const doServidor = (c: ContatosDoPaeDoSistema): Linha[] => c.contatos.map((x) => ({ nome: x.nome, telefone: x.telefone, descricao: x.descricao ?? "" }));

/**
 * Os contatos do PAE (Plano de Atendimento a Emergências) que o botão de emergência mostra para ligar, no app e na web. A Segurança do Trabalho fornece os
 * números; até lá a lista fica vazia e o botão mostra só o SAMU e os Bombeiros. Salva a lista inteira (`PUT /configuracoes/sistema/contatos_pae`) e vale na hora.
 */
export function ContatosDoPae({ contatos }: { contatos: ContatosDoPaeDoSistema }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>(() => doServidor(contatos));
  const [enviando, setEnviando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (i: number, campo: keyof Linha, valor: string) => {
    setSalvo(false);
    setErro(null);
    setLinhas((atuais) => atuais.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  };
  const faltas = linhas.map((l) => (l.nome.trim().length < 2 ? "Informe o nome." : !telefoneValido(l.telefone) ? "Informe um telefone que dê para ligar (de 3 a 15 dígitos)." : null));
  const alterado = JSON.stringify(linhas) !== JSON.stringify(doServidor(contatos));

  async function salvar() {
    const primeira = faltas.find(Boolean);
    if (primeira) return setErro(primeira);
    setEnviando(true);
    setErro(null);
    try {
      await chamar("PUT", caminhoDaConfiguracao("contatos_pae"), { valor: linhas.map((l) => ({ nome: l.nome.trim(), telefone: l.telefone.trim(), descricao: l.descricao.trim() || null })) });
      setSalvo(true);
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function restaurar() {
    setEnviando(true);
    setErro(null);
    try {
      await chamar("DELETE", caminhoDaConfiguracao("contatos_pae"));
      setLinhas([]);
      setSalvo(false);
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="panel cfg-bloco" aria-labelledby="cfg-pae" data-treino="cfg-pae">
      <header>
        <h2 id="cfg-pae">Contatos de emergência (PAE)</h2>
        <p>
          Quem o botão de emergência manda ligar: a brigada, a Segurança do Trabalho, o plantão. Aparecem no app e na web, em todas as execuções. O {CONTATOS_PUBLICOS.map((c) => `${c.nome} (${c.telefone})`).join(" e o ")} aparecem sempre.
          {contatos.personalizado && contatos.atualizado_em ? ` Alterado em ${dataHora(contatos.atualizado_em)}.` : ""}
        </p>
      </header>

      {linhas.length === 0 && (
        <Notice tone="al" icon="alert">
          Nenhum contato do PAE cadastrado. O botão de emergência já avisa o supervisor e o administrador, mas só mostra o SAMU e os Bombeiros para ligar.
        </Notice>
      )}

      <div className="stack g8">
        {linhas.map((l, i) => (
          <div key={i} className="row g8 wrap" style={{ alignItems: "flex-end" }}>
            <label className="stack g4" style={{ flex: "1 1 180px" }}>
              <span className="small">Nome</span>
              <input className="input" value={l.nome} maxLength={80} onChange={(e) => mudar(i, "nome", e.target.value)} placeholder="Brigada da unidade" />
            </label>
            <label className="stack g4" style={{ flex: "1 1 150px" }}>
              <span className="small">Telefone</span>
              <input className="input" inputMode="tel" value={l.telefone} maxLength={30} onChange={(e) => mudar(i, "telefone", e.target.value)} placeholder="(27) 99999-0000" />
            </label>
            <label className="stack g4" style={{ flex: "2 1 220px" }}>
              <span className="small">O que atende (opcional)</span>
              <input className="input" value={l.descricao} maxLength={120} onChange={(e) => mudar(i, "descricao", e.target.value)} placeholder="Plantão 24 h" />
            </label>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setLinhas((atuais) => atuais.filter((_, j) => j !== i))} aria-label={`Remover ${l.nome || "o contato"}`}>
              Remover
            </button>
          </div>
        ))}
      </div>

      <ErroDeEnvio mensagem={erro} />
      {salvo && (
        <Notice tone="ok" icon="check" role="status">
          Salvo. Já vale no app e na web.
        </Notice>
      )}
      <div className="cfg-acoes">
        <button className="btn btn-line btn-sm" type="button" onClick={() => setLinhas((atuais) => [...atuais, vazia()])} disabled={linhas.length >= MAX_CONTATOS_DO_PAE}>
          Adicionar contato
        </button>
        <button className="btn btn-p btn-sm" type="button" aria-busy={enviando} disabled={enviando || !alterado} onClick={() => void salvar()}>
          {enviando ? "Salvando…" : "Salvar"}
        </button>
        {contatos.personalizado && (
          <button className="btn btn-line btn-sm" type="button" onClick={() => void restaurar()} disabled={enviando}>
            Apagar todos
          </button>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { CampoImagem } from "@/components/web/gamificacao/CampoImagem";
import type { Patente } from "@/lib/gamificacao";
import { chamar, enviarFormulario } from "@/lib/cliente-api";

interface FormularioPatenteProps {
  /** A patente que está sendo editada; sem ela, o formulário cria uma nova. */
  patente?: Patente;
  aoConcluir: (mensagem: string) => void;
  aoCancelar: () => void;
}

const COR_PADRAO = "#9DB4C0";

/**
 * Cadastro de uma patente (na `JanelaModal`): nome, pontuação necessária, cor, descrição, se está ativa e as duas imagens, a das
 * pessoas e a das equipes. Cada uma é escolhida à parte e as duas só ficam iguais se o admin escolher o mesmo arquivo nos dois
 * campos. Criar envia tudo junto (`POST /gamificacao/patentes`, multipart); editar muda os campos (`PATCH`) e troca só a imagem
 * que a pessoa escolheu de novo (`PUT .../imagem` e `PUT .../imagem-equipe`).
 */
export function FormularioPatente({ patente, aoConcluir, aoCancelar }: FormularioPatenteProps) {
  const [nome, setNome] = useState(patente?.nome ?? "");
  const [pontosNecessarios, setPontosNecessarios] = useState(patente ? String(patente.pontos_necessarios) : "");
  const [cor, setCor] = useState(patente?.cor ?? COR_PADRAO);
  const [descricao, setDescricao] = useState(patente?.descricao ?? "");
  const [ativa, setAtiva] = useState(patente?.ativa ?? true);
  const [imagem, setImagem] = useState<File | null>(null);
  const [erroDaImagem, setErroDaImagem] = useState<string | null>(null);
  const [imagemDaEquipe, setImagemDaEquipe] = useState<File | null>(null);
  const [erroDaImagemDaEquipe, setErroDaImagemDaEquipe] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const corValida = /^#[0-9A-Fa-f]{6}$/.test(cor);
  const imagensOk = patente ? true : Boolean(imagem && imagemDaEquipe);
  const pronto =
    nome.trim() !== "" && pontosNecessarios.trim() !== "" && Number.isInteger(Number(pontosNecessarios)) && Number(pontosNecessarios) >= 0 && corValida && imagensOk && !erroDaImagem && !erroDaImagemDaEquipe;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      if (!patente) {
        const form = new FormData();
        form.set("nome", nome.trim());
        form.set("pontos_necessarios", pontosNecessarios);
        form.set("cor", cor);
        form.set("descricao", descricao.trim());
        form.set("ativa", String(ativa));
        form.set("imagem", imagem!);
        form.set("imagem_equipe", imagemDaEquipe!);
        await enviarFormulario("/gamificacao/patentes", form);
        aoConcluir(`Patente "${nome.trim()}" criada.`);
        return;
      }
      await chamar("PATCH", `/gamificacao/patentes/${patente.id}`, { nome: nome.trim(), pontos_necessarios: Number(pontosNecessarios), cor, descricao: descricao.trim(), ativa });
      if (imagem) {
        const form = new FormData();
        form.set("imagem", imagem);
        await enviarFormulario(`/gamificacao/patentes/${patente.id}/imagem`, form, "PUT");
      }
      if (imagemDaEquipe) {
        const form = new FormData();
        form.set("imagem_equipe", imagemDaEquipe);
        await enviarFormulario(`/gamificacao/patentes/${patente.id}/imagem-equipe`, form, "PUT");
      }
      aoConcluir(`Patente "${nome.trim()}" salva.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a patente");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="stack g12">
      <div className="grade2">
        <Field label="Nome" htmlFor="patente-nome">
          <input id="patente-nome" className="input" required maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ouro" />
        </Field>
        <Field label="Pontos necessários na temporada" htmlFor="patente-pontos">
          <input id="patente-pontos" className="input" required inputMode="numeric" value={pontosNecessarios} onChange={(e) => setPontosNecessarios(e.target.value.replace(/\D/g, ""))} placeholder="1500" />
        </Field>
        <Field label="Cor (destaca o nome e a barra)" htmlFor="patente-cor">
          <div className="row g8">
            <input aria-label="Escolher a cor" type="color" value={corValida ? cor : COR_PADRAO} onChange={(e) => setCor(e.target.value.toUpperCase())} style={{ width: 44, height: 40, padding: 2 }} />
            <input id="patente-cor" className="input mono" maxLength={7} value={cor} onChange={(e) => setCor(e.target.value.toUpperCase())} aria-invalid={!corValida} />
          </div>
        </Field>
        <Field label="Situação" htmlFor="patente-ativa">
          <label className="row g8" style={{ height: 40 }}>
            <input id="patente-ativa" type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (a desativada deixa de ser atribuída, mas continua no histórico)
          </label>
        </Field>
      </div>
      <Field label="Descrição (opcional)" htmlFor="patente-descricao">
        <textarea id="patente-descricao" className="textarea" rows={2} maxLength={300} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Field>
      <div className="grade2">
        <CampoImagem
          rotulo="Imagem das pessoas"
          arquivo={imagem}
          aoEscolher={setImagem}
          urlAtual={patente?.imagem_url}
          obrigatoria={!patente}
          desabilitado={ocupado}
          erro={erroDaImagem}
          aoRecusar={setErroDaImagem}
        />
        <CampoImagem
          rotulo="Imagem das equipes"
          arquivo={imagemDaEquipe}
          aoEscolher={setImagemDaEquipe}
          urlAtual={patente?.imagem_equipe_url}
          obrigatoria={!patente}
          desabilitado={ocupado}
          erro={erroDaImagemDaEquipe}
          aoRecusar={setErroDaImagemDaEquipe}
        />
      </div>
      <span className="small muted">
        A imagem das pessoas aparece no ranking de pessoas, no perfil e na barra; a das equipes, no ranking de equipes e na equipe. Elas só ficam iguais se você escolher o mesmo arquivo nos dois campos.
      </span>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8">
        <Button variant="p" type="submit" disabled={ocupado || !pronto}>
          {ocupado ? "Salvando…" : patente ? "Salvar" : "Criar patente"}
        </Button>
        <Button variant="line" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

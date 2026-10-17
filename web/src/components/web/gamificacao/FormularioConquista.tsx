"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { CampoImagem } from "@/components/web/gamificacao/CampoImagem";
import { chamar, enviarFormulario } from "@/lib/cliente-api";
import type { Conquista, CriterioDeConquista } from "@/lib/gamificacao";

interface FormularioConquistaProps {
  /** A conquista que está sendo editada; sem ela, o formulário cria uma nova. */
  conquista?: Conquista;
  criterios: CriterioDeConquista[];
  /** As patentes que podem ser a meta nos critérios de patente. */
  patentes: { id: string; nome: string }[];
  aoConcluir: (mensagem: string) => void;
  aoCancelar: () => void;
}

/**
 * Cadastro de uma conquista (na `JanelaModal`): título, descrição, a meta (um critério e a quantidade, ou a patente), os pontos,
 * se está ativa e a imagem do troféu. O critério diz se a conquista é de pessoa ou de equipe (a de equipe nunca dá pontos).
 * Criar ou mudar a meta vale também para o passado: quem já bateu a meta recebe na hora.
 */
export function FormularioConquista({ conquista, criterios, patentes, aoConcluir, aoCancelar }: FormularioConquistaProps) {
  const [titulo, setTitulo] = useState(conquista?.titulo ?? "");
  const [descricao, setDescricao] = useState(conquista?.descricao ?? "");
  const [criterio, setCriterio] = useState(conquista?.criterio ?? criterios[0]?.codigo ?? "");
  const [quantidade, setQuantidade] = useState(String(conquista?.quantidade ?? 1));
  const [patenteId, setPatenteId] = useState(conquista?.patente?.id ?? patentes[0]?.id ?? "");
  const [pontos, setPontos] = useState(String(conquista?.pontos ?? 25));
  const [ativa, setAtiva] = useState(conquista?.ativa ?? true);
  const [imagem, setImagem] = useState<File | null>(null);
  const [erroDaImagem, setErroDaImagem] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const info = criterios.find((c) => c.codigo === criterio);
  const deEquipe = info?.tipo === "equipe";
  // Pessoa e equipe não se trocam depois de criada: na edição só aparecem os critérios do mesmo tipo.
  const opcoes = conquista ? criterios.filter((c) => c.tipo === (conquista.tipo)) : criterios;
  const pontosValidos = deEquipe || (pontos.trim() !== "" && Number(pontos) >= 0 && Number(pontos) <= 1000);
  const quantidadeValida = !info?.pede_quantidade || (Number.isInteger(Number(quantidade)) && Number(quantidade) >= 1);
  const pronto = titulo.trim() !== "" && descricao.trim() !== "" && info && quantidadeValida && pontosValidos && (!info.pede_patente || patenteId !== "") && (conquista || imagem) && !erroDaImagem;

  function trocarCriterio(novo: string) {
    setCriterio(novo);
    if (criterios.find((c) => c.codigo === novo)?.tipo === "equipe") setPontos("0");
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!info) return;
    setOcupado(true);
    setErro(null);
    const campos = {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      criterio,
      quantidade: info.pede_quantidade ? Number(quantidade) : 1,
      patente_id: info.pede_patente ? patenteId : null,
      pontos: deEquipe ? 0 : Number(pontos),
      ativa,
    };
    try {
      if (!conquista) {
        const form = new FormData();
        for (const [chave, valor] of Object.entries(campos)) if (valor !== null) form.set(chave, String(valor));
        form.set("imagem", imagem!);
        await enviarFormulario("/gamificacao/conquistas", form);
        aoConcluir(`Conquista "${campos.titulo}" criada. Quem já cumpria a meta recebeu na hora.`);
        return;
      }
      await chamar("PATCH", `/gamificacao/conquistas/${conquista.id}`, campos);
      if (imagem) {
        const form = new FormData();
        form.set("imagem", imagem);
        await enviarFormulario(`/gamificacao/conquistas/${conquista.id}/imagem`, form, "PUT");
      }
      aoConcluir(`Conquista "${campos.titulo}" salva.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a conquista");
    } finally {
      setOcupado(false);
    }
  }

  const pessoas = opcoes.filter((c) => c.tipo === "pessoa");
  const equipes = opcoes.filter((c) => c.tipo === "equipe");
  return (
    <form onSubmit={enviar} className="stack g12">
      <Field label="Título" htmlFor="conquista-titulo">
        <input id="conquista-titulo" className="input" required maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Olho vivo" />
      </Field>
      <Field label="Descrição" htmlFor="conquista-descricao">
        <textarea id="conquista-descricao" className="textarea" rows={2} required maxLength={300} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Cinquenta análises antes de pôr a mão no serviço." />
      </Field>
      <div className="grade2">
        <Field label="Meta: critério" htmlFor="conquista-criterio">
          <select id="conquista-criterio" className="select" value={criterio} onChange={(e) => trocarCriterio(e.target.value)}>
            {pessoas.length > 0 && (
              <optgroup label="Pessoa">
                {pessoas.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.rotulo}
                  </option>
                ))}
              </optgroup>
            )}
            {equipes.length > 0 && (
              <optgroup label="Equipe">
                {equipes.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.rotulo}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>
        {info?.pede_patente ? (
          <Field label="Meta: patente" htmlFor="conquista-patente">
            <select id="conquista-patente" className="select" value={patenteId} onChange={(e) => setPatenteId(e.target.value)}>
              {patentes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Field>
        ) : info?.pede_quantidade ? (
          <Field label={`Meta: quantidade (${info.unidade})`} htmlFor="conquista-quantidade">
            <input id="conquista-quantidade" className="input" inputMode="numeric" required value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))} />
          </Field>
        ) : (
          <Field label="Meta" htmlFor="conquista-fixa">
            <input id="conquista-fixa" className="input" value="Uma vez" disabled readOnly />
          </Field>
        )}
        <Field label={deEquipe ? "Pontos (a de equipe não dá pontos)" : "Pontos que a pessoa ganha (25 fácil, 50 média, 100 difícil)"} htmlFor="conquista-pontos">
          <input id="conquista-pontos" className="input" inputMode="numeric" disabled={deEquipe} value={deEquipe ? "0" : pontos} onChange={(e) => setPontos(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Situação" htmlFor="conquista-ativa">
          <label className="campo-marca">
            <input id="conquista-ativa" type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (a desativada deixa de ser dada; quem a tem continua com ela)
          </label>
        </Field>
      </div>
      <CampoImagem rotulo="Imagem do troféu" arquivo={imagem} aoEscolher={setImagem} urlAtual={conquista?.imagem_url} obrigatoria={!conquista} desabilitado={ocupado} erro={erroDaImagem} aoRecusar={setErroDaImagem} />
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8">
        <Button variant="p" type="submit" disabled={ocupado || !pronto}>
          {ocupado ? "Salvando…" : conquista ? "Salvar" : "Criar conquista"}
        </Button>
        <Button variant="line" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

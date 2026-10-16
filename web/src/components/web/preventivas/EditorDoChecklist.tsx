"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MAX_PERGUNTAS_DO_CHECKLIST, MAX_TEXTO_DA_PERGUNTA } from "@/lib/checklist-inspecao";
import { novoId } from "@/lib/cliente-api";

/** Uma pergunta na edição: `id` é o da pergunta que já existe no plano (a nova não tem); `chave` identifica a linha na tela. */
export interface PerguntaEditavel {
  chave: string;
  id?: string;
  texto: string;
}

interface EditorDoChecklistProps {
  id: string;
  perguntas: PerguntaEditavel[];
  aoMudar: (perguntas: PerguntaEditavel[]) => void;
  desabilitado?: boolean;
}

/** Adicionar, editar, remover e reordenar as perguntas do checklist de inspeção do plano (até 50, de até 300 caracteres). */
export function EditorDoChecklist({ id, perguntas, aoMudar, desabilitado }: EditorDoChecklistProps) {
  const mudarTexto = (chave: string, texto: string) => aoMudar(perguntas.map((p) => (p.chave === chave ? { ...p, texto } : p)));
  const remover = (chave: string) => aoMudar(perguntas.filter((p) => p.chave !== chave));
  const mover = (indice: number, passo: -1 | 1) => {
    const lista = [...perguntas];
    [lista[indice], lista[indice + passo]] = [lista[indice + passo]!, lista[indice]!];
    aoMudar(lista);
  };
  const cheio = perguntas.length >= MAX_PERGUNTAS_DO_CHECKLIST;

  return (
    <div className="stack g8">
      {perguntas.length === 0 ? (
        <span className="small">Sem perguntas: as OS deste plano encerram sem checklist.</span>
      ) : (
        <ol className="insp-editor">
          {perguntas.map((p, i) => (
            <li key={p.chave}>
              <span className="small" style={{ width: 22, textAlign: "right", flex: "none" }}>
                {i + 1}.
              </span>
              <input
                id={i === 0 ? id : undefined}
                className="input"
                value={p.texto}
                maxLength={MAX_TEXTO_DA_PERGUNTA}
                onChange={(e) => mudarTexto(p.chave, e.target.value)}
                disabled={desabilitado}
                aria-label={`Pergunta ${i + 1}`}
                placeholder="Ex.: A tensão de saída está dentro da faixa?"
              />
              <Button variant="ghost" sm aria-label={`Subir a pergunta ${i + 1}`} disabled={desabilitado || i === 0} onClick={() => mover(i, -1)}>
                <Icon name="down" size={16} style={{ transform: "rotate(180deg)" }} />
              </Button>
              <Button variant="ghost" sm aria-label={`Descer a pergunta ${i + 1}`} disabled={desabilitado || i === perguntas.length - 1} onClick={() => mover(i, 1)}>
                <Icon name="down" size={16} />
              </Button>
              <Button variant="ghost" sm aria-label={`Remover a pergunta ${i + 1}`} disabled={desabilitado} onClick={() => remover(p.chave)}>
                <Icon name="x" size={16} />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <div className="row g8 wrap" style={{ alignItems: "center" }}>
        <Button variant="line" sm disabled={desabilitado || cheio} onClick={() => aoMudar([...perguntas, { chave: novoId(), texto: "" }])}>
          <Icon name="plus" size={16} />
          Adicionar pergunta
        </Button>
        <span className="small">
          {perguntas.length} de {MAX_PERGUNTAS_DO_CHECKLIST} perguntas
        </span>
      </div>
    </div>
  );
}

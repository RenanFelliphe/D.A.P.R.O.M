"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";

interface FormularioNovoModeloProps {
  /** Próximo código livre no padrão dos documentos (`APR 10`). */
  sugestao: string;
  /** Códigos já usados, com a situação de cada um (o excluído só volta restaurado). */
  existentes: { codigo: string; excluido: boolean }[];
  /** Modelos publicados que servem de ponto de partida. */
  modelos: { codigo: string; titulo: string }[];
}

/**
 * Cadastro de um modelo novo (`POST /modelos-apr/{codigo}/versoes`): código, título, a revisão e a data do documento
 * em papel, e o ponto de partida (em branco ou copiando outro modelo). Nasce como rascunho e abre no editor.
 */
export function FormularioNovoModelo({ sugestao, existentes, modelos }: FormularioNovoModeloProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [codigo, setCodigo] = useState(sugestao);
  const [titulo, setTitulo] = useState("");
  const [versao, setVersao] = useState("1");
  const [dataDocumento, setDataDocumento] = useState("");
  const [copiarDe, setCopiarDe] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const limpo = codigo.trim().replace(/\s+/g, " ");
  const repetido = existentes.find((e) => e.codigo.toLowerCase() === limpo.toLowerCase());
  const reservado = limpo.toLowerCase() === "novo";
  const avisoDoCodigo = repetido
    ? repetido.excluido
      ? `O ${repetido.codigo} foi excluído. Restaure-o na aba Modelos em vez de criar outro.`
      : `Já existe o ${repetido.codigo}. Para mudá-lo, abra o modelo e crie uma nova versão.`
    : reservado
      ? "Escolha outro código."
      : null;
  const numeroDaVersao = Number(versao);
  const versaoValida = Number.isInteger(numeroDaVersao) && numeroDaVersao >= 1 && numeroDaVersao <= 999;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      const base = { titulo: titulo.trim(), versao: numeroDaVersao, data_documento: dataDocumento || null };
      await chamar("POST", `/modelos-apr/${encodeURIComponent(limpo)}/versoes`, copiarDe ? { ...base, copiar_de: copiarDe } : { ...base, riscos: [], itens: [] });
      exibirAviso(`Rascunho do ${limpo} criado. Ajuste os itens e publique.`);
      router.push(rotas.web.modelo(limpo));
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o modelo");
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <Panel style={{ padding: "20px 22px", gap: 16, maxWidth: 760 }}>
        <div className="grade2">
          <Field label="Código" htmlFor="nm-codigo">
            <input
              id="nm-codigo"
              className="input mono"
              required
              maxLength={40}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              aria-invalid={avisoDoCodigo ? true : undefined}
              aria-describedby="nm-codigo-ajuda"
            />
            <span id="nm-codigo-ajuda" className="small" style={avisoDoCodigo ? { color: "var(--blq)" } : undefined}>
              {avisoDoCodigo ?? "Como no documento em papel: APR 01, APR 02…"}
            </span>
          </Field>
          <Field label="Primeira versão (revisão do documento)" htmlFor="nm-versao">
            <input id="nm-versao" className="input" type="number" min={1} max={999} required value={versao} onChange={(e) => setVersao(e.target.value)} />
            <span className="small">O &quot;REV 03&quot; do papel vira a versão 3.</span>
          </Field>
        </div>
        <Field label="Título" htmlFor="nm-titulo">
          <input
            id="nm-titulo"
            className="input"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="ESPAÇO CONFINADO E/OU TRABALHO EM ALTURA"
          />
        </Field>
        <div className="grade2">
          <Field label="Data do documento" htmlFor="nm-data">
            <input id="nm-data" className="input" type="date" value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} />
          </Field>
          <Field label="Ponto de partida" htmlFor="nm-base">
            <select id="nm-base" className="select" value={copiarDe} onChange={(e) => setCopiarDe(e.target.value)}>
              <option value="">Em branco</option>
              {modelos.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {`Copiar do ${m.codigo} — ${m.titulo}`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Notice tone="info" icon="info">
          {copiarDe
            ? `O rascunho começa com os itens, riscos, medidas e o PAE da versão em uso do ${copiarDe}; o ${copiarDe} não muda.`
            : "O rascunho começa vazio: os itens de verificação, os riscos e as medidas são adicionados no editor."}{" "}
          O técnico só vê o modelo depois de publicado, e as OS só o usam quando a atividade delas estiver ligada a ele na aba Atividades.
        </Notice>
        {erro && (
          <Notice tone="blq" icon="alert">
            {erro}
          </Notice>
        )}
        <div className="row g8" style={{ justifyContent: "flex-end" }}>
          <LinkButton variant="line" sm href={rotas.web.modelos}>
            Cancelar
          </LinkButton>
          <Button variant="p" sm type="submit" disabled={ocupado || !limpo || !titulo.trim() || Boolean(avisoDoCodigo) || !versaoValida}>
            {ocupado ? "Criando…" : "Criar rascunho"}
          </Button>
        </div>
      </Panel>
    </form>
  );
}

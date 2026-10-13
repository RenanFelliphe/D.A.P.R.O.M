"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { CampoIntervalo } from "@/components/web/preventivas/CampoIntervalo";
import { enviarFormulario, ErroCliente } from "@/lib/cliente-api";
import { descreverIntervalo, type Intervalo } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus } from "@/lib/tipos";
import type { CampoObrigatorioDoPdf, LeituraDoPdf, OrdemDoPdf, OsLidaDoPdf, ResultadoDaImportacao } from "./tipos";

interface ConferenciaPdfProps {
  arquivo: File;
  /** `blob:` do PDF, para a prévia. */
  url: string;
  leitura: LeituraDoPdf;
  podeCadastrarEquipe: boolean;
  aoDescartar: () => void;
  /** A importação terminou (com o resultado) ou falhou depois de recebido o arquivo (a falha fica no histórico). */
  aoRegistrar: (resultado: ResultadoDaImportacao) => void;
  aoFalhar: () => void;
}

const NOME_DO_CAMPO: Record<CampoObrigatorioDoPdf, string> = {
  tipo_ordem: "tipo",
  titulo: "título",
  centro_trabalho: "centro de trabalho",
  local_instalacao: "local de instalação",
  data_inicio_prog: "início programado",
};

/** O que ainda impede a OS de entrar: obrigatório em branco ou fim programado antes do início. */
function pendencias(o: OrdemDoPdf): string[] {
  const vazio = (v: string | null) => !v?.trim();
  const faltam = (Object.keys(NOME_DO_CAMPO) as CampoObrigatorioDoPdf[]).filter((c) => (c === "local_instalacao" ? vazio(o.local_instalacao.codigo) : vazio(o[c])));
  const lista = faltam.length > 0 ? [`Preencha: ${faltam.map((c) => NOME_DO_CAMPO[c]).join(", ")}`] : [];
  if (o.data_inicio_prog && o.data_fim_prog && o.data_fim_prog < o.data_inicio_prog) lista.push("O fim programado é anterior ao início");
  return lista;
}

/**
 * O intervalo entre ciclos que a conferência começa mostrando: o que o PDF trouxe na Periodicidade ou, sem ele, o que o
 * plano já tem no sistema. Fora da preventiva com plano, o campo não existe e nada vai para o plano.
 */
function intervaloInicial(lida: OsLidaDoPdf): Intervalo | null {
  return lida.preventiva ? (lida.preventiva.intervalo_lido ?? lida.preventiva.intervalo_atual) : null;
}

/** Campo em branco vira `null` (como o que não veio no PDF). */
const limpo = (v: string) => (v.trim() === "" ? null : v);

/** `[1, 2, 3]` → `folhas 1 a 3`; `[4]` → `folha 4`. */
const folhas = (paginas: number[]) =>
  paginas.length === 1 ? `folha ${paginas[0]}` : paginas.every((p, i) => i === 0 || p === paginas[i - 1]! + 1) ? `folhas ${paginas[0]} a ${paginas.at(-1)}` : `folhas ${paginas.join(", ")}`;

interface CampoProps {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  /** O PDF não trouxe o campo: ele aparece destacado até ser preenchido. */
  faltou?: boolean;
  dica?: string;
  largo?: boolean;
  children: ReactNode;
}

function Campo({ id, rotulo, obrigatorio, faltou, dica, largo, children }: CampoProps) {
  return (
    <div className="field" data-faltou={faltou || undefined} style={largo ? { gridColumn: "1 / -1" } : undefined}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <Req> · obrigatório</Req>}
      </label>
      {children}
      {(faltou || dica) && <span className="small">{faltou ? "Não veio no PDF: confira no documento e preencha." : dica}</span>}
    </div>
  );
}

interface CartaoDaOsProps {
  lida: OsLidaDoPdf;
  ordem: OrdemDoPdf;
  marcada: boolean;
  podeCadastrarEquipe: boolean;
  aoMudar: (ordem: OrdemDoPdf) => void;
  aoMarcar: (marcada: boolean) => void;
}

/** Uma OS do PDF para conferir: os campos lidos, editáveis (o número da ordem não), e o que o sistema já sabe dela. */
function CartaoDaOs({ lida, ordem, marcada, podeCadastrarEquipe, aoMudar, aoMarcar }: CartaoDaOsProps) {
  const base = useId();
  const id = (campo: string) => `${base}-${campo}`;
  const texto = (campo: keyof OrdemDoPdf) => (ordem[campo] as string | null) ?? "";
  const mudar = (campo: keyof OrdemDoPdf) => (valor: string) => aoMudar({ ...ordem, [campo]: limpo(valor) });
  const mudarLocal = (campo: keyof OrdemDoPdf["local_instalacao"]) => (valor: string) => aoMudar({ ...ordem, local_instalacao: { ...ordem.local_instalacao, [campo]: limpo(valor) } });
  const faltou = (campo: CampoObrigatorioDoPdf) =>
    lida.faltando.includes(campo) && (campo === "local_instalacao" ? !ordem.local_instalacao.codigo?.trim() : !(ordem[campo] as string | null)?.trim());
  // A equipe e a atividade foram resolvidas para o que o PDF trouxe; se a pessoa mudou o campo, o registro resolve de novo.
  const centroMudou = (ordem.centro_trabalho ?? "") !== (lida.ordem.centro_trabalho ?? "");
  const atividadeMudou = (ordem.codigo_atividade ?? "") !== (lida.ordem.codigo_atividade ?? "");
  const problemas = marcada ? pendencias(ordem) : [];
  const statusSemLib = !/\bLIB\b/i.test(ordem.status_sap ?? "");
  // O intervalo entre ciclos só vale na preventiva com plano de manutenção.
  const comCiclo = ordem.tipo_ordem === "YBA2" && Boolean(ordem.plano_manutencao?.trim());
  const intervalo = ordem.intervalo_ciclo !== null && typeof ordem.intervalo_ciclo === "object" ? ordem.intervalo_ciclo : null;
  const periodicidadeImpressa = typeof lida.ordem.intervalo_ciclo === "string" ? lida.ordem.intervalo_ciclo : null;
  const dicaDoIntervalo = lida.preventiva?.intervalo_atual_descricao
    ? `O plano já tem: ${lida.preventiva.intervalo_atual_descricao}. Mudar aqui troca o intervalo do plano.`
    : lida.preventiva?.intervalo_lido
      ? `Lido da Periodicidade do PDF (${periodicidadeImpressa}).`
      : periodicidadeImpressa
        ? `A Periodicidade impressa ("${periodicidadeImpressa}") não foi entendida: preencha.`
        : "Opcional. Sem ele, o sistema não conta o tempo até o próximo ciclo nem avisa quando ele vence.";
  // A equipe só sai do centro de trabalho quando a OS é nova: a que já existe mantém a equipe que tem.
  const semEquipe = !lida.existente && !lida.equipe && !centroMudou;
  const atencao = semEquipe || statusSemLib;

  const entrada = (campo: keyof OrdemDoPdf, props: { tipo?: "text" | "date"; obrigatorio?: boolean } = {}) => (
    <input
      id={id(campo)}
      className="input"
      type={props.tipo ?? "text"}
      value={texto(campo)}
      required={props.obrigatorio && marcada}
      onChange={(e) => mudar(campo)(e.target.value)}
      disabled={!marcada}
    />
  );

  return (
    <Panel className="conferencia-os" style={marcada ? undefined : { opacity: 0.7 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h3 className="row g8 wrap" style={{ fontSize: 17 }}>
            <span className="mono">OS {ordem.numero_ordem}</span>
            {lida.existente ? <Badge tone="neu">Já existe · {rotuloDoStatus[lida.existente.status] ?? lida.existente.status}</Badge> : <Badge tone="lib">Nova</Badge>}
            {!lida.existente &&
              !centroMudou &&
              (lida.equipe ? (
                <Badge tone="enc">
                  <Icon name="users" size={13} />
                  {lida.equipe.nome}
                </Badge>
              ) : (
                <Badge tone="al">Centro sem equipe</Badge>
              ))}
          </h3>
          <span className="small">{folhas(lida.paginas)} do PDF</span>
        </div>
        <label className="row g8" style={{ fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={marcada} onChange={(e) => aoMarcar(e.target.checked)} />
          Registrar esta OS
        </label>
      </div>

      {marcada && (lida.existente || atencao || lida.observacoes.length > 0) && (
        <Notice tone={atencao ? "al" : "info"} icon={atencao ? "alert" : "info"}>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
            {lida.existente && (
              <li>
                A OS já está no sistema: só o planejamento é atualizado (datas, título, local, prioridade); tipo, equipe, status, APR e execução ficam
                como estão.{" "}
                <Link href={rotas.app.os(lida.existente.id)}>Abrir a OS</Link>
              </li>
            )}
            {semEquipe && (
              <li>
                Nenhuma equipe atende o centro de trabalho {ordem.centro_trabalho ? <span className="mono">{ordem.centro_trabalho}</span> : "lido"}: a OS fica de fora.
                {podeCadastrarEquipe && (
                  <>
                    {" "}
                    <Link href={rotas.app.usuarios}>Cadastrar a equipe</Link> ou corrija o centro.
                  </>
                )}
              </li>
            )}
            {statusSemLib && <li>O status do sistema não tem LIB: a OS fica de fora, e o PDF nunca cancela uma OS que já existe.</li>}
            {lida.observacoes
              .filter((o) => !o.startsWith("O status do sistema não tem LIB"))
              .map((o) => (
                <li key={o}>{o}</li>
              ))}
          </ul>
        </Notice>
      )}

      <div className="conferencia-campos">
        <Campo id={id("numero")} rotulo="Número da ordem" dica="Vem do PDF e não muda.">
          <input id={id("numero")} className="input mono" value={ordem.numero_ordem} readOnly />
        </Campo>
        <Campo id={id("tipo_ordem")} rotulo="Tipo" obrigatorio faltou={faltou("tipo_ordem")} dica={ordem.tipo_atividade ? `Tipo de atividade: ${ordem.tipo_atividade}` : undefined}>
          <select id={id("tipo_ordem")} className="select" value={ordem.tipo_ordem ?? ""} onChange={(e) => aoMudar({ ...ordem, tipo_ordem: (e.target.value || null) as OrdemDoPdf["tipo_ordem"] })} disabled={!marcada}>
            <option value="">Escolha</option>
            <option value="YBA1">Corretiva (YBA1)</option>
            <option value="YBA2">Preventiva (YBA2)</option>
          </select>
        </Campo>
        <Campo id={id("titulo")} rotulo="Título (texto breve)" obrigatorio faltou={faltou("titulo")} largo>
          {entrada("titulo", { obrigatorio: true })}
        </Campo>
        <Campo
          id={id("centro_trabalho")}
          rotulo="Centro de trabalho"
          obrigatorio
          faltou={faltou("centro_trabalho")}
          dica={lida.existente ? "A OS já existe: a equipe dela não muda." : centroMudou ? "A equipe é conferida ao registrar." : "Define a equipe da OS."}
        >
          {entrada("centro_trabalho", { obrigatorio: true })}
        </Campo>
        <Campo id={id("prioridade")} rotulo="Prioridade">
          {entrada("prioridade")}
        </Campo>
        <Campo id={id("local")} rotulo="Local de instalação" obrigatorio faltou={faltou("local_instalacao")} largo>
          <input
            id={id("local")}
            className="input"
            value={ordem.local_instalacao.codigo ?? ""}
            required={marcada}
            onChange={(e) => mudarLocal("codigo")(e.target.value)}
            disabled={!marcada}
          />
        </Campo>
        <Campo id={id("data_inicio_prog")} rotulo="Início programado" obrigatorio faltou={faltou("data_inicio_prog")}>
          {entrada("data_inicio_prog", { tipo: "date", obrigatorio: true })}
        </Campo>
        <Campo id={id("data_fim_prog")} rotulo="Fim programado">
          {entrada("data_fim_prog", { tipo: "date" })}
        </Campo>
        <Campo id={id("equipamento")} rotulo="Equipamento">
          {entrada("equipamento")}
        </Campo>
        {comCiclo && (
          <Campo id={id("intervalo_ciclo")} rotulo="Intervalo entre ciclos (preventiva)" dica={intervalo ? `Preventiva ${descreverIntervalo(intervalo)}. ${dicaDoIntervalo}` : dicaDoIntervalo}>
            <CampoIntervalo id={id("intervalo_ciclo")} valor={intervalo} aoMudar={(v) => aoMudar({ ...ordem, intervalo_ciclo: v })} desabilitado={!marcada} />
          </Campo>
        )}
        <Campo id={id("status_sap")} rotulo="Status do sistema (SAP)" dica="Precisa ter LIB para a OS entrar.">
          {entrada("status_sap")}
        </Campo>
        <Campo id={id("descricao")} rotulo="Descrição (texto longo)" largo>
          <textarea id={id("descricao")} className="textarea" rows={4} value={ordem.descricao ?? ""} onChange={(e) => mudar("descricao")(e.target.value)} disabled={!marcada} />
        </Campo>
      </div>

      <details className="conferencia-mais">
        <summary>Mais campos do PDF: nota, atividade, plano, endereço…</summary>
        <div className="conferencia-campos">
          <Campo id={id("numero_nota")} rotulo="Nota">
            {entrada("numero_nota")}
          </Campo>
          <Campo id={id("tipo_atividade")} rotulo="Tipo de atividade">
            {entrada("tipo_atividade")}
          </Campo>
          <Campo
            id={id("codigo_atividade")}
            rotulo="Código da atividade"
            dica={
              atividadeMudou
                ? "Código novo: se não estiver em Atividades, é cadastrado sem modelo para o admin ligar."
                : lida.atividade
                  ? `Encontrada em Atividades pelo título${lida.atividade.com_modelo ? ", com modelo de APR" : ", ainda sem modelo de APR"}.`
                  : "O PDF não traz o código; deixe em branco se não souber."
            }
          >
            {entrada("codigo_atividade")}
          </Campo>
          <Campo id={id("plano_manutencao")} rotulo="Plano de manutenção">
            {entrada("plano_manutencao")}
          </Campo>
          <Campo id={id("item_manutencao")} rotulo="Item de manutenção">
            {entrada("item_manutencao")}
          </Campo>
          <Campo id={id("criado_por")} rotulo="Criado por (SAP)">
            {entrada("criado_por")}
          </Campo>
          <Campo id={id("criada_em")} rotulo="Data da ordem">
            {entrada("criada_em", { tipo: "date" })}
          </Campo>
          <Campo id={id("solicitante")} rotulo="Solicitante">
            {entrada("solicitante")}
          </Campo>
          <Campo id={id("endereco")} rotulo="Endereço do local" largo>
            <input id={id("endereco")} className="input" value={ordem.local_instalacao.endereco ?? ""} onChange={(e) => mudarLocal("endereco")(e.target.value)} disabled={!marcada} />
          </Campo>
          <Campo id={id("plus_code")} rotulo="Plus code do local">
            <input id={id("plus_code")} className="input" value={ordem.local_instalacao.plus_code ?? ""} onChange={(e) => mudarLocal("plus_code")(e.target.value)} disabled={!marcada} />
          </Campo>
          <Campo id={id("cliente")} rotulo="Cliente do local">
            <input id={id("cliente")} className="input" value={ordem.local_instalacao.cliente ?? ""} onChange={(e) => mudarLocal("cliente")(e.target.value)} disabled={!marcada} />
          </Campo>
        </div>
      </details>

      {problemas.length > 0 && (
        <span className="entrada-retorno erro" role="alert">
          {problemas.join(". ")}.
        </span>
      )}
    </Panel>
  );
}

/**
 * Conferência do PDF da OS: o PDF ao lado das OS lidas dele, campo a campo. A pessoa corrige o que a leitura errou, preenche
 * o que faltou e escolhe quais OS registrar; o registro reenvia o PDF, que a `api` lê de novo para conferir os números.
 */
export function ConferenciaPdf({ arquivo, url, leitura, podeCadastrarEquipe, aoDescartar, aoRegistrar, aoFalhar }: ConferenciaPdfProps) {
  const [ordens, setOrdens] = useState<OrdemDoPdf[]>(() => leitura.ordens.map((o) => ({ ...o.ordem, intervalo_ciclo: intervaloInicial(o) })));
  const [marcadas, setMarcadas] = useState(() => leitura.ordens.map(() => true));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolhidas = ordens.filter((_, i) => marcadas[i]);
  const bloqueadas = escolhidas.filter((o) => pendencias(o).length > 0).length;

  async function registrar() {
    setErro(null);
    setEnviando(true);
    try {
      const form = new FormData();
      form.set("arquivo", arquivo);
      form.set("ordens", JSON.stringify(escolhidas));
      aoRegistrar(await enviarFormulario<ResultadoDaImportacao>("/importacoes/pdf", form));
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tente de novo.");
      // Recebido o PDF, a falha fica no histórico (e vira alerta): a tela de trás é atualizada.
      if (e instanceof ErroCliente && e.status !== 401) aoFalhar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="stack g16">
      <Panel>
        <div className="row g12 wrap" style={{ alignItems: "center" }}>
          <span className="arq-tag pdf" aria-hidden="true">
            PDF
          </span>
          <span className="stack" style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>
              {arquivo.name}
            </span>
            <span className="small">
              {leitura.paginas === 1 ? "1 folha" : `${leitura.paginas} folhas`} · {leitura.ordens.length === 1 ? "1 OS lida" : `${leitura.ordens.length} OS lidas`}
              {leitura.paginas_sem_ordem.length > 0 && ` · ${folhas(leitura.paginas_sem_ordem)} sem número de ordem (ignorada)`}
            </span>
          </span>
          <Button variant="line" sm onClick={aoDescartar} disabled={enviando}>
            Descartar
          </Button>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          Confira cada OS com o PDF: corrija o que a leitura errou e preencha o que faltou. Nada foi gravado ainda; a OS só entra quando você registrar.
        </p>
        <details className="conferencia-previa">
          <summary>Ver o PDF ao lado</summary>
          <object data={url} type="application/pdf" aria-label={`Prévia de ${arquivo.name}`}>
            <div className="previa-vazia">
              <Icon name="file" size={24} />
              <span className="small">Este navegador não mostra a prévia do PDF.</span>
            </div>
          </object>
        </details>
      </Panel>

      {leitura.ordens.map((lida, i) => (
        <CartaoDaOs
          key={lida.ordem.numero_ordem}
          lida={lida}
          ordem={ordens[i]!}
          marcada={marcadas[i]!}
          podeCadastrarEquipe={podeCadastrarEquipe}
          aoMudar={(nova) => setOrdens((atuais) => atuais.map((o, j) => (j === i ? nova : o)))}
          aoMarcar={(marcada) => setMarcadas((atuais) => atuais.map((m, j) => (j === i ? marcada : m)))}
        />
      ))}

      <Panel>
        <div className="row between wrap" style={{ alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 14 }}>
            {escolhidas.length === 0
              ? "Nenhuma OS escolhida."
              : bloqueadas > 0
                ? `${bloqueadas === 1 ? "1 OS precisa" : `${bloqueadas} OS precisam`} de conferência antes de registrar.`
                : `${escolhidas.length === 1 ? "1 OS será registrada" : `${escolhidas.length} OS serão registradas`} como liberadas (as que já existem só têm o planejamento atualizado).`}
          </span>
          <div className="row g8">
            <Button variant="line" sm onClick={aoDescartar} disabled={enviando}>
              Descartar
            </Button>
            <Button variant="p" sm onClick={registrar} disabled={enviando || escolhidas.length === 0 || bloqueadas > 0}>
              <Icon name={enviando ? "refresh" : "check"} size={16} className={enviando ? "spin" : undefined} />
              {enviando ? "Registrando…" : escolhidas.length > 1 ? `Registrar ${escolhidas.length} OS` : "Registrar a OS"}
            </Button>
          </div>
        </div>
        {erro && (
          <span className="entrada-retorno erro" role="alert">
            {erro}
          </span>
        )}
      </Panel>
    </div>
  );
}

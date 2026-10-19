"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Req } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus } from "@/lib/tipos";
import type { CampoObrigatorioDoPdf, OrdemDoPdf } from "./tipos";
import type { CampoDaConferencia, EstadoDoCampo, LeituraDigitalizada, OsConferidaParaRegistro, OsDigitalizadaLida, ResultadoDaDigitalizacao } from "./tipos-digitalizacao";

const NOME_DO_CAMPO: Record<CampoObrigatorioDoPdf, string> = {
  tipo_ordem: "tipo",
  titulo: "título",
  centro_trabalho: "centro de trabalho",
  local_instalacao: "local de instalação",
  data_inicio_prog: "início programado",
};

const ESTADO: Record<EstadoDoCampo, { rotulo: string; tom: BadgeTone; icone: IconName }> = {
  confere: { rotulo: "Confere", tom: "enc", icone: "check" },
  duvidoso: { rotulo: "Confira", tom: "al", icone: "eye" },
  invalido: { rotulo: "Inválido", tom: "blq", icone: "octagon" },
  faltando: { rotulo: "Faltando", tom: "neu", icone: "pencil" },
};

/** O que o admin edita de uma OS: a OS lida, o que a folha diz da execução (como o formulário o guarda) e as duas confirmações. */
interface Edicao {
  ordem: OrdemDoPdf;
  inicio: string;
  fim: string;
  pessoas: string;
  texto: string;
  marcada: boolean;
  /** Conferiu o número da ordem e o que está escrito à mão com a folha. */
  conferida: boolean;
}

const limpo = (v: string) => (v.trim() === "" ? null : v);

/** A OS que o sistema já tem e a folha não pode encerrar: só a liberada e sem execução é encerrada pela folha. */
const foraDoRegistro = (o: OsDigitalizadaLida) => Boolean(o.situacao.existente && (o.situacao.existente.status !== "liberada" || o.situacao.tem_execucao));

function inicial(o: OsDigitalizadaLida): Edicao {
  return {
    ordem: o.ordem,
    inicio: o.manuscrito.inicio ?? "",
    fim: o.manuscrito.fim ?? "",
    pessoas: o.manuscrito.pessoas ? String(o.manuscrito.pessoas) : "",
    texto: o.manuscrito.texto ?? "",
    marcada: !foraDoRegistro(o),
    conferida: false,
  };
}

/** O que ainda impede a OS de ser registrada. */
function pendencias(e: Edicao): string[] {
  const o = e.ordem;
  const vazio = (v: string | null) => !v?.trim();
  const faltam = (Object.keys(NOME_DO_CAMPO) as CampoObrigatorioDoPdf[]).filter((c) => (c === "local_instalacao" ? vazio(o.local_instalacao.codigo) : vazio(o[c])));
  const lista = faltam.length > 0 ? [`Preencha: ${faltam.map((c) => NOME_DO_CAMPO[c]).join(", ")}`] : [];
  if (!/^\d{6,12}$/.test(o.numero_ordem.trim())) lista.push("O número da ordem precisa ter de 6 a 12 dígitos");
  if (o.data_inicio_prog && o.data_fim_prog && o.data_fim_prog < o.data_inicio_prog) lista.push("O fim programado é anterior ao início");
  if (e.inicio && e.fim && e.fim < e.inicio) lista.push("O fim real é anterior ao início real");
  if (e.pessoas && (!Number.isInteger(Number(e.pessoas)) || Number(e.pessoas) < 1)) lista.push("O número de pessoas precisa ser um inteiro a partir de 1");
  if (!e.conferida) lista.push("Confirme que conferiu o número da ordem e o escrito à mão com a folha");
  return lista;
}

/** `[1, 2, 3]` → `folhas 1 a 3`; `[4]` → `folha 4`. */
const folhas = (paginas: number[]) =>
  paginas.length === 1 ? `folha ${paginas[0]}` : paginas.every((p, i) => i === 0 || p === paginas[i - 1]! + 1) ? `folhas ${paginas[0]} a ${paginas.at(-1)}` : `folhas ${paginas.join(", ")}`;

interface CampoProps {
  id: string;
  rotulo: string;
  estado?: EstadoDoCampo;
  obrigatorio?: boolean;
  dica?: string;
  largo?: boolean;
  children: ReactNode;
}

/** Um campo da conferência: o rótulo, o estado que o sistema deu à leitura e a dica. */
function Campo({ id, rotulo, estado, obrigatorio, dica, largo, children }: CampoProps) {
  const e = estado ? ESTADO[estado] : null;
  return (
    <div className="field" data-faltou={estado === "faltando" || estado === "invalido" || undefined} style={largo ? { gridColumn: "1 / -1" } : undefined}>
      <label htmlFor={id} className="row between g8" style={{ alignItems: "baseline" }}>
        <span>
          {rotulo}
          {obrigatorio && <Req> · obrigatório</Req>}
        </span>
        {e && (
          <Badge tone={e.tom}>
            <Icon name={e.icone} size={13} />
            {e.rotulo}
          </Badge>
        )}
      </label>
      {children}
      {dica && <span className="small">{dica}</span>}
    </div>
  );
}

interface CartaoDaOsProps {
  digitalizacaoId: string;
  lida: OsDigitalizadaLida;
  edicao: Edicao;
  podeCadastrarEquipe: boolean;
  aoMudar: (edicao: Edicao) => void;
}

/** Uma OS da digitalização para conferir: as folhas dela ao lado, o impresso, o escrito à mão e as duas confirmações. */
function CartaoDaOs({ digitalizacaoId, lida, edicao, podeCadastrarEquipe, aoMudar }: CartaoDaOsProps) {
  const base = useId();
  const id = (campo: string) => `${base}-${campo}`;
  const { ordem, marcada } = edicao;
  const texto = (campo: keyof OrdemDoPdf) => (ordem[campo] as string | null) ?? "";
  const mudar = (campo: keyof OrdemDoPdf) => (valor: string) => aoMudar({ ...edicao, ordem: { ...ordem, [campo]: limpo(valor) } });
  const mudarLocal = (campo: keyof OrdemDoPdf["local_instalacao"]) => (valor: string) =>
    aoMudar({ ...edicao, ordem: { ...ordem, local_instalacao: { ...ordem.local_instalacao, [campo]: limpo(valor) } } });
  const estado = (campo: CampoDaConferencia) => lida.estados[campo];
  const { existente, equipe } = lida.situacao;
  const fora = foraDoRegistro(lida);
  const centroMudou = (ordem.centro_trabalho ?? "") !== (lida.ordem.centro_trabalho ?? "");
  const semEquipe = !existente && !equipe && !centroMudou;
  const problemas = marcada ? pendencias(edicao) : [];
  const avisos = [...lida.observacoes, ...lida.avisos];
  const folhasDaOs = lida.paginas;

  const entrada = (campo: keyof OrdemDoPdf, tipo: "text" | "date" = "text") => (
    <input id={id(campo)} className="input" type={tipo} value={texto(campo)} onChange={(e) => mudar(campo)(e.target.value)} disabled={!marcada} />
  );

  return (
    <Panel className="conferencia-os" style={marcada ? undefined : { opacity: 0.7 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h3 className="row g8 wrap" style={{ fontSize: 17 }}>
            <span className="mono">OS {lida.chave}</span>
            {existente ? <Badge tone="neu">Já existe · {rotuloDoStatus[existente.status] ?? existente.status}</Badge> : <Badge tone="lib">Nova</Badge>}
            {!existente &&
              !centroMudou &&
              (equipe ? (
                <Badge tone="enc">
                  <Icon name="users" size={13} />
                  {equipe.nome}
                </Badge>
              ) : (
                <Badge tone="al">Centro sem equipe</Badge>
              ))}
          </h3>
          <span className="small">{folhas(folhasDaOs)} do PDF</span>
        </div>
        <label className="row g8" style={{ fontSize: 14, fontWeight: 600, cursor: fora ? "not-allowed" : "pointer" }}>
          <input type="checkbox" checked={marcada} disabled={fora} onChange={(e) => aoMudar({ ...edicao, marcada: e.target.checked })} />
          Registrar esta OS
        </label>
      </div>

      {(fora || semEquipe || avisos.length > 0) && (
        <Notice tone={fora || semEquipe ? "al" : "info"} icon={fora || semEquipe ? "alert" : "info"}>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
            {fora && existente && (
              <li>
                {existente.status !== "liberada"
                  ? `A OS já está no sistema como ${rotuloDoStatus[existente.status] ?? existente.status}: a folha em papel não é registrada.`
                  : "A OS já tem execução no sistema: a folha em papel não é registrada."}{" "}
                <Link href={rotas.app.os(existente.id)}>Abrir a OS</Link>
              </li>
            )}
            {!fora && existente && <li>A OS já está no sistema, liberada e sem execução: ao registrar, ela é encerrada pela folha (o planejamento não muda).</li>}
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
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Notice>
      )}

      <details className="conferencia-previa" open>
        <summary>
          Ver {folhasDaOs.length === 1 ? "a folha" : `as ${folhasDaOs.length} folhas`} ao lado
        </summary>
        <div className="folhas-lado">
          {folhasDaOs.map((n) => (
            <a key={n} href={`/api/digitalizacoes/${digitalizacaoId}/folhas/${n}`} target="_blank" rel="noreferrer" title={`Abrir a folha ${n} em tamanho real`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/digitalizacoes/${digitalizacaoId}/folhas/${n}`} alt={`Folha ${n} do PDF digitalizado`} loading="lazy" />
              <span className="small">Folha {n}</span>
            </a>
          ))}
        </div>
      </details>

      <div className="conferencia-campos">
        <Campo id={id("numero")} rotulo="Número da ordem" estado={estado("numero_ordem")} obrigatorio dica="Um dígito errado cria uma OS que não existe no SAP: confira na folha.">
          <input
            id={id("numero")}
            className="input mono"
            value={ordem.numero_ordem}
            inputMode="numeric"
            onChange={(e) => aoMudar({ ...edicao, ordem: { ...ordem, numero_ordem: e.target.value.replace(/\D/g, "") } })}
            disabled={!marcada}
          />
        </Campo>
        <Campo id={id("tipo_ordem")} rotulo="Tipo" estado={estado("tipo_ordem")} obrigatorio dica={ordem.tipo_atividade ? `Tipo de atividade: ${ordem.tipo_atividade}` : undefined}>
          <select
            id={id("tipo_ordem")}
            className="select"
            value={ordem.tipo_ordem ?? ""}
            onChange={(e) => aoMudar({ ...edicao, ordem: { ...ordem, tipo_ordem: (e.target.value || null) as OrdemDoPdf["tipo_ordem"] } })}
            disabled={!marcada}
          >
            <option value="">Escolha</option>
            <option value="YBA1">Corretiva (YBA1)</option>
            <option value="YBA2">Preventiva (YBA2)</option>
          </select>
        </Campo>
        <Campo id={id("titulo")} rotulo="Título (texto breve)" estado={estado("titulo")} obrigatorio largo>
          {entrada("titulo")}
        </Campo>
        <Campo
          id={id("centro_trabalho")}
          rotulo="Centro de trabalho"
          estado={estado("centro_trabalho")}
          obrigatorio
          dica={existente ? "A OS já existe: a equipe dela não muda." : centroMudou ? "A equipe é conferida ao registrar." : "Define a equipe da OS."}
        >
          {entrada("centro_trabalho")}
        </Campo>
        <Campo id={id("equipamento")} rotulo="Equipamento" estado={estado("equipamento")}>
          {entrada("equipamento")}
        </Campo>
        <Campo id={id("local")} rotulo="Local de instalação" estado={estado("local_instalacao")} obrigatorio largo>
          <input id={id("local")} className="input" value={ordem.local_instalacao.codigo ?? ""} onChange={(e) => mudarLocal("codigo")(e.target.value)} disabled={!marcada} />
        </Campo>
        <Campo id={id("data_inicio_prog")} rotulo="Início programado" estado={estado("data_inicio_prog")} obrigatorio>
          {entrada("data_inicio_prog", "date")}
        </Campo>
        <Campo id={id("data_fim_prog")} rotulo="Fim programado">
          {entrada("data_fim_prog", "date")}
        </Campo>
      </div>

      <details className="conferencia-mais">
        <summary>Mais campos impressos: nota, plano, prioridade, descrição…</summary>
        <div className="conferencia-campos">
          <Campo id={id("numero_nota")} rotulo="Nota">
            {entrada("numero_nota")}
          </Campo>
          <Campo id={id("prioridade")} rotulo="Prioridade">
            {entrada("prioridade")}
          </Campo>
          <Campo id={id("plano_manutencao")} rotulo="Plano de manutenção">
            {entrada("plano_manutencao")}
          </Campo>
          <Campo id={id("item_manutencao")} rotulo="Item de manutenção">
            {entrada("item_manutencao")}
          </Campo>
          <Campo id={id("criada_em")} rotulo="Data da ordem">
            {entrada("criada_em", "date")}
          </Campo>
          <Campo id={id("tipo_atividade")} rotulo="Tipo de atividade">
            {entrada("tipo_atividade")}
          </Campo>
          <Campo id={id("descricao")} rotulo="Descrição (texto longo)" largo>
            <textarea id={id("descricao")} className="textarea" rows={3} value={ordem.descricao ?? ""} onChange={(e) => mudar("descricao")(e.target.value)} disabled={!marcada} />
          </Campo>
        </div>
      </details>

      <div className="manuscrito">
        <div className="stack" style={{ gap: 2 }}>
          <h4 className="row g8" style={{ fontSize: 15 }}>
            <Icon name="pencil" size={16} />
            Escrito à mão na folha
          </h4>
          <span className="small">
            {lida.manuscrito.lido_por === "ia"
              ? "Lido pela IA. Ela erra dígitos sem sinal de dúvida: confira cada data e hora com a folha ao lado."
              : "Digite o que está escrito na folha (a IA não leu esta OS)."}
          </span>
        </div>
        <div className="conferencia-campos">
          <Campo id={id("inicio")} rotulo="Início real da execução" estado={estado("inicio_real")}>
            <input id={id("inicio")} className="input" type="datetime-local" value={edicao.inicio} onChange={(e) => aoMudar({ ...edicao, inicio: e.target.value })} disabled={!marcada} />
          </Campo>
          <Campo id={id("fim")} rotulo="Fim real da execução" estado={estado("fim_real")}>
            <input id={id("fim")} className="input" type="datetime-local" value={edicao.fim} onChange={(e) => aoMudar({ ...edicao, fim: e.target.value })} disabled={!marcada} />
          </Campo>
          <Campo id={id("pessoas")} rotulo="Pessoas na execução" estado={estado("numero_pessoas")}>
            <input
              id={id("pessoas")}
              className="input"
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              value={edicao.pessoas}
              onChange={(e) => aoMudar({ ...edicao, pessoas: e.target.value })}
              disabled={!marcada}
            />
          </Campo>
          <Campo id={id("texto")} rotulo="Descrição da atividade e observações" estado={estado("texto")} largo dica="Assinaturas e rubricas ficam só na imagem das folhas.">
            <textarea id={id("texto")} className="textarea" rows={3} value={edicao.texto} onChange={(e) => aoMudar({ ...edicao, texto: e.target.value })} disabled={!marcada} />
          </Campo>
        </div>
        <label className="row g8" style={{ fontSize: 14, fontWeight: 600, cursor: marcada ? "pointer" : "default" }}>
          <input type="checkbox" checked={edicao.conferida} disabled={!marcada} onChange={(e) => aoMudar({ ...edicao, conferida: e.target.checked })} />
          Conferi o número da ordem e o escrito à mão com a folha
        </label>
      </div>

      {problemas.length > 0 && (
        <span className="entrada-retorno erro" role="alert">
          {problemas.join(". ")}.
        </span>
      )}
    </Panel>
  );
}

interface ConferenciaDigitalizacaoProps {
  id: string;
  nome: string;
  leitura: LeituraDigitalizada;
  podeCadastrarEquipe: boolean;
  /** Descarta a digitalização inteira (apaga o PDF e as folhas do servidor). */
  aoDescartar: () => void;
  /** Sai da conferência sem descartar: a digitalização fica em aberto, com a leitura guardada. */
  aoSair: () => void;
  aoRegistrar: (resultado: ResultadoDaDigitalizacao) => void;
}

/**
 * Conferência da Digitalização: as folhas ao lado das OS lidas, campo a campo, cada um com o estado que o sistema deu à leitura
 * (confere, confira, inválido, faltando). A pessoa corrige o que a leitura errou, preenche o que faltou e confirma, OS a OS, que
 * conferiu o número da ordem e o escrito à mão. O registro usa a leitura guardada: as OS entram encerradas, de histórico.
 */
export function ConferenciaDigitalizacao({ id, nome, leitura, podeCadastrarEquipe, aoDescartar, aoSair, aoRegistrar }: ConferenciaDigitalizacaoProps) {
  const [edicoes, setEdicoes] = useState<Edicao[]>(() => leitura.ordens.map(inicial));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolhidas = edicoes.map((e, i) => ({ e, lida: leitura.ordens[i]! })).filter(({ e }) => e.marcada);
  const bloqueadas = escolhidas.filter(({ e }) => pendencias(e).length > 0).length;

  async function registrar() {
    setErro(null);
    setEnviando(true);
    try {
      const ordens: OsConferidaParaRegistro[] = escolhidas.map(({ e, lida }) => ({
        chave: lida.chave,
        ordem: { ...e.ordem, numero_ordem: e.ordem.numero_ordem.trim() },
        execucao: { inicio: limpo(e.inicio), fim: limpo(e.fim), numero_pessoas: e.pessoas ? Number(e.pessoas) : null, texto: limpo(e.texto) },
      }));
      aoRegistrar(await chamar<ResultadoDaDigitalizacao>("POST", `/digitalizacoes/${id}/registro`, { ordens }));
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tente de novo.");
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
              {nome}
            </span>
            <span className="small">
              {leitura.paginas === 1 ? "1 folha" : `${leitura.paginas} folhas`} · {leitura.ordens.length === 1 ? "1 OS lida" : `${leitura.ordens.length} OS lidas`}
              {leitura.paginas_sem_ordem.length > 0 && ` · ${folhas(leitura.paginas_sem_ordem)} sem número de ordem (ignorada)`}
            </span>
          </span>
          <Badge tone={leitura.confianca_media >= 80 ? "enc" : "al"}>
            <Icon name={leitura.confianca_media >= 80 ? "check" : "alert"} size={13} />
            Nitidez do texto {leitura.confianca_media}%
          </Badge>
          <Button variant="line" sm onClick={aoSair} disabled={enviando}>
            Conferir depois
          </Button>
          <Button variant="line" sm onClick={aoDescartar} disabled={enviando}>
            Descartar
          </Button>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          Confira cada OS com as folhas ao lado: corrija o que a leitura errou e preencha o que faltou. Nada foi gravado ainda; as OS só entram, como
          encerradas e de histórico, quando você registrar.
        </p>
        {!leitura.ia.usada && (
          <Notice tone="info" icon="info">
            <strong>A IA não leu o escrito à mão.</strong> {leitura.ia.motivo} Digite as datas, as horas, as pessoas e a descrição olhando a folha.
          </Notice>
        )}
      </Panel>

      {leitura.ordens.map((lida, i) => (
        <CartaoDaOs
          key={lida.chave}
          digitalizacaoId={id}
          lida={lida}
          edicao={edicoes[i]!}
          podeCadastrarEquipe={podeCadastrarEquipe}
          aoMudar={(nova) => setEdicoes((atuais) => atuais.map((e, j) => (j === i ? nova : e)))}
        />
      ))}

      <Panel>
        <div className="row between wrap" style={{ alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 14 }}>
            {escolhidas.length === 0
              ? "Nenhuma OS escolhida."
              : bloqueadas > 0
                ? `${bloqueadas === 1 ? "1 OS precisa" : `${bloqueadas} OS precisam`} de conferência antes de registrar.`
                : `${escolhidas.length === 1 ? "1 OS será registrada" : `${escolhidas.length} OS serão registradas`} como encerradas, de histórico.`}
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

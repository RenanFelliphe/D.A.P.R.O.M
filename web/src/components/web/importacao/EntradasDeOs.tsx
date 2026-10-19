"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { chamar, enviarFormulario, ErroCliente } from "@/lib/cliente-api";
import { cx } from "@/lib/cx";
import { dataHora } from "@/lib/formatar";
import { AcompanharDigitalizacao } from "./AcompanharDigitalizacao";
import { ConferenciaPdf } from "./ConferenciaPdf";
import { DigitalizacoesEmAberto } from "./DigitalizacoesEmAberto";
import { JanelaCamera } from "./JanelaCamera";
import { PerguntaDaImportacao, type CaminhoDaImportacao } from "./PerguntaDaImportacao";
import { ResultadoArquivo } from "./ResultadoArquivo";
import { ResultadoDigitalizacao } from "./ResultadoDigitalizacao";
import type { LeituraDoPdf, ResultadoDaImportacao } from "./tipos";
import { LIMITE_DO_PDF_DIGITALIZADO_MB, type Digitalizacao, type ResultadoDaDigitalizacao } from "./tipos-digitalizacao";

const LIMITE_MB = 10;
/** Esperas (ms) até atualizar a tela depois de sincronizar: a leitura roda em segundo plano. */
const ATUALIZAR_DEPOIS_DE = [3000, 8000];
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface EntradasDeOsProps {
  /** Início da última leitura pela API que terminou sem erro. */
  ultimaLeituraEm: string | null;
  /** A leitura agendada está ligada (API do SAP configurada) e o intervalo dela. */
  automatica: boolean;
  intervaloMin: number;
  /** Só o administrador vê a Digitalização e o atalho para cadastrar equipe. */
  ehAdmin: boolean;
}

/**
 * O que aparece abaixo dos cartões: o resultado de um arquivo importado, o PDF lido à espera da conferência, a digitalização
 * (PDF de OS já executadas no papel) em leitura ou em conferência, ou o resultado do registro dela.
 */
type Resultado =
  | { tipo: "importado"; formato: "planilha" | "pdf"; nome: string; dados: ResultadoDaImportacao }
  | { tipo: "conferencia"; arquivo: File; url: string; leitura: LeituraDoPdf }
  | { tipo: "digitalizando"; id: string }
  | { tipo: "digitalizado"; nome: string; dados: ResultadoDaDigitalizacao };

interface CartaoProps {
  tom: "api" | "arq" | "cam";
  icone: IconName;
  titulo: string;
  canal: string;
  selos?: ReactNode;
  descricao: ReactNode;
  detalhes: ReactNode;
  /** Rótulo do botão que cobre o cartão inteiro. */
  acao: ReactNode;
  aoClicar: () => void;
  ocupado?: boolean;
  arrastando?: boolean;
  /** Linha de retorno abaixo do botão (status, aviso ou erro). */
  retorno?: ReactNode;
  aoArrastar?: { sobre: (e: DragEvent) => void; sair: (e: DragEvent) => void; soltar: (e: DragEvent) => void };
}

/** Um cartão de entrada: o cartão todo é o botão (o `::after` do botão cobre o cartão). */
function Cartao({ tom, icone, titulo, canal, selos, descricao, detalhes, acao, aoClicar, ocupado, arrastando, retorno, aoArrastar }: CartaoProps) {
  const id = `entrada-${tom}`;
  return (
    <article
      className={cx("entrada", `t-${tom}`, arrastando && "arrastando")}
      aria-labelledby={`${id}-t`}
      onDragOver={aoArrastar?.sobre}
      onDragLeave={aoArrastar?.sair}
      onDrop={aoArrastar?.soltar}
    >
      <div className="entrada-cab">
        <span className="entrada-ic" aria-hidden="true">
          <Icon name={icone} size={22} />
        </span>
        <div className="row g6 wrap" style={{ justifyContent: "flex-end" }}>
          {selos}
        </div>
      </div>
      <div className="stack" style={{ gap: 2 }}>
        <h3 id={`${id}-t`}>
          {titulo} <span className="entrada-canal">{canal}</span>
        </h3>
        <p className="entrada-desc" id={`${id}-d`}>
          {descricao}
        </p>
      </div>
      <div className="entrada-det">{detalhes}</div>
      <button type="button" className="entrada-acao" onClick={aoClicar} disabled={ocupado} aria-describedby={`${id}-d`}>
        <span>{acao}</span>
        <Icon name={ocupado ? "refresh" : "right"} size={16} className={ocupado ? "spin" : undefined} />
      </button>
      {retorno}
    </article>
  );
}

/**
 * As formas de uma OS entrar no sistema, um cartão para cada: Sincronização (força a leitura da API, como o antigo "Ler
 * agora"), Importação (planilha .xlsx exportada do SAP, ou o PDF da OS impresso pelo SAP, que é lido e conferido campo a
 * campo antes de registrar; antes de escolher o arquivo, a tela pergunta se a OS é para liberar no sistema ou se já foi
 * concluída no papel, e nesse caso o PDF escaneado segue pela Digitalização: leitura em segundo plano e conferência com as
 * folhas ao lado) e Digitalização (câmera: 1 ou 2 folhas avulsas fotografadas, que seguem o mesmo caminho do PDF escaneado), que
 * só o administrador vê. O resultado da importação, a conferência do PDF ou a da digitalização aparece logo abaixo.
 */
export function EntradasDeOs({ ultimaLeituraEm, automatica, intervaloMin, ehAdmin }: EntradasDeOsProps) {
  const roteador = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const campoPapel = useRef<HTMLInputElement>(null);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);
  const urlDoPdf = useRef<string | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [avisoSinc, setAvisoSinc] = useState<string | null>(null);
  const [erroSinc, setErroSinc] = useState<string | null>(null);

  const [arrastando, setArrastando] = useState(false);
  /** O arquivo em andamento: o PDF sendo lido, a planilha sendo importada ou o PDF digitalizado subindo. */
  const [enviando, setEnviando] = useState<"lendo" | "importando" | "digitalizando" | null>(null);
  /** A pergunta "liberar ou concluída no papel?" aberta, com o arquivo já solto sobre o cartão (se foi solto). */
  const [pergunta, setPergunta] = useState<{ arquivo: File | null } | null>(null);
  /** Sobe quando uma digitalização foi enviada, registrada ou descartada: a lista dos PDFs em aberto é pedida de novo. */
  const [versaoDaLista, setVersaoDaLista] = useState(0);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [cameraAberta, setCameraAberta] = useState(false);

  useEffect(
    () => () => {
      temporizadores.current.forEach(clearTimeout);
      if (urlDoPdf.current) URL.revokeObjectURL(urlDoPdf.current);
    },
    [],
  );

  function mostrar(novo: Resultado | null) {
    if (urlDoPdf.current) URL.revokeObjectURL(urlDoPdf.current);
    urlDoPdf.current = novo?.tipo === "conferencia" ? novo.url : null;
    setResultado(novo);
  }

  async function sincronizar() {
    setSincronizando(true);
    setErroSinc(null);
    setAvisoSinc(null);
    try {
      await chamar("POST", "/sap/leituras");
      setAvisoSinc("Sincronização iniciada. Os números são atualizados em instantes.");
      temporizadores.current.forEach(clearTimeout);
      temporizadores.current = ATUALIZAR_DEPOIS_DE.map((ms, i) =>
        setTimeout(() => {
          roteador.refresh();
          if (i === ATUALIZAR_DEPOIS_DE.length - 1) {
            setSincronizando(false);
            setAvisoSinc("Sincronização processada: o resultado está no histórico abaixo. Se ela falhou, o aviso chega nas notificações.");
          }
        }, ms),
      );
    } catch (e) {
      setErroSinc(e instanceof Error ? e.message : "Não foi possível iniciar a sincronização.");
      setSincronizando(false);
    }
  }

  /**
   * Planilha: importa direto (o resultado aparece abaixo). PDF: só lê e abre a conferência; nada é gravado até a pessoa
   * registrar. Falha de importação da planilha fica no histórico e vira alerta, por isso a tela é atualizada também nela.
   */
  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    const nome = arquivo.name.toLowerCase();
    const pdf = nome.endsWith(".pdf") || arquivo.type === "application/pdf";
    setErroArquivo(null);
    if (!pdf && !nome.endsWith(".xlsx")) {
      setErroArquivo("Envie a planilha .xlsx exportada do SAP ou o PDF de uma OS.");
      return;
    }
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      setErroArquivo(`${pdf ? "O PDF" : "A planilha"} passa de ${LIMITE_MB} MB.`);
      return;
    }
    mostrar(null);
    setEnviando(pdf ? "lendo" : "importando");
    try {
      const form = new FormData();
      form.set("arquivo", arquivo);
      if (pdf) {
        const leitura = await enviarFormulario<LeituraDoPdf>("/importacoes/pdf/leitura", form);
        mostrar({ tipo: "conferencia", arquivo, url: URL.createObjectURL(arquivo), leitura });
      } else {
        const dados = await enviarFormulario<ResultadoDaImportacao>("/importacoes", form);
        mostrar({ tipo: "importado", formato: "planilha", nome: arquivo.name, dados });
        roteador.refresh();
      }
    } catch (e) {
      setErroArquivo(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tente de novo.");
      if (!pdf && e instanceof ErroCliente) roteador.refresh();
    } finally {
      setEnviando(null);
    }
  }

  /** O PDF escaneado de OS já executadas no papel: sobe e a leitura segue em segundo plano (OCR e IA), acompanhada na tela. */
  async function digitalizar(arquivo: File | undefined) {
    if (!arquivo) return;
    const pdf = arquivo.name.toLowerCase().endsWith(".pdf") || arquivo.type === "application/pdf";
    setErroArquivo(null);
    if (!pdf) {
      setErroArquivo('A digitalização lê o PDF escaneado das folhas. Para uma planilha .xlsx, escolha "Para liberar no sistema".');
      return;
    }
    if (arquivo.size > LIMITE_DO_PDF_DIGITALIZADO_MB * 1024 * 1024) {
      setErroArquivo(`O PDF passa de ${LIMITE_DO_PDF_DIGITALIZADO_MB} MB. Divida as folhas em mais de um arquivo.`);
      return;
    }
    mostrar(null);
    setEnviando("digitalizando");
    try {
      const form = new FormData();
      form.set("arquivo", arquivo);
      const criada = await enviarFormulario<Digitalizacao>("/digitalizacoes", form);
      mostrar({ tipo: "digitalizando", id: criada.id });
      setVersaoDaLista((v) => v + 1);
    } catch (e) {
      setErroArquivo(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  /**
   * Depois da pergunta: com o arquivo já solto sobre o cartão, segue direto pelo caminho escolhido; sem ele, abre o seletor de
   * arquivos do caminho (o de "papel" só aceita PDF). O seletor abre depois que a janela fecha: com ela aberta, o resto da página
   * está inerte.
   */
  function escolherCaminho(caminho: CaminhoDaImportacao) {
    const arquivo = pergunta?.arquivo ?? null;
    setPergunta(null);
    if (arquivo) {
      void (caminho === "papel" ? digitalizar(arquivo) : importar(arquivo));
      return;
    }
    window.setTimeout(() => (caminho === "papel" ? campoPapel : campo).current?.click(), 80);
  }

  const arrastar = {
    sobre: (e: DragEvent) => {
      e.preventDefault();
      if (!enviando) setArrastando(true);
    },
    // Passar de um elemento do cartão para outro também dispara `dragleave`: só sai quando deixa o cartão.
    sair: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
    },
    soltar: (e: DragEvent) => {
      e.preventDefault();
      setArrastando(false);
      const solto = e.dataTransfer.files[0];
      if (!enviando && solto) setPergunta({ arquivo: solto });
    },
  };

  return (
    <div className="stack g16">
      <div className="entradas">
        <Cartao
          tom="api"
          icone="refresh"
          titulo="Sincronização"
          canal="API"
          descricao="Busca automaticamente as OS novas no SAP ou em outra API de exportação. Clique para sincronizar agora."
          detalhes={
            <>
              <span>
                <Icon name="clock" size={13} />
                {ultimaLeituraEm ? `Última sincronização: ${dataHora(ultimaLeituraEm)}` : "Nenhuma sincronização concluída ainda"}
              </span>
              <span>
                <Icon name="refresh" size={13} />
                {automatica ? `Automática a cada ${intervaloMin} min` : "Automática desligada: só sob demanda"}
              </span>
            </>
          }
          acao={sincronizando ? "Sincronizando…" : "Sincronizar agora"}
          aoClicar={sincronizar}
          ocupado={sincronizando}
          retorno={
            (avisoSinc || erroSinc) && (
              <span className={cx("entrada-retorno", erroSinc && "erro")} role={erroSinc ? "alert" : "status"}>
                {erroSinc ?? avisoSinc}
              </span>
            )
          }
        />

        <Cartao
          tom="arq"
          icone="upload"
          titulo="Importação"
          canal="Arquivo"
          selos={
            <>
              <span className="fmt">XLSX</span>
              <span className="fmt">PDF</span>
            </>
          }
          descricao="Envie a planilha exportada do SAP, o PDF de uma OS ou o PDF escaneado de OS já concluídas no papel. Clique para escolher o arquivo ou arraste-o até aqui."
          detalhes={
            <>
              <span>
                <Icon name="check" size={13} />
                Planilha .xlsx ou PDF gerado pelo SAP, até {LIMITE_MB} MB
              </span>
              <span>
                <Icon name="file" size={13} />
                No PDF, você confere cada OS antes de registrar
              </span>
              <span>
                <Icon name="camera" size={13} />
                OS já concluídas no papel entram encerradas, só como histórico
              </span>
              <span>
                <Icon name="refresh" size={13} />
                Reimportar não duplica OS nem reabre as encerradas
              </span>
            </>
          }
          acao={enviando === "lendo" ? "Lendo o PDF…" : enviando === "digitalizando" ? "Enviando o PDF…" : enviando ? "Importando…" : arrastando ? "Solte o arquivo aqui" : "Escolher arquivo"}
          aoClicar={() => setPergunta({ arquivo: null })}
          ocupado={enviando !== null}
          arrastando={arrastando}
          aoArrastar={arrastar}
          retorno={
            erroArquivo && (
              <span className="entrada-retorno erro" role="alert">
                {erroArquivo}
              </span>
            )
          }
        />

        {ehAdmin && (
          <Cartao
            tom="cam"
            icone="camera"
            titulo="Digitalização"
            canal="Câmera"
            descricao="Fotografe 1 ou 2 folhas avulsas de uma OS já concluída no papel: a leitura é a mesma do PDF escaneado e a OS entra encerrada, só como histórico."
            detalhes={
              <>
                <span>
                  <Icon name="camera" size={13} />
                  Câmera traseira do celular ou a do computador
                </span>
                <span>
                  <Icon name="file" size={13} />
                  Uma foto por folha, com a folha inteira e boa luz
                </span>
                <span>
                  <Icon name="eye" size={13} />
                  O sistema avisa na hora se a foto está escura ou tremida
                </span>
              </>
            }
            acao="Abrir câmera"
            aoClicar={() => setCameraAberta(true)}
          />
        )}
      </div>

      <input
        ref={campo}
        type="file"
        accept={`.xlsx,${TIPO_XLSX},.pdf,application/pdf`}
        hidden
        aria-label="Planilha .xlsx ou PDF da OS"
        onChange={(e) => {
          // Limpa o campo para que escolher o mesmo arquivo de novo também dispare a importação.
          const escolhido = e.target.files?.[0];
          e.target.value = "";
          void importar(escolhido);
        }}
      />
      <input
        ref={campoPapel}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        aria-label="PDF escaneado das folhas de OS já concluídas no papel"
        onChange={(e) => {
          const escolhido = e.target.files?.[0];
          e.target.value = "";
          void digitalizar(escolhido);
        }}
      />

      {ehAdmin && resultado?.tipo !== "digitalizando" && (
        <DigitalizacoesEmAberto versao={versaoDaLista} aoAbrir={(id) => mostrar({ tipo: "digitalizando", id })} />
      )}

      {resultado?.tipo === "digitalizando" && (
        <AcompanharDigitalizacao
          key={resultado.id}
          id={resultado.id}
          podeCadastrarEquipe={ehAdmin}
          aoSair={() => {
            mostrar(null);
            setVersaoDaLista((v) => v + 1);
          }}
          aoRegistrar={(nome, dados) => {
            mostrar({ tipo: "digitalizado", nome, dados });
            setVersaoDaLista((v) => v + 1);
            roteador.refresh();
          }}
        />
      )}
      {resultado?.tipo === "digitalizado" && <ResultadoDigitalizacao nome={resultado.nome} dados={resultado.dados} podeCadastrarEquipe={ehAdmin} />}
      {resultado?.tipo === "importado" && <ResultadoArquivo nome={resultado.nome} formato={resultado.formato} dados={resultado.dados} podeCadastrarEquipe={ehAdmin} />}
      {resultado?.tipo === "conferencia" && (
        <ConferenciaPdf
          key={resultado.url}
          arquivo={resultado.arquivo}
          url={resultado.url}
          leitura={resultado.leitura}
          podeCadastrarEquipe={ehAdmin}
          aoDescartar={() => mostrar(null)}
          aoRegistrar={(dados) => {
            mostrar({ tipo: "importado", formato: "pdf", nome: resultado.arquivo.name, dados });
            roteador.refresh();
          }}
          aoFalhar={() => roteador.refresh()}
        />
      )}

      {pergunta && <PerguntaDaImportacao arquivo={pergunta.arquivo} aoEscolher={escolherCaminho} aoFechar={() => setPergunta(null)} />}
      {cameraAberta && (
        <JanelaCamera
          aoFechar={() => setCameraAberta(false)}
          aoEnviada={(id) => {
            setCameraAberta(false);
            mostrar({ tipo: "digitalizando", id });
            setVersaoDaLista((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

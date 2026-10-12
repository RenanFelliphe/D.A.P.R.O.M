"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { cx } from "@/lib/cx";
import { dataHora } from "@/lib/formatar";
import { JanelaCamera } from "./JanelaCamera";
import { PreviaPdf } from "./PreviaPdf";
import { ResultadoPlanilha } from "./ResultadoPlanilha";
import type { ResultadoDaPlanilha } from "./tipos";

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

type Resultado = { tipo: "planilha"; nome: string; dados: ResultadoDaPlanilha } | { tipo: "pdf"; arquivo: File; url: string };

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
 * As três formas de uma OS nova entrar no sistema, um cartão para cada: Sincronização (força a leitura da API, como o
 * antigo "Ler agora"), Importação (planilha .xlsx exportada do SAP; o PDF ainda só mostra como vai funcionar) e
 * Digitalização (câmera, ainda sem leitura), que só o administrador vê. O resultado da importação aparece logo abaixo.
 */
export function EntradasDeOs({ ultimaLeituraEm, automatica, intervaloMin, ehAdmin }: EntradasDeOsProps) {
  const roteador = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);
  const urlDoPdf = useRef<string | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [avisoSinc, setAvisoSinc] = useState<string | null>(null);
  const [erroSinc, setErroSinc] = useState<string | null>(null);

  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
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
    urlDoPdf.current = novo?.tipo === "pdf" ? novo.url : null;
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

  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    const nome = arquivo.name.toLowerCase();
    setErroArquivo(null);
    if (nome.endsWith(".pdf") || arquivo.type === "application/pdf") {
      mostrar({ tipo: "pdf", arquivo, url: URL.createObjectURL(arquivo) });
      return;
    }
    if (!nome.endsWith(".xlsx")) {
      setErroArquivo("Envie a planilha .xlsx exportada do SAP ou o PDF de uma OS.");
      return;
    }
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      setErroArquivo(`A planilha passa de ${LIMITE_MB} MB.`);
      return;
    }
    mostrar(null);
    setEnviando(true);
    try {
      const form = new FormData();
      form.set("arquivo", arquivo);
      const resposta = await fetch("/api/importacoes", { method: "POST", body: form, cache: "no-store" });
      if (resposta.status === 401) {
        roteador.push("/app/entrar");
        return;
      }
      const texto = await resposta.text();
      let corpo: { erro?: { mensagem?: string } } & Partial<ResultadoDaPlanilha> = {};
      try {
        corpo = texto ? JSON.parse(texto) : {};
      } catch {
        /* resposta que não é JSON */
      }
      if (!resposta.ok) {
        setErroArquivo(corpo?.erro?.mensagem ?? "Não foi possível importar a planilha.");
        return;
      }
      mostrar({ tipo: "planilha", nome: arquivo.name, dados: corpo as ResultadoDaPlanilha });
      roteador.refresh();
    } catch {
      setErroArquivo("Servidor indisponível. Tente de novo.");
    } finally {
      setEnviando(false);
    }
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
      if (!enviando) void importar(e.dataTransfer.files[0]);
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
          descricao="Envie a planilha exportada do SAP ou o PDF de uma OS. Clique para escolher o arquivo ou arraste-o até aqui."
          detalhes={
            <>
              <span>
                <Icon name="check" size={13} />
                Planilha .xlsx de até {LIMITE_MB} MB
              </span>
              <span>
                <Icon name="refresh" size={13} />
                Reimportar não duplica OS nem reabre as encerradas
              </span>
            </>
          }
          acao={enviando ? "Importando…" : arrastando ? "Solte o arquivo aqui" : "Escolher arquivo"}
          aoClicar={() => campo.current?.click()}
          ocupado={enviando}
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
            descricao="Abre a câmera para digitalizar uma OS em papel e trazê-la para o sistema."
            detalhes={
              <>
                <span>
                  <Icon name="camera" size={13} />
                  Câmera traseira do celular ou a do computador
                </span>
                <span>
                  <Icon name="file" size={13} />
                  Enquadre a folha inteira, com boa luz
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

      {resultado?.tipo === "planilha" && <ResultadoPlanilha nome={resultado.nome} dados={resultado.dados} podeCadastrarEquipe={ehAdmin} />}
      {resultado?.tipo === "pdf" && <PreviaPdf arquivo={resultado.arquivo} url={resultado.url} aoDescartar={() => mostrar(null)} />}

      {cameraAberta && <JanelaCamera aoFechar={() => setCameraAberta(false)} />}
    </div>
  );
}

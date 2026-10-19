import { dataHora, hora } from "@shared/api/formatar";
import { aprAprovadaDisponivel, aprDeHoje, execucaoAberta, execucaoEncerrando, reservadaParaOutro, situacaoDaApr, type AprDaOs, type ExecucaoDaOs, type OsDetalhada } from "@shared/api/os-app";
import type { TomDoAviso } from "@/tema/tema";
import type { AcaoDeCampo } from "../rotas";

export interface AvisoDeAcao {
  tom: TomDoAviso;
  titulo?: string;
  texto: string;
}

export interface BotaoDeAcao {
  /** `abrir-pdf` abre o PDF da OS encerrada; as demais levam à tela de campo (pendência 2). */
  acao: AcaoDeCampo | "abrir-pdf";
  titulo: string;
  variante: "primario" | "secundario";
}

/** O que o painel de ação do detalhe mostra: avisos, uma nota curta de uma linha e os botões. Mesmas regras do `AcoesDaOs` da web. */
export interface DecisaoDeAcao {
  avisos: AvisoDeAcao[];
  nota?: string;
  botoes: BotaoDeAcao[];
}

interface Entrada {
  os: OsDetalhada;
  usuarioId: string;
  aprs: AprDaOs[];
  execucoes: ExecucaoDaOs[];
  /** O rótulo da ausência de quem olha ("Ausente até 03/11/2026"), ou `null`. O ausente só visualiza. */
  ausencia: string | null;
}

const nomes = (ps: { nome: string }[]) => ps.map((p) => p.nome).join(", ");

/**
 * O que o técnico pode fazer agora na OS, conforme o estado dela, as APRs de hoje e as execuções. É a única regra do painel de
 * ação do app: o botão certo para cada situação, ou o motivo no lugar do botão para quem não pode agir.
 */
export function decidirAcao({ os, usuarioId, aprs, execucoes, ausencia }: Entrada): DecisaoDeAcao {
  const aberta = execucaoAberta(execucoes);
  const osEmAberto = !["encerrada", "cancelada", "devolvida", "encerrando", "aguardando_supervisor"].includes(os.status);

  // O ausente não aplica APR nem executa: só consulta (a OS dele em execução foi suspensa quando a ausência começou).
  if (ausencia && osEmAberto) {
    return { avisos: [{ tom: "al", titulo: `${ausencia}.`, texto: "Você só visualiza o sistema: não dá para aplicar APR nem iniciar a execução desta OS." }], botoes: [] };
  }

  if (os.status === "em_execucao" || aberta) {
    if (aberta?.executor.id === usuarioId) {
      return { avisos: [], nota: `Execução iniciada em ${dataHora(aberta.inicio)}.`, botoes: [{ acao: "continuar-execucao", titulo: "Continuar a execução", variante: "primario" }] };
    }
    return {
      avisos: [
        {
          tom: "info",
          titulo: "Esta OS já está em execução",
          texto: `${aberta ? ` por ${aberta.executor.nome}, desde ${dataHora(aberta.inicio)}` : ""}. Não dá para iniciar outra APR ou execução enquanto ela não for encerrada, suspensa ou interrompida.`,
        },
      ],
      botoes: [],
    };
  }

  // O tempo parou ("Encerrar OS"), mas o responsável ainda não preencheu e assinou o encerramento.
  if (os.status === "encerrando") {
    const encerrando = execucaoEncerrando(execucoes);
    if (encerrando?.executor.id === usuarioId) {
      return {
        avisos: [{ tom: "al", titulo: "Você encerrou a OS: falta preencher e assinar o encerramento.", texto: "O tempo já parou; o preenchimento não conta nele." }],
        botoes: [{ acao: "preencher-encerramento", titulo: "Preencher e assinar o encerramento", variante: "primario" }],
      };
    }
    return {
      avisos: [
        {
          tom: "info",
          titulo: `${encerrando ? `${encerrando.executor.nome} encerrou a OS` : "A OS foi encerrada"} e está preenchendo e assinando o encerramento.`,
          texto: "Só o responsável pela execução assina. Depois, a OS segue para o supervisor.",
        },
      ],
      botoes: [],
    };
  }

  if (os.status === "aguardando_supervisor") {
    return {
      avisos: [
        {
          tom: "info",
          titulo: "O responsável já assinou o encerramento.",
          texto: "Agora falta o supervisor ler o relatório da execução e assinar por último; só então a OS está concluída e o PDF fica pronto.",
        },
      ],
      botoes: [],
    };
  }

  if (os.status === "encerrada" || os.status === "cancelada" || os.status === "devolvida") {
    const justificativa = os.status === "cancelada" ? os.justificativa_cancelamento : os.status === "devolvida" ? os.devolucao?.justificativa : null;
    const avisos: AvisoDeAcao[] = [];
    if (justificativa) avisos.push({ tom: "info", texto: justificativa });
    const botoes: BotaoDeAcao[] = [];
    if (os.status === "encerrada") {
      if (os.pdf_pronto) botoes.push({ acao: "abrir-pdf", titulo: "Abrir o PDF da OS", variante: "primario" });
      else avisos.push({ tom: "info", texto: "O PDF desta OS ainda está sendo gerado." });
    }
    return { avisos, nota: os.status === "encerrada" ? "OS concluída: só consulta." : os.status === "cancelada" ? "OS cancelada: só consulta." : "OS devolvida ao SAP: só consulta.", botoes };
  }

  // liberada ou pendente
  if (reservadaParaOutro(os, usuarioId)) {
    return {
      avisos: [{ tom: "info", titulo: `OS reservada para ${os.responsavel!.nome}.`, texto: "Só quem o supervisor designou inicia a APR e a execução desta OS. Siga com as outras da equipe." }],
      botoes: [],
    };
  }

  const disponivel = aprAprovadaDisponivel(aprs, execucoes, usuarioId);
  const deOutros = aprAprovadaDisponivel(aprs, execucoes);
  const doDia = aprDeHoje(aprs, execucoes, usuarioId);
  const inviavel = doDia && situacaoDaApr(doDia).inviavel ? doDia : null;
  const botoes: BotaoDeAcao[] = [];
  const avisos: AvisoDeAcao[] = [];
  let nota: string | undefined;

  if (disponivel && situacaoDaApr(disponivel).pronta) {
    avisos.push({ tom: "ok", titulo: `APR aprovada hoje às ${hora(disponivel.concluida_em)} e assinada por todos.`, texto: "Ela ampara uma execução nesta OS." });
    botoes.push({ acao: "iniciar-execucao", titulo: "Iniciar a execução", variante: "primario" });
  } else if (disponivel) {
    const situacao = situacaoDaApr(disponivel);
    const euAssinei = Boolean(disponivel.participantes.find((p) => p.usuario_id === usuarioId)?.assinada_em);
    avisos.push({
      tom: "al",
      titulo: `APR aprovada hoje às ${hora(disponivel.concluida_em)}, ${euAssinei ? "mas ainda faltam assinaturas" : "aguardando a sua assinatura"}.`,
      texto: `${euAssinei ? `Falta assinar: ${nomes(situacao.faltam)}. ` : ""}A execução só começa quando todos os participantes assinam, cada um na própria conta.`,
    });
    botoes.push(euAssinei ? { acao: "acompanhar-assinaturas", titulo: "Acompanhar as assinaturas", variante: "primario" } : { acao: "assinar-apr", titulo: "Assinar a APR", variante: "primario" });
  } else if (deOutros) {
    const euRecusei = Boolean(deOutros.participantes.find((p) => p.usuario_id === usuarioId)?.recusou_em);
    avisos.push(
      euRecusei
        ? { tom: "info", titulo: `Você recusou a APR de ${deOutros.preenchida_por.nome} e saiu dela.`, texto: "Para executar esta OS, faça a sua APR." }
        : {
            tom: "info",
            titulo: `APR aprovada hoje às ${hora(deOutros.concluida_em)} por ${deOutros.preenchida_por.nome}.`,
            texto: `Só os participantes dela (${nomes(situacaoDaApr(deOutros).ativos)}) assinam e iniciam a execução. Para executar, faça a sua APR.`,
          },
    );
  } else if (inviavel) {
    avisos.push({ tom: "blq", titulo: "A APR de hoje não serve mais.", texto: `${situacaoDaApr(inviavel).motivoInviavel} Faça uma APR nova para executar a OS.` });
  } else {
    nota = "A execução só é liberada depois da APR aprovada e assinada por todos.";
  }

  // A APR nova: a opção principal sem APR aprovada; com ela, passa a ser a secundária.
  const jaAprovada = Boolean(disponivel);
  botoes.push({ acao: "iniciar-apr", titulo: jaAprovada ? "Fazer uma nova APR" : os.status === "pendente" ? "Retomar com APR nova" : "Nova APR", variante: jaAprovada ? "secundario" : "primario" });
  return { avisos, nota, botoes };
}

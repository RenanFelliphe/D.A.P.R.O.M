/**
 * Os textos da conferência da execução que a web e o app mostram do mesmo jeito (`funcionalidades/execucao-compartilhada.md`, etapa 3).
 * Só português, sem tela: cada cliente desenha, e a frase é uma só.
 */
import type { CampoDaConferencia, ConferenciaDaApi, OpcaoDoCampo } from "./conferencia-execucao";
import { ESCOLHA_DESCARTAR, TOLERANCIA_MS } from "./conferencia-execucao";
import { dataHora, hora } from "./formatar";

/** O que a Vitória diz em duas frases quando a pessoa chega na conferência pela primeira vez. */
export const EXPLICACAO_DA_CONFERENCIA =
  "Quando a equipe registra o serviço sem sinal, cada aparelho guarda a sua versão. Depois que todos sincronizam, o SYNQ OS compara: se bate, basta dar ciência; se diverge, o responsável escolhe a versão certa e a equipe assina.";

export const EXPLICACAO_DA_TOLERANCIA = `Horários com até ${TOLERANCIA_MS / 60_000} minutos de diferença valem como o mesmo, e as fotos de todos os aparelhos somam.`;

/** O que uma opção registrou, numa linha: "19/10/2026 12:10", "Encerrada" ou "Almoço, das 13:00 às 14:00". */
export function descreverOpcao(campo: string, o: Pick<OpcaoDoCampo, "instante" | "fim" | "texto">): string {
  if (campo === "resultado") return o.texto ?? "—";
  if (campo.startsWith("pausa:")) return `${o.texto ?? "Pausa"}, das ${hora(o.instante)} às ${o.fim ? hora(o.fim) : "(sem fim registrado)"}`;
  return dataHora(o.instante);
}

/** Quem decide o campo, para a tela dizer: "Escolha do responsável" ou "Escolha do supervisor". */
export const quemDecideOCampo = (c: Pick<CampoDaConferencia, "decide">) => (c.decide === "supervisor" ? "do supervisor" : "do responsável");

/** O que a escolha de um campo significou: o nome de quem valeu, ou "descartada". */
export function descreverEscolha(c: Pick<ConferenciaDaApi, "versoes">, escolha: string): string {
  if (escolha === ESCOLHA_DESCARTAR) return "Descartada";
  return c.versoes.find((v) => v.autor_id === escolha)?.autor_nome ?? "—";
}

/** O texto do botão de cada opção do campo: "Valer o de Ana" ou, na pausa de um aparelho só, "Aceitar a pausa". */
export function rotuloDaOpcao(campo: CampoDaConferencia, o: OpcaoDoCampo): string {
  return campo.so_um ? "Aceitar a pausa" : `Valer o de ${o.autor_nome}`;
}

export const ROTULO_DE_DESCARTAR = "Descartar a pausa";

/** Quem ainda falta sincronizar e quem ainda falta dar a ciência ou assinar. */
export function quemFalta(c: Pick<ConferenciaDaApi, "participantes">): { sincronizar: string[]; assinar: string[] } {
  return {
    sincronizar: c.participantes.filter((p) => !p.sincronizou).map((p) => p.usuario.nome),
    assinar: c.participantes.filter((p) => p.deve_assinar && !p.assinatura).map((p) => p.usuario.nome),
  };
}

const lista = (nomes: string[]) => (nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`);

/** O passo em que a conferência está para quem olha: o título e uma frase do que falta e de quem é a vez. */
export function passoDaConferencia(c: ConferenciaDaApi): { titulo: string; texto: string } {
  const falta = quemFalta(c);
  switch (c.estado) {
    case "aguardando_sincronizacao":
      return {
        titulo: "Esperando todos sincronizarem",
        texto: `Parte da execução foi registrada sem sinal, em aparelhos diferentes. Quando todos sincronizarem, o sistema compara os registros.${falta.sincronizar.length > 0 ? ` Faltam: ${lista(falta.sincronizar)}.` : ""}`,
      };
    case "aguardando_responsavel":
      return c.eu.pode_decidir.length > 0
        ? { titulo: "Escolha a versão certa", texto: "Os aparelhos registraram a execução de jeitos diferentes. Escolha, em cada diferença, o que vale." }
        : { titulo: "Esperando a escolha", texto: `Os aparelhos registraram a execução de jeitos diferentes. ${c.responsavel ? `${c.responsavel.nome} escolhe horários e pausas; o supervisor escolhe o resultado.` : "O responsável escolhe horários e pausas; o supervisor escolhe o resultado."}` };
    case "aguardando_assinaturas":
      if (c.eu.deve_assinar) {
        return c.tipo === "resumo"
          ? { titulo: "Dê a sua ciência", texto: "Os registros dos aparelhos batem. Confira o resumo e dê a sua ciência: é um toque, sem assinatura." }
          : { titulo: "Confira e assine", texto: "O responsável escolheu as versões. Confira e assine; se discordar, assine com ressalva: ela vai ao supervisor e ao relatório." };
      }
      return {
        titulo: c.tipo === "resumo" ? "Esperando as ciências" : "Esperando as assinaturas",
        texto: falta.assinar.length > 0 ? `Falta${falta.assinar.length === 1 ? "" : "m"}: ${lista(falta.assinar)}.` : "Todos os que precisavam já deram a ciência ou assinaram.",
      };
    case "concluida":
      return { titulo: "Conferência concluída", texto: "A equipe conferiu a execução e todos deram a ciência ou assinaram." };
    case "fechada_sem_todos": {
      const quem = [...(c.faltaram?.sincronizar ?? []), ...(c.faltaram?.assinar ?? [])];
      return {
        titulo: "Conferência fechada com o que existia",
        texto: `${c.fechada_por ? `${c.fechada_por.nome} fechou a conferência` : "A conferência fechou sozinha, ao fim de 7 dias"}, sem esperar quem faltou${quem.length > 0 ? `: ${lista([...new Set(quem)])}` : ""}.`,
      };
    }
  }
}

/** "Fecha sozinha em 3 dias", ou `null` se já terminou. */
export function prazoDaConferencia(c: Pick<ConferenciaDaApi, "estado" | "limite_em">, agora: Date): string | null {
  if (c.estado === "concluida" || c.estado === "fechada_sem_todos") return null;
  const dias = Math.ceil((Date.parse(c.limite_em) - agora.getTime()) / 86_400_000);
  if (dias <= 0) return "Fecha sozinha em breve";
  return `Fecha sozinha em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

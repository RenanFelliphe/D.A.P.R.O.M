import {
  ESCOLHA_DESCARTAR,
  ROTULO_DO_RESULTADO,
  TOLERANCIA_MS,
  type CampoDaConferencia,
  type OpcaoDoCampo,
  type PausaDaVersao,
  type ResultadoDaExecucao,
  type VersaoDeAutor,
} from "../../../shared/api/conferencia-execucao";
import { ROTULO_DA_PAUSA } from "./motivos-de-parada";

/**
 * A comparação da conferência (execução compartilhada, etapa 3), sem banco: recebe a versão de cada autor (o que cada aparelho
 * registrou) e diz, campo a campo, o que bate e o que diverge. Valores a menos de `TOLERANCIA_MS` um do outro valem como o mesmo;
 * pausas se casam por sobreposição de horário; fotos somam e nunca divergem. Fica à parte para o teste cobrir as regras direto.
 */

/** O que a execução tem gravado agora (antes de a escolha ser aplicada), para marcar de quem é a versão que está valendo. */
export interface CanonicoDaExecucao {
  inicio: string;
  fim: string | null;
  resultado: ResultadoDaExecucao | null;
  finalizadaPor: string | null;
  pausas: { id: string; inicio: string; fim: string | null }[];
}

const ms = (iso: string) => Date.parse(iso);

/** Os instantes não distam mais que a tolerância: valem como o mesmo. */
const mesmoHorario = (a: string, b: string) => Math.abs(ms(a) - ms(b)) <= TOLERANCIA_MS;

/** Todos os horários batem entre si (o maior e o menor distam até a tolerância). */
function horariosBatem(instantes: string[]): boolean {
  if (instantes.length < 2) return true;
  const t = instantes.map(ms);
  return Math.max(...t) - Math.min(...t) <= TOLERANCIA_MS;
}

const maisAntigo = <T>(itens: T[], instante: (t: T) => string): T => itens.reduce((a, b) => (ms(instante(b)) < ms(instante(a)) ? b : a));

const rotuloDaPausa = (p: PausaDaVersao) => {
  const motivo = p.motivo ? (ROTULO_DA_PAUSA[p.motivo as keyof typeof ROTULO_DA_PAUSA] ?? p.motivo) : "Pausa";
  return p.complemento ? `${motivo}: ${p.complemento}` : motivo;
};

/**
 * Quem é o responsável da execução na conferência: o autor do `execucao_iniciada` mais antigo, se ele começou mais de `TOLERANCIA_MS`
 * antes do que a execução tem gravado; dentro da tolerância, quem a execução já tem como responsável.
 */
export function responsavelDaConferencia(versoes: VersaoDeAutor[], executorId: string, inicioGravado: string): string {
  const comInicio = versoes.filter((v) => v.inicio);
  if (comInicio.length === 0) return executorId;
  const primeiro = maisAntigo(comInicio, (v) => v.inicio!);
  if (primeiro.autor_id === executorId) return executorId;
  return ms(inicioGravado) - ms(primeiro.inicio!) > TOLERANCIA_MS ? primeiro.autor_id : executorId;
}

interface ItemDePausa {
  versao: VersaoDeAutor;
  pausa: PausaDaVersao;
  inicio: number;
  fim: number;
}

/** Agrupa as pausas de todos os autores que se sobrepõem no horário (o mesmo parada vista por aparelhos diferentes). */
function agruparPausas(versoes: VersaoDeAutor[], fimDaExecucao: string | null): ItemDePausa[][] {
  const itens: ItemDePausa[] = versoes.flatMap((versao) =>
    versao.pausas.map((pausa) => {
      const inicio = ms(pausa.inicio);
      // A pausa que o autor não fechou vale até o fim da execução (encerrar fecha a pausa aberta).
      const fim = pausa.fim ? ms(pausa.fim) : fimDaExecucao ? Math.max(inicio, ms(fimDaExecucao)) : inicio;
      return { versao, pausa, inicio, fim };
    }),
  );
  itens.sort((a, b) => a.inicio - b.inicio);
  const grupos: ItemDePausa[][] = [];
  let ate = -Infinity;
  for (const item of itens) {
    // Sobreposição de verdade: uma pausa que começa quando a anterior do mesmo autor termina não é a mesma pausa.
    if (grupos.length > 0 && item.inicio < ate) {
      grupos[grupos.length - 1]!.push(item);
      ate = Math.max(ate, item.fim);
    } else {
      grupos.push([item]);
      ate = item.fim;
    }
  }
  return grupos;
}

/**
 * Compara as versões e devolve os campos da conferência: início, fim, resultado e cada pausa. `responsavelId` é quem decide horários e
 * pausas (o resultado é do supervisor). O padrão sugerido é a conclusão mais antiga e a pausa do responsável.
 */
export function compararVersoes(versoes: VersaoDeAutor[], responsavelId: string, canonico: CanonicoDaExecucao): CampoDaConferencia[] {
  const campos: CampoDaConferencia[] = [];
  const opcao = (v: VersaoDeAutor, o: Partial<OpcaoDoCampo>): OpcaoDoCampo => ({ autor_id: v.autor_id, autor_nome: v.autor_nome, instante: null, fim: null, texto: null, pausa_id: null, ...o });
  const doResponsavel = (candidatos: VersaoDeAutor[]) => candidatos.find((v) => v.autor_id === responsavelId);

  // ---- início
  const comInicio = versoes.filter((v) => v.inicio);
  if (comInicio.length > 0) {
    campos.push({
      campo: "inicio",
      rotulo: "Início",
      decide: "responsavel",
      divergente: !horariosBatem(comInicio.map((v) => v.inicio!)),
      so_um: false,
      opcoes: comInicio.map((v) => opcao(v, { instante: v.inicio })),
      sugerido: maisAntigo(comInicio, (v) => v.inicio!).autor_id,
      valendo_de: comInicio.find((v) => ms(v.inicio!) === ms(canonico.inicio))?.autor_id ?? null,
    });
  }

  // ---- fim e resultado
  const comFim = versoes.filter((v) => v.fim && v.resultado);
  if (comFim.length > 0) {
    const maisCedo = maisAntigo(comFim, (v) => v.fim!);
    campos.push({
      campo: "fim",
      rotulo: "Fim",
      decide: "responsavel",
      divergente: !horariosBatem(comFim.map((v) => v.fim!)),
      so_um: false,
      opcoes: comFim.map((v) => opcao(v, { instante: v.fim })),
      sugerido: maisCedo.autor_id,
      valendo_de: canonico.fim ? (comFim.find((v) => ms(v.fim!) === ms(canonico.fim!))?.autor_id ?? null) : null,
    });
    // O resultado muda o status da OS: quem decide é o supervisor. Vale o de quem concluiu primeiro, salvo o responsável, no empate.
    const resultados = new Set(comFim.map((v) => v.resultado));
    const empatados = comFim.filter((v) => horariosBatem([v.fim!, maisCedo.fim!]));
    campos.push({
      campo: "resultado",
      rotulo: "Resultado",
      decide: "supervisor",
      divergente: resultados.size > 1,
      so_um: false,
      opcoes: comFim.map((v) =>
        opcao(v, { texto: `${ROTULO_DO_RESULTADO[v.resultado!]}${v.motivo ? `: ${v.motivo}` : ""}${v.complemento ? ` (${v.complemento})` : ""}` }),
      ),
      sugerido: (doResponsavel(empatados) ?? maisCedo).autor_id,
      valendo_de: comFim.find((v) => v.autor_id === canonico.finalizadaPor && v.resultado === canonico.resultado)?.autor_id ?? comFim.find((v) => v.resultado === canonico.resultado)?.autor_id ?? null,
    });
  }

  // ---- pausas
  const gravadas = new Set(canonico.pausas.map((p) => p.id));
  agruparPausas(versoes, canonico.fim ?? comFim[0]?.fim ?? null).forEach((grupo, i) => {
    // Um autor vale uma vez no grupo (duas pausas dele encadeadas por uma de outro aparelho ficam, a segunda, só na execução).
    const porAutor = new Map<string, ItemDePausa>();
    for (const item of grupo) if (!porAutor.has(item.versao.autor_id)) porAutor.set(item.versao.autor_id, item);
    const doGrupo = [...porAutor.values()];
    const unico = doGrupo.length === 1;

    let divergente: boolean;
    if (unico) {
      // Só um aparelho a registrou: pede confirmação quando veio sem sinal e há outro aparelho que registrou a execução.
      divergente = doGrupo[0]!.versao.sem_sinal && versoes.length > 1;
    } else {
      const mesmoMotivo = new Set(doGrupo.map((x) => x.pausa.motivo ?? "")).size === 1;
      const fechadas = doGrupo.filter((x) => x.pausa.fim);
      divergente = !mesmoMotivo || !horariosBatem(doGrupo.map((x) => x.pausa.inicio)) || (fechadas.length > 1 && !horariosBatem(fechadas.map((x) => x.pausa.fim!)));
    }
    const sugerido = unico ? doGrupo[0]!.versao : (doResponsavel(doGrupo.map((x) => x.versao)) ?? maisAntigo(doGrupo, (x) => x.pausa.inicio).versao);
    campos.push({
      campo: `pausa:${i + 1}`,
      rotulo: `Pausa ${i + 1}`,
      decide: "responsavel",
      divergente,
      so_um: unico,
      opcoes: doGrupo.map((x) => opcao(x.versao, { instante: x.pausa.inicio, fim: x.pausa.fim, texto: rotuloDaPausa(x.pausa), pausa_id: x.pausa.id })),
      sugerido: sugerido.autor_id,
      valendo_de: doGrupo.find((x) => gravadas.has(x.pausa.id))?.versao.autor_id ?? null,
    });
  });
  return campos;
}

/** O valor de `escolha` que o campo aceita: o autor de uma das opções ou, na pausa de um aparelho só, `descartar`. */
export const escolhaValida = (campo: CampoDaConferencia, escolha: string) => campo.opcoes.some((o) => o.autor_id === escolha) || (campo.campo.startsWith("pausa:") && escolha === ESCOLHA_DESCARTAR);

/** O tipo da conferência: `resumo` quando nenhum campo pede escolha. */
export const tipoDaComparacao = (campos: CampoDaConferencia[]) => (campos.some((c) => c.divergente) ? "com_divergencia" : "resumo");

import { LIMITES_DO_CLIMA, type CausaDeRisco, type HoraDoClima, type IconeDoClima, type JanelaDoClima, type LocalDoClima, type NivelDeRisco, type PrevisaoDoTempo } from "../../../shared/api/clima";
import type { Deps } from "../deps";
import type { ClienteClima, HoraBruta } from "../servicos/clima";
import { cidadePadrao } from "./configuracoes";
import { diaDe } from "./tempo";

/**
 * A previsão do tempo (`funcionalidades/previsao-do-tempo.md`): pede as horas do dia ao provedor, classifica cada hora com regras
 * fixas (sem IA), escolhe a janela que interessa (o resto do expediente ou as próximas 4 horas) e escreve o título e a orientação
 * que a web e o app mostram. O nível da janela é o da pior hora. Sem previsão (provedor fora do ar), nada é avisado nem bloqueado.
 */

const FONTE = "Open-Meteo";
const VALIDADE_DO_CACHE_MS = 30 * 60_000;
const PRIMEIRA_HORA_DO_EXPEDIENTE = 6;
const ULTIMA_HORA_DO_EXPEDIENTE = 17;
const HORAS_A_FRENTE = 3;

const { extremo, atencao } = LIMITES_DO_CLIMA;

const EH_TROVOADA = (codigo: number) => codigo >= 95 && codigo <= 99;

// ---- Classificação -------------------------------------------------------------------------------------------------

/** O que cada hora tem de preocupante, da causa mais grave para a menos grave, com o nível que cada uma dá. */
function causasDaHora(h: HoraBruta): { causa: CausaDeRisco; nivel: NivelDeRisco }[] {
  const lista: { causa: CausaDeRisco; nivel: NivelDeRisco }[] = [];
  if (EH_TROVOADA(h.codigo)) lista.push({ causa: "trovoada", nivel: "extremo" });
  if (h.rajadaKmh >= extremo.rajadaKmh) lista.push({ causa: "vento", nivel: "extremo" });
  if (h.chuvaMm >= extremo.chuvaMmPorHora) lista.push({ causa: "chuva_forte", nivel: "extremo" });
  if (h.rajadaKmh >= atencao.rajadaKmh && h.rajadaKmh < extremo.rajadaKmh) lista.push({ causa: "vento", nivel: "atencao" });
  if (h.chuvaMm >= atencao.chuvaMmPorHora && h.chuvaMm < extremo.chuvaMmPorHora) lista.push({ causa: "chuva", nivel: "atencao" });
  else if (h.chanceChuva >= atencao.chanceDeChuva && !EH_TROVOADA(h.codigo) && h.chuvaMm < extremo.chuvaMmPorHora) lista.push({ causa: "chuva", nivel: "atencao" });
  if (h.sensacao >= atencao.sensacaoC) lista.push({ causa: "calor", nivel: "atencao" });
  if (h.indiceUv >= atencao.indiceUv) lista.push({ causa: "uv", nivel: "atencao" });
  return lista;
}

const PESO: Record<NivelDeRisco, number> = { sem_risco: 0, atencao: 1, extremo: 2 };

const nivelDaHora = (h: HoraBruta): NivelDeRisco => causasDaHora(h).reduce<NivelDeRisco>((n, c) => (PESO[c.nivel] > PESO[n] ? c.nivel : n), "sem_risco");

/** Código WMO → como a tela chama o tempo e que ícone desenha. */
function condicaoDe(codigo: number): { condicao: string; icone: IconeDoClima } {
  if (codigo === 0) return { condicao: "Céu limpo", icone: "sol" };
  if (codigo === 1) return { condicao: "Predominantemente limpo", icone: "sol" };
  if (codigo === 2) return { condicao: "Parcialmente nublado", icone: "nuvem-sol" };
  if (codigo === 3) return { condicao: "Nublado", icone: "nuvem" };
  if (codigo === 45 || codigo === 48) return { condicao: "Nevoeiro", icone: "nevoeiro" };
  if (codigo >= 51 && codigo <= 57) return { condicao: "Garoa", icone: "chuva" };
  if (codigo === 61 || codigo === 80) return { condicao: "Chuva fraca", icone: "chuva" };
  if (codigo === 63 || codigo === 81) return { condicao: "Chuva moderada", icone: "chuva" };
  if (codigo === 65 || codigo === 82 || codigo === 66 || codigo === 67) return { condicao: "Chuva forte", icone: "chuva" };
  if (codigo === 95) return { condicao: "Trovoada", icone: "trovoada" };
  if (codigo === 96 || codigo === 99) return { condicao: "Trovoada com granizo", icone: "trovoada" };
  return { condicao: "Nublado", icone: "nuvem" };
}

function horaParaApi(h: HoraBruta): HoraDoClima {
  const { condicao, icone } = condicaoDe(h.codigo);
  return {
    hora: h.hora,
    temperatura: Math.round(h.temperatura),
    sensacao: Math.round(h.sensacao),
    chance_chuva: Math.round(h.chanceChuva),
    chuva_mm: Number(h.chuvaMm.toFixed(1)),
    rajada_kmh: Math.round(h.rajadaKmh),
    indice_uv: Number(h.indiceUv.toFixed(1)),
    trovoada: EH_TROVOADA(h.codigo),
    condicao,
    icone,
    nivel: nivelDaHora(h),
  };
}

// ---- Frases --------------------------------------------------------------------------------------------------------

const horaDe = (hora: string) => Number(hora.slice(11, 13));
const rotuloDaHora = (n: number) => `${n}h`;

/** "às 14h", "das 13h às 17h": a faixa em que a causa aparece (a última hora conta até o fim dela). */
function faixa(horas: HoraBruta[]): string {
  const primeira = horaDe(horas[0]!.hora);
  const ultima = horaDe(horas[horas.length - 1]!.hora);
  return primeira === ultima ? `por volta das ${rotuloDaHora(primeira)}` : `das ${rotuloDaHora(primeira)} às ${rotuloDaHora(ultima + 1)}`;
}

const PRIORIDADE_DE_CAUSA: CausaDeRisco[] = ["trovoada", "chuva_forte", "vento", "chuva", "calor", "uv"];

function tituloDa(causa: CausaDeRisco, nivel: NivelDeRisco, horas: HoraBruta[]): string {
  const quando = faixa(horas);
  const rajada = Math.round(Math.max(...horas.map((h) => h.rajadaKmh)));
  switch (causa) {
    case "trovoada":
      return `Trovoada prevista ${quando}`;
    case "chuva_forte":
      return `Chuva forte prevista ${quando}`;
    case "vento":
      return nivel === "extremo" ? `Rajadas de vento de até ${rajada} km/h previstas ${quando}` : `Ventos fortes (rajadas de até ${rajada} km/h) previstos ${quando}`;
    case "chuva": {
      const chance = Math.round(Math.max(...horas.map((h) => h.chanceChuva)));
      const mm = Math.max(...horas.map((h) => h.chuvaMm));
      return mm >= atencao.chuvaMmPorHora ? `Chuva prevista ${quando}` : `Chance de chuva de até ${chance}% ${quando}`;
    }
    case "calor":
      return `Calor forte previsto ${quando} (sensação de até ${Math.round(Math.max(...horas.map((h) => h.sensacao)))}°C)`;
    case "uv":
      return `Radiação UV muito alta ${quando}`;
  }
}

/** O que fazer, por causa e nível; no extremo, a orientação é "não comece" e "se já estiver em campo, pare". */
const ORIENTACAO: Record<CausaDeRisco, { atencao: string; extremo: string }> = {
  trovoada: {
    atencao: "Fique atento ao céu e interrompa o serviço externo se ouvir trovões.",
    extremo: "Não inicie serviços externos nesse horário. Se já estiver em campo, procure abrigo e suspenda o serviço até a trovoada passar.",
  },
  chuva_forte: {
    atencao: "Prefira os serviços externos antes desse horário e leve capa e bota de PVC.",
    extremo: "Evite serviços externos e escavações nesse horário (risco de alagamento). Se já estiver em campo, suspenda o serviço e proteja a equipe.",
  },
  vento: {
    atencao: "Redobre o cuidado com trabalho em altura e com materiais soltos.",
    extremo: "Não faça trabalho em altura nem junto de árvores e redes nesse horário. Se já estiver em campo, suspenda o serviço até o vento diminuir.",
  },
  chuva: {
    atencao: "Prefira os serviços externos antes desse horário e leve capa e bota de PVC. Cuidado com piso escorregadio e valas.",
    extremo: "Evite serviços externos nesse horário.",
  },
  calor: {
    atencao: "Hidrate-se, faça pausas na sombra e use roupa leve e protetor solar.",
    extremo: "Faça pausas frequentes na sombra e hidrate-se.",
  },
  uv: {
    atencao: "Use protetor solar e proteção para a cabeça e a nuca, e faça pausas na sombra.",
    extremo: "Use protetor solar e proteção para a cabeça e a nuca.",
  },
};

const SEM_RISCO: Record<JanelaDoClima, { titulo: string; orientacao: string }> = {
  expediente: {
    titulo: "Sem risco climático previsto para o resto do expediente",
    orientacao: "Não há situação climática de risco para hoje. Bom trabalho e boa segurança!",
  },
  proximas_horas: {
    titulo: "Sem risco climático previsto para as próximas horas",
    orientacao: "O tempo está favorável para o serviço. Bom trabalho e boa segurança!",
  },
};

/** A frase da janela: a causa mais grave dá o título e a orientação; as outras entram como uma segunda dica curta. */
export function descreverJanela(horas: HoraBruta[], janela: JanelaDoClima): { nivel: NivelDeRisco; titulo: string; orientacao: string; causas: CausaDeRisco[] } {
  const porCausa = new Map<CausaDeRisco, { nivel: NivelDeRisco; horas: HoraBruta[] }>();
  for (const h of horas) {
    for (const c of causasDaHora(h)) {
      const atual = porCausa.get(c.causa);
      if (!atual) porCausa.set(c.causa, { nivel: c.nivel, horas: [h] });
      else {
        atual.horas.push(h);
        if (PESO[c.nivel] > PESO[atual.nivel]) atual.nivel = c.nivel;
      }
    }
  }
  if (porCausa.size === 0) return { nivel: "sem_risco", ...SEM_RISCO[janela], causas: [] };

  const nivel = [...porCausa.values()].reduce<NivelDeRisco>((n, c) => (PESO[c.nivel] > PESO[n] ? c.nivel : n), "sem_risco");
  // A causa que manda é a mais grave (a do nível da janela); entre as de mesmo nível, a de prioridade mais alta.
  const ordenadas = [...porCausa.entries()].sort((a, b) => PESO[b[1].nivel] - PESO[a[1].nivel] || PRIORIDADE_DE_CAUSA.indexOf(a[0]) - PRIORIDADE_DE_CAUSA.indexOf(b[0]));
  const [principal, dados] = ordenadas[0]!;
  const titulo = tituloDa(principal, dados.nivel, dados.horas);
  const dicas = [ORIENTACAO[principal][dados.nivel === "extremo" ? "extremo" : "atencao"]];
  // Uma segunda dica só quando a outra causa também pede cuidado e não repete a mesma ideia.
  const segunda = ordenadas.find(([causa]) => causa !== principal && !(principal === "chuva" && causa === "chuva_forte") && !(principal === "chuva_forte" && causa === "chuva"));
  if (segunda) dicas.push(ORIENTACAO[segunda[0]].atencao);
  return { nivel, titulo, orientacao: dicas.join(" "), causas: ordenadas.map(([causa]) => causa) };
}

// ---- Janela --------------------------------------------------------------------------------------------------------

/** A hora local (de São Paulo) de um instante. */
const formatadorDaHora = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
export const horaLocalDe = (instante: Date) => Number(formatadorDaHora.format(instante)) % 24;

/**
 * As horas que interessam: o que resta do expediente (da hora atual, nunca antes das 6h, até as 17h; passado das 17h, as próximas 4
 * horas) ou as próximas 4 horas, contando a atual.
 */
export function horasDaJanela(horas: HoraBruta[], janela: JanelaDoClima, agora: Date): HoraBruta[] {
  const atual = horaLocalDe(agora);
  const fimDasProximas = Math.min(23, atual + HORAS_A_FRENTE);
  let de = atual;
  let ate = fimDasProximas;
  if (janela === "expediente" && atual <= ULTIMA_HORA_DO_EXPEDIENTE) {
    de = Math.max(atual, PRIMEIRA_HORA_DO_EXPEDIENTE);
    ate = Math.max(ULTIMA_HORA_DO_EXPEDIENTE, de);
  }
  return horas.filter((h) => {
    const n = horaDe(h.hora);
    return n >= de && n <= ate;
  });
}

// ---- Consulta com cache --------------------------------------------------------------------------------------------

interface EntradaDoCache {
  horas: HoraBruta[];
  em: number;
}

/** O cache de cada provedor: por quadrado de 0,1° (~11 km) e por dia; os testes, que trocam o provedor, não compartilham o cache. */
const caches = new WeakMap<ClienteClima, Map<string, EntradaDoCache>>();

/** Esquece as previsões guardadas de um provedor (os testes, quando programam outras horas). */
export const limparCacheDoClima = (clima: ClienteClima) => void caches.delete(clima);

const arredondar = (n: number) => Number(n.toFixed(1));

async function horasDoDia(clima: ClienteClima, latitude: number, longitude: number, dia: string, agora: number): Promise<HoraBruta[] | null> {
  const cache = caches.get(clima) ?? new Map<string, EntradaDoCache>();
  caches.set(clima, cache);
  const chave = `${arredondar(latitude)}|${arredondar(longitude)}|${dia}`;
  const guardada = cache.get(chave);
  if (guardada && agora - guardada.em < VALIDADE_DO_CACHE_MS) return guardada.horas;
  try {
    const horas = await clima.previsaoDoDia({ latitude: arredondar(latitude), longitude: arredondar(longitude) }, dia);
    if (horas.length === 0) throw new Error("O provedor não trouxe nenhuma hora");
    cache.set(chave, { horas, em: agora });
    // O cache não cresce sem fim: só o dia de hoje interessa.
    for (const k of cache.keys()) if (!k.endsWith(`|${dia}`)) cache.delete(k);
    return horas;
  } catch (erro) {
    console.warn(`Previsão do tempo indisponível: ${erro instanceof Error ? erro.message : String(erro)}`);
    // Uma previsão antiga do mesmo dia ainda vale mais do que nenhuma.
    return guardada?.horas ?? null;
  }
}

export interface PedidoDeClima {
  latitude?: number;
  longitude?: number;
  janela: JanelaDoClima;
}

/** Sem posição do aparelho, a cidade padrão que o admin escolheu; com ela, a posição vai arredondada para o provedor. */
async function localDoPedido(deps: Deps, p: Pick<PedidoDeClima, "latitude" | "longitude">): Promise<LocalDoClima> {
  if (p.latitude !== undefined && p.longitude !== undefined) {
    return { nome: "Sua localização", latitude: arredondar(p.latitude), longitude: arredondar(p.longitude), origem: "aparelho" };
  }
  const cidade = await cidadePadrao(deps);
  return { nome: cidade.nome, latitude: arredondar(cidade.latitude), longitude: arredondar(cidade.longitude), origem: "padrao" };
}

/** `GET /clima`: a previsão da janela no ponto pedido (ou na cidade padrão). Nunca falha por causa do provedor: devolve `disponivel: false`. */
export async function previsaoDoTempo(deps: Deps, pedido: PedidoDeClima): Promise<PrevisaoDoTempo> {
  const agora = deps.agora();
  const local = await localDoPedido(deps, pedido);
  const base = { local, janela: pedido.janela, consultada_em: agora.toISOString(), fonte: FONTE } as const;
  const indisponivel: PrevisaoDoTempo = { ...base, disponivel: false, nivel: null, titulo: "Previsão do tempo indisponível", orientacao: "Não foi possível consultar a previsão agora. Observe o tempo no local antes de começar.", causas: [], horas: [] };

  const doDia = await horasDoDia(deps.clima, local.latitude, local.longitude, diaDe(agora), agora.getTime());
  if (!doDia) return indisponivel;
  const janela = horasDaJanela(doDia, pedido.janela, agora);
  if (janela.length === 0) return indisponivel;
  const frase = descreverJanela(janela, pedido.janela);
  return { ...base, disponivel: true, nivel: frase.nivel, titulo: frase.titulo, orientacao: frase.orientacao, causas: frase.causas, horas: janela.map(horaParaApi) };
}

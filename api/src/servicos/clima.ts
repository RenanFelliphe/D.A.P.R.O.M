/**
 * O provedor da previsão do tempo (`funcionalidades/previsao-do-tempo.md`). A `api` pede a previsão hora a hora de um ponto e
 * classifica o risco sozinha (`dominio/clima.ts`); quem fala com o provedor só devolve as horas, no formato abaixo.
 */

export interface HoraBruta {
  /** Hora local de São Paulo, `AAAA-MM-DDTHH:00`. */
  hora: string;
  temperatura: number;
  sensacao: number;
  chanceChuva: number;
  chuvaMm: number;
  rajadaKmh: number;
  indiceUv: number;
  /** Código WMO do tempo (0 céu limpo … 95 a 99 trovoada). */
  codigo: number;
}

export interface CidadeEncontrada {
  nome: string;
  /** O estado, para diferenciar cidades de mesmo nome ("Vitória, Espírito Santo"). */
  regiao: string | null;
  latitude: number;
  longitude: number;
}

export interface ClienteClima {
  /** As cidades brasileiras que casam com o nome (para o admin escolher a cidade padrão); lança erro quando o provedor não responde. */
  buscarCidades(nome: string): Promise<CidadeEncontrada[]>;
  /** As horas do dia de `dia` (`AAAA-MM-DD`) no ponto; lança erro quando o provedor não responde. */
  previsaoDoDia(posicao: { latitude: number; longitude: number }, dia: string): Promise<HoraBruta[]>;
}

const TEMPO_LIMITE_MS = 8_000;

const CAMPOS_HORARIOS = ["temperature_2m", "apparent_temperature", "precipitation_probability", "precipitation", "weather_code", "wind_gusts_10m", "uv_index"] as const;

/**
 * Cliente do Open-Meteo (https://open-meteo.com): sem chave, previsão hora a hora no fuso de São Paulo. O plano gratuito é só para uso
 * não comercial (serve para a demonstração; em produção comercial é preciso o plano pago, com a chave em `CLIMA_API_KEY`). O provedor
 * recebe apenas a posição arredondada que a `api` já usa para o cache, nunca a OS, a pessoa ou a equipe.
 */
export class ClienteOpenMeteo implements ClienteClima {
  constructor(
    private readonly url = "https://api.open-meteo.com/v1/forecast",
    private readonly chave = "",
    private readonly buscar: typeof fetch = fetch,
    private readonly urlDasCidades = "https://geocoding-api.open-meteo.com/v1/search",
  ) {}

  async buscarCidades(nome: string): Promise<CidadeEncontrada[]> {
    const alvo = new URL(this.urlDasCidades);
    alvo.searchParams.set("name", nome);
    alvo.searchParams.set("count", "8");
    alvo.searchParams.set("language", "pt");
    alvo.searchParams.set("countryCode", "BR");
    let resposta: Response;
    try {
      resposta = await this.buscar(alvo, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    } catch (erro) {
      throw new Error(`Busca de cidades inacessível: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
    if (!resposta.ok) throw new Error(`A busca de cidades respondeu ${resposta.status}`);
    const corpo = (await resposta.json().catch(() => null)) as { results?: { name?: string; admin1?: string; latitude?: number; longitude?: number }[] } | null;
    return (corpo?.results ?? [])
      .filter((c) => typeof c.name === "string" && typeof c.latitude === "number" && typeof c.longitude === "number")
      .map((c) => ({ nome: c.name!, regiao: c.admin1 ?? null, latitude: c.latitude!, longitude: c.longitude! }));
  }

  async previsaoDoDia(posicao: { latitude: number; longitude: number }, dia: string): Promise<HoraBruta[]> {
    const alvo = new URL(this.url);
    alvo.searchParams.set("latitude", String(posicao.latitude));
    alvo.searchParams.set("longitude", String(posicao.longitude));
    alvo.searchParams.set("hourly", CAMPOS_HORARIOS.join(","));
    alvo.searchParams.set("timezone", "America/Sao_Paulo");
    alvo.searchParams.set("start_date", dia);
    alvo.searchParams.set("end_date", dia);
    alvo.searchParams.set("wind_speed_unit", "kmh");
    if (this.chave) alvo.searchParams.set("apikey", this.chave);
    let resposta: Response;
    try {
      resposta = await this.buscar(alvo, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    } catch (erro) {
      throw new Error(`Provedor da previsão do tempo inacessível: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
    if (!resposta.ok) throw new Error(`O provedor da previsão do tempo respondeu ${resposta.status}`);
    const corpo = (await resposta.json().catch(() => null)) as { hourly?: Record<string, unknown[]> } | null;
    const h = corpo?.hourly;
    const tempos = h?.time;
    if (!h || !Array.isArray(tempos)) throw new Error("Resposta inválida do provedor da previsão do tempo");
    const numero = (campo: string, i: number) => {
      const v = h[campo]?.[i];
      return typeof v === "number" && Number.isFinite(v) ? v : 0;
    };
    return tempos.map((hora, i) => ({
      hora: String(hora),
      temperatura: numero("temperature_2m", i),
      sensacao: numero("apparent_temperature", i),
      chanceChuva: numero("precipitation_probability", i),
      chuvaMm: numero("precipitation", i),
      rajadaKmh: numero("wind_gusts_10m", i),
      indiceUv: numero("uv_index", i),
      codigo: numero("weather_code", i),
    }));
  }
}

/** Sem provedor (os testes e o modo local sem rede): nenhuma previsão, como se o provedor estivesse fora do ar. */
export class ClimaIndisponivel implements ClienteClima {
  async buscarCidades(): Promise<CidadeEncontrada[]> {
    throw new Error("A busca de cidades não está disponível");
  }
  async previsaoDoDia(): Promise<HoraBruta[]> {
    throw new Error("A previsão do tempo não está disponível");
  }
}

/** O clima de memória dos testes: devolve as horas programadas (ou falha, se `falhar`). */
export class ClimaEmMemoria implements ClienteClima {
  horas: HoraBruta[] = [];
  falhar = false;
  cidades: CidadeEncontrada[] = [];
  consultas: { latitude: number; longitude: number; dia: string }[] = [];
  async buscarCidades(nome: string): Promise<CidadeEncontrada[]> {
    if (this.falhar) throw new Error("Provedor fora do ar");
    return this.cidades.filter((c) => c.nome.toLowerCase().includes(nome.toLowerCase()));
  }
  async previsaoDoDia(posicao: { latitude: number; longitude: number }, dia: string): Promise<HoraBruta[]> {
    this.consultas.push({ ...posicao, dia });
    if (this.falhar) throw new Error("Provedor fora do ar");
    return this.horas.filter((h) => h.hora.startsWith(dia));
  }
}

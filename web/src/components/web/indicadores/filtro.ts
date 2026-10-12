import { rotuloDoMes } from "@/data/quadro";
import { ehSupervisor, type Usuario } from "@/lib/tipos";

/**
 * Filtro comum dos quatro dashboards de Indicadores e exportação, na URL: `?periodo=` (7d, 30d, 90d, 12m ou um mês
 * `AAAA-MM`; 30 dias quando não vem) e `?equipe_id=` (o supervisor não escolhe: a `api` já o limita à equipe dele).
 */
export const CHAVES_DO_FILTRO = ["periodo", "equipe_id"] as const;

export const PERIODOS_MOVEIS = [
  { valor: "7d", rotulo: "Últimos 7 dias", anterior: "7 dias anteriores" },
  { valor: "30d", rotulo: "Últimos 30 dias", anterior: "30 dias anteriores" },
  { valor: "90d", rotulo: "Últimas 13 semanas", anterior: "13 semanas anteriores" },
  { valor: "12m", rotulo: "Últimos 12 meses", anterior: "12 meses anteriores" },
] as const;

export interface FiltroDoPainel {
  /** `7d`, `30d`, `90d`, `12m` ou `AAAA-MM`. */
  periodo: string;
  equipeId?: string;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor)?.trim() || undefined;
const movel = (periodo: string) => PERIODOS_MOVEIS.find((p) => p.valor === periodo);

/** Lê o filtro da URL, descartando o que não tem a forma esperada (a `api` recusaria com 422). */
export function lerFiltroDoPainel(sp: Record<string, string | string[] | undefined>, usuario: Pick<Usuario, "perfil" | "equipes_supervisionadas">): FiltroDoPainel {
  const periodo = um(sp.periodo);
  const equipeId = um(sp.equipe_id);
  return {
    periodo: periodo && (movel(periodo) || MES.test(periodo)) ? periodo : "30d",
    equipeId: !ehSupervisor(usuario) && equipeId && UUID.test(equipeId) ? equipeId : undefined,
  };
}

/** O filtro como consulta da `api`. */
export const consultaDoFiltro = (f: FiltroDoPainel) => ({ periodo: f.periodo, equipe_id: f.equipeId });

/** "Últimos 30 dias", "outubro de 2026". */
export const rotuloDoPeriodo = (periodo: string) => movel(periodo)?.rotulo ?? rotuloDoMes(periodo);

/** O período da comparação: "30 dias anteriores", "setembro de 2026". */
export function rotuloDoAnterior(periodo: string) {
  const m = movel(periodo);
  if (m) return m.anterior;
  const [a, mes] = periodo.split("-").map(Number) as [number, number];
  return rotuloDoMes(mes === 1 ? `${a - 1}-12` : `${a}-${String(mes - 1).padStart(2, "0")}`);
}

/** Os meses do seletor: do atual (`AAAA-MM`) para trás, doze ao todo. */
export function mesesDoFiltro(mesAtual: string): { valor: string; rotulo: string }[] {
  const [a, m] = mesAtual.split("-").map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const total = a * 12 + (m - 1) - i;
    const valor = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
    return { valor, rotulo: rotuloDoMes(valor) };
  });
}

import type { Metadata } from "next";
import { AlertasScreen } from "@/components/web/alertas/AlertasScreen";
import { TIPOS_DE_ALERTA, type Alerta } from "@/components/web/alertas/tipos";
import { api, usuarioAtual } from "@/lib/api";
import { ehSupervisor, type Equipe, type Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Alertas e impedimento" };

const TAMANHO_DA_PAGINA = 30;

type Lista = { alertas: Alerta[] } & Paginacao;

export default async function AlertasPage({ searchParams }: PageProps<"/web/alertas">) {
  const consulta = await searchParams;
  const um = (chave: string) => {
    const v = consulta[chave];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const { usuario } = await usuarioAtual();
  const filtros = {
    lido: um("lido") === "nao" ? "nao" : "",
    tipo: (TIPOS_DE_ALERTA as string[]).includes(um("tipo")) ? um("tipo") : "",
    equipe_id: ehSupervisor(usuario) ? "" : um("equipe_id"),
  };
  const pagina = Math.max(1, Number.parseInt(um("pagina"), 10) || 1);
  const tamanho = TAMANHO_DA_PAGINA;
  const comuns = { equipe_id: filtros.equipe_id || undefined };

  const [lista, naoLidos, equipes] = await Promise.all([
    api<Lista>("/alertas", { consulta: { ...comuns, tipo: filtros.tipo || undefined, lido: filtros.lido === "nao" ? false : undefined, pagina, tamanho } }),
    api<{ total: number }>("/alertas", { consulta: { ...comuns, lido: false, tamanho: 1 } }),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
  ]);
  const alertas = lista.alertas;

  // O alerta aberto vem de `?alerta=<id>`; sem ele (ou fora da lista, por exemplo já lido com o filtro de não lidos), o primeiro da lista.
  const pedido = um("alerta");
  let selecionado = alertas.find((a) => a.id === pedido) ?? null;
  let alertaNaoEncontrado = false;
  if (pedido && !selecionado) {
    const todos = await api<Lista>("/alertas", { consulta: { ...comuns, tamanho: 200 } });
    selecionado = todos.alertas.find((a) => a.id === pedido) ?? null;
    alertaNaoEncontrado = selecionado === null;
  }
  if (!pedido || alertaNaoEncontrado) selecionado = alertas[0] ?? null;

  return (
    <AlertasScreen
      usuario={usuario}
      alertas={alertas}
      selecionado={selecionado}
      alertaNaoEncontrado={alertaNaoEncontrado}
      alertaPedido={pedido !== "" && !alertaNaoEncontrado}
      filtros={filtros}
      pagina={pagina}
      tamanho={tamanho}
      total={lista.total}
      naoLidos={naoLidos.total}
      equipes={equipes.equipes}
    />
  );
}

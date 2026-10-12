import type { Metadata } from "next";
import { AlertasScreen } from "@/components/web/alertas/AlertasScreen";
import { TIPOS_DE_ALERTA, type Alerta, type TipoDeAlerta } from "@/components/web/alertas/tipos";
import { api, usuarioAtual } from "@/lib/api";
import { ehSupervisor, type Equipe, type Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Alertas e impedimento" };

const TAMANHO_DA_PAGINA = 30;
/** Com o filtro de tipo (que a `api` não tem) filtra-se aqui; para não esconder alertas, lê-se o máximo que a `api` entrega. */
const TAMANHO_COM_FILTRO_DE_TIPO = 200;

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
  const comFiltroDeTipo = filtros.tipo !== "";
  const pagina = comFiltroDeTipo ? 1 : Math.max(1, Number.parseInt(um("pagina"), 10) || 1);
  const tamanho = comFiltroDeTipo ? TAMANHO_COM_FILTRO_DE_TIPO : TAMANHO_DA_PAGINA;
  const comuns = { equipe_id: filtros.equipe_id || undefined };

  const [lista, naoLidos, equipes] = await Promise.all([
    api<Lista>("/alertas", { consulta: { ...comuns, lido: filtros.lido === "nao" ? false : undefined, pagina, tamanho } }),
    api<{ total: number }>("/alertas", { consulta: { ...comuns, lido: false, tamanho: 1 } }),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
  ]);
  const alertas = comFiltroDeTipo ? lista.alertas.filter((a) => a.tipo === (filtros.tipo as TipoDeAlerta)) : lista.alertas;

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
      total={comFiltroDeTipo ? alertas.length : lista.total}
      naoLidos={naoLidos.total}
      equipes={equipes.equipes}
    />
  );
}

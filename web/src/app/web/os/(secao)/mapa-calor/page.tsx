import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MapaDeCalor, type CelulaDoMapa } from "@/components/web/os/MapaDeCalor";
import { Icon } from "@/components/ui/Icon";
import { lerFiltroDoPainel, mesesDoFiltro, PERIODOS_MOVEIS, rotuloDoPeriodo } from "@/components/web/indicadores/filtro";
import { api, usuarioAtual } from "@/lib/api";
import { dataDoDia, hoje } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, rotuloDoStatus, type OsStatus } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mapa de Calor das OS" };

const STATUS = Object.keys(rotuloDoStatus) as OsStatus[];
const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor)?.trim();

interface RespostaMapaDeCalor {
  periodo: string;
  de: string;
  ate: string;
  os_no_periodo: number;
  com_localizacao: number;
  sem_localizacao: number;
  /** Da mais movimentada para a menos. */
  celulas: CelulaDoMapa[];
}

/**
 * Aba Mapa de Calor da seção Ordem de Serviço: onde as OS do período foram executadas, pelo GPS da execução. O admin vê
 * todas as equipes; o supervisor, as que supervisiona e a própria (o mesmo escopo que a `api` aplica).
 */
export default async function MapaDeCalorPage({ searchParams }: PageProps<"/web/os/mapa-calor">) {
  const [{ usuario, equipe: minhaEquipe }, parametros] = await Promise.all([usuarioAtual(), searchParams]);
  const admin = ehAdmin(usuario);
  if (!admin && !ehSupervisor(usuario)) redirect(rotas.app.lista);

  const filtroBase = lerFiltroDoPainel(parametros, usuario);
  const supervisionadas = usuario.equipes_supervisionadas ?? [];
  const equipes: { id: string; nome: string }[] = admin
    ? (await api<{ equipes: { id: string; nome: string }[] }>("/equipes", { consulta: { tamanho: 200 } })).equipes
    : minhaEquipe && !supervisionadas.some((e) => e.id === minhaEquipe.id)
      ? [...supervisionadas, { id: minhaEquipe.id, nome: minhaEquipe.nome }]
      : supervisionadas;
  const equipePedida = primeiro(parametros.equipe_id);
  const equipeId = admin ? filtroBase.equipeId : equipes.find((e) => e.id === equipePedida)?.id;
  const statusPedido = primeiro(parametros.status);
  const status = STATUS.find((opcao) => opcao === statusPedido);
  const mapa = await api<RespostaMapaDeCalor>("/os/mapa-calor", { consulta: { periodo: filtroBase.periodo, equipe_id: equipeId, status } });
  const cobertura = mapa.os_no_periodo > 0 ? Math.round((mapa.com_localizacao / mapa.os_no_periodo) * 100) : 0;
  const meses = mesesDoFiltro(hoje().slice(0, 7));

  return (
    <div className="calor-os stack g16">
      <header className="calor-os-cabecalho">
        <div className="stack g8">
          <span className="calor-os-escopo">
            <Icon name="pin" size={13} />
            {admin ? "VISÃO DE TODAS AS EQUIPES" : "VISÃO DAS SUAS EQUIPES"}
          </span>
          <h2>Mapa de Calor</h2>
          <p>Veja onde as OS foram executadas e identifique as áreas com maior atividade.</p>
        </div>
        <span className="calor-os-status">
          <Icon name="cal" size={13} />
          {`De ${dataDoDia(mapa.de)} a ${dataDoDia(mapa.ate)}`}
        </span>
      </header>

      <form className="calor-os-filtros" action={rotas.web.mapaCalor} method="get" aria-label="Filtros do mapa de calor">
        <label className="calor-os-filtro">
          <span>Período de execução</span>
          <select className="select" name="periodo" defaultValue={filtroBase.periodo}>
            <optgroup label="Até hoje">
              {PERIODOS_MOVEIS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </optgroup>
            <optgroup label="Mês fechado">
              {meses.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {equipes.length > 1 && (
          <label className="calor-os-filtro">
            <span>Equipe</span>
            <select className="select" name="equipe_id" defaultValue={equipeId ?? ""}>
              <option value="">{admin ? "Todas as equipes" : "Todas as suas equipes"}</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="calor-os-filtro">
          <span>Situação atual da OS</span>
          <select className="select" name="status" defaultValue={status ?? ""}>
            <option value="">Todas as situações</option>
            {STATUS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {rotuloDoStatus[opcao]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-p btn-sm calor-os-aplicar" type="submit">
          <Icon name="filter" size={16} />
          Aplicar filtros
        </button>
      </form>

      <div className="calor-os-resumo" aria-label="Resumo das OS no período">
        <article className="calor-os-indicador">
          <span>OS executadas</span>
          <strong>{mapa.os_no_periodo}</strong>
          <small>{rotuloDoPeriodo(mapa.periodo)}</small>
        </article>
        <article className="calor-os-indicador">
          <span>Com localização</span>
          <strong>{mapa.com_localizacao}</strong>
          <small>Incluídas no mapa</small>
        </article>
        <article className="calor-os-indicador">
          <span>Sem localização</span>
          <strong>{mapa.sem_localizacao}</strong>
          <small>Cobertura do mapa: {cobertura}%</small>
        </article>
      </div>

      <MapaDeCalor celulas={mapa.celulas} />
    </div>
  );
}

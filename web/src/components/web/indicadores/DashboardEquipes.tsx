import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Kpi, Panel, TableWrap } from "@/components/web/Panel";
import type { DashboardEquipes as Dados } from "@/data/dashboards";
import { situacoes } from "@/data/indicadores";
import { duracao } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { rotuloDoPerfil, type Perfil } from "@/lib/tipos";
import { BarrasSituacao } from "./BarrasSituacao";
import { CabecalhoDoBloco, plural, porcentagem, Secao } from "./blocos";
import { TempoPorGrupo } from "./TempoDeExecucao";

/** "3 (1 bloqueada)" ou só o número. */
const comBloqueadas = (aprs: number, bloqueadas: number) => (bloqueadas > 0 ? `${aprs} (${plural(bloqueadas, "bloqueada", "bloqueadas")})` : String(aprs));

function SituacaoPorEquipe({ equipes }: { equipes: Dados["equipes"] }) {
  const comPreventivas = equipes
    .map((e) => ({ equipe_id: e.id, equipe_nome: e.nome, ...e.preventivas }))
    .filter((e) => e.encerradas + e.atrasadas_justificadas + e.atrasadas_sem_justificativa > 0);
  return (
    <Panel style={{ padding: 20 }}>
      <div className="row between wrap" style={{ alignItems: "baseline" }}>
        <CabecalhoDoBloco titulo="Situação das preventivas por equipe" descricao="Preventivas programadas no período, por situação" />
        <ul className="legend" aria-label="Legenda">
          {situacoes.map((s) => (
            <li key={s.chave}>
              <i style={{ background: s.cor }}></i>
              <Icon name={s.icone} size={13} style={{ color: "var(--ink3)" }} />
              {s.nome}
            </li>
          ))}
        </ul>
      </div>
      {comPreventivas.length === 0 ? (
        <p className="muted">Nenhuma preventiva encerrada ou atrasada no período.</p>
      ) : (
        <>
          <BarrasSituacao equipes={comPreventivas} />
          <details className="grafico-tabela">
            <summary>Ver os números em tabela</summary>
            <TableWrap>
              <table className="tb">
                <caption className="sr">Situação das preventivas por equipe</caption>
                <thead>
                  <tr>
                    <th>Equipe</th>
                    {situacoes.map((s) => (
                      <th key={s.chave} className="r">
                        {s.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comPreventivas.map((e) => (
                    <tr key={e.equipe_id}>
                      <th scope="row" style={{ fontWeight: 500 }}>
                        {e.equipe_nome}
                      </th>
                      {situacoes.map((s) => (
                        <td key={s.chave} className="r">
                          {e[s.chave]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </details>
        </>
      )}
    </Panel>
  );
}

function TabelaDeEquipes({ equipes, acompanha }: { equipes: Dados["equipes"]; acompanha: boolean }) {
  return (
    <Panel>
      <CabecalhoDoBloco titulo={acompanha ? "Resumo por equipe" : "Resumo da equipe"} descricao="O trabalho da equipe no período, nas OS dela" />
      {equipes.length === 0 ? (
        <p className="muted">Nenhuma equipe cadastrada.</p>
      ) : (
        <TableWrap>
          <table className="tb">
            <caption className="sr">Indicadores por equipe</caption>
            <thead>
              <tr>
                <th>Equipe</th>
                <th>Supervisor</th>
                <th className="r">Técnicos</th>
                <th className="r">Preventivas em dia</th>
                <th className="r">Atrasadas sem justificativa</th>
                <th className="r">Execuções</th>
                <th className="r">APRs</th>
                <th className="r">Interrupções</th>
              </tr>
            </thead>
            <tbody>
              {equipes.map((e) => {
                const programadas = e.preventivas.encerradas + e.preventivas.atrasadas_justificadas + e.preventivas.atrasadas_sem_justificativa;
                return (
                  <tr key={e.id}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      <Link href={rotas.app.equipe(e.id)}>{e.nome}</Link>
                    </th>
                    <td>{e.supervisor_nome ?? <span className="muted">sem supervisor</span>}</td>
                    <td className="r">{e.tecnicos}</td>
                    <td className="r">{programadas === 0 ? "—" : `${porcentagem(e.preventivas.encerradas, programadas)}% (${e.preventivas.encerradas} de ${programadas})`}</td>
                    <td className="r" style={e.preventivas.atrasadas_sem_justificativa > 0 ? { color: "var(--blq)", fontWeight: 600 } : undefined}>
                      {e.preventivas.atrasadas_sem_justificativa}
                    </td>
                    <td className="r">{e.execucoes}</td>
                    <td className="r">{comBloqueadas(e.aprs, e.aprs_bloqueadas)}</td>
                    <td className="r">{e.interrompidas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Panel>
  );
}

function TabelaDeTecnicos({ tecnicos }: { tecnicos: Dados["tecnicos"] }) {
  return (
    <Panel>
      <CabecalhoDoBloco
        titulo="Resumo por técnico"
        descricao="Os técnicos ativos das equipes e quem trabalhou nas OS delas no período; o tempo de cada um está no gráfico acima"
      />
      {tecnicos.length === 0 ? (
        <p className="muted">Nenhum técnico nas equipes da seleção.</p>
      ) : (
        <TableWrap>
          <table className="tb">
            <caption className="sr">Indicadores por técnico</caption>
            <thead>
              <tr>
                <th>Técnico</th>
                <th>Equipe</th>
                <th className="r">Execuções encerradas</th>
                <th className="r">APRs preenchidas</th>
                <th className="r">Interrupções</th>
              </tr>
            </thead>
            <tbody>
              {tecnicos.map((t) => (
                <tr key={t.id} className={t.ativo ? undefined : "off"}>
                  <th scope="row" style={{ fontWeight: 600 }}>
                    <Link href={rotas.app.perfilDe(t.id)}>{t.nome}</Link>{" "}
                    {!t.ativo && (
                      <Badge tone="neu" style={{ padding: "0 7px", fontSize: 11 }}>
                        Desativado
                      </Badge>
                    )}
                  </th>
                  <td>{t.equipe_nome ?? <span className="muted">sem equipe</span>}</td>
                  <td className="r">{t.execucoes}</td>
                  <td className="r">{comBloqueadas(t.aprs, t.aprs_bloqueadas)}</td>
                  <td className="r">{t.interrompidas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Panel>
  );
}

const ORDEM_DOS_PERFIS: Perfil[] = ["tecnico", "admin"];

/** Estado do cadastro (admin): usuários ativos por perfil e quem ainda não consegue trabalhar. */
function Cadastro({ cadastro }: { cadastro: NonNullable<Dados["cadastro"]> }) {
  const pendencias = [
    { total: cadastro.tecnicos_sem_assinatura, texto: ["técnico sem assinatura", "técnicos sem assinatura"], nota: "a APR exige a assinatura de cada participante" },
    { total: cadastro.senha_provisoria, texto: ["usuário com a senha provisória", "usuários com a senha provisória"], nota: "o primeiro acesso ainda não foi feito" },
    { total: cadastro.sem_equipe, texto: ["técnico ou supervisor sem equipe", "técnicos e supervisores sem equipe"], nota: "sem equipe, não se vê nenhuma OS" },
    { total: cadastro.equipes_sem_supervisor, texto: ["equipe sem supervisor", "equipes sem supervisor"], nota: "o representante responde por ela até o admin escolher um supervisor" },
  ];
  return (
    <Panel>
      <div className="row between wrap" style={{ alignItems: "baseline" }}>
        <CabecalhoDoBloco titulo="Cadastro" descricao={`Usuários ativos por perfil${cadastro.inativos > 0 ? ` · ${plural(cadastro.inativos, "desativado", "desativados")}` : ""}`} />
        <Link href={rotas.app.usuarios} className="small" style={{ fontWeight: 600 }}>
          Abrir Equipes e usuários
        </Link>
      </div>
      <div className="perfis-cadastro">
        {ORDEM_DOS_PERFIS.map((p) => (
          <span key={p}>
            <b>{cadastro.ativos_por_perfil[p]}</b>
            {rotuloDoPerfil[p]}
          </span>
        ))}
      </div>
      <ul className="atencao">
        {pendencias.map((p) => (
          <li key={p.texto[1]} data-zerado={p.total === 0 || undefined}>
            <Icon name={p.total === 0 ? "check" : "alert"} size={16} />
            <span className="grow">
              <strong>{p.total}</strong> {p.total === 1 ? p.texto[0] : p.texto[1]} <span className="small">· {p.nota}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Dashboard de equipes e usuários: o resumo, as equipes (a situação das preventivas e o tempo de execução lado a lado, e a
 * tabela de cada uma), os técnicos (o tempo de cada um e a tabela) e, para o admin, o estado do cadastro. O técnico que não
 * supervisiona vê só a equipe como um todo ("Minha equipe"): nada por pessoa, que seria o desempenho de um colega.
 */
export function DashboardEquipes({ dados, acompanha }: { dados: Dados; acompanha: boolean }) {
  const { totais, tempo } = dados;
  const semSupervisor = dados.equipes.filter((e) => !e.supervisor_nome).length;
  return (
    <>
      <Secao id="equipes-totais-t" titulo="Resumo" descricao="Equipes e técnicos da seleção, com o trabalho do período.">
        <div className="kpis k4">
          <Kpi
            label="Equipes"
            marker={<Icon name="users" size={13} style={{ color: "var(--ink3)" }} />}
            value={totais.equipes}
            sub={semSupervisor > 0 ? plural(semSupervisor, "sem supervisor", "sem supervisor") : "todas com supervisor"}
            subStyle={semSupervisor > 0 ? { color: "var(--al)", fontWeight: 500 } : undefined}
          />
          <Kpi
            label="Técnicos ativos"
            marker={<Icon name="user" size={13} style={{ color: "var(--ink3)" }} />}
            value={totais.tecnicos_ativos}
            sub={totais.tecnicos_com_execucao === null ? "na equipe" : `${totais.tecnicos_com_execucao} com execução encerrada no período`}
          />
          <Kpi label="Execuções encerradas" marker={<Icon name="check" size={13} style={{ color: "var(--ink3)" }} />} value={totais.execucoes} sub="iniciadas no período" />
          <Kpi
            label="Tempo líquido médio"
            marker={<Icon name="clock" size={13} style={{ color: "var(--ink3)" }} />}
            value={totais.tempo_liquido_medio_min === null ? "—" : duracao(totais.tempo_liquido_medio_min)}
            sub={tempo.execucoes === 0 ? "sem contar as pausas" : `sem contar as pausas · ${duracao(tempo.tempo_total_medio_min)} do início ao fim`}
          />
        </div>
      </Secao>

      <Secao
        id="equipes-equipes-t"
        titulo={acompanha ? "Equipes" : "Minha equipe"}
        descricao="As preventivas programadas e o tempo das execuções encerradas no período, por equipe."
      >
        <div className="two eq" style={{ alignItems: "stretch" }}>
          <SituacaoPorEquipe equipes={dados.equipes} />
          <TempoPorGrupo
            titulo={acompanha ? "Tempo por equipe" : "Tempo da equipe"}
            descricao="Tempo médio por execução, nas OS de cada equipe; o líquido não conta as pausas"
            coluna="Equipe"
            linhas={dados.equipes.map((e) => ({ ...e, href: rotas.app.equipe(e.id) }))}
          />
        </div>
        <TabelaDeEquipes equipes={dados.equipes} acompanha={acompanha} />
      </Secao>

      {acompanha && (
        <Secao id="equipes-tecnicos-t" titulo="Técnicos" descricao="O tempo das execuções que cada técnico encerrou e o trabalho dele no período.">
          <TempoPorGrupo
            titulo="Tempo por técnico"
            descricao="Tempo médio das execuções que cada técnico encerrou"
            coluna="Técnico"
            linhas={dados.tecnicos.map((t) => ({ ...t, href: rotas.app.perfilDe(t.id), detalhe: t.equipe_nome }))}
          />
          <TabelaDeTecnicos tecnicos={dados.tecnicos} />
        </Secao>
      )}

      {dados.cadastro && <Cadastro cadastro={dados.cadastro} />}
    </>
  );
}

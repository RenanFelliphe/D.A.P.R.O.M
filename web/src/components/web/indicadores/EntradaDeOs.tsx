import { Icon, type IconName } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";
import { origensDeEntrada, type ResumoDasImportacoes } from "@/components/web/importacao/tipos";
import { plural, porcentagem, Secao } from "@/components/web/indicadores/blocos";
import { GraficoColunas, type PontoDoGrafico } from "./GraficoColunas";

/**
 * Cores de estado, sempre com ícone e rótulo ao lado. A falha é o ponto (vermelho); a leitura sem falha é contexto (cinza):
 * verde e vermelho lado a lado ficam indistinguíveis na deuteranopia (ΔE 4 no script de paleta), o cinza fica em 13.
 */
const SEM_FALHA = "#8A949F";
const COM_FALHA = "#D03B3B";

const nomeDaUnidade = { dia: "dia", semana: "semana", mes: "mês" } as const;

/** Quantas OS cada método de entrada registrou no período, com a fatia de cada um e o volume por trás. */
function ContadoresDeMetodo({ resumo }: { resumo: ResumoDasImportacoes }) {
  const { api, planilha, digitalizacao } = resumo.por_origem;
  const total = resumo.totais.criadas;
  const metodos: { tom: string; icone: IconName; nome: string; cor: string; criadas: number; detalhe: string }[] = [
    {
      tom: "t-api",
      icone: "refresh",
      ...origensDeEntrada.api,
      criadas: api.criadas,
      detalhe: `${plural(api.leituras, "leitura", "leituras")}${api.leituras_com_erro > 0 ? ` (${api.leituras_com_erro} com falha)` : ""} · ${plural(api.atualizadas, "OS atualizada", "OS atualizadas")}`,
    },
    {
      tom: "t-arq",
      icone: "upload",
      ...origensDeEntrada.planilha,
      criadas: planilha.criadas,
      detalhe: `${plural(planilha.arquivos, "arquivo", "arquivos")}${planilha.arquivos_com_erro > 0 ? ` (${planilha.arquivos_com_erro} com falha)` : ""} · ${plural(planilha.atualizadas, "OS atualizada", "OS atualizadas")}`,
    },
    {
      tom: "t-cam",
      icone: "camera",
      ...origensDeEntrada.digitalizacao,
      criadas: digitalizacao.criadas,
      detalhe:
        digitalizacao.arquivos === 0
          ? "Nenhuma digitalização no período"
          : `${plural(digitalizacao.arquivos, "PDF digitalizado", "PDFs digitalizados")} · ${plural(digitalizacao.atualizadas, "OS encerrada pela folha", "OS encerradas pela folha")}`,
    },
  ];
  return (
    <div className="metodos">
      {metodos.map((m) => (
        <div key={m.tom} className={`metodo ${m.tom}`}>
          <div className="row g8">
            <span className="entrada-ic" aria-hidden="true">
              <Icon name={m.icone} size={18} />
            </span>
            <strong style={{ fontSize: 14 }}>{m.nome}</strong>
          </div>
          <div className="row g6 wrap" style={{ alignItems: "baseline" }}>
            <span className="metodo-v">{m.criadas}</span>
            <span className="small">
              {m.criadas === 1 ? "OS registrada" : "OS registradas"} · {porcentagem(m.criadas, total)}% do total
            </span>
          </div>
          <div className="trilho" aria-hidden="true">
            <i style={{ width: `${porcentagem(m.criadas, total)}%`, background: m.cor }}></i>
          </div>
          <span className="small">{m.detalhe}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Entrada de OS, no dashboard de OS: as OS registradas por cada método de origem, com o volume por trás de cada um, e dois
 * gráficos lado a lado (OS registradas por faixa e saúde da sincronização). O período é o do filtro comum; a equipe não se
 * aplica (uma leitura ou um arquivo, planilha ou PDF, traz OS de todas as equipes).
 */
export function EntradaDeOs({ resumo }: { resumo: ResumoDasImportacoes }) {
  const unidade = nomeDaUnidade[resumo.agrupamento];
  const { leituras, leituras_com_erro: comErro } = resumo.por_origem.api;

  const registradas: PontoDoGrafico[] = resumo.serie.map((p) => ({ inicio: p.inicio, fim: p.fim, valores: { api: p.api, planilha: p.planilha, digitalizacao: p.digitalizacao } }));
  const sincronizacoes: PontoDoGrafico[] = resumo.serie.map((p) => ({ inicio: p.inicio, fim: p.fim, valores: { ok: p.leituras - p.falhas, falhas: p.falhas } }));

  return (
    <Secao id="metodos-t" titulo="Entrada de OS" descricao="OS registradas no período por cada forma de entrada, de todas as equipes, no fuso de São Paulo.">
      <ContadoresDeMetodo resumo={resumo} />
      <div className="two eq" style={{ alignItems: "stretch" }}>
        <Panel>
          <div className="stack" style={{ gap: 2 }}>
            <h2>OS registradas por {unidade}</h2>
            <span className="muted">OS novas que entraram no sistema, pela data da sincronização ou da importação</span>
          </div>
          <GraficoColunas
            pontos={registradas}
            series={[
              { chave: "api", ...origensDeEntrada.api },
              { chave: "planilha", ...origensDeEntrada.planilha },
              { chave: "digitalizacao", ...origensDeEntrada.digitalizacao },
            ]}
            agrupamento={resumo.agrupamento}
            medida="OS registradas"
            vazio="Nenhuma OS registrada neste período."
          />
        </Panel>
        <Panel>
          <div className="stack" style={{ gap: 2 }}>
            <h2>Saúde da sincronização</h2>
            <span className="muted">
              {leituras === 0 ? "Leituras da API" : `${plural(leituras, "leitura", "leituras")} da API, ${porcentagem(leituras - comErro, leituras)}% sem falha`}
            </span>
          </div>
          <GraficoColunas
            pontos={sincronizacoes}
            series={[
              { chave: "ok", nome: "Sem falha", cor: SEM_FALHA, icone: "check" },
              { chave: "falhas", nome: "Com falha", cor: COM_FALHA, icone: "alert" },
            ]}
            agrupamento={resumo.agrupamento}
            medida="leituras"
            vazio="Nenhuma leitura da API neste período."
          />
        </Panel>
      </div>
    </Secao>
  );
}

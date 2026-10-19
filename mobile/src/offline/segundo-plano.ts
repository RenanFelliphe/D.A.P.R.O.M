import type { Banco, Consulta } from "./banco";
import { gravarMeta, lerMeta } from "./copia";
import { contarPendentes } from "./fila";
import { lerEu } from "./identidade";
import type { PessoaLogada } from "./leitura";
import type { ResultadoDaSincronizacao } from "./sincronizar";

/**
 * O envio com o app fechado (item 18 da Reunião 3). O Android acorda o app de tempos em tempos (a cada 15 minutos, no mínimo, e quando
 * a rede está ligada) e roda uma tarefa sem nenhuma tela: aqui está o que ela faz, sem depender do React Native, para os testes
 * rodarem num SQLite de verdade. Quem junta as peças do aparelho é `segundo-plano-nativo.ts`.
 *
 * O que ela precisa saber vem do aparelho, não da memória do app (que, com o app fechado, nasceu agora): se há sessão (os tokens no
 * `expo-secure-store`) e quem é a pessoa (o último `GET /me` que o servidor respondeu, guardado no SQLite). Sem as duas coisas, não envia.
 */

export interface DependenciasDoSegundoPlano {
  banco: Banco;
  /** O app está na frente? Então a `SincronizacaoProvider` cuida da fila, e a tarefa não concorre com ela. */
  appNaFrente(): boolean;
  /** Há sessão no aparelho (tokens guardados)? Quem entrou sem sinal, pela senha guardada, ou já saiu, não tem. */
  temSessao(): Promise<boolean>;
  /** Quem o app já sabe que está logado (quando o app estava vivo e a tarefa roda no mesmo processo), ou `null`. */
  pessoaDoApp(): PessoaLogada | null;
  /** Diz ao app quem é a pessoa da fila (o sincronizador e a leitura local dependem disso). */
  definirPessoa(pessoa: PessoaLogada): void;
  /** Sobe a fila e baixa a cópia nova (`Sincronizador.sincronizar`). */
  sincronizar(): Promise<ResultadoDaSincronizacao>;
}

/** O que a tarefa fez na passada. `ok` diz se o Android deve tratá-la como bem-sucedida. */
export type DesfechoDoSegundoPlano =
  | { situacao: "app-na-frente" | "sem-sessao" | "sem-pessoa" | "nao-se-aplica" | "nada-a-enviar"; ok: true }
  | { situacao: "enviou"; ok: true; confirmados: number; recusados: number }
  /** Tentou e a fila continua com registro esperando (sem sinal, servidor fora do ar ou algo que a pessoa precisa resolver). */
  | { situacao: "ainda-pendente"; ok: false; confirmados: number; restantes: number; motivo: string };

/** Quem tem fila e cópia: o técnico de uma equipe. É a mesma regra que a `SincronizacaoProvider` usa na tela. */
const temFila = (eu: { usuario: { perfil: string }; equipe?: unknown }): boolean => eu.usuario.perfil === "tecnico" && Boolean(eu.equipe);

export async function enviarEmSegundoPlano(d: DependenciasDoSegundoPlano): Promise<DesfechoDoSegundoPlano> {
  if (d.appNaFrente()) return { situacao: "app-na-frente", ok: true };
  if (!(await d.temSessao())) return { situacao: "sem-sessao", ok: true };

  let pessoa = d.pessoaDoApp();
  if (!pessoa) {
    // O app abriu agora, só para a tarefa: a pessoa é a última que o servidor confirmou neste aparelho (a dona dos tokens guardados).
    const guardado = await lerEu(d.banco, null);
    if (!guardado) return { situacao: "sem-pessoa", ok: true };
    if (!temFila(guardado.eu)) return { situacao: "nao-se-aplica", ok: true };
    const u = guardado.eu.usuario;
    pessoa = { id: u.id, nome: u.nome, matricula: u.matricula };
    d.definirPessoa(pessoa);
  }

  const { eventos, arquivos } = await contarPendentes(d.banco, pessoa.id);
  if (eventos + arquivos === 0) return { situacao: "nada-a-enviar", ok: true };

  const r = await d.sincronizar();
  if (r.restantes > 0 || r.semSinal || r.erro) {
    return { situacao: "ainda-pendente", ok: false, confirmados: r.confirmados, restantes: r.restantes, motivo: r.erro ?? (r.semSinal ? "sem sinal" : "registros adiados pelo servidor") };
  }
  return { situacao: "enviou", ok: true, confirmados: r.confirmados, recusados: r.recusados };
}

// --- o registro da última passada, para a pessoa (e quem testa) ver que a tarefa rodou -------------------------------------------

const CHAVE_ULTIMA = "segundo_plano_ultima";

/** O que o perfil mostra: quando a tarefa com o app fechado enviou algo (ou tentou) e o que sobrou. */
export interface UltimaPassadaEmSegundoPlano {
  em: string;
  confirmados: number;
  restantes: number;
}

/** Só as passadas que mexeram na fila ficam registradas; as que não tinham nada a fazer não escondem a última que importou. */
export async function registrarPassadaEmSegundoPlano(c: Consulta, desfecho: DesfechoDoSegundoPlano, agora: Date): Promise<void> {
  if (desfecho.situacao !== "enviou" && desfecho.situacao !== "ainda-pendente") return;
  const registro: UltimaPassadaEmSegundoPlano = {
    em: agora.toISOString(),
    confirmados: desfecho.confirmados,
    restantes: desfecho.situacao === "ainda-pendente" ? desfecho.restantes : 0,
  };
  await gravarMeta(c, CHAVE_ULTIMA, JSON.stringify(registro));
}

export async function ultimaPassadaEmSegundoPlano(c: Consulta): Promise<UltimaPassadaEmSegundoPlano | null> {
  const texto = await lerMeta(c, CHAVE_ULTIMA);
  if (!texto) return null;
  try {
    const r = JSON.parse(texto) as Partial<UltimaPassadaEmSegundoPlano>;
    return typeof r.em === "string" ? { em: r.em, confirmados: Number(r.confirmados) || 0, restantes: Number(r.restantes) || 0 } : null;
  } catch {
    return null;
  }
}

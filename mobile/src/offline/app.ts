import type { RespostaEventos } from "@shared/api/eventos";
import type { RespostaMe } from "@shared/api/tipos";
import { cliente, modoLocalAtivo, revogarSessaoLocal, subirArquivoSemFila } from "../api/api";
import { ErroDeRede } from "../api/erros";
import { apagarCopiaDaFila, guardarCopiaDoArquivo } from "./arquivos-nativos";
import { bancoDoAparelho } from "./banco-nativo";
import { lerOs, situacaoDaCopia } from "./copia";
import { criarEnvioComFila } from "./envio";
import { mudarEstado } from "./estado";
import { contarPendentes, eventosRecusados } from "./fila";
import { definirUltimoUsuario, esquecerEu, guardarEu, lerEu } from "./identidade";
import { criarLeitura, type PessoaLogada } from "./leitura";
import { ultimaPassadaEmSegundoPlano } from "./segundo-plano";
import { criarSincronizador, type Conexao } from "./sincronizar";
import type { SnapshotDaApi } from "./tipos";

/**
 * A ligação do modo offline com o aparelho: o banco do `expo-sqlite`, o cliente da `api`, o estado da conexão e quem está logado. É
 * aqui que nascem o sincronizador, a escrita com fila e a leitura local que o resto do app usa. A parte testável mora nos outros
 * arquivos desta pasta; este só junta as peças do React Native.
 */

let conexaoAtual: Conexao = "online";
let pessoaLogada: PessoaLogada | null = null;

/** O NetInfo avisa a mudança de conexão (ver `SincronizacaoProvider`). */
export function definirConexao(c: Conexao): void {
  conexaoAtual = c;
}
/** Quem entrou sem sinal, pela senha guardada, ainda não tem sessão no servidor: para o app inteiro, é como estar sem conexão. */
export const conexaoDoAparelho = (): Conexao => (modoLocalAtivo() ? "offline" : conexaoAtual);

/** Quem está logado agora: a fila e a cópia são dessa pessoa. */
export function definirPessoaLogada(p: PessoaLogada | null): void {
  pessoaLogada = p;
}

/** Quem o app sabe que está logado, ou `null` (a tarefa em segundo plano pergunta antes de buscar a pessoa no banco). */
export const pessoaDoApp = (): PessoaLogada | null => pessoaLogada;

/** Relê o contador de pendentes e a data da cópia e os entrega às telas. */
export async function atualizarEstadoDaFila(): Promise<void> {
  const id = pessoaLogada?.id;
  if (!id) {
    mudarEstado({ pendentes: 0, recusados: 0, copiaEm: null, segundoPlanoEm: null, segundoPlanoEnviados: 0 });
    return;
  }
  try {
    const [contagem, recusados, copia, segundoPlano] = await Promise.all([
      contarPendentes(bancoDoAparelho, id),
      eventosRecusados(bancoDoAparelho, id),
      situacaoDaCopia(bancoDoAparelho),
      ultimaPassadaEmSegundoPlano(bancoDoAparelho),
    ]);
    mudarEstado({
      pendentes: contagem.eventos + contagem.arquivos,
      recusados: recusados.length,
      copiaEm: copia?.usuarioId === id ? copia.baixadaEm : null,
      segundoPlanoEm: segundoPlano?.em ?? null,
      segundoPlanoEnviados: segundoPlano?.confirmados ?? 0,
    });
  } catch {
    /* o banco ainda não abriu: o contador espera a próxima mudança */
  }
}

export const leitura = criarLeitura(bancoDoAparelho, () => pessoaLogada);

export const sincronizador = criarSincronizador({
  banco: bancoDoAparelho,
  usuarioId: () => pessoaLogada?.id ?? null,
  enviarEvento: (evento) => cliente.chamar<RespostaEventos & { acesso_revogado?: boolean }>("/eventos", { corpo: { eventos: [evento] } }),
  subirArquivo: (a) => subirArquivoSemFila({ uri: a.uri, nome: a.nome, tipoMime: a.tipoMime }, a.tipo, a.id).then(() => undefined),
  baixarSnapshot: () => cliente.chamar<SnapshotDaApi>("/sync/pull", { metodo: "POST", corpo: {} }),
  apagarArquivoLocal: apagarCopiaDaFila,
  conexao: conexaoDoAparelho,
  agora: () => new Date(),
  aoMudar: () => void atualizarEstadoDaFila(),
  aoAcessoRevogado: () => void revogarSessaoLocal(),
});

const envio = criarEnvioComFila({
  banco: bancoDoAparelho,
  sincronizador,
  usuarioId: () => pessoaLogada?.id ?? null,
  conexao: conexaoDoAparelho,
  agora: () => new Date(),
  subirAgora: (arquivo, tipo, id) => subirArquivoSemFila(arquivo, tipo, id),
  guardarCopiaDoArquivo,
  apagarArquivoLocal: apagarCopiaDaFila,
  aoMudar: () => void atualizarEstadoDaFila(),
});

/** Toda escrita de campo do app passa por aqui (a fila grava antes de enviar). */
export const { enviarEvento, enviarArquivo, descartarArquivo } = envio;

/** Os registros que a `api` recusou de vez, do mais novo ao mais antigo, com o número da OS (da cópia local) para a pessoa se localizar. */
export async function listarRecusados() {
  if (!pessoaLogada) return [];
  const itens = await eventosRecusados(bancoDoAparelho, pessoaLogada.id);
  return Promise.all(itens.map(async (e) => ({ ...e, numeroOrdem: e.osId ? ((await lerOs(bancoDoAparelho, e.osId))?.numero_ordem ?? null) : null })));
}

/** A fila de quem está logado tem algo esperando? Então o servidor não sabe de tudo, e as telas leem da cópia local. */
async function haPendencia(): Promise<boolean> {
  return (await pendentesDaPessoa()) > 0;
}

/** Quantos registros (eventos e arquivos) de quem está logado ainda esperam para subir. É o que impede o Sair. */
export async function pendentesDaPessoa(): Promise<number> {
  if (!pessoaLogada) return 0;
  const { eventos, arquivos } = await contarPendentes(bancoDoAparelho, pessoaLogada.id);
  return eventos + arquivos;
}

// --- quem é a pessoa, para abrir o app sem sinal (ver `sessao/eu.ts`) ------------------------------------------------------
export const guardarIdentidade = (eu: RespostaMe) => guardarEu(bancoDoAparelho, eu, new Date());
export const lerIdentidade = (usuarioId: string | null) => lerEu(bancoDoAparelho, usuarioId);
export const definirUltimaPessoa = (usuarioId: string) => definirUltimoUsuario(bancoDoAparelho, usuarioId);
export const esquecerIdentidade = (usuarioId: string) => esquecerEu(bancoDoAparelho, usuarioId);

/**
 * Lê do servidor, mas da cópia local quando não há sinal ou quando ainda há registro esperando na fila (o servidor não sabe dele, então
 * a tela leria o estado de antes). Se o servidor não responder no meio da leitura, cai para a cópia também.
 */
export async function lerDeOndeDer<T>(remoto: () => Promise<T>, local: () => Promise<T>): Promise<T> {
  if (pessoaLogada && (conexaoDoAparelho() === "offline" || (await haPendencia()))) return local();
  try {
    return await remoto();
  } catch (e) {
    if (e instanceof ErroDeRede && pessoaLogada) return local();
    throw e;
  }
}

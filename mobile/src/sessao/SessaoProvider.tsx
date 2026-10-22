import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RespostaMe } from "@shared/api/tipos";
import { aoSessaoEncerrada, cliente, definirModoLocal, modoLocalAtivo } from "@/api/api";
import { encerraASessao, ErroDaApi, ErroDeConexaoNecessaria, ErroDeRede, mensagemDoErro } from "@/api/erros";
import { useConexao } from "@/estado/conexao";
import { removerAparelho } from "@/notificacoes/aparelho";
import { conexaoDoAparelho, definirUltimaPessoa, esquecerIdentidade, guardarIdentidade, lerIdentidade, pendentesDaPessoa } from "@/offline/app";
import { credenciais } from "./credenciais-do-app";
import { mensagemDaEntradaSemSinal } from "./credenciais";
import { destinoDaConta, type Destino } from "./destino";
import { criarCarregadorDoEu, mensagemCopiaVencida, mensagemSemCopia } from "./eu";
import { dentroDaJanela } from "./janela";
import { mensagemDeSairComFila } from "./sair";

type Fase = "carregando" | "sem-sessao" | "ativa";

interface Sessao {
  fase: Fase;
  /** O motivo de a pessoa ter voltado para a entrada (sessão que terminou, acesso recusado), mostrado na tela de entrada. */
  aviso: string | null;
  /** `GET /me`: quem está logado e em que situação. Sem sinal, o último que o servidor respondeu (menos de 7 dias). */
  eu: RespostaMe | undefined;
  /** O `GET /me` ainda não respondeu (primeira vez) ou falhou sem resposta (sem sinal): a casca mostra "tentar de novo". */
  carregandoEu: boolean;
  erroEu: unknown;
  destino: Destino | undefined;
  /** Entrou sem sinal, pela senha guardada no aparelho: ainda não há sessão no servidor (ela se abre sozinha quando o sinal volta). */
  entrouSemSinal: boolean;
  entrar(email: string, senha: string): Promise<void>;
  /** Sai da conta. Devolve `null` se saiu, ou o motivo de não ter saído (ainda há registro de campo esperando para subir). */
  sair(): Promise<string | null>;
  recarregarEu(): Promise<unknown>;
  /** A senha mudou aqui no app: o login sem sinal passa a valer com a senha nova. Nunca falha. */
  lembrarSenha(senha: string): Promise<void>;
}

const Contexto = createContext<Sessao | null>(null);

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao fora da SessaoProvider");
  return s;
}

const carregarEu = criarCarregadorDoEu({
  modoLocal: modoLocalAtivo,
  semConexao: () => conexaoDoAparelho() === "offline",
  buscar: (opcoes) => cliente.chamar<RespostaMe>("/me", opcoes),
  lerGuardado: () => lerIdentidade(null),
  guardar: async (eu) => {
    await guardarIdentidade(eu);
    await credenciais.confirmar(eu.usuario.id);
  },
  agora: () => new Date(),
});

/** A conta guardada (senha, `GET /me`) deixa de valer: o servidor a recusou, e sem sinal ela não entraria mais. A fila não é tocada. */
async function esquecerConta(conhecida: string | null): Promise<void> {
  const usuarioId = conhecida ?? (await lerIdentidade(null).catch(() => null))?.eu.usuario.id;
  if (!usuarioId) return;
  await Promise.allSettled([credenciais.esquecer(usuarioId), esquecerIdentidade(usuarioId)]);
}

const INTERVALO_DA_NOVA_TENTATIVA_MS = 30_000;

/**
 * A sessão do app: lê os tokens do aparelho ao abrir (a sessão continua aberta ao fechar e reabrir), faz o login e a saída, e
 * mantém `GET /me`, que decide o destino da conta (trocar senha, aguardar liberação, cadastrar assinatura, lista de OS).
 *
 * **Sem sinal** (pendência 5): com a sessão já aberta, o app abre pelo último `GET /me` guardado; sem sessão (depois do Sair), o login
 * confere a senha com o hash guardado no último login com sinal. Em ambos vale a janela de 7 dias desde a última confirmação do
 * servidor. Quem entrou só pela senha guardada não tem token: trabalha pela cópia local e, quando o sinal volta, o app refaz o login
 * sozinho com a senha que a pessoa acabou de digitar (guardada só na memória) e a fila sobe.
 */
export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const consultas = useQueryClient();
  const online = useConexao() === "online";
  const [fase, setFase] = useState<Fase>("carregando");
  const [aviso, setAviso] = useState<string | null>(null);
  const [entrouSemSinal, setEntrouSemSinal] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  /** E-mail e senha de quem entrou sem sinal, só na memória, para refazer o login com sinal. */
  const loginPendente = useRef<{ email: string; senha: string } | null>(null);
  /** De quem é o `GET /me` carregado, para esquecer a conta se o servidor a recusar. */
  const ultimaPessoa = useRef<string | null>(null);

  const voltarParaEntrada = useCallback(
    (motivo: string | null) => {
      consultas.clear();
      loginPendente.current = null;
      definirModoLocal(false);
      setEntrouSemSinal(false);
      setAviso(motivo);
      setFase("sem-sessao");
    },
    [consultas],
  );

  /** O servidor recusou a sessão: a pessoa volta para a entrada e a conta guardada (senha, `GET /me`) deixa de valer. */
  const sessaoRecusada = useCallback(
    (motivo: string) => {
      void esquecerConta(ultimaPessoa.current);
      voltarParaEntrada(motivo);
    },
    [voltarParaEntrada],
  );

  useEffect(() => {
    let ativo = true;
    cliente.temSessao().then((tem) => ativo && setFase(tem ? "ativa" : "sem-sessao"));
    return () => {
      ativo = false;
    };
  }, []);

  // A renovação da sessão foi recusada (outro aparelho entrou, o admin redefiniu a senha, a conta foi desativada).
  useEffect(() => aoSessaoEncerrada(() => sessaoRecusada(mensagemDoErro(new ErroDaApi(401, "nao_autenticado", "")))), [sessaoRecusada]);

  const consultaEu = useQuery({
    queryKey: ["eu"],
    queryFn: async () => {
      const r = await carregarEu();
      ultimaPessoa.current = r.eu.usuario.id;
      return r;
    },
    enabled: fase === "ativa",
  });
  const eu = consultaEu.data?.eu;

  // Conta desativada ou cadastro recusado: nada de campo para fazer, e a sessão não renova mais.
  useEffect(() => {
    if (consultaEu.error && encerraASessao(consultaEu.error)) {
      const motivo = mensagemDoErro(consultaEu.error);
      void cliente.sair().then(() => sessaoRecusada(motivo));
    } else if (eu?.usuario.liberacao === "recusado") {
      const recusa = eu.usuario.recusa_motivo;
      void cliente.sair().then(() => sessaoRecusada(recusa ? `Seu cadastro foi recusado: ${recusa}` : "Seu cadastro foi recusado. Procure o seu supervisor."));
    }
  }, [consultaEu.error, eu, sessaoRecusada]);

  // O app abriu pela cópia do aparelho (sem sinal) e o sinal voltou: pergunta de novo ao servidor.
  const euDoAparelho = consultaEu.data?.doAparelho ?? false;
  useEffect(() => {
    if (online && fase === "ativa" && !entrouSemSinal && euDoAparelho) void consultaEu.refetch();
  }, [online, fase, entrouSemSinal, euDoAparelho]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entrou sem sinal e o sinal voltou: refaz o login com a senha digitada (que só existe na memória) para abrir a sessão no servidor.
  useEffect(() => {
    if (!entrouSemSinal || !online || !loginPendente.current) return;
    const { email, senha } = loginPendente.current;
    let ativo = true;
    cliente
      .entrar(email, senha)
      .then(async (r) => {
        if (!ativo) return;
        loginPendente.current = null;
        definirModoLocal(false);
        setEntrouSemSinal(false);
        if (!r.senhaProvisoria) void credenciais.guardar({ usuarioId: String(r.usuario.id), email, senha }).catch(() => undefined);
        // Agora há sessão: as telas, que liam da cópia local, voltam a ler do servidor, e a fila sobe.
        await consultas.invalidateQueries();
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        if (e instanceof ErroDaApi && e.status < 500) {
          // A `api` não aceita mais esta conta ou esta senha (trocada na web, conta desativada): entra de novo com a senha certa. A fila fica.
          sessaoRecusada(e.codigo === "senha_incorreta" ? "A sua senha foi trocada. Entre de novo com a senha nova para enviar o que ficou guardado." : mensagemDoErro(e));
        } else {
          // Sem sinal de verdade (a rede disse que voltou, mas o servidor não respondeu): tenta de novo daqui a pouco.
          setTimeout(() => ativo && setTentativa((n) => n + 1), INTERVALO_DA_NOVA_TENTATIVA_MS);
        }
      });
    return () => {
      ativo = false;
    };
  }, [entrouSemSinal, online, tentativa, consultas, sessaoRecusada]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      try {
        // O aparelho já sabe que está sem sinal: não espera o tempo limite do servidor para conferir a senha guardada.
        if (conexaoDoAparelho() === "offline") throw new ErroDeRede();
        const r = await cliente.entrar(email, senha);
        // O hash da senha vai para o armazenamento seguro sem segurar a entrada (a conta leva um instante). Senha provisória não vale sem sinal.
        if (!r.senhaProvisoria) void credenciais.guardar({ usuarioId: String(r.usuario.id), email, senha }).catch(() => undefined);
        consultas.clear();
        loginPendente.current = null;
        definirModoLocal(false);
        setEntrouSemSinal(false);
        setAviso(null);
        setFase("ativa");
      } catch (e) {
        if (!(e instanceof ErroDeRede)) throw e;
        // Sem sinal: a senha é conferida com o hash do último login com sinal neste aparelho.
        const v = await credenciais.verificar(email, senha);
        if (!v.ok) throw new Error(mensagemDaEntradaSemSinal(v.motivo));
        const guardado = await lerIdentidade(v.registro.usuarioId).catch(() => null);
        if (!guardado) throw new ErroDeConexaoNecessaria(mensagemSemCopia);
        if (!dentroDaJanela(guardado.confirmadoEm, new Date())) throw new ErroDeConexaoNecessaria(mensagemCopiaVencida);
        await definirUltimaPessoa(v.registro.usuarioId);
        consultas.clear();
        loginPendente.current = { email: email.trim().toLowerCase(), senha };
        definirModoLocal(true);
        setEntrouSemSinal(true);
        setAviso(null);
        setFase("ativa");
      }
    },
    [consultas],
  );

  const sair = useCallback(async () => {
    const pendentes = await pendentesDaPessoa().catch(() => 0);
    if (pendentes > 0) return mensagemDeSairComFila(pendentes);
    // O aparelho deixa de receber as notificações desta conta antes de a sessão acabar (sem sessão não há como pedir).
    await removerAparelho();
    await cliente.sair();
    voltarParaEntrada(null);
    return null;
  }, [voltarParaEntrada]);

  const lembrarSenha = useCallback(
    async (senha: string) => {
      const usuario = consultaEu.data?.eu.usuario;
      if (!usuario?.email) return;
      await credenciais.guardar({ usuarioId: usuario.id, email: usuario.email, senha }).catch(() => undefined);
    },
    [consultaEu.data],
  );

  const valor = useMemo<Sessao>(
    () => ({
      fase,
      aviso,
      eu,
      carregandoEu: fase === "ativa" && !eu && !consultaEu.error,
      erroEu: eu ? null : consultaEu.error,
      destino: eu ? destinoDaConta(eu) : undefined,
      entrouSemSinal,
      entrar,
      sair,
      recarregarEu: () => consultaEu.refetch(),
      lembrarSenha,
    }),
    [fase, aviso, eu, consultaEu, entrouSemSinal, entrar, sair, lembrarSenha],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

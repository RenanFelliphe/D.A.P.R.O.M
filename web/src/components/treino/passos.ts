import { rotas } from "@/lib/rotas";
import { MODELO_BLOQUEIO, MODELO_GUIADO, OS_BLOQUEIO, OS_GUIADA, RESPOSTA_CORRETA, RESPOSTA_QUE_BLOQUEIA } from "@/treino/ids";

const rotuloDaResposta = (resposta: string) => (resposta === "sim" ? "Sim" : "Não");

/**
 * Roteiro do tutorial direcionado. Cada passo aponta para um elemento real da tela (`data-treino="chave"` nos componentes
 * de `components/app/**`) e avança de duas formas: pelo botão "Próximo" ou quando a pessoa faz a tarefa pedida
 * (`avanca`: clicar no alvo, chegar a uma rota ou ver um elemento aparecer). Sem alvo na tela o passo vira um aviso centralizado.
 */
export interface PassoDoTreino {
  id: string;
  titulo: string;
  texto: string;
  /** Chave `data-treino` do elemento destacado. Sem ela, ou com o elemento fora da tela, o passo é informativo e centralizado. */
  alvo?: string;
  /** Explicação extra mostrada só quando o alvo não está na tela (por exemplo, "esta OS não aparece com este filtro"). */
  semAlvo?: string;
  /** Tarefa que faz o passo avançar sozinho; aparece como lembrete no balão. */
  tarefa?: string;
  /** Tela onde o passo vale. Fora dela o tutorial pausa e oferece "Retomar tutorial". Sem ela, vale em qualquer tela. */
  rota?: (caminho: string) => boolean;
  /** Para onde "Retomar tutorial" leva quando a pessoa está fora da tela do passo. */
  ir?: string;
  /** A tela de `ir` abre sozinha, sem pré-requisito: "Próximo" já navega até ela. */
  navegavel?: boolean;
  /** O passo avança quando alguma destas condições acontece. */
  avanca?: {
    /** Clique dentro do elemento com esta chave `data-treino`. */
    clique?: string;
    /** A pessoa chegou a esta rota. */
    rota?: (caminho: string) => boolean;
    /** Um elemento com esta chave passou a existir na tela. */
    aparece?: string;
  };
  /** Atalho oferecido quando o alvo não está na tela. */
  atalho?: { rotulo: string; href: string };
  /** Último passo: parabéns e gravação do estado `concluido`. */
  final?: boolean;
}

const exata = (rota: string) => (caminho: string) => caminho === rota;
const umaDas = (...rotasValidas: string[]) => (caminho: string) => rotasValidas.includes(caminho);

const guiada = {
  os: rotas.app.os(OS_GUIADA),
  apr: rotas.app.apr(OS_GUIADA),
  checklist: rotas.app.checklist(OS_GUIADA),
  aprovada: rotas.app.aprovada(OS_GUIADA),
  execucao: rotas.app.execucao(OS_GUIADA),
};
const bloqueio = {
  os: rotas.app.os(OS_BLOQUEIO),
  apr: rotas.app.apr(OS_BLOQUEIO),
  checklist: rotas.app.checklist(OS_BLOQUEIO),
  bloqueio: rotas.app.bloqueio(OS_BLOQUEIO),
};

export const passosDoTreino: PassoDoTreino[] = [
  // ---- Lista e detalhe da OS ----
  {
    id: "abrir-os",
    titulo: "Bem-vindo à lista de OS",
    texto:
      "Aqui ficam as ordens de serviço da sua equipe, agrupadas por situação; os filtros e a busca ajudam a achar uma OS. No treino tudo é fictício, então pode mexer à vontade. Toque na OS destacada para abrir.",
    semAlvo: "A OS do treino não aparece com o filtro atual. Tire os filtros ou use o atalho abaixo.",
    tarefa: "Toque na OS destacada.",
    alvo: "os-guiada",
    rota: exata(rotas.app.lista),
    ir: rotas.app.lista,
    navegavel: true,
    avanca: { clique: "os-guiada", rota: exata(guiada.os) },
    atalho: { rotulo: "Abrir a OS do treino", href: guiada.os },
  },
  {
    id: "nova-apr",
    titulo: "Leia a OS e comece a APR",
    texto:
      "A OS traz o local, os dados do SAP e as instruções do serviço, e diz qual modelo de APR a atividade exige: sem APR aprovada a execução não é liberada. Toque em “Nova APR” para preenchê-la.",
    tarefa: "Toque em Nova APR.",
    alvo: "os-nova-apr",
    rota: exata(guiada.os),
    ir: guiada.os,
    navegavel: true,
    avanca: { clique: "os-nova-apr", rota: umaDas(guiada.apr, guiada.checklist) },
  },
  // ---- APR ----
  {
    id: "apr-monte",
    titulo: "Monte a APR",
    texto: `Confira o modelo (aqui, o ${MODELO_GUIADO.codigo}), marque os colegas presentes e os riscos da atividade: só as medidas dos riscos marcados viram perguntas. Depois toque em “Começar checklist”.`,
    tarefa: "Toque em Começar checklist.",
    alvo: "apr-modelo",
    rota: exata(guiada.apr),
    ir: guiada.apr,
    navegavel: true,
    avanca: { clique: "apr-comecar", rota: exata(guiada.checklist) },
  },
  {
    id: "ck-responder",
    titulo: "Responda uma pergunta por vez",
    texto: `O checklist mostra uma pergunta de cada vez, e a grade leva a qualquer uma. Neste primeiro exemplo, escolha as respostas que deixam a atividade segura (${rotuloDaResposta(RESPOSTA_CORRETA)}, inclusive no item eliminatório dos EPIs) para a APR ser aprovada.`,
    tarefa: "Responda uma pergunta.",
    alvo: "ck-resposta",
    rota: exata(guiada.checklist),
    ir: guiada.checklist,
    avanca: { clique: "ck-resposta" },
  },
  {
    id: "ck-validar",
    titulo: "Revise e valide",
    texto:
      "Responda o que falta e toque em “Ir para a revisão” (na última pergunta, “Revisar e concluir”). A revisão lista pendências, itens reprovados e alertas; estando tudo certo, toque em “Concluir e validar”. Depois de validada, a APR não muda mais.",
    semAlvo: "Na revisão, confira a lista e toque em “Concluir e validar”.",
    tarefa: "Valide a APR.",
    alvo: "ck-revisar",
    rota: exata(guiada.checklist),
    ir: guiada.checklist,
    avanca: { rota: exata(guiada.aprovada) },
  },
  {
    id: "assinaturas",
    titulo: "APR aprovada: falta assinar",
    texto:
      "Cada participante confirma a assinatura que cadastrou no perfil. Quando o último confirmar, a APR é registrada e o botão “Iniciar execução” aparece: toque nele.",
    tarefa: "Confirme as assinaturas e inicie a execução.",
    alvo: "assinaturas",
    rota: exata(guiada.aprovada),
    ir: guiada.aprovada,
    avanca: { rota: exata(guiada.execucao) },
  },
  // ---- Execução ----
  {
    id: "exec-iniciar",
    titulo: "Inicie a execução",
    texto: "Informe quantas pessoas vão trabalhar e inicie. O tempo começa a contar a partir daqui.",
    tarefa: "Toque em Iniciar execução.",
    alvo: "exec-iniciar",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
    avanca: { aparece: "exec-pausa" },
  },
  {
    id: "exec-pausar",
    titulo: "Pause quando precisar",
    texto:
      "Almoço, descanso ou imprevisto? Pause a execução; o tempo parado não entra na conta. Ao voltar ao trabalho, toque em Continuar: só dá para encerrar a OS com a execução em andamento.",
    tarefa: "Toque em Pausar (e depois em Continuar).",
    alvo: "exec-pausa",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
    avanca: { clique: "exec-pausa" },
  },
  {
    id: "exec-encerrar",
    titulo: "Terminou? Encerre a OS",
    texto: "Quando o serviço acabar, toque em “Encerrar OS”. Se a execução estiver em pausa, continue antes.",
    tarefa: "Toque em Encerrar OS.",
    alvo: "exec-encerrar",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
    avanca: { aparece: "enc-descricao" },
  },
  {
    id: "enc-preencher",
    titulo: "Conte o que foi feito",
    texto:
      "Descreva a atividade (obrigatório), anexe as fotos do serviço e confira as assinaturas de quem executou. A lista “Falta” avisa o que ficou de fora. Com tudo preenchido, encerre: a OS passa para “Encerrada” e o PDF com a APR e a execução é gerado.",
    tarefa: "Preencha e encerre a OS.",
    alvo: "enc-descricao",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
    avanca: { aparece: "exec-encerrada" },
  },
  // ---- Perfil e histórico ----
  {
    id: "perfil",
    titulo: "Veja o seu histórico",
    texto: "Tudo o que você encerra fica no seu perfil, nos últimos 60 dias, com o PDF de cada OS. Abra “Perfil e histórico” no menu.",
    tarefa: "Abra Perfil e histórico.",
    alvo: "menu-perfil",
    rota: exata(guiada.execucao),
    ir: rotas.app.perfil,
    navegavel: true,
    avanca: { clique: "menu-perfil", rota: exata(rotas.app.perfil) },
  },
  // ---- Bloqueio ----
  {
    id: "abrir-bloqueio",
    titulo: "Agora, provoque um bloqueio",
    texto: "Falta ver o que acontece quando uma APR reprova. Abra a segunda OS do treino na lista; vamos errar de propósito.",
    semAlvo: "Volte à lista pelo menu “OS da equipe” e toque na segunda OS, ou use o atalho abaixo.",
    tarefa: "Toque na segunda OS.",
    alvo: "os-bloqueio",
    rota: umaDas(rotas.app.perfil, rotas.app.lista),
    ir: rotas.app.lista,
    navegavel: true,
    avanca: { clique: "os-bloqueio", rota: exata(bloqueio.os) },
    atalho: { rotulo: "Abrir a OS do bloqueio", href: bloqueio.os },
  },
  {
    id: "bloqueio-nova-apr",
    titulo: "Uma APR de propósito errada",
    texto: "Toque em “Nova APR”, monte do mesmo jeito e comece o checklist. Desta vez vamos reprovar um item eliminatório.",
    semAlvo: "Monte a APR como antes (modelo, participantes e riscos) e toque em “Começar checklist”.",
    tarefa: "Chegue ao checklist.",
    alvo: "os-nova-apr",
    rota: umaDas(bloqueio.os, bloqueio.apr),
    ir: bloqueio.os,
    navegavel: true,
    avanca: { rota: exata(bloqueio.checklist) },
  },
  {
    id: "bloqueio-eliminatoria",
    titulo: "Reprove o item eliminatório",
    texto: `Procure o item eliminatório do cinto e do talabarte (a grade leva a qualquer pergunta): “${MODELO_BLOQUEIO.itemEliminatorioTexto}” Responda ${rotuloDaResposta(RESPOSTA_QUE_BLOQUEIA)}. As outras respostas podem seguir como estiverem.`,
    tarefa: "Reprove o item eliminatório.",
    alvo: "ck-pergunta",
    rota: exata(bloqueio.checklist),
    ir: bloqueio.checklist,
    avanca: { aparece: "ck-evidencia" },
  },
  {
    id: "bloqueio-evidencia",
    titulo: "Prove a reprovação e valide",
    texto:
      "Para reprovar um item é preciso provar: escreva o motivo na observação e anexe ao menos uma foto (no treino, qualquer imagem serve). Responda o que faltar, abra a revisão e toque em “Concluir e validar”: uma APR bloqueada vale na hora.",
    semAlvo: "Responda o que faltar, abra a revisão e toque em “Concluir e validar”.",
    tarefa: "Valide a APR bloqueada.",
    alvo: "ck-evidencia",
    rota: exata(bloqueio.checklist),
    ir: bloqueio.checklist,
    avanca: { rota: exata(bloqueio.bloqueio) },
  },
  {
    id: "bloqueio-tela",
    titulo: "Atividade impedida",
    texto:
      "É isso que acontece quando um item eliminatório reprova: a atividade é impedida, a OS fica pendente e o supervisor é avisado com o motivo e as fotos. Aqui estão os itens reprovados; qualquer pessoa da equipe pode voltar ao local e fazer uma APR nova, sem esperar reprogramação.",
    alvo: "bloqueio-banner",
    rota: exata(bloqueio.bloqueio),
    ir: bloqueio.bloqueio,
  },
  // ---- Conclusão ----
  {
    id: "fim",
    titulo: "Parabéns!",
    texto:
      "Você percorreu o caminho completo: lista, APR, assinatura, execução, encerramento e bloqueio. Agora é só repetir no sistema real, com atenção e segurança.",
    final: true,
  },
];

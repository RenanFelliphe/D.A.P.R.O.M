import { rotas } from "@/lib/rotas";
import { COLEGA_DO_TUTORIAL, MODELO_BLOQUEIO, MODELO_GUIADO, OS_BLOQUEIO, OS_GUIADA, RESPOSTA_CORRETA, RESPOSTA_QUE_BLOQUEIA } from "@/treino/ids";

const rotuloDaResposta = (resposta: string) => (resposta === "sim" ? "Sim" : "Não");

/**
 * Roteiro do tutorial direcionado. Cada passo aponta para um elemento real da tela (`data-treino="chave"` nos componentes
 * de `components/app/**`) e avança de duas formas: pelo botão "Próximo" ou quando a pessoa faz a tarefa pedida
 * (`avanca`: clicar no alvo, chegar a uma rota, ver um elemento aparecer ou sumir). Sem alvo na tela o passo vira um aviso centralizado.
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
    /** Um elemento com esta chave existia na tela e deixou de existir (por exemplo, a janela de motivo que a pessoa confirmou). */
    desaparece?: string;
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
      "Aqui ficam as ordens de serviço da sua equipe, agrupadas por situação; entre o fim do serviço e a OS concluída há dois passos, “Encerrando” e “Aguardando o supervisor”. Se uma APR de hoje espera a sua assinatura, uma faixa avisa aqui. Os filtros e a busca ajudam a achar uma OS. No treino tudo é fictício, então pode mexer à vontade. Toque na OS destacada para abrir.",
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
      "A OS traz o local, os dados do SAP e as instruções do serviço. Sem uma APR aprovada e assinada por todos os participantes a execução não é liberada. Toque em “Nova APR” para preenchê-la.",
    tarefa: "Toque em Nova APR.",
    alvo: "os-nova-apr",
    rota: exata(guiada.os),
    ir: guiada.os,
    navegavel: true,
    avanca: { clique: "os-nova-apr", rota: umaDas(guiada.apr, guiada.checklist) },
  },
  // ---- APR ----
  {
    id: "apr-escolha",
    titulo: "Escolha o modelo da APR",
    texto: `A janela mostra todos os modelos de APR, cada um com os serviços que atende. O sistema leu a OS e destacou a opção recomendada (aqui, o ${MODELO_GUIADO.codigo}), mas quem decide é você: confira se o modelo cobre o serviço e as condições do local e toque em “Selecionar”.`,
    semAlvo: "Se a janela fechou, toque em “Escolher o modelo” (ou em “Trocar modelo”) para abri-la de novo.",
    tarefa: "Selecione o modelo.",
    alvo: "apr-modelo-recomendado",
    rota: exata(guiada.apr),
    ir: guiada.apr,
    navegavel: true,
    avanca: { aparece: "apr-riscos", rota: exata(guiada.checklist) },
  },
  {
    id: "apr-participantes",
    titulo: "Quem vai trabalhar nesta OS?",
    texto: `Marque os participantes: você e ao menos um colega. Ninguém executa o serviço sozinho, então a APR exige no mínimo 2 pessoas (não há máximo). Cada um vai assinar a APR na própria conta, e a execução só começa quando todos assinarem. No treino, marque o ${COLEGA_DO_TUTORIAL.nome}: ele assina sozinho, alguns segundos depois do registro. Quem está ausente ou desligado não entra na APR.`,
    alvo: "apr-participantes",
    rota: exata(guiada.apr),
    ir: guiada.apr,
    navegavel: true,
  },
  {
    id: "apr-monte",
    titulo: "Marque os riscos",
    texto:
      "Marque os riscos da atividade: só as medidas dos riscos marcados viram perguntas. Se o modelo não servir, “Trocar modelo” abre a janela de novo (também dá para trocar no checklist). Depois toque em “Começar checklist”.",
    tarefa: "Toque em Começar checklist.",
    alvo: "apr-riscos",
    rota: exata(guiada.apr),
    ir: guiada.apr,
    navegavel: true,
    avanca: { clique: "apr-comecar", rota: exata(guiada.checklist) },
  },
  {
    id: "ck-responder",
    titulo: "Responda uma pergunta por vez",
    texto: `O checklist mostra uma pergunta de cada vez, e a grade leva a qualquer uma. Todas as perguntas têm a mesma aparência: o sistema não diz quais pesam mais. Neste primeiro exemplo, escolha as respostas que deixam a atividade segura (${rotuloDaResposta(RESPOSTA_CORRETA)} em todas) para a APR ser aprovada.`,
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
      "Responda o que falta e toque em “Ir para a revisão” (na última pergunta, “Revisar e concluir”). Na revisão, os materiais recomendados do serviço aparecem só como lembrete: não pedem resposta nem foto. A revisão lista o que ficou pendente; estando tudo pronto, toque em “Concluir e validar”: é aí que o sistema confere as respostas e diz se a APR foi aprovada. Depois de validada, a APR não muda mais e fica registrada, esperando as assinaturas.",
    semAlvo: "Na revisão, confira a lista e toque em “Concluir e validar”.",
    tarefa: "Valide a APR.",
    alvo: "ck-revisar",
    rota: exata(guiada.checklist),
    ir: guiada.checklist,
    avanca: { rota: exata(guiada.aprovada) },
  },
  // ---- Assinaturas da APR (cada um, na própria conta) ----
  {
    id: "apr-resultado",
    titulo: "APR aprovada: agora, as assinaturas",
    texto:
      "A validação aprovou a APR e ela ficou registrada, ainda sem assinaturas. Agora cada participante assina a APR na própria conta: é o aceite de que está de acordo e em condições de trabalhar. As assinaturas de todos acontecem só aqui, no começo; no fim do serviço assina apenas o responsável.",
    alvo: "apr-resultado",
    rota: exata(guiada.aprovada),
    ir: guiada.aprovada,
  },
  {
    id: "apr-assinaturas-estado",
    titulo: "Quem já assinou",
    texto:
      "Esta lista mostra a situação de cada participante: assinou, pendente ou recusou. Ela se atualiza sozinha, sem precisar recarregar. A execução só pode começar quando todos os que continuam na APR assinaram. No treino, o colega fictício assina sozinho em alguns segundos.",
    alvo: "apr-assinaturas-estado",
    rota: exata(guiada.aprovada),
    ir: guiada.aprovada,
  },
  {
    id: "apr-recusar",
    titulo: "O direito de recusa",
    texto:
      "Não concorda com a APR, ou não se sente seguro para começar? Toque em “Recusar” e escreva o motivo, que é obrigatório. Você sai da APR, o supervisor é avisado na hora e, se restarem menos de 2 participantes ou quem recusou for o responsável, é preciso fazer uma APR nova. Só dá para recusar antes de assinar e antes de a execução começar. Neste roteiro, não recuse: siga para assinar.",
    semAlvo: "O botão “Recusar” só aparece enquanto você ainda não assinou nem recusou.",
    alvo: "apr-recusar",
    rota: exata(guiada.aprovada),
    ir: guiada.aprovada,
  },
  {
    id: "apr-assinar",
    titulo: "Assine a APR",
    texto:
      "Toque em “Assinar a APR”: o sistema usa a assinatura que você cadastrou e grava a data e a hora. Você assina uma vez só, agora; quando todos tiverem assinado, o botão “Iniciar execução” aparece.",
    semAlvo: "Se o botão não aparece, você já assinou: siga para o próximo passo.",
    tarefa: "Toque em Assinar a APR.",
    alvo: "apr-assinar",
    rota: exata(guiada.aprovada),
    ir: guiada.aprovada,
    avanca: { clique: "apr-assinar" },
  },
  {
    id: "iniciar-execucao",
    titulo: "Todos assinaram: inicie",
    texto: "Com a assinatura de todos, o botão “Iniciar execução” aparece. Toque nele para ir à execução.",
    semAlvo: "O botão aparece quando todos assinarem, e a tela atualiza sozinha: aguarde o colega. Se alguém recusar, é preciso fazer uma APR nova.",
    tarefa: "Toque em Iniciar execução.",
    alvo: "iniciar-execucao",
    rota: exata(guiada.aprovada),
    ir: guiada.aprovada,
    avanca: { rota: exata(guiada.execucao) },
  },
  // ---- Execução ----
  {
    id: "exec-iniciar",
    titulo: "Inicie a execução",
    texto:
      "Informe quantas pessoas vão trabalhar e inicie. O tempo começa a contar a partir daqui, e a sua localização é registrada (ao iniciar, pausar, suspender, interromper e encerrar) para constar no relatório da OS. O navegador pode pedir permissão: sem ela o serviço segue normalmente, marcado como “sem localização”.",
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
      "Almoço, descanso ou imprevisto? Pause a execução: só o tempo líquido para, e a equipe volta ao mesmo serviço, no mesmo dia, com a mesma APR. O tempo parado não entra na conta.",
    tarefa: "Toque em Pausar.",
    alvo: "exec-pausa",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
    avanca: { clique: "exec-pausa" },
  },
  {
    id: "exec-pausa-motivo",
    titulo: "Diga por que parou",
    texto:
      "O motivo da pausa é obrigatório: almoço, aguardando (escreva o que ou quem), descanso, condição climática, enfermidade, lesão ou outro (descreva). Lesão e enfermidade avisam o supervisor na hora, porque a lesão no trabalho, mesmo leve, é acidente de trabalho e precisa ser registrada. Escolha um motivo e confirme.",
    semAlvo: "Se a janela fechou sem pausar, volte um passo e toque em Pausar de novo.",
    tarefa: "Escolha o motivo e confirme a pausa.",
    alvo: "exec-pausa-janela",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    avanca: { desaparece: "exec-pausa-janela" },
  },
  {
    id: "exec-continuar",
    titulo: "Volte ao serviço",
    texto:
      "O tempo parado fica registrado com o motivo (o relatório da execução o mostra) e não entra na conta. Ao voltar ao trabalho, toque em Continuar: só dá para encerrar a OS com a execução em andamento.",
    tarefa: "Toque em Continuar.",
    alvo: "exec-pausa",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
    avanca: { clique: "exec-pausa" },
  },
  {
    id: "exec-suspender",
    titulo: "E se o serviço não continua hoje?",
    texto:
      "Suspender encerra esta execução e deixa a OS pendente; a retomada pede uma APR nova. Também pede o motivo (enfermidade, lesão, fim de expediente, condição climática, falta de material ou equipamento, ou outro, com descrição) e grava a localização. Se apareceu um risco ou impedimento, o caminho é “Interromper por risco”: motivo, ao menos uma foto e assinatura. Não toque agora: este serviço segue para o encerramento.",
    alvo: "exec-suspender",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
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
    avanca: { aparece: "exec-encerrar-confirmar" },
  },
  {
    id: "exec-encerrar-confirmar",
    titulo: "Confirme o encerramento",
    texto:
      "O tempo para neste clique de confirmação, e a execução não pode mais ser retomada; a localização do encerramento é registrada. O que vem depois (descrição, fotos, checklist e a sua assinatura) não entra no tempo.",
    semAlvo: "Se a janela fechou, toque em “Encerrar OS” de novo.",
    tarefa: "Confirme o encerramento.",
    alvo: "exec-encerrar-confirmar",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    avanca: { clique: "exec-encerrar-confirmar", aparece: "enc-descricao" },
  },
  {
    id: "enc-descricao",
    titulo: "Conte o que foi feito, se houver o que contar",
    texto:
      "O tempo já parou. A descrição da atividade é opcional: só vale registrar quando aconteceu algo. Em branco, o PDF e a planilha de baixa trazem “Executado conforme a OS, sem ocorrências”. Enquanto você não assina, a OS fica “Encerrando”.",
    semAlvo: "Aguarde um instante: o formulário abre assim que o encerramento é confirmado.",
    alvo: "enc-descricao",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
  },
  {
    id: "enc-fotos",
    titulo: "Fotos do serviço (opcionais)",
    texto:
      "Anexe fotos, e PDFs se houver laudo, só quando ajudarem a registrar o que foi feito. No treino, qualquer imagem serve. A foto da interrupção por risco, essa sim, continua obrigatória: é a prova do risco.",
    alvo: "enc-fotos",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
  },
  {
    id: "enc-checklist",
    titulo: "Checklist de inspeção",
    texto:
      "A preventiva cujo plano tem checklist pede uma resposta para cada pergunta: marque o que foi conferido. O que não estiver marcado exige uma observação e avisa o supervisor, sem impedir o encerramento.",
    semAlvo: "Esta OS não tem checklist de inspeção. A preventiva cujo plano tem perguntas mostra aqui uma lista para marcar.",
    alvo: "enc-checklist",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
  },
  {
    id: "enc-assinar",
    titulo: "Assine o encerramento",
    texto:
      "Só o responsável pelo serviço assina o encerramento: os demais já assinaram a APR, no começo, e ninguém assina de novo. Toque para assinar com a assinatura do seu perfil; o sistema grava a data e a hora. A OS passa para “Aguardando o supervisor”.",
    semAlvo: "Se o botão está desativado, confira o que o formulário diz que falta (por exemplo, uma pergunta do checklist).",
    tarefa: "Assine o encerramento.",
    alvo: "enc-assinar",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
    navegavel: true,
    avanca: { aparece: "exec-encerrada" },
  },
  {
    id: "exec-encerrada",
    titulo: "Encerramento assinado",
    texto:
      "Agora a OS espera o supervisor, que lê o relatório da execução e dá a assinatura final, mesmo que tenha participado do serviço. Só então a OS está concluída e o PDF é gerado. No treino, o supervisor fictício assina em cerca de 1 minuto: depois, a OS aparece como “Encerrada” na lista.",
    alvo: "exec-encerrada",
    rota: exata(guiada.execucao),
    ir: guiada.execucao,
  },
  // ---- Perfil e histórico ----
  {
    id: "perfil",
    titulo: "Veja o seu histórico",
    texto:
      "Tudo o que você encerra fica no seu perfil, nos últimos 60 dias. O PDF de cada OS aparece depois da assinatura final do supervisor. Abra o menu do seu nome, no topo, e escolha “Perfil”.",
    tarefa: "Abra o seu Perfil.",
    alvo: "menu-usuario",
    rota: exata(guiada.execucao),
    ir: rotas.app.perfil,
    navegavel: true,
    avanca: { rota: exata(rotas.app.perfil) },
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
    texto: `Toque em “Nova APR”, monte do mesmo jeito (com ao menos 2 participantes) e comece o checklist. Aqui o serviço é no poste: confira se a recomendação é o ${MODELO_BLOQUEIO.codigo}, de trabalho em altura. Desta vez vamos responder uma pergunta de segurança do jeito que reprova.`,
    semAlvo: "Monte a APR como antes (modelo, participantes e riscos) e toque em “Começar checklist”.",
    tarefa: "Chegue ao checklist.",
    alvo: "os-nova-apr",
    rota: umaDas(bloqueio.os, bloqueio.apr),
    ir: bloqueio.os,
    navegavel: true,
    avanca: { rota: exata(bloqueio.checklist) },
  },
  {
    id: "bloqueio-reprovar",
    titulo: "Responda Não ao cinto e ao talabarte",
    texto: `Só para o treino, procure a pergunta do cinto e do talabarte (a grade leva a qualquer pergunta): “${MODELO_BLOQUEIO.itemEliminatorioTexto}” Responda ${rotuloDaResposta(RESPOSTA_QUE_BLOQUEIA)}. As outras respostas podem seguir como estiverem. No sistema real nenhuma pergunta vem marcada: o técnico só descobre o que reprovou depois de validar. Termine o checklist, abra a revisão e toque em “Concluir e validar”.`,
    semAlvo: "Responda o que faltar, abra a revisão e toque em “Concluir e validar”.",
    tarefa: "Responda Não e valide a APR.",
    alvo: "ck-pergunta",
    rota: exata(bloqueio.checklist),
    ir: bloqueio.checklist,
    avanca: { aparece: "ck-reprovada" },
  },
  {
    id: "bloqueio-evidencia",
    titulo: "Prove a reprovação",
    texto:
      "Uma APR bloqueada vale na hora: ao validar, ela já ficou registrada, a OS ficou pendente e o supervisor foi avisado. Agora o sistema mostra o que reprovou e pede a prova de cada item: escreva o motivo na observação e anexe ao menos uma foto (no treino, qualquer imagem serve). As respostas não podem mais ser alteradas. Com a evidência pronta, toque em “Registrar impedimento”.",
    semAlvo: "Preencha a evidência dos itens reprovados e toque em “Registrar impedimento”.",
    tarefa: "Registre o impedimento.",
    alvo: "ck-evidencia",
    rota: exata(bloqueio.checklist),
    ir: bloqueio.checklist,
    avanca: { rota: exata(bloqueio.bloqueio) },
  },
  {
    id: "bloqueio-tela",
    titulo: "Atividade impedida",
    texto:
      "É isso que acontece quando uma APR reprova: a atividade é impedida, a OS fica pendente e o supervisor é avisado com o motivo e as fotos. Uma APR bloqueada não chega a ser assinada. Aqui estão os itens reprovados; qualquer pessoa da equipe pode voltar ao local e fazer uma APR nova, sem esperar reprogramação.",
    alvo: "bloqueio-banner",
    rota: exata(bloqueio.bloqueio),
    ir: bloqueio.bloqueio,
  },
  // ---- Conclusão ----
  {
    id: "fim",
    titulo: "Parabéns!",
    texto:
      "Você percorreu o caminho completo: lista, APR, assinaturas de todos, execução com pausa, encerramento em dois passos e bloqueio. Agora é só repetir no sistema real, com atenção e segurança.",
    final: true,
  },
];

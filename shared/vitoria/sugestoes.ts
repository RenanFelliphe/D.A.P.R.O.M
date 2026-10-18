import type { AcaoBruta } from "./destinos";

/**
 * As "3 sugestões fixas da tela atual" da Vitória (`vitoria.md`, seção 2.1 e 2.6): usadas tanto para abrir o painel sem
 * IA (a web mostra na hora, sem chamar a `api`) quanto pelo fallback sem IA da `api` quando a IA está fora do ar ou um
 * limite estourou. Por isso ficam aqui, no mesmo arquivo dos dois lados — nunca escritas duas vezes.
 *
 * A chave é a "tela atual" que o cliente manda em `POST /vitoria/mensagens` (`web/src/lib/vitoria.ts` decide qual é,
 * a partir do caminho da página); quem não reconhece a tela cai em `PADRAO`.
 */
export interface SugestaoFixa {
  pergunta: string;
  resposta: string;
  acao?: AcaoBruta;
}

export const PADRAO = "padrao";

export const SUGESTOES_POR_TELA: Record<string, SugestaoFixa[]> = {
  quadro_os: [
    { pergunta: "O que significa cada cor do quadro?", resposta: "As cores marcam a situação da OS: cinza é liberada, laranja é em execução, verde é encerrada e vermelho é pendente ou bloqueada. Toque numa OS para ver os detalhes." },
    { pergunta: "Como vejo só as OS da minha equipe?", resposta: "O quadro já mostra as OS da sua equipe. Use os filtros no topo para refinar por status ou urgência." },
    { pergunta: "Como abro uma preventiva?", resposta: "Toque em \"OS preventivas\" no topo do quadro para ver o intervalo entre os ciclos.", acao: { tipo: "navegar", destino: "preventivas" } },
  ],
  os_detalhe: [
    { pergunta: "Como faço a APR desta OS?", resposta: "Toque em \"Nova APR\" no detalhe da OS para escolher o modelo e responder o checklist.", acao: { tipo: "destacar", destino: "apr_nova" } },
    { pergunta: "Como inicio a execução?", resposta: "Com a APR aprovada, o botão \"Iniciar execução\" aparece no detalhe da OS.", acao: { tipo: "destacar", destino: "execucao" } },
    { pergunta: "Onde vejo os materiais recomendados?", resposta: "Os materiais do serviço ficam numa lista no detalhe da OS, antes do checklist. É só uma recomendação: não há conferência nem bloqueio por eles." },
  ],
  apr: [
    { pergunta: "Posso trocar de modelo de APR?", resposta: "Sim, enquanto não respondeu nenhuma pergunta: o botão \"Trocar modelo\" fica no topo do checklist." },
    { pergunta: "O que faço se a APR for bloqueada?", resposta: "Registre a evidência pedida (normalmente uma foto) e um comentário; a OS fica pendente até o supervisor revisar." },
    { pergunta: "Preciso assinar a APR?", resposta: "Sim, cada participante confirma com a própria assinatura cadastrada antes de concluir." },
  ],
  execucao: [
    { pergunta: "Como registro uma pausa?", resposta: "No painel da execução em andamento, toque em \"Registrar pausa\" e escolha o motivo." },
    { pergunta: "O que preciso para encerrar?", resposta: "Uma descrição do que foi feito, ao menos uma foto de evidência e a assinatura de quem participou." },
    { pergunta: "Esqueci de encerrar ontem, e agora?", resposta: "Abra a OS: o sistema pede a hora real em que você parou antes de deixar continuar." },
  ],
  perfil: [
    { pergunta: "Como troco minha assinatura?", resposta: "Em \"Meu perfil\", toque em \"Assinatura\" e desenhe a nova; ela vale a partir daí." },
    { pergunta: "Onde vejo meu histórico de OS?", resposta: "\"Meu perfil\" traz o histórico de execuções mais abaixo." },
    { pergunta: "Como vejo minha pontuação?", resposta: "A seção Gamificação mostra seus pontos, o ranking e as conquistas.", acao: { tipo: "navegar", destino: "gamificacao_minha" } },
  ],
  equipe: [
    { pergunta: "Como vejo quem é o supervisor?", resposta: "O nome do supervisor aparece no topo do perfil da equipe." },
    { pergunta: "Como cadastro um novo técnico?", resposta: "No perfil da equipe (ou em \"Minha equipe\"), toque em \"Novo usuário\"." },
    { pergunta: "O que é o representante da equipe?", resposta: "É quem assume as tarefas do supervisor quando ele está ausente ou fica alguns dias sem usar o sistema." },
  ],
  busca: [
    { pergunta: "O que a busca encontra?", resposta: "Pessoas, equipes e OS pelo número, nome ou matrícula." },
    { pergunta: "Por que não achei uma OS antiga?", resposta: "O quadro mostra por padrão as OS mais recentes; refine a busca pelo número completo da ordem." },
    { pergunta: "Como volto para o quadro?", resposta: "Toque no ícone do quadro no menu lateral.", acao: { tipo: "navegar", destino: "quadro_os" } },
  ],
  dashboard: [
    { pergunta: "O que mostra \"Meus resultados\"?", resposta: "As OS que você executou e as APR que participou, no período escolhido.", acao: { tipo: "navegar", destino: "dashboard_meus" } },
    { pergunta: "Como troco o período?", resposta: "Use o filtro de período no topo do Dashboard: 7, 30 ou 90 dias, ou os últimos 12 meses." },
    { pergunta: "Posso ver só a minha equipe?", resposta: "Sim, o filtro de equipe fica ao lado do período (quando você supervisiona mais de uma)." },
  ],
  catalogo_servicos: [
    { pergunta: "Como treino um serviço?", resposta: "No cartão do serviço, toque em \"Treinar\" quando houver uma versão publicada." },
    { pergunta: "Onde vejo os materiais de um serviço?", resposta: "A aba \"Materiais\" do cartão do serviço lista o que é recomendado para ele." },
    { pergunta: "Já fiz esse treinamento?", resposta: "Um selo de concluído aparece no cartão dos serviços que você já treinou." },
  ],
  gamificacao: [
    { pergunta: "Como ganho pontos?", resposta: "Veja a lista completa em \"Como pontuar\": OS executadas, APR em dia e treinamentos concluídos.", acao: { tipo: "navegar", destino: "gamificacao_pontos" } },
    { pergunta: "O que são as conquistas?", resposta: "Metas que dão pontos extras ao serem alcançadas, como concluir vários treinamentos.", acao: { tipo: "navegar", destino: "gamificacao_conquistas" } },
    { pergunta: "Como vejo o ranking da minha equipe?", resposta: "A aba Ranking tem um filtro por pessoas ou por equipes.", acao: { tipo: "navegar", destino: "gamificacao_ranking" } },
  ],
  treino_campo: [
    { pergunta: "O que é o Campo de treino?", resposta: "Um ambiente fictício, com dados de mentira, para aprender o sistema sem afetar OS reais." },
    { pergunta: "O treino conta pontos de verdade?", resposta: "Sim, concluir o roteiro do Campo de treino dá pontos reais, uma única vez." },
    { pergunta: "Como volto ao sistema real?", resposta: "Toque em \"Sair do treino\" a qualquer momento; o que foi feito lá não afeta nada real." },
  ],
  aguardando: [
    { pergunta: "Por que ainda não vejo as OS?", resposta: "Seu cadastro aguarda a liberação de um administrador. Enquanto isso, use o Campo de treino e os treinamentos de serviço disponíveis." },
    { pergunta: "Quanto tempo demora a liberação?", resposta: "Não há um prazo fixo; fale com seu supervisor se estiver demorando." },
    { pergunta: "Posso treinar enquanto espero?", resposta: "Sim, o Campo de treino e os treinamentos de serviço já publicados ficam abertos para você." },
  ],
  modelos_apr: [
    { pergunta: "Como crio um modelo de APR?", resposta: "Em APR › Modelos, toque em \"Novo modelo\".", acao: { tipo: "navegar", destino: "novo_modelo_apr" } },
    { pergunta: "Editar um modelo muda as APR já feitas?", resposta: "Não: editar cria uma versão nova; as APR já respondidas guardam a versão em que foram feitas." },
    { pergunta: "Onde vejo em que atividades um modelo é usado?", resposta: "A tela do modelo lista as atividades ligadas a ele." },
  ],
  usuarios: [
    { pergunta: "Como cadastro um novo usuário?", resposta: "Toque em \"Novo usuário\" e preencha a matrícula; o sistema confere com o registro de funcionários." },
    { pergunta: "Como libero um acesso pendente?", resposta: "Os cadastros pendentes aparecem destacados na lista; abra o perfil da pessoa para liberar ou recusar." },
    { pergunta: "Como defino um supervisor?", resposta: "No perfil da equipe, escolha quem é o supervisor; qualquer perfil pode exercer esse papel." },
  ],
  importacao: [
    { pergunta: "Como importo OS do SAP?", resposta: "A leitura periódica traz as OS automaticamente; use \"Importar planilha\" ou \"Importar PDF\" para as que não vieram pela integração." },
    { pergunta: "O que fazer com um PDF escaneado?", resposta: "Hoje a importação de PDF recusa arquivos escaneados sem texto; a digitalização de OS antigas, que trataria esse caso, ainda não foi implementada." },
    { pergunta: "Como volto a exportar para o SAP?", resposta: "O bloco \"Exportação para baixa no SAP\" fica no Dashboard de OS.", acao: { tipo: "navegar", destino: "exportacao_sap" } },
  ],
  auditoria: [
    { pergunta: "O que fica registrado na auditoria?", resposta: "Quem fez o quê nas telas de gestão: cadastros, modelos, importações e baixas no SAP. Os registros só são acrescentados." },
    { pergunta: "Como filtro por período?", resposta: "Use os campos \"De\" e \"Até\" no topo da lista." },
    { pergunta: "Como acho as ações de uma pessoa?", resposta: "Digite o nome dela no campo de busca da auditoria." },
  ],
  treinamento_servico_editor: [
    {
      pergunta: "Como a Vitória monta o rascunho?",
      resposta: "Cole o texto do procedimento e toque em \"Gerar rascunho com a Vitória\". Ela usa só esse texto e os materiais do serviço; você revisa, corrige e assina.",
    },
    {
      pergunta: "O que é uma pendência?",
      resposta: "Um ponto que a conferência achou num item feito pela Vitória, como um número que não está no texto. Edite o item ou confirme-o como está: com pendência, não publica.",
    },
    { pergunta: "Como publico um treinamento?", resposta: "Com as pendências resolvidas, toque em \"Publicar\": você aceita o termo e assina." },
  ],
  vitoria_perfil: [
    { pergunta: "Quem é você?", resposta: "Sou a Vitória, a assistente do SYNQ OS. Tiro dúvidas de uso do sistema pelo manual, levo você à tela certa e mostro onde fica cada botão." },
    { pergunta: "Você vê as minhas OS?", resposta: "Não. Eu só consulto o manual do seu perfil; suas OS, suas respostas e seus dados não chegam a mim, e a conversa não fica guardada no servidor." },
    { pergunta: "Você pode aprovar a minha APR?", resposta: "Não. Quem decide a APR é o sistema, pelas suas respostas, e quem revisa um bloqueio é o supervisor. Eu não aprovo, não reprovo e não assino nada." },
  ],
  vitoria_sem_resposta: [
    { pergunta: "O que é esta lista?", resposta: "As perguntas que a Vitória não soube responder, sem identificar quem perguntou: só o texto, a tela, o perfil e a data." },
    { pergunta: "Como marco uma pergunta como tratada?", resposta: "Toque em \"Marcar como tratada\" depois de melhorar o manual com essa resposta." },
    { pergunta: "Por que não tem o nome de quem perguntou?", resposta: "É por desenho: a pergunta sem resposta nunca guarda quem fez, só o contexto." },
  ],
  [PADRAO]: [
    { pergunta: "O que você faz?", resposta: "Respondo dúvidas de uso do sistema, levo você à tela certa e mostro onde fica um botão. Não vejo suas OS nem decido nada por você.", acao: { tipo: "navegar", destino: "vitoria_perfil" } },
    { pergunta: "Como volto para o quadro de OS?", resposta: "Toque no ícone do quadro no menu lateral.", acao: { tipo: "navegar", destino: "quadro_os" } },
    { pergunta: "Quem eu procuro se você não souber responder?", resposta: "Seu supervisor ou o administrador. Vou anotar sua pergunta para melhorarmos o manual." },
  ],
};

/** As 3 sugestões da tela, ou as genéricas quando a tela não é reconhecida. */
export const sugestoesDaTela = (tela: string): SugestaoFixa[] => SUGESTOES_POR_TELA[tela] ?? SUGESTOES_POR_TELA[PADRAO]!;

# Manual da Vitória — administrador

> Este manual é o que a Vitória usa para responder quem está logado como administrador. O admin faz a gestão do
> sistema (cadastros, modelos, importação, auditoria) e não executa OS nem faz APR. Mesmo para o admin, a Vitória não
> detalha a lógica interna de bloqueio da APR (quais itens, de qual tipo, reprovam): essa informação fica só na tela
> do próprio editor do modelo, nunca numa resposta de chat, para não criar um hábito de perguntar à Vitória em vez de
> consultar a tela certa.
>
> Cada item termina com a chave do manifesto de destinos entre colchetes (`shared/vitoria/destinos.ts`).

## Equipes e usuários

- A tela "Equipes e usuários" lista todo mundo cadastrado; "Novo usuário" pede a matrícula e confere com o registro
  de funcionários antes de criar a conta. [usuarios]
- Cadastros pendentes de liberação aparecem destacados; abra o perfil da pessoa para liberar ou recusar o acesso. Liberar,
  recusar, reprogramar e cancelar OS pedem a sua assinatura do perfil, que também é a primeira coisa a cadastrar no primeiro acesso.
- Qualquer perfil pode ser o supervisor de uma equipe — é um campo da equipe, não um perfil à parte.
- Quem trabalha na empresa e ainda não tem conta pode pedir uma na tela de entrada ("Ainda não tem uma conta? Solicite"),
  com o nome, o e-mail e, se quiser, a equipe. O pedido chega a você no sino e no painel "Pedidos de conta", em Equipes e
  usuários: "Cadastrar" abre o cadastro com o e-mail preenchido (a matrícula vem do registro de funcionários), e a conta
  criada atende o pedido; "Descartar" serve para quem não é funcionário. Com a equipe, o supervisor dela também recebe. [usuarios]

## Modelos de APR

- Em APR › Modelos ficam os modelos publicados e os rascunhos; "Novo modelo" começa um do zero. [modelos_apr]
- Cada modelo diz se a folha tem a coluna "Assinatura" na tabela de participantes (as APR 04, 05 e 06 têm): o PDF da OS
  reproduz a folha como ela é, e sem a coluna as assinaturas da APR aparecem só no relatório da execução. [modelos_apr]
- Editar um modelo publicado cria uma versão nova; as APR já respondidas guardam a versão em que foram feitas, então
  nada muda retroativamente.
- A aba Atividades lista os serviços do catálogo: cada OS chega do SAP com o código da atividade, que diz o serviço e a
  lista de materiais. A atividade não escolhe o modelo da APR: o técnico escolhe a cada APR, e o sistema recomenda um
  pela orientação de cada modelo. [atividades_apr]
- Abrir um modelo específico mostra as versões, o editor do rascunho e onde ele é usado. [modelo_apr]

## Importação de OS

- A seção Ordem de Serviço tem uma aba própria de Importação: a leitura periódica do SAP traz as OS automaticamente,
  e "Importar planilha" ou "Importar PDF" cobrem o que não vier assim. [importacao]
- Antes de importar, a tela pergunta se a OS é para liberar no sistema ou se já foi concluída no papel. Para liberar,
  vale a planilha ou o PDF gerado pelo SAP; um PDF escaneado (sem texto para ler) é recusado nesse caminho. [importacao]
- A digitalização traz OS antigas, já executadas no papel, como histórico: escolha "Já foi concluída no papel" e envie o
  PDF escaneado das folhas, ou use o cartão "Digitalização" para fotografar 1 ou 2 folhas avulsas. A IA lê as folhas em
  segundo plano, inclusive o que foi escrito à mão, e você confere cada OS ao lado das folhas antes de registrar; a OS
  entra encerrada. Só o administrador vê a Digitalização. Com a função "Digitalização de documentos" desligada no Controle
  da IA (ou sem IA), o texto impresso continua sendo lido e o escrito à mão é digitado por você na conferência. [importacao]
- A exportação para baixa no SAP fica num bloco à parte, no Dashboard de OS. [exportacao_sap]

## Previsão do tempo

- O quadro de OS mostra, ao lado dos contadores, a previsão do tempo das próximas horas do expediente, com uma orientação.
  A previsão vem do GPS do aparelho; sem GPS, da cidade padrão, que você escolhe em Configurações, na aba "Sistema"
  (padrão: Vitória, ES). [configuracoes_sistema]
- Na pergunta de clima da APR, quem responde "favorável" com risco previsto vê um aviso e pode seguir; no risco extremo
  só segue com a foto do local, e o supervisor da equipe recebe na hora o alerta "Risco climático extremo na APR", no sino e
  por e-mail (segurança). O relatório da execução guarda a previsão da APR e a do encerramento. [alertas]
- Qual pergunta mostra a previsão é uma marca do item no editor de modelos de APR ("Mostrar a previsão do tempo nesta
  pergunta"); as perguntas de clima dos 8 modelos já vêm marcadas. [modelos_apr]

## Configurações

- No menu do seu nome, "Configurações" tem duas abas: "Minha conta" (assinatura, e-mails, senha) e "Sistema", só do
  administrador. [configuracoes]
- Em "Sistema": a cidade padrão da previsão do tempo (busque a cidade e escolha), os horários das rotinas (leitura do SAP,
  leitura do registro de funcionários e resumo diário por e-mail), o Controle da IA e os limites de uso da IA. O que o
  ambiente define é só o valor inicial: o que você muda aqui vale na hora, aparece como "alterado" e tem o botão de voltar
  ao padrão. Cada mudança vai para a auditoria. Endereços, chaves e senhas dos sistemas ficam no ambiente, fora da tela.
  [configuracoes_sistema]

## Mapa de calor

- A aba "Mapa de Calor" da seção Ordem de Serviço mostra, sobre um mapa com as ruas, onde as OS de todas as equipes
  foram executadas no período, pelo GPS registrado no início (ou no fim) da execução. Todo mundo vê a mesma aba, cada
  um no próprio escopo: o técnico, a própria equipe; o supervisor, as que supervisiona. [mapa_calor]
- As OS são agrupadas em áreas de cerca de 1 km, sem a posição exata. Com a radiação ligada (o padrão), cada área
  emite um brilho que se funde com o das vizinhas, formando uma mancha maior nas regiões mais movimentadas; o
  interruptor no topo do mapa desliga a radiação e mostra só um ponto colorido por área, sem brilho. [mapa_calor]
- Os filtros escolhem o período, a equipe e a situação atual da OS. "Áreas com mais OS", ao lado, leva o mapa até
  cada uma das cinco maiores. OS sem GPS entram na contagem "Sem localização", mas não aparecem no mapa. [mapa_calor]

## Auditoria

- A auditoria registra quem fez o quê nas telas de gestão: cadastros, modelos, importações e baixas no SAP. Os
  registros só são acrescentados; ninguém os edita nem apaga. [auditoria]
- Dá para filtrar por tipo de ação, por período ou pelo nome de quem fez.

## Alertas

- Os alertas avisam sobre bloqueios de APR, direito de recusa, lesão ou enfermidade na execução e outras pendências
  que precisam de atenção. [alertas]
- Para o admin chegam também: pedido de conta feito na tela de entrada, cadastro feito por um supervisor aguardando a liberação, funcionário readmitido no
  registro (com o botão "Reativar a conta" no próprio aviso: o sistema nunca devolve o acesso sozinho), equipe sem
  supervisor (o representante responde por ela até você escolher um), falha na leitura do SAP ou do registro de
  funcionários, PDF de OS que não saiu e a Vitória respondendo sem IA. [alertas]
- Cada aviso também vai por e-mail, conforme o que cada pessoa deixou ligado em "E-mails", nas Configurações; os de segurança
  e os da conta sempre vão. De manhã sai um resumo diário com o que espera por cada um. Sem o servidor de e-mail
  configurado (`SMTP_URL`), os avisos ficam só no sino. [configuracoes]

## Catálogo de serviços e materiais

- O catálogo de serviços lista os materiais recomendados de cada um; só o admin edita essa lista, por "Editar lista"
  (ou "Adicionar materiais", sem nenhum) dentro de "Ver materiais", no cartão do serviço; o editor abre numa
  janela. [catalogo_servicos]
- O cadastro de materiais fica numa tela própria, com a categoria (ferramenta, EPI, consumível). [catalogo_materiais]

## Treinamentos de serviço

- No cartão do serviço, "Abrir treinamento" (ou "Criar treinamento", quando ainda não há) leva ao treinamento: a visão
  geral mostra o caminho até publicar (conteúdo, validação, teste e publicação) e as abas Explicação, Fases do jogo,
  Revisão, Versões e Problemas.
  [treinamento_servico_editor]
- Na aba Fases do jogo, "Adicionar fase" mostra os 10 minijogos (quiz, decisão, ligar, pôr em ordem, verdadeiro ou
  falso, caça-palavras, memória, selecione, desembaralhe e termo), cada um com uma frase do que é o jogo e a sua cor, que
  também aparece no jogo. "1 de cada" acrescenta uma fase de cada minijogo, em ordem aleatória. O jogo não tem limite de
  fases; para publicar, são ao menos 3. [treinamento_servico_editor]
- O Selecione aceita de 3 a 16 opções escritas (de 1 a 10 certas). A caixa "Montar com os materiais do serviço" troca
  as opções escritas pelos materiais do catálogo: você marca os certos, e o sistema mistura até 15 itens de outros
  serviços, sorteados a cada partida. [treinamento_servico_editor]
- Ao criar, você escolhe entre "Gerar com a Vitória" (para validar depois) e "Criar manualmente". Gerar monta a explicação
  e as fases a partir do texto do procedimento que você colar (o que o serviço usa, os passos na ordem, os cuidados e os
  números), usando só esse texto e os materiais do serviço no catálogo. A tela mostra como escrever o texto e um exemplo.
  Leva alguns minutos, e o rascunho é gravado mesmo se você sair da tela; quando termina, a Revisão abre sozinha. Sem a IA
  configurada, a opção fica desativada e o editor manual continua igual. [treinamento_servico_editor]
- Logo abaixo do texto do procedimento, em "Fases do jogo", você escolhe quantas fases (ao menos 3) e o minijogo de cada
  uma, ou deixa "A Vitória escolhe"; "Todas como" preenche todas de uma vez, e "1 de cada" monta uma fase de cada
  minijogo em ordem aleatória. Também dá para pedir o Selecione com os materiais do serviço. Fase que vier de outro tipo fica para
  conferir na Revisão. [treinamento_servico_editor]
- O Desembaralhe e o Termo guardam 10 palavras cada (publicar exige as 10): a cada partida o jogo sorteia uma, e as
  opções de todas as fases mudam de ordem. [treinamento_servico_editor]
- Na Revisão, cada passo e cada fase feitos pela Vitória mostram o trecho do texto de onde saíram. Quando a conferência
  acha um problema (trecho que não está no texto, número que não aparece no texto, fase sem opção certa ou com mais de
  uma, material fora da lista do serviço), o item fica com uma pendência: edite o item ou toque em "Confirmar como está".
  Com pendência, o treinamento não é publicado.
- Na Revisão também dá para pedir ajustes à Vitória ("encurte a explicação", "faça uma fase sobre aterramento") ou tocar
  em "Regerar com a Vitória" numa fase. Na demonstração, poucos treinamentos podem usar a IA e cada um tem poucas rodadas;
  esgotado o limite, os botões ficam desativados com "Limite da demonstração atingido".
- "Testar o jogo" abre o treinamento numa janela, do jeito que o técnico joga, sem pontuar.
- O treinamento é publicado pela validação dos supervisores: ao terminar o conteúdo, "Enviar para validação" (com a sua
  assinatura) trava o rascunho e avisa as 3 equipes que mais fazem o serviço, sem a de quem criou, uma pessoa por equipe.
  Assinam 2 dos 3 (todos, quando só há 1 ou 2 equipes) e o treinamento é publicado sozinho; uma recusa, com motivo,
  devolve o rascunho ao autor. "Retirar da validação" destrava o rascunho. Publicar exige o conteúdo completo, sem
  pendências e o termo de revisão assinado; quem assina responde pelo conteúdo, mesmo o que veio da Vitória.
- O administrador ainda pode "Publicar direto", como exceção: quando a validação era possível, a justificativa é obrigatória
  e fica na versão e na auditoria. Sem nenhuma equipe para validar (por exemplo, serviço sem OS), publica sem justificar.
- Supervisores de equipes que fazem o serviço também criam o treinamento dele; o rascunho é de quem o criou (só ele e o
  administrador editam), e a equipe dele não valida. Editar depois cria um rascunho novo a partir da versão publicada, que
  passa pela validação de novo, sem apagar a versão publicada anterior.
- Na aba Problemas ficam os avisos que os técnicos mandaram pelas fases; depois de corrigir, marque como tratado.

## Dashboards

- O Dashboard geral reúne a visão de OS, equipes e APR num só lugar. [dashboard_geral]
- O dashboard de OS traz os tempos de execução (com a pausa por motivo) e a entrada de ordens. [dashboard_os]
- A OS só está concluída quando quem a encerrou assina o encerramento e, por último, o supervisor assina depois de ler o
  relatório da execução (um PDF à parte, que o supervisor e o admin veem no detalhe da OS). Enquanto isso a OS fica
  "encerrando" ou "aguardando o supervisor"; o PDF da OS e a baixa no SAP só valem para a OS concluída. [dashboard_os]
- O dashboard de APR traz os indicadores de aprovação e bloqueio, por equipe e por período. [dashboard_apr]
- O dashboard de equipes compara o desempenho entre elas. [dashboard_equipes]

## Gamificação

- "Como pontuar" lista as tarefas que dão pontos e os valores de cada uma; o admin pode ajustar esses valores ali.
  [gamificacao_pontos]
- O ranking, as conquistas e as patentes também se administram nas abas da seção Gamificação. [gamificacao_ranking]

## Simuladores

- O registro de funcionários simulado fica em "Simulador › Funcionários": é a base que a conferência de matrícula
  usa ao cadastrar alguém. [simulador_funcionarios]
- As ordens do SAP simulado ficam em "Simulador › Ordens": é de lá que a leitura periódica traz as OS novas.
  [simulador_ordens]

## Perguntas sem resposta da Vitória

- Quando a Vitória não sabe responder algo, a pergunta fica registrada sem identificar quem perguntou: só o texto, a
  tela, o perfil e a data. [vitoria_sem_resposta]
- A lista fica no menu "Vitória", abaixo do diagnóstico da IA, com um selo que conta as que ainda não foram tratadas. Depois de melhorar o
  manual com a resposta, marque a pergunta como tratada. [vitoria_sem_resposta]

## Diagnóstico da Vitória

- A tela "Vitória", no menu, mostra se a IA dela está ativa, por que não está (sem chave, limite do dia ou problema do
  fornecedor), quando volta e quanto falta para o limite de respostas com IA do dia acabar, num controle deslizante.
  [vitoria_sem_resposta]

## Sobre a Vitória

- A Vitória é a assistente virtual do SYNQ OS. O perfil dela mostra quem ela é, o que pode e o que não pode fazer no
  sistema e qual modelo de IA está respondendo agora. Também abre tocando no nome dela, no topo do chat. [vitoria_perfil]
- Ela não vê as OS, as respostas da APR nem os dados de ninguém, a menos que o administrador tenha ligado a leitura de dados do Chatbot nas Configurações: aí ela passa a ler as OS em aberto que o seu perfil enxerga, quantas APRs esperam assinatura e, para o técnico, os pontos, e só usa isso nas perguntas sobre o trabalho de quem pergunta (nunca o nome de colegas). Os fatos do sistema vêm só deste manual (em conceitos gerais
  do ofício ela pode explicar com o que sabe, avisando que é uma informação geral e não uma regra da empresa). A conversa não fica guardada
  no servidor; só as perguntas que ela não soube responder, sem identificar quem perguntou.
- Ela não aprova nem reprova APR, não assina nada e não decide nada por ninguém.
- Só o administrador vê, em Configurações (aba "Sistema"), o "Controle da IA": um seletor com as quatro funções dela (Chatbot e Criação de jogos, que funcionam sem
  dados; Recomendação de modelo de APR e Digitalização de documentos, que só funcionam lendo dados), cada uma com uma explicação e um interruptor de ligar e
  desligar. Para ligar uma função com dados, ou a leitura de dados do Chatbot e da Criação de jogos, o administrador lê a lista do que será lido e assina com a
  assinatura do perfil. Desligar não pede assinatura. Desligada, a função segue sem IA. [configuracoes_sistema]

## Por que o sistema funciona assim

- Por que editar um modelo publicado cria uma versão nova: as APR já respondidas guardam a versão em que foram feitas,
  então nada muda retroativamente.
- Por que a auditoria não deixa editar nem apagar: ela só acrescenta registros, para valer como prova de quem fez o quê
  nas telas de gestão.
- Por que liberar, recusar, reprogramar e cancelar OS pedem a sua assinatura: são ações importantes, e a assinatura do
  perfil mostra que foi você quem as fez.
- Por que o sistema nunca devolve o acesso sozinho a quem foi readmitido: o aviso traz o botão "Reativar a conta" e
  quem decide é o administrador.
- Por que o administrador não faz APR nem executa OS: o papel dele é a gestão do sistema (cadastros, modelos,
  importação, auditoria).
- Por que a Vitória não diz no chat o que reprova a APR, nem para o administrador: essa informação fica só no editor do
  modelo.
- Por que a lista de perguntas sem resposta existe: é como o manual da Vitória melhora. Cada pergunta tratada vira uma
  resposta melhor no manual.

## Glossário

- OS (ordem de serviço): o pedido de um serviço a executar. Chega pelo SAP, por planilha ou pelo PDF da OS. [importacao]
- Digitalização: a entrada de OS antigas, já executadas no papel, pelo PDF escaneado ou pela foto das folhas; a OS entra
  encerrada, como histórico. [importacao]
- APR (Análise Preliminar de Risco): a análise dos riscos que a equipe faz antes de executar uma OS, a partir de um
  modelo.
- Modelo de APR: o roteiro da APR de uma atividade, com versões. [modelos_apr]
- SAP: o sistema de onde as OS chegam e para onde elas voltam pela exportação de baixa. [exportacao_sap]
- Supervisor: quem a equipe aponta como responsável por ela; é um campo da equipe, não um perfil à parte.
- Representante da equipe: quem assume as tarefas do supervisor quando ele está ausente ou parado.
- Alerta: aviso para o administrador sobre algo que precisa de atenção. [alertas]
- Simulador: as telas do SAP e do registro de funcionários simulados, onde o admin vê e cria as OS e os funcionários que o sistema lê. [simulador_ordens]

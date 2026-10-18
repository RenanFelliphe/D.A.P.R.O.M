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

## Modelos de APR

- Em APR › Modelos ficam os modelos publicados e os rascunhos; "Novo modelo" começa um do zero. [modelos_apr]
- Editar um modelo publicado cria uma versão nova; as APR já respondidas guardam a versão em que foram feitas, então
  nada muda retroativamente.
- A aba Atividades mostra a quais atividades cada modelo está ligado. [atividades_apr]
- Abrir um modelo específico mostra as versões, o editor do rascunho e onde ele é usado. [modelo_apr]

## Importação de OS

- A seção Ordem de Serviço tem uma aba própria de Importação: a leitura periódica do SAP traz as OS automaticamente,
  e "Importar planilha" ou "Importar PDF" cobrem o que não vier assim. [importacao]
- Um PDF escaneado (sem texto para ler) é recusado hoje: a digitalização de OS antigas, que trataria esse caso, ainda
  não foi implementada.
- A exportação para baixa no SAP fica num bloco à parte, no Dashboard de OS. [exportacao_sap]

## Auditoria

- A auditoria registra quem fez o quê nas telas de gestão: cadastros, modelos, importações e baixas no SAP. Os
  registros só são acrescentados; ninguém os edita nem apaga. [auditoria]
- Dá para filtrar por tipo de ação, por período ou pelo nome de quem fez.

## Alertas

- Os alertas avisam sobre bloqueios de APR e outras pendências que precisam de atenção. [alertas]

## Catálogo de serviços e materiais

- O catálogo de serviços lista os materiais recomendados de cada um; só o admin edita essa lista. [catalogo_servicos]
- O cadastro de materiais fica numa tela própria, com a categoria (ferramenta, EPI, consumível). [catalogo_materiais]

## Treinamentos de serviço

- A aba Treinamento do serviço reúne o editor (explicação em passos e fases do jogo), a pré-visualização, a
  publicação (com termo e assinatura) e os problemas reportados pelos técnicos. [treinamento_servico_editor]
- "Gerar rascunho com a Vitória", no topo do editor, monta a explicação e as fases a partir do texto do procedimento que
  você colar (ferramentas, passos e normas), usando só esse texto e os materiais do serviço no catálogo. Leva de 1 a 2
  minutos, e o rascunho é gravado mesmo se você sair da tela. Sem a IA configurada, o botão não aparece e o editor manual
  continua igual. [treinamento_servico_editor]
- Cada passo e cada fase feitos pela Vitória mostram o trecho do texto de onde saíram. Quando a conferência acha um
  problema (trecho que não está no texto, número que não aparece no texto, fase sem opção certa ou com mais de uma,
  material fora da lista do serviço), o item fica com uma pendência: edite o item ou toque em "Confirmar como está".
  Com pendência, o treinamento não é publicado.
- Depois de gerar, dá para pedir ajustes no chat do editor ("encurte a explicação", "faça uma fase sobre aterramento") ou
  tocar em "Regerar esta fase com a Vitória". Na demonstração, poucos treinamentos podem usar a IA e cada um tem poucas
  rodadas; esgotado o limite, os botões ficam desativados com "Limite da demonstração atingido".
- Publicar uma versão exige revisar e assinar; quem publica responde pelo conteúdo, mesmo o que veio da Vitória. Editar
  depois cria um rascunho novo a partir da versão publicada, sem apagar a versão publicada anterior.

## Dashboards

- O Dashboard geral reúne a visão de OS, equipes e APR num só lugar. [dashboard_geral]
- O dashboard de OS traz os tempos de execução e a entrada de ordens. [dashboard_os]
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
- Depois de melhorar o manual com essa resposta, marque a pergunta como tratada na mesma tela.

# Manual da Vitória — técnico e supervisor

> Este manual é o que a Vitória usa para responder quem está logado como técnico (inclusive o supervisor, que é um
> técnico com uma equipe sob supervisão, e quem ainda aguarda a liberação do acesso). **Nunca mencione o que é um item
> eliminatório, o tipo de um item da APR ou qual resposta bloqueia a APR**: isso é regra de segurança do sistema, não
> apenas deste texto — quem descobre o que reprova a APR faz isso respondendo de verdade, em `POST /aprs/avaliar`,
> nunca lendo este manual ou perguntando à Vitória. Também não ensine normas de segurança de campo ("posso subir sem
> cinto?"): isso é da APR, do supervisor e dos treinamentos de serviço.
>
> Cada item termina com a chave do manifesto de destinos entre colchetes (`shared/vitoria/destinos.ts`); é por ela que
> a Vitória sabe levar a pessoa à tela certa ou destacar o botão.

## Quadro de OS

- O quadro mostra as OS da sua equipe. As cores indicam a situação: liberada, em execução, encerrando, aguardando o
  supervisor, encerrada, pendente ou cancelada. Toque numa OS para abrir o detalhe. [quadro_os]
- Se uma APR espera a sua assinatura, uma faixa no topo do quadro avisa e leva direto à tela de assinatura. [quadro_os]
- As OS preventivas (as que seguem um ciclo, como inspeções periódicas) aparecem numa janela à parte, aberta pelo
  botão "OS preventivas" no topo do quadro. [preventivas]
- Use os filtros do quadro (status, urgência ou busca) para achar uma OS específica sem rolar a lista toda.
  [quadro_os]

## Detalhe da OS

- O detalhe de uma OS traz as instruções, o local, o equipamento, os materiais recomendados e as ações disponíveis
  (nova APR, iniciar execução) conforme a situação da OS. [os_detalhe]
- Os materiais recomendados são só uma lista de apoio (ferramentas, EPIs): não há conferência nem bloqueio por eles,
  e nada precisa ser registrado sobre eles. [os_detalhe]

## APR (Análise Preliminar de Risco)

- Antes de executar, é preciso preencher a APR: escolha o modelo sugerido (ou outro, se fizer mais sentido), marque
  os riscos da atividade e responda ao checklist. [apr_nova]
- Dá para trocar de modelo enquanto nenhuma pergunta foi respondida; depois de começar a responder, a troca não é
  mais oferecida.
- A APR precisa de pelo menos 2 participantes: ninguém executa o serviço sozinho. Não há máximo.
- Depois que a APR é validada, cada participante assina a APR na própria conta, com a assinatura do perfil (a pessoa
  recebe o aviso no sino e a faixa no quadro). A execução só começa quando todos assinaram. Essa é a única hora em
  que todos assinam: no fim, só o responsável.
- Quem não concorda com a APR (por exemplo, por não estar bem física ou emocionalmente) usa o direito de recusa: informa
  o motivo e sai da APR. O supervisor é avisado na hora. Se restarem menos de 2 participantes, ou se quem recusou foi o
  responsável, é preciso fazer uma APR nova.
- Se alguma resposta do checklist pedir uma evidência (normalmente uma foto) ou um comentário, a APR só se completa
  com isso preenchido. A OS pode ficar pendente até o seu supervisor revisar o que foi registrado.

## Execução

- Com a APR aprovada, o botão para iniciar a execução aparece no detalhe da OS. [execucao]
- São quatro botões. Pausar: parada curta, a equipe volta ao mesmo serviço no mesmo dia; só o tempo líquido para e o
  motivo é obrigatório (almoço, aguardando [o que ou quem], descanso, condição climática, enfermidade, lesão ou
  outro [com a descrição]). Suspender: o serviço não continua hoje; encerra esta execução, a OS fica pendente e a retomada
  pede APR nova; o motivo é obrigatório (enfermidade, lesão, fim de expediente, condição climática, falta de material
  ou equipamento ou outro). Interromper por risco: apareceu um risco ou impedimento; pede o motivo, ao menos uma foto e
  a assinatura, a OS fica pendente e o supervisor é avisado. Encerrar: o serviço terminou. [execucao]
- Lesão e enfermidade, na pausa ou na suspensão, avisam o supervisor na hora (no sino e por e-mail): a lesão no
  trabalho, mesmo leve, é acidente de trabalho e a empresa precisa registrá-la.
- O sistema registra a sua localização ao iniciar, pausar, suspender, interromper e encerrar a execução, para constar no
  relatório. Sem permissão de localização o serviço segue normalmente, marcado como "sem localização". A localização
  não é registrada na assinatura da APR.
- Ao tocar em "Encerrar OS", o sistema pede uma confirmação: o tempo para ali e a execução não pode ser retomada. Depois
  vêm a descrição e as fotos, que são opcionais (só vale registrar quando aconteceu algo), o checklist de inspeção das
  preventivas e a assinatura do responsável. Esse preenchimento não entra no tempo. Sem descrição, o documento sai com
  "Executado conforme a OS, sem ocorrências".
- Depois que o responsável assina, a OS fica aguardando o supervisor, que lê o relatório da execução e assina por último.
  Só então a OS está concluída e o PDF é gerado.
- O cronômetro não depende do aplicativo aberto: o tempo é calculado a partir do início, então continua certo com o
  celular bloqueado.
- Interromper por risco e cancelar por engano também são assinados: o sistema abre a confirmação com a sua assinatura
  do perfil antes de concluir.
- Esqueceu de encerrar no mesmo dia? Ao abrir a OS de novo, o sistema pede a hora real em que o trabalho parou antes
  de deixar continuar.

## Meu perfil

- Em "Meu perfil" você vê seus dados, troca a assinatura cadastrada e consulta o histórico de OS já executadas.
  [perfil]
- A troca de senha e de assinatura valem a partir do momento em que são salvas; execuções anteriores não mudam.
- A assinatura é a primeira coisa a fazer depois do primeiro acesso e da liberação do admin: sem ela nenhuma outra
  tela abre. Ela valida o que você faz de importante no sistema (APR, encerramento, interrupção, ausência).
- Os avisos chegam no sino, no topo da tela: a OS reservada para você (ou tirada de você), a assinatura final do supervisor
  na OS que você executou, a APR que espera a sua assinatura, a sua ausência, o treinamento novo. Tocar no aviso leva à tela dele.
- Em "E-mails", no perfil, você escolhe quais avisos também vão para o seu e-mail institucional, por assunto (OS,
  ausências, equipe, treinamentos e o resumo diário). Os de segurança e os da sua conta sempre vão. Desligar um assunto
  só tira o e-mail: o aviso continua no sino. [perfil]

## Minha equipe

- A tela da sua equipe (ou "Minha equipe", se você é supervisor) mostra quem faz parte dela, o total de OS e quem é
  o supervisor. [equipe]
- Quem supervisiona pode cadastrar novos técnicos ali; quem não supervisiona só consulta.
- Quem supervisiona assina, com a assinatura do perfil, ao concluir uma OS (lê o relatório da execução e assina por
  último, mesmo que tenha participado do serviço), ao reprogramar uma OS e ao devolvê-la ao SAP; a assinatura
  final vai para o PDF da OS.
- O relatório da execução é um documento à parte do PDF: traz o tempo total, as pausas (quem, por quê, quando), as
  suspensões e interrupções, a localização, as fotos, o checklist e as assinaturas da APR. Quem supervisiona o lê
  antes de assinar.
- O representante da equipe é quem assume as tarefas do supervisor quando ele está ausente ou fica alguns dias sem
  usar o sistema — a equipe continua funcionando normalmente nesse meio-tempo.
- Na equipe sem supervisor (nenhum, ou um que foi desligado), o representante responde por ela até o administrador
  escolher um: é para ele que vão os pedidos de ausência e os alertas da equipe.

## Busca

- A busca encontra pessoas, equipes e OS pelo número, nome ou matrícula. Abra-a pelo ícone de lupa, em qualquer
  tela. [busca]

## Dashboard

- "Meus resultados" mostra as OS que você executou e as APR em que participou, no período escolhido. [dashboard_meus]
- O filtro de período fica no topo: 7, 30 ou 90 dias, ou os últimos 12 meses.

## Catálogo de serviços

- O catálogo lista os serviços da empresa com os materiais recomendados para cada um. [catalogo_servicos]
- No cartão do serviço, "Ver materiais" mostra a lista do que ele leva para o campo, e "Jogar treinamento" abre o
  treinamento (com o cartãozinho da Vitória à vista); cada botão só aparece quando existe. Quem já concluiu vê o selo
  com as fases certas.

## Treinamento de serviço

- O treinamento abre numa janela por cima da tela e tem duas partes: a Vitória explicando o procedimento, passo a passo,
  e, depois, o jogo, com fases de vários minijogos: quiz, decisão, ligar, pôr em ordem, verdadeiro ou falso,
  caça-palavras, memória, selecione, desembaralhe e termo. A barra do topo mostra em que parte você está.
  [treinar_servico]
- Cada fase vale até 10 pontos pelos acertos, e quanto mais rápido, mais vale (até 10 segundos, o valor cheio; o tempo
  aparece ao lado do tipo da fase). A nota é a soma das fases vezes o número de fases vezes 10.
- Dá para voltar e avançar entre as fases, mesmo sem responder; a resposta confirmada não muda. Finalizar com fase
  pendente pede confirmação: o que você já fez nela conta, o resto vale zero.
- No cartão do serviço, "Ver ranking" mostra quem já concluiu aquele treinamento, pela melhor nota de cada um. Jogar de
  novo pode melhorar a sua nota no ranking, mas os pontos da gamificação valem só na primeira conclusão.
- Sair no meio pede confirmação, e o jogo recomeça do início quando você voltar.
- O jogo tem som (o alto-falante no topo desliga) e, no computador, atalhos: 1 a 4 escolhem a opção, Enter confirma e
  segue, e as setas trocam o passo da explicação. No celular, dá para deslizar o dedo para trocar o passo.
- A nota e os pontos ganhos só valem na primeira vez que você conclui cada treinamento; refazer ajuda a revisar, mas
  não muda a pontuação.
- Ao concluir, o resultado mostra a sua nota e o ranking daquele treinamento: quem já concluiu, ordenado pelas
  fases certas de primeira, com a sua posição em destaque. No ranking também vale a primeira conclusão; jogar de novo
  não muda a sua posição. A capa do treinamento mostra o mesmo ranking, e quem está anônimo na gamificação também
  aparece como "Participante anônimo" aqui.
- Encontrou algo que parece errado numa fase? O botão "Reportar problema" manda um aviso direto para quem administra
  o sistema.

## Gamificação

- "Como pontuar" lista tudo o que dá pontos: OS executadas, APR em dia, treinamentos de serviço concluídos e mais.
  [gamificacao_pontos]
- O ranking mostra sua posição entre pessoas ou entre equipes, geral ou por temporada. [gamificacao_ranking]
- As conquistas são metas que, ao serem alcançadas, dão pontos extras (por exemplo, concluir vários treinamentos).
  [gamificacao_conquistas]
- As patentes acompanham o total de pontos acumulado. [gamificacao_patentes]

## Campo de treino

- O Campo de treino é um ambiente fictício, com dados de mentira, para aprender o sistema sem afetar nenhuma OS de
  verdade. [treino_campo]
- Concluir o roteiro guiado do Campo de treino dá pontos reais, uma única vez.
- Para sair e voltar ao sistema real a qualquer momento, use "Sair do treino".

## Aguardando liberação

- Enquanto seu cadastro aguarda a liberação de um administrador, as telas de OS ficam fechadas; o Campo de treino e
  os treinamentos de serviço já publicados continuam abertos para você praticar. [aguardando]
- Não há um prazo fixo para a liberação; se estiver demorando, fale com seu supervisor.

## Sobre a Vitória

- A Vitória é a assistente virtual do SYNQ OS. O perfil dela mostra quem ela é, o que pode e o que não pode fazer no
  sistema e qual modelo de IA está respondendo agora. Também abre tocando no nome dela, no topo do chat. [vitoria_perfil]
- Ela não vê as OS, as respostas da APR nem os dados de ninguém: os fatos do sistema vêm só deste manual (em conceitos gerais
  do ofício ela pode explicar com o que sabe, avisando que é uma informação geral e não uma regra da empresa). A conversa não fica guardada
  no servidor.
- Ela não aprova nem reprova APR, não assina nada e não decide nada por ninguém.

## Por que o sistema funciona assim

- Por que a APR vem antes da execução: ela é a análise dos riscos do serviço feita pela equipe antes de começar. O
  botão de iniciar só aparece depois que a APR está aprovada e todos os participantes assinaram, então ninguém começa
  sem ela.
- Por que a APR pede pelo menos 2 participantes: ninguém executa o serviço sozinho.
- Por que cada participante assina a APR na própria conta: a assinatura mostra que aquela pessoa leu e concordou, e
  ninguém assina por outra. Por isso a assinatura do perfil é a primeira coisa a cadastrar.
- Por que existe o direito de recusa: quem não concorda com a APR, ou não está bem física ou emocionalmente, pode sair
  dela informando o motivo. O supervisor é avisado na hora e, se a equipe ficar com menos de 2, a APR é refeita.
- Por que o sistema pede a hora real quando se esquece de encerrar: o tempo da execução precisa ser verdadeiro para o
  relatório, então ele é corrigido com a hora em que o trabalho de fato parou, e não com a hora em que a pessoa voltou
  ao sistema.
- Por que pausar, suspender e interromper têm motivo obrigatório: o relatório da execução mostra cada parada (quem, por
  quê, quando). Lesão e enfermidade avisam o supervisor na hora porque a lesão no trabalho, mesmo leve, precisa ser
  registrada pela empresa.
- Por que o sistema registra a localização ao iniciar, pausar, suspender, interromper e encerrar: para constar no
  relatório. Sem permissão de localização o serviço segue normalmente, marcado como "sem localização".
- Por que o supervisor assina por último: ele lê o relatório da execução e só então a OS fica concluída e o PDF é gerado.
- Por que o encerramento pede confirmação: o tempo para ali e a execução não pode ser retomada.
- Por que as preventivas valem o dobro de pontos e trazem um checklist de inspeção: elas seguem um ciclo e o checklist
  é como se registra que a inspeção foi feita.
- Por que a OS pode ficar pendente depois da APR: se uma resposta do checklist pediu evidência ou comentário, o
  supervisor revisa o que foi registrado antes de a OS seguir.
- Por que os treinamentos de serviço pontuam só na primeira conclusão: refazer serve para revisar, mas a pontuação e a
  posição no ranking não mudam.
- Por que o Campo de treino existe: para aprender o sistema com dados de mentira, sem afetar nenhuma OS de verdade.

## Glossário

- OS (ordem de serviço): o pedido de um serviço a executar, com local, equipamento, instruções e materiais recomendados.
  Ela chega ao sistema pelo SAP, por uma planilha ou pelo PDF da OS, e não é criada à mão pela equipe.
- OS preventiva: uma OS que segue um ciclo, como as inspeções periódicas. Tem um checklist de inspeção no encerramento.
  [preventivas]
- APR (Análise Preliminar de Risco): a análise dos riscos da atividade, feita pela equipe antes de executar, com
  modelo, riscos marcados e checklist.
- Modelo de APR: o roteiro da APR para cada tipo de atividade. O sistema sugere um e a pessoa escolhe o que fizer mais
  sentido.
- Execução: o período entre iniciar e encerrar o serviço, com cronômetro, pausas e localização.
- Pausa: parada curta; a equipe volta ao mesmo serviço no mesmo dia.
- Suspensão: o serviço não continua hoje; a OS fica pendente e a retomada pede APR nova.
- Interrupção por risco: parada porque apareceu um risco ou impedimento; pede motivo, foto e assinatura.
- Supervisor: quem a equipe aponta como responsável por ela; lê o relatório, assina por último e recebe os avisos.
- Representante da equipe: quem assume o que é do supervisor quando ele está ausente ou fica alguns dias sem usar o
  sistema.
- Relatório da execução: documento com tempo total, pausas, suspensões, interrupções, localização, fotos, checklist e
  assinaturas da APR.
- Evidência: a foto (ou o comentário) que uma resposta do checklist pode pedir para a APR se completar.
- Sino: o ícone de avisos no topo da tela.
- Patente: o nível que acompanha o total de pontos acumulado. [gamificacao_patentes]
- Conquista: uma meta que dá pontos extras quando alcançada. [gamificacao_conquistas]
- SAP: o sistema de onde as OS chegam e para onde o supervisor pode devolver uma OS.

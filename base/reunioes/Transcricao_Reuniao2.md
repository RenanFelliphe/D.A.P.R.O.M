# Reunião 2 — Digitalização do Processo de Manutenção

**Resumo da reunião**
- Reunião em Equipe 6 - ESGAS-20261010_135221-Gravação de Reunião
- 10 de outubro de 2026, 04:52PM
- 1h 29m 31s
- Matheus Sa de Araujo Miranda começou a transcrição

## Transcrição organizada

### 0:03 — Matheus Sa de Araujo Miranda
não aquele fluxo isso tá ele é muito técnico não sei se a gente talvez vai verdade se tá assim não eles são regras de negócioÉ porque a gente fez um desenho e até o Marcos Alves ajudou a gente. E a gente queria só validar se está se é serva isso mesmo que a gente colocou aqui.

### 0:29 — Mario Stevan do Nascimento Santos
Okay.

### 0:31 — Matheus Sa de Araujo Miranda
É a aplicação web, de onde a gente vai consumir? Não, na verdade é o CRM, né? Depois a aplicação web, depois seria as APIs, né? E no final seria o aplicativo mobile, né? A gente queria só validar se esse fluxograma está certinho, a gente só localizar aqui.Só para gente ver, porque acho que isso é a base do que a gente vai desenvolver.

### 0:55 — Iago Lunar Rangel Raich
Okay.

### 0:56 — Mario Stevan do Nascimento Santos
Okay.

### 0:59 — Matheus Sa de Araujo Miranda
O que você tinha falado para despachar, a gente vai ter que usar o cigod ou aquele outro que você mostrou o cigod 2.0 ou é força?No.

### 1:09 — Iago Lunar Rangel Raich
Só uma dúvida aqui, a aplicação de vocês já está sendo desenvolvida pro ambiente Energisa? Por exemplo, vocês estão com API, eu estou ouvindo vocês falar de Sigod, a aplicação de vocês liberaram o uso da API pra vocês já acessarem o ambiente Energisa?

### 1:28 — Matheus Sa de Araujo Miranda
Não, a gente faria uma questão simulando, sim, dados mocados, sabe? Mas eu tô falando tipo assim, a gente tá vendo se a gente tá, a gente tem que desenvolver pensando no mundo da Energisa, mas sem consumir dados da Energisa, nados reais, tem que ser dados mocados mesmo.

### 1:32 — Iago Lunar Rangel Raich
Ah, tá.

### 1:44 — Matheus Sa de Araujo Miranda
Mas a nossa, a nossa forma de desenvolver nossa estrutura, a gente tem que colocar de forma que depois, vamos supor que futuramente dê certo, que comporte na realidade energias ali no caso.

### 1:45 — Iago Lunar Rangel Raich
Mhm.Perfect.

### 1:56 — Matheus Sa de Araujo Miranda
It.Basicamente, a gente vai montar o sistema para funcionar como se tivesse a API funcionando.

### 2:05 — Mario Stevan do Nascimento Santos
Mm-hmm.

### 2:08 — Matheus Sa de Araujo Miranda
Santos Rangel.No.I must make out.Aqui a gente tem o programa, que é basicamente o fluxo de como vai funcionar o sistema.Eu vou explicar aqui os principais tópicos.

### 2:33 — Iago Lunar Rangel Raich
Mhm.

### 2:34 — Matheus Sa de Araujo Miranda
Sem vou pular os muito técnicos aqui como questão de banco de dados, mas só para vocês entenderem a lógica.aqui como eu tinha falado a gente vai ter uma maneira do usuário poder ficar logado mesmo quando ele tá offline para o sistema poder funcionar em modo offline e aí ele tem que fazer um acesso de 7 dias ele vai ter um token ali que vai ficar durando para o aplicativo dele ficar 7 dias logadoAí ele consegue usar o aplicativo mesmo estando offline. Só que o que pode acontecer é um pode acontecer de usuário, ele está offline, ele realiza a OS, ele realiza a PR, o.

### 3:01 — Mario Stevan do Nascimento Santos
Mhm.Mm-hmm.

### 3:15 — Matheus Sa de Araujo Miranda
A demanda ali e depois quando ele entra online, a gente tem que sincronizar o os dados da dele atualizado com o que está lá no banco. E aí a gente tem que fazer a comparação do que existe no banco e o que existe.No local ali do dispositivo do que está offline. Aqui a gente tem basicamente o que a gente interpretou era que existia.

### 3:37 — Mario Stevan do Nascimento Santos
Okay.

### 3:47 — Matheus Sa de Araujo Miranda
Uma API do qual que é o nome do SAP do SAP que envia?O as OS para a gente e a gente buscaria as OS e renderizaria elas no nosso sistema.Só que como a gente não pode usar os dados reais, a gente usaria os dados simulando o uso dessa API real. Os dados a gente pegaria com base naqueles naqueles documentos de APR e OS que vocês enviaram para a gente na última reunião.So, that yeah, yeah.Omar.

### 4:32 — Mario Stevan do Nascimento Santos
Oi, pode o Iago? Ele teve um negócios imprevistinho ali na residência dele, mas eu pode falar que eu depois eu passo tudo para ele aqui, como também está gravando também.

### 4:42 — Matheus Sa de Araujo Miranda
Tá gravando, cara, continue. Tá gravando, tá gravando, tá beleza. Aí a gente estava discutindo recentemente, a gente estava discutindo sobre como que a gente faria a distribuição.Da das OS para cada equipe e da APR para cada OS. E inclusive a gente tem diversas dúvidas para trazer para vocês, para a gente entender melhor como é que funciona o fluxo real hoje, para a gente poder adaptar isso para o digital, para o sistema.

### 5:08 — Mario Stevan do Nascimento Santos
Mhm.Okay.

### 5:12 — Matheus Sa de Araujo Miranda
Basicamente, na parte do funcionário, ele teria ali uma tela onde exibiria todas as OS designadas para ele, as OS que estão bloqueadas e as outros estados também, como pendentes, e ele selecionaria para poder aplicar uma APR para aquela OS que está ainda ativa, mas não foi iniciada.

### 5:33 — Mario Stevan do Nascimento Santos
Mm-hmm.

### 5:35 — Matheus Sa de Araujo Miranda
Durante para aí para aplicar, ele ia ter um fluxo onde ele ia quase como um formulário onde iria preencher campo a campo com base na APR específica para aquele tipo de serviço.Me.Oi, pode falar?

### 5:52 — Mario Stevan do Nascimento Santos
Oi, é comigo? Eu não falei não.

### 5:54 — Matheus Sa de Araujo Miranda
Acho que você ia falar alguma coisa.Vocês tinham comentado pra gente que tem algumas perguntas na PR que elas são obrigatórias, são eliminatórias. A gente implementou isso aqui no fluxo também. Se o usuário ele responder uma pergunta que ela é obrigatoriamente precisa ser.Sim, ele respondeu como não o sistema identifica e não deixa ele é concluir a

### 6:22 — Mario Stevan do Nascimento Santos
Mm-hmm.

### 6:25 — Iago Lunar Rangel Raich
Eu posso dar um perdão, eu tive que dar uma saidinha rapidinho. É um fluxo que eu que eu entendo, eu não sei se está dessa forma, tá? Eu cheguei aqui agora no meio do caminho, é a APR, basicamente que ela é um chat, tipo um check list.

### 6:29 — Matheus Sa de Araujo Miranda
Mhm.Yeah.

### 6:42 — Iago Lunar Rangel Raich
É se a pessoa está executando a PR e esse e algum critério e alguma questão alguma questão desse checklist é negativa é automaticamente a pessoa não consegue

### 6:50 — Matheus Sa de Araujo Miranda
Okay.

### 6:57 — Iago Lunar Rangel Raich
É, ele pode até concluir a APR, mas ele não consegue executar a ordem de serviço. E eu não sei se está assim, tá? É porque a atividade não pode ser executada por questões de segurança, que a APR é exatamente para isso, para.É um checklist de segurança. Se a pessoa tem algum, alguma, algum critério que ele não consiga executar a atividade de forma segura, ele não pode executar a ordem de serviço, a ordem de manutenção. É, não sei se está assim já, tá, Matheus?

### 7:27 — Matheus Sa de Araujo Miranda
Yes.na semana passada a gente tinha discutido é como que a gente implementaria isso no sistema porque inicialmente a gente tinha pensado no que vai ter ali o formulário pergunta por pergunta e se alguma das perguntas eliminatórias ele respondesse como não

### 7:30 — Mario Stevan do Nascimento Santos
Yeah.

### 7:46 — Matheus Sa de Araujo Miranda
Ou não marcasse a checkbox, o sistema iria identificar, iria, não iria permitir que ele continuasse as próximas perguntas. Só que implementando desse jeito, a gente teria um problema de, por exemplo, vamos supor que o problema não seja necessariamente dele eSIM um problema lá do.Do local onde ele vai fazer. Vocês deram um exemplo da caixa de marimbondo, então vamos supor que o problema para ele não executar a ordem de serviço seria a caixa de marimbondo. Fazendo dessa maneira, assim que ele respondesse que teria um.Esse problema, o sistema iria fechar e ele não conseguiria fazer as próximas as próximas questões. E aí vocês iriam avaliar e corrigir ou, sei lá, diagnosticar o problema. Aí vamos supor que esse problema foi resolvido.Aí volta a OS mais uma vez e vai o próximo aplicar novamente para essa OS. E aí o problema que do marimbondo foi resolvido, mas agora, enquanto eu estava preenchendo, foi diagnosticado um outro problema. E aí chega novamente, teria que fechar a OS.

### 8:46 — Iago Lunar Rangel Raich
Mhm.

### 8:50 — Matheus Sa de Araujo Miranda
A best.

### 8:50 — Iago Lunar Rangel Raich
não então no caso e isso no caso tá o Matheus toda é só um conceito aqui por exemplo é vamos supor que realmente tem a caixa de marimbondo e vamos fazer até diferente ainda deixar mais complexo

### 9:02 — Matheus Sa de Araujo Miranda
It is.

### 9:06 — Iago Lunar Rangel Raich
João foi lá executar a ordem de serviço e identificou que tem uma caixa de maribondo foi preencher a PR e viu que as condições não estão adequadas João iniciou a tarefa mas ele não conseguiu ele vai pausar a tarefa aí vai ter um motivo qual o motivo a local inseguro e foi identificado na PRAí tem, vai ter uma foto de evidência. Aquela atividade fica pausada. Passou-se 10 dias, Pedro volta lá no local, ao Pedro vai assumir a tarefa e ele vai fazer, vai refazer uma nova PRAPR do João. Eu falei, João na primeira.

### 9:29 — Matheus Sa de Araujo Miranda
Is it?

### 9:41 — Iago Lunar Rangel Raich
Continua lá, só que vai ser gerado uma nova PR agora do Pedro que foi lá e ele vai fazer novamente todo o checklist. Tá OK, show de bola, segue para a execução da ordem de serviço. Não tá OK do Pedro, não tem problema.

### 9:41 — Matheus Sa de Araujo Miranda
Good.

### 9:41 — Mario Stevan do Nascimento Santos
Yes.

### 9:42 — Matheus Sa de Araujo Miranda
Pausar.

### 9:56 — Iago Lunar Rangel Raich
Ele encerra a APR, ela não vai deixar executar a ordem e aí vai ter que postergar para a próxima pessoa que for lá até chegar em um momento em que um operador for lá e executar a APR e ele fazer com que todos os critérios da APR sejam.Aceitos, digamos assim, é aí sim, libera para ele poder executar a ordem de serviço. O que acontece com as outras APRs que foram preenchidas? Não tem problema, elas vão ficar de histórico para quando a pessoa for consultar a ordem de serviço.

### 10:17 — Matheus Sa de Araujo Miranda
You.Okay.

### 10:31 — Iago Lunar Rangel Raich
Passou 6 meses, eu quero ver o que aconteceu lá no na estação XPTO. Aí o cara abre lá e caramba, teve 3 APRs aqui, cara, aqui foi tenso. Será que resolveram o problema? OPA, o Felipe é na.

### 10:36 — Matheus Sa de Araujo Miranda
Desculpe.

### 10:46 — Iago Lunar Rangel Raich
Quarta vez que voltou lá, já tinham sanado o problema do marimbondo. O Felipe botou aqui a evidência, beleza? Tem uma foto aqui e a APR do Felipe contemplou todos os critérios para a execução da atividade. Show de bola!Segue a vida!

### 11:03 — Matheus Sa de Araujo Miranda
Isso. Mas aí não seria, por exemplo, no caso, a primeira pessoa ali que estava preenchendo a PR. Aí ela viu que deu um problema, ela não vai fazer a execução da PR, vai ficar pausada conforme você disse.

### 11:20 — Iago Lunar Rangel Raich
Isso, atividade, no caso.

### 11:23 — Matheus Sa de Araujo Miranda
Isso a atividade aí, no caso, não é perca de tempo e outras pessoas realizar o serviço sem antes já ter já ter resolvido o que colocou na primeira verba. Não seria assim uma perca de tempo de pessoas indo lá para verificar, ao invés de, por exemplo, ficou pausada.Essa obra, esse serviço foi causado porque não teve como a execução. E aí, no caso, tem uma forma para se realizar a execução e depois chamar o próximo pessoa para fazer o serviço.

### 11:55 — Mario Stevan do Nascimento Santos
Eu acho, eu nesse conceito tenho, eu entendi. É, por exemplo, vamos supor que lá na BR ele preenche, beleza, marcou não e ele não conseguiu executar aquela ordem de serviço. Aquela ordem lá vai continuar pendente, tá? O que que vai acontecer?

### 11:55 — Iago Lunar Rangel Raich
O.

### 12:10 — Mario Stevan do Nascimento Santos
No entendimento, tá? Aí vamos supor que vai dar o mês que vem. Foi executado esse mês, mês que vem ele vai lá novamente. Ele vai ter que abrir outro OIS para aquele mesmo serviço. Ele vai, vai fazer o checklist. Ah, tá tudo OK.

### 12:15 — Matheus Sa de Araujo Miranda
Mhm.Santos.

### 12:26 — Mario Stevan do Nascimento Santos
Ah, mas e a outra ordem que ficou pendente lá?O Iago, eu não sei se ele pode ter a autonomia dele mesmo encerrar aquela ordem que estava pendente e essa ordem que está neste mês agora, ela vai ser vinculada àquela passada, entendeu? Ele pode falar ordem executada tal. Pronto, acabou-se o fluxo.

### 12:32 — Matheus Sa de Araujo Miranda
Santos.Yeah.Okay.Okay.Yep.Okay.

### 12:47 — Mario Stevan do Nascimento Santos
Entendeu? E ela como pendente ali, como Iago que tipo assim, vamos supor que o Iago tem um usuário master aí no app, ele vai e finaliza ela lá, ordem executada, aí ela sai do fluxo e sai da roda, entendeu?

### 12:49 — Matheus Sa de Araujo Miranda
Okay.Rangel Sala.I'm good.Tá, entendi.

### 13:01 — Iago Lunar Rangel Raich
Bom, o Mario só bom no meu conceito, a ordem não deveria ser encerrada para não gerar redundância, tá? Senão você tem 2 atividades, 2 ordens, 3, 4 para o mesmo.

### 13:05 — Matheus Sa de Araujo Miranda
Okay.Santos.O.

### 13:17 — Iago Lunar Rangel Raich
Pro mesmo serviço. Então, tipo assim, o cara foi lá fazer uma calibragem, João foi lá, tem, abriu uma ordem, foi fazer uma calibragem, chegou lá, tem um maribondo, ele fez a PR, não foi possível executar atividade. Ele vai fechar a ordem mesmo sem ela estar executada. Isso bom.

### 13:18 — Matheus Sa de Araujo Miranda
Okay.It is a long time.I really.So.

### 13:32 — Mario Stevan do Nascimento Santos
Não, ela fica pendente.

### 13:32 — Iago Lunar Rangel Raich
Hoje isso não, então perfeito aí.

### 13:35 — Mario Stevan do Nascimento Santos
Ela fica pendente no app, entendeu?

### 13:36 — Matheus Sa de Araujo Miranda
E fica histórico, aí fica lá de fora.

### 13:38 — Mario Stevan do Nascimento Santos
Fica em histórico lá, aí quando gerar para o próximo mês, o que vai acontecer? Vai, ele vai, outra pessoa vai executar essa ordem e você como tendo um usuário master dentro do app, você mesmo pode, tipo assim, como ela vai estar lá pendente?

### 13:38 — Iago Lunar Rangel Raich
E não, show de bola.

### 13:54 — Mario Stevan do Nascimento Santos
Gera o outro, ele vai, outra pessoa executa e você fecha essa ordem aí, só você consegue fechar e essa ordem, por exemplo, foi no mês passado, deste mês, você pega essa que está deste mês e vincula aquela lá, entendeu? Igual já aconteceu.

### 14:09 — Matheus Sa de Araujo Miranda
Fell yeah.

### 14:09 — Iago Lunar Rangel Raich
Então, Mario, a ideia, até pegar um pouco aqui do outro time, como é que eles fizeram, tá? É O fluxo lá está o seguinte a pessoa chega lá para É aberta a ordem de serviço. Quem abre a ordem de serviço geralmente são as áreas ou eu.

### 14:18 — Matheus Sa de Araujo Miranda
Okay.

### 14:27 — Iago Lunar Rangel Raich
Perfeito é a gente designa pro pra equipe show aí a equipe mandou o cara lá show o cara executou a perdão não executou chegou lá para executar atividade preencher a pr deu negativo tipo não não tem algum critério que não atendeu

### 14:27 — Mario Stevan do Nascimento Santos
Mm-hmm.

### 14:44 — Iago Lunar Rangel Raich
Não tem problema, ele vai pausar a atividade e ela fica lá no sistema pendente, beleza? Aí, no outro dia, o.O outro cara vai lá, ele vai retomar a atividade e ele vai ter que preencher uma nova PR. Aí, beleza, ele não conseguiu concluir a atividade. Ele vai pausar de novo e a atividade vai continuar em aberta. Vai chegar nenhum outro dia, outro vai.

### 15:05 — Matheus Sa de Araujo Miranda
Mhm.

### 15:09 — Iago Lunar Rangel Raich
quiser retomar o cara vai tipo é tipo o cara tem que dar um Play mesmo para executar Inclusive tem um time para quando o cara inicia a atividade fica contando porque depois eles querem usar tipo um indicador de tempo que o cara tá gastando para executar a atividade

### 15:10 — Matheus Sa de Araujo Miranda
Santos.Okay.Você é o fluxo?

### 15:26 — Iago Lunar Rangel Raich
Entendeu aí?

### 15:26 — Mario Stevan do Nascimento Santos
Eu entendi. No caso, aí é porque, como eu participei da primeira, eu entendi, eles vão querer ficar com o looping lá.

### 15:29 — Matheus Sa de Araujo Miranda
Okay.

### 15:30 — Iago Lunar Rangel Raich
Quem vai encerrar e outra, quem vai encerrar a ordem de serviço não é eu mais não Mario, é o próprio usuário. O usuário vai iniciar, vai preencher a PR, vai iniciar a atividade e vai encerrar ela. E isso vai fazer com que o status do SAP lá da ordem de serviço saia de pendente.

### 15:31 — Matheus Sa de Araujo Miranda
Okay.Okay.

### 15:50 — Iago Lunar Rangel Raich
pra encerrado, entendeu? Eh

### 15:51 — Mario Stevan do Nascimento Santos
Entendi, sai de ente pra sai de livre pra ente, entendi.

### 15:54 — Matheus Sa de Araujo Miranda
I think.

### 15:54 — Iago Lunar Rangel Raich
Hi.Isso exatamente aí, independente de quem é executor, podem ter mais de um executor, tá? É a atividade, porque nem toda atividade ela é encerrada no mesmo dia. Inclusive, a gente usou até o exemplo do da inspeção de rede lá.

### 15:58 — Matheus Sa de Araujo Miranda
Okay.Okay.

### 16:13 — Iago Lunar Rangel Raich
pessoal que acompanha a obra em campo às vezes começa com um e termina com o outro e é 10 dias a obra 15 dias a obra aí eles fazem botar até um timerzinho porque a gente consegue dimensionar aí ficou legal para caramba

### 16:13 — Matheus Sa de Araujo Miranda
Santos.

### 16:13 — Mario Stevan do Nascimento Santos
Mhm.

### 16:15 — Matheus Sa de Araujo Miranda
Segu

### 16:15 — Mario Stevan do Nascimento Santos
Sim.

### 16:21 — Matheus Sa de Araujo Miranda
Okay.

### 16:21 — Mario Stevan do Nascimento Santos
Mm-hmm.

### 16:23 — Matheus Sa de Araujo Miranda
No.

### 16:27 — Mario Stevan do Nascimento Santos
Aline.

### 16:27 — Matheus Sa de Araujo Miranda
Okay.Iago Mario, só para confirmar se para ver se o entendimento é esse mesmo, tá? É uma ordem de serviço, ela vai poder essa ordem de serviço de manutenção de obra, ela vai poder ser encerrada, dado como concluída, mesmo que exista ainda alguma PR que está lá como pendente ou pausada.

### 16:44 — Iago Lunar Rangel Raich
Não, não. Sempre que alguém chegar lá para executar a atividade, o primeiro documento que a pessoa preenche é a PR, se ela tiver uma negativa já no primeiro preenchimento da PR, ele não executa a atividade, nem libera a aba de ordem de serviço.

### 16:45 — Matheus Sa de Araujo Miranda
Não.Steve.Okay.Mas aí no outro dia, aí vamos colocar o cenário assim, uma equipe foi lá um dia, uma equipe, 12 eletricas, enfim, foi lá um dia para atender essa obra aí de manutenção. Aí tá, negou beleza, entendemos. No outro dia foi uma outra equipe lá e essa segunda.

### 17:14 — Iago Lunar Rangel Raich
Uh-huh.Vai ter que refazer.

### 17:20 — Matheus Sa de Araujo Miranda
Isso, refazer a pr e essa segunda equipe deu aprovado dentro do que?

### 17:23 — Iago Lunar Rangel Raich
Aí segue para a aba de preenchimento da ordem de serviço, aí inicia o trabalho, digamos assim.

### 17:28 — Matheus Sa de Araujo Miranda
I.Inicia o trabalho, tá beleza? Aprovou a PR e foi para iniciar o trabalho de execução da ordem de serviço. Beleza, finalizou a ordem de serviço e concluiu o serviço. Essa equipe, ela pode finalizar a ordem de serviço, mesmo que anteriormente.

### 17:40 — Iago Lunar Rangel Raich
Perfeito.

### 17:45 — Matheus Sa de Araujo Miranda
Teve uma APR negada porque vai ter um histórico, não é negada aprovado, pode.

### 17:48 — Iago Lunar Rangel Raich
Sim, isso, isso aí, isso aí.

### 17:50 — Mario Stevan do Nascimento Santos
Okay.

### 17:52 — Matheus Sa de Araujo Miranda
Entendi, aí vai vai ter um histórico que a gente vai ver todas as APR e logicamente a gente só vai concluir uma ordem de serviço quando APR for dado como OK, como se.

### 17:52 — Iago Lunar Rangel Raich
See?OK, é exatamente. No caso, a APR que foi OK foi a segunda APR.

### 18:06 — Matheus Sa de Araujo Miranda
Aham, beleza, não só para entender. E aí quem vai fechar essa ordem de serviço é quem está executando de fato, o quem está lá no campo executando essa ordem de serviço.

### 18:13 — Iago Lunar Rangel Raich
Yeah.Exatamente, e quem e essa pessoa tem que a PR dela tem que ter sido é OK?

### 18:22 — Mario Stevan do Nascimento Santos
Qualidade.

### 18:22 — Matheus Sa de Araujo Miranda
Sim, beleza. Então, Iago, a gente entendeu agora essa parte da questão de conteúdo histórico, mas eu acho que o que o Renan estava falando, que ele acabou não concluindo, é o que antes a gente tinha a ideia de que assim que é uma.

### 18:23 — Iago Lunar Rangel Raich
Say.

### 18:39 — Matheus Sa de Araujo Miranda
Um campo de preenchimento que fosse eliminatório, a pessoa marcasse como que ele não pode realizar, a gente pararia. É a APR e ela já seria bloqueada. Só que aí o que a gente identificou, tipo, vamos supor que, por exemplo, nessa ordem de manutenção.Aconteceu de que aqui eu marquei o primeiro campo, não. Só que talvez lá embaixo, nos outros Campos da PR, eu também teria um outro problema que ele não foi visualizado, porque aí aconteceu esse corte de que eu não posso mais preencher a PR. Aí o que a gente chegou em conclusão foi o quê?A gente deixa ATR, a pessoa vai preenchendo todos os Campos e aí só depois que ela analisou todos que ela vai poder como se fosse submitar o formulário e aí ela entraria.

### 19:24 — Iago Lunar Rangel Raich
Eu estou de acordo, tá? É isso aí mesmo que vocês falaram, é, pode liberar mais opções. Só após AO preenchimento de todos o sistema é irá validar se pode seguir para execução ou não da atividade.

### 19:32 — Matheus Sa de Araujo Miranda
Music.O que a gente é o que eu estou pensando aqui agora, por exemplo, aí a pessoa, ela não conseguiu terminar a PR igual você falou lá da caixa de marivondo.Aí, beleza, aí depois que o sistema foi validar, aí o sistema aí ele localizou que tem ali algumas coisas que a pessoa colocou que seria eliminatório para a pessoa não executar o serviço, fazer o que era necessário. Aí, no caso, a gente.

### 20:07 — Iago Lunar Rangel Raich
Mhm.Uma evidência, né?

### 20:26 — Matheus Sa de Araujo Miranda
Registrar uma evidência do motivo pelo qual, por exemplo, o próprio sistema reconhecer. Então aí já tem isso. A gente vai mostrar isso no relatório para ele reconhecer e ter uma prova de que realmente não foi executado por causa.

### 20:30 — Iago Lunar Rangel Raich
Yes.Sing.É com certeza o coordenador ou supervisor vai querer saber o motivo, é?

### 20:41 — Matheus Sa de Araujo Miranda
Okay.

### 20:43 — Mario Stevan do Nascimento Santos
Vão pedir. Bacana.

### 20:44 — Matheus Sa de Araujo Miranda
Exato, ele vai. E aí ele vai, ele vai conseguir ter uma. Ele vai visualizar de forma concreta de que aquilo não foi realizado por causa DeX fator.

### 20:54 — Iago Lunar Rangel Raich
Isso aí pode total de acordo, tá? É isso mesmo.

### 20:59 — Matheus Sa de Araujo Miranda
Um exemplo que vocês tinham dado na outra reunião era que um motivo para uma pessoa poder não fazer 11 serviço seria por ordens psicológicas. Então como que ele iria?

### 20:59 — Mario Stevan do Nascimento Santos
Okay.

### 21:13 — Matheus Sa de Araujo Miranda
Poder comprovar isso na APE, já que se for um problema físico, ele consegue tirar foto e anexar, mas e se for um problema psicológico?

### 21:22 — Iago Lunar Rangel Raich
então vamos lá aí vai acho que vai dar boa da boa índole da pessoa e também tem algumas atividades são executadas em duplas tá se o parceiro dele entender que o colega não tá

### 21:23 — Mario Stevan do Nascimento Santos
Switch you.

### 21:34 — Matheus Sa de Araujo Miranda
Okay.

### 21:37 — Iago Lunar Rangel Raich
apto para executar ele vai preencher a pr e ele não vai executar é inclusive é a gente tem até na regra de ouro direito de recusa tá se o colaborador não está em condições de executar ele pode simplesmente não executar depois ele justifica porque com o supervisor coordenador dele mas elePode recusar, tá? A executar a atividade, não pode ser uma coisa que não pode acontecer e se colocar em risco, tá bom?

### 22:05 — Matheus Sa de Araujo Miranda
Acabei de pensar num negócio que surgiu a partir do que você falou. Uma APR precisa ser validada pelos outros membros da equipe de execução. Por exemplo, você acabou de falar que são duas pessoas realizando o serviço.

### 22:17 — Iago Lunar Rangel Raich
No.

### 22:22 — Mario Stevan do Nascimento Santos
Sim, o preenche.

### 22:22 — Iago Lunar Rangel Raich
Sempre, sempre vai ter um líder, sempre vai ter um líder. Tipo assim, por exemplo, vai ter uma atividade de movimentação de carga e tem 10 pessoas. É uma pessoa só que preenche a PR. Geralmente vai ser a pessoa que vai coordenar entre aspas ou gerenciar a atividade.

### 22:25 — Matheus Sa de Araujo Miranda
Okay.Response.Okay.

### 22:40 — Iago Lunar Rangel Raich
Ah, eu tô sozinho, só eu mesmo preencho. Ah, não tem eu e mais 5. Vai ser uma PR e essa PR que esse esse cara tá preenchendo é que é equivalente ao documento da ordem. Ele já vai é fazer uma análise.

### 22:44 — Matheus Sa de Araujo Miranda
So

### 22:55 — Iago Lunar Rangel Raich
Preliminar de risco para todo mundo que está na atividade. Então ele vai ver se tem se o buraco, se a vala que está em condições, se a escada está em boas condições, se o pessoal está usando EPI, aí é a pessoa que vai assumir meio que a liderança da atividade que vai preencher.

### 23:04 — Matheus Sa de Araujo Miranda
Okay.Show, show you my microphone.

### 23:14 — Iago Lunar Rangel Raich
Eu entendo o que é isso, né Mario?

### 23:17 — Mario Stevan do Nascimento Santos
É isso, é tanto é que quando tem uma preenchimento de uma BR o todo é um preenche, mas todos estão ali em volta ali participando, entendeu?

### 23:24 — Iago Lunar Rangel Raich
It's bone, is it?

### 23:26 — Mario Stevan do Nascimento Santos
Porque se vamos supor que tem uma inspeção de segurança, todos tem que estar a parte do que dos riscos que está associado.

### 23:32 — Matheus Sa de Araujo Miranda
It is

### 23:33 — Iago Lunar Rangel Raich
C.

### 23:36 — Matheus Sa de Araujo Miranda
Aí, para dar sequência, o fluxo aqui, ele finaliza basicamente com o que a gente acabou de discutir a.Ela, a gente aprova a pr, ele tem que assinar, inicia a execução. Ele pode interromper durante o fluxo ou dar ela como encerrada para poder finalizar e registrar.

### 23:57 — Iago Lunar Rangel Raich
Efeito.

### 23:58 — Matheus Sa de Araujo Miranda
A gente vai mostrar, pode falar.

### 23:59 — Iago Lunar Rangel Raich
I.E aí eu não sei se vocês tem um é interessante tá ter o botão de início e pausa e fim por exemplo o cara foi executar a atividade fez a pr terminou de submeter deu submit lá na na PR beleza

### 24:02 — Matheus Sa de Araujo Miranda
What?It.Not that is.Okay.

### 24:19 — Iago Lunar Rangel Raich
Aí ele tem que ter um botãozinho lá, iniciar a atividade, pum, iniciar a ordem, iniciar o serviço. Aí é interessante já meio que computar a hora, a hora e a data que ele está é que ele começou a atividade.

### 24:27 — Matheus Sa de Araujo Miranda
I don't know.

### 24:35 — Iago Lunar Rangel Raich
Aí vamos supor que ele tem que fazer uma pausa para o café, pausa para o horário de descanso. É interessante também ter uma pausa e esse botão de pausa também computar com o tempo de pausa que ele está fazendo. Por quê?

### 24:38 — Matheus Sa de Araujo Miranda
ButSo yeah.It isTipo assim, tipo, tem um pronome, tipo assim, eu iniciei, começa a cronometrar, cadê o nome? Parei, pausa a cronometragem, tipo isso que seria.

### 24:54 — Iago Lunar Rangel Raich
Yeah.E isso o da pausa é mais para a questão do tipo assim, pô, o cara está fazendo quanto tempo de horário de almoço? Com certeza o coordenador supervisor vai querer saber, pô, a atividade não está rendendo, cara. Deixa eu ver quanto tempo de almoço esse cara está fazendo.

### 24:58 — Mario Stevan do Nascimento Santos
Yes.

### 25:01 — Matheus Sa de Araujo Miranda
It.Isis.Okay.No.No.Quanto tempo is that?

### 25:11 — Iago Lunar Rangel Raich
Aí vai olhar, é, entendeu? E o de fim? E o botão de fim seria mesmo para computar o fim da atividade e o encerramento da ordem. Então, tipo assim, encerrou, ele vai pegar o horário e a data de encerramento.

### 25:18 — Matheus Sa de Araujo Miranda
Okay.

### 25:26 — Iago Lunar Rangel Raich
E automaticamente também atualiza o status lá da ordem de serviço, que de aberto, de liberado, ela vai para encerrado.

### 25:27 — Matheus Sa de Araujo Miranda
Okay.Okay.Show. A gente nem tinha pensado nessa parte de monitoramento, não. A gente tava só Pensando sobre o registro, mas a gente vai implementar isso também.

### 25:43 — Iago Lunar Rangel Raich
É porque o SAP, ele tem isso de ele pega o início é e o fim da atividade, ele tem a data e a hora, inclusive.

### 25:45 — Mario Stevan do Nascimento Santos
Okay.

### 25:48 — Matheus Sa de Araujo Miranda
OK, então não sabe?

### 25:51 — Mario Stevan do Nascimento Santos
Isso é bom até também para por indicador, sabia?

### 25:54 — Iago Lunar Rangel Raich
É, e eu não sei se tem tal uma assinatura.

### 25:58 — Matheus Sa de Araujo Miranda
baixa produtividade, se está com baixa produtividade alta, aí consegue ver por aqui, ver o desempenho deles. E a mérito é algo assim que os profissionais, eles já acabam recebendo.

### 26:02 — Mario Stevan do Nascimento Santos
He's free.

### 26:03 — Iago Lunar Rangel Raich
Yeah.

### 26:06 — Mario Stevan do Nascimento Santos
Isso aí.

### 26:07 — Iago Lunar Rangel Raich
See.

### 26:13 — Matheus Sa de Araujo Miranda
He.

### 26:13 — Iago Lunar Rangel Raich
É outra. Eu tinha pensado aqui em outra, é assinatura, assinatura digital da ordem ou assinatura, uma rubrica. Vocês conseguiram botar algo nesse sentido também?

### 26:23 — Matheus Sa de Araujo Miranda
A gente anotou isso também.

### 26:24 — Iago Lunar Rangel Raich
Perfect.

### 26:25 — Matheus Sa de Araujo Miranda
É a assinatura vai ser um ponto muito interessante. A gente criou uma espécie de perfil para cada usuário, aonde ele vai registrar a assinatura dele. Tem assinaturas padrões, como, por exemplo, no Gov, tem também, e existe assinatura que ele.

### 26:39 — Iago Lunar Rangel Raich
Mm-hmm.

### 26:39 — Mario Stevan do Nascimento Santos
Mm.

### 26:41 — Matheus Sa de Araujo Miranda
Irá fazer a rubrica ou por extenso.

### 26:44 — Iago Lunar Rangel Raich
Perfeito, perfeito.

### 26:45 — Mario Stevan do Nascimento Santos
Maravilha.

### 26:47 — Matheus Sa de Araujo Miranda
mais profissional deixar isso no escopo não implementar isso agora a gente vai basicamente mostrar o fluxo que a gente mostrou aqui com fluxograma mas agora noNo protótipo.

### 27:03 — Iago Lunar Rangel Raich
Okay.

### 27:04 — Matheus Sa de Araujo Miranda
Aqui é a primeira tela de login. Se o usuário estiver offline, ele consegue logar mesmo estando offline, se ele já tiver feito login online, pelo menos durante 7 dias.Depois de logar a gente tem essa é a primeira tela.

### 27:22 — Iago Lunar Rangel Raich
Perfeito.

### 27:23 — Matheus Sa de Araujo Miranda
Essa é a primeira tela, aparece aqui as OSs de e para poder iniciar, ele só escolhe OS, aparece as informações da OS, ele inicia APR.E aparece aqui, aqui a gente tinha pensado sobre uma APR valer para mais de uma OS.E aqui os participantes que são foram designados para fazer aquela atividade. Isso aqui é bastante uma chamada, pode falar.

### 27:51 — Iago Lunar Rangel Raich
Cara.Então, tá legal, só que eu não colocaria uma APR para cada OS. Por quê? Elas são atividades distintas. Por mais que elas sejam na mesma localidade, elas envolvem riscos diferentes.

### 28:08 — Mario Stevan do Nascimento Santos
diferentes.

### 28:09 — Iago Lunar Rangel Raich
Então, por exemplo, o cara que vai fazer uma calibragem de uma válvula é tem um risco muito menor, por exemplo, de quem vai trabalhar no espaço confinado ou um trabalho de altura e.

### 28:11 — Matheus Sa de Araujo Miranda
I think that's fine.No.Então, cada Oeste teria que ter uma PR separado.

### 28:26 — Iago Lunar Rangel Raich
Exatamente.

### 28:27 — Mario Stevan do Nascimento Santos
isso aí e é o que é hoje cada OS tem uma PR diferente porque os riscos mudam

### 28:29 — Matheus Sa de Araujo Miranda
Find eight.

### 28:30 — Iago Lunar Rangel Raich
Vinculado isso aí.

### 28:30 — Matheus Sa de Araujo Miranda
No.Danilo Fernando Mendes. Oi, Iago, deixa eu te fazer uma pergunta.

### 28:39 — Iago Lunar Rangel Raich
Pode falar.

### 28:39 — Matheus Sa de Araujo Miranda
Não é o seguinte, a gente estava na dúvida que a ordem de manutenção é como se ela fosse uma ordem de serviço.

### 28:47 — Iago Lunar Rangel Raich
Isso.

### 28:48 — Mario Stevan do Nascimento Santos
Yes.

### 28:49 — Matheus Sa de Araujo Miranda
E aí vamos supor que, por exemplo, já é dividido dessa forma. Vamos supor que eu tenho serviço 84, 797 e um outro serviço. Esses serviços tem a um tipo de APR. E aí, por exemplo, eu tenho outro conjunto de tipos.De APR. E aí eles são, é, eu só e eu tenho um segundo tipo de APR que tem outros serviços. É dividido dessa forma.

### 29:08 — Iago Lunar Rangel Raich
If.Yeah.Eu vou te explicar como é que funciona, inclusive o Marquinho vai chamar vocês aí, você e o outro time que ele vai passar um.

### 29:19 — Matheus Sa de Araujo Miranda
Okay.O vocês de se de se de se de se de se

### 29:25 — Iago Lunar Rangel Raich
Uma tarefa a mais aí é hoje, mas já vou adiantar para vocês, hoje na S Gus a gente tem acho que 8 tipos de APR, então para cada tipo de atividade tem um tipo de APR. Ah, é só um acompanhamento.

### 29:29 — Matheus Sa de Araujo Miranda
Wait.It.Okay.Yes.

### 29:40 — Iago Lunar Rangel Raich
Vai ser uma APR. É um trabalho em altura, é um outro tipo de APR. É um trabalho em espaço confinado, é um outro tipo de APR. É só uma manutenção simples de uma válvula, é outro tipo de APR. Se eu não me engano, a gente tem 7 ou 8 tipos já.

### 29:47 — Matheus Sa de Araujo Miranda
Customer.Okay.Santos.alguém é para ficar com a daqui 2

### 29:58 — Iago Lunar Rangel Raich
No.

### 30:01 — Matheus Sa de Araujo Miranda
I want to.

### 30:03 — Iago Lunar Rangel Raich
Hello, hello, hello, você está me ouvindo?

### 30:04 — Matheus Sa de Araujo Miranda
Pode falar aqui?

### 30:06 — Iago Lunar Rangel Raich
Então é, eu estava falando mutada.

### 30:10 — Matheus Sa de Araujo Miranda
Okay.It's.Okay.

### 30:32 — Iago Lunar Rangel Raich
tenho uma atividade em espaço confinado o checklist dessa PR vai ser de um jeito Ah eu tenho um eu tenho um trabalho em altura aqui vou ter que fazer um instalar umUma placa solar numa estação, aí é um outro tipo de APR que aí envolve risco de altura, escada, EPI, é, tem que ter um ponto de apoio, enfim, é já o que trabalha em espaço confinado, por exemplo, o cara vai ter que fazer a medição do.Do da qualidade do ar. O cara vai ter que ver se não tem vazamento, o cara vai ter que ver se tem escora. Se for mais que 1 m e 20, ele tem que botar umas escoras. Se for um espaço confinado, menos que 1 m e 20, ele não precisa de escora. Tem que ter.

### 31:18 — Matheus Sa de Araujo Miranda
Yeah.

### 31:20 — Iago Lunar Rangel Raich
O colega em condições tem que ter um tripé. Enfim, para isso, hoje a gente tem em torno de 7 a 8 tipos de APR. Aí é o Marcos até vai passar um desafio para vocês aí em breve.

### 31:32 — Matheus Sa de Araujo Miranda
Uh.Oi, Iago, deixa eu deixa eu te fazer uma pergunta, porque assim é o que a gente está tentando fazer, é meio que deixar o sistema mais prático para quem está utilizando ele, no caso a pessoa que está lá em campo.

### 31:36 — Iago Lunar Rangel Raich
Fight.Okay.

### 31:50 — Matheus Sa de Araujo Miranda
É a APR. Quando a gente pensou nesse modelo de APR, a gente pensou num formato que fosse umas respostas meio que manteria em algum local para meio que armazenar e ela poder reutilizar o.Para reutilizar o as respostas de uma PR é para de uma PR para outra PR. Aí a minha. A minha questão que fica aqui é a seguinte, a gente poderia manter esse modelo para.

### 32:12 — Iago Lunar Rangel Raich
Já foi preenchido, né?

### 32:23 — Matheus Sa de Araujo Miranda
Para BR em si, fazer no caso o cara poder reaproveitar. Vamos supor, vamos supor assim, o cara teve 2 OS. Por mais que as duas eu entendi essa particularidade, até comentei com os meninos e essa foi o ponto que a gente levantou para tirar até dúvida com vocês. Por quê?

### 32:25 — Iago Lunar Rangel Raich
Cara.

### 32:40 — Matheus Sa de Araujo Miranda
Porque pode ser que tenha a mesma OS. Vamos colocar que são 2 salas no mesmo, no mesmo local, mas são 2 salas diferentes. Aí uma sala está pintando, a outra não. Será que daria para pegar um quadro nas 2 salas? Não daria. Então não pode ser a mesma resposta para.Para para as duas APR, uma APR estaria como sim, a outra PR estaria como não, certo?

### 32:58 — Iago Lunar Rangel Raich
Here is.É isso que eu ia falar, cara, o ideal, o mundo ideal tá é a gente não deixar nada pré-preenchido, porque a ideia é essa mesmo, é o cara ele fazer o checklist e ele é estar ciente daquilo que ele está averiguando. Então, tipo assim.

### 33:16 — Matheus Sa de Araujo Miranda
Okay.

### 33:18 — Iago Lunar Rangel Raich
Pô, ele tem que ver a condição da qualidade do da atmosfera. Eles têm o explosímetro. Aí se o cara bota ali uma PR já pré preenchida ou já que já foi preenchida, tipo assim, é mês passado, ele foi lá fazer a inspeção, beleza?

### 33:26 — Matheus Sa de Araujo Miranda
Isis.

### 33:33 — Iago Lunar Rangel Raich
Ele fez, preencheu bonitinho, OK? Ele fez o checklist todinho, acompanhou cada etapa do checklist e ele estava em condições. Beleza, no mês que vem ele vai lá novamente, fazer a mesma medição e cara de verdade, o usuário comum, ele quer ir pelo lado mais fácil. O que ele vai fazer? Vai pegar aquela que já tá.pré-preenchida e vai usar ela. Aí é a hora que a gente dá brecha para o cara não fazer, por exemplo, uma medição do da qualidade da atmosfera. Aí o cara vai lá e vai e passa esse checklist, porque ele botou o que já está.

### 33:52 — Matheus Sa de Araujo Miranda
Mhm.

### 34:05 — Iago Lunar Rangel Raich
Meio que pré-preenchido e ele usa o celular. Aí explode a estação, explode o cara, porque tinha um vazamento.

### 34:14 — Matheus Sa de Araujo Miranda
Não, eu super, eu super entendo, eu super entendo.

### 34:16 — Iago Lunar Rangel Raich
Aí, então, cara, é no meu ponto de vista, tem que deixar o cara na responder cada questionamento, cada perguntinha da PR toda vez que ele for executar, porque ele tem que analisar tudo, cara, pô, eu tô fazendo isso.Toda semana, cara, você vai preencher toda semana, porque você tem que averiguar cada situação toda semana, porque é a vida dele que está em risco, cara, entendeu?

### 34:40 — Matheus Sa de Araujo Miranda
Então a gente pode definir assim, é, seria uma OS, uma PR, não pode fazer 3, pode ser que seja 3 OS na mesma PR, mas não poderia ter as mesmas respostas, ou seja.

### 34:47 — Iago Lunar Rangel Raich
Is.

### 34:56 — Matheus Sa de Araujo Miranda
Pode ser a mesma pergunta. A OS pode ter as mesmas perguntas de de a PR, porém ela não pode ter as mesmas respostas. O usuário ele vai ter que atendimento. Espera aí.

### 34:58 — Iago Lunar Rangel Raich
Isisi?Não, tipo assim, a APR ela vai ser um checklist padrão. A APR ela já tem, eu já eu mandei para vocês o documento, o zip da APR, então todas elas já tem um checklist padrão. As perguntas vão ser as mesmas, o que não vai ser as mesmas são as respostas.E a resposta é é zero ou um é sim ou não da é então tipo assim é esse é o critério se o cara botar um não lá então ele para atividade não executa se ele botar sim sim sim beleza mas ele verificou que tá tudo certo na próxima semana ele volta lá ele responde tudo de sim sim sim de novo

### 35:23 — Matheus Sa de Araujo Miranda
Is it?

### 35:38 — Iago Lunar Rangel Raich
Beleza, na outra semana ele volta lá de novo. Ele respondeu sim, não, sim, OPA, aqui agora ele já não pode nem executar a atividade. Tem alguma coisa que está fora do correto, entendeu? É aí, outra coisa.

### 35:51 — Matheus Sa de Araujo Miranda
Okay.

### 35:53 — Iago Lunar Rangel Raich
É o que o Marcos vai passar pra vocês. Eu já falei até um pouquinho atrás. Vão para cada tipo de atividade, tem um tipo de APR. Então, por exemplo, é uma calibragem, vai ter uma APR e vai ter um checklist definido. Ah, é um trabalho em altura, vai ter uma outra APR.

### 36:02 — Matheus Sa de Araujo Miranda
I just give that.

### 36:12 — Iago Lunar Rangel Raich
com outro check list completamente diferente do que da que tem na calibragem Clara que vai ter uma outra pergunta que vai ser similar igual essa da se a pessoa tem condições psicológicas por essa padrão vai ter em todas mas a outra uma vai ter tipo assim é o trabalho tem sei lá a escada está em condiçõesde bala em altura não tem porque botar essa pergunta de escada na perde de calibragem por exemplo entendeu Oi

### 36:39 — Matheus Sa de Araujo Miranda
Oh yeah.Essa era uma das perguntas que a gente vai fazer, porque você acabou de falar que, dependendo do serviço, é uma PR diferente. Você já tem alguma lista ou algum lugar catalogado? São muito, são muito.

### 36:50 — Iago Lunar Rangel Raich
Steam.São é eu no Zip tem 8 tipos de APRs. Acho que são isso, 8 ou 7.

### 36:57 — Matheus Sa de Araujo Miranda
Então, mas é, vocês tem, vocês tem algum tipo de lugar? Quais são os serviços que tem que usar essas APRs?No.

### 37:06 — Iago Lunar Rangel Raich
Eu acho que a própria PR ela tem na descrição dela, eu não é porque eu não estou me lembrando agora.

### 37:10 — Mario Stevan do Nascimento Santos
Ela descreve para qual tipo de serviço?

### 37:14 — Iago Lunar Rangel Raich
É, tem na descrição dela.

### 37:15 — Matheus Sa de Araujo Miranda
I don't that.

### 37:16 — Mario Stevan do Nascimento Santos
Por exemplo, se você trabalha em altura, tem um tipo GPR que tá nela escrito lá, trabalha em altura.

### 37:22 — Iago Lunar Rangel Raich
Say.

### 37:23 — Matheus Sa de Araujo Miranda
Thank you.

### 37:24 — Mario Stevan do Nascimento Santos
Aí o que ele falou que tem que ser, por exemplo, uma PR diferente, porque trabalhar em altura, beleza, mas os riscos mudam dependendo do local.

### 37:33 — Matheus Sa de Araujo Miranda
Não, isso foi claro. Então, na prática, o usuário, ele tem que preencher uma APR para cada OS manual. Ele é obrigado a fazer.

### 37:34 — Iago Lunar Rangel Raich
A.Isso.

### 37:41 — Mario Stevan do Nascimento Santos
I see.

### 37:43 — Iago Lunar Rangel Raich
C?

### 37:44 — Mario Stevan do Nascimento Santos
I think.

### 37:48 — Matheus Sa de Araujo Miranda
Aí, quando você começar o checklist, ele começa aqui a preencher os campos da pr a pergunta um isso aqui é só um modelozinho, não necessariamente são essas perguntas aí essa aqui, por exemplo, é uma pergunta eliminatória aí se ele apertasse não.

### 37:54 — Iago Lunar Rangel Raich
It is aOkay.

### 38:05 — Matheus Sa de Araujo Miranda
Ele impediria as próximas perguntas. Aí é como a gente tinha discutido aqui mais cedo. Na verdade, a gente não vai mais bloquear imediatamente, a gente vai deixar ele preencher até o final. Depois que ele preencher todas as perguntas, aí sim o sistema vai.Validar se ele pode ou não fazer.

### 38:23 — Iago Lunar Rangel Raich
Perfeito, podemos seguir assim.

### 38:25 — Matheus Sa de Araujo Miranda
Aqui já tem.

### 38:25 — Mario Stevan do Nascimento Santos
Oh.

### 38:27 — Matheus Sa de Araujo Miranda
Isso aí ele tem que anexar a foto para comprovar.

### 38:31 — Iago Lunar Rangel Raich
Boa.

### 38:32 — Matheus Sa de Araujo Miranda
Se ele preenche como sim, ele continua o fluxo normalmente até até o final, qualquer uma que ele preencher, que é eliminatória. Se ele preencher como não, ele tá aí.Naquela ali, está nessa aqui eu preenchi a porque eu preenchi como eu coloquei como sim, você não quer resposta, você entendeu? Não.Same, same.Pronto, todas as perguntas foram validadas como permitidas e como liberadas. Aí ele é libera para poder fazer OS.

### 39:08 — Iago Lunar Rangel Raich
Perfeito, tá top, hein?

### 39:09 — Matheus Sa de Araujo Miranda
Aí esse aqui, onde apareceria a assinatura dele, ele precisaria confirmar a assinatura.

### 39:15 — Iago Lunar Rangel Raich
Boa.

### 39:16 — Matheus Sa de Araujo Miranda
Iniciar a execução. E aí essa tela aqui que você estava falando, né? Para monitorar, aí botão de pausar, botão de encerrar, daí botão, é, pode pausar.

### 39:19 — Iago Lunar Rangel Raich
Isso, top demais.

### 39:31 — Matheus Sa de Araujo Miranda
E pode continuar.Here, name much.Essa tela aqui já é sobre a sincronização. Quando o usuário ele estava, ele realizou o serviço enquanto ele estava offline. Por exemplo, se ele precisava fazer alguma OS que era num lugar onde não tem sinal de rede, aí ele iria. Ele ia precisar sincronizar o serviço dele com.

### 39:49 — Iago Lunar Rangel Raich
Mhm.

### 39:52 — Mario Stevan do Nascimento Santos
Mm-hmm.

### 39:57 — Matheus Sa de Araujo Miranda
A com a Rangel.

### 40:00 — Iago Lunar Rangel Raich
Top demais!

### 40:02 — Mario Stevan do Nascimento Santos
Isso é muito bom.

### 40:02 — Matheus Sa de Araujo Miranda
Okay.Okay.I've seen.Essa tela aqui já é a parte do gestor. As telas que a gente estava mostrando aqui no Android era sobre a que aparece do PDA para o funcionário. Essa aqui já é o gestor, onde ele vê todas as OS, ele define, ele filtra, ele controla tudo.

### 40:21 — Iago Lunar Rangel Raich
Mhm.

### 40:27 — Mario Stevan do Nascimento Santos
Isso aí é um painel web, né?

### 40:29 — Matheus Sa de Araujo Miranda
Isis.

### 40:30 — Mario Stevan do Nascimento Santos
Ah, entendi.

### 40:43 — Iago Lunar Rangel Raich
Is.

### 40:44 — Matheus Sa de Araujo Miranda
O gestor, o supervisor, seja lá o administrador que do site, ele só teria que fazer a distribuição da OS para cada equipe.

### 40:55 — Iago Lunar Rangel Raich
Na hora que vai abrir a ordem de serviço, já é possível você definir a equipe lá, tá?

### 41:00 — Matheus Sa de Araujo Miranda
A a os, ela já vem com a equipe definida. Facilitou muito. A os, pessoal, ela já vem com uma equipe designada, então a gente não precisa fazer todo aquele controle.

### 41:03 — Iago Lunar Rangel Raich
Já com tudo, local de instalação, equipe, equipamento.

### 41:04 — Mario Stevan do Nascimento Santos
Já vem, já.

### 41:17 — Matheus Sa de Araujo Miranda
de qualquer forma que a gente pode. Vamos fazer distribuir o sistema, alguma coisa do tipo assim não, porque a gente só vai precisar fazer a leitura da equipe e distribuir para a

### 41:27 — Mario Stevan do Nascimento Santos
E disparar pra eu distribuir.

### 41:29 — Matheus Sa de Araujo Miranda
É onde você chegar uma notificação lá no pronto. É porque a gente estava pensando em como fazer a distribuição da OS para cada equipe com base no conteúdo do da OS ou sei.

### 41:42 — Iago Lunar Rangel Raich
Não, já é tudo vinculado hoje o sistema.

### 41:44 — Mario Stevan do Nascimento Santos
Dependendo, dependendo até para ajudar vocês, ou se eu não me engano em água, você lembra aquela tabelinha que eu te passei, aquela vez até te perguntei para falar sobre as equipes, você pode até disponibilizar para eles, para até eles mesmo usarem essa execução futuramente, entendeu?

### 41:50 — Matheus Sa de Araujo Miranda
Miss Martins.

### 42:01 — Iago Lunar Rangel Raich
Stop.

### 42:01 — Mario Stevan do Nascimento Santos
para disparar por aí os filters

### 42:05 — Matheus Sa de Araujo Miranda
Come with passes.

### 42:05 — Iago Lunar Rangel Raich
Beleza.Não, mas hoje tá o Matheus, o Sapo ele já faz, é 90% do que o operador precisa. A única coisa que operador vai fazer mesmo é preencher o bom, hoje é assim, ele.Escreve lá a data de início, a hora de início, a data de fim, a hora de fim, a assinatura dele e uma descriçãozinha lá do que foi executado. Porque o restante das informações a ordem já vem toda preenchida, o time, o local de instalação, o equipamento.

### 42:33 — Matheus Sa de Araujo Miranda
Yes.M e muito melhor. Mas dentro do que foi apresentado, existe alguma coisa que além da atribuição de equipe.Que tenha Aparecido e vocês queiram descartar.

### 42:53 — Iago Lunar Rangel Raich
Cara, não, tá ok o fluxo de vocês, tá? Tá legal. Acho que o que a gente já orientou aqui, acho que teve um ou dois pontos, só que a gente pediu para talvez dar uma melhoradinha, mas no geral tá ok, tá? Tô gostando.

### 43:07 — Matheus Sa de Araujo Miranda
A segunda tela aqui do gestor é onde ele vê o status da OS, é onde ele vai fazer aquele controle com base nos resultados.

### 43:17 — Iago Lunar Rangel Raich
Bom, caraca, olha isso aí que vocês fizeram, cara, tem por dentro da ordem de serviço. Tem como a tem como meio que vincular uma OS de apoio. Isso é bom.

### 43:25 — Matheus Sa de Araujo Miranda
I see.

### 43:29 — Iago Lunar Rangel Raich
É porque, igual essa da da caixa de marimbondo, o time que vai executar a calibragem não é o time que resolve o problema do marimbondo, entendeu? Aí, muito legal isso aí.

### 43:44 — Matheus Sa de Araujo Miranda
So deA próxima tela aqui já é a de importação, porque a gente não sabia como que vocês iriam, como que a gente iria receber os dados da OS. Agora, depois que vocês comentaram que existe uma API que exibe, que retorna as OS, a gente não precisa necessariamente dessa tela. Essa tela aqui basicamente iria pegar a.A Marcos OS e importar aqui e a gente precisaria fazer a distribuição depois. Mas como a gente faz aí agora a gente faria isso de forma automática. O site, o sistema iria ler a API, receber os dados da API e fazer a realização automaticamente sem precisar importar.

### 44:09 — Iago Lunar Rangel Raich
Mm-hmm.Isso aí, perfeito. Esse aí é só para a gente trabalhar de forma offline mesmo, para ter uma basezinha, né? Filé.

### 44:23 — Matheus Sa de Araujo Miranda
ButSame.Yeah.

### 44:31 — Iago Lunar Rangel Raich
Wait.

### 44:32 — Matheus Sa de Araujo Miranda
Se a gente tivesse um XLSX, no caso o Excel, uma planilha, alguma coisa simples, para você colocar ali as colunas que precisa e criar pelo menos 2 dados fake para a gente gerar aquilo ali, fazer como se fosse uma.Um dado, um banco de dados base para a gente gerar aqui, partir desse princípio com as informações todas corretas, você consegue?

### 44:53 — Iago Lunar Rangel Raich
Mhm.É, se for só pegar e preencher 2, na verdade vão ser a as eu te mandei já o XLXXLSX do que eu extraí do SAP.

### 44:59 — Matheus Sa de Araujo Miranda
Bye.Face aqui.

### 45:13 — Iago Lunar Rangel Raich
Não, esses são das APRs. Eu tenho um do SAP aqui. Deixa eu ver se eu se eu consigo compartilhar com vocês aqui.

### 45:15 — Matheus Sa de Araujo Miranda
Okay.

### 45:21 — Iago Lunar Rangel Raich
Que vem é um pacote de ordens de 2025. Aí tem todas as situações já lá nelas.

### 45:22 — Matheus Sa de Araujo Miranda
Okay.No.Play some.Você consegue mandar para a gente? Eu falo isso para a gente fazer os testes aqui, pelo menos chegando perto do que seria a realidade, porque se a gente trabalhar muito fora do da realidade, o que acaba, quer dizer, flutuar demais.

### 45:32 — Iago Lunar Rangel Raich
Wandra Wandra.Não, vou passar para vocês aqui, pera aí, deixa eu achar o histórico aqui.

### 45:45 — Matheus Sa de Araujo Miranda
I will.É, dá para criar uma base fake com outro assim. Pode criar uns 50 usuários.

### 45:57 — Iago Lunar Rangel Raich
Ué, o Arthur é do time de vocês?

### 46:00 — Matheus Sa de Araujo Miranda
Não é concorrência, é concorrência, é complicado. Manda para ele não, Sergio, mandar para ele não.

### 46:01 — Iago Lunar Rangel Raich
Ah, então, pera aí.

### 46:01 — Mario Stevan do Nascimento Santos
No.

### 46:08 — Iago Lunar Rangel Raich
Beleza, vou mandar para vocês aqui, oh, a das APRs você já tem, né?

### 46:09 — Matheus Sa de Araujo Miranda
MG.A conversa que tem que ficar só no off, só nós aqui.

### 46:17 — Iago Lunar Rangel Raich
Deixa eu ver, deixa eu baixar aqui a outra coisa aqui também.Eu tinha desenhado também uma arquitetura aqui, eu vou, vou passar para vocês também um conteudinho aqui.

### 46:27 — Matheus Sa de Araujo Miranda
So.

### 46:28 — Iago Lunar Rangel Raich
Isso aqui é o já viajando aqui já para o

### 46:36 — Matheus Sa de Araujo Miranda
Jesus.

### 46:37 — Iago Lunar Rangel Raich
Pro nosso ambiente Energisa, tá?deixa eu passar aqui agora

### 46:49 — Matheus Sa de Araujo Miranda
Wait.So.Thank you, thank you.

### 47:08 — Iago Lunar Rangel Raich
Isso aí eu tinhaFeito logo que eu entrei na GEOP, a cadeira de manutenção para vocês terem uma base de dados e o modelo e isso é uma arquitetura que eu tinha desenvolvido, que eu tinha pensado aqui para poder implantar o que eu preciso.Na época, eu tinha estudado de fazer com SharePoint como base de armazenamento e power apps, como seria a solução de APP. Mas é só para vocês terem mais ou menos uma noção.Tem algumas coisas interessantes aí nesse documento de arquitetura, principalmente no quesito de segurança e tal. E a carteira é a carteira, cara, que eu acho que vocês vão precisar dela, que é o para vocês trabalhar com uma base mais real, né?

### 47:46 — Matheus Sa de Araujo Miranda
It's good.Mhm.Mhm, that would I see.Sure.A gente vai ver aqui depois.Está, a gente vai ver certinho depois, aí a gente faz as adaptações.

### 48:12 — Iago Lunar Rangel Raich
Perfeito! Bom, mas no geral está muito bom, tá? Parabéns!

### 48:13 — Matheus Sa de Araujo Miranda
Approximate.

### 48:15 — Mario Stevan do Nascimento Santos
Ficou bacana.

### 48:17 — Matheus Sa de Araujo Miranda
A próxima tela aqui é de indicadores, que é uma dashboard onde você conseguiria ver os status das OS. A gente até pensou também em montar aqui uma parte onde você vê o progresso ou os status dos funcionários.

### 48:23 — Iago Lunar Rangel Raich
Up.

### 48:34 — Matheus Sa de Araujo Miranda
Aí teria quase poderia implementar também uma gamificação, alguma coisa assim no sistema para poder premiar ou só destacar os melhores funcionários com mais demandas realizadas e tudo. Mas aqui é só de acompanhamento.

### 48:49 — Iago Lunar Rangel Raich
Miguel.

### 48:50 — Matheus Sa de Araujo Miranda
Inclusive, a maneira que a gente construiu falando sobre sistemas Energisa é, a gente quis adaptar um design bem próximo do que é utilizado na nossa região, é que é o power apps e o.Power não, não é o Power BI é, né? Eu acho que é. Acho que é o outro que eu que eu esqueci é que agora que tem um Power builder e um Power BI não é? São 2 diferentes, então são diferentes, são integrados no outro.

### 49:07 — Mario Stevan do Nascimento Santos
Arthur Mate.

### 49:07 — Iago Lunar Rangel Raich
Hora do mate.

### 49:19 — Matheus Sa de Araujo Miranda
O Power BI é tipo um gráfico. Power BI, mas ele tem o Model também, o Model que ele tem alguma parte de modulação dos dados. É como se fosse um banco de dados lá, mas entendi, entendi. Que eu mexi mais em power app, sabe? Quando a gente estava construindo, eu tava.Conversando com o Renan exatamente sobre esse design, que é muito próximo e hoje em dia a maioria das coisas que eu vejo é bem próximo a isso, sabe? Então a ideia era entregar um conforto para vocês já estar num ambiente que vocês já estavam acostumado, entendeu?

### 49:47 — Iago Lunar Rangel Raich
Okay.

### 49:52 — Mario Stevan do Nascimento Santos
Mm-hmm.

### 49:52 — Matheus Sa de Araujo Miranda
Caso seja aprovado o Projeto.

### 49:55 — Iago Lunar Rangel Raich
Beleza, não, tá legal essa parte de dashboard aí, tá?Atende aí pra caramba, dá para tirar algumas informações aí sim.

### 50:03 — Mario Stevan do Nascimento Santos
Bacana que vocês pensaram não só no mobile eSIM no web também Isso é muito bom

### 50:06 — Matheus Sa de Araujo Miranda
Sim. A ideia era distinguir o campo e a operação em si, sabe? Para que tivesse os 2 no ambiente de cada um. O pessoal de operações é, eu falo operações, operações é vocês, sabe?

### 50:07 — Iago Lunar Rangel Raich
Yeah.

### 50:13 — Mario Stevan do Nascimento Santos
Mhm.******.Mm-hmm.

### 50:24 — Matheus Sa de Araujo Miranda
É, já estou acostumado com o ambiente de desktop. É agora o pessoal de campo, não é como vocês disseram, é PDA, são plataformas móveis, então é celular, tablet, o próprio PDA. E a gente fez exatamente pensando.

### 50:52 — Mario Stevan do Nascimento Santos
Mhm.

### 50:53 — Matheus Sa de Araujo Miranda
Então a gente pensou muito nisso. Eu só estou frisando porque eu acho muito interessante é que às vezes a gente está apresentando algo, mas parece que foi feito ali sem repensar em tudo, sabe? A gente passou no primeiro dia e o resto da semana exatamente.Fazendo esse plano, querendo entender exatamente a demanda para que a gente pudesse entregar algo para vocês com exatidão e que pudesse sanar todas as dores que vocês tinham referente a isso, sabe?

### 51:23 — Mario Stevan do Nascimento Santos
Hmm.

### 51:24 — Iago Lunar Rangel Raich
Muito bom, cara, muito bom.

### 51:26 — Matheus Sa de Araujo Miranda
A penúltima tela aqui já é a onde a gente colocaria os modelos das APRs, falaram que são 8, então aqui a gente basicamente iria definir quais são as perguntas de cada modelo e o que tem em cada um deles.É editável.

### 51:43 — Iago Lunar Rangel Raich
Isso aí é muito bom, tá? É muito bom que elas sofrem ajustes de acordo com a Segurança do Trabalho. Às vezes sai alguma norma, alguma coisa diferente, eles têm que atualizar o documento.

### 51:50 — Matheus Sa de Araujo Miranda
Thank you.It's.Isso e a última tela aqui que a gente que a gente não implementou é basicamente onde você iria definir o só fazer a criação dos usuários e da e a

### 52:06 — Iago Lunar Rangel Raich
Emissões, né?

### 52:08 — Matheus Sa de Araujo Miranda
Isso demissões permissões.

### 52:10 — Iago Lunar Rangel Raich
Permissões.

### 52:10 — Mario Stevan do Nascimento Santos
Pamela.

### 52:15 — Matheus Sa de Araujo Miranda
Da das equipes, porque a gente tinha discutido sobre como que a gente faria o registro dos usuários, porque existem 2 meios de fazer.

### 52:17 — Iago Lunar Rangel Raich
Cow, cow.

### 52:29 — Matheus Sa de Araujo Miranda
Que é uma tela de registro, onde o próprio usuário vai lá e cria sua própria conta, ou o usuário administrador cria as contas dos outros usuários. E aí, como a gente é, a gente decidiu que iria fazer dessa segunda maneira, a gente precisaria ter essa tela para poder.Fazer o controle de gestão dos outros usuários.

### 52:49 — Iago Lunar Rangel Raich
Boa! É por minha visão, tá? Se esse produto a Energisa, vamos supor, aqui já estou começando a brisar. Vocês desenvolvem um produto muito bom que a Energisa vê potencial de disponibilizar no mercado.

### 52:59 — Matheus Sa de Araujo Miranda
It is a secret.

### 53:06 — Iago Lunar Rangel Raich
aí é interessante ter a tela de criação de login e tal agora não é um produto interno nosso então deixa só com os horas de mim mas quem sabe né vendo um produto Nacional aí ó vocês estão estão voando

### 53:09 — Matheus Sa de Araujo Miranda
Mm-hmm.Okay.A última tela aqui é só um resuminho aqui de um modelo que a gente desenhou de APR. Mas como vocês falaram, o modelo da APR, ele já é um documento padrão, então não sei se vocês usariam isso.Mas aqui é só para mostrar como ficaria desenhado depois.

### 53:37 — Iago Lunar Rangel Raich
Mm.É, no caso aí é um PDF da OS executada, né? Mas tem o eu mandei para vocês já um modelo de OS também não, né?

### 53:42 — Matheus Sa de Araujo Miranda
Isis.Mandou dois, mandou dois pra gente.

### 53:47 — Mario Stevan do Nascimento Santos
Tem um modelo aqui, né?

### 53:48 — Iago Lunar Rangel Raich
Então ele deve seguir aquele mesmo modelo, está? É. Então vão ser 2 páginas, uma página da PR e uma página do documento mesmo.

### 53:51 — Matheus Sa de Araujo Miranda
Okay.I see.It's reallyEsse aqui.

### 53:59 — Iago Lunar Rangel Raich
É, esse é APR, tem a da ordem de serviço lá em cima.

### 54:00 — Mario Stevan do Nascimento Santos
Esse é a PR.

### 54:05 — Matheus Sa de Araujo Miranda
Okay.

### 54:05 — Iago Lunar Rangel Raich
Aí, isso é uma ordem de serviço. Aí ela tem toda ali, quer ver? Sobe ali pra você ver rapidinho, só pra eu te explicar. Essa primeira parte tem a logo, o número da ordem da manutenção, a data da ordem que Ela Foi emitida, a data da ordem que Ela Foi impressa e a quantidade de páginas.

### 54:06 — Mario Stevan do Nascimento Santos
Yeah.

### 54:20 — Matheus Sa de Araujo Miranda
Mhm.

### 54:21 — Iago Lunar Rangel Raich
Aí, logo abaixo, o cabeçalho dela. Aí nela eu tenho o centro de trabalho, o tipo de atividade de manutenção. Nesse caso era uma manutenção corretiva, o centro de trabalho, que é a equipe serviços especiais, o status do usuário.Está limpo porque não compete nada. E o criado por, no caso, foi o Rafael Fávaro, que é o que foi quem criou a ordem, que é igual eu falei que é tudo gerado no SAP. Ele mostra quem criou, já atribua uma equipe, diz o tipo.

### 54:49 — Matheus Sa de Araujo Miranda
Mhm.

### 54:52 — Iago Lunar Rangel Raich
O centro de trabalho, o grupo de Planejamento é manutenção, a empresa é 14010, no caso no SAP, a 1410 corresponde a SGAS, que tem como você criar mais empresas dentro do SAP, tá? A descrição do centro de trabalho, que ali tem serviços especiais, que é o centro de trabalho principal, e ao lado tem a descrição do centro de trabalho.

### 55:05 — Matheus Sa de Araujo Miranda
Okay.

### 55:12 — Iago Lunar Rangel Raich
Serviços especiais, o status da ordem que ali tá ali, liberada e impressa. As outras informações não são pertinentes, porque é só a primeira tag e a segunda geralmente que vocês vão precisar.

### 55:18 — Matheus Sa de Araujo Miranda
Just do.

### 55:27 — Iago Lunar Rangel Raich
As outras compete ao SAP. Vem um subtítulo. Aí agora são informações dos objetos técnicos. O que são objetos técnicos? Local de instalação ou o próprio equipamento. O primeiro objeto técnico é o local de instalação, Vila Velha, rede Vila Velha.

### 55:40 — Matheus Sa de Araujo Miranda
Mhm.

### 55:45 — Iago Lunar Rangel Raich
Aí, como é uma rede, um tubo, ele não tem fabricante, modelo e nem número de série, é um tubo. Enfim, equipamento também não compete, então também não vai ter nada, porque é uma rede. Agora, se for um equipamento tipo um computador de vazão.Aí ele vai trazer as informações de número de série, modelo, fabricante, número de peça, enfim.Mais abaixo tem a lembra que eu falei que tem o documento chamado nota de manutenção?

### 56:13 — Matheus Sa de Araujo Miranda
Uh-huh.

### 56:13 — Iago Lunar Rangel Raich
Ele primeiro gera a nota, aqui tá, essas informações são da nota. A nota, ela é o relato, vai ter todo o relato, ela é evidência, descrição e nessa na nota você já vincula tudo também. Aí ele primeiro abriu a nota, tem a data da criação da nota, também quem criou o autor e tal.Tal e a mais abaixo é as informações da do planejamento da ordem, tá? É aí vem a questão de criticidade, no caso aí ela é uma ordem não planejada, porque ela precisou de ser aberta na hora e o início programado.Data do fim programado, tipo, é uma ordem que foi executada no mesmo dia e ele poderia setar tal horário de início e fim, mas ele não setou. Aí ficou 00 e a prioridade ele botou muito alto. Então, tipo assim, era uma ordem que precisava ser executada no mesmo dia e era e era algo crítico.

### 56:48 — Matheus Sa de Araujo Miranda
Sixteen.

### 57:04 — Iago Lunar Rangel Raich
ele botou muito alto é pode descer um pouquinho o tempo de parada ele não botou nenhuma nenhuma informação porque não tem e aquilo que eu falei agora o que que operador preenche mesmo né o cara que tá em campo número de pessoas duas a duração ele não botou nada mas ele poderia muito bem colocar mas a gente consegue fazer um cálculo aí ele começou

### 57:23 — Matheus Sa de Araujo Miranda
Isis.

### 57:24 — Iago Lunar Rangel Raich
e terminou a meio-dia e dezoito.

### 57:27 — Matheus Sa de Araujo Miranda
Esses campos aqui seriam gerados automaticamente pelo botão vocês falam.

### 57:30 — Iago Lunar Rangel Raich
É exatamente que é o que o cara vai preencher ali, é o que o operador mesmo só vai preencher isso aí. O documento já vai ser gerado pelo sistema. O operador só preenche isso aí que está por escrito aí de caneta é.

### 57:43 — Matheus Sa de Araujo Miranda
Aham, é porque ele tinha falado sobre pausar e sobre concluir. A gente vai registrar isso aqui de forma automática. A única coisa que ele tem que fazer é registrar o número de pessoas aqui nessa nessa pessoa lá no início, quando vai selecionar lá no início.

### 57:54 — Iago Lunar Rangel Raich
Yes.Descrição da atividade é interessante botar né, porque tipo assim, tudo bem que já tem um documento ali preenchido, mas é interessante saber o que que foi feito. Então, caixa de válvula foi desobstruída, válvula de bloqueio e válvulas de vent operando normalmente. Então basicamente era o que? Uma válvula nossa que estava tampada.

### 58:11 — Matheus Sa de Araujo Miranda
Okay.

### 58:18 — Iago Lunar Rangel Raich
de nada geralmente o tem obra da prefeitura a prefeitura vai lá e joga o asfalto por cima da válvula aí os cara tem que ir lá e cavar ela entendeu cavar mesmo abre a tampa mexe lá dentro ver se ela tá ok tampa de novo aí porque não pode de cabelo obstruída porque em caso de algum incêndio é nessa válvula

### 58:28 — Matheus Sa de Araujo Miranda
Uh-huh.

### 58:38 — Iago Lunar Rangel Raich
o cara vai fechar o gás entendeu pode pode descer é e o outro Campo que ele ele preencheu então lá data hora início descrição e assinatura assinatura dele a data hora de fim hora de início

### 58:42 — Matheus Sa de Araujo Miranda
Uh-huh.Okay.

### 58:58 — Iago Lunar Rangel Raich
Aí, lembra que eu falei que pode ter mais de um executante? Tem até três executantes.

### 59:02 — Matheus Sa de Araujo Miranda
Mhm, I think.

### 59:04 — Iago Lunar Rangel Raich
E o responsável da manutenção que é tipo líder técnico lá da atividade e um supervisor.O solicitante da manutenção pode ser eu ou pode ser outra pessoa, mas geralmente deixa em branco mesmo.

### 59:12 — Matheus Sa de Araujo Miranda
Okay.Essa assinatura aqui.É uma assinatura para cada, para cada pessoa que está fazendo ali o serviço, porque.

### 59:25 — Mario Stevan do Nascimento Santos
Isso a cada pessoa que assina executante assina e ele faz assinatura.

### 59:26 — Iago Lunar Rangel Raich
é para cada um o exemplo

### 59:29 — Matheus Sa de Araujo Miranda
A gente precisa. Então vai ter um respeito de todos os outros que estão ali prestando, fazendo aquela pessoa, fazendo o serviço, todas as pessoas que estão envolvidas.

### 59:39 — Iago Lunar Rangel Raich
Isso.

### 59:39 — Mario Stevan do Nascimento Santos
Isso.

### 59:40 — Matheus Sa de Araujo Miranda
Nesse, nesse caso, a gente precisa sim, então de que todos os presentes, os funcionários que fizeram a demanda que eles validem anão a PR, mas a OS no final, a parte.

### 59:55 — Iago Lunar Rangel Raich
Isso geralmente é no máximo 3, está. Eu nunca vi alguém executar uma atividade com mais de 3 pessoas. Não está dificilmente.

### 1:00:02 — Matheus Sa de Araujo Miranda
As assinaturas, elas devem ser entregues no final da atividade ou enquanto ela está sendo tá perfeito, perfeito.

### 1:00:08 — Iago Lunar Rangel Raich
Final.Não, ao fim da atividade.Lembra que eu falei que vai ter um líder? O Elis Mario está como executante e o Damião está como executante. Mas o responsável líder da manutenção foi o Elis Mario. Se vocês descerem lá embaixo, provavelmente quem preencheu a APR foi o Elis Mario.

### 1:00:26 — Matheus Sa de Araujo Miranda
Okay.Pensando em cima, acho que é ali, então é responsável, manutenção, sabe um pouquinho de

### 1:00:40 — Iago Lunar Rangel Raich
E mais um pouquinho para cima, além de ele ser um dos executantes junto com o Damião, ele foi o responsável pela atividade lá em campo. Então ele que provavelmente fez APR também, que preencheu, né?

### 1:00:44 — Matheus Sa de Araujo Miranda
So.Quando são, por exemplo, a tem 2 equipes e cada equipe está realizando.Algo diferente aí no caso, elas, todas as pessoas ali, elas precisam estar fazendo essa assinatura para ficar poder realizando o serviço. Aí, por exemplo, a minha equipe terminou o primeiro serviço e a equipe 2 ainda não terminou o serviço, aí a PR não fecha.Send.

### 1:01:21 — Iago Lunar Rangel Raich
Então, então na verdade não. Para cada equipe ela vai ter sua ordem de serviço e para cada ordem de serviço vai ter sua APR.

### 1:01:30 — Matheus Sa de Araujo Miranda
Por exemplo, se eles quiserem fazer a manutenção na mesma subestação e a manutenção pelo mesmo protocolo, mas por ponto de demanda de manutenção da urgente, né? Aí vai ter vai ter duas OFS e mesmo serviço, então vai separar. Então, nesse caso é separado.

### 1:01:48 — Iago Lunar Rangel Raich
You say, say.

### 1:01:48 — Matheus Sa de Araujo Miranda
Não é? Sim, a gente até tinha discutido isso porque a gente estava pensando em implementar várias APR, então uma APR para vários serviços. Aí a equipe for delegada com determinada manutenção, vai rolar APR.Mesmo que as duas que tenham a mesma, os mesmos riscos, né? Mas vão ser diferentes para cada equipe. Não pode duplicar e se você está com pra dois sim. Como cada equipe vai ter uma supervisão direta, né? Também tem que separar os supervisores e não ficar por ponto de cada equipe.

### 1:02:11 — Mario Stevan do Nascimento Santos
Missing.

### 1:02:21 — Matheus Sa de Araujo Miranda
O ideal seria, né? Os 2 os 2 supervisores responderiam, mas não é ordens diferentes, né? A situação do médico.

### 1:02:29 — Iago Lunar Rangel Raich
You say?

### 1:02:35 — Matheus Sa de Araujo Miranda
Great, thank you.

### 1:02:38 — Iago Lunar Rangel Raich
O supervisor aí só assina só para questões de ciência, tá? Do de que foi executado.

### 1:02:43 — Matheus Sa de Araujo Miranda
E a equipe está aqui em determinado serviço, e aqui já é a pr, né?

### 1:02:49 — Iago Lunar Rangel Raich
Isso, aí já é a PR. Análise preliminar de risco.

### 1:02:53 — Matheus Sa de Araujo Miranda
a gente tem algumas dúvidas aqui que a gente anotou não pode mostrar essas ideias aí não pode é porque a gente tem algumas a gente tem algumas ideias queO que a gente mostrou aqui agora foi basicamente o fluxo principal de como o sistema vai funcionar. Só que tem algumas ideias em que a gente pensou em agregar para poder gerar mais valor ao sistema, só que a gente quer guardar isso para mostrar isso na apresentação depois.

### 1:03:12 — Mario Stevan do Nascimento Santos
O.

### 1:03:15 — Iago Lunar Rangel Raich
Tá.Beleza.Não vou. Não vou passar para o outro time não, cara. Vocês são os meus favoritos, cara. Já printei tudo aqui, já era.

### 1:03:33 — Matheus Sa de Araujo Miranda
Mentira, I said I want to go in there.

### 1:03:37 — Mario Stevan do Nascimento Santos
Mal sabe ele que eu estou no meu PC e eu consigo pegar aqui pela Nvidia pelo gravador.

### 1:03:38 — Matheus Sa de Araujo Miranda
Santos Santos Santos Santos.

### 1:03:42 — Iago Lunar Rangel Raich
Não, mentira, não. Mas cara, tá legal, tá? É, tá, tá muito interessante aí. Parabéns para vocês aí. É, torcer para esse produto e virar um produto mesmo, né?

### 1:03:42 — Matheus Sa de Araujo Miranda
Okay.Yeah.I'm not a sick.Take a prove.

### 1:03:57 — Iago Lunar Rangel Raich
Porque, cara, potencial vocês têm, potencial vocês têm.

### 1:03:57 — Matheus Sa de Araujo Miranda
A gostei já, a gente já ganha de

### 1:04:01 — Mario Stevan do Nascimento Santos
Parabéns mesmo, está muito bom, principalmente cara, pensando em 2 versões.

### 1:04:03 — Matheus Sa de Araujo Miranda
Tell me.

### 1:04:05 — Iago Lunar Rangel Raich
Oh, agora cá entre nós aqui, Hein? Conversa com seu chefe de vocês aí, que é esse gás, não tem desenvolvedor, não está?

### 1:04:12 — Matheus Sa de Araujo Miranda
O Marcos acabou de chegar aqui para anunciar o fim do mundo aqui, acabou de chegar.

### 1:04:13 — Iago Lunar Rangel Raich
Aí a gente só tem o Mario aqui, só o Mario quebra um galho aqui e tal.É, cara, a vertente de gás está precisando de desenvolvimento, vários.

### 1:04:24 — Mario Stevan do Nascimento Santos
Hey.

### 1:04:25 — Matheus Sa de Araujo Miranda
Okay.Só ver se o é. Enquanto o Renan está procurando as dúvidas, eu gostaria de falar um pouco mais sobre a última demanda é que chegou para a gente. O último desafio é, queria perguntar o que vocês estavam procurando em si?

### 1:04:48 — Iago Lunar Rangel Raich
Cara, a gente precisava de uma solução que fizesse com que os operadores preenchessem a ordem de serviço sem ter que usar papel, cara, porque é digitalização do processo mesmo de ordem de manutenção, porque hoje é tudo manual. O objetivo principal é esse.

### 1:05:03 — Matheus Sa de Araujo Miranda
No.

### 1:05:05 — Iago Lunar Rangel Raich
É a gente conseguir otimizar e questão de para ter rastreabilidade, para ter um controle melhor, para ter melhorar o fluxo, não ficar dependente de papel. A gente, a gente perde.

### 1:05:14 — Matheus Sa de Araujo Miranda
Tava procurando as dúvidas mais atendimento. É porque é porque saiu uma nova para a gente. Agora é além dessa, sabe? Eu estou procurando aqui para falar em detalhes qual que é.

### 1:05:27 — Iago Lunar Rangel Raich
OPA.

### 1:05:28 — Matheus Sa de Araujo Miranda
A Marquinha aqui, Caio, é sobre especificamente ali sobre a APL, né? O que acontece? A ordem de manutenção são várias, mas nem sempre a APL é igual para cada uma delas, né? Ela vai ter uma variação.

### 1:05:47 — Iago Lunar Rangel Raich
Perfeito, isso mesmo.

### 1:05:47 — Matheus Sa de Araujo Miranda
O.

### 1:05:47 — Mario Stevan do Nascimento Santos
Isso aí.

### 1:05:48 — Matheus Sa de Araujo Miranda
E aí a gente precisa, eles querem entender um pouquinho mais de como que funciona isso, o que o que que define. Eu até dei um exemplo ruim que eu falei do local confinado, só que na verdade o confinado ele.É um item da APR, ele não é um tipo de manutenção.

### 1:06:09 — Iago Lunar Rangel Raich
Uhum, olha, tem na no próprio, nas próprias APRs aí, na naquele pacote, na descrição acima delas, ela tem uma um campo lá que ela informa para qual tipo de atividade que é.

### 1:06:10 — Matheus Sa de Araujo Miranda
You don't.

### 1:06:27 — Iago Lunar Rangel Raich
Deixa eu ver se eu tenho um documento aqui?

### 1:06:29 — Matheus Sa de Araujo Miranda
Martins, obrigado, não tá?

### 1:06:33 — Iago Lunar Rangel Raich
Abre o abre aí 2 exemplos, vocês conseguem abrir 2 exemplos de APRI para mostrar para o Marquinho?

### 1:06:38 — Matheus Sa de Araujo Miranda
O.A gente acabou de abrir aqui.

### 1:06:41 — Iago Lunar Rangel Raich
Isso e tenta fazer um comparativo aí de uma APR para outra.

### 1:06:43 — Matheus Sa de Araujo Miranda
Deixa eu compartilhar a tela aqui.

### 1:06:44 — Mario Stevan do Nascimento Santos
Okay.

### 1:06:48 — Iago Lunar Rangel Raich
Eu acho que, se eu não me engano, isso é porque eu não, como eu não preencho esse documento, eu não, eu não tenho.

### 1:06:54 — Matheus Sa de Araujo Miranda
Okay.

### 1:06:56 — Iago Lunar Rangel Raich
Mas eu sei que elas são diferentes assim, tá? E cada uma ela tem um. Ela é um modelo diferente e ela tem algumas questões diferentes.No caso, você pegou uma OS, né? Tenta pegar APR mesmo do Zip lá.

### 1:07:13 — Matheus Sa de Araujo Miranda
Isso aqui para carregar as coisas. Pegou. Você falou sem querer a a a a a a a a a é porque tem uma tem uma PR lá no finalzinho.

### 1:07:27 — Iago Lunar Rangel Raich
No, I don't.Pode ser que eu seja igual, pode ser que seja igual.

### 1:07:29 — Matheus Sa de Araujo Miranda
Moreira.Ah é?

### 1:07:32 — Iago Lunar Rangel Raich
Pode, é bom pegar o modelo da APR mesmo, o do Zip lá que eu mandei.

### 1:07:34 — Matheus Sa de Araujo Miranda
Okay.I just think that's a do table.

### 1:07:40 — Iago Lunar Rangel Raich
Isso, esse checklist aí, faz um comparativo do, sei lá, checklist, isso.

### 1:07:42 — Matheus Sa de Araujo Miranda
Martins.I saw my fear.Doesn't you make it?Deixa eu abrir isso aqui na tabela de gente. Eu acho que você está atrás de Souza.É porque ele estava lá fora. Eu já estou sentindo fala. Eu também. Eu também já estou. Já estou sentindo fala de novo.Pensando em você? Pensando para mim, você?

### 1:08:17 — Iago Lunar Rangel Raich
Rapaz, aqui o sol está arregaçando hoje, tá, meu amigo?

### 1:08:21 — Mario Stevan do Nascimento Santos
No.a praia tá chamando na praia

### 1:08:25 — Iago Lunar Rangel Raich
Era para eu estar na praia agora, está? Oh, se sinta privilegiado, está?

### 1:08:27 — Matheus Sa de Araujo Miranda
Thank you.É Iago, segunda-feira eu estou lá em Guarapari, Hein? Pronto, entendi.

### 1:08:34 — Mario Stevan do Nascimento Santos
ó dá um pulo lá na Energisa pô

### 1:08:34 — Iago Lunar Rangel Raich
Oh, é a é a é chega aí na esse gás aí, Marquinho, 40 minutinhos ainda está na esse gás. Eu moro aqui em Itaparica, Marquinho, eu moro a 7 minutos da praia.

### 1:08:38 — Mario Stevan do Nascimento Santos
Nice guys, olha, la mesmo.

### 1:08:40 — Matheus Sa de Araujo Miranda
Okay.O Martins FanNem falando nada, nem falando nada.

### 1:08:54 — Iago Lunar Rangel Raich
Oi.

### 1:08:55 — Matheus Sa de Araujo Miranda
Vou mandar mensagem pra você e você pagou almoço pra mim

### 1:08:58 — Iago Lunar Rangel Raich
Chega aí, pô. Marcão, chega aí. Marcão está aqui também.

### 1:08:58 — Mario Stevan do Nascimento Santos
Moreira.

### 1:09:01 — Matheus Sa de Araujo Miranda
I think.

### 1:09:04 — Iago Lunar Rangel Raich
O Marcos já foi do seu time já o Marcos Quadros?

### 1:09:09 — Matheus Sa de Araujo Miranda
Ele era meu par, ele era coordenador também lá na só que na gerência do Wellington, da M e F

### 1:09:16 — Iago Lunar Rangel Raich
Marcão era meu chefe, cara.

### 1:09:16 — Matheus Sa de Araujo Miranda
Wait.ele era aí né cara ele ele é do Espírito Santo acho que ele era de cachoeiro

### 1:09:26 — Iago Lunar Rangel Raich
É do interior, cara. Esqueci o nome agora da cidade.

### 1:09:26 — Matheus Sa de Araujo Miranda
Yes.Hello, I think I should do

### 1:09:34 — Iago Lunar Rangel Raich
Aí, as APRs, elas aí a 1 e a 2, já na primeira, no primeiro cabeçalho, já tem alguma diferencinha já.

### 1:09:39 — Matheus Sa de Araujo Miranda
Fernandes.

### 1:09:44 — Iago Lunar Rangel Raich
O primeiro, ele tem uma relação de itens aplicáveis, oh.

### 1:09:48 — Matheus Sa de Araujo Miranda
Se.

### 1:09:49 — Iago Lunar Rangel Raich
Uma é para mexer com

### 1:09:50 — Matheus Sa de Araujo Miranda
Santos.

### 1:09:51 — Iago Lunar Rangel Raich
Você está vendo ali? Ela vai mexer com calibração externa do cromatógrafo e a outra já vai mexer com óleo, filtro.

### 1:09:55 — Matheus Sa de Araujo Miranda
Santos and

### 1:09:59 — Mario Stevan do Nascimento Santos
É operação mesmo. A uma é operação, a outra é instrumentação.

### 1:10:00 — Iago Lunar Rangel Raich
Tá vendo?East.

### 1:10:05 — Matheus Sa de Araujo Miranda
essas esses modelos que vocês mandaram para a gente aqui esses oito aqui são os modelosQue a gente, que existem, só existem esses 8 mesmo.

### 1:10:20 — Iago Lunar Rangel Raich
É por enquanto, sim. Quem manda para a gente é a Segurança, tá? Eles que homologam o documento e publicam para a gente poder usar.

### 1:10:22 — Matheus Sa de Araujo Miranda
Time.What?Pensando ainda, o que ele sabe? O cara, cara, sei que eu não sei se tem alguma espécie de tabela com todos esses códigos de do tipo, se a tabela com APR.Tell us this is kind of a lara.

### 1:10:44 — Iago Lunar Rangel Raich
Todos os tipos de manutenção.

### 1:10:46 — Matheus Sa de Araujo Miranda
Isis, isis significados aqui.

### 1:10:47 — Iago Lunar Rangel Raich
então eu consigo eu consigo gerar assim no SAP Tá mas eu eu tenho que estar lá porque eu não tô conseguindo entrar no SAP aqui não só eu consigo disponibilizar para vocês segunda-feira não perdão pera aí que eu vou mandar para vocês agora deixa eu ver aqui

### 1:10:57 — Matheus Sa de Araujo Miranda
No, that's the door I just think that's not the rank.

### 1:10:58 — Mario Stevan do Nascimento Santos
Terça-feira.

### 1:11:07 — Iago Lunar Rangel Raich
Sim, deixa eu ver se eu consigo o que mandar para vocês rapidinho.

### 1:11:11 — Matheus Sa de Araujo Miranda
It's just up to me.

### 1:11:13 — Iago Lunar Rangel Raich
Oh, essa proposta que eu vou mandar para, eu não posso mandar, ela não está aprovada ainda, é porque a gente está revisando todo o nosso plano de manutenção, então esses códigos aí vão mudar, tá vendo 8 ponto tal, algumas nomenclaturas vão mudar, é porque a gente está revisando o plano.

### 1:11:17 — Matheus Sa de Araujo Miranda
See now.Okay.It's time.It's new.

### 1:11:30 — Iago Lunar Rangel Raich
todinho a gente está passando por uma mudança

### 1:11:31 — Matheus Sa de Araujo Miranda
Okay.Dependendo de como isso funciona, a gente consegue criar uma tabela no banco de dados para fazer a associação do nome com a sigla. E aí a gente faz um. Não sei se eu estou falando muito técnico, mas um crude para poder.Gravar esses dados.

### 1:11:51 — Iago Lunar Rangel Raich
Não entendo sim, não acho que dá sim, dá sim.

### 1:11:52 — Mario Stevan do Nascimento Santos
Martins.

### 1:11:54 — Matheus Sa de Araujo Miranda
So, you must have seen that that thing might be there.

### 1:11:59 — Iago Lunar Rangel Raich
Mas aí o desafio é esse que o Martins falou, são diferentes para cada tipo de serviço, para cada tipo de atividade.

### 1:12:02 — Matheus Sa de Araujo Miranda
Pensando nada e que o meu negócios não é designado pelo Instituto.A esse é o desafio. Esse é o Matheus, esse é o desafio que o que fala lá embaixo para a gente fazer uma PR para não fazer a PR é permitir que a PR seja definida por tipo de ordem de manutenção, ou seja.

### 1:12:15 — Iago Lunar Rangel Raich
Prakad.

### 1:12:22 — Matheus Sa de Araujo Miranda
É, colocar isso mesmo. A gente já está fazendo isso, colocar por tag, porcaria. Mas antes era um diferencial, né? Agora é obrigatório. Então, por que que eu perguntei exatamente para saber se existe algum outro ponto?A ser definido, entendeu? Tem alguma coisa que exato que tipo assim, seria uma coisa que talvez a gente poderia implementar, que vocês acham que seria sem um diferencial de ajuda?

### 1:12:51 — Iago Lunar Rangel Raich
Cara, deixa eu pensar aqui.

### 1:12:52 — Mario Stevan do Nascimento Santos
Eu acho uma coisa que vocês gostam que eu gostei bastante até vocês queria implementar é a questão do time de tempo quando ele está fazendo o serviço.

### 1:13:00 — Matheus Sa de Araujo Miranda
Seven.

### 1:13:01 — Iago Lunar Rangel Raich
E um dashboard com esse que traga esse tempo.

### 1:13:02 — Matheus Sa de Araujo Miranda
Okay.Não vale dar nossas ideias para o para o outro grupo, para os inimigos lá não pode adversários.

### 1:13:13 — Mario Stevan do Nascimento Santos
É porque como no outro grupo eu cheguei bem no final, não sei também se vocês também já tem um bom diferencial que você já tem o mobile e o web. Iago, você que tava mais lá na ativa, eles fizeram web também?

### 1:13:20 — Matheus Sa de Araujo Miranda
I do.

### 1:13:25 — Iago Lunar Rangel Raich
Cara, tem sim, tem interface, tem.

### 1:13:26 — Matheus Sa de Araujo Miranda
Yes.

### 1:13:26 — Mario Stevan do Nascimento Santos
É, viu? Tá vendo aí?

### 1:13:30 — Matheus Sa de Araujo Miranda
Apocaria, eles estão copiando.

### 1:13:34 — Iago Lunar Rangel Raich
Não, mas o.

### 1:13:34 — Mario Stevan do Nascimento Santos
Mas ficou legal, pessoal, ficou legal. Vocês estão andando bem.

### 1:13:36 — Iago Lunar Rangel Raich
Vamos ver, vamos ver, vamos ver aí.

### 1:13:37 — Matheus Sa de Araujo Miranda
O nosso está mais bonito? Se você não, não pode equipe, não está mais bonito.

### 1:13:39 — Iago Lunar Rangel Raich
Tá legal, tá legal.Eu vou ver, durante a semana, eu vou ver se tem alguma sugestão que eu consiga dar, aí eu passo para vocês.

### 1:13:50 — Matheus Sa de Araujo Miranda
É lá no grupo, a gente vai cobrar, hein? A gente vai cobrar. Oh, não precisa ser sugestão pronta, não. Só você chegar na gente e falar assim, oh, é, eu gostaria que isso daqui melhorasse ou algo do tipo, entendeu?

### 1:13:52 — Iago Lunar Rangel Raich
ButTable.Eu vou, eu vou além, vou conversar com o meu coordenador, com o meu gerente e vou perguntar para eles o que gerente tem uma visão diferente de negócios aí.

### 1:14:07 — Matheus Sa de Araujo Miranda
I

### 1:14:09 — Mario Stevan do Nascimento Santos
Tem ali, tem.

### 1:14:13 — Iago Lunar Rangel Raich
Eu vou perguntar para ele Salu, pense na ideia mais mirabolante de um sistema de controle de ordem de manutenção, o que ele deveria ter? Ele vai passar a ideia dele mirabolante.

### 1:14:18 — Matheus Sa de Araujo Miranda
Okay.Hey.Você não fala, você não fala que a gente está fazendo, não. Você fala assim, se você fosse fazer, o que você faria diferente? Isso porque aí a gente já sabe o conceito que a gente está tendo aqui agora. Então você já tem uma visão do que a gente já passou para vocês aí agora.

### 1:14:32 — Iago Lunar Rangel Raich
No.

### 1:14:33 — Mario Stevan do Nascimento Santos
A bice is.

### 1:14:40 — Matheus Sa de Araujo Miranda
É, a gente vai pra isso.

### 1:14:41 — Iago Lunar Rangel Raich
Karen.

### 1:14:42 — Mario Stevan do Nascimento Santos
Rapaz, essa questão de não falar para ele, já está mais ciente, não só ele, como o depre e o de tech.

### 1:14:47 — Matheus Sa de Araujo Miranda
So.Stop.

### 1:14:53 — Iago Lunar Rangel Raich
Só o presidente, o diretor técnico e o gerente. Só que está por dentro da situação. Sem pressão, tá? Sem pressão.

### 1:14:57 — Matheus Sa de Araujo Miranda
I'm só isso.

### 1:14:59 — Mario Stevan do Nascimento Santos
So.Sem pressão.

### 1:15:02 — Matheus Sa de Araujo Miranda
I don't burn anything.

### 1:15:04 — Iago Lunar Rangel Raich
Mas, cara, está legal, está? É para quem não tinha nada, cara. A gente estava no escuro em relação a isso, é.

### 1:15:09 — Matheus Sa de Araujo Miranda
Yeah.

### 1:15:12 — Iago Lunar Rangel Raich
Cara, sabe o que eu acho interessante? Eu não sei se vocês conseguem fazer. Já pensei aqui numa solução. É botar uma Iazinha, um chatbot que sirva de ajuda para quem está usando. Então, tipo assim.

### 1:15:24 — Matheus Sa de Araujo Miranda
Santos.Yeah.

### 1:15:28 — Iago Lunar Rangel Raich
O cara, ele, em vez de ele ficar pesquisando no filtro tudo, ele vai aplicando o filtro, ele bota no chatbot lá, traga, gere para mim o relatório de tudo que foi executado em 2025 do time de manutenção e instrumentação.

### 1:15:43 — Matheus Sa de Araujo Miranda
Chatbot para o administrador, no caso, não para o usuário.

### 1:15:46 — Iago Lunar Rangel Raich
Não, para o zoado, para o zoado, é não, calma, nesse nível de consulta pode ser o administrador, mas a nível de tipo assim, é o vamos supor que o colaborador lá, o operador, ele quer ele quer ter uma visão do que que ele executou.No mês de maio de 2026, traga para mim tudo que foi executado no mês de maio que eu executei, que aí ele vai, vai falar, você executou tal ordem no dia tal e tal ordem, enfim, aí vai.

### 1:16:07 — Matheus Sa de Araujo Miranda
I thank you.Okay.

### 1:16:20 — Iago Lunar Rangel Raich
do do da criatividade de vocês acho interessante botar um chatbot para poder auxiliar as pessoas a usar a ferramenta entendeu porque que acontece hoje o SAP ele tem uma e a embarcada nele só que o Maria embarcada do SAP

### 1:16:21 — Matheus Sa de Araujo Miranda
I know.Okay.Telefone.

### 1:16:35 — Iago Lunar Rangel Raich
Eu acho que está em torno de 200000000 de reais.

### 1:16:38 — Matheus Sa de Araujo Miranda
Cross tha.

### 1:16:40 — Iago Lunar Rangel Raich
É porque o SAP ele não é uma ferramenta de uso.

### 1:16:43 — Matheus Sa de Araujo Miranda
I need a is.

### 1:16:45 — Iago Lunar Rangel Raich
Cara, ele é o SAP, é a maior, é o maior RP do mundo. Então, tipo assim, as empresas que usam ela é tipo vale, é. E o SAP, ele tem tudo integrado, comercial, financeiro, fiscal.

### 1:16:47 — Matheus Sa de Araujo Miranda
Go ahead.It.

### 1:16:59 — Iago Lunar Rangel Raich
Só que hoje a esse gás, ele não. Ela não usa nem 10% do que o sapo entrega, entendeu? Ela usa apenas o módulo de controle de manutenção e o módulo de mercadoria de movimentação de mercadoria e o módulo de.De nota, o módulo fiscal, o Mario que a Pamela usa lá, só fiscal, manutenção e.

### 1:17:18 — Mario Stevan do Nascimento Santos
Yes, ma'am. Yes.

### 1:17:23 — Iago Lunar Rangel Raich
Enfim, e mercadoria, mas o SAP tem mais de 15 tipos de módulos, mas a e a Energisa em Sinam e para cada módulo desse tem que comprar e é muito caro. Até porque é por isso que eles vão descontinuar num futuro bem provável.

### 1:17:33 — Matheus Sa de Araujo Miranda
Okay.Santos and

### 1:17:41 — Iago Lunar Rangel Raich
Eu sei que é milhões, cara, para implantar o SAP, muitos milhões, qualquer coisinha que você bota é milhões.

### 1:17:47 — Matheus Sa de Araujo Miranda
Mhm, thank you.

### 1:17:49 — Iago Lunar Rangel Raich
Aí é, acho que é isso, tá gente? Muito obrigado aí, tá legal a ferramenta.

### 1:17:49 — Matheus Sa de Araujo Miranda
Home.Okay.A gente que agradece, é, vocês deram bastante sugestões para o que a gente precisa arrumar e o que a gente precisa validar. Inclusive, várias discussões que a gente teve foram esclarecidas aqui durante a reunião, então a gente agradece muito a oportunidade.Tanto de estar desenvolvendo quanto de ter esse contato com vocês também.

### 1:18:18 — Iago Lunar Rangel Raich
É o novo, o novo segmento aí também, completamente diferente da energia, né?

### 1:18:22 — Matheus Sa de Araujo Miranda
I think I want to do that. No.

### 1:18:26 — Iago Lunar Rangel Raich
Completamente, mas prazer aí, tá? Se vocês precisarem, podem chamar a gente durante a semana que a gente está à disposição de vocês aí, beleza?

### 1:18:27 — Mario Stevan do Nascimento Santos
Thanks.

### 1:18:33 — Matheus Sa de Araujo Miranda
É, aí fica a atividade durante a semana você passar para a gente, é isso aí, a gente é hoje, a gente vai tentar passar até vai passar para vocês o link do site, então para vocês querem usar. E aí vocês podem dar uma olhada.

### 1:18:37 — Mario Stevan do Nascimento Santos
Sugestões.Eu vou pensar numa sugestão aqui então para vocês.

### 1:18:52 — Matheus Sa de Araujo Miranda
Nada ou de novo?

### 1:18:53 — Iago Lunar Rangel Raich
Aí, tá publicado já?

### 1:18:55 — Matheus Sa de Araujo Miranda
a gente vai a gente vai até amanhã a gente consegue a gente vai também é implementar essas funcionalidades que a gente mostrou para vocês e as que vocês sugeriram também é dentro do fluxo principal e hospedar

### 1:19:00 — Mario Stevan do Nascimento Santos
Eu vou testar ele já.

### 1:19:11 — Matheus Sa de Araujo Miranda
Em alguma, algum lugar que a gente não necessariamente precisa fazer a parte mobile, a gente pode fazer alguma gambiarrazinha só para vocês conseguirem usar e depois a gente.

### 1:19:24 — Iago Lunar Rangel Raich
Pô, é interessante fazer isso aí, que aí amanhã eu já consigo ou essa semana eu consigo apresentar para o diretor lá e para o gerente para ver para eles terem alguma noção de como é que está ficando.

### 1:19:27 — Matheus Sa de Araujo Miranda
Sorry.Exato. Aí a gente aí você consegue passar para a gente aí o reposto de sugestões ótimo, que aí a gente agora só já fez o relacionamento assim melhor do conceito e aí depois é só melhoria.

### 1:19:37 — Iago Lunar Rangel Raich
Suggest on it.

### 1:19:47 — Matheus Sa de Araujo Miranda
So.

### 1:19:47 — Iago Lunar Rangel Raich
Perfeito, show de bola. Obrigadão aí, bom trabalho.

### 1:19:48 — Mario Stevan do Nascimento Santos
Beleza.

### 1:19:50 — Matheus Sa de Araujo Miranda
De 0 a 10, de 0 a 10, a gente ganha muito.

### 1:19:56 — Iago Lunar Rangel Raich
cara e aí Mario que você acha você é exigente eu sou eu sou cara tá nota muito bom nota um mentira

### 1:20:07 — Matheus Sa de Araujo Miranda
No, I thought you got anything that I do that.

### 1:20:10 — Mario Stevan do Nascimento Santos
Olha, vamos lá, é por parte, por parte eu vou dar, olha, eu vou dar, eu vou dar, vou dar minha nota aqui, tá? Vou dar uns 7 e meio por visões de que, como vocês estão desenvolvendo, eu vi que tem bastante coisa legal, mas também eu vi que tem algumas partes da PR ali.

### 1:20:11 — Iago Lunar Rangel Raich
Vai, vou dar um 8 aí mesmo, 8 e meio, cara.

### 1:20:19 — Matheus Sa de Araujo Miranda
Okay.

### 1:20:27 — Mario Stevan do Nascimento Santos
Que podem ter algumas melhorias em questão de design, como vocês estão fazendo primeiro a parte da funcionalidade, depois vocês vão para a parte que tem o front e o back para distribuir ele bonitinho, para deixar aquela parte, não fica muito poluído, entendeu? eSIM nos seus grids, nas suas demarcações.

### 1:20:34 — Iago Lunar Rangel Raich
Funcionalidade, né?

### 1:20:48 — Mario Stevan do Nascimento Santos
Mas eu vou dar um 7 e meio beirando pra um 8 aí e eu sei que vocês vão chegar lá.

### 1:20:51 — Matheus Sa de Araujo Miranda
And.I don't wait, I think.

### 1:20:54 — Iago Lunar Rangel Raich
eu já dou um mentira eu já dou eu dou um 8 e meio já tá quase beirando nova é só refinar agora cara a o bruto já tá pronto praticamente

### 1:21:04 — Matheus Sa de Araujo Miranda
A pergunta assim pro pro meu TCC, a outra equipe, vocês eram com qual nota?

### 1:21:12 — Mario Stevan do Nascimento Santos
Okay.

### 1:21:14 — Matheus Sa de Araujo Miranda
She makes me jump.

### 1:21:15 — Iago Lunar Rangel Raich
trabalhar para caramba para poder é vocês vão ter que trabalhar aí cara não tem jeito não os cara lá é bom também

### 1:21:15 — Mario Stevan do Nascimento Santos
Tá competitivo, tá competitivo.

### 1:21:17 — Matheus Sa de Araujo Miranda
Sure.Mhm.Mm.Hello!

### 1:21:24 — Mario Stevan do Nascimento Santos
Mas eu sei que vocês conseguem, eu sei que vocês conseguem.

### 1:21:24 — Iago Lunar Rangel Raich
Não adianta não cara, o deles lá tá tenso também, tá? Vou te falar que tá

### 1:21:30 — Matheus Sa de Araujo Miranda
Tá bom, obrigado pessoal. Obrigada. Boa tarde aí, tudo de bom.

### 1:21:32 — Mario Stevan do Nascimento Santos
Douglas, and Valab, tchau.

### 1:21:33 — Iago Lunar Rangel Raich
Valeu, valeu, abraço aí, valeu, tchau, tchau.Boa, tchau, tchau.

### 1:21:38 — Mario Stevan do Nascimento Santos
Hello.

### 1:21:39 — Matheus Sa de Araujo Miranda
No, I think with it.

Matheus Sa de Araujo Miranda parou a transcrição

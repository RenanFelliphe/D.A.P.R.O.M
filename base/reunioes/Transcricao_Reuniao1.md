# Reunião — Digitalização do Processo de Manutenção

> **Documento:** Transcrição organizada da reunião  
> **Base:** conteúdo fornecido no arquivo da reunião  
> **Observação:** o conteúdo abaixo foi reorganizado por temas para facilitar consulta, preservando as informações registradas na transcrição.

# Decisões

- Digitalizar as ordens de serviço com assinatura, fotos, geração de PDF e armazenamento, inicialmente sem integração via API com o SAP.
- Criar grupos de suporte durante as duas semanas entre os encontros presenciais.

# Perguntas em aberto

- Definir o vínculo entre dispositivos e usuários.
- Definir o modelo de autenticação: MFA ou SSO.
- Definir os critérios bloqueantes da APR.
- Definir as notificações e o fluxo para respostas negativas na APR.
- Incorporar a criticidade de locais e clientes aos painéis e filtros.

# Anotações da reunião

## 1. Processo em Papel

- O processo de ordens de serviço havia permanecido essencialmente manual: as OS de manutenção preventiva e corretiva eram impressas, separadas por equipes, preenchidas em campo e posteriormente escaneadas por Iago.
- No mês anterior, haviam sido encerradas aproximadamente 390 OS, com variações mensais de pouco mais de 200 a 409 ordens, o que exigia eventualmente o apoio de outra pessoa.
- Foram disponibilizados no chat dois modelos preenchidos de ordens de serviço para consulta, como alternativa enquanto o grupo não conseguia acessar o SAP.
- Em setembro, o time de manutenção civil, laboratório e instrumentação havia executado 232 ordens de manutenção.
- Cada ordem continha número, data de geração e impressão e informações trazidas pelo SAP, como centro de trabalho, grupo de planejamento e tipo de ordem.

## 2. Eficiência Operacional

- O fluxo em papel gerava retrabalho, alto consumo de horas-homem e custos com impressoras, tinta e manutenção.
- A expansão da demanda de clientes e ativos em campo aumentava o risco de o processo não conseguir acompanhar o volume.
- Os documentos também podiam retornar sujos, incompletos ou circular entre equipes.
- Falhas no SAP e problemas de conectividade dificultavam a execução das atividades.

## 3. Digitalização do Processo

- Foi apresentada a proposta de digitalizar o processo por meio de uma interface web para desktop e de um aplicativo móvel.
- A digitalização buscaria melhorar a rastreabilidade e o controle, automatizar atividades demoradas e reduzir o esforço atualmente realizado por cerca de quatro a cinco pessoas, além do consumo de insumos.
- O aplicativo móvel deveria permitir ao operador de campo visualizar as ordens de serviço em aberto e acessar os detalhes da atividade de manutenção.
- Os detalhes deveriam incluir tipo de serviço, instruções de execução, materiais e ferramentas necessários, endereço e, quando aplicável, um plus code.
- A descrição deveria conter o máximo possível de detalhes para que o operador identificasse previamente os recursos necessários, como enxada ou britadeira, inclusive quando fosse necessária a recomposição do asfalto.

## 4. Fluxo de Manutenção

- O fluxo existente utilizava o módulo PM do SAP para manutenção, enquanto o módulo MM se referia à movimentação de mercadorias.
- As manutenções corretivas eram abertas sob demanda para tratar incidentes, como a obstrução de uma válvula de gás por obras de recapeamento.
- As preventivas eram programadas para inspeções em estações, incluindo verificações de corrosão de válvulas e calibração de instrumentos.
- O levantamento considerava aproximadamente 900 ordens mensais, distribuídas entre manutenções programadas e corretivas, embora o acesso ao SAP via Citrix estivesse instável durante a demonstração.
- Após a execução, o operador deveria registrar no aplicativo os detalhes da atividade realizada, a data e a hora, uma fotografia como evidência e sua assinatura.
- O encerramento deveria gerar automaticamente um documento PDF com essas informações, armazenado em uma base de dados.
- O fluxo também contemplaria a sincronização das ordens com o aplicativo, o despacho para a equipe vinculada e a atualização do trabalho concluído.
- A geração de uma saída para o SAP estava prevista, mas ainda não estava disponível por falta de API.
- As ordens de manutenção eram classificadas em duas categorias: corretiva e preventiva.
- O SAP já gerava a ordem, e o sistema proposto deveria permitir seu preenchimento digital, encerramento, armazenamento e consulta.
- Quando uma condição de trabalho impedisse a execução, a PR deveria sinalizar o impedimento e permitir que a situação gerasse uma atividade adicional.
- Como exemplo, foi citado o caso de uma caixa de válvula cheia de água: o operador não poderia entrar e seria necessário acionar a manutenção civil para levar uma bomba, retirar a água e limpar o local antes da manutenção da válvula.

## 5. Gestão de Acessos

- O sistema precisaria segmentar equipes e perfis de acesso.
- Foram citados grupos e funções como serviços especiais, instrumentação, atendimento residencial, gazistas, instrumentistas e eletricistas.
- Também foi discutido o cadastro dos dispositivos por dispositivo ou por colaborador.
- Haveria necessidade de autenticação para gestão de acesso, possivelmente com MFA.

## 6. Histórico de Manutenção

- Foi proposta uma tela de consulta conectada à base de dados para manter o histórico das manutenções executadas.
- O gestor poderia consultar, por exemplo, quando havia sido realizada a última manutenção preventiva de uma válvula ou a última calibração de um manômetro.

## 7. Formulários Operacionais

- Os formulários de APR e de ordem de serviço estavam disponíveis, inclusive em modelo editável, e poderiam ser utilizados como referência para a formatação dos formulários preenchidos pelos gazistas e demais usuários.
- A APR (Análise Preliminar de Risco) era obrigatória antes de um gazista iniciar uma atividade.
- O documento era elaborado pela área de segurança do trabalho, encaminhado às equipes de operação e impresso para acompanhar a ordem de serviço, normalmente grampeado junto a ela.
- A APR funcionava como um checklist para verificar se o operador estava capacitado e apto a executar a atividade.
- Para trabalhos em altura ou em espaço confinado, o operador deveria preencher informações como a ordem de serviço e o local da instalação ou do cliente.
- Caso identificasse uma condição inadequada, deveria registrar que a execução não estava conforme para sinalizar o impedimento.
- A APR era estruturada em etapas. Primeiro, a equipe registrava o supervisor da atividade, sua assinatura e verificações sobre as condições físicas dos participantes, conhecimento do local de atendimento mais próximo e capacidade de realizar um resgate de emergência.
- Essa primeira etapa reunia 11 itens de segurança e, caso qualquer resposta fosse negativa, a atividade deveria ser interrompida.
- A APR continha campo de observações e contatos para situações de emergência, incluindo Corpo de Bombeiros, coordenador de logística, área de operações, coordenador de ativos Rodrigo e segurança do trabalho.
- A área de segurança revisava o documento periodicamente e atualizava cláusulas ou itens quando necessário.
- O formulário digital da ordem deveria reunir local de instalação, descrição da atividade, datas e horários de início e término, acompanhamento da manutenção e assinatura do operador.
- A PR deveria permanecer vinculada à ordem e ser preenchida junto com ela.
- A APR não tinha um único conteúdo idêntico para todas as atividades. Cada tipo de manutenção utilizava uma APR específica, embora o layout pudesse permanecer semelhante.
- Trabalho em altura, espaço confinado e movimentação de carga foram citados como exemplos de tipos diferentes, com conceitos e itens próprios.
- Os tipos de APR eram fixos, mas podiam ser atualizados pela área de segurança do trabalho.
- Quando a área de segurança aprimorava ou refinava uma APR, publicava uma nova versão para que as demais áreas passassem a utilizá-la.
- Foi considerada relevante a possibilidade de usuários autorizados editarem ou personalizarem as APRs no aplicativo.
- Foi proposta a possibilidade de usuários com perfil de administrador criarem e personalizarem modelos de PR, inclusive versões já existentes.
- O modelo configurado permaneceria como padrão para todos os colaboradores que executassem o mesmo tipo de atividade, alterando-se apenas os dados preenchidos pelo responsável pela execução.

## 8. Segurança Operacional

- O checklist de segurança avaliava as condições dos colaboradores, do ambiente, da equipe de apoio e do clima, para confirmar se a atividade poderia ser executada com segurança.
- A prática da empresa exigia que ninguém trabalhasse sozinho, com a atividade realizada em dupla e com um supervisor definido.
- Na segunda etapa da APR, eram apresentadas verificações específicas da atividade.
- Para trabalho em altura acima de dois metros, o formulário previa a confirmação do uso de sistema para prevenção de quedas, linha de vida e sistema de resgate, como um tripé ou ponto de apoio.
- Para trabalho em telhado, também verificava a instalação de pranchas, escadas e guarda-corpos.
- Para atividades em espaço confinado, o formulário definia o ambiente como uma área não projetada para ocupação humana contínua, com meios limitados de entrada e saída, e incluía perguntas sobre ventilação por insuflador, exaustor ou ventilação natural.
- A APR também considerava riscos específicos de ambientes com gás natural e espaços confinados.
- Embora o gás fosse odorizado, poderiam ocorrer falhas de odorização e o operador poderia inalá-lo sem percebê-lo. Por isso, o formulário previa o uso de insuflador, ventilador ou exaustor e a confirmação de que os equipamentos elétricos eram adequados ao ambiente.
- Uma fagulha, inclusive proveniente do uso de um celular inadequado, poderia causar uma explosão.
- Se qualquer item do checklist recebesse resposta negativa, a atividade não deveria ser iniciada.
- A PR registrava condições específicas da execução, como necessidade de iluminação auxiliar, impedimentos para realizar a atividade, riscos de queda relacionados ao nivelamento e a buracos no solo, além do uso de protetor solar quando aplicável.
- A ausência de iluminação auxiliar, no exemplo apresentado, não foi considerada impeditiva e a atividade pôde prosseguir.
- Uma resposta negativa em itens críticos deveria impedir a execução.
- Entre os exemplos estavam condições físicas e psicológicas dos participantes, ausência de adornos, aptidão da equipe para realizar um resgate de emergência e conhecimento do local mais próximo de atendimento hospitalar.
- O checklist deveria funcionar como um fluxo sequencial de perguntas, no qual uma resposta positiva liberaria a etapa seguinte.
- Uma resposta negativa em um critério eliminatório interromperia imediatamente a atividade e poderia gerar uma notificação ao supervisor, informando o motivo do impedimento.
- Foi feita a diferenciação entre itens eliminatórios e itens de alerta. A necessidade de iluminação auxiliar, por exemplo, não deveria bloquear automaticamente a execução.
- O bloqueio seria aplicado apenas quando houvesse um impedimento efetivo para realizar a atividade.
- O preenchimento da PR normalmente precedia imediatamente a execução da ordem, mas qualquer condição que pudesse gerar risco deveria interromper a atividade, mesmo depois de a PR ter sido preenchida.
- O operador precisaria justificar a interrupção ao supervisor ou coordenador e à pessoa solicitante, registrando o motivo no campo de observações da PR.
- Foi relatado o caso de uma ordem preventiva que permanecia sem execução havia três meses porque havia uma caixa de marimbondos dentro de uma empresa. A atividade dependeria de dedetização antes de poder ser realizada com segurança.
- A calibração preventiva de uma válvula PSV na Vale foi destacada como atividade de alto impacto operacional. Caso a válvula permanecesse descalibrada, um vazamento de gás poderia não ser percebido se a odorização falhasse, criando risco de exposição das pessoas e de interrupção da operação.

## 9. Gestão de Ordens de Serviço

- Uma ordem de serviço podia permanecer sem execução por até três meses quando dependia de um time externo para solicitar apoio e concluir a atividade.
- Se a equipe responsável não finalizasse a OS, ela seria encaminhada ao supervisor e o fluxo seguiria para outra ordem.
- Quando uma OS gerava uma reação em cadeia, ela permanecia pendente e em aberto até a conclusão da atividade.
- Após liberar uma ordem de manutenção, ela ficava pronta para ser impressa e entregue ao colaborador responsável pela execução em campo.
- Ao concluir a atividade, Iago encerrava a ordem no sistema e anexava o formulário preenchido manualmente, depois de escaneá-lo e digitalizá-lo.

## 10. Relatórios e Status no SAP

- O relatório extraído do SAP diferenciava as ordens corretivas YBA1, abertas sob demanda, das preventivas YBA2, programadas em frequências como mensal, trimestral ou semestral.
- O relatório apresentava identificadores separados para a nota e para a ordem.
- A nota registrava o relato e gerava a OS, que incluía dados como data de início, local de instalação, descrição da atividade e status do sistema.
- Após a geração, a ordem precisava ser liberada pelo analista responsável antes da execução.
- O status “liberada” indicava que a ordem estava autorizada para execução.
- O indicador de impressão só aparecia depois que a ordem havia sido impressa.
- Caso a atividade não pudesse ser realizada, como no exemplo da caixa de marimbondos, a ordem poderia ser reprogramada com uma nota justificando o impedimento e permaneceria com o status “liberada”.
- A equipe já dispunha de um site com controle das atividades executadas e em aberto, além de dashboards para acompanhamento.
- O site permitia importar o relatório mensal do SAP e consultar, em um dashboard, o total de ordens, as ordens abertas, encerradas e bloqueadas, além da separação entre manutenções preventivas e corretivas.
- Também era possível pesquisar uma ordem pelo número e consultar detalhes como status, equipe responsável, tipo, descrição, data-base e atividade.
- Pelo menos uma vez por semana, eram exportadas as ordens preventivas em aberto por equipe e enviado por e-mail um dashboard atualizado aos representantes de cada time.
- O relatório permitia consultar atividades pendentes, acompanhar o andamento e cobrar prazos, enquanto as próprias equipes também podiam acessar o controle.
- O site funcionava como uma camada simplificada de consulta, com dados extraídos do SAP, permitindo que analistas e equipes acompanhassem as atividades críticas, abertas e encerradas sem precisar navegar diretamente pela ferramenta.

## 11. Apoio ao Projeto

- As equipes trabalhariam ao longo das duas semanas entre os encontros presenciais.
- Foi sugerida a criação de grupos de WhatsApp por equipe, com participação de Iago, Mario e dos mentores, para esclarecer dúvidas, acompanhar o andamento e eventualmente realizar encontros breves fora do horário de expediente.
- Iago confirmou que sua área estaria disponível para apoiar o projeto durante o horário de expediente, desde que fosse avisada previamente.
- A comunicação oficial com os alunos do programa Rio Pomba Valley seria feita pelo WhatsApp, porque a maioria ainda não tinha acesso ao Teams.
- Como alternativa para os encontros, um representante da turma poderia criar uma sala no Google Meet e compartilhar o link com o grupo, ou Iago e Mario poderiam disponibilizar um link do Teams com acesso externo para convidados.

## 12. Indicadores de Manutenção

- As ordens preventivas não executadas eram acompanhadas por um indicador mensal.
- Quando havia um impedimento concreto no local, como uma caixa de marimbondos que exigia a atuação de uma equipe externa, a ordem permanecia pendente e aparecia como atrasada, mas com justificativa.
- Se a ordem não tivesse sido executada sem um motivo registrado, seria contabilizada como atrasada e sem justificativa.
- Os indicadores de ordens pendentes, atrasadas e justificadas eram acompanhados pelos níveis de gerência e diretoria.
- Em agosto de 2026, foram registradas 355 ordens de manutenção preventiva, e todas foram encerradas.
- Em setembro de 2026, o sistema apresentou 729 ordens no total, sendo 228 em aberto e 501 encerradas.
- Os dados podiam ser filtrados por equipe e por status, permitindo visualizar especificamente as ordens preventivas pendentes.
- Cada área já mantinha controles internos das atividades prioritárias e os coordenadores recebiam as ordens de serviço com a respectiva prioridade.
- Um BI dedicado estava sendo criado para consolidar esse acompanhamento em uma tela, enquanto gerência e diretoria continuavam monitorando os indicadores.

## 13. Criticidade Operacional

- O controle deveria permitir a separação das ordens por criticidade.
- Foram diferenciadas atividades de baixo impacto, como roçagem e lavagem de estações, de intervenções críticas em instalações da Vale.
- A não execução de uma atividade crítica poderia interromper a operação do cliente e gerar multas de grande valor.
- Os pontos de recebimento de gás (PR), as estações de redução primária e secundária (ERP e ERS), as autorizações e os grandes clientes, como Vale e Suzano, deveriam ser tratados como prioridades críticas.
- Nessas instalações, a não execução de atividades como a calibração de uma válvula poderia danificar equipamentos, interromper a operação do cliente e gerar impactos financeiros relevantes.

# Tarefas de acompanhamento

| Tarefa | Atribuído a | Data de conclusão | Balde |
|---|---|---|---|
| Enviar um relatório exportado para servir como base de dados às equipes | Iago | — | — |
| Criar um link de reunião no Teams com acesso para convidados externos e enviá-lo aos alunos do programa Rio Pomba Valley | Iago, Mario | — | — |

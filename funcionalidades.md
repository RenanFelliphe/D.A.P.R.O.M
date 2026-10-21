# Funcionalidades — diagnóstico em 20/10/2026

> O mapa do que o sistema faz hoje e do que falta, nas funcionalidades essenciais (o que a especificação exige para a demo) e nas extras (ideias do time, dos mentores e do cliente, fora do MVP). Cada demanda tem o próprio arquivo, com as decisões e a implementação, em [base/funcionalidades/](base/funcionalidades/); o plano do app está em [funcionalidades/mobile.md](funcionalidades/mobile.md). O guia de trabalho até o fim do MVP é o [pendencias.md](pendencias.md).
>
> Fontes: [especificação](base/.design/especificacao.md), [DesignDoc](DesignDoc.md), [pontos a validar](base/.design/pontos-a-validar.md), [pendencias.md](pendencias.md), os arquivos de [base/funcionalidades/](base/funcionalidades/) e o código em [api/](api/), [web/](web/), [mobile/](mobile/) e [shared/](shared/).

## Resumo

- **As três aplicações estão feitas no código.** A `api` tem as regras, o banco, o PDF, as tarefas e a IA. A `web` tem a área de campo e o painel de gestão. O app Android (`mobile`, Expo) faz o caminho inteiro online e tem o modo offline de contingência: a cópia da equipe, a fila em SQLite, a entrada sem sinal e o envio com o app fechado.
- **O que falta para dar o MVP por completo é conferir, não programar:** ver o app num aparelho (o APK do `mobile/Dockerfile` ainda não foi montado), rodar a bateria da Vitória e testar com a IA real as funções novas. O SMTP depende da TI da empresa.
- **O fluxo segue as correções da Reunião 3** (18/10/2026, [correcoes-da-reuniao-3.md](base/funcionalidades/correcoes-da-reuniao-3.md)): assinatura de cada participante na própria conta, mínimo de 2 participantes, motivos de pausa e suspensão, localização em cinco momentos, encerramento em dois passos e o supervisor assinando por último. O PDF reproduz a APR e a folha do SAP; o resto vai para o relatório da execução.
- **Todas as extras pedidas estão prontas,** e outras surgiram no caminho (seção 3). As últimas, de 19 e 20/10/2026: a sugestão de materiais, a execução compartilhada, o pedido de conta na entrada, o tempo por minijogo, o controle da IA por função, a recomendação de modelo de APR guardada por OS e a validação dos treinamentos pelos supervisores.
- **Números (20/10/2026):** 207 rotas na `api` (as dos simuladores só existem com `SAP_SIMULADO` e `RH_SIMULADO`), 45 migrações (`0000` a `0044`), 59 arquivos de teste na `api` e 305 testes no `mobile`. O `tsc` da `api` e da `web` sai sem erros.

## O que ainda falta, num relance

**Conferir (código pronto)**

- [ ] **O app num aparelho ou emulador:** montar o APK (`pnpm apk`, com Docker), instalar e fazer ler OS → APR → executar → PDF online e em modo avião, com o envio com o app fechado. Até aqui o app foi validado por `tsc`, ESLint, testes e scripts contra a `api` local ([pendencias.md](pendencias.md), pendências 1 a 7).
- [ ] **A bateria da Vitória** (66 casos) contra a IA real: a primeira rodada parou na cota do Gemini gratuito ([vitoria.md](base/funcionalidades/vitoria.md), seção 2.9.1).
- [ ] **A IA real nas funções novas:** a digitalização da APR em papel, a recomendação de modelo de APR e a leitura de dados autorizada pelo controle da IA ([controle-da-ia.md](base/funcionalidades/controle-da-ia.md)).
- [ ] **A conferência visual** das telas do controle da IA e da validação dos treinamentos.

**Depende de terceiros** (seção 7.1): o servidor de e-mail (SMTP), a planilha de OS de 2025, onde o SAP guarda o ciclo do plano, a validade da assinatura desenhada, a lista de materiais por serviço, o critério de bloqueio dos modelos e a aprovação da empresa para enviar dados ao fornecedor de IA. A assinatura com validade jurídica e o login corporativo esperam contas.

**Decisões em aberto** ([pendencias.md](pendencias.md), pendências 20 a 23, e [Questoes.md](Questoes.md)): o supervisor devolver a OS ao responsável em vez de assinar; a equipe com só uma pessoa disponível; "Houve desvio?" e "Tempo parada" na folha do SAP; mais de 3 executantes na folha. Da execução compartilhada, os prazos de 72 h e 7 dias da conferência ainda esperam confirmação ([execucao-compartilhada.md](base/funcionalidades/execucao-compartilhada.md)). Da validação dos treinamentos, se criar e validar pontua.

---

## 1. Como o sistema está organizado

As extras mudaram o desenho original:

- o catálogo de serviço virou uma etapa da APR;
- a evidência aceita PDF;
- as preventivas ganharam um ciclo e um checklist de inspeção;
- quase toda ação de campo pontua;
- a execução passou a ser de todos os participantes, não só do responsável;
- a IA apoia quatro funções, cada uma ligada ou desligada pelo admin.

O supervisor não é um perfil, e a web tem uma casca única para todos.

### 1.1 Perfis e portal

- **Dois perfis: `tecnico` e `admin`.** O supervisor é quem a equipe aponta (`equipe.supervisor_id`) e ganha a gestão das equipes que supervisiona. O representante da equipe assume quando o supervisor se ausenta, fica 3 dias parado ou falta. O admin cuida da plataforma e não executa OS.
- **Web:** casca única. Campo e gestão ficam em `/app/*`; as telas só de gestão (importação, alertas, modelos de APR e auditoria) ficam em `/web/*` e abrem só para admin e supervisor. O menu muda conforme o perfil. A web é responsiva e funciona no navegador do celular.
- **App:** as telas de campo (OS, APR, execução, avisos, pontos, perfil e Vitória). A gestão fica na web; o admin que entra no app é avisado disso.
- **Técnico pendente.** O técnico que o supervisor cadastra nasce `pendente`: entra, troca a senha, faz o Campo de treino, joga os treinamentos e conversa com a Vitória até o admin liberar ou recusar. Quem não tem conta pede uma na tela de entrada.
- **Assinatura primeiro.** Depois da liberação, a assinatura do perfil é a primeira coisa a cadastrar, em todos os perfis.

### 1.2 O caminho da OS

1. **Entrada.** A OS vem de quatro lugares:
   - do SAP, por leitura agendada (na subida e a cada 15 minutos, por padrão) ou pelo "Ler agora";
   - da planilha exportada;
   - do PDF da OS, conferido campo a campo antes do registro;
   - da digitalização de OS antigas, já executadas no papel, que entram encerradas, de histórico.

   A equipe sai do centro de trabalho. A única OS criada no próprio sistema é a de apoio, aberta a partir de um impedimento.

   A OS chega para a equipe toda. O supervisor da equipe pode reservá-la a uma pessoa, que passa a ser a única a iniciá-la, ou devolvê-la ao SAP com uma justificativa, se a ordem tiver erro (seção 6).
2. **Detalhe.** Além dos dados do SAP, o detalhe mostra:
   - os materiais recomendados do serviço, só para consulta, com "Sugerir lista" e "Contestar lista";
   - o ciclo da preventiva e o checklist de inspeção do plano;
   - o histórico do local e do equipamento;
   - todas as APRs, execuções e conferências anteriores.
3. **APR.**
   - **Etapas:**
     1. modelo, participantes e riscos: o técnico escolhe o modelo numa janela com todos os publicados, e o sistema recomenda um, com o motivo (seção 5);
     2. checklist respondido por inteiro, sem marcar o que é eliminatório (o modelo ainda pode ser trocado);
     3. revisão, com os materiais recomendados como lembrete;
     4. validação no servidor (`POST /aprs/avaliar`).
   - **Bloqueada:** quando um item eliminatório é reprovado. A APR fica registrada na hora, a OS fica pendente e o supervisor recebe alerta e e-mail. O técnico documenta cada item reprovado com foto, texto ou PDF, conforme o modelo pede.
   - **Aprovada:** a APR é registrada sem assinaturas (exige ao menos 2 participantes). Cada participante assina na própria conta, ou recusa, e a execução só começa quando todos assinaram. Sem sinal, no app, os presentes assinam pelo mesmo aparelho e o servidor valida quando o sinal volta.
4. **Execução.**
   - Iniciar, pausar e suspender (os dois com motivo obrigatório), interromper por risco (com motivo, foto e assinatura), cancelar por engano (até 10 minutos depois do início) e encerrar.
   - A localização é gravada no início, na pausa, na suspensão, na interrupção e no encerramento.
   - O encerramento tem dois passos: o clique em "Encerrar OS" (o tempo para) e o preenchimento, com o checklist de inspeção da preventiva e a assinatura do responsável; a descrição e as fotos são opcionais, e entram até 5 PDFs.
   - **Compartilhada:** todos os participantes acompanham e agem. Pausar, interromper e suspender por saúde valem na hora; encerrar e suspender por outro motivo viram um pedido de 2 minutos ao responsável. O que foi feito sem sinal em aparelhos diferentes vira uma conferência.
5. **Documento e baixa.**
   - O supervisor lê o relatório da execução e assina por último; a OS passa de `encerrando` e `aguardando_supervisor` a `encerrada`.
   - O PDF da OS (a APR e a folha do SAP, como o papel) é gerado em segundo plano, depois dessa assinatura.
   - A planilha de baixa no SAP sai com quatro abas: Encerradas, Sem ordem SAP, Impedimentos e Devolvidas.
6. **Depois.** Dashboards, alertas de ciclo das preventivas e pontos da gamificação.

Todo registro de campo passa por `POST /eventos`, que é idempotente, online e na fila offline do app.

### 1.3 Estado por área

| Área | Situação |
|---|---|
| Plataforma | **Pronta.** Monorepo com `api`, `web`, `mobile` e `shared`; Dockerfiles da `api` e da `web` e o do `mobile`, que gera o APK; `docker-compose`, migrações aplicadas na subida, 7 buckets privados, tarefas em segundo plano com novas tentativas e modo local sem Supabase (`pnpm dev:local`) |
| Acesso e usuários | **Pronta.** Login pelo e-mail institucional, senha provisória trocada no primeiro acesso, redefinição pelo admin, cadastro pelo supervisor com liberação ou recusa pelo admin, pedido de conta na entrada, assinatura obrigatória no perfil e trilha de auditoria que só cresce |
| Campo de treino | **Pronto.** API fictícia em memória por usuário, tutorial Direcionado ou modo Livre; a `api` real só guarda o estado |
| Entrada de OS | **Pronta com o simulador**, com a planilha, com o PDF que tem texto e com a digitalização de OS antigas (PDF em lote ou fotos, OCR no impresso e IA no manuscrito, com conferência) |
| Registro de funcionários | **Pronto com o simulador.** Cadastro só de quem está no registro, desligamento em tempo real (aviso e leitura diária), selos na tela de usuários e a tela do simulador |
| Modelos de APR | **Pronta.** 8 modelos na carga inicial, versões imutáveis, editor, orientação de cada modelo para a escolha do técnico, arquivamento e restauração. O critério de bloqueio da carga é provisório até a Segurança do Trabalho validar |
| Catálogo de serviço | **Pronto.** Materiais, ferramentas e EPIs recomendados por serviço, com quantidade, e a sugestão e contestação da lista |
| APR | **Pronta na web e no app.** Modelo escolhido pelo técnico, com a recomendação e a troca, checklist inteiro, validação no servidor, materiais recomendados, evidência por foto, texto ou PDF e APR bloqueada registrada na validação |
| Execução | **Pronta na web e no app.** Assinatura da APR por participante, pausa e suspensão com motivo, localização, interrupção por risco, cancelamento por engano, encerramento em dois passos, execução compartilhada com pedidos e conferência, assinatura final do supervisor, PDF da OS e relatório da execução |
| Impedimento e avisos | **Pronta.** Alertas no sino e por e-mail (por categoria, com o resumo diário), reprogramação e OS de apoio. O e-mail espera o SMTP |
| Painel | **Pronto.** Quadro, detalhe, assinatura final do supervisor, local crítico, busca global, PDF e exportação para baixa |
| Indicadores | **Prontos.** 5 dashboards (Geral, Equipes, OS, APR e Meus resultados), com tempo de execução e de pausa por equipe, técnico e OS |
| Ciclo das preventivas | **Pronto.** Contagem até o próximo ciclo por plano e item, alertas de ciclo próximo e vencido e o checklist de inspeção; não cria OS |
| Gamificação | **Pronta.** Pontos por tarefa, temporadas trimestrais, ranking, patentes de pessoa e de equipe, conquistas (inclusive a de sincronização offline) e anonimato, na web e no app |
| Eventos e sincronização | **Pronta.** Envio idempotente, cópia da equipe (`POST /sync/pull`), tolerância à fila offline e conferência do que foi feito sem sinal; usados pela web e pelo app |
| App Android e modo offline | **Feito no código** (pendências 1 a 8, 19/10/2026, e a execução compartilhada, 20/10/2026): login, OS, APR, execução, câmera, assinatura, perfil, avisos, ausências, pontos e Vitória, online; cópia da equipe e fila em SQLite; entrada sem sinal por 7 dias; aviso de pendentes e Sair recusado com fila; envio com o app fechado; APK assinado pelo Dockerfile. **Falta ver num aparelho.** [README do mobile](mobile/README.md) e [plano](funcionalidades/mobile.md) |
| Treinamentos de serviço | **Prontos** ([treinamentos-de-servico.md](base/funcionalidades/treinamentos-de-servico.md)), só na web: criados pelo admin ou por supervisores, à mão ou com a IA, e validados pelos supervisores das equipes que mais fazem o serviço ([validacao-de-treinamento.md](base/funcionalidades/validacao-de-treinamento.md)) |
| Vitória e IA | **Prontas** ([vitoria.md](base/funcionalidades/vitoria.md)): a assistente na web e no app, em três camadas e com resposta parcial; o provedor por `IA_PROVEDOR` (Claude ou o Gemini gratuito, da demonstração); o admin liga e desliga cada função ([controle-da-ia.md](base/funcionalidades/controle-da-ia.md)). Falta rodar a bateria de 66 casos |

---

## 2. Funcionalidades essenciais

### 2.1 Pelo critério de sucesso da especificação

A seção "Sucesso" pede o caminho ler OS → APR → executar → PDF "no app Android e no navegador" e, como contingência, "num Android em modo avião".

| Parte do critério | Situação |
|---|---|
| No navegador, online | **Atende.** Funciona de ponta a ponta, e a OS encerrada aparece no painel na hora |
| No app Android, online | **Atende no código** (19/10/2026). Falta ver num aparelho ou emulador |
| Num Android em modo avião | **Atende no código** (19/10/2026): o app entra sem sinal, guarda a APR, a execução e o encerramento na fila e os envia quando o sinal volta, inclusive com o app fechado. Falta ver num aparelho |

### 2.2 Lista "Funcionalidades essenciais" do DesignDoc

| Funcionalidade | Situação |
|---|---|
| Validar a permissão de executar a OS depois da análise da APR | **Pronta.** A execução só começa com uma APR aprovada e assinada por todos, do dia e da própria OS, e com a pessoa entre os participantes |
| Documentação do obstáculo (imagem, PDF…) por item reprovado | **Pronta.** Foto, texto ou PDF, conforme o item do modelo pede. PDF a mais é sempre aceito |
| Sincronização automática e manual dos dados offline | **Pronta no código.** A fila sobe ao abrir o app, quando o sinal volta, de minuto em minuto com pendência, com o app fechado e no botão Sincronizar do perfil |
| Token temporário guardado no aparelho para o login offline | **Pronto no código.** Hash salgado da senha (PBKDF2) no armazenamento seguro, válido por 7 dias desde a última confirmação do servidor |
| Ler a equipe definida na OS (atribuição automática) | **Pronta.** A equipe sai do centro de trabalho da OS |

As definições e telas do DesignDoc (dados da OS, regras da APR, execução, PDF, painel pessoal e painel de gestão) estão cobertas pela web e, as de campo, também pelo app.

### 2.3 O que falta ou está parcial

- **Conferir o app num aparelho** (seção "O que ainda falta"). O que não foi visto: o desenho da assinatura com o dedo, a câmera, o banco abrindo no aparelho, o modo avião de verdade, o envio com o app fechado (o Android decide quando roda) e o tempo da derivação da senha.
- **Planilha do SAP.** O mapeamento das colunas é provisório até chegar a planilha de 2025.
- **Para o piloto, não para a demo:** o critério de bloqueio e a tabela de atividades reais (a carga traz 116 atividades provisórias); MFA ou SSO corporativo e vínculo do aparelho com o usuário, que estão como RFC na especificação.

### 2.4 Próximo passo

1. **Montar o APK e ver o app num aparelho,** com o roteiro da demo: online, em modo avião e de volta ao sinal. É o que fecha o critério de sucesso.
2. **Rodar a bateria da Vitória e testar a IA real** nas funções novas, com dados fictícios.
3. **Responder as decisões em aberto** que mudam o fluxo (pendências 20 e 21).

---

## 3. Funcionalidades extras

São ideias do [DesignDoc](DesignDoc.md) ("Prioridades" e "Extras"), das reuniões e do time. Nenhuma é exigida pela especificação.

### 3.1 Situação

| Ideia | Origem | Situação |
|---|---|---|
| OS de apoio | DesignDoc (prioridades) | **Pronta** |
| Assinatura cadastrada no perfil e nas ações importantes | DesignDoc (prioridades) | **Pronta** ([assinaturas.md](base/funcionalidades/assinaturas.md)). Não há certificado digital (ICP-Brasil) |
| Equipe atribuída automaticamente | DesignDoc (essenciais) | **Pronta** |
| Evidência em PDF | DesignDoc (essenciais) | **Pronta** |
| Catálogo de serviço com os materiais | DesignDoc (prioridades) | **Pronto**, com os materiais recomendados (seção 4) |
| Intervalo entre ciclos das preventivas | DesignDoc (prioridades) | **Pronto**, com o checklist de inspeção ([inspecao-preventivas.md](base/funcionalidades/inspecao-preventivas.md)) |
| Escaneamento de OS e APR antigas | DesignDoc (prioridades) | **Pronto** (19/10/2026), falta testar com a IA real ([vitoria.md](base/funcionalidades/vitoria.md#10-digitalização-de-os-antigas)) |
| Gamificação | Time, na Reunião 2 | **Pronta** ([gameficacao.md](base/funcionalidades/gameficacao.md)) |
| Chatbot de consulta | Iago, na Reunião 2 | **Virou a Vitória e os treinamentos de serviço**, prontos ([vitoria.md](base/funcionalidades/vitoria.md) e [treinamentos-de-servico.md](base/funcionalidades/treinamentos-de-servico.md)) |
| API de funcionários para cadastro rápido | DesignDoc (extras) | **Pronta com o simulador** ([apifuncionarios.md](base/funcionalidades/apifuncionarios.md)) |
| Tela do simulador do SAP | Time, 14/10/2026 | **Pronta** ([apiSAP.md](base/funcionalidades/apiSAP.md)) |
| Atribuição individual e devolução de OS | Time, 15/10/2026 | **Pronta** (seção 6) |
| Usuário ausente e representante da equipe | Time, 15 e 16/10/2026 | **Prontos** ([ausencia.md](base/funcionalidades/ausencia.md) e [representante.md](base/funcionalidades/representante.md)) |
| Avisos e e-mails | Time, 17/10/2026 | **Pronto, menos a configuração do SMTP** ([avisos-e-emails.md](base/funcionalidades/avisos-e-emails.md)) |
| Sugestão e contestação de materiais | Time, 19/10/2026 | **Pronta** ([sugestao-de-materiais.md](base/funcionalidades/sugestao-de-materiais.md)) |
| Execução compartilhada | Time, 19/10/2026 | **Pronta** nas três etapas ([execucao-compartilhada.md](base/funcionalidades/execucao-compartilhada.md)) |
| Pedido de conta na entrada | Time, 20/10/2026 | **Pronto** ([solicitacao-de-conta.md](base/funcionalidades/solicitacao-de-conta.md)) |
| Controle da IA por função | Time, 20/10/2026 | **Pronto**, falta a conferência visual e a IA real ([controle-da-ia.md](base/funcionalidades/controle-da-ia.md)) |
| Validação dos treinamentos pelos supervisores | Time, 20/10/2026 | **Pronta**, falta a conferência visual ([validacao-de-treinamento.md](base/funcionalidades/validacao-de-treinamento.md)) |

### 3.2 O que cada uma faz e o que falta

**OS de apoio**

- **Quem abre:** o supervisor da equipe da OS de origem ou o admin, a partir de um impedimento. Pode ser aberta para qualquer equipe.
- **Ligação com o SAP:** fica ligada à OS original e não tem número SAP até alguém criá-la lá. Por isso sai na aba "Sem ordem SAP" da planilha de baixa.
- **Encerramento:** avisa a equipe da OS original (alerta `apoio_encerrado`). **Cancelamento:** só o admin.

**Assinatura**

- Desenhada no perfil, confirmada a cada uso e impressa no PDF. Depois da liberação é obrigatória para todos os perfis (`403 assinatura_pendente` até ser cadastrada) e valida as ações importantes: a assinatura final do supervisor, a liberação de cadastro, a reprogramação, o cancelamento e a devolução de OS, a interrupção e o cancelamento por engano, as ausências e a autorização de leitura de dados da IA.
- Cada assinatura guarda a imagem usada; refazer a do perfil vale só para as próximas.
- **Falta:** o Iago dizer se a assinatura desenhada vale para auditoria (questão 38); a validade jurídica (ZapSign, gov.br) depende de conta.

**Evidência em PDF**

- O item do modelo diz se pede foto, texto ou PDF (questão 50). Um PDF a mais é sempre aceito, mas não substitui a foto exigida.
- Vale no item reprovado, na interrupção por risco e no encerramento (até 5 PDFs). A `api` confere o arquivo pelo conteúdo.

**Catálogo de serviço e materiais**

- O serviço é a própria atividade do plano de manutenção, a que a OS traz do SAP. Ela não escolhe o modelo de APR, mas a descrição dela entra na recomendação (seção 5).
- O admin cadastra materiais, ferramentas e EPIs e monta a lista de cada serviço. O detalhe da OS e a revisão da APR a mostram como recomendação (seção 4).
- Qualquer funcionário sugere uma lista ou contesta a recomendada; avalia o supervisor da equipe que mais faz o serviço, e o autor ganha 30 pontos na aceitação ([sugestao-de-materiais.md](base/funcionalidades/sugestao-de-materiais.md)).
- **Falta:** a lista real, que depende da ES Gás (questão 65).

**Ciclo das preventivas e checklist de inspeção**

- Conta o tempo até o próximo ciclo de cada plano e item, a partir do encerramento da última OS ou da data programada, e avisa quando o ciclo se aproxima ou vence sem OS nova. O sistema não cria OS.
- As perguntas da inspeção ficam no ciclo de cada plano; o encerramento da preventiva pede as caixas, e a preventiva vale o dobro na gamificação ([inspecao-preventivas.md](base/funcionalidades/inspecao-preventivas.md)).
- **Falta:** o Iago dizer onde o SAP guarda o ciclo (questão 66) e conferir se o checklist cobre o uso real (questão 57).

**Gamificação**

- Pontos por tarefa, calculados só no servidor; temporadas trimestrais; ranking de pessoas e de equipes; patentes; conquistas e anonimato. **A segurança nunca custa pontos.** Regras em [gameficacao.md](base/funcionalidades/gameficacao.md).
- A conquista de sincronização offline (19/10/2026) vale 0 ponto, para não incentivar trabalhar sem sinal de propósito.
- **Pendentes:** rever os limites das patentes no fim da primeira temporada real; trocar as imagens provisórias; decidir se criar e validar treinamento pontua.

**Registro de funcionários e simuladores do RH e do SAP**

- Só vira usuário quem está no registro: nome, cargo e registro profissional vêm de lá. O desligamento vale em tempo real (aviso do registro e leitura diária).
- Os dois sistemas são simulados, com tabelas no banco e telas de CRUD em `/simulador/funcionarios` e `/simulador/ordens` (só o admin). Desenho em [apifuncionarios.md](base/funcionalidades/apifuncionarios.md) e [apiSAP.md](base/funcionalidades/apiSAP.md).
- A leitura que falha de vez, a readmissão e o desligamento de quem tem OS reservada viram avisos ([avisos-e-emails.md](base/funcionalidades/avisos-e-emails.md), seção 5).

**Usuário ausente e representante**

- O ausente continua ativo e vê tudo, mas não altera nada, não recebe reserva e não entra em APR. O técnico pede, o supervisor aprova, recusa ou registra, e tudo é assinado. No início, as reservas caem e a execução aberta é suspensa ([ausencia.md](base/funcionalidades/ausencia.md)).
- O representante assume a equipe quando o supervisor se ausenta, fica 3 dias parado ou falta ([representante.md](base/funcionalidades/representante.md)).
- Web e app.

**Avisos e e-mails**

- Todo aviso do sino pode sair por e-mail, conforme as categorias que cada pessoa deixa ligadas, e de manhã sai um resumo diário ([avisos-e-emails.md](base/funcionalidades/avisos-e-emails.md)). Não há push no celular, por decisão.
- **Falta:** configurar o SMTP (questão 68).

**Execução compartilhada**

- Etapa 1: todos os participantes acompanham a execução. Etapa 2: agem na hora ou por pedido de 2 minutos ao responsável, e o silêncio aprova. Etapa 3: o que foi feito sem sinal em aparelhos diferentes é comparado; sem divergência, é ciência; com divergência, o responsável escolhe e os demais assinam ([execucao-compartilhada.md](base/funcionalidades/execucao-compartilhada.md)). Web e app.
- **Falta:** confirmar os prazos de 72 h e 7 dias da conferência.

**Pedido de conta**

- "Ainda não tem uma conta? Solicite" pede o nome, o e-mail e, se quiser, a equipe; avisa os administradores e quem responde pela equipe, e cadastrar a pessoa atende o pedido ([solicitacao-de-conta.md](base/funcionalidades/solicitacao-de-conta.md)).

**Treinamentos de serviço**

- O jogo de cada serviço do catálogo: a explicação narrada pela Vitória e as fases, com 10 tipos de minijogo. O técnico (inclusive quem aguarda liberação) joga, pontua, vê o ranking do treinamento e reporta problemas ([treinamentos-de-servico.md](base/funcionalidades/treinamentos-de-servico.md)).
- A nota combina acertos, tempo e fases; desde 20/10/2026 cada minijogo tem o próprio tempo, em 5 degraus de 100% a 50% (seção 12.1).
- **Criação (20/10/2026):** o admin e o supervisor de equipe que já faz o serviço criam, à mão ou com o rascunho pela IA. O treinamento é validado pelos supervisores das 3 equipes que mais fazem o serviço, sem a do autor; 2 dos 3 assinam e ele é publicado. O admin publica direto só como exceção, com justificativa ([validacao-de-treinamento.md](base/funcionalidades/validacao-de-treinamento.md)).
- Só na web.

**Vitória e o módulo de IA**

- Botão flutuante em toda tela, na web e no app. Responde pelo manual do perfil, raciocina além dele e usa conhecimento geral com o selo "Informação geral, não é regra da empresa"; quando sabe só parte, responde a parte. Oferece "Me leve lá" e "mostrar na tela" por uma lista fechada de destinos e guarda, sem identificar quem perguntou, o que não soube responder ([vitoria.md](base/funcionalidades/vitoria.md)).
- **Controle da IA (20/10/2026):** o admin liga e desliga o chatbot, a criação de jogos, a recomendação de modelo de APR e a digitalização. Ligar a leitura de dados reais exige a assinatura dele, e a função desligada nunca chama o fornecedor ([controle-da-ia.md](base/funcionalidades/controle-da-ia.md)).
- O provedor sai de `IA_PROVEDOR`: o Gemini gratuito, só com dados fictícios, na demonstração; o Claude com dados reais. Sem chave, a Vitória responde por sugestões fixas e por palavra-chave no manual.
- **Falta:** rodar a bateria de 66 casos e conferir a IA real nas funções com dados.

**Digitalização de OS e APR antigas**

- O PDF escaneado em lote ou as fotos de folhas avulsas pela câmera (uma por folha, com aviso de foto escura ou tremida); o OCR lê o impresso e a IA de visão, o manuscrito; o admin confere e a OS entra encerrada, de histórico. A APR em papel entra junto, à parte da APR do sistema (não vale como APR do dia, não pontua e não bloqueia). Desenho na seção 10 do [vitoria.md](base/funcionalidades/vitoria.md#10-digitalização-de-os-antigas).
- **Falta:** testar a APR em papel com a IA real e ver a câmera num aparelho; no piloto, a aprovação para enviar as folhas ao fornecedor de IA.

---

## 4. Materiais recomendados na APR

Esta funcionalidade fica registrada só aqui e em [materiais-recomendados.md](base/funcionalidades/materiais-recomendados.md), não na especificação.

- **Decisão (15/10/2026):** a lista de materiais, ferramentas e EPIs de cada serviço é só uma **recomendação para consulta**. Não há item obrigatório, foto do item, resposta "Levei" ou "Não levei" nem bloqueio da APR por material. Como o técnico escolhe o modelo da APR e a situação no local varia, exigir a prova barraria o serviço sem ganho de segurança.
- **Onde aparece:** o detalhe da OS (cartão "Materiais recomendados") e a revisão da APR (mesmo cartão, só leitura, sem mudar o "Concluir e validar").
- **Admin:** monta a lista de cada serviço no catálogo, com a quantidade e a observação.
- **Bloqueio:** a APR só bloqueia por item eliminatório reprovado.
- **Fora do escopo:** estoque, saldo e devolução (trabalho do SAP e do almoxarifado) e o cadastro de cada unidade.
- **Pendente de terceiros:** a lista real por serviço, que a ES Gás vai passar (questão 65). Até lá, só a carga fictícia tem itens.

---

## 5. Escolha do modelo da APR

Decidida e feita em 14/10/2026. A regra está também na especificação (Decisão-chave 6 e as fatias Modelo de APR e APR) e na questão 58.

### 5.1 De onde veio e o que se decidiu

- **Antes:** o modelo vinha da atividade da OS (`atividade.modelo_apr_codigo`). Quando a atividade não tinha modelo, o técnico escolhia numa lista, o que o time considerava errado, e a regra esperava a tabela de tipos de manutenção × APR do Iago.
- **O que o Iago explicou:** hoje o gasista escolhe a APR pelo serviço. As preventivas têm nome padrão, mas as corretivas não têm código padronizado, e o mesmo serviço pode pedir APRs diferentes conforme a situação no local (remover marimbondo com ou sem trabalho em altura).
- **Decisão:** não há atribuição automática. A cada APR, o técnico escolhe entre os modelos publicados (hoje 8), e o sistema só orienta. A ligação atividade → modelo saiu de vez; a atividade continua como o serviço do catálogo (a lista de materiais).

### 5.2 Como funciona

- **Admin.** Na tela do modelo, a seção "Orientação para o técnico" mostra e edita a descrição dos serviços que o modelo atende, os exemplos e as palavras-chave. Vale na hora, para todas as versões, sem publicar, e entra na auditoria (`modelo_apr.orientacao`). A carga inicial traz a orientação dos 8 modelos, escrita a partir dos títulos e das listas de atividades das planilhas; é só o ponto de partida.
- **Recomendação.**
  - O sistema procura as palavras-chave de cada modelo no título da OS (peso 3), na descrição do serviço do catálogo (peso 2) e na descrição da OS (peso 1). Cada palavra conta uma vez, pelo campo onde mais pesa.
  - A comparação é sem acento nem maiúsculas. A palavra-chave com 4 letras ou mais vale também como começo de palavra ("calibr" acha "calibração"); as curtas, só inteiras ("PSV", "tê").
  - Recomenda o modelo de maior soma. Empate no topo, ou nada achado, não recomenda nenhum.
  - **Guardada por OS (20/10/2026):** a recomendação de cada OS aberta fica em `os_recomendacao_apr`, calculada quando a OS passa a existir, seja qual for a entrada (uma varredura por minuto). Primeiro pelas palavras-chave, sem custo; depois pela IA, se a função Recomendação estiver ligada no [controle da IA](base/funcionalidades/controle-da-ia.md). A análise é refeita quando o texto da OS ou os modelos mudam. O técnico nunca espera a IA: a tela e a cópia do app leem o que está guardado ou calculam pelas palavras-chave na hora. A resposta traz a `fonte` (`ia` ou `palavras`) e o motivo, que a janela mostra.
  - A recomendação nunca é aplicada sozinha.
- **Técnico, na Nova APR.**
  - Abre a janela "Escolha o modelo da APR", com todos os modelos publicados. Cada um mostra título, descrição, o que foi encontrado na OS e o botão "Selecionar". Os exemplos de serviço da orientação não aparecem na janela, para não pesar de texto.
  - O recomendado vem sozinho no topo, em destaque, sob o título "Opção recomendada", com o aviso para conferir se é esse mesmo: a recomendação vem da leitura da OS, não da avaliação do local.
  - Os demais vêm abaixo, sob o título "Outros modelos de APR", em cartões de duas colunas (uma no celular).
  - Sem recomendação, um aviso diz que nenhum modelo se destacou, ou que mais de um combina.
  - A janela mostra o que foi encontrado na OS, não as palavras-chave.
  - No detalhe da OS, o cartão da APR exigida avisa que o modelo é escolhido ao iniciar a APR.
- **Troca do modelo.**
  - Na etapa 1 ("Trocar modelo") e no checklist ("Trocar o modelo"), enquanto a APR não foi registrada como bloqueada.
  - Escolhido o modelo novo, o técnico confere os riscos (os de mesmo nome já vêm marcados) e vê quantas respostas continuam e quantas perguntas ficam em branco.
  - Pergunta igual é a da mesma seção e com o mesmo texto (sem acento, maiúsculas e pontuação); na medida preventiva, também do mesmo risco, pelo nome. Ela guarda a resposta e a observação. "NA" só passa se o modelo novo aceita NA. As demais ficam em branco.
  - A validação anterior é apagada, e o checklist volta para a primeira pergunta em branco.
- **Quem decide o resultado continua sendo o servidor.** `POST /aprs/avaliar` e o evento `apr_concluida` aceitam qualquer modelo publicado.
- **Offline.** O snapshot traz, em cada OS, a escolha do modelo (o recomendado e o que cada modelo achou nela) e, em cada modelo, a orientação (descrição e exemplos).
- **Campo de treino.** A API fictícia tem a mesma recomendação e a orientação dos dois modelos de treino. O tutorial ganhou o passo "Escolha o modelo da APR", que aponta para a opção recomendada, e o passo "Monte a APR" agora aponta para os riscos.

### 5.3 Onde está no código

- **Banco.** Migração `0021_modelo_escolhido_pelo_tecnico`:
  - tabela `orientacao_modelo_apr`, uma linha por código de modelo, fora do versionamento (`descricao`, `exemplos`, `palavras_chave` e `atualizada_em`);
  - saem a coluna `atividade.modelo_apr_codigo` e o índice `atividade_sem_modelo_idx`.

  A orientação inicial está em `api/src/db/seed/orientacoes-modelos-apr.ts`, e a carga só grava a de um código que ainda não tem orientação.
- **API.**
  - `GET /os/{id}/modelos-apr`: os modelos para escolher, com a orientação, o que cada um achou na OS (`encontradas`) e o `recomendado`. Quem não vê a equipe da OS recebe `404`.
  - `PUT /modelos-apr/{codigo}/orientacao` (só admin); `GET /modelos-apr/{codigo}` traz a `orientacao`.
  - `POST /sync/pull`: `escolha_do_modelo` em cada OS e `orientacao` em cada modelo.
  - A leitura do SAP e a importação gravam sempre o código da atividade na OS; o código novo é cadastrado em `atividade`, com o título da ordem como descrição.
  - Saíram: `modelo_apr_codigo` de `GET /os/{id}`, `atividades_total` de `GET /modelos-apr`, as atividades e as OS abertas do uso do modelo, o `?substituto=` da exclusão, os filtros por modelo de `GET /atividades`, o aviso "Atividade sem modelo de APR" da leitura e da importação, e os indicadores "APRs em OS sem modelo ligado" e "atividades sem modelo".
  - Código em `api/src/dominio/recomendacao-apr.ts` e, a recomendação guardada, em `api/src/dominio/recomendacao-apr-guardada.ts`; testes em [recomendacao-apr-guardada.test.ts](api/test/recomendacao-apr-guardada.test.ts), [recomendacao-apr.test.ts](api/test/recomendacao-apr.test.ts) e [modelos-apr.test.ts](api/test/modelos-apr.test.ts).
- **Web.**
  - a janela `JanelaDeModelos` na Nova APR e a `TrocaDeModelo` no checklist;
  - as regras da troca em `trocarModelo` e `riscosEquivalentes` (`web/src/lib/apr.ts`), conferidas com os 8 modelos reais por `web/scripts/testar-troca-de-modelo.mts`;
  - a janela das telas de campo (`JanelaSobreposta`) não usa a `<dialog>` nativa, para o tutorial do treino continuar clicável por cima dela;
  - a seção "Orientação para o técnico" (`OrientacaoDoModelo`) na tela do modelo;
  - a aba Atividades, só com código, descrição e provisório.
- **Campo de treino.** `web/src/treino/recomendacao.ts` e o passo novo em `web/src/components/treino/passos.ts`.
- **Simulador do SAP.** O gerador sorteia a atividade como `cadastrada`, `nova` ou `qualquer` ([apiSAP.md](base/funcionalidades/apiSAP.md), seção 14).

### 5.4 O que ficou de fora

- **Escolha automática do modelo,** pelas razões da seção 5.1.
- **Dois modelos para a mesma execução** (por exemplo, a APR 03 e a APR 06 juntas): cada APR tem um modelo, e cada execução, uma APR; a questão 3 continua aberta.

### 5.5 Pontos em aberto

- **Orientação real.** A descrição, os exemplos e as palavras-chave da carga foram escritos a partir das planilhas. O admin deve revisá-los com o que a Segurança do Trabalho e a operação indicarem.
- **A recomendação pela IA** ainda não foi testada contra a IA real.

O app tem a janela de escolha, com o motivo da recomendação, e a troca do modelo desde 19/10/2026 (`mobile/src/apr/JanelaDeModelos.tsx`); sem sinal, usa a escolha que vem na cópia da equipe.

---

## 6. Atribuição individual e devolução de OS

Decidida e feita em 15/10/2026. A regra está também na especificação (fatias Impedimento e Painel e a tabela `os`).

### 6.1 De onde veio e o que se decidiu

- **Hoje:** a OS entra no sistema para a equipe toda, e qualquer pessoa dela inicia a APR. O Iago confirmou que é assim que a operação funciona. A atribuição individual não corrige um defeito: é um diferencial, para o supervisor poder garantir quem faz uma OS.
- **Decisões:**
  - **Atribuição individual.** O supervisor da equipe reserva a OS a uma pessoa. Ela é a responsável e a única que inicia a APR e a execução.
  - **A OS reservada continua no quadro da equipe,** com a marca de quem a fará. Os colegas precisam saber quais serviços existem, então a OS não some do quadro deles.
  - **Os colegas podem ser participantes da APR.** A restrição vale para iniciar e preencher a APR, não para quem acompanha o serviço. O responsável da APR é a pessoa designada.
  - **Só o supervisor da equipe reserva e devolve.** Nem o admin faz isso.
  - **Devolução.** A OS com erro sai do quadro e segue na planilha de baixa, com uma justificativa que o supervisor escreve e que fica na OS, como um apêndice. O SYNQ OS continua sem escrever no SAP.
- **O que foi descartado:** o atraso na entrega, em que a OS nova apareceria primeiro só para o supervisor ("em triagem") e depois de um intervalo iria para a equipe. A reserva visível resolve o mesmo problema (a OS que "some" do quadro) sem custo, e o atraso:
  - atrasaria todas as OS por causa de uma exceção, inclusive as urgentes;
  - dependeria de o supervisor, que também é técnico de campo, olhar a tela dentro do intervalo;
  - teria de contar em horas úteis, e o intervalo certo só se descobre no piloto.

  O custo é que a garantia não é total: se um técnico iniciar a APR antes de o supervisor reservar, já não dá mais para reservar a OS a outra pessoa sem refazer a APR. Se o piloto pedir a garantia total, o atraso volta como uma etapa opcional por equipe.

### 6.2 Como funciona

- **Reservar.**
  - No detalhe da OS, o supervisor da equipe vê o painel "Quem faz esta OS". Escolhe um técnico ativo e liberado da equipe da OS e reserva.
  - Vale enquanto a OS está liberada ou pendente. O supervisor pode trocar o responsável ou "Liberar para a equipe toda" a qualquer momento antes do início. Reservar de novo a mesma pessoa não muda nada.
- **O que a equipe vê.**
  - A OS segue no quadro, com o selo "Reservada para <nome>" (para o responsável, "Reservada para você").
  - No detalhe, uma faixa diz quem a reservou e que só o responsável inicia a APR e a execução. Para os outros, o painel de ações no lugar dos botões diz o mesmo.
- **Quem inicia.**
  - Só o responsável aplica a APR (`POST /aprs/avaliar` e `apr_concluida`) e inicia a execução (`execucao_iniciada`). Para os demais, a `api` recusa com `os_reservada` (`409` na validação da APR).
  - Na APR da OS reservada, o responsável é a pessoa designada (senão, `responsavel_reservado`). Os colegas entram como participantes, e o botão "Tornar responsável" some.
  - A execução também é só do responsável, mesmo que o colega seja participante da APR dele.
- **Offline.** O evento que vem da fila de quem não era o responsável é aplicado, e o supervisor recebe um alerta `conflito_planejamento` (Decisão-chave 2). O snapshot leva `responsavel_id`.
- **A leitura do SAP não mexe na reserva.** Nem a planilha.
- **Devolver.**
  - O supervisor da equipe devolve a OS **liberada**, ainda não iniciada, com uma justificativa obrigatória. A OS de apoio não se devolve: ela não é do SAP, e o admin a cancela. A OS pendente ou em execução segue pelos impedimentos.
  - A OS vira `devolvida`, perde a reserva e sai do quadro (aparece o link "Ver devolvidas", com a contagem) e do snapshot do modo offline.
  - Ela não aceita mais APR nem execução. Online, a `api` recusa com `os_devolvida`; da fila offline, o evento vira alerta.
  - Sai das contagens de OS programadas dos dashboards e do ciclo das preventivas, como a cancelada.
- **O apêndice.** A justificativa fica na OS, com quem devolveu e quando: uma faixa no topo do detalhe e uma linha na linha do tempo. A reserva também entra na linha do tempo.
- **A planilha de baixa** ganhou uma quarta aba, **Devolvidas**: `numero_ordem`, `titulo`, `equipe`, `justificativa`, `devolvida_por` e `devolvida_em`.
  - Cada devolução sai uma vez só (`os.devolucao_exportada_em`) e conta como OS nova na exportação.
  - Quem gera a planilha continua sendo só o admin. Quem lê a aba e corrige a ordem no SAP é uma pessoa: a planilha é o único caminho.
- **Quando a OS volta.** Quando o SAP traz a ordem de novo com o status liberado (a leitura ou a planilha; o PDF impresso não conta), a OS volta `liberada`, sem a devolução, e pode ser devolvida outra vez. A justificativa antiga fica na trilha de auditoria. Se o SAP cancelar a ordem, ela vira `cancelada`, como qualquer outra.
- **Auditoria.** `os.reservar`, `os.liberar_reserva` e `os.devolver`, com a justificativa nos detalhes.
- **Permissão.** Quem não vê a equipe da OS recebe `404`. Quem a vê mas não a supervisiona (o técnico comum, o admin, o responsável) recebe `403`.

### 6.3 Onde está no código

- **Banco.** Migração `0022_atribuicao_e_devolucao_de_os`:
  - `devolvida` entra no `CHECK` de `os.status`;
  - colunas novas em `os`: `responsavel_id`, `reservada_por`, `reservada_em` e `devolvida_em`, `devolvida_por`, `justificativa_devolucao`, `devolucao_exportada_em`;
  - `CHECK`s que mantêm a reserva e a devolução completas (quem, quando e, na devolução, a justificativa) e exigem o registro da devolução em toda OS `devolvida`;
  - dois índices parciais: o das devolvidas a exportar e o do responsável.
- **API.**
  - `PUT /os/{id}/responsavel` `{usuario_id}`, `DELETE /os/{id}/responsavel` e `POST /os/{id}/devolver` `{justificativa}`, em `api/src/rotas/impedimento.ts`; a regra em `api/src/dominio/atribuicao-os.ts`.
  - `GET /os` traz `responsavel` em cada OS; `GET /os/{id}` traz `responsavel` (com quem reservou e quando) e `devolucao`.
  - A conferência da reserva nos eventos é `conferirReserva` (`api/src/dominio/eventos-base.ts`), usada pela APR e pelo início da execução.
  - A aba Devolvidas está em `api/src/dominio/painel-exportacao.ts`; a volta da OS, em `atualizarOrdem` (`api/src/dominio/importacao-ordens.ts`).
  - Testes em [atribuicao.test.ts](api/test/atribuicao.test.ts) (22 casos).
- **Web.**
  - O painel `AtribuicaoDaOs` e o `DevolverOs` ficam no detalhe da OS, na lateral, só para o supervisor da equipe.
  - O selo no `CartaoOs` e no `DetalheCabecalho`; o painel de ações do técnico (`AcoesDaOs`), a Nova APR e a Execução recusam a OS reservada a outra pessoa e a devolvida.
  - `devolvida` entrou no `OsStatus` e nos filtros do quadro.
- **Campo de treino.** Sem mudança: a API fictícia não tem reserva nem devolução.

### 6.4 O que ficou de fora

- **O atraso na entrega** (seção 6.1).
- **Desativar a conta do responsável ou trocá-lo de equipe** não desfaz a reserva: só o supervisor a libera, ou o início de uma ausência dele (seção 3.2, usuário ausente).
- **Aviso ao responsável.** Desde 17/10/2026 ele recebe o aviso `os_reservada` (e quem perdeu a reserva, `os_reserva_desfeita`), no sino e por e-mail ([avisos-e-emails.md](base/funcionalidades/avisos-e-emails.md)).
- **No app:** a lista e o detalhe mostram a reserva ("Reservada para você"); reservar e devolver ficam na web, com o supervisor.

### 6.5 Pontos em aberto

- **O caminho da devolução até o SAP.** A aba Devolvidas é lida por uma pessoa. Falta combinar com o Iago quem a lê e como corrige a ordem.
- **A APR de hoje de outra pessoa.** Se a OS já tem uma APR aprovada de hoje e o supervisor a reserva a outra pessoa, a APR fica sem uso: só o responsável inicia a execução, e ele precisa participar da APR (ou fazer outra).
- **O admin.** Hoje ele não reserva nem devolve. Na equipe sem supervisor, desde 17/10/2026, o representante assume e reserva e devolve por ela, e o admin é avisado para escolher um supervisor ([avisos-e-emails.md](base/funcionalidades/avisos-e-emails.md), seção 5.4).

---

## 7. Pendências transversais

### 7.1 Insumos de terceiros

| Quem | O quê | Destrava | Questão |
|---|---|---|---|
| Iago | Planilha de OS de 2025 | Mapeamento da planilha e base fictícia mais fiel | 54 |
| Iago | Estrutura do formulário de inspeção | Conferir se o checklist de inspeção das preventivas cobre o uso real | 57 |
| Iago | Onde o SAP guarda o ciclo do plano e como o conta | Ciclo das preventivas com dado real | 66 |
| Iago | Validade da assinatura desenhada | Assinatura aceita em auditoria | 38 |
| Iago | Um PDF de OS gerado pelo SAP, com texto (os exemplos são digitalizações) | Conferir a leitura do PDF real | — |
| ES Gás | Lista de materiais por serviço | Catálogo de materiais recomendados reais | 65 |
| Mario e Segurança do Trabalho | Critério de bloqueio dos 8 modelos, medidas só dos riscos marcados e "NA" na APR 06 | Modelos reais | 59 e 61 |
| Empresa | Aprovação para enviar dados ao fornecedor de IA | Vitória, rascunhos e digitalização das OS antigas no piloto | — |
| Empresa | Conta num serviço de assinatura (ZapSign, gov.br) | Assinatura com validade jurídica | 38 |
| Empresa (TI) | Acesso ao diretório da empresa (conta Microsoft com segundo fator) | Login corporativo | — |
| Empresa (TI), pelo Iago | Servidor de e-mail (SMTP): endereço, porta, usuário e senha, o remetente e o SPF/DKIM do domínio; e o aceite do que vai nos e-mails | E-mails dos avisos e o resumo diário ([avisos-e-emails.md](base/funcionalidades/avisos-e-emails.md), seção 6) | 68 |

### 7.2 Documentação desatualizada

**Resolvido em 20/10/2026** (pendência 15 do [pendencias.md](pendencias.md)): o README da raiz, o DesignDoc, a especificação e os READMEs da `api` e da `web` foram atualizados, e o comentário de `api/src/rotas/sap.ts` sobre quem abre a OS de apoio foi corrigido. O que estava desatualizado e o que mudou estão registrados na pendência 15.

### 7.3 Defeitos e sobras conhecidos

- **Resolvidos em 14/10/2026:**
  - **Carga de demonstração.** O `pnpm demo:popular` quebrava entre a meia-noite e cerca de 2h10, porque o cenário "em pausa neste momento" criava a APR no dia anterior e a `api` recusa APR de outro dia. Agora o cenário começa logo depois da meia-noite (`api/src/db/seed/demo.ts`).
  - **Campo de treino.** Os dashboards respondiam 404. Agora a API fictícia atende os indicadores (`web/src/treino/indicadores.ts`), sem dados por pessoa nem pendências de gestão.
- **Indicador "Online".** Saiu da barra da web em 17/10/2026: na web só se acessa pela internet, então o selo não informa nada. Fica para o app `mobile`, onde a conexão pode cair.
- **Código sem uso na web:** a propriedade `aviso` do `Button` e o `return` inalcançável em `app/app/treino/estado/route.ts` saíram em 20/10/2026. Em 16/10/2026 saíram `ui/Aviso.tsx`, `ui/Assinatura.tsx`, `treino/recomecar.ts`, as classes `.sync-row` e `.sync-ic` e os SVG de exemplo do Next em `public/`.

### 7.4 Fora do escopo, por decisão

- Escrita no SAP por API: a baixa é por planilha (questão 51).
- Notificação push no celular: a OS nova aparece quando a lista é atualizada.
- iOS e terceiros no app.
- MFA, SSO e vínculo do aparelho com o usuário, que estão como RFC.
- Estoque, saldo e devolução de materiais (seção 4) e baixa do material gasto.
- Escolha automática do modelo da APR: o técnico escolhe a cada APR, e o sistema só recomenda (seção 5.1).
- Atraso na entrega da OS para o supervisor triar antes da equipe: a OS reservada fica visível no quadro (seção 6.1).
- Cadastro de equipamentos como entidade.
- Importação de OS pelo supervisor, adiada (questão 63).

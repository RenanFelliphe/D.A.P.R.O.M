# Funcionalidades — diagnóstico em 14/10/2026

> O que o sistema faz hoje, o que está parcial e o que ainda não começou, tanto nas funcionalidades essenciais (o que a especificação exige para a demo) quanto nas extras (ideias do time, dos mentores e do cliente, fora do MVP). O diagnóstico saiu da leitura do código da `api` e da `web`, não só dos documentos.
>
> Fontes: [especificação](base/.design/especificacao.md), [DesignDoc](DesignDoc.md), [pontos a validar](base/.design/pontos-a-validar.md), [gameficacao.md](gameficacao.md), [chatbot.md](chatbot.md) e o código em [api/](api/) e [web/](web/).

## Resumo

- **O fluxo online está completo na `api` e na `web`.** A OS entra pela API do SAP, pela planilha ou pelo PDF. A APR é respondida e validada no servidor, a execução é registrada e sai o PDF de 2 páginas. Também já funcionam o painel, os alertas, os indicadores, a auditoria e a gamificação. A web é responsiva e funciona no navegador do celular.
- **Falta das essenciais o app Android e, com ele, o modo offline** (fila local, cópia da equipe e login sem sinal). A `api` já está pronta para os dois. Sem eles, o critério de sucesso da demo não fecha.
- **Uma essencial está parcial:** o formulário de inspeção das preventivas: a `api` guarda, mas não há tela.
- **A escolha do modelo da APR foi decidida e feita em 14/10/2026:** o técnico escolhe o modelo a cada APR, entre os publicados, e o sistema só recomenda um pela leitura da OS (seção 5).
- **Extras prontas:** OS de apoio, assinatura no perfil, equipe automática, evidência em PDF, catálogo de serviço com a conferência de materiais na APR, ciclo das preventivas, gamificação, o registro de funcionários simulado (cadastro só por matrícula e e-mail de quem está nele, e desligamento em tempo real) e as telas dos simuladores do registro e do SAP.
- **Extras não iniciadas:**
  - a Vitória e os treinamentos de serviço, desenhados no [chatbot.md](chatbot.md) (só existe o avatar);
  - o escaneamento de OS e APR antigas, em discussão no [digitalizacao.md](digitalizacao.md) (a câmera é só protótipo).
- **Números:** 128 rotas na `api` (as dos simuladores do SAP e do registro de funcionários só existem com `SAP_SIMULADO` e `RH_SIMULADO`), 22 migrações (`0000` a `0021`) e 582 testes em 31 arquivos. Os 582 testes passam, e o `tsc` da `api` e da `web` e o `eslint` da `web` saem sem erros.

## O que ainda falta, num relance

**Funcionalidades (código)**

- [ ] **App Android** (`mobile/`): login, OS da equipe, APR, execução, câmera, assinatura e perfil (seção 2.3).
- [ ] **Modo offline:** fila em SQLite, cópia da equipe, login sem sinal e aviso de pendentes (seção 2.3). A `api` já está pronta.
- [ ] **Dockerfile que gera o APK.**
- [ ] **Formulário de inspeção das preventivas** na web, com o encerramento e o detalhe da OS (questão 57).
- [ ] **Vitória e treinamentos de serviço**, nenhum começado (seção 3.3).
- [ ] **Escaneamento de OS e APR antigas**, em discussão no [digitalizacao.md](digitalizacao.md) (seção 3.3).
- [ ] Do registro de funcionários: o alerta no sino quando a leitura diária falha e a reativação da conta na readmissão (seção 3.2).

**Depende de terceiros** (seção 6.1): planilha de OS de 2025, formulário de inspeção, onde o SAP guarda o ciclo do plano, validade da assinatura desenhada, lista de materiais por serviço, critério de bloqueio dos modelos e a aprovação da empresa para enviar dados ao fornecedor de IA.

**Documentação e arrumação** (seções 6.2 e 6.3): README da raiz, especificação, `api/README.md` e `web/README.md` ainda têm trechos desatualizados; o `Inconsistencias.md` é anterior a quase tudo; há código sem uso na web e o indicador "Online" é texto fixo.

**Já resolvido nesta rodada (14/10/2026):** os dashboards do Campo de treino (antes respondiam 404), a carga de demonstração entre a meia-noite e 2h10 (antes quebrava) e a escolha do modelo da APR pelo técnico, com a recomendação, a troca e a orientação editável (seção 5).

---

## 1. Como o sistema está organizado

As extras mudaram o desenho original:

- o catálogo de serviço virou uma etapa da APR;
- a evidência aceita PDF;
- as preventivas ganharam um ciclo próprio;
- quase toda ação de campo pontua.

O supervisor não é um perfil, e a web tem uma casca única para todos.

### 1.1 Perfis e portal

- **Dois perfis: `tecnico` e `admin`.** O supervisor é o técnico que a equipe aponta (`equipe.supervisor_id`) e ganha a gestão das equipes que supervisiona. O admin cuida da plataforma e não executa OS.
- **Casca única na web.** Campo e gestão ficam em `/app/*`. As telas só de gestão (importação, alertas, modelos de APR e auditoria) ficam em `/web/*` e abrem só para admin e supervisor. O menu muda conforme o perfil.
- **Técnico pendente.** O técnico que o supervisor cadastra nasce `pendente`: entra, troca a senha e faz o Campo de treino até o admin liberar ou recusar o acesso.

### 1.2 O caminho da OS

1. **Entrada.** A OS vem de três lugares:
   - do SAP, por leitura agendada (a cada 15 minutos, por padrão) ou pelo "Ler agora";
   - da planilha exportada;
   - do PDF da OS, conferido campo a campo antes do registro.

   A equipe sai do centro de trabalho. A única OS criada no próprio sistema é a de apoio, aberta a partir de um impedimento.
2. **Detalhe.** Além dos dados do SAP, o detalhe mostra:
   - os materiais do serviço, com o selo "Obrigatório";
   - o ciclo da preventiva;
   - o histórico do local e do equipamento;
   - todas as APRs e execuções anteriores.
3. **APR.**
   - **Etapas:**
     1. modelo, participantes e riscos: o técnico escolhe o modelo numa janela com todos os publicados, e o sistema recomenda um pela leitura da OS (seção 5);
     2. checklist respondido por inteiro, sem marcar o que é eliminatório (o modelo ainda pode ser trocado);
     3. revisão, com a conferência de materiais;
     4. validação no servidor (`POST /aprs/avaliar`).
   - **Bloqueada:** quando um item eliminatório é reprovado ou falta a foto de um material obrigatório. A APR fica registrada na hora, a OS fica pendente e o supervisor recebe alerta e e-mail. O técnico documenta cada item reprovado com foto, texto ou PDF, conforme o modelo pede.
   - **Aprovada:** os participantes assinam com a assinatura do perfil, e a APR é registrada.
4. **Execução.** Iniciar, pausar com motivo, suspender no fim do expediente, interromper por risco (com motivo e foto), cancelar por engano (até 10 minutos depois do início) e encerrar. O encerramento pede descrição, de 1 a 10 fotos e as assinaturas, e aceita até 5 PDFs.
5. **Documento e baixa.**
   - O PDF de 2 páginas (APR e OS) é gerado em segundo plano.
   - O supervisor dá ciência.
   - A planilha de baixa no SAP sai com três abas: Encerradas, Sem ordem SAP e Impedimentos.
6. **Depois.** Dashboards, alertas de ciclo das preventivas e pontos da gamificação.

Todo registro de campo passa por `POST /eventos`, que é idempotente. Isso vale online e, quando o app existir, também para a fila offline.

### 1.3 Estado por área

| Área | Situação |
|---|---|
| Plataforma | **Pronta.** Monorepo, Dockerfiles da `api` e da `web`, `docker-compose`, migrações aplicadas na subida, 6 buckets privados, tarefas em segundo plano com novas tentativas e modo local sem Supabase (`pnpm dev:local`) |
| Acesso e usuários | **Pronta.** Login pelo e-mail institucional, senha provisória trocada no primeiro acesso, redefinição pelo admin, cadastro pelo supervisor com liberação ou recusa pelo admin, assinatura no perfil e trilha de auditoria que só cresce |
| Campo de treino | **Pronto.** API fictícia em memória por usuário, tutorial Direcionado (18 passos) ou modo Livre; a `api` real só guarda o estado |
| Entrada de OS | **Pronta com o simulador** (agora com tabela no banco e tela própria), com a planilha e com o PDF que tem texto. A digitalização pela câmera é só protótipo |
| Registro de funcionários | **Pronto com o simulador.** Cadastro só de quem está no registro, desligamento em tempo real (aviso e leitura diária), selos na tela de usuários e a tela do simulador |
| Modelos de APR | **Pronta.** 8 modelos na carga inicial, versões imutáveis, editor, orientação de cada modelo para a escolha do técnico, arquivamento e restauração. O critério de bloqueio da carga é provisório até a Segurança do Trabalho validar |
| Catálogo de serviço | **Pronta.** Materiais, ferramentas e EPIs por serviço, com quantidade e item obrigatório |
| APR | **Pronta na web.** Modelo escolhido pelo técnico, com a recomendação e a troca, checklist inteiro, validação no servidor, conferência de materiais, evidência por foto, texto ou PDF e APR bloqueada registrada na validação |
| Execução | **Pronta na web.** Pausa com motivo, suspensão, interrupção por risco, cancelamento por engano, assinaturas e PDF de 2 páginas |
| Impedimento e alertas | **Pronta.** 7 tipos de alerta (e-mail só no bloqueio), reprogramação e OS de apoio |
| Painel | **Pronta.** Quadro, detalhe, ciência, local crítico, busca global, PDF e exportação para baixa |
| Indicadores | **Pronta.** 5 dashboards (Geral, Equipes, OS, APR e Meus resultados), com tempo de execução e de pausa por equipe, técnico e OS |
| Ciclo das preventivas | **Pronta.** Contagem até o próximo ciclo por plano e item, com alertas de ciclo próximo e vencido; não cria OS |
| Gamificação | **Pronta.** Pontos por tarefa, temporadas trimestrais, ranking, patentes de pessoa e de equipe, conquistas e anonimato |
| Eventos e sincronização | **Pronta na `api`.** Envio idempotente, snapshot da equipe (`POST /sync/pull`) e tolerância à fila offline. Hoje só a web usa, e só online |
| App Android e modo offline | **Não iniciados.** A pasta [`mobile/`](mobile/) só tem o README |
| Vitória e treinamentos de serviço | **Desenhados, não iniciados.** Só existe o avatar provisório em [`vitoria/`](vitoria/) |

---

## 2. Funcionalidades essenciais

### 2.1 Pelo critério de sucesso da especificação

A seção "Sucesso" pede o caminho ler OS → APR → executar → PDF "no app Android e no navegador" e, como contingência, "num Android em modo avião".

| Parte do critério | Situação |
|---|---|
| No navegador, online | **Atende.** Funciona de ponta a ponta, e a OS encerrada aparece no painel na hora |
| No app Android, online | **Não atende.** O app não existe. A web abre no navegador do celular, mas não substitui o app |
| Num Android em modo avião | **Não atende.** Nenhum cliente tem fila local nem login sem sinal |

### 2.2 Lista "Funcionalidades essenciais" do DesignDoc

| Funcionalidade | Situação |
|---|---|
| Validar a permissão de executar a OS depois da análise da APR | **Pronta.** A execução só começa com uma APR aprovada, do dia e da própria OS, e com a pessoa entre os participantes |
| Documentação do obstáculo (imagem, PDF…) por item reprovado | **Pronta.** Foto, texto ou PDF, conforme o item do modelo pede. PDF a mais é sempre aceito |
| Sincronização automática e manual dos dados offline | **Só na `api`.** Falta o cliente com a fila local |
| Token temporário guardado no aparelho para o login offline | **Não feito.** Pela especificação, é um hash da senha guardado no app, válido por até 7 dias. Depende do app |
| Ler a equipe definida na OS (atribuição automática) | **Pronta.** A equipe sai do centro de trabalho da OS |

As definições e telas do DesignDoc (dados da OS, regras da APR, execução, PDF, painel pessoal e painel de gestão) estão cobertas pela web.

### 2.3 O que falta ou está parcial

**Não iniciado**

- **App Android (`mobile`).** Login, OS da equipe, APR, execução, câmera, assinatura e perfil, com as telas `/app/*` da web como referência. Pelo [README do mobile](mobile/README.md), o app também recebe as páginas de consulta da gamificação e o "+N pontos". Quais telas de gestão entram no app fica para depois da demo (questão 55).
- **Modo offline:**
  - cópia local da equipe (`POST /sync/pull`);
  - fila de eventos e de arquivos em SQLite, com envio automático e manual;
  - aviso "N registros pendentes" e logout recusado enquanto houver fila;
  - login sem sinal: hash salgado da senha, válido por até 7 dias desde o último login online.

  O snapshot da `api` traz a própria equipe, sem alertas e sem gamificação, o que basta para o campo.
- **Dockerfile que gera o APK.**

**Parcial**

- **Formulário de inspeção das preventivas (questão 57).** A `api` aceita `dados_inspecao` no encerramento, guarda e imprime no PDF como pares de campo e valor. Mas a web não tem o formulário, e o detalhe da OS não o mostra. A estrutura do formulário depende do Iago.
- **Planilha do SAP.** O mapeamento das colunas é provisório até chegar a planilha de 2025.

**Para o piloto, não para a demo**

- O critério de bloqueio e a tabela de atividades reais. A carga traz 116 atividades marcadas como provisórias.
- MFA ou SSO corporativo e vínculo do aparelho com o usuário, que estão como RFC na especificação.

### 2.4 Próximo passo: o app, começando pelo modo online

Por quê:

1. **É a única parte das essenciais sem código**, e está no critério de sucesso.
2. **A `api` já está pronta para ele.** Estão feitos e testados:
   - o envio idempotente;
   - o snapshot da equipe;
   - a regra dos 60 s para a fila offline;
   - o envio da fila por usuário desativado;
   - os alertas de conflito de planejamento.

   O app é um cliente.
3. **É o maior risco de prazo.** O contrato dos eventos é a decisão mais cara de desfazer, e um cliente com fila o testa antes de existir aparelho com fila pendente.
4. **A outra frente essencial depende de terceiros:** o formulário de inspeção. A escolha do modelo da APR, que também esperava uma decisão, foi feita em 14/10/2026 (seção 5), e o app já nasce com ela.

Ordem sugerida:

1. Esqueleto React Native para Android, com login pelo e-mail e com a lista e o detalhe das OS da equipe. Recomendado: Expo, que tem câmera, SQLite, armazenamento seguro e gera o APK localmente.
2. APR e execução online, com os mesmos `POST /aprs/avaliar` e `POST /eventos` da web, e câmera e assinatura nativas.
3. Modo offline: fila em SQLite, `POST /sync/pull`, login de contingência e aviso de pendentes.
4. Dockerfile que gera o APK.

**Se o prazo apertar,** a própria especificação aponta a saída na Decisão-chave 1: um PWA. A web já é responsiva; faltariam o manifesto, o service worker e a fila em IndexedDB, e hoje não há nada disso na web.

---

## 3. Funcionalidades extras

São ideias do [DesignDoc](DesignDoc.md) ("Prioridades" e "Extras") e da Reunião 2, vindas dos mentores e do cliente. Nenhuma é exigida pela especificação.

### 3.1 Situação

| Ideia | Origem | Situação |
|---|---|---|
| OS de apoio | DesignDoc (prioridades) | **Pronta** |
| Assinatura cadastrada no perfil | DesignDoc (prioridades) | **Pronta.** Não há certificado digital (ICP-Brasil) |
| Equipe atribuída automaticamente | DesignDoc (essenciais) | **Pronta** |
| Evidência em PDF | DesignDoc (essenciais) | **Pronta** |
| Catálogo de serviço com os materiais | DesignDoc (prioridades) | **Pronto**, com a conferência de materiais na APR (seção 4) |
| Intervalo entre ciclos das preventivas | DesignDoc (prioridades) | **Pronto** |
| Gamificação | Time, na Reunião 2 | **Pronta** |
| Chatbot de consulta | Iago, na Reunião 2 | **Desenhado, não iniciado.** Virou a Vitória e os treinamentos de serviço ([chatbot.md](chatbot.md)) |
| Escaneamento de OS e APR antigas | DesignDoc (prioridades) | **Em discussão** ([digitalizacao.md](digitalizacao.md)). A Digitalização da tela de importação só abre a câmera |
| API de funcionários para cadastro rápido | DesignDoc (extras) | **Pronta com o simulador.** Registro de funcionários simulado, com tela própria; cadastro só de quem está nele e desligamento em tempo real ([apifuncionarios.md](apifuncionarios.md)) |
| Tela do simulador do SAP | Time, em 14/10/2026 | **Pronta** ([apiSAP.md](apiSAP.md)) |

### 3.2 As prontas: o que fazem e o que falta

**OS de apoio**

- **Quem abre:** o supervisor da equipe da OS de origem ou o admin, a partir de um impedimento. Pode ser aberta para qualquer equipe.
- **Ligação com o SAP:** fica ligada à OS original e não tem número SAP até alguém criá-la lá. Por isso sai na aba "Sem ordem SAP" da planilha de baixa.
- **Encerramento:** avisa a equipe da OS original (alerta `apoio_encerrado`).
- **Cancelamento:** só o admin cancela.

**Assinatura no perfil**

- A assinatura é desenhada no perfil, confirmada a cada uso e impressa no PDF.
- Cada assinatura guarda a imagem usada; refazer a do perfil vale só para as próximas.
- **Falta:** o Iago dizer se a assinatura desenhada vale para auditoria (questão 38).

**Evidência em PDF**

- O item do modelo diz se pede foto, texto ou PDF (questão 50). Um PDF a mais é sempre aceito, mas não substitui a foto exigida.
- Vale no item reprovado, na interrupção por risco e no encerramento (até 5 PDFs).
- A `api` confere o arquivo pelo conteúdo e o guarda no bucket `documentos`.

**Catálogo de serviço**

- O serviço é a própria atividade do plano de manutenção, a que a OS traz do SAP. Ela não escolhe o modelo de APR, mas a descrição dela entra na recomendação do modelo (seção 5).
- O admin cadastra materiais, ferramentas e EPIs e monta a lista de cada serviço, com quantidade e item obrigatório.
- O detalhe da OS mostra a lista, e a APR a confere (seção 4).
- **Falta:** a lista real, que depende da ES Gás (questão 65). Até lá, só a carga fictícia tem itens.

**Ciclo das preventivas**

- Conta o tempo até o próximo ciclo de cada plano e item de manutenção, a partir do encerramento da última OS ou da data programada.
- Avisa quem planeja quando o ciclo se aproxima ou vence sem OS nova.
- O intervalo vem da Periodicidade do PDF, da planilha ou da API, ou é definido na web.
- A janela "OS preventivas" do quadro mostra a contagem. O sistema não cria OS.
- **Falta:** o Iago dizer onde o SAP guarda o ciclo (questão 66).

**Gamificação**

- **O que tem:**
  - pontos por tarefa, calculados só no servidor;
  - temporadas trimestrais, com fechamento automático;
  - ranking de pessoas e de equipes;
  - patentes, com imagem de pessoa e de equipe e a maior patente da equipe;
  - conquistas e anonimato.
- **Regra central: a segurança nunca custa pontos.** APR bloqueada e interrupção por risco valem o mesmo que as outras, e nenhuma regra olha a resposta de um item.
- **Onde estão as regras:** [gameficacao.md](gameficacao.md).
- **Pendentes:**
  - rever os limites das patentes no fim da primeira temporada real;
  - trocar as imagens provisórias;
  - o bônus do formulário de inspeção, que depende da questão 57;
  - a conquista de sincronização offline, que depende do app.

**Registro de funcionários e simuladores do RH e do SAP**

- **Onde está o desenho:** [apifuncionarios.md](apifuncionarios.md) e [apiSAP.md](apiSAP.md), com o que mudou na implementação em cada um.
- **O que fazem:**
  - o DAPROM só cadastra quem está no registro de funcionários: o admin ou o supervisor informa a matrícula e o e-mail institucional, e o nome, o cargo e o registro profissional vêm de lá e deixam de ser editáveis (o botão "Atualizar do registro" os traz de novo);
  - o desligamento vale em tempo real: o registro avisa o DAPROM, e a conta é desativada em segundos; uma leitura completa por dia (e o "Ler agora") pega o que o aviso perdeu;
  - o registro de funcionários e as ordens do SAP são simulados, com tabelas no banco e uma tela de CRUD cada, em `/simulador/funcionarios` e `/simulador/ordens` (só o admin): criação manual e aleatória, busca, seleção com ações em massa, "ver mais", editar e excluir;
  - a tela do SAP mostra, em cada ordem, como o DAPROM reagiu (ainda não lida, ignorada com o motivo, ou o status da OS) e o que ele vai pegar na próxima leitura.
- **Falta:**
  - o alerta no sino quando a leitura diária falha, e reativar a conta na readmissão, ficaram fora do escopo;
  - o cartão da tela do SAP não mostra os avisos da leitura (por exemplo, o intervalo entre ciclos que não foi reconhecido), porque a `api` não os guarda.

### 3.3 As que não começaram

**Vitória e treinamentos de serviço**

- **Onde está o desenho:** no [chatbot.md](chatbot.md). Cobre o fornecedor (Claude: Haiku 5.5 na Vitória e Opus 5.5 nos rascunhos), os custos, as regras, os riscos, os dados, as rotas, as páginas e a ordem de implementação.
- **Ordem de implementação:**
  1. treinamentos sem IA;
  2. módulo de IA e rascunho;
  3. Vitória, nível 1;
  4. Vitória, níveis 2 e 3;
  5. preparação da feira.
- **O que existe:** nada no código da `api` nem da `web`; só o avatar provisório em [`vitoria/`](vitoria/). Os pontos dos treinamentos já estão definidos ([gameficacao.md](gameficacao.md), seção 13).
- **Pendente antes de começar:** o desenho definitivo da Vitória. Para o piloto, falta também a aprovação da empresa para enviar dados ao fornecedor (LGPD).

**Escaneamento de OS e APR antigas**

- **O que existe:** a câmera abre e captura no navegador, mas nada é lido nem enviado, e o PDF só com imagem é recusado (`pdf_sem_texto`).
- **Em discussão** no [digitalizacao.md](digitalizacao.md) (14/10/2026). O objetivo são as OS antigas, já executadas no papel, que entram encerradas, de histórico. A proposta é a IA de visão ler as folhas, inclusive a parte escrita à mão, e o sistema conferir o que foi lido.
- **Do que depende:** do teste da leitura com folhas fictícias e, no piloto, da aprovação da empresa para enviar as folhas ao fornecedor de IA.
- **Quando existir:** vira uma nova origem de importação e pode reaproveitar a conferência do PDF.
- **APR antigas:** não há nada.

### 3.4 Ordem sugerida para as extras

- **Primeiro, os treinamentos de serviço e a Vitória**, na ordem do [chatbot.md](chatbot.md#8-ordem-de-implementação). Ficam para depois do app, ou em paralelo, se outra pessoa assumir.
  - É a única extra pedida pelo cliente.
  - Roda sobre a web pronta.
  - É a vitrine da feira. Se a feira cair antes de o app ter algo para mostrar, ela passa à frente do app.
- **A API de funcionários e a tela do SAP** já foram feitas, na ordem do [apifuncionarios.md](apifuncionarios.md#11-ordem-de-implementação) e depois a do [apiSAP.md](apiSAP.md#12-ordem-de-implementação).
- **O escaneamento** começa pelo teste da leitura das folhas pela IA ([digitalizacao.md](digitalizacao.md#12-ordem-de-implementação-proposta)).

---

## 4. Conferência de materiais na APR

Esta funcionalidade fica registrada só aqui, não na especificação.

### 4.1 De onde veio e o que se decidiu

A ideia inicial era um controle de "empréstimo":

- o admin cadastraria quantas unidades de cada equipamento a empresa tem;
- o técnico escolheria o que levaria depois da APR;
- o sistema validaria se ainda havia saldo.

A conversa reduziu o escopo a três funções e **descartou o controle de estoque**:

1. **Registrar os materiais por atividade.** É o catálogo de serviço (seção 3.2), que ganhou o indicador de item obrigatório.
2. **Mostrar os materiais recomendados na OS.** É o cartão "Materiais e ferramentas" do detalhe da OS, que ganhou o selo "Obrigatório".
3. **Validar se o técnico levou tudo.** É a conferência na revisão da APR.

Por que o estoque ficou de fora:

- **A foto vale mais que o saldo.** A foto do item em mãos libera o técnico mesmo com o estoque zerado. Então o saldo nunca barraria quem tem o item, e só barraria quem está sem ele, o que a foto já faz.
- **Offline.** Sem saldo em tempo real, não há o que conferir. A lista vai no snapshot, e a foto sobe pela fila de arquivos.
- **Sem virar almoxarifado.** Contar quantas unidades a empresa tem, quem as retirou e a devolução é trabalho do SAP e do almoxarifado, não do D.A.P.R.O.M.

O sistema diz **quais itens o serviço pede e quais precisam de prova**, e não quantos a empresa tem. O "cadastro por entidade" que se pensou é o banco de dados (`material`, `atividade_material`, `apr_material`), não um cadastro de cada unidade.

### 4.2 Como funciona

- **Admin.** No editor do serviço (Catálogo › Serviços), cada item da lista tem a caixa "Obrigatório". Mudar só essa caixa entra na auditoria (`atividade.materiais`, com o antes e o depois).
- **Técnico, antes de sair.** O detalhe da OS lista os materiais, com o selo "Obrigatório" e o aviso de que eles exigem foto na APR.
- **Técnico, na APR.**
  - Depois de responder o checklist, a revisão traz o cartão "Materiais do serviço". Para cada item, o técnico marca "Levei" ou "Não levei", e o botão "Levei os itens opcionais" marca os opcionais de uma vez.
  - No item obrigatório, ao marcar "Levei", o técnico envia a foto do item. A foto só vale para aquele item.
  - O técnico sabe quais itens são obrigatórios. Isso é diferente do item eliminatório da APR, que ele não vê.
  - "Concluir e validar" só é liberado quando todos os itens foram respondidos e todo obrigatório levado tem foto.
- **Bloqueio.**
  - O item obrigatório **não levado, ou levado sem foto, bloqueia a APR**. Também bloqueia se nem veio na conferência.
  - O bloqueio segue o caminho do item reprovado: a APR fica registrada como bloqueada na validação, a OS fica pendente e o supervisor recebe o alerta no painel e o e-mail, que lista os materiais sem comprovação.
  - Não há evidência a completar: o técnico vê o que faltou e refaz a APR quando estiver com o item.
  - O bloqueio é na APR, não na execução.
- **Os demais itens** só são conferidos ("levei" ou "não levei"), sem foto e sem bloquear.
- **Quem decide é o servidor.** O resultado é recalculado a partir da lista atual do serviço, e o `resultado` que o aparelho manda não vale.
- **OS sem atividade, ou serviço sem item obrigatório:** nada muda. A conferência só aparece quando a OS tem uma lista.
- **Offline.**
  - O `atividades[].materiais` do snapshot já leva `obrigatorio`.
  - Se o admin tirar um item da lista enquanto o aparelho está sem sinal, esse item é ignorado quando a fila offline sobe, em vez de recusar a APR. Online, o mesmo caso é recusado.
- **Histórico.** O detalhe da OS (do painel e do técnico) e o alerta de bloqueio mostram a conferência, com as fotos e o que faltou.

### 4.3 Onde está no código

- **Banco.** Migração `0018_apr_materiais`:
  - coluna `atividade_material.obrigatorio`;
  - tabela `apr_material`, com uma linha por APR e material: `obrigatorio` como estava na hora, `levou`, a foto e a posição.

  O material que já foi conferido numa APR não pode ser excluído (`409 material_em_uso`): é preciso desativá-lo.
- **API.**
  - `PUT /catalogo/servicos/{codigo}` aceita `obrigatorio` por item.
  - `POST /aprs/avaliar` e o evento `apr_concluida` aceitam `materiais: [{material_id, levou, foto?}]`. A foto sobe antes, por `PUT /arquivos/{id}` com `tipo=foto`.
  - `POST /aprs/avaliar` devolve `materiais_faltando`.
  - Erros novos: `material_invalido`, `material_repetido`, `foto_sem_material` e `arquivo_ausente` (neste último, o evento fica pendente).
  - A foto é lida por `GET /arquivos/{id}/url`, com a mesma regra de equipe das demais evidências.
  - Código em `api/src/dominio/apr-materiais.ts`; testes em [apr-materiais.test.ts](api/test/apr-materiais.test.ts).
- **Web.**
  - editor do serviço;
  - selo e aviso no detalhe da OS;
  - cartão `ConferenciaDeMateriais` na revisão;
  - tela de impedimento com os materiais;
  - histórico e alerta de bloqueio.
- **Campo de treino.**
  - A API fictícia segue a mesma regra.
  - A "Vestimenta antichama" da OS guiada é obrigatória.
  - O passo "Revise e valide" do tutorial explica a conferência.
  - Tudo é conferido por `web/scripts/verificar-treino.mts`.
- **Carga de demonstração.**
  - O detector de gases e o respirador são obrigatórios nas listas fictícias.
  - As APRs da demonstração fazem a conferência.
  - Uma OS ("Aferição de manômetro padrão") está pendente por material sem comprovação.

### 4.4 O que ficou de fora

- **Estoque, saldo e devolução**, pelas razões da seção 4.1.
- **Pesquisar e levar um material fora da lista.** Estava na ideia inicial, mas a lista final de três funções não o inclui. Dá para acrescentar depois, e o que o técnico leva a mais diria ao admin o que o serviço usa de verdade.
- **Os materiais no PDF da OS.** O PDF continua com a página da APR e a da OS, sem a conferência.
- **Cadastro de cada unidade** (patrimônio, série, validade da calibração). Só faria sentido para os instrumentos calibráveis.

### 4.5 Pontos em aberto

- **Pontos da gamificação.** A APR bloqueada por material pontua como qualquer APR bloqueada, porque a pontuação não olha a conferência. Se a regra precisar mudar, isso deve ser discutido antes e registrado no [gameficacao.md](gameficacao.md).
- **Lista real de materiais.** Os itens obrigatórios dependem da lista que a ES Gás vai passar por serviço (questão 65). Até lá, o catálogo real não tem nenhum item obrigatório, e nada bloqueia.

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
  - A conferência dos materiais fica, porque é do serviço da OS. A validação anterior é apagada, e o checklist volta para a primeira pergunta em branco.
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
  - Código em `api/src/dominio/recomendacao-apr.ts`; testes em [recomendacao-apr.test.ts](api/test/recomendacao-apr.test.ts) e [modelos-apr.test.ts](api/test/modelos-apr.test.ts).
- **Web.**
  - a janela `JanelaDeModelos` na Nova APR e a `TrocaDeModelo` no checklist;
  - as regras da troca em `trocarModelo` e `riscosEquivalentes` (`web/src/lib/apr.ts`), conferidas com os 8 modelos reais por `web/scripts/testar-troca-de-modelo.mts`;
  - a janela das telas de campo (`JanelaSobreposta`) não usa a `<dialog>` nativa, para o tutorial do treino continuar clicável por cima dela;
  - a seção "Orientação para o técnico" (`OrientacaoDoModelo`) na tela do modelo;
  - a aba Atividades, só com código, descrição e provisório.
- **Campo de treino.** `web/src/treino/recomendacao.ts` e o passo novo em `web/src/components/treino/passos.ts`.
- **Simulador do SAP.** O gerador sorteia a atividade como `cadastrada`, `nova` ou `qualquer` ([apiSAP.md](apiSAP.md), seção 14).

### 5.4 O que ficou de fora

- **Escolha automática do modelo,** pelas razões da seção 5.1.
- **Dois modelos para a mesma execução** (por exemplo, a APR 03 e a APR 06 juntas): cada APR tem um modelo, e cada execução, uma APR; a questão 3 continua aberta.

### 5.5 Pontos em aberto

- **Orientação real.** A descrição, os exemplos e as palavras-chave da carga foram escritos a partir das planilhas. O admin deve revisá-los com o que a Segurança do Trabalho e a operação indicarem.
- **O app.** A janela de escolha e a troca precisam ser refeitas no app, com a escolha que vem no snapshot quando não houver sinal.

---

## 6. Pendências transversais

### 6.1 Insumos de terceiros

| Quem | O quê | Destrava | Questão |
|---|---|---|---|
| Iago | Planilha de OS de 2025 | Mapeamento da planilha e base fictícia mais fiel | 54 |
| Iago | Estrutura do formulário de inspeção | Formulário das preventivas | 57 |
| Iago | Onde o SAP guarda o ciclo do plano e como o conta | Ciclo das preventivas com dado real | 66 |
| Iago | Validade da assinatura desenhada | Assinatura aceita em auditoria | 38 |
| Iago | Um PDF de OS gerado pelo SAP, com texto (os exemplos são digitalizações) | Conferir a leitura do PDF real | — |
| ES Gás | Lista de materiais por serviço | Catálogo e conferência de materiais reais | 65 |
| Mario e Segurança do Trabalho | Critério de bloqueio dos 8 modelos, medidas só dos riscos marcados e "NA" na APR 06 | Modelos reais | 59 e 61 |
| Empresa | Aprovação para enviar dados ao fornecedor de IA | Vitória, rascunhos e digitalização das OS antigas no piloto | — |

### 6.2 Documentação desatualizada

- **[README.md](README.md):**
  - a seção "O que a demonstração apresenta" ainda descreve telas ilustrativas ("Fila de sincronização ilustrativa", "Telas ilustrativas para importação…");
  - ainda diz que as telas "não são módulos funcionais conectados";
  - "Arquitetura prevista" diz que ela "não está implementada";
  - "Limites e próximos passos" trata o cadastro pelo supervisor e o Campo de treino como planejados.
- **[Especificação](base/.design/especificacao.md):**
  - a seção "Situação" diz que só a `web` tem código, com dados simulados;
  - o Campo de treino aparece como "EM CONSTRUÇÃO";
  - a seção "Protótipo" lista diferenças que já não existem (suspender, cancelar por engano, motivo da pausa);
  - "Fora" ainda lista o cadastro pelo supervisor e o treinamento.
- **[api/README.md](api/README.md):**
  - **Rotas que não aparecem:** a auditoria, `POST /auth/sair`, `GET /usuarios/{id}` e `GET /equipes/{id}`.
  - **Conferência de materiais:** não aparece (`materiais` no `apr_concluida`, `materiais_faltando` e `obrigatorio` no catálogo).
  - **Permissões:** descreve a menos as rotas abertas a quem tem senha provisória, está pendente ou foi desativado.
  - **PDF:** diz que cada página "cabe numa folha". Na verdade a página é reduzida até 45%, e o que não couber continua em outra folha.
  - **Simulador:** diz que as OS entram "em até 15 minutos", mas a primeira leitura já sai na subida.
- **[web/README.md](web/README.md):**
  - diz "só para desktop", mas a web é responsiva até 479 px;
  - lista redirecionamentos que não existem;
  - cita os logins do modo local pela matrícula, e o login é pelo e-mail;
  - fala em quatro dashboards, e são cinco;
  - não tem seção do Campo de treino;
  - a lista de estilos e a estrutura de pastas estão incompletas.
- **[Inconsistencias.md](Inconsistencias.md):** é uma varredura de 11/10/2026, anterior a quase tudo o que está acima. Vale refazer ou arquivar.
- **Comentário no código:** em `api/src/rotas/sap.ts`, o comentário da criação da OS de apoio diz que o supervisor a abre "desde que veja a OS de origem". O código exige que ele supervisione a equipe dela.

### 6.3 Defeitos e sobras conhecidos

- **Resolvidos em 14/10/2026:**
  - **Carga de demonstração.** O `pnpm demo:popular` quebrava entre a meia-noite e cerca de 2h10, porque o cenário "em pausa neste momento" criava a APR no dia anterior e a `api` recusa APR de outro dia. Agora o cenário começa logo depois da meia-noite (`api/src/db/seed/demo.ts`).
  - **Campo de treino.** Os dashboards respondiam 404. Agora a API fictícia atende os indicadores (`web/src/treino/indicadores.ts`), sem dados por pessoa nem pendências de gestão.
- **Indicador "Online".** O da barra é um texto fixo, que não confere a conexão.
- **Código sem uso na web:**
  - `BotaoAviso` e `LinkAviso` (`components/ui/Aviso.tsx`);
  - `components/ui/Assinatura.tsx`;
  - a propriedade `aviso` do `Button`;
  - `recomecarTreino()` (`treino/recomecar.ts`);
  - as classes `.sync-row` e `.sync-ic` de `styles/os.css`;
  - um `return` inalcançável em `app/app/treino/estado/route.ts`.

### 6.4 Fora do escopo, por decisão

- Escrita no SAP por API: a baixa é por planilha (questão 51).
- Notificação push no celular: a OS nova aparece quando a lista é atualizada.
- iOS e terceiros no app.
- MFA, SSO e vínculo do aparelho com o usuário, que estão como RFC.
- Estoque, saldo e devolução de materiais (seção 4.1) e baixa do material gasto.
- Escolha automática do modelo da APR: o técnico escolhe a cada APR, e o sistema só recomenda (seção 5.1).
- Cadastro de equipamentos como entidade.
- Importação de OS pelo supervisor, adiada (questão 63).

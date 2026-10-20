# Funcionalidades — diagnóstico em 14/10/2026

> O que o sistema faz hoje, o que está parcial e o que ainda não começou, tanto nas funcionalidades essenciais (o que a especificação exige para a demo) quanto nas extras (ideias do time, dos mentores e do cliente, fora do MVP). O diagnóstico saiu da leitura do código da `api` e da `web`, não só dos documentos.
>
> Fontes: [especificação](base/.design/especificacao.md), [DesignDoc](DesignDoc.md), [pontos a validar](base/.design/pontos-a-validar.md), [gameficacao.md](gameficacao.md), [vitoria.md](vitoria.md) e o código em [api/](api/) e [web/](web/).

## Resumo

- **As correções da Reunião 3 foram feitas em 18/10/2026** ([correcoes-da-reuniao-3.md](funcionalidades/correcoes-da-reuniao-3.md)): cada participante assina a APR na própria conta, só no começo, com direito de recusa e mínimo de 2 participantes; pausa e suspensão pedem motivo (lesão e enfermidade avisam o supervisor); a localização é gravada em cinco momentos; o encerramento tem dois passos (o clique que para o tempo e, depois, o preenchimento com a assinatura do responsável); o supervisor assina por último, depois de ler o relatório da execução, e só então a OS está concluída e o PDF sai; o PDF reproduz a APR e a folha do SAP, e o resto foi para o relatório da execução. A migração é a `0032`. **Ficaram de fora:** a assinatura com validade jurídica, o login corporativo e a sincronização em segundo plano (dependem de contas e do app) e a digitalização, que será feita à parte.
- **O fluxo online está completo na `api` e na `web`.** A OS entra pela API do SAP, pela planilha ou pelo PDF. A APR é respondida e validada no servidor, a execução é registrada e o supervisor assina por último e sai o PDF da OS (a APR e a folha do SAP). Também já funcionam o painel, os alertas, os indicadores, a auditoria e a gamificação. A web é responsiva e funciona no navegador do celular.
- **Falta das essenciais o app Android e, com ele, o modo offline** (fila local, cópia da equipe e login sem sinal). A `api` já está pronta para os dois. Sem eles, o critério de sucesso da demo não fecha.
- **O formulário de inspeção das preventivas** virou o checklist de inspeção, implementado em 15/10/2026 ([inspecao-preventivas.md](inspecao-preventivas.md)); a pergunta ao Iago (questão 57) fica para conferir se ele cobre o uso real.
- **Os materiais recomendados foram decididos e feitos em 15/10/2026:** a conferência obrigatória (foto e bloqueio) saiu, e a lista do serviço virou só consulta (seção 4).
- **O usuário ausente foi feito em 15/10/2026** ([ausencia.md](ausencia.md)): o ausente continua ativo, mas só visualiza; a ausência é pedida pelo técnico ou registrada pelo supervisor, sempre assinada. Quem responde pela equipe com o supervisor ausente é o representante, feito em 16/10/2026 ([representante.md](representante.md)); desde 17/10/2026 ele também responde pela equipe sem supervisor ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seção 5.4).
- **A assinatura nas ações importantes foi feita em 17/10/2026** ([assinaturas.md](funcionalidades/assinaturas.md)): depois da liberação a assinatura é a primeira coisa a cadastrar (todos os perfis), e a ciência do supervisor (desde 18/10/2026, a assinatura final do supervisor), a liberação de cadastro, a reprogramação, o cancelamento e a devolução de OS e a interrupção ou o cancelamento por engano da execução passaram a ser assinados.
- **Os treinamentos de serviço foram feitos em 16/10/2026, sem IA** ([treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md)): o jogo por serviço do catálogo (explicação da Vitória + até 10 fases), publicado pelo admin com termo e assinatura, jogado pelo técnico (inclusive quem aguarda liberação) e pontuado pela gamificação. No mesmo dia, o **módulo de IA genérico** (desligado até a chave existir) e a **Vitória assistente, níveis 1 a 3**, também foram feitos ([vitoria.md](funcionalidades/vitoria.md), seções 1.5 e 2.10): botão flutuante em toda tela, respostas pelo manual do perfil, "Me leve lá", "mostrar na tela" e consultas filtradas. Em 17/10/2026 o módulo ganhou o Gemini gratuito, para a demonstração (seção 1.6); a primeira chamada real foi conferida no mesmo dia (13 perguntas, todas certas, inclusive "mês passado" e "maio" sem o ano), e sem IA ela responde por palavra-chave. Ainda em 17/10/2026 entraram o rascunho de treinamento pela IA, a bateria de 53 perguntas e "Perguntas à Vitória" no menu do admin (seções 3.9, 2.9.1 e 2.10.6 do [vitoria.md](funcionalidades/vitoria.md)).
- **Os avisos e os e-mails foram feitos em 17/10/2026** ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md)): todo aviso do sino pode sair também por e-mail, conforme as categorias que cada pessoa deixa ligadas no perfil, e de manhã sai um resumo diário. A varredura acrescentou 18 avisos (OS reservada, ciência, conta criada, acesso liberado, cadastro aguardando liberação, readmissão, equipe sem supervisor, falhas do registro e do PDF, Vitória sem IA, treinamentos). No mesmo dia saíram as pendências menores: o alerta da leitura do registro de funcionários que falha, a reativação na readmissão (um clique no aviso), os avisos da leitura do SAP no cartão, a equipe sem supervisor (o representante assume) e o e-mail dos avisos de ausência. **Para os e-mails saírem, falta só configurar o SMTP** (seção 6 do arquivo).
- **A escolha do modelo da APR foi decidida e feita em 14/10/2026:** o técnico escolhe o modelo a cada APR, entre os publicados, e o sistema só recomenda um pela leitura da OS (seção 5).
- **A atribuição individual e a devolução de OS foram decididas e feitas em 15/10/2026:** o supervisor da equipe reserva a OS a uma pessoa, que passa a ser a única a iniciar a APR e a execução, e devolve ao SAP a OS com erro, com uma justificativa que vai na planilha de baixa (seção 6).
- **Extras prontas:** OS de apoio, assinatura no perfil, equipe automática, evidência em PDF, catálogo de serviço com os materiais recomendados, ciclo das preventivas, gamificação, o registro de funcionários simulado (cadastro só por matrícula e e-mail de quem está nele, e desligamento em tempo real) e as telas dos simuladores do registro e do SAP.
- **Extras não iniciadas:**
  - a digitalização de OS e APR antigas, decidida com leitura por IA em [vitoria.md](funcionalidades/vitoria.md#10-digitalização-de-os-antigas) (feita em 19/10/2026: PDF em lote, foto de folhas avulsas e a APR em papel; falta testar com a IA de verdade).
- **Números (18/10/2026):** 168 rotas na `api` (as dos simuladores do SAP e do registro de funcionários só existem com `SAP_SIMULADO` e `RH_SIMULADO`), 33 migrações (`0000` a `0032`) e 878 testes em 47 arquivos. Os 878 testes passam, e o `tsc` da `api` e da `web` e o `eslint` da `web` saem sem erros.

## O que ainda falta, num relance

**Funcionalidades (código)**

- [ ] **App Android** (`mobile/`): login, OS da equipe, APR, execução, câmera, assinatura e perfil (seção 2.3).
- [ ] **Modo offline:** fila em SQLite, cópia da equipe, login sem sinal e aviso de pendentes (seção 2.3). A `api` já está pronta.
- [ ] **Dockerfile que gera o APK.**
- [x] **Checklist de inspeção das preventivas**, com a preventiva valendo o dobro na gamificação: [inspecao-preventivas.md](inspecao-preventivas.md).
- [x] **Materiais recomendados** no lugar da conferência obrigatória na APR: [materiais-recomendados.md](materiais-recomendados.md).
- [x] **Sugestão e contestação de materiais** (19/10/2026): qualquer funcionário sugere uma lista de materiais para um serviço ou contesta a recomendada; o supervisor da equipe que mais faz o serviço avalia, e a equipe é a que tem mais OS dele (no empate, a de mais pontos). Aceita, a lista entra no serviço e todas as equipes do serviço são avisadas; o autor ganha 30 pontos: [sugestao-de-materiais.md](funcionalidades/sugestao-de-materiais.md).
- [x] **Pedido de conta na tela de entrada** (20/10/2026): "Ainda não tem uma conta? Solicite" pede o nome, o e-mail e, se quiser, a equipe; avisa os administradores e quem responde pela equipe, e cadastrar a pessoa atende o pedido: [solicitacao-de-conta.md](funcionalidades/solicitacao-de-conta.md).
- [x] **Treinamentos de serviço (sem IA)**: [treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md) (seção 3.3).
- [x] **Vitória (o assistente), níveis 1 a 3, e o módulo de IA genérico**, com o Gemini na demonstração: [vitoria.md](funcionalidades/vitoria.md) (seção 3.2). O rascunho de treinamento por IA e a bateria de perguntas entraram em 17/10/2026.
- [x] **Escaneamento de OS e APR antigas**, feito em 19/10/2026 com leitura por IA (falta testar com a IA de verdade), em [vitoria.md](funcionalidades/vitoria.md#10-digitalização-de-os-antigas) (seção 3.3).
- [x] **Usuário ausente:** [ausencia.md](ausencia.md); o supervisor ausente e a equipe sem supervisor são cobertos pelo representante da equipe ([representante.md](representante.md) e [avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seção 5.4).
- [x] Do registro de funcionários: o alerta no sino quando a leitura diária falha e a reativação da conta na readmissão, com um clique no aviso ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seções 5.1 e 5.2).
- [x] Os avisos da leitura no cartão da tela do SAP ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seção 5.3).
- [x] **Avisos e e-mails:** o e-mail de todos os avisos, as preferências no perfil e o resumo diário ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md)).
- [x] **Execução compartilhada** (plano de 19/10/2026; as três etapas feitas até 20/10/2026: acompanhar, agir com pedido de 2 minutos e conferir o que foi feito sem sinal): todos os participantes acompanham a execução e agem sobre ela, com pedido de 2 minutos ao responsável e conferência do que foi feito sem sinal, em três etapas: [execucao-compartilhada.md](funcionalidades/execucao-compartilhada.md).
- [ ] **Configurar o servidor de e-mail (SMTP):** é o único passo para os e-mails saírem; espera a empresa liberar a conta, o remetente e o SPF/DKIM do domínio (questão 68; seção 6 do [avisos-e-emails.md](funcionalidades/avisos-e-emails.md)).

**Depende de terceiros** (seção 7.1): planilha de OS de 2025, formulário de inspeção, onde o SAP guarda o ciclo do plano, validade da assinatura desenhada, lista de materiais por serviço, critério de bloqueio dos modelos, a aprovação da empresa para enviar dados ao fornecedor de IA e o servidor de e-mail (SMTP).

**Documentação e arrumação** (seções 7.2 e 7.3): README da raiz, especificação, `api/README.md` e `web/README.md` ainda têm trechos desatualizados; há um pouco de código sem uso na web.

**Já resolvido em 15/10/2026:** a atribuição individual de OS a uma pessoa da equipe e a devolução da OS com erro ao SAP, com a justificativa na planilha de baixa (seção 6).

**Já resolvido na rodada de 14/10/2026:** os dashboards do Campo de treino (antes respondiam 404), a carga de demonstração entre a meia-noite e 2h10 (antes quebrava) e a escolha do modelo da APR pelo técnico, com a recomendação, a troca e a orientação editável (seção 5).

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

   A OS chega para a equipe toda. O supervisor da equipe pode reservá-la a uma pessoa, que passa a ser a única a iniciá-la, ou devolvê-la ao SAP com uma justificativa, se a ordem tiver erro (seção 6).
2. **Detalhe.** Além dos dados do SAP, o detalhe mostra:
   - os materiais recomendados do serviço, só para consulta;
   - o ciclo da preventiva;
   - o histórico do local e do equipamento;
   - todas as APRs e execuções anteriores.
3. **APR.**
   - **Etapas:**
     1. modelo, participantes e riscos: o técnico escolhe o modelo numa janela com todos os publicados, e o sistema recomenda um pela leitura da OS (seção 5);
     2. checklist respondido por inteiro, sem marcar o que é eliminatório (o modelo ainda pode ser trocado);
     3. revisão, com os materiais recomendados como lembrete;
     4. validação no servidor (`POST /aprs/avaliar`).
   - **Bloqueada:** quando um item eliminatório é reprovado. A APR fica registrada na hora, a OS fica pendente e o supervisor recebe alerta e e-mail. O técnico documenta cada item reprovado com foto, texto ou PDF, conforme o modelo pede.
   - **Aprovada:** a APR é registrada sem assinaturas (exige ao menos 2 participantes). Cada participante assina na própria conta, ou recusa, e a execução só começa quando todos assinaram.
4. **Execução.** Iniciar, pausar e suspender (os dois com motivo obrigatório), interromper por risco (com motivo, foto e assinatura), cancelar por engano (até 10 minutos depois do início) e encerrar. A localização é gravada no início, na pausa, na suspensão, na interrupção e no encerramento. O encerramento tem dois passos: o clique em "Encerrar OS" (o tempo para) e o preenchimento, com a assinatura do responsável; a descrição e as fotos são opcionais, e entram até 5 PDFs.
5. **Documento e baixa.**
   - O supervisor lê o relatório da execução e assina por último (a ciência de antes); a OS passa de `encerrando` e `aguardando_supervisor` a `encerrada`.
   - O PDF da OS (a APR e a folha do SAP, como o papel) é gerado em segundo plano, depois dessa assinatura.
   - A planilha de baixa no SAP sai com quatro abas: Encerradas, Sem ordem SAP, Impedimentos e Devolvidas.
6. **Depois.** Dashboards, alertas de ciclo das preventivas e pontos da gamificação.

Todo registro de campo passa por `POST /eventos`, que é idempotente. Isso vale online e, quando o app existir, também para a fila offline.

### 1.3 Estado por área

| Área | Situação |
|---|---|
| Plataforma | **Pronta.** Monorepo, Dockerfiles da `api` e da `web` (e o do `mobile`, que gera o APK), `docker-compose`, migrações aplicadas na subida, 6 buckets privados, tarefas em segundo plano com novas tentativas e modo local sem Supabase (`pnpm dev:local`) |
| Acesso e usuários | **Pronta.** Login pelo e-mail institucional, senha provisória trocada no primeiro acesso, redefinição pelo admin, cadastro pelo supervisor com liberação ou recusa pelo admin, assinatura no perfil e trilha de auditoria que só cresce |
| Campo de treino | **Pronto.** API fictícia em memória por usuário, tutorial Direcionado (18 passos) ou modo Livre; a `api` real só guarda o estado |
| Entrada de OS | **Pronta com o simulador** (agora com tabela no banco e tela própria), com a planilha e com o PDF que tem texto. O PDF digitalizado de OS já concluídas no papel entra pela Importação (feito em 19/10/2026: OCR, IA no manuscrito e conferência); a câmera segue só protótipo |
| Registro de funcionários | **Pronto com o simulador.** Cadastro só de quem está no registro, desligamento em tempo real (aviso e leitura diária), selos na tela de usuários e a tela do simulador |
| Modelos de APR | **Pronta.** 8 modelos na carga inicial, versões imutáveis, editor, orientação de cada modelo para a escolha do técnico, arquivamento e restauração. O critério de bloqueio da carga é provisório até a Segurança do Trabalho validar |
| Catálogo de serviço | **Pronta.** Materiais, ferramentas e EPIs recomendados por serviço, com quantidade |
| APR | **Pronta na web.** Modelo escolhido pelo técnico, com a recomendação e a troca, checklist inteiro, validação no servidor, materiais recomendados, evidência por foto, texto ou PDF e APR bloqueada registrada na validação |
| Execução | **Pronta na web.** Assinatura da APR por participante, pausa e suspensão com motivo, localização, interrupção por risco, cancelamento por engano, encerramento em dois passos, assinatura final do supervisor, PDF da OS e relatório da execução |
| Impedimento e alertas | **Pronta.** 7 tipos de alerta (e-mail só no bloqueio), reprogramação e OS de apoio |
| Painel | **Pronta.** Quadro, detalhe, assinatura final do supervisor, local crítico, busca global, PDF e exportação para baixa |
| Indicadores | **Pronta.** 5 dashboards (Geral, Equipes, OS, APR e Meus resultados), com tempo de execução e de pausa por equipe, técnico e OS |
| Ciclo das preventivas | **Pronta.** Contagem até o próximo ciclo por plano e item, com alertas de ciclo próximo e vencido; não cria OS |
| Gamificação | **Pronta.** Pontos por tarefa, temporadas trimestrais, ranking, patentes de pessoa e de equipe, conquistas e anonimato |
| Eventos e sincronização | **Pronta na `api`.** Envio idempotente, snapshot da equipe (`POST /sync/pull`) e tolerância à fila offline. Hoje só a web usa, e só online |
| App Android e modo offline | **Em andamento.** As pendências 1 a 8 estão prontas em 19/10/2026 (esqueleto Expo, login, lista e detalhe das OS, APR e execução, perfil com a assinatura, avisos, ausências, gamificação e Vitória, online; a cópia da equipe e a fila em SQLite, com a APR, a execução e o encerramento sem sinal; e o login sem sinal, o aviso de pendentes e o Sair recusado com fila; o envio da fila com o app fechado, a cada 15 minutos no mínimo; o Dockerfile que gera o APK assinado, `pnpm apk`; a conquista de sincronização offline, só na `api`; [README do mobile](mobile/README.md)); falta ver tudo num aparelho. Plano em [mobile.md](funcionalidades/mobile.md) |
| Treinamentos de serviço | **Prontos** em 16/10/2026 ([treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md)); o rascunho pela IA entrou em 17/10/2026 ([vitoria.md](funcionalidades/vitoria.md), seção 3.9) |
| Vitória (assistente) e módulo de IA | **Prontos** em 16/10/2026, níveis 1 a 3 ([vitoria.md](funcionalidades/vitoria.md)). Provedor por `IA_PROVEDOR` (Claude ou Gemini); o Gemini gratuito, da demonstração, entrou em 17/10/2026 e teve a primeira chamada real conferida no mesmo dia. A bateria de 53 perguntas (`pnpm vitoria:bateria`) foi montada no mesmo dia e falta rodar inteira |

---

## 2. Funcionalidades essenciais

### 2.1 Pelo critério de sucesso da especificação

A seção "Sucesso" pede o caminho ler OS → APR → executar → PDF "no app Android e no navegador" e, como contingência, "num Android em modo avião".

| Parte do critério | Situação |
|---|---|
| No navegador, online | **Atende.** Funciona de ponta a ponta, e a OS encerrada aparece no painel na hora |
| No app Android, online | **Atende no código** (19/10/2026): ler OS → APR → executar → PDF roda no app. Falta ver num aparelho ou emulador |
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

- **Formulário de inspeção das preventivas (questão 57).** A `api` aceita `dados_inspecao` no encerramento, guarda e, desde 18/10/2026, mostra no relatório da execução (fora do PDF). Mas a web não tem o formulário, e o detalhe da OS não o mostra. Em 15/10/2026 virou o checklist de inspeção, definido no ciclo de cada preventiva: plano em [inspecao-preventivas.md](inspecao-preventivas.md). **Implementado no mesmo dia:** o encerramento pede o checklist e o detalhe da OS o mostra.
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
| Catálogo de serviço com os materiais | DesignDoc (prioridades) | **Pronto**, com os materiais recomendados (seção 4) |
| Intervalo entre ciclos das preventivas | DesignDoc (prioridades) | **Pronto** |
| Gamificação | Time, na Reunião 2 | **Pronta** |
| Chatbot de consulta | Iago, na Reunião 2 | **Virou a Vitória e os treinamentos de serviço** ([vitoria.md](funcionalidades/vitoria.md)). Os dois estão prontos: os treinamentos, com o rascunho pela IA ([treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md)), e a Vitória assistente, níveis 1 a 3 ([vitoria.md](funcionalidades/vitoria.md)) |
| Escaneamento de OS e APR antigas | DesignDoc (prioridades) | **Feito em 19/10/2026: PDF digitalizado em lote (OCR local + IA no manuscrito + conferência), foto de folhas avulsas pela câmera e APR em papel junto com a OS** ([vitoria.md](funcionalidades/vitoria.md#10-digitalização-de-os-antigas)). A câmera tira uma foto por folha (até 8), avisa se está escura ou tremida e manda ler pelo mesmo caminho do PDF |
| API de funcionários para cadastro rápido | DesignDoc (extras) | **Pronta com o simulador.** Registro de funcionários simulado, com tela própria; cadastro só de quem está nele e desligamento em tempo real ([apifuncionarios.md](apifuncionarios.md)) |
| Tela do simulador do SAP | Time, em 14/10/2026 | **Pronta** ([apiSAP.md](apiSAP.md)) |
| Atribuição individual e devolução de OS | Time, em 15/10/2026 | **Pronta** (seção 6) |
| Usuário ausente | Time, em 15/10/2026 | **Pronto** ([ausencia.md](ausencia.md)); a equipe sem supervisor entrou em 17/10/2026 |
| Avisos e e-mails | Time, em 17/10/2026 | **Pronto, menos a configuração do SMTP** ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md)) |

### 3.2 As prontas: o que fazem e o que falta

**OS de apoio**

- **Quem abre:** o supervisor da equipe da OS de origem ou o admin, a partir de um impedimento. Pode ser aberta para qualquer equipe.
- **Ligação com o SAP:** fica ligada à OS original e não tem número SAP até alguém criá-la lá. Por isso sai na aba "Sem ordem SAP" da planilha de baixa.
- **Encerramento:** avisa a equipe da OS original (alerta `apoio_encerrado`).
- **Cancelamento:** só o admin cancela.

**Assinatura no perfil**

- A assinatura é desenhada no perfil, confirmada a cada uso e impressa no PDF. Depois da liberação ela é obrigatória para todos os perfis (a `api` responde `403 assinatura_pendente` até ser cadastrada) e valida as ações importantes: ver [assinaturas.md](funcionalidades/assinaturas.md).
- Cada assinatura guarda a imagem usada; refazer a do perfil vale só para as próximas.
- **Falta:** o Iago dizer se a assinatura desenhada vale para auditoria (questão 38).

**Evidência em PDF**

- O item do modelo diz se pede foto, texto ou PDF (questão 50). Um PDF a mais é sempre aceito, mas não substitui a foto exigida.
- Vale no item reprovado, na interrupção por risco e no encerramento (até 5 PDFs).
- A `api` confere o arquivo pelo conteúdo e o guarda no bucket `documentos`.

**Catálogo de serviço**

- O serviço é a própria atividade do plano de manutenção, a que a OS traz do SAP. Ela não escolhe o modelo de APR, mas a descrição dela entra na recomendação do modelo (seção 5).
- O admin cadastra materiais, ferramentas e EPIs e monta a lista de cada serviço, com a quantidade.
- O detalhe da OS e a revisão da APR mostram a lista como recomendação (seção 4).
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
  - o SYNQ OS só cadastra quem está no registro de funcionários: o admin ou o supervisor informa a matrícula e o e-mail institucional, e o nome, o cargo e o registro profissional vêm de lá e deixam de ser editáveis (o botão "Atualizar do registro" os traz de novo);
  - o desligamento vale em tempo real: o registro avisa o SYNQ OS, e a conta é desativada em segundos; uma leitura completa por dia (e o "Ler agora") pega o que o aviso perdeu;
  - o registro de funcionários e as ordens do SAP são simulados, com tabelas no banco e uma tela de CRUD cada, em `/simulador/funcionarios` e `/simulador/ordens` (só o admin): criação manual e aleatória, busca, seleção com ações em massa, "ver mais", editar e excluir;
  - a tela do SAP mostra, em cada ordem, como o SYNQ OS reagiu (ainda não lida, ignorada com o motivo, ou o status da OS) e o que ele vai pegar na próxima leitura.
- **Feito em 17/10/2026** ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seção 5):
  - a leitura do registro que falha de vez (as tentativas acabaram ou a trava de segurança parou) vira aviso no sino e e-mail para os administradores;
  - a readmissão avisa os administradores, com o botão "Reativar a conta" no aviso (o automático continua só tirando acesso);
  - o membro da equipe desligado avisa o supervisor, com as OS que continuam reservadas para ele;
  - os avisos da leitura do SAP (o intervalo entre ciclos que não foi reconhecido) ficam na importação e aparecem no cartão da tela do SAP.

**Usuário ausente**

- **Onde está o desenho:** [ausencia.md](ausencia.md), com o que mudou na implementação (seção 13).
- **O que faz:**
  - o ausente continua ativo e vê tudo, mas não altera nada, não recebe reserva de OS e não entra em APR; a `api` recusa com `403 usuario_ausente`;
  - o técnico pede (motivo, início e dias ou data de retorno), o supervisor da equipe aprova (com ajuste das datas), recusa, registra a de alguém ou a própria, prorroga e encerra, e o técnico confirma; tudo é assinado, menos o pedido inicial;
  - a ausência não termina sozinha: passada a data fica vencida até o ausente confirmar o retorno ou o supervisor encerrar;
  - no início, as reservas de OS caem para a equipe toda e a execução aberta é suspensa; os avisos vão pelo sino, que agora o técnico também tem.
- **Feito em 17/10/2026** ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md)): a equipe sem supervisor (o representante assume e responde aos pedidos, e os administradores são avisados) e o e-mail dos avisos, que só espera a configuração do SMTP.
- **Falta:** o app, quando existir.

**Treinamentos de serviço**

- **Onde está o desenho e o que mudou na implementação:** [treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md) (seção 3 do [vitoria.md](funcionalidades/vitoria.md)).
- **O que faz:** o admin cria, por serviço do catálogo, uma explicação em passos (a Vitória narrando) e um jogo de 3 fases ou mais (10 minijogos: quiz, decisão, ligar, pôr em ordem, verdadeiro ou falso, caça-palavras, memória, selecione, desembaralhe e Termo), à mão ou a partir de um rascunho da IA, e publica com termo e assinatura; o técnico (inclusive quem aguarda liberação) joga, pontua e pode reportar problema.
- **Rascunho pela IA (17/10/2026):** o admin cola o texto do procedimento e a Vitória monta o rascunho, com o trecho de origem de cada item; as conferências viram pendências que impedem publicar até o admin editar ou confirmar; ajustes pelo chat, fase regerada e limites da demonstração (seção 3.9 do [vitoria.md](funcionalidades/vitoria.md)).
- **Telas refeitas (18/10/2026):** o jogo numa janela, com a Vitória comentando cada passo e fase; o admin escolhe entre gerar com a IA e criar à mão, e segue por páginas separadas (visão geral, explicação, fases, revisão, publicar, versões e problemas). Seção 8 do [treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md).
- **Ranking por treinamento (18/10/2026):** ao concluir, o resultado mostra a nota e o ranking daquele treinamento (a primeira conclusão de cada pessoa, com a sua posição em destaque); a capa mostra o mesmo ranking. Seção 9 do [treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md).
- **Minijogos e "Ver ranking" (18/10/2026):** 6 tipos novos de fase (verdadeiro ou falso, caça-palavras, memória, selecione, desembaralhe e Termo), cada um com cor e visual próprios, e "Ver ranking" ao lado de "Jogar treinamento" no cartão. Desembaralhe e Termo sorteiam uma de 10 palavras a cada partida, as opções mudam de ordem a cada tentativa, e a geração com a Vitória aceita o plano das fases (quantas e de que tipo). Depois: o "Separar os itens" virou o Selecione com os materiais do serviço, o jogo perdeu o limite de fases e ganhou o "1 de cada" (seção 11). Por fim, a nota do treinamento (acertos × tempo × fases), a navegação entre as fases e o ranking pela melhor nota, sem mudar a gamificação geral (seção 12). Seção 10 do [treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md).
- **Melhorias de 20/10/2026:** caça-palavras na diagonal e com palavras se cruzando numa grade maior, mais opções no Selecione, Termo com a casa de cada letra escolhida, cinza na carta não escolhida do verdadeiro ou falso e nas letras já usadas do desembaralhe, confirmação antes de avançar sem concluir ou recomeçar, tempo do jogo todo, "Ver ranking" no resultado, serviços do catálogo em "Com treinamento" e "Outros serviços" e o Campo de treino que abria em localhost. Seção 13 do [treinamentos-de-servico.md](funcionalidades/treinamentos-de-servico.md).

**Vitória (o assistente) e o módulo de IA genérico**

- **Onde está o desenho, o que mudou na implementação e o que ela faz, ainda não faz e não deve fazer:** [vitoria.md](funcionalidades/vitoria.md) (seções 1 e 2 e "Situação atual da Vitória"), feitos em 16/10/2026.
- **O que faz:** botão flutuante em toda tela do portal e da gestão, inclusive o Campo de treino; responde pelo manual do perfil de quem pergunta (técnico ou admin, cada um sem o que o outro não deve ver); oferece "Me leve lá" e "mostrar na tela" por uma lista fechada de destinos (nunca uma URL livre); interpreta consultas simples como um link já filtrado (ex.: período); grava, sem identificar quem perguntou, o que não soube responder, numa tela própria do admin ("Perguntas à Vitória", no menu, desde 17/10/2026).
- **A IA:** o provedor sai de `IA_PROVEDOR` (`ANTHROPIC_API_KEY` ou `GEMINI_API_KEY`); o Gemini gratuito, só com dados fictícios, está configurado no desenvolvimento desde 17/10/2026 (seção 1.6 do [vitoria.md](funcionalidades/vitoria.md)). Sem chave ou com falha, as respostas vêm de 3 sugestões fixas por tela e de uma busca por palavra-chave no manual.
- **Conferida em 17/10/2026:** a primeira chamada real pelo Gemini (13 perguntas, todas certas) e as datas relativas ("mês passado", "este mês", "maio" sem o ano), pela data de hoje que o pedido à IA agora leva.
- **Bateria de perguntas (17/10/2026):** 53 casos, 15 deles provocações e tentativas de descobrir o que reprova a APR, com o plano B por `--modelo` (`pnpm vitoria:bateria`, seção 2.9.1 do [vitoria.md](funcionalidades/vitoria.md)).
- **Falta:** rodar a bateria inteira (a primeira rodada parou na cota diária do Gemini gratuito), os ajustes do desenho definitivo do avatar (marca, capacete) e a Vitória no app; o nível 4 (a IA lendo as OS) está fora de escopo por decisão (LGPD e números inventados).

### 3.3 As que não começaram

**Escaneamento de OS e APR antigas**

- **O que existe (19/10/2026):** o PDF escaneado em lote, a câmera com várias fotos de folhas avulsas e a APR em papel que vem junto com a OS (lida, conferida e guardada à parte da APR do sistema). O PDF só com imagem enviado pelo caminho "para liberar" continua recusado (`pdf_sem_texto`).
- **Decidida** (14/10/2026), com o desenho na seção 10 do [vitoria.md](funcionalidades/vitoria.md#10-digitalização-de-os-antigas); o modelo de IA e mais sete pontos seguem em aberto. O objetivo são as OS antigas, já executadas no papel, que entram encerradas, de histórico. A IA de visão lê as folhas, inclusive a parte escrita à mão, e o sistema conferir o que foi lido.
- **Do que depende:** do teste da leitura com folhas fictícias e, no piloto, da aprovação da empresa para enviar as folhas ao fornecedor de IA.
- **Quando existir:** vira uma nova origem de importação e pode reaproveitar a conferência do PDF.
- **APR antigas:** entram junto com a OS digitalizada, à parte da APR do sistema (não valem como APR do dia, não pontuam, não bloqueiam); desenho na seção 10.0 do vitoria.md.

### 3.4 Ordem sugerida para as extras

- **Os treinamentos de serviço e a Vitória já estão prontos,** com e sem IA, seguindo a ordem do [vitoria.md](funcionalidades/vitoria.md#8-ordem-de-implementação). Ficam para antes do app, ou em paralelo, se outra pessoa assumir.
  - É a única extra pedida pelo cliente.
  - Roda sobre a web pronta.
  - É a vitrine da feira. Se a feira cair antes de o app ter algo para mostrar, ela passa à frente do app.
- **A API de funcionários e a tela do SAP** já foram feitas, na ordem do [apifuncionarios.md](apifuncionarios.md#11-ordem-de-implementação) e depois a do [apiSAP.md](apiSAP.md#12-ordem-de-implementação).
- **O escaneamento** começa pelo teste da leitura das folhas pela IA ([vitoria.md](funcionalidades/vitoria.md#1012-ordem-de-implementação-proposta)).

---

## 4. Materiais recomendados na APR

Esta funcionalidade fica registrada só aqui e em [materiais-recomendados.md](materiais-recomendados.md), não na especificação.

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
- **Aviso ao responsável.** Desde 17/10/2026 ele recebe o aviso `os_reservada` (e quem perdeu a reserva, `os_reserva_desfeita`), no sino e por e-mail ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md)).
- **O app.** Ainda não existe; quando existir, precisa mostrar a reserva e a devolução.

### 6.5 Pontos em aberto

- **O caminho da devolução até o SAP.** A aba Devolvidas é lida por uma pessoa. Falta combinar com o Iago quem a lê e como corrige a ordem.
- **A APR de hoje de outra pessoa.** Se a OS já tem uma APR aprovada de hoje e o supervisor a reserva a outra pessoa, a APR fica sem uso: só o responsável inicia a execução, e ele precisa participar da APR (ou fazer outra).
- **O admin.** Hoje ele não reserva nem devolve. Na equipe sem supervisor, desde 17/10/2026, o representante assume e reserva e devolve por ela, e o admin é avisado para escolher um supervisor ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seção 5.4).

---

## 7. Pendências transversais

### 7.1 Insumos de terceiros

| Quem | O quê | Destrava | Questão |
|---|---|---|---|
| Iago | Planilha de OS de 2025 | Mapeamento da planilha e base fictícia mais fiel | 54 |
| Iago | Estrutura do formulário de inspeção | Formulário das preventivas | 57 |
| Iago | Onde o SAP guarda o ciclo do plano e como o conta | Ciclo das preventivas com dado real | 66 |
| Iago | Validade da assinatura desenhada | Assinatura aceita em auditoria | 38 |
| Iago | Um PDF de OS gerado pelo SAP, com texto (os exemplos são digitalizações) | Conferir a leitura do PDF real | — |
| ES Gás | Lista de materiais por serviço | Catálogo de materiais recomendados reais | 65 |
| Mario e Segurança do Trabalho | Critério de bloqueio dos 8 modelos, medidas só dos riscos marcados e "NA" na APR 06 | Modelos reais | 59 e 61 |
| Empresa | Aprovação para enviar dados ao fornecedor de IA | Vitória, rascunhos e digitalização das OS antigas no piloto | — |
| Empresa (TI), pelo Iago | Servidor de e-mail (SMTP): endereço, porta, usuário e senha, o remetente e o SPF/DKIM do domínio; e o aceite do que vai nos e-mails | E-mails dos avisos e o resumo diário ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seção 6) | 68 |

### 7.2 Documentação desatualizada

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
- **Comentário no código:** em `api/src/rotas/sap.ts`, o comentário da criação da OS de apoio diz que o supervisor a abre "desde que veja a OS de origem". O código exige que ele supervisione a equipe dela.

### 7.3 Defeitos e sobras conhecidos

- **Resolvidos em 14/10/2026:**
  - **Carga de demonstração.** O `pnpm demo:popular` quebrava entre a meia-noite e cerca de 2h10, porque o cenário "em pausa neste momento" criava a APR no dia anterior e a `api` recusa APR de outro dia. Agora o cenário começa logo depois da meia-noite (`api/src/db/seed/demo.ts`).
  - **Campo de treino.** Os dashboards respondiam 404. Agora a API fictícia atende os indicadores (`web/src/treino/indicadores.ts`), sem dados por pessoa nem pendências de gestão.
- **Indicador "Online".** Saiu da barra da web em 17/10/2026: na web só se acessa pela internet, então o selo não informa nada. Fica para o app `mobile`, onde a conexão pode cair.
- **Código sem uso na web:** a propriedade `aviso` do `Button` e um `return` inalcançável em `app/app/treino/estado/route.ts`. Em 16/10/2026 saíram `ui/Aviso.tsx`, `ui/Assinatura.tsx`, `treino/recomecar.ts`, as classes `.sync-row` e `.sync-ic` e os SVG de exemplo do Next em `public/`.

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

# Pendências para concluir o MVP — diagnóstico em 18/10/2026

> O que falta para dar o MVP do SYNQ OS como completo. **É o guia de trabalho a partir de agora:** cada item concluído é marcado aqui e registrado no arquivo da própria demanda, na pasta [funcionalidades/](funcionalidades/).
>
> O diagnóstico saiu da leitura do código da `api` e da `web` e dos documentos: [funcionalidades.md](funcionalidades.md), [especificação](base/.design/especificacao.md), [DesignDoc](DesignDoc.md), [Questoes.md](Questoes.md) e [correções da Reunião 3](base/funcionalidades/correcoes-da-reuniao-3.md). Em 18/10/2026 o `tsc` da `api` e da `web` saiu sem erros. Os ajustes de interface, design e UX ficam para a rodada antes da apresentação final e não estão listados aqui.

## Critério de conclusão

A seção "Sucesso" da especificação pede o caminho **ler OS → APR → executar → PDF**:

| Onde | Situação |
|---|---|
| No navegador, online | **Atende** |
| No app Android, online | **Atende no código** (pendências 1 a 3, 19/10/2026): o app lê as OS, faz a APR, executa, encerra e abre o PDF, e tem a assinatura, o perfil, os avisos, a gamificação e a Vitória. **Falta ver num aparelho ou emulador** |
| Num Android em modo avião, chegando ao painel quando o sinal volta | **Atende em parte no código** (pendências 4 e 5, 19/10/2026): o app abre e entra sem sinal (7 dias desde a última confirmação do servidor), e a APR, a execução e o encerramento sem sinal ficam numa fila em SQLite, com o aviso "Sem conexão — N registros pendentes", e sobem quando o sinal volta. **Falta** ver num aparelho: o envio com o app fechado (pendência 6) está no código, a cada 15 minutos no mínimo, e o APK que o Dockerfile gera (pendência 7) ainda não foi montado nem instalado |

O MVP está completo quando as três linhas atenderem e os itens 🔴 da tabela abaixo estiverem feitos.

## Tabela de pendências

**Prioridade:** 🔴 bloqueia o MVP; 🟡 deve entrar antes da apresentação; 🟢 extra ou depois do MVP.
**Tipo:** código (o time faz), terceiros (espera alguém de fora) ou decisão (espera uma resposta do cliente ou do time).

| # | Pendência | Tipo | Prioridade | Depende de | Situação |
|---|---|---|---|---|---|
| 0 | Commitar as correções da Reunião 3 | código | 🔴 | — | [x] 19/10/2026 |
| 1 | App Android: esqueleto, login e lista/detalhe das OS | código | 🔴 | 0 | [x] 19/10/2026 |
| 2 | App Android: APR e execução online | código | 🔴 | 1 | [x] 19/10/2026 |
| 3 | App Android: perfil, assinatura, avisos e gamificação | código | 🔴 | 1 | [x] 19/10/2026 |
| 4 | Modo offline: cópia da equipe e fila em SQLite | código | 🔴 | 2 | [x] 19/10/2026 |
| 5 | Modo offline: login sem sinal e aviso de pendentes | código | 🔴 | 4 | [x] 19/10/2026 |
| 6 | Modo offline: envio em segundo plano | código | 🔴 | 4 | [x] 19/10/2026 |
| 7 | Dockerfile que gera o APK | código | 🔴 | 1 | [x] 19/10/2026 |
| 8 | Conquista de sincronização offline (gamificação) | código | 🟡 | 4 | [x] 19/10/2026 |
| 9 | Digitalização: pergunta antes da importação | código | 🟢 | — | [x] 19/10/2026 |
| 10 | Digitalização: PDF digitalizado em lote (OCR + IA) | código | 🟢 | 9 | [x] 19/10/2026 |
| 11 | Digitalização: foto de folhas avulsas | código | 🟢 | 10 | [x] 19/10/2026 |
| 12 | Digitalização: APRs antigas | código | 🟢 | 10 | [x] 19/10/2026 |
| 13 | Validação (React Hook Form e Zod) nos demais formulários | código | 🟡 | — | [x] 19/10/2026 |
| 14 | Rodar a bateria inteira da Vitória (53 perguntas) | código | 🟡 | cota da IA | [ ] |
| 15 | Atualizar README, especificação e READMEs da `api` e da `web` | código | 🟡 | 1 a 7 | [x] 20/10/2026 |
| 16 | Configurar o servidor de e-mail (SMTP) | terceiros | 🟡 | TI da empresa | [ ] |
| 17 | Assinatura com validade jurídica (ZapSign, gov.br) | terceiros | 🟢 | conta e Iago (questão 38) | [ ] |
| 18 | Login corporativo (conta Microsoft com segundo fator) | terceiros | 🟢 | diretório da empresa | [ ] |
| 19 | Dados reais: planilha de 2025, critério de bloqueio, materiais, ciclo no SAP, formulário de inspeção | terceiros | 🟢 | Iago, Mario, ES Gás | [ ] |
| 20 | Supervisor devolve a OS ao responsável em vez de assinar | decisão | 🟡 | questão 69 | [ ] |
| 21 | Equipe com só 1 pessoa disponível (mínimo de 2 na APR) | decisão | 🟡 | questão 72 | [ ] |
| 22 | "Houve desvio?" e "Tempo parada" na folha do SAP | decisão | 🟢 | questão 70 | [ ] |
| 23 | Mais de 3 executantes na folha do SAP | decisão | 🟢 | questão 71 | [ ] |
| 24 | Execução compartilhada, etapa 1: participantes acompanham a execução | código | 🟢 | — | [x] 19/10/2026 |
| 25 | Execução compartilhada, etapa 2: participantes agem (na hora ou por pedido de 2 min) | código | 🟢 | 24 | [x] 20/10/2026 |
| 26 | Execução compartilhada, etapa 3: conferência do que foi feito sem sinal | código | 🟢 | 25 | [x] 20/10/2026 |

**Ordem sugerida:** 0 → 1 → 2 → 3 → 7 → 4 → 5 → 6 → 8, com as 🟡 em paralelo quando houver folga. A digitalização (9 a 12) corre à parte, quando o app online já estiver de pé, ou antes, se a apresentação precisar dela.

---

## 1. Antes de tudo

### 0. Commitar as correções da Reunião 3

- **Feito.** As correções da Reunião 3 foram commitadas por assunto (`api`, `web` e documentação), com a migração `0032_execucao_em_dois_passos_e_assinaturas`; o que sobrava no disco (a digitalização por PDF, itens 9 e 10, e a migração `0036`) foi commitado em 19/10/2026, com os testes e o `tsc` da `api` e da `web` rodados antes.
- **Por que primeiro:** o app é construído sobre esse contrato. Perder ou misturar esse trabalho com o do app custa caro, e a migração já aplicada não pode ser regerada.
- **Como:** commits separados por assunto (`api`, `web`, documentação), com os testes da `api` rodados antes.

## 2. App Android e modo offline (bloqueiam o MVP)

**O plano detalhado, em 20 etapas, está em [funcionalidades/mobile.md](funcionalidades/mobile.md).** Os itens 1 a 8 abaixo são o resumo; o andamento é marcado lá e aqui.

A `api` já está pronta para o app: envio idempotente (`POST /eventos`), snapshot da equipe (`POST /sync/pull`), a regra dos 60 s que reconhece o evento da fila, o início da execução que fica pendente esperando a assinatura de outro aparelho, a assinatura presencial (`assinatura_presencial: true`) e o aviso de relógio errado do aparelho no detalhe da OS. **O app é um cliente:** as regras de negócio já vivem no servidor.

A referência das telas é a `web` em `/app/*`. As regras que o app herda da Reunião 3 estão no [README do mobile](mobile/README.md).

**Stack recomendada:** React Native com Expo (câmera, SQLite, armazenamento seguro e geração local do APK), como na Decisão-chave 1 da especificação.

### 1. Esqueleto, login e OS da equipe

- Projeto Expo em `mobile/`, Android, TypeScript.
- Login pelo e-mail institucional, troca da senha provisória e a assinatura obrigatória depois da liberação (`403 assinatura_pendente`).
- Lista das OS da equipe (`GET /os`) e detalhe (`GET /os/{id}`), com a reserva ("Reservada para você"), a devolução e os materiais recomendados.
- **Feito em 19/10/2026** (etapas 1 a 6, 8 e 9 do plano; o registro está na seção 6 de [funcionalidades/mobile.md](funcionalidades/mobile.md) e o uso, no [README do mobile](mobile/README.md)). Fica provisório: os botões de APR e de execução levam a uma tela "em breve", e a assinatura é cadastrada pela web (a etapa 7 é da pendência 3). **Falta ver as telas rodando num aparelho ou emulador** (`pnpm android` no `mobile`): a validação foi por código (`tsc`, ESLint, 41 testes, o pacote do Metro, o manifesto e a `api` local em memória), sem aparelho.

### 2. APR e execução online

- **APR:** a janela de escolha do modelo, com a recomendação e a troca (`GET /os/{id}/modelos-apr`); o checklist inteiro, sem mostrar o que é eliminatório; a validação em `POST /aprs/avaliar`; a evidência dos itens reprovados (foto, texto ou PDF); o mínimo de 2 participantes.
- **Assinaturas da APR:** cada participante assina na própria conta (`apr_assinada`) ou recusa (`apr_recusada`); a faixa "APR aguardando a sua assinatura" (`GET /me/aprs-para-assinar`).
- **Execução:** iniciar, pausar e suspender com motivo, interromper por risco (motivo, foto e assinatura), cancelar por engano, encerrar em dois passos (`execucao_encerrada` e, depois, `encerramento_assinado` com o checklist de inspeção).
- **Localização** nos cinco momentos, sem bloquear o serviço quando não houver GPS.
- **Câmera nativa**, com a foto comprimida a ~1600 px e qualidade 70% (questão 16), e envio por `PUT /arquivos/{id}` antes do evento.
- **Feito em 19/10/2026** (etapas 10 a 15 do plano; o registro está na seção 6 de [funcionalidades/mobile.md](funcionalidades/mobile.md) e o uso, no [README do mobile](mobile/README.md)). A APR (modelo, participantes e riscos; checklist; validação; evidência dos reprovados; assinatura e recusa de cada participante) e a execução (iniciar, pausar, suspender, interromper, cancelar por engano, a esquecida de outro dia e o encerramento em dois passos com o checklist de inspeção) rodam online, com a câmera e a galeria, o PDF e a localização. As regras puras da execução foram para `shared/api/` (a web reexporta). **Validado sem aparelho:** `tsc` e ESLint do `mobile` e da `web`, 79 testes, o pacote do Metro, o manifesto, `expo-doctor` e `pnpm conferir:campo` contra a `api` local (o fluxo inteiro, com duas contas). **Falta ver as telas rodando num aparelho ou emulador** (layout, teclado, câmera, seletor de PDF e GPS) e, para a assinatura desenhada no aparelho, a pendência 3.

### 3. Perfil, assinatura, avisos e gamificação

- Perfil com a assinatura desenhada e o histórico das OS encerradas do próprio técnico (60 dias).
- O sino de avisos.
- Gamificação só de consulta: Minha pontuação, Ranking, Conquistas, os avisos de conquista e de patente, o "+N pontos" das telas de APR e de execução e o anonimato no perfil ([gameficacao.md](base/funcionalidades/gameficacao.md), seção 8.4).
- A Vitória no app.
- O indicador "Online", que saiu da web e ficou para o app.
- Quais telas de gestão entram no app fica para depois da demo (questão 55).
- **Feito em 19/10/2026** (etapas 7, 16 e 17 do plano; o registro está na seção 6 de [funcionalidades/mobile.md](funcionalidades/mobile.md) e o uso, no [README do mobile](mobile/README.md)). A assinatura desenhada com o dedo (cadastro no primeiro acesso, "Refazer" no perfil e no lugar do aviso "cadastre pela web" das janelas de ação); o perfil com o histórico das OS encerradas, as preferências de e-mail, o anonimato no ranking e a troca de senha; os avisos (o sino), com o contador na aba; as ausências (pedir, acompanhar, confirmar, fim antecipado e retorno); a aba Pontos (pontuação com extrato, ranking de pessoas e de equipes, conquistas) com a janela "Parabéns!"; e a Vitória (botão flutuante, sugestões fixas, respostas locais, mensagem à `api`, figurinhas e "Me leve lá"). O aviso, o período da ausência e o histórico foram para `shared/api/` (a web importa de lá). **Validado sem aparelho:** `tsc` e ESLint do `mobile` e da `web`, 141 testes, o pacote do Metro, `expo-doctor` e `pnpm conferir:perfil` contra a `api` local. **Falta ver as telas rodando num aparelho ou emulador** (o desenho com o dedo e o PNG que ele gera, o WebP animado das figurinhas, o teclado do chat).

### 4. Modo offline: cópia da equipe e fila

- Cópia local da equipe por `POST /sync/pull`, com a escolha do modelo de cada OS e a orientação dos modelos.
- Fila de eventos e de arquivos em SQLite: toda ação de campo é gravada na fila e enviada em seguida (os arquivos antes dos eventos).
- Sincronização automática ao abrir o app e ao voltar o sinal, e o botão "Sincronizar".
- O snapshot nunca apaga do aparelho uma OS com evento local pendente.
- APR offline com `assinatura_presencial: true` no aparelho do responsável.
- **Feito em 19/10/2026** (parte das etapas 18 e 19 do plano; o registro está na seção 6 de [funcionalidades/mobile.md](funcionalidades/mobile.md) e o uso, no [README do mobile](mobile/README.md)). O banco SQLite do aparelho (`expo-sqlite`) guarda a cópia da equipe (`POST /sync/pull`) e a fila de eventos e de arquivos; **toda escrita de campo grava na fila antes de enviar** (com sinal, o envio é em seguida e a tela se comporta como antes; sem sinal, o registro fica guardado e a tela segue). As telas leem da cópia local quando não há sinal ou quando ainda há registro esperando, e uma projeção aplica as ações pendentes sobre a cópia (a OS vai a "em execução", a APR aparece "aguardando validação"…). A APR sem sinal é registrada como concluída, assinada pelos presentes no aparelho do responsável. A fila sobe em ordem (arquivos primeiro), o confirmado sai, o adiado espera sem travar as outras OS, o recusado fica guardado na lista "Registros recusados", e o snapshot nunca apaga uma OS com evento pendente. A sincronização roda ao abrir o app, quando o sinal volta, ao voltar para a frente, de minuto em minuto enquanto houver pendência e no botão "Sincronizar" do perfil. **Na `api`:** a decisão D1 (a execução feita sem sinal com uma APR que o servidor bloqueou é aplicada e vira alerta ao supervisor, em vez de se perder) e a equipe no snapshot. **Validado sem aparelho:** `tsc` e ESLint do `mobile` e da `web`, `tsc` da `api`, 191 testes do `mobile` (50 novos, num SQLite de verdade), os testes da `api`, `expo-doctor` e o pacote do Metro, e `pnpm conferir:offline` contra a `api` local (a leitura local igual à da `api`; a APR, a execução e o encerramento sem sinal; a subida ao voltar o sinal; o evento adiado; a APR bloqueada ao chegar; o recusado). **Falta ver num aparelho ou emulador** (o banco abrindo, a câmera sem sinal, o NetInfo mudando de estado no modo avião). **Não entrou (pendências 5 e 6):** abrir o app e entrar sem sinal, o "Sem conexão — N registros pendentes" no cabeçalho, o Sair recusado com fila e o envio com o app fechado.

### 5. Login sem sinal e aviso de pendentes

- Hash salgado da senha guardado no aparelho, válido por até 7 dias desde o último login online.
- "Sem conexão — N registros pendentes" e "Sincronizado hh:mm".
- Logout recusado enquanto houver fila.
- **Feito em 19/10/2026** (parte das etapas 18 e 19 do plano; o registro está na seção 6 de [funcionalidades/mobile.md](funcionalidades/mobile.md) e o uso, no [README do mobile](mobile/README.md)). **Login com sinal:** o app guarda no `expo-secure-store` o hash salgado da senha (PBKDF2-SHA256, 30 mil iterações, `@noble/hashes` em JavaScript puro, sem módulo nativo; nunca a senha) e, no SQLite, o último `GET /me`. **Sem sinal:** com a sessão aberta, o app abre pelo último `GET /me` guardado; sem sessão (depois do Sair), o login confere a senha com o hash e abre em "modo local" (sem token, pela cópia da equipe); quando o sinal volta, o app refaz o login sozinho com a senha digitada (só na memória) e a fila sobe. **A janela de 7 dias conta desde a última confirmação da conta pelo servidor** (um login ou um `GET /me` com sinal), não só desde o login: quem usa o app todo dia não deve perder o acesso sem sinal no 8º dia, e o limite existe para cercar o tempo que um desativado ainda abre o app. Passado isso, "Conecte-se para entrar". A senha trocada no app vale na hora; a trocada na web, só depois do próximo login com sinal; a conta que o servidor recusa (desativada, senha redefinida) é esquecida. **Aviso e Sair:** a faixa "Sem conexão — N registros pendentes" no alto de toda tela de campo e o "Sincronizado hh:mm" no indicador do cabeçalho; o Sair é recusado com registro na fila (a janela oferece "Sincronizar agora"). **Validado sem aparelho:** `tsc` e ESLint do `mobile`, 227 testes (36 novos), `expo-doctor` (20/20), o pacote Android do Metro (resolve o `@noble/hashes`) e `pnpm conferir:sem-sinal` contra a `api` local. **Falta ver num aparelho** (o tempo da derivação no Hermes não foi medido: no Node, 160 ms; a conta é assíncrona para a tela não congelar) **e a pendência 6** (envio com o app fechado).

### 6. Envio em segundo plano (item 18 da Reunião 3)

- Com o app aberto, a fila sai assim que o sinal volta.
- Com o app fechado, sai no próximo intervalo que o Android libera (por volta de 15 minutos).
- **Feito em 19/10/2026** (parte da etapa 19 do plano; o registro está na seção 6 de [funcionalidades/mobile.md](funcionalidades/mobile.md) e o uso, no [README do mobile](mobile/README.md)). A tarefa `synqos-envio-em-segundo-plano` (`expo-background-task`, que usa o WorkManager do Android) acorda o app **a cada 15 minutos, no mínimo, e só com rede ligada**, e sobe a fila com o app fechado: quem a roda é o mesmo sincronizador do app aberto (os arquivos antes dos eventos, o confirmado sai, o adiado espera), seguido da cópia nova da equipe. Como com o app fechado nada existe na memória, a tarefa descobre sozinha o que precisa: **há sessão** (os tokens no `expo-secure-store`; sem eles, nada a enviar) e **quem é a pessoa** (o último `GET /me` guardado no SQLite). Só roda para o técnico de equipe com registro na fila; com a fila vazia não gasta rede, e com o app na frente deixa a fila para a tela (não concorre com ela). O que não sobe (sem sinal, servidor fora do ar) fica na fila, e o Android repete no próximo intervalo; a tarefa é registrada quando a conta fica pronta, **uma vez só** (registrar de novo reinicia a contagem do intervalo) e retirada quando a pessoa sai. O perfil mostra **"Enviado com o app fechado às hh:mm (N registros)"** (ou "Tentativa com o app fechado…"), para o técnico e quem testa verem que a tarefa rodou. A tarefa precisa estar definida na abertura do bundle, por isso o app ganhou uma entrada própria, `mobile/index.ts` (a tarefa primeiro, depois o Expo Router). **Validado sem aparelho:** `tsc` e ESLint do `mobile`, 237 testes (10 novos, num SQLite de verdade, com o sincronizador de verdade), `expo-doctor` (20/20) e o pacote Android do Metro (com a tarefa dentro). **Falta ver num aparelho** (o Android de fato acordando o app fechado, o que depende também da economia de bateria do fabricante, que pode adiar ou barrar a tarefa; um aparelho com a otimização de bateria ligada pode passar de 15 minutos).

### 7. Dockerfile que gera o APK

- Exigido pela Decisão-chave 1 da especificação ("cada uma com Dockerfile") e pelo padrão do DesignDoc.
- **Feito em 19/10/2026** (parte da etapa 20 do plano; o registro está na seção 6 de [funcionalidades/mobile.md](funcionalidades/mobile.md) e o uso, na seção "Gerar o APK" do [README do mobile](mobile/README.md)). O `mobile/Dockerfile` (contexto na raiz do repositório) tem o JDK 17, o Android SDK e o NDK nas versões que o React Native pede, o `expo prebuild` e o Gradle, e entrega **um arquivo, `synq-os.apk`, assinado e conferido com o `apksigner`**, num estágio `saida` (`docker build --target saida --output type=local,dest=./apk`; `pnpm apk`, na pasta `mobile`, monta o comando). **O endereço da `api` é obrigatório e fica gravado no APK** (`--build-arg EXPO_PUBLIC_API_URL`); `http://` só com `APP_PERMITIR_HTTP=true`. **A chave de assinatura entra por segredo do BuildKit** (`--secret id=chave` e `id=chave_senha`), nunca no repositório nem na imagem; sem ela, o build usa uma chave descartável de demonstração (com aviso), e quem atualiza o app nos aparelhos precisa da **mesma chave** e de um `--versao` maior. Um plugin do Expo (`plugins/assinatura-android.js`) liga a chave ao Gradle. **Validado sem Docker (não há nesta máquina):** `tsc` e ESLint do `mobile`, 245 testes (8 novos), `pnpm apk --simular` e o `expo prebuild` real com o plugin (o `build.gradle` gerado conferido). **Falta rodar o `docker build` inteiro** (o download do SDK, o Gradle, o R8 do release e o `apksigner` não foram executados) **e instalar o APK num aparelho:** quem tiver Docker deve fazê-lo antes da demo, e ajustar o `Dockerfile` se algum passo falhar. **Fica para a etapa 20:** a conquista offline (pendência 8) e o roteiro da demo.

### 8. Conquista de sincronização offline

- A gamificação prevê a conquista, mas ela não existe na carga (`api/src/db/seed/gamificacao-dados.ts`). Precisa que o evento da fila seja reconhecido como vindo dela, o que a regra dos 60 s já faz na `api`.
- **Feito em 19/10/2026** (seção 14 de [gameficacao.md](base/funcionalidades/gameficacao.md); parte da etapa 20 de [mobile.md](funcionalidades/mobile.md)). Só na `api`; nenhuma tela mudou. A coluna `evento_campo.offline` (migração `0037_sincronizacao_offline`) guarda o que a `api` reconheceu como vindo da fila (atraso maior que 60 s), e o critério novo `sincronizacoes_offline` conta **OS distintas** com evento assim aplicado. A conquista "Sem sinal, sem problema" (1 OS) entra pela mesma migração, **com 0 ponto**: a regra 2.2 diz que sincronizar não pontua (o admin pode dar pontos a ela no cadastro); a migração também marca os eventos antigos e dá o troféu a quem já trabalhou sem sinal. A conferência roda ao aplicar cada evento da fila, e o aviso "Conquista desbloqueada" sai como o das demais. **Validado:** `tsc` e os 924 testes da `api` (5 novos, num Postgres embutido com as migrações) e `pnpm db:test`. **Falta ver no app:** o aparelho de verdade mandando a fila (o app já envia os eventos pelo mesmo `POST /eventos`, sem mudança). **A migração `0037` só chega ao banco compartilhado quando a `api` sobe com ela.**

## 3. Digitalização de OS antigas (extra)

A especificação deixa o escaneamento para depois do MVP, mas ele é prioridade no DesignDoc e foi redesenhado na Reunião 3 (item 15 do [resumo](base/reunioes/correcoes-reuniao-3-resumo.md)). O desenho anterior está na seção 10 do [vitoria.md](base/funcionalidades/vitoria.md#10-digitalização-de-os-antigas).

**Hoje (19/10/2026):** os itens 9 a 12 estão feitos (detalhes em [vitoria.md, seção 10](base/funcionalidades/vitoria.md#10-digitalização-de-os-antigas)): o PDF digitalizado em lote, a foto de folhas avulsas pela câmera e a APR em papel que vem junto com a OS. Em aberto da digitalização: o modelo de IA (testar com `pnpm pdf:digitalizado` e o Gemini) e a aprovação da empresa para enviar folhas ao fornecedor.

### 9. Pergunta antes da importação — feito em 19/10/2026

- Antes de abrir o seletor de arquivos, a tela pergunta se a OS **já foi concluída no papel** ou se é **para liberar no sistema**, com uma explicação curta de cada caminho.
- **Para liberar:** o PDF padrão, como hoje.
- **Feito:** a janela `PerguntaDaImportacao` abre ao clicar no cartão Importação ou ao soltar um arquivo sobre ele; só depois da escolha o seletor de arquivos abre (o de "papel" aceita só PDF). O PDF sem texto enviado pelo caminho "para liberar" é recusado com a mensagem que aponta para o caminho do papel.

### 10. PDF digitalizado em lote — feito em 19/10/2026

- O OCR local lê o que consegue; a IA de visão entra só nos recortes que o OCR não lê (a parte escrita à mão), já que a folha do SAP tem formato fixo.
- Assinaturas e rubricas ficam como imagem, sem transcrição.
- A OS entra **encerrada, como histórico**, e o admin confere o que foi lido antes de registrar (pode reaproveitar a conferência do PDF de hoje).
- O modelo de IA e os demais pontos em aberto da seção 10 do [vitoria.md](base/funcionalidades/vitoria.md#10-digitalização-de-os-antigas) precisam ser fechados antes; o primeiro passo é testar a leitura com folhas fictícias.
- **Descartado:** treinar um modelo próprio (LGPD e falta de folhas transcritas).
- **Feito:** tarefa em segundo plano `digitalizacao` (PDF → folhas → OCR Tesseract local → IA de visão só no manuscrito → conferências), leitura guardada, tela de conferência com as folhas ao lado e registro das OS como `encerrada` de histórico (`os.origem = digitalizacao`, `os_digitalizacao`, PDF das folhas). **Os itens 11 (foto de folhas avulsas) e 12 (APR antiga) vieram depois, no mesmo dia.** **Em aberto:** o modelo de IA (testar com `pnpm pdf:digitalizado` e o Gemini; o Claude segue como destino com dados reais) e a escolha do limite de folhas por OS enviadas à IA.

### 11. Foto de folhas avulsas — feito em 19/10/2026

- Continua para 1 ou 2 folhas avulsas, pelo mesmo caminho do lote.
- **Feito** (api e web; desenho em [vitoria.md, seção 10.0](base/funcionalidades/vitoria.md#10-digitalização-de-os-antigas)). A janela da câmera (`JanelaCamera`) fotografa **uma folha por vez** (até 8 por envio), ou escolhe imagens do aparelho; **mede a luz e a nitidez na hora** e avisa "foto escura", "luz demais" ou "pode estar tremida" (só aviso, nunca impede o envio); reordena, gira e remove as folhas; e manda ler. Cada foto é normalizada no navegador (orientação do EXIF, no máximo 2.800 px, JPEG). `POST /digitalizacoes` aceita agora o campo `fotos` (repetido, uma por folha) ao lado do `arquivo`: a `api` junta as fotos num PDF (uma página por foto, com a proporção da foto) e dali em diante o caminho é o mesmo do PDF escaneado (OCR, IA no manuscrito, conferência, registro encerrado). **Validado sem aparelho:** testes da `api` (as fotos viram PDF e são lidas; recusa de foto inválida, demais, vazia e do envio misturado), `tsc` e ESLint da `web`; a medida de luz e nitidez foi conferida só com imagens sintéticas. **Fica de fora:** detecção automática dos cantos e recorte com os 4 cantos arrastáveis (o OpenCV.js da seção 10.4); a captura automática quando a imagem estabiliza; e **falta ver num aparelho** (a câmera, o foco, o limite de nitidez em fotos de verdade: o valor `NITIDEZ_MINIMA` é inicial e precisa ser afinado).

### 12. APRs antigas — feito em 19/10/2026

- **Decisão:** a APR antiga **entra junto com a OS digitalizada** (a folha da APR vem grampeada na OS), mas **à parte da APR do sistema**: não vale como APR do dia, não ampara execução, não pontua e não bloqueia nada, porque o serviço já foi feito (decisões 1, 4 e 5 da seção 10.13 do vitoria.md). Quem não quer a APR estruturada desmarca "Registrar a APR com a OS" e as folhas ficam só nas imagens do PDF da OS.
- **Feito** (api e web; desenho em [vitoria.md, seção 10.0](base/funcionalidades/vitoria.md#10-digitalização-de-os-antigas)). O OCR acha as folhas da APR (o título "Análise Preliminar de Risco", mais as folhas sem número de OS que vêm logo depois) **antes** de ler as OS, para as etiquetas e o número escrito à mão da APR não se misturarem com o cabeçalho impresso; o código do modelo ("APR 04") sai do título impresso. A IA lê o cabeçalho (número da OS, data e hora, serviço), quem participou (nome, matrícula e função) e, com o modelo conhecido, a coluna marcada em cada item (duas chamadas por APR). **O número da OS escrito à mão diz de quem é a APR**; sem ele, vale a posição (a OS que vem antes no PDF). A conferência confere cada matrícula com as contas do sistema e com o registro de funcionários (nome e matrícula têm de formar um par), a data da APR com o início da execução e o código do título com o que a IA leu. Na tela de conferência há o bloco "APR em papel": modelo (select), data e hora, serviço, participantes, as respostas item a item e a caixa "Conferi a APR com as folhas"; a resposta que bloquearia uma APR nova aparece como aviso (só o admin vê isso). O registro grava em `os_digitalizacao_apr` (migração `0038`, com `usuario_id` de quem tem conta e `fonte` ia/manual/nenhuma) e a APR aparece no detalhe da OS, **só com as marcas, sem dizer o que é eliminatório**. Nova rota `GET /digitalizacoes/modelos-apr` (só o admin). `pnpm pdf:digitalizado` agora gera também uma folha de APR (APR 04) para a primeira OS, para experimentar com o Gemini. **Validado:** 940 testes da `api` (16 novos de fotos e APR, num Postgres embutido), `pnpm db:test`, `tsc` e ESLint da `api` e da `web`; o OCR de verdade achou a folha da APR do exemplo gerado. **Não foi testado com a IA de verdade** (nem com o manuscrito de uma pessoa): rodar `pnpm pdf:digitalizado` e subir o PDF com o Gemini antes da demo. **Fica de fora:** os riscos marcados "( )" no formulário (só as respostas dos itens são lidas), a versão do modelo pela data impressa (vale a mais recente publicada) e reatribuir a APR a outra OS na conferência. **A migração `0038` só chega ao banco compartilhado quando a `api` sobe com ela.**

## 4. Antes da apresentação

### 13. Validação nos demais formulários (item 16 da Reunião 3)

- Os formulários da Reunião 3 já usam React Hook Form com Zod ([correções da Reunião 3](base/funcionalidades/correcoes-da-reuniao-3.md), seção 6).
- Era a reclamação direta do Mario: os formulários da gestão desativavam o botão sem dizer por quê.
- **Feito em 19/10/2026** (seção 6 de [correcoes-da-reuniao-3.md](base/funcionalidades/correcoes-da-reuniao-3.md)). Usuários, equipes, modelos de APR, atividades, materiais, OS de apoio, reprogramação, devolver/cancelar/reservar a OS, ações da ausência, ciclo da preventiva, representante, patentes, conquistas, pontuação, simuladores (cadastro e lotes), login e troca de senha agora mostram o erro **em vermelho abaixo do campo**, levam o foco ao primeiro erro e deixam o botão ativo. Ficaram de fora, de propósito: os conversadores (Vitória e ajuste do treinamento), as conferências de importação e digitalização e as confirmações em massa do simulador. **Validado por código:** `tsc` e ESLint da `web` sem erros; **falta ver nas telas** (a ordem do foco, a mensagem dentro das tabelas editáveis e das janelas).

### 14. Bateria da Vitória

- `pnpm vitoria:bateria`, 53 casos (15 de provocação). A primeira rodada parou na cota diária do Gemini gratuito; falta rodá-la inteira e corrigir o que falhar ([vitoria.md](base/funcionalidades/vitoria.md), seção 2.9.1).

### 15. Documentação desatualizada

Lista completa na seção 7.2 do [funcionalidades.md](funcionalidades.md). Em resumo:

- **[README.md](README.md):** ainda fala em telas ilustrativas e em arquitetura "não implementada".
- **[Especificação](base/.design/especificacao.md):** a "Situação" diz que só a `web` tem código, o Campo de treino aparece "EM CONSTRUÇÃO" e a seção "Protótipo" lista diferenças que já não existem.
- **[api/README.md](api/README.md)** e **[web/README.md](web/README.md):** rotas, permissões, logins e telas desatualizados.
- **Comentário** em `api/src/rotas/sap.ts` sobre quem abre a OS de apoio.
- **Código sem uso na web:** a propriedade `aviso` do `Button` e um `return` inalcançável em `app/app/treino/estado/route.ts`.

**Feito em 20/10/2026.** O README da raiz e o DesignDoc descrevem o que está implementado nas três aplicações; a especificação ganhou a situação atual, o escopo com as extras feitas, o Campo de treino como pronto e a seção "Protótipo" com o que falta para um piloto; o README da `api` ganhou as rotas que faltavam (auditoria, `POST /auth/sair`, `GET /usuarios/{id}`, `GET /equipes/{id}`, pedido de conta, treinamentos, Vitória e controle da IA, pedidos da execução compartilhada), as permissões de cada situação da conta, as variáveis da IA e as correções do PDF e do simulador; o README da `web` ganhou os logins pelo e-mail, a web responsiva, as telas novas, os cinco dashboards, os redirecionamentos de verdade, a seção do Campo de treino e a estrutura e os estilos completos. O comentário de `api/src/rotas/sap.ts` foi corrigido, e saíram da web a propriedade `aviso` do `Button` e o `return` inalcançável. Os links para os arquivos que foram para [base/funcionalidades/](base/funcionalidades/) foram corrigidos nos documentos da raiz. O `tsc` da `api` e da `web` saiu sem erros.

## 5. Dependem de terceiros

| # | O quê | De quem | O que destrava |
|---|---|---|---|
| 16 | Servidor de e-mail (SMTP): endereço, porta, conta, remetente e SPF/DKIM | TI da empresa, pelo Iago (questão 68) | Os e-mails dos avisos e o resumo diário. O código está pronto: basta preencher `SMTP_URL`, `EMAIL_REMETENTE` e `PAINEL_URL` e conferir com `pnpm --dir api email:testar` |
| 17 | Assinatura com validade jurídica (ZapSign, token ou gov.br) | Conta e credenciais; o Iago diz se a desenhada vale (questão 38) | Assinatura aceita em auditoria. Hoje vale a desenhada no perfil |
| 18 | Login corporativo (conta Microsoft com segundo fator) | Acesso ao diretório da empresa | Uso real; hoje o registro de funcionários simulado garante que só funcionário tenha conta |
| 19 | Dados reais | Iago (planilha de 2025, ciclo no SAP, formulário de inspeção, PDF do SAP com texto), Mario e a Segurança do Trabalho (critério de bloqueio dos 8 modelos, questões 59 e 61), ES Gás (materiais por serviço, questão 65) e a empresa (aprovação para enviar dados ao fornecedor de IA) | O piloto. Para a demo, a carga fictícia basta |

## 6. Decisões em aberto

Detalhadas em [Questoes.md](Questoes.md).

| # | Questão | Impacto se a resposta for "sim" | Hoje |
|---|---|---|---|
| 20 | O supervisor pode devolver a OS ao responsável em vez de assinar? (69) | Funcionalidade nova: a OS volta ao encerramento, com regras próprias | O supervisor só assina |
| 21 | O que faz a equipe com só 1 pessoa disponível? (72) | Participante de outra equipe na APR | A APR é recusada (`participantes_insuficientes`) e a OS espera |
| 22 | O SYNQ OS preenche "Houve desvio?" e "Tempo parada"? (70) | Ajuste pequeno no PDF | Em branco, como no papel |
| 23 | O que fazer com mais de 3 executantes na folha? (71) | Ajuste pequeno no PDF | Os extras seguem em novas linhas de blocos |

## 7. Fora do MVP, por decisão

Não entram nesta lista (seção 7.4 do [funcionalidades.md](funcionalidades.md)): escrita no SAP por API, notificação push, iOS, terceiros no app, MFA e vínculo do aparelho com o usuário (RFC), estoque e baixa de material, escolha automática do modelo da APR, atraso na entrega da OS, cadastro de equipamentos como entidade, importação de OS pelo supervisor e o nível 4 da Vitória (a IA lendo as OS).

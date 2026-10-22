# Atualização do app — telas que vêm da web

> Plano de 22/10/2026. Leva para o app (`mobile`) quatro coisas que hoje só existem na web: o **pedido de conta**, o **quadro das OS com a busca de OS**, os **dashboards** (sem o mapa de calor) e o **Campo de treino**. O app vai para o PDA, e essas telas passam a estar nele. Nada foi implementado ainda.
>
> Ao concluir cada etapa, marque a caixa na tabela da seção 5 e registre na seção 8 o que mudou na implementação.

## 1. A dúvida do relatório da execução

**O relatório da execução é só do supervisor da equipe da OS e do admin.** O supervisor pode ser o titular ou o representante, quando este está no comando. Conferido em três lugares:

- **web:** a aba só aparece com `(admin || supervisaEquipeDaOs) && alguma execução terminada` ([web/src/app/app/(portal)/os/[id]/page.tsx](web/src/app/app/(portal)/os/[id]/page.tsx), linhas 162 a 164);
- **api:** `GET /os/{id}/relatorio-execucao` responde `403` a quem não supervisiona a equipe ([api/src/rotas/pdf.ts](api/src/rotas/pdf.ts), linhas 36 a 51; teste em `api/test/pdf.test.ts`);
- **documentação:** [operacao-de-campo.md, seção 8.1](docs/operacao-de-campo.md).

Pela regra combinada, **o relatório e a assinatura final do supervisor ficam só na web.**

O técnico não fica sem notícia. Quando o supervisor assina, quem executou e quem encerrou recebe o aviso `os_ciencia` (sino, e-mail e push), e o toque abre a OS no app, onde está o PDF. Os participantes da APR que não executaram nem encerraram não recebem esse aviso.

O PDF da OS (a APR e as folhas do SAP) não traz o conteúdo do relatório: tempos, pausas, localização, fotos, checklist, clima e conferência.

## 2. O que vem para o app e o que fica na web

| Vem para o app | Como fica no app | Origem na web |
|---|---|---|
| Pedido de conta | "Solicite" na tela de entrada e um formulário de uma tela | `web/src/app/app/entrar/solicitar/`, `FormularioSolicitarConta.tsx` |
| Quadro das OS | A aba OS vira o quadro: contagens no alto e uma coluna por status, uma por tela, deslizando para o lado | `web/src/components/web/quadro/` |
| Busca de OS | Uma tela de busca com filtros, aberta pela lupa do quadro | `web/src/components/busca/` (só a parte de OS) |
| Dashboards | Aba nova Dashboard: Meus resultados, OS (sem o mapa), APR e Equipes / Minha equipe | `web/src/components/web/indicadores/` |
| Campo de treino | Modo treino com dados fictícios no próprio aparelho, Direcionado e Livre. A conta que aguarda liberação treina no app | `web/src/components/treino/`, `web/src/treino/` |

**Continua só na web:**

- o relatório da execução e a assinatura final do supervisor (seção 1);
- o mapa de calor (seção 3);
- a busca de pessoas e de equipes, porque o app não tem as telas de perfil de outra pessoa nem a de equipe;
- os treinamentos de serviço (os jogos);
- as telas de gestão: reservar, devolver, reprogramar, OS de apoio, cancelar, painel de alertas, responder ausências dos outros e dar a emergência por atendida;
- os cadastros e o perfil admin inteiro. O admin continua indo para "A gestão fica na web".

**Nada disso pede biblioteca nativa nova.** Os gráficos se desenham com `View` e `react-native-svg` (já instalado), e as colunas deslizam com a `FlatList` horizontal. Por isso tudo chega aos aparelhos pelo `pnpm atualizar` (EAS Update), sem APK novo, enquanto a versão continuar 0.2.0. Se alguma etapa precisar de biblioteca nativa, ela para e pergunta antes.

## 3. Mapa de calor: por que fica de fora

Na web, o mapa usa Leaflet e desenha a "radiação" num canvas do navegador. No PDA, as três saídas têm problema:

| Saída | Problema |
|---|---|
| `react-native-maps` | Exige chave paga do Google Maps e os serviços do Google, que PDAs industriais costumam não ter (questão 41). É o caso de "vai bugar" |
| Leaflet dentro de um WebView | Biblioteca nativa nova (APK novo); depende da versão do WebView do aparelho e de internet para baixar o mapa |
| Desenhar os pontos sem mapa | Funciona, mas pontos sem ruas dizem pouco |

**No lugar do mapa:** a lista "Áreas com mais OS", do mesmo `GET /os/mapa-calor`. Cada área tem "Abrir no mapa", que abre o mapa do aparelho como o detalhe da OS já faz.

## 4. Decisões a confirmar antes de começar

No plano anterior do app, as decisões D1 a D6 valeram sem que ninguém respondesse. **Desta vez, a etapa que depende de uma decisão sem resposta não começa.**

| # | Decisão | Recomendação | Etapas |
|---|---|---|---|
| A1 | Navegação | A aba OS vira o quadro e entra a aba Dashboard. Ficam 5 abas: OS, Dashboard, Avisos, Pontos e Perfil | 3, 5 |
| A2 | Quadro na tela pequena | Uma coluna por vez, deslizando para o lado, com as contagens no alto; tocar num número leva à coluna. Abaixo de 768 px, a web já mostra uma coluna por vez | 3 |
| A3 | Atualização automática | Quadro e dashboards se atualizam ao voltar à tela e a cada 60 s com sinal (a web usa 30 s). Puxar para atualizar continua | 3, 5 |
| A4 | Dashboards sem sinal | Só com sinal. Sem sinal, o aviso "Os indicadores precisam de conexão", sem nada guardado no aparelho | 5, 6 |
| A5 | Onde rodam os dados fictícios do treino | No aparelho. A API fictícia da web vai para `shared/`, e o app a usa por um cliente com outro `fetch`. Assim o treino funciona sem sinal, a `api` não muda e a web continua igual. A alternativa seria levar a API fictícia para a `api`, o que mexe na web e exige sinal | 7, 8 |
| A6 | Treino e modo offline | O treino usa um cliente próprio e nunca passa pela fila, pela cópia nem pelo `lerDeOndeDer`. A sincronização dos registros reais continua por baixo | 8 |
| A7 | Progresso do treino | Como na web: fica em memória, e fechar o app recomeça o treino. Guardar o progresso no aparelho fica para depois | 8, 9 |
| A8 | Conta aguardando liberação | No app, ela abre as telas de campo só dentro do treino, com dados fictícios | 8, 10 |
| A9 | Concluir o treino sem sinal | O app guarda a conclusão e manda `PUT /me/treinamento` quando o sinal voltar. Os 10 pontos e a conquista chegam nessa hora | 10 |
| A10 | Abuso do pedido de conta | Manter o limite atual (30 pedidos por hora no total, sem limite por IP nem captcha) e registrar no [Pendencias.md](Pendencias.md). Com o app, o pedido sai do aparelho direto para a `api` | 1 |

## 5. As etapas, num relance

Tamanho relativo: P (pequena), M (média), G (grande).

| # | Etapa | Bloco | Tamanho | Depende de | Feita |
|---|---|---|---|---|---|
| 1 | Pedido de conta | Entrada | P | A10 | [ ] |
| 2 | Regras do quadro em `shared/` e leitura sem sinal com filtros | Quadro | M | — | [ ] |
| 3 | Quadro das OS | Quadro | G | 2; A1, A2, A3 | [ ] |
| 4 | Busca de OS | Quadro | M | 2 | [ ] |
| 5 | Dashboards: base e Meus resultados | Dashboards | M | A1, A3, A4 | [ ] |
| 6 | Dashboards: OS, APR e Equipes | Dashboards | M | 3, 5 | [ ] |
| 7 | API fictícia do treino em `shared/` | Treino | M | 5; A5 | [ ] |
| 8 | Modo treino no app (Livre) | Treino | G | 7; A6, A7, A8 | [ ] |
| 9 | Tutorial Direcionado | Treino | G | 8 | [ ] |
| 10 | Boas-vindas, tela de espera e conclusão | Treino | P | 8; A9 | [ ] |
| 11 | Documentação e entrega | Entrega | P | todas | [ ] |

**Por que nesta ordem:** primeiro o que é rápido (pedido de conta), depois o que se usa todo dia no campo (quadro e busca), depois os dashboards, e por último o treino, que é o maior e o mais arriscado. **Se faltar tempo, corta-se do fim.** O treino pode parar na etapa 8 (modo Livre, sem o tutorial), que já serve à conta que aguarda liberação.

**Marcos:**

- **Fim da etapa 4:** o PDA tem o quadro e a busca de OS.
- **Fim da etapa 6:** os dashboards estão no app.
- **Fim da etapa 8:** o treino Livre está no app.
- **Fim da etapa 10:** o treino está completo, com o tutorial e os pontos.

## 6. Regras que valem para todas as etapas

- **Pronta sempre inclui:**
  - `pnpm typecheck`, `pnpm lint` e `pnpm test` do `mobile` sem erros;
  - se a etapa mexer em `shared/`, também o `tsc` e o ESLint da web e da `api`, e os testes da `api`.
- **Sem navegador nem aparelho.** O que precisar ser visto vai para o roteiro de conferência no aparelho (item 1 do [Pendencias.md](Pendencias.md)).
- **Os `conferir:*` rodam só contra a `api` local em memória** (`cd api && PORT=3399 pnpm dev:local`), nunca contra o Supabase.
- **O app continua cliente.** As regras ficam na `api`; o que a web e o app repetem vai para `shared/`, e cada um mantém as próprias telas.
- **"Me leve lá" da Vitória:** quando uma tela chega ao app, o destino da Vitória que hoje abre a web para ela passa a abrir a tela do app ([mobile/src/vitoria/telas.ts](mobile/src/vitoria/telas.ts)).
- **Formulários com `useFormulario` (React Hook Form + Zod)**, nunca desativados por campo faltando, como o resto do app.

## 7. Etapas

### Bloco 1 — Entrada

#### Etapa 1. Pedido de conta

**O que é:** o "Solicite" da tela de entrada da web, no app.

**O que deve ter:**

- **Na tela de entrada** ([mobile/src/app/entrar.tsx](mobile/src/app/entrar.tsx)), abaixo do botão Entrar: "Ainda não tem uma conta? Solicite" e "Esqueceu a senha? Procure o administrador.", como na web.
- **Rota nova** `solicitar`, dentro do `Stack.Protected` da fase `sem-sessao` ([mobile/src/app/_layout.tsx](mobile/src/app/_layout.tsx)).
- **Formulário:**
  - nome (até 120 caracteres);
  - e-mail institucional (até 200, em minúsculas);
  - equipe opcional, numa janela de escolha com busca (`Janela` + `Opcao`). A primeira opção é "Não sei ou prefiro não informar", com a dica "Com a equipe, o supervisor dela também recebe o pedido.".
- **Código comum:** `shared/api/solicitacao-conta.ts` com os tipos e os limites. A web e a `api` passam a usá-lo, sem mudar o comportamento.
- **Respostas:**
  - sempre neutra: "Pedido enviado", sem revelar se o e-mail já tem conta;
  - o `429` vira "Muitos pedidos agora; tente mais tarde";
  - o `422` aparece sem o nome do campo na frente.
- **Só com sinal:** o pedido não entra na fila. Sem sinal, aparece "Precisa de conexão para enviar o pedido".

**Rotas da `api`:** `GET /solicitacoes-conta/equipes` e `POST /solicitacoes-conta`, ambas públicas (o cliente chama com `semAutenticacao`).

**Pronta quando:** há testes de unidade do formulário e da chamada, e o `pnpm conferir:api` ganha o pedido: envia, repete o mesmo e-mail e recebe a mesma resposta neutra.

### Bloco 2 — Quadro e busca

#### Etapa 2. Regras do quadro em `shared/` e leitura sem sinal com filtros

**O que é:** o preparo do quadro e da busca. Sai da web o que o app vai repetir, e as regras que hoje existem em três versões viram uma só. A cópia local passa a aceitar os filtros.

**O que deve ter:**

- **Em `shared/api/`:**
  - `OsResumo` ganha `numero_nota`, `local_instalacao.cliente`, `ciencia_em` e `equipe_nome`, que a `api` já devolve;
  - `STATUS_DO_QUADRO`, `STATUS_DAS_ASSINATURAS`, a aparência de cada status, os textos das contagens, `mesesDoSeletor`, `rotuloDoMes` e a leitura dos filtros.
  - O `web/src/data/quadro.ts` continua `server-only` e passa a importar de `shared/`.
- **Uma versão só, no que for JavaScript** (o SQL da `api` fica como está):
  - tirar acentos: hoje há três versões, em `api/src/dominio/busca.ts`, `web/src/lib/destacar.tsx` e `mobile/src/offline/leitura.ts`;
  - peso da prioridade;
  - "atrasada";
  - ordem do quadro;
  - limite de 12 h da execução aberta.
- **Tom do status `encerrando`:** a web usa "exe" e `shared/` usa "al". Fica um só.
- **`leitura.lista` da cópia** ([mobile/src/offline/leitura.ts](mobile/src/offline/leitura.ts)):
  - aceita tipo, criticidade, período e a ordem por data limite;
  - devolve `numero_nota`, `cliente` e `ciencia_em`;
  - monta todas as colunas numa passada só, em vez de reler a cópia por coluna.

**Rotas da `api`:** nenhuma nova.

**Pronta quando:**

- a web e a `api` compilam e passam nos testes sem mudar o comportamento;
- os testes do app comparam a leitura local com a da `api` para os mesmos filtros, como o `conferir:offline` já faz com a lista.

#### Etapa 3. Quadro das OS

**O que é:** a aba OS deixa de ser uma lista por status e vira o quadro da web, no formato da tela pequena (A1 e A2). O quadro da web só mostra; ele não tem arrastar nem ação no cartão, e o app segue igual.

**O que deve ter:**

- **No alto:**
  - as faixas de hoje: ausência, APR para assinar, assinaturas pendentes, execução aberta e previsão do tempo;
  - a faixa de conferências, que o app já consulta mas a lista não mostra.
- **Contagens:** Liberadas, Pendentes, Em execução, Aguardando assinaturas e Encerradas. Tocar numa delas leva à coluna.
- **Colunas** Liberada, Pendente, Em execução, Aguardando assinaturas e Encerrada:
  - "Aguardando assinaturas" junta `aguardando_supervisor` (primeiro) e `encerrando`, como na web;
  - uma coluna por tela, deslizando (`FlatList` horizontal, paginada);
  - 8 cartões por coluna e "Ver todas · mais N", que abre a lista de um status só (a lista de hoje, com rolagem infinita).
- **Canceladas e devolvidas:** links "Ver canceladas" e "Ver devolvidas", com a contagem.
- **Filtros, atrás do botão "Filtrar":**
  - tipo, criticidade, período (o mês do início programado) e ordem (prioridade ou data limite);
  - equipe só para quem supervisiona mais de uma.
- **Cartão:**
  - com o nome da equipe;
  - para o supervisor, nas encerradas: "Assinada pelo supervisor em dd/mm" ou "Concluída", e "PDF pronto" ou "PDF pendente".
- **"OS preventivas"** para quem supervisiona (`GET /preventivas`, só com sinal).
- **Carga leve:**
  - as contagens vêm na primeira chamada;
  - cada coluna busca os seus 8 cartões quando aparece, e não as seis de uma vez como na web;
  - atualização automática pela A3.
- **Sem sinal:**
  - o quadro sai da cópia (só a equipe da própria pessoa), com "Cópia de hh:mm" no alto;
  - o que a cópia não tem (outras equipes do supervisor, canceladas, devolvidas e encerradas por colegas) aparece como "indisponível sem sinal".

**Rotas da `api`:** `GET /os` (`status`, `tipo`, `critica`, `periodo`, `ordem`, `equipe_id`, `tamanho=8`), `GET /me/conferencias` e `GET /preventivas`.

**Pronta quando:**

- há testes das regras: colunas, divisão dos 8 cartões na coluna das assinaturas e filtros;
- o novo `pnpm conferir:quadro` compara as colunas do app com o `GET /os`, para técnico e supervisor, com e sem sinal.

#### Etapa 4. Busca de OS

**O que é:** a parte de OS da busca geral da web, numa tela só, aberta pela lupa no alto do quadro. A busca de pessoas e de equipes fica na web.

**O que deve ter:**

- **Campo de busca:**
  - espera 350 ms parado antes de buscar;
  - procura no número da ordem, título, local, nota e cliente;
  - o texto de ajuda diz isso (hoje diz só "número da ordem ou título").
- **Filtros:** situação (com a contagem de cada uma), tipo e "só locais críticos".
- **Resultados:** de 10 em 10, com o termo destacado.
- **Número de ordem exato:** abre direto o detalhe (`GET /os?numero_ordem=…&tamanho=2`, como no quadro da web).
- **Sem sinal:** busca na cópia, com o aviso de que só a equipe da pessoa está nela.

**Rotas da `api`:** `GET /os` (`busca`, `status`, `tipo`, `critica`, `pagina`, `tamanho=10`, `numero_ordem`).

**Pronta quando:**

- há testes do destaque e do atalho do número exato;
- o `conferir:quadro` ganha a busca, com e sem sinal.

### Bloco 3 — Dashboards

#### Etapa 5. Dashboards: base e Meus resultados

**O que é:** a aba Dashboard e as peças de desenho que as quatro telas usam.

**O que deve ter:**

- **Código comum em `shared/api/`:**
  - os tipos das respostas, que hoje estão em `web/src/data/dashboards.ts`, `data/indicadores.ts` e `data/modelos.ts` (a etapa 7 também precisa deles);
  - as partes puras do filtro de período: `7d`, `30d`, `90d`, `12m` e `AAAA-MM`.
- **Peças de desenho em `View`:**
  - número com comparação, colunas, trilho, barras empilhadas e medidor;
  - a web desenha com HTML e CSS, sem biblioteca, então a tradução é direta;
  - a dica que na web aparece ao passar o mouse vira toque;
  - as cores vêm de `web/src/components/web/indicadores/cores.ts`.
- **Aba Dashboard (A1),** com as telas pela regra de `abasDoDashboard`: Meus resultados para técnico e supervisor, e Equipes chamada de "Minha equipe" para o técnico.
- **Meus resultados:**
  - os 4 números do alto;
  - encerradas por tipo, tempo de execução e APRs aprovadas;
  - pausas por motivo e OS com mais pausa;
  - interrupções e os 6 locais com mais OS.
- **Funcionamento:** seletor de período, atualização pela A3 e, sem sinal, o aviso da A4.

**Rotas da `api`:** `GET /indicadores/meus?periodo=`.

**Pronta quando:**

- há testes das peças de desenho (proporções e valores zerados) e do filtro;
- um `conferir` lê `/indicadores/meus` para técnico e supervisor.

#### Etapa 6. Dashboards: OS, APR e Equipes

**O que é:** as outras três telas do Dashboard, só com o que técnico e supervisor veem. O que é do admin (entrada de OS, baixa no SAP, "Por que bloqueia" e o cadastro) não entra.

**O que deve ter:**

- **OS:**
  - "Precisa de atenção": OS pendentes, preventivas atrasadas sem justificativa e execuções abertas há mais de 12 h; para o supervisor, também as OS que aguardam a assinatura dele e os alertas não lidos;
  - preventivas: o ciclo e as programadas;
  - resultados: encerradas, tempo e interrupções;
  - "Áreas com mais OS" no lugar do mapa (seção 3).
- **Para onde leva cada item de "Precisa de atenção":** ao quadro filtrado, às preventivas, a Validações (que abre a web para assinar) ou à aba Avisos.
- **APR:** respondidas e bloqueadas, colunas e "Onde bloqueia" por modelo e por equipe. Ficam sem os links da web, porque o app não tem as telas de modelo nem de equipe.
- **Equipes / Minha equipe:**
  - os números do alto, as preventivas por equipe, o tempo por equipe e a tabela;
  - para o supervisor, também o tempo por técnico e a tabela dos técnicos;
  - as tabelas viram cartões, um por linha, para caber na tela.

**Rotas da `api`:** `GET /indicadores/os`, `GET /os/mapa-calor` (só a lista de áreas), `GET /preventivas`, `GET /alertas?lido=false&tamanho=1`, `GET /aprs/resumo` e `GET /indicadores/equipes`.

**Pronta quando:**

- o `conferir` mostra os mesmos números da `api` para técnico e supervisor;
- nada do que é só do admin aparece.

### Bloco 4 — Campo de treino

Na web, o Campo de treino roda as próprias telas de campo sobre uma API fictícia guardada no servidor do Next, e um tutorial guia a pessoa por elas. O app não alcança essa API fictícia: ele fala direto com a `api`, e o tutorial da web depende do DOM. Por isso o bloco tem quatro etapas: mover a API fictícia, ligar o modo treino, refazer o tutorial e fechar o ciclo da conta.

#### Etapa 7. API fictícia do treino em `shared/`

**O que é:** a API fictícia e a massa de dados do treino passam a morar em `shared/`, para a web e o app usarem a mesma (A5). Hoje elas ficam em `web/src/treino/`, com cerca de 3.760 linhas de TypeScript sem DOM.

**O que deve ter:**

- **`shared/treino/`** com a API fictícia, os dados, os indicadores, os ids, o catálogo, a recomendação e os motivos.
- **Armazém criado por cada lado:** hoje ele fica no `globalThis` do servidor Next, com até 500 pessoas. A web continua guardando no servidor; o app guarda em memória.
- **Tipos:** os que só existiam na web (dashboards e modelos) já estão em `shared/` desde a etapa 5.
- **Sem `TextDecoder("latin1")`:** a checagem do `%PDF-` passa a comparar os bytes direto, porque o Hermes não garante o `latin1`.
- **Resposta vazia em vez de `404`** nas rotas que o app chama e a API fictícia não tem: `/me/apr-convites`, `/me/conferencias`, `/me/pedidos-abertos`, `/me/dispositivos`, `/me/validacoes`, `/clima`, `/os/{id}/preventiva`, `/os/{id}/apr-convites`, `/alertas`, `/assinaturas-juridicas`, `/ausencias` e `/sugestoes-materiais`.
- **Arquivos:** aceitar o envio do app (`{uri, name, type}`) além do `arrayBuffer` da web.

**Rotas da `api` real:** nenhuma.

**Pronta quando:**

- a web roda o treino igual: o `web/scripts/verificar-treino.mts` passa, e o `tsc` e o ESLint da web também;
- um teste do app chama a API fictícia pelo cliente do app e percorre APR → execução → encerramento.

#### Etapa 8. Modo treino no app (Livre)

**O que é:** o app entra e sai do treino. Dentro dele aparecem as telas de campo de sempre, com dados fictícios.

**O que deve ter:**

- **Provedor de treino:** troca o cliente das telas por um cujo `fetch` vai à API fictícia. O [mobile/src/api/cliente.ts](mobile/src/api/cliente.ts) já aceita um `fetch` injetado.
- **Isolamento (A6):**
  - no treino, nenhuma escrita vai para a fila real e nenhuma leitura sai da cópia;
  - o `enviarEvento` e o `lerDeOndeDer` são desviados;
  - a sincronização real continua por baixo, com o cliente real;
  - a Vitória continua real, como na web.
- **Entrada:** Perfil › Campo de treino, com a escolha entre Direcionado e Livre. Não aparece para o ausente.
- **Faixa e selo:**
  - faixa fixa "Campo de treino · dados fictícios", com "Recomeçar" e "Sair do treino", e o selo TREINO;
  - dentro do treino, a faixa de registros pendentes e o indicador de conexão ficam escondidos, para não misturar o real com o fictício.
- **Modo Livre:** o botão "Roteiro", com a lista do que experimentar.
- **Conta que aguarda liberação (A8):** o `Stack.Protected` abre as telas de campo para ela só dentro do treino.
- **Progresso** em memória (A7).

**Pronta quando:**

- um teste com o SQLite de verdade (`node:sqlite`) prova que um treino inteiro não grava nada na fila nem na cópia;
- há teste da troca de cliente;
- a conta pendente entra no treino e não chama nenhuma rota real além de `/me`, `/me/treinamento` e `/vitoria/*`.

#### Etapa 9. Tutorial Direcionado

**O que é:** o roteiro de 31 passos em 7 blocos, refeito em React Native. O da web procura os alvos no DOM (`data-treino`, `querySelector` e `MutationObserver`), então só a lista de passos é reaproveitada.

**O que deve ter:**

- **Alvos:** registrados por chave com `ref` e medidos com `measureInWindow`, por um gancho como `useAlvoDoTreino("chave")`.
- **Cortina e balão:**
  - a cortina tem um recorte em volta do alvo, desenhado com `react-native-svg`;
  - o balão fica acima ou abaixo do alvo, ou numa folha no rodapé quando não cabe.
- **Avanço:**
  - a tela avisa quando a tarefa foi feita, por exemplo com `avisarTreino("apr-concluida")`, em vez de a cortina observar a página;
  - fora da rota do passo, o tutorial pausa e oferece "Retomar tutorial".
- **Passos:**
  - a estrutura (blocos, rota, alvo e como avança) vai para `shared/treino/passos.ts`;
  - os textos do app ficam à parte, porque os da web citam coisas que o app não tem ("o menu do seu nome, no topo", "a grade", "o navegador pode pedir permissão").
- **Rotas do app:** quadro, `os/[id]`, `apr`, `checklist`, `aprovada`, `execucao`, `perfil` e `bloqueio`.
- **Acessibilidade:** o leitor de tela anuncia o balão, e há "Pular passo" quando o alvo não aparece.

**Pronta quando:**

- há teste das regras do roteiro (avanço, pausa e retomada), sem React Native;
- um teste lista as chaves dos 31 passos e confirma que cada uma está registrada nas telas do app.

#### Etapa 10. Boas-vindas, tela de espera e conclusão

**O que é:** o que liga o treino à conta: o convite no primeiro acesso, a tela de quem aguarda liberação e os pontos de quem conclui.

**O que deve ter:**

- **Primeiro acesso** do técnico com o treinamento `nao_iniciado`: a janela "Bem-vindo ao Campo de Treino!", com estas opções:
  - Direcionado;
  - Livre;
  - "Fazer depois", que vale até sair do app;
  - "Pular treinamento", que manda `PUT /me/treinamento` com `pulado`.
- **Tela de espera** ([mobile/src/app/aguardando.tsx](mobile/src/app/aguardando.tsx)):
  - o botão "Ir para o Campo de treino" (ou "Continuar no Campo de treino") no lugar do aviso "faça pela web";
  - a verificação da liberação a cada 30 s, como na web.
- **Fim do Direcionado:**
  - "Parabéns!" e `PUT /me/treinamento` com `concluido`;
  - os pontos ganhos (+10 e a conquista "Pronto para o campo"), com `textoDosPontosGanhos`;
  - sem sinal, o app guarda e manda depois (A9);
  - para a conta pendente, o botão final é "Ver situação do meu acesso".

**Rotas da `api`:** `GET /me` (`usuario.treinamento`) e `PUT /me/treinamento`.

**Pronta quando:** o `conferir:perfil` ganha a conclusão do treino e confere que os pontos entram uma vez só.

### Bloco 5 — Entrega

#### Etapa 11. Documentação e entrega

**O que deve ter:**

- **[mobile/README.md](mobile/README.md):**
  - "O que o app faz" e "Fica na web";
  - D2 passa a valer só para as telas de gestão;
  - D3: a conta pendente treina no app;
  - D4: os jogos seguem na web;
  - as rotas e a organização do código.
- **Documentos de área:**
  - [operacao-de-campo.md](docs/operacao-de-campo.md): seção 12.1 (quadro) e seções 12.3 a 12.5 (dashboards e o "Só na web" do mapa);
  - na seção 12.3, também a divergência que já existe: ela lista na aba OS coisas que a tela não mostra;
  - [pessoas-e-equipes.md](docs/pessoas-e-equipes.md): seções 1.4 e 2.2 ("O app não tem o pedido") e 2.5 (onde ficam os dados fictícios);
  - [ia-e-vitoria.md](docs/ia-e-vitoria.md) no trecho do treino, o README da raiz e o `web/README.md`.
- **[Pendencias.md](Pendencias.md):**
  - a questão 55 (telas de gestão no app) com o que mudou;
  - o limite do pedido de conta (A10);
  - os achados da seção 9.
- **Publicação:** `pnpm atualizar --message "..."`, sem APK novo. Se alguma etapa tiver trazido biblioteca nativa, sobe-se a versão e gera-se o APK (`pnpm apk`).
- **Roteiro de conferência no aparelho:** o quadro, a busca, os dashboards e o treino entram no item 1 do [Pendencias.md](Pendencias.md).

## 8. O que mudou na implementação

(Preencher ao concluir cada etapa.)

## 9. Achados do levantamento, fora deste plano

- **O relatório é restrito só na tela e no PDF, não nos dados.** O `GET /os/{id}` devolve as execuções com localização, pausas, fotos e descrição a qualquer pessoa que vê a OS. A aba do relatório e o PDF dele são restritos, mas os dados brutos não. Falta decidir se isso é aceitável.
- **O `GET /equipes` sem `busca` nem `global` devolve todas as equipes a qualquer perfil** ([api/src/rotas/equipes.ts](api/src/rotas/equipes.ts), linhas 163 a 166).
- **O aviso `conta_solicitada` não tem push**, e no app o toque nele não leva a lugar nenhum, porque o cadastro é feito na web.

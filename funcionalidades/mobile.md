# App Android (`mobile`) — plano de implementação em 20 etapas [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 | [x] 19/10/2026 |

> Plano de 18/10/2026 para os itens 1 a 8 do [pendencias.md](../pendencias.md): o app Android, o modo offline e o Dockerfile que gera o APK. É o que falta para o critério de sucesso da [especificação](../base/.design/especificacao.md#sucesso) fechar: o caminho **ler OS → APR → executar → PDF** no app Android, online, e num Android em modo avião, chegando ao painel quando o sinal volta.
>
> Ao concluir cada etapa, marque a caixa na tabela abaixo e registre nela o que mudou na implementação (seção 6), como nos demais arquivos desta pasta.

## 1. Ponto de partida

**O app é um cliente.** As regras de negócio já estão na `api` e são as mesmas para a web e o app: quem pode o quê, o resultado da APR, o status da OS, a pontuação e os avisos. O app mostra, coleta e envia; ele não decide.

**O que a `api` já oferece ao app** (conferido no código em 18/10/2026):

- autenticação por `Authorization: Bearer`, com `POST /auth/login`, `/auth/refresh`, `/auth/trocar-senha` e `/auth/sair`;
- o canal único de escrita de campo, `POST /eventos`, idempotente pelo `id` gerado no cliente;
- o snapshot da equipe, `POST /sync/pull`, com a escolha do modelo de cada OS e a orientação dos modelos;
- o tratamento da fila offline: o evento que chega com mais de 60 s de atraso é tratado como vindo da fila (`ctx.offline`), o que relaxa recusas que não fazem sentido sem sinal e transforma conflito em alerta;
- o `execucao_iniciada` que chega antes da assinatura de outro aparelho fica pendente em vez de recusado;
- a assinatura presencial da APR (`assinatura_presencial: true`);
- o aviso de relógio errado do aparelho no detalhe da OS;
- o envio de arquivos (`PUT /arquivos/{id}`) antes do evento que os referencia.

**A referência das telas é a `web`** em `/app/*` (`web/src/app/app/(portal)/` e `web/src/components/app/`). O app reproduz o fluxo, não o layout: as telas são pensadas para o celular, uma ação por tela.

**As regras herdadas da Reunião 3** estão no [README do mobile](../mobile/README.md) e nas [correções da Reunião 3](correcoes-da-reuniao-3.md): assinatura da APR por participante, motivo obrigatório na pausa e na suspensão, localização nos cinco momentos, encerramento em dois passos e envio em segundo plano.

## 2. Decisões de stack

| Assunto | Escolha | Por quê |
|---|---|---|
| Base | React Native com **Expo**, TypeScript | Decisão-chave 1 da especificação; o Expo traz câmera, SQLite, armazenamento seguro, localização e a geração local do APK |
| Rotas | Expo Router | Rotas por arquivo, como o `app/` do Next na web |
| Build de desenvolvimento | *development build* (não o Expo Go) | O SQLite, o envio em segundo plano e a câmera nativa precisam do build próprio |
| Formulários | React Hook Form com Zod | O mesmo padrão da web desde a Reunião 3 (item 16) |
| Estado do servidor | TanStack Query | Cache, recarga e "puxar para atualizar" sem código próprio; troca a fonte para o SQLite no offline |
| Banco local | `expo-sqlite` | Especificação, Decisão-chave 1 |
| Segredos | `expo-secure-store` | Tokens e o hash da senha do login sem sinal |
| Câmera e arquivos | `expo-image-picker` ou `expo-camera`, `expo-image-manipulator` e `expo-document-picker` | Foto comprimida (questão 16) e PDF da evidência |
| Localização | `expo-location` | Os cinco momentos da Reunião 3 |
| Conexão | `@react-native-community/netinfo` | O indicador "Online" e o gatilho da sincronização |
| Segundo plano | `expo-background-task` | Envio da fila com o app fechado (item 18 da Reunião 3) |
| Assinatura | componente de desenho (por exemplo, `react-native-signature-canvas`) | O desenho vira PNG e sobe como arquivo, como na web |
| Identificadores | UUID v4 gerado no aparelho | Decisão-chave 3: todo registro de campo nasce com ID do cliente |

As versões são fixadas na etapa 2, sempre a estável mais recente do SDK do Expo, e não mudam até a demo.

## 3. Decisões a tomar antes de começar

Estas perguntas mudam etapas do plano. A recomendação vale até alguém decidir outra coisa.

**Em 19/10/2026, ao começar a pendência 1, D1 a D6 seguiram a recomendação** (ninguém decidiu outra coisa). A única mudança de código que dependia delas, o ajuste da `api` para a D1, foi feita em 19/10/2026, junto com a fila (pendência 4).

| # | Pergunta | Recomendação | Afeta |
|---|---|---|---|
| D1 | **APR sem sinal:** sem sinal, o aparelho não consegue validar a APR (só o servidor sabe o que é eliminatório). Hoje, se a APR offline chegar bloqueada, a `api` recusa o `execucao_iniciada` (`apr_invalida`) e a execução feita sem sinal se perde, o que contraria a Decisão-chave 2 ("a sincronização nunca descarta dado de campo"). | Sem sinal, a APR fica "aguardando validação" e a execução segue (é contingência); na chegada, a `api` aceita a execução e gera um alerta de segurança ao supervisor ("executada com APR que bloquearia"). Exige uma mudança pequena na `api`, com teste, antes da etapa 19 | 12, 18, 19 |
| D2 | **Telas de gestão no app** (questão 55): reservar e devolver OS, a assinatura final do supervisor, o relatório da execução, o quadro e os indicadores | Fora do app nesta versão; o supervisor usa a web, que funciona no navegador do celular. O app mostra a reserva e a devolução, mas não as faz | 9, 16 |
| D3 | **Técnico aguardando liberação:** ele faz o Campo de treino até o admin liberar | O app mostra "Seu acesso aguarda a liberação; faça o Campo de treino pela web" e não abre as telas de campo | 5 |
| D4 | **Treinamentos de serviço** (os jogos) no app | Fora desta versão; continuam na web | 17 |
| D5 | **Aparelho compartilhado ou por pessoa** (RFC da especificação) | Por pessoa: um usuário por aparelho no login sem sinal. Um login online de outra pessoa apaga a cópia local da anterior, se a fila estiver vazia | 18 |
| D6 | **Distribuição do APK na demo** | APK assinado, instalado à mão nos aparelhos da demo; sem loja | 20 |

## 4. As 20 etapas, num relance

| # | Etapa | Fase | Item do pendencias | Situação |
|---|---|---|---|---|
| 1 | Preparação: decisões D1 a D6 e ajuste da `api` para a D1 | Fundação | 1 | [x] 19/10/2026 |
| 2 | Esqueleto do projeto Expo | Fundação | 1 | [x] 19/10/2026 |
| 3 | Código compartilhado com a web (`shared/`) | Fundação | 1 | [x] 19/10/2026 |
| 4 | Cliente da `api` e sessão | Fundação | 1 | [x] 19/10/2026 |
| 5 | Login, primeiro acesso e situação da conta | Fundação | 1 | [x] 19/10/2026 |
| 6 | Casca do app: navegação, componentes, formulários e conexão | Fundação | 1 | [x] 19/10/2026 |
| 7 | Assinatura do perfil | Campo online | 3 | [x] 19/10/2026 |
| 8 | Lista das OS da equipe | Campo online | 1 | [x] 19/10/2026 |
| 9 | Detalhe da OS | Campo online | 1 | [x] 19/10/2026 |
| 10 | Câmera, fotos, PDFs e envio de arquivos | Campo online | 2 | [x] 19/10/2026 |
| 11 | APR: modelo, participantes e riscos | Campo online | 2 | [x] 19/10/2026 |
| 12 | APR: checklist, validação e evidências | Campo online | 2 | [x] 19/10/2026 |
| 13 | Assinatura e recusa da APR | Campo online | 2 | [x] 19/10/2026 |
| 14 | Execução: iniciar, pausar, suspender, interromper e cancelar | Campo online | 2 | [x] 19/10/2026 |
| 15 | Encerramento em dois passos e checklist de inspeção | Campo online | 2 | [x] 19/10/2026 |
| 16 | Perfil, histórico, avisos e ausência | Campo online | 3 | [x] 19/10/2026 |
| 17 | Gamificação e Vitória | Campo online | 3 | [x] 19/10/2026 |
| 18 | Banco local, cópia da equipe e login sem sinal | Offline | 4 e 5 | [x] banco e cópia: 19/10/2026 (pendência 4); login sem sinal: 19/10/2026 (pendência 5) |
| 19 | Fila, sincronização e envio em segundo plano | Offline | 4, 5 e 6 | [~] fila, sincronização e APR sem sinal: 19/10/2026 (pendência 4); aviso de pendentes e Sair recusado: 19/10/2026 (pendência 5); envio em segundo plano: 19/10/2026 (pendência 6); falta ver num aparelho |
| 20 | APK, conquista offline e roteiro da demo | Entrega | 7 e 8 | [~] Dockerfile do APK: 19/10/2026 (pendência 7); conquista offline: 19/10/2026 (pendência 8); falta o roteiro da demo |

**Marcos:**

- **Fim da etapa 6:** o app abre, faz login e navega, sem nenhuma tela de campo.
- **Fim da etapa 15:** o caminho ler OS → APR → executar → PDF roda no app, online. É a primeira linha do critério de sucesso que faltava.
- **Fim da etapa 19:** o mesmo caminho roda em modo avião e chega ao painel quando o sinal volta. É a última linha do critério.
- **Fim da etapa 20:** o APK sai de um Dockerfile e a demo tem um roteiro ensaiado.

**Por que o offline vem por último:** a especificação manda (seção "Trabalho"). O app online usa o mesmo `POST /eventos` que a fila vai usar, então o offline só acrescenta a fila antes do envio, sem refazer as telas. Para isso funcionar, **desde a etapa 4 todo envio de evento passa por uma função só** (`enviarEvento`), que na etapa 19 passa a gravar na fila antes de enviar.

## 5. Etapas

Cada etapa traz o que é, o que deve ter, as rotas da `api` que usa e quando está pronta. "Pronta" sempre inclui o `tsc` e o `eslint` do `mobile` sem erros e o teste no aparelho ou no emulador Android.

### Fase 1 — Fundação

#### Etapa 1. Preparação

**O que é:** fechar o que muda o plano antes de escrever o app.

**O que deve ter:**

- as decisões D1 a D6 da seção 3, registradas aqui;
- se a D1 for aceita: o ajuste no `execucao_iniciada` da `api` (`api/src/dominio/eventos-execucao.ts`) para aceitar, vinda da fila, a execução de APR bloqueada, com o alerta novo e os testes; migração nova só se o alerta pedir (nunca editar uma migração já aplicada);
- o aparelho Android e o emulador de teste definidos (questão 41: os aparelhos do piloto);
- o endereço da `api` que o app usa no desenvolvimento (a `api` local pela rede da máquina, ou a de homologação).

**Pronta quando:** a tabela da seção 3 tem uma resposta em cada linha e, se houve mudança na `api`, os testes dela passam.

#### Etapa 2. Esqueleto do projeto Expo

**O que é:** o projeto em `mobile/`, rodando no aparelho, sem telas de negócio.

**O que deve ter:**

- projeto Expo com TypeScript estrito e Expo Router, no padrão do monorepo (`pnpm`, `package.json` e `pnpm-workspace.yaml` próprios, como a `api` e a `web`);
- `eslint` e `tsc` configurados, com os scripts `pnpm lint` e `pnpm typecheck`;
- nome **SYNQ OS** (sempre em maiúsculas), ícone e tela de abertura provisórios, `applicationId` definido (por exemplo, `br.synqos.app`);
- o endereço da `api` por variável de ambiente (`EXPO_PUBLIC_API_URL`), sem nada fixo no código;
- o *development build* instalado no aparelho de teste;
- as permissões do Android declaradas desde já: câmera, localização e notificações locais, se houver;
- o README do `mobile` reescrito: como instalar, rodar, apontar para a `api` e gerar o build.

**Pronta quando:** uma tela "SYNQ OS" abre no aparelho, recarrega ao salvar o código e mostra o resultado de `GET /saude` da `api`.

#### Etapa 3. Código compartilhado com a web

**O que é:** levar para `shared/` as regras puras que a web já tem e o app vai repetir, para não haver duas versões da mesma regra.

**O que deve ter:**

- mover de `web/src/lib/` para `shared/` o que não depende de React nem do Next: os tipos das respostas da `api` (`tipos.ts`, `os-app.ts`), as regras da troca de modelo (`trocarModelo` e `riscosEquivalentes` de `apr.ts`), os motivos de parada (`motivos-de-parada.ts`), o checklist de inspeção (`checklist-inspecao.ts`), a formatação de data, hora e duração (`formatar.ts`) e o `uuid.ts`;
- a web passa a importar de `shared/`, sem mudar o comportamento (`tsc` e `eslint` da web sem erros, e `web/scripts/testar-troca-de-modelo.mts` continua passando);
- `shared/` já tem `notificacoes/avisos.ts` e `vitoria/`: o app reaproveita os dois.

**Pronta quando:** a web compila igual e o `mobile` importa os tipos e as regras de `shared/`.

#### Etapa 4. Cliente da `api` e sessão

**O que é:** a camada única por onde o app fala com a `api`.

**O que deve ter:**

- `chamarApi`, com o `Authorization: Bearer`, o JSON e as chaves `snake_case` das respostas;
- a renovação automática da sessão por `POST /auth/refresh` quando a resposta for `401`, uma vez, sem pedir a senha de novo;
- os tokens guardados no `expo-secure-store`, nunca no armazenamento comum;
- os erros no formato da `api` (`{erro: {codigo, mensagem}}`) viram mensagens em português na tela, com tratamento próprio para `assinatura_pendente`, `usuario_ausente`, `nao_autenticado` e a conta desativada;
- `enviarEvento(evento)`: monta `{eventos: [{id, tipo, os_id, payload, ocorrido_em}]}`, envia a `POST /eventos` e devolve `confirmados`, `alertas`, `aprs` e `os`. **Toda escrita de campo do app passa por ela** (a etapa 19 a troca pela fila);
- `enviarArquivo(id, arquivo)`: `PUT /arquivos/{id}`, com o ID gerado no aparelho;
- testes de unidade da renovação e do formato dos eventos.

**Rotas:** `POST /auth/refresh`, `POST /eventos`, `PUT /arquivos/{id}`, `GET /arquivos/{id}/url`.

**Pronta quando:** uma chamada com o token vencido renova sozinha e repete, e um evento de teste é confirmado pela `api`.

#### Etapa 5. Login, primeiro acesso e situação da conta

**O que é:** entrar no app e cair no lugar certo conforme a situação da conta.

**O que deve ter:**

- o login pelo **e-mail institucional** e a senha (`POST /auth/login`); a matrícula só identifica a pessoa;
- a troca da senha provisória no primeiro acesso (`POST /auth/trocar-senha`), com as regras de senha da web;
- `GET /me` depois do login, que decide o destino:
  - senha provisória → troca de senha;
  - aguardando liberação → aviso da decisão D3;
  - sem assinatura → cadastro da assinatura (etapa 7);
  - ausente → o app abre só para consulta, com a faixa de ausência;
  - admin → aviso de que o app é das telas de campo e a gestão fica na web;
  - técnico liberado → lista de OS;
- o botão Sair (`POST /auth/sair`), que apaga os tokens do aparelho;
- a sessão que continua aberta ao fechar e reabrir o app.

**Rotas:** `POST /auth/login`, `POST /auth/trocar-senha`, `GET /me`, `POST /auth/sair`.

**Pronta quando:** as contas da carga de demonstração caem, cada uma, no destino certo, e a senha errada mostra a mensagem da `api`.

#### Etapa 6. Casca do app: navegação, componentes, formulários e conexão

**O que é:** a estrutura sobre a qual as telas de campo são montadas.

**O que deve ter:**

- navegação por abas: **OS**, **Avisos**, **Pontos** e **Perfil**, com as telas de campo empilhadas a partir da OS;
- os componentes base, com o tema da web (cores, tipografia e o nome SYNQ OS): botão, campo com erro, janela de confirmação, cartão, selo de status, lista vazia e carregando;
- o padrão de formulário da Reunião 3: React Hook Form com Zod, o botão nunca desativado por campo faltando (só enquanto envia), a mensagem junto do campo e o foco no primeiro erro, e o erro da `api` num aviso acima do botão;
- o indicador de conexão (NetInfo), que saiu da web e ficou para o app: "Online" e "Sem conexão";
- o TanStack Query configurado, com "puxar para atualizar" nas listas;
- a tela de erro geral, que nunca deixa o app em branco.

**Pronta quando:** as quatro abas abrem com telas vazias, e o indicador muda ao ligar e desligar o modo avião.

### Fase 2 — Campo online

#### Etapa 7. Assinatura do perfil

**O que é:** o cadastro e a troca da assinatura, que é obrigatória depois da liberação e valida as ações importantes ([assinaturas.md](assinaturas.md)).

**O que deve ter:**

- a tela de desenho da assinatura (rubrica ou por extenso), com "Limpar" e "Salvar";
- o desenho vira PNG, sobe por `PUT /arquivos/{id}` e é gravado por `PUT /me/assinatura`;
- a assinatura cadastrada aparece no perfil, com "Refazer" (vale só para as próximas);
- a `JanelaDeAssinatura` do app: mostra a assinatura do perfil e pede a confirmação em cada ação assinada (interrupção, encerramento, ausência), como na web;
- o `403 assinatura_pendente` de qualquer tela leva ao cadastro.

**Rotas:** `PUT /arquivos/{id}`, `PUT /me/assinatura`.

**Pronta quando:** uma conta nova cadastra a assinatura no app e ela aparece na web.

#### Etapa 8. Lista das OS da equipe

**O que é:** a tela inicial do técnico.

**O que deve ter:**

- as OS da equipe (`GET /os`), por status (liberada, pendente, em execução e as que aguardam assinatura), com busca pelo número da ordem e pelo título;
- em cada cartão: número, título, local, prioridade, criticidade ("Crítico"), data programada e status;
- o selo "Reservada para você" ou "Reservada para <nome>";
- a faixa "APR aguardando a sua assinatura" (`GET /me/aprs-para-assinar`), que leva direto à assinatura (etapa 13);
- o atalho para a execução aberta do técnico (`GET /me/execucoes-abertas`), inclusive a esquecida de outro dia;
- "puxar para atualizar": a OS nova aparece quando a lista é atualizada (não há push, por decisão).

**Rotas:** `GET /os`, `GET /me/aprs-para-assinar`, `GET /me/execucoes-abertas`.

**Pronta quando:** a lista bate com a da web para a mesma conta, e a OS reservada para outra pessoa aparece com o selo.

#### Etapa 9. Detalhe da OS

**O que é:** tudo o que o técnico precisa saber antes de começar, e o ponto de partida da APR e da execução.

**O que deve ter:**

- os dados do SAP: ordem, título, descrição, tipo, local, equipamento, prioridade, criticidade, datas e plano e item de manutenção;
- os materiais recomendados do serviço, só para consulta;
- o ciclo da preventiva (`GET /os/{id}/preventiva`);
- as APRs e execuções anteriores, resumidas (`GET /os/{id}/aprs`), e o histórico do local;
- as faixas: reservada (só o responsável inicia), devolvida ("Esta OS foi devolvida ao SAP"), relógio do aparelho errado;
- o botão de ação conforme a situação: "Iniciar APR", "Assinar a APR", "Iniciar execução", "Continuar a execução" ou "Preencher o encerramento"; para quem não pode agir, o motivo no lugar do botão (como o `AcoesDaOs` da web);
- o PDF da OS encerrada (`GET /os/{id}/pdf`), aberto no leitor do aparelho;
- pela decisão D2, sem reservar, devolver, assinar por último nem ver o relatório da execução.

**Rotas:** `GET /os/{id}`, `GET /os/{id}/aprs`, `GET /os/{id}/preventiva`, `GET /os/{id}/pdf`.

**Pronta quando:** o detalhe de cada status da carga de demonstração mostra o botão certo, e o PDF de uma OS encerrada abre no aparelho.

#### Etapa 10. Câmera, fotos, PDFs e envio de arquivos

**O que é:** o componente de evidência usado pela APR, pela interrupção e pelo encerramento.

**O que deve ter:**

- tirar foto pela câmera e escolher da galeria;
- a compressão da questão 16: lado maior de ~1600 px e qualidade 70% (~300 KB);
- anexar PDF pelo seletor de documentos (até 5 PDFs no encerramento);
- cada arquivo ganha um ID no aparelho, sobe por `PUT /arquivos/{id}` **antes** do evento que o referencia, e o evento leva `{id, arquivo_id, tipo: foto | pdf, nome?, item_id?, capturada_em, latitude?, longitude?}`;
- o progresso do envio e uma nova tentativa quando falhar;
- os limites da especificação: até 10 fotos por execução, e ao menos 1 foto só na interrupção;
- a foto apagada do armazenamento do app depois do envio confirmado.

**Rotas:** `PUT /arquivos/{id}`.

**Pronta quando:** uma foto e um PDF sobem e aparecem na web, e a foto enviada tem o tamanho esperado.

#### Etapa 11. APR: modelo, participantes e riscos

**O que é:** a primeira etapa da Nova APR.

**O que deve ter:**

- a janela "Escolha o modelo da APR" (`GET /os/{id}/modelos-apr`): a "Opção recomendada" no topo, com o aviso para conferir; os "Outros modelos de APR" abaixo; o que foi encontrado na OS (nunca as palavras-chave); o aviso quando nenhum se destaca;
- o modelo baixado por `GET /modelos-apr/{codigo}/versoes/{versao}`, que vem **sem** o que é eliminatório (o técnico não sabe o que bloqueia);
- os participantes da equipe da OS: o técnico logado é sempre participante; o responsável é um só (na OS reservada, a pessoa designada); **mínimo de 2**; ausente e desligado não entram (`participantes_insuficientes`, `participante_inativo`);
- a marcação dos riscos do modelo;
- o rascunho guardado no aparelho enquanto a APR não é concluída, para não perder o que foi feito se o app fechar.

**Rotas:** `GET /os/{id}/modelos-apr`, `GET /modelos-apr/{codigo}/versoes/{versao}`.

**Pronta quando:** a escolha, os participantes e os riscos funcionam como na web, inclusive a OS reservada.

#### Etapa 12. APR: checklist, validação e evidências

**O que é:** o centro do produto: a APR respondida por inteiro e validada no servidor.

**O que deve ter:**

- o checklist com **todas as perguntas iguais**, em qualquer ordem; Sim, Não e NA (só onde o modelo aceita, com observação obrigatória); só as medidas dos riscos marcados;
- "Trocar o modelo" no checklist, com a regra de `shared/` (o que continua, o que fica em branco e os riscos equivalentes);
- a revisão, com os materiais recomendados como lembrete;
- "Concluir e validar" → `POST /aprs/avaliar`;
- **aprovada:** registra com `apr_concluida` (sem assinaturas) e segue para as assinaturas (etapa 13);
- **bloqueada:** a APR já fica registrada; as respostas ficam travadas, a tela lista os itens reprovados e pede a evidência de cada um (foto, texto ou PDF, conforme o item), que vai no `apr_concluida` da mesma APR; a OS fica pendente;
- a recusa antes do resultado (resposta faltando, NA sem observação, participantes) mostrada como na web, sem revelar o que reprova.

**Rotas:** `POST /aprs/avaliar`, `POST /eventos` (`apr_concluida`).

**Pronta quando:** uma APR aprovada e uma bloqueada, feitas no app, aparecem iguais na web, inclusive as evidências.

#### Etapa 13. Assinatura e recusa da APR

**O que é:** cada participante assina a APR na própria conta, só no começo, ou exerce o direito de recusa.

**O que deve ter:**

- a tela da APR para assinar, aberta pela faixa da lista ou pelo aviso: o resumo da APR e "Assinar" (`apr_assinada`, com a assinatura do perfil);
- "Recusar" com o motivo obrigatório (`apr_recusada`): o participante sai da APR e o supervisor é avisado;
- quem falta assinar, visível para o responsável;
- as mensagens das recusas da `api` (`apr_vencida`, `ja_assinou`, `apr_ja_usada` e as demais).

**Rotas:** `GET /me/aprs-para-assinar`, `POST /eventos` (`apr_assinada`, `apr_recusada`).

**Pronta quando:** dois aparelhos, cada um com uma conta, assinam a mesma APR, e o início da execução só é liberado depois das duas assinaturas.

#### Etapa 14. Execução: iniciar, pausar, suspender, interromper e cancelar

**O que é:** a tela da execução, com o cronômetro e as quatro ações da Reunião 3.

**O que deve ter:**

- **iniciar** (`execucao_iniciada`), com o número de pessoas e a localização; recusado até todos assinarem (`apr_sem_assinaturas`, com quem falta);
- o **cronômetro** calculado a partir do início e das pausas, que não depende do app aberto, com o tempo líquido e o de pausa;
- **pausar** com o motivo da lista (almoço, aguardando, descanso, condição climática, enfermidade, lesão ou outro; complemento obrigatório em "aguardando" e "outro") e **continuar** (`pausa_iniciada`, `pausa_encerrada`);
- **suspender** com o motivo (enfermidade, lesão, fim de expediente, condição climática, falta de material ou outro) (`execucao_suspensa`);
- **interromper por risco**, com o motivo, ao menos 1 foto e a assinatura (`execucao_interrompida`);
- **cancelar por engano**, até 10 minutos depois do início, sem foto nem pausa (`execucao_cancelada`);
- a **localização** (`expo-location`) no início, na pausa, na suspensão e na interrupção; sem GPS ou sem permissão, segue "sem localização", sem bloquear; o aviso de que a localização é registrada nesses momentos;
- a suspensão da execução esquecida de outro dia;
- o "+N pontos" que vem na resposta (o `pontos_ganhos`), quando houver.

**Rotas:** `POST /eventos`.

**Pronta quando:** cada ação, feita no app, aparece na linha do tempo da web com o motivo e a localização.

#### Etapa 15. Encerramento em dois passos e checklist de inspeção

**O que é:** o fim da execução, em que o tempo para no clique e o preenchimento vem depois.

**O que deve ter:**

- **passo 1:** "Encerrar OS", com uma confirmação, grava o fim e a localização (`execucao_encerrada`); o tempo para aqui;
- **passo 2:** o preenchimento, com a descrição (opcional), as fotos (opcionais), até 5 PDFs, o checklist de inspeção da preventiva (todas as perguntas, com observação quando pedida) e a assinatura do responsável (`encerramento_assinado`);
- só o responsável pela execução preenche e assina; com a OS em `encerrando`, o app leva o responsável de volta ao preenchimento;
- depois, a OS aparece "Aguardando a assinatura do supervisor", que é dada na web (decisão D2).

**Rotas:** `POST /eventos` (`execucao_encerrada`, `encerramento_assinado`).

**Pronta quando (marco):** uma OS percorre, no app, ler OS → APR → executar → encerrar; o supervisor assina na web; e o PDF sai e abre no app.

#### Etapa 16. Perfil, histórico, avisos e ausência

**O que é:** o que o técnico consulta fora da OS.

**O que deve ter:**

- **perfil:** nome, matrícula, cargo e equipe (vindos do registro de funcionários, só leitura), a assinatura (etapa 7), as preferências de e-mail por categoria (`PUT /me/emails`) e o anonimato no ranking (`PUT /me/ranking-anonimo`);
- **histórico:** as OS encerradas do próprio técnico (`GET /me/historico`), com o PDF;
- **avisos (o sino):** `GET /alertas`, marcar como lido (`PATCH /alertas/{id}`) e abrir a OS do aviso; o contador na aba;
- **ausência:** pedir (motivo, início e dias ou data de retorno), acompanhar, confirmar o ajuste do supervisor, pedir o fim e confirmar o retorno, com a assinatura onde a web pede; a faixa "Você está ausente: só visualização";
- as ações de supervisor sobre a ausência dos outros ficam na web (decisão D2).

**Rotas:** `GET /me/historico`, `PUT /me/emails`, `PUT /me/ranking-anonimo`, `GET /alertas`, `PATCH /alertas/{id}`, `GET /ausencias`, `POST /ausencias` e as ações de `/ausencias/{id}` do próprio técnico.

**Pronta quando:** o técnico pede uma ausência no app, o supervisor aprova na web, e o app passa a só visualizar.

#### Etapa 17. Gamificação e Vitória

**O que é:** a parte de consulta da gamificação ([gameficacao.md](gameficacao.md), seção 8.4) e a assistente.

**O que deve ter:**

- **gamificação:** "Minha pontuação" (`GET /gamificacao/eu`, extrato), Ranking de pessoas e de equipes (`GET /gamificacao/ranking`), Conquistas e a patente com a imagem; os avisos "Conquista desbloqueada" e "Nova patente" (`POST /gamificacao/avisos/vistos`); os cadastros de pontos, patentes e conquistas ficam só na web;
- **Vitória:** o botão flutuante nas telas de campo, a conversa (`POST /vitoria/mensagens`) com as respostas pelo manual do técnico, as sugestões fixas por tela e a busca por palavra-chave quando a IA não responde; o "Me leve lá" com os destinos de `shared/vitoria/destinos.ts` mapeados para as telas do app (o destino que só existe na web abre a web); o avatar e as figurinhas;
- pela decisão D4, os treinamentos de serviço continuam na web.

**Rotas:** `GET /gamificacao/eu`, `/gamificacao/extrato`, `/gamificacao/ranking`, `/gamificacao/conquistas`, `/gamificacao/patentes`, `POST /gamificacao/avisos/vistos`, `POST /vitoria/mensagens`, `POST /vitoria/eventos`, `GET /vitoria/sobre`.

**Pronta quando:** os pontos de uma APR feita no app aparecem na aba Pontos, e a Vitória responde e leva a uma tela do app.

### Fase 3 — Modo offline

O modo offline é **contingência**: o dia a dia é online. Ele vale para a APR e a execução no campo sem sinal e não muda as telas: as mesmas telas passam a ler da cópia local e a escrever na fila quando não há sinal.

#### Etapa 18. Banco local, cópia da equipe e login sem sinal

**O que é:** o aparelho guarda o que o técnico precisa para trabalhar sem sinal.

**O que deve ter:**

- o banco SQLite com as tabelas da cópia (`os`, `aprs`, `execucoes`, `locais`, `atividades`, `modelos_apr`, `usuarios`) e as da fila (`fila_eventos`, `fila_arquivos`), com a versão do esquema e a migração local;
- a cópia baixada por `POST /sync/pull` ao abrir o app com sinal e depois de cada envio da fila: as OS liberadas, pendentes e em execução da equipe, as encerradas do próprio técnico (60 dias), a escolha do modelo de cada OS, os modelos publicados com a orientação e os usuários da equipe;
- o snapshot **nunca apaga** do aparelho uma OS com evento local pendente;
- as telas (lista, detalhe, escolha do modelo, APR) lendo da cópia quando não há sinal, com a marca "Dados de hh:mm";
- o **login sem sinal**: no login online, o hash salgado da senha (derivação lenta, como PBKDF2) fica no `expo-secure-store`; sem sinal, entra quem logou neste aparelho nos últimos **7 dias**; depois disso, "Conecte-se para entrar"; a senha trocada na web vale no aparelho só depois do próximo login online;
- pela decisão D5, um login online de outra pessoa apaga a cópia da anterior, se a fila dela estiver vazia.

**Rotas:** `POST /sync/pull`.

**Pronta quando:** com o modo avião ligado, o técnico entra no app, vê as OS da equipe, abre o detalhe e escolhe o modelo da APR.

#### Etapa 19. Fila, sincronização e envio em segundo plano

**O que é:** o que é feito sem sinal fica guardado e sobe sozinho quando o sinal volta.

**O que deve ter:**

- o `enviarEvento` da etapa 4 passa a **gravar na fila antes de enviar**; com sinal, envia em seguida (o online não muda para o técnico); sem sinal, fica na fila;
- os arquivos sobem **antes** dos eventos que os referenciam; o evento cujo arquivo não subiu continua pendente;
- o envio em ordem de `ocorrido_em`; o confirmado sai da fila; o reenvio não tem efeito (idempotência); a queda no meio do envio só tira da fila o que foi confirmado;
- o evento que a `api` adia (por exemplo, `apr_sem_assinaturas` esperando a assinatura de outro aparelho) continua na fila e é reenviado depois;
- o evento recusado de vez sai da fila, mas fica guardado no aparelho e aparece numa lista "Registros recusados", com o motivo, para o técnico mostrar ao supervisor;
- **APR sem sinal**, pela decisão D1: concluída com `assinatura_presencial: true` no aparelho do responsável (as assinaturas dos participantes presentes são copiadas dos perfis), sem a validação na hora, com a marca "Aguardando validação"; a evidência dos itens reprovados não é pedida (o aparelho não pôde perguntar);
- a execução, as pausas e o encerramento funcionando sobre a cópia local, com o status da OS calculado só para mostrar na tela até a `api` responder;
- **sincronização automática** ao abrir o app e quando o sinal volta, e o **botão "Sincronizar"**;
- **envio em segundo plano** com o app fechado, no intervalo que o Android libera (por volta de 15 minutos), pelo `expo-background-task`;
- o aviso **"Sem conexão — N registros pendentes"** e "Sincronizado hh:mm";
- o **Sair recusado** enquanto houver fila;
- o usuário desativado enquanto estava sem sinal: a fila ainda sobe, e depois a sessão é revogada ("Acesso revogado");
- testes de unidade da fila: ordem, idempotência, queda no meio, evento adiado, evento recusado e arquivo pendente.

**Rotas:** `PUT /arquivos/{id}`, `POST /eventos`, `POST /sync/pull`.

**Pronta quando (marco):** com o modo avião ligado, o técnico faz a APR, executa e encerra uma OS; ao desligar o modo avião (com o app aberto e, em outro teste, fechado), tudo chega ao painel da web sem duplicar nada.

### Fase 4 — Entrega

#### Etapa 20. APK, conquista offline e roteiro da demo

**O que é:** fechar o app para a apresentação.

**O que deve ter:**

- o **Dockerfile do `mobile`** (Decisão-chave 1: "não é publicado no Coolify"): imagem com o JDK e o Android SDK, o `expo prebuild` e o Gradle gerando o **APK assinado** como artefato; a chave de assinatura entra por variável ou volume, nunca no repositório; o comando documentado no README do `mobile` e no da raiz;
- a **conquista de sincronização offline** na gamificação: a regra e a carga na `api` (`api/src/db/seed/gamificacao-dados.ts`), contando os eventos que chegaram pela fila (a regra dos 60 s já os reconhece), sem migração editada (gerar uma nova se precisar);
- o **roteiro da demo**, ensaiado nos aparelhos definidos: o caminho online no app e no navegador, e o caminho em modo avião chegando ao painel quando o sinal volta (as três linhas do critério de sucesso);
- a atualização dos documentos: este arquivo (seção 6), o [pendencias.md](../pendencias.md) (itens 1 a 8), o [funcionalidades.md](../funcionalidades.md) e o README do `mobile`.

**Pronta quando:** o APK gerado pelo Dockerfile, instalado num aparelho limpo, roda o roteiro inteiro da demo.

## 6. O que mudou na implementação

Registrar aqui, a cada etapa, o que foi feito diferente do plano e por quê.

| Etapa | Data | O que mudou |
|---|---|---|
| 1 | 19/10/2026 | D1 a D6 seguem a recomendação (seção 3). **O ajuste da `api` para a D1 não foi feito:** nada antes da etapa 19 depende dele, então entra junto com a fila. O aparelho de teste e o emulador não foram definidos (a validação foi por código, sem aparelho) |
| 2 | 19/10/2026 | Expo SDK 58 (React Native 0.88, React 19.3, TypeScript 6), rotas em `src/app/`, `pnpm` com instalação isolada. **Não ligados:** o React Compiler e as rotas tipadas (`typedRoutes` exige gerar tipos antes do `tsc`). `app.config.ts` no lugar do `app.json`; `APP_PERMITIR_HTTP=true` libera `http://` só no build de desenvolvimento. Ícone e abertura provisórios, com a marca da web (o ícone tem 192 px; o definitivo, de 1024 px, fica para a rodada de acabamento). No TypeScript 6 o `types` vem vazio: o `tsconfig` declara `"types": ["node"]` por causa dos testes. **Falta:** instalar o *development build* num aparelho ou emulador e ver a tela abrir e recarregar (`pnpm android`); o que foi conferido está na linha da etapa 9 |
| 3 | 19/10/2026 | Foi para `shared/api/` mais do que o plano listava: `tipos`, `os-app`, `apr`, `catalogo`, `ausencia`, `representacao`, `gamificacao`, `preventivas`, `checklist-inspecao`, `motivos-de-parada`, `formatar`, `uuid` e o novo `eventos` (formato do evento, resposta e `ErroDeEvento`, que a web também usa agora). Em `web/src/lib/<nome>.ts` ficou só um `export *` do arquivo novo: a web compila igual, sem mexer em centenas de importações. Entraram em `shared/` o `TomDoSelo` (o `BadgeTone` da web passou a ser esse tipo), o `tomDaPrioridade` e o `RespostaMe`. O `uuid` ganhou um plano B sem `crypto` (o Hermes não tem; o app instala o `getRandomValues` do `expo-crypto`). Os três scripts de `web/scripts/` agora importam de `shared/api/` (o `export *` não funciona com a importação nomeada nesse modo) |
| 4 | 19/10/2026 | `src/api/cliente.ts` não conhece o React Native (tokens e `fetch` entram por parâmetro), o que permitiu testá-lo com 15 casos. Além do plano: renova **antes** de chamar quando o token vence em menos de 30 s, uma só renovação para várias chamadas ao mesmo tempo, tempo limite de 30 s (vira `ErroDeRede`), e a renovação recusada (`401` ou `403`) é a única que encerra a sessão: erro `5xx` ou falta de sinal **mantêm** os tokens (o login sem sinal e a fila precisam deles). `enviarEvento` e `enviarArquivo` ficam em `src/api/eventos.ts`; o envio de arquivo é `multipart` (`arquivo` e `tipo`), como a `api` pede |
| 5 | 19/10/2026 | A regra do destino é `src/sessao/destino.ts` (testada): senha provisória → aguardando liberação → administrador → sem assinatura → lista. Quem **abriu o app sem sinal** vê "Não foi possível abrir o app" com "Tentar de novo" (o login sem sinal é a etapa 18). A tela da assinatura é **provisória**: pede que a pessoa cadastre pela web e volte (o desenho no aparelho é a etapa 7). O cadastro recusado e a conta desativada voltam à entrada com a mensagem da `api` |
| 6 | 19/10/2026 | Abas em JavaScript (`Tabs` do Expo Router), não as nativas. **Avisos e Pontos são telas "em breve"** (etapas 16 e 17); o Perfil já mostra os dados da pessoa e o Sair com confirmação. O indicador "Online" / "Sem conexão" fica no cabeçalho das abas. O formulário (`useFormulario`) segue o padrão da web: botão nunca desativado por campo faltando, mensagem junto do campo, foco no primeiro erro, erro da `api` acima do botão |
| 8 | 19/10/2026 | A `api` filtra por **um** status por vez, então a coluna "Aguardando assinaturas" da web virou dois filtros ("Encerrando" e "Aguardando o supervisor"); cada filtro mostra a contagem da `api` (que respeita a busca). Abre em "Liberadas". Busca com 400 ms de espera, páginas de 20, "puxar para atualizar" também recarrega a faixa de assinaturas e o atalho da execução. O botão "Assinar a APR" e o "Continuar a execução" levam à tela "em breve" até a pendência 2 |
| 9 | 19/10/2026 | **O botão certo de cada situação é uma função pura (`src/os/detalhe/acao.ts`, 15 casos de teste):** sem APR, pendente, reservada, APR para assinar, assinada por mim com faltas, todas assinadas, APR de outros, APR que não serve mais, em execução (minha e de outro), encerrando (meu e de outro), aguardando o supervisor, encerrada com e sem PDF, cancelada, devolvida e ausente. O painel de ação vem logo abaixo do cabeçalho (uma ação por tela); os dados vêm depois. `GET /os/{id}/aprs` **não** foi usado: o `GET /os/{id}` já traz as APRs e as execuções. O histórico do equipamento ou do local usa `GET /historico`, carrega só ao abrir e tem a troca "do equipamento" / "de todo o local". O PDF baixa com o token (`expo-file-system`) e abre no leitor (`expo-intent-launcher`); sem leitor instalado, a tela explica. O "Ver motivo" da APR bloqueada fica para a pendência 2. **O que foi conferido (sem aparelho):** `tsc` estrito, ESLint, 41 testes, o pacote Android do Metro (`expo export`, que resolve o `shared/`), o projeto nativo e o manifesto (`expo prebuild`, descartado depois), `expo-doctor` (20/20) e `pnpm conferir:api` contra a `api` local em memória (login de cada tipo de conta, lista, busca, detalhe, ciclo, histórico, token vencido renovado, evento recusado, sair). **Não conferido:** as telas rodando num aparelho ou emulador (layout, teclado, o leitor de PDF, o mapa) |
| 10 | 19/10/2026 | `expo-image-picker` (câmera e galeria), `expo-image-manipulator` (a API nova `ImageManipulator.manipulate`, com `maxWidth`/`maxHeight` de 1600 já na decodificação, para uma foto de 100 MP não estourar a memória, e JPEG a 70%) e `expo-document-picker`. **A foto sobe antes de entrar na lista** da tela; se o envio falhar, ela fica guardada no aparelho e "Enviar a foto de novo" repete com o **mesmo id** (a `api` não duplica). A posição vai com a foto só se a permissão de localização já foi dada (a foto não abre pedido de permissão e espera no máximo 3 s). O PDF é conferido no aparelho (tipo e 10 MB). **Mudou:** a cópia local da foto não é apagada logo depois do envio, e sim depois que o **evento** que a referencia é confirmado (a miniatura do rascunho é essa cópia). Limites: 10 fotos e 5 PDFs por execução |
| 11 | 19/10/2026 | O modelo vem de `GET /modelos-apr/{codigo}/versoes/publicada` (como na web), não de `/versoes/{versao}`. **O rascunho fica num arquivo JSON por pessoa e por OS** (`rascunhos-apr`, na pasta de documentos do app, que o sistema não apaga como o cache); `src/apr/armazem.ts` não conhece o React Native (o disco entra por parâmetro) e tem 10 testes: leitura única, gravações em ordem, outro usuário no mesmo aparelho, disco que falha (o rascunho segue na memória). A janela de escolha abre sozinha uma vez; "Tornar responsável" virou um botão por colega marcado. Foi para `shared/api/` o que a execução também usa: `execucao-tempo`, `execucao-situacao`, `execucao-motivos` (com `faltaNoMotivo` e `complementoDoMotivo`, sem Zod, porque o `shared/` não resolve `zod`), `evidencias` e `localizacao` (a web reexporta de `web/src/lib/` e o `CamposDoMotivo` dela passou a usar `faltaNoMotivo`) |
| 12 | 19/10/2026 | O checklist é uma pergunta por tela, com Sim/Não/NA em botões grandes; a resposta Sim ou Não avança sozinha, o NA fica na pergunta e pede a observação. Sem resposta, "Próxima" não fica parado: o toque diz "Responda esta pergunta para continuar". A revisão e a evidência dos reprovados usam o mesmo esquema Zod da web (as mensagens ficam junto de cada campo). `Tela` ganhou `voltarAoTopoQuando` (da pergunta para a revisão a rolagem volta ao topo). Se a pessoa **não tem a assinatura cadastrada**, o aviso manda cadastrar pela web; os colegas sem assinatura só podem ser retirados da APR (cadastrar a assinatura no aparelho é a etapa 7, da pendência 3) |
| 13 | 19/10/2026 | A tela das assinaturas se atualiza sozinha a cada 10 s (`useDetalheDaOs` com `atualizarACadaMs`; o TanStack Query pausa no segundo plano). O mesmo evento `apr_assinada` mostra o "+N pontos" na hora. `JanelaDeAssinatura` (mostra a assinatura do perfil e pede a confirmação) é a de todas as ações assinadas: APR, interrupção, cancelamento e encerramento. A falha `assinatura_pendente` ou `usuario_ausente` de qualquer ação recarrega o `GET /me`, que leva a pessoa à tela certa |
| 14 | 19/10/2026 | O cronômetro sai do início e das pausas da `api` (`calcularTempo`, compartilhado), então fechar o app e voltar mostra o tempo certo. **A execução esquecida de outro dia pede a data e a hora em dois campos de texto** (`dd/mm/aaaa` e `hh:mm`, já preenchidos com o agora), porque o seletor de data nativo exigiria mais um módulo nativo para um caso raro; a regra (existir, depois do início, não no futuro) está em `faltaNoFim`, testada. "Encerrar OS" com a pausa aberta diz "Continue a execução para poder encerrá-la". O resultado de uma ação que leva a outra tela ("Execução cancelada", "OS pendente — retome com APR nova", "+N pontos") aparece num aviso de uma linha (`AvisoRapido`, o equivalente ao `useToast` da web) |
| 15 | 19/10/2026 | O encerramento segue os dois passos da web: a confirmação para o tempo na hora (`execucao_encerrada`); o preenchimento volta sozinho se a pessoa sair (a OS está `encerrando`). Depois da assinatura a tela mostra "Aguardando o supervisor" com o "+N pontos"; com a OS concluída, "Abrir o PDF" baixa com o token e abre no leitor do aparelho (a `api` gera o PDF na hora, se ainda não estiver pronto), sem consultar `pdf_pronto` de 3 em 3 segundos como a web. **O que foi conferido (sem aparelho):** `tsc` estrito e ESLint do `mobile` e da `web`, 79 testes, o pacote Android do Metro (`expo export`), o manifesto (`expo prebuild`, descartado depois: câmera, localização e nada de microfone), `expo-doctor` (20/20) e `pnpm conferir:campo` contra a `api` local em memória (APR aprovada com assinaturas de duas contas, execução, pausa, encerramento em dois passos com foto e PDF, cancelar por engano, interromper por risco com foto, APR bloqueada com a evidência). **Não conferido:** as telas rodando num aparelho ou emulador (layout, teclado, câmera, seletor de PDF, GPS); o checklist de inspeção da preventiva só tem teste de formato (a carga local não traz perguntas) |
| 7 | 19/10/2026 | O desenho é um `PanResponder` sobre um `react-native-svg` (a única dependência nativa nova): a caixa de 600 × 180, o mesmo tamanho do `<canvas>` da web, gera o PNG com `toDataURL` (fundo transparente). O estado do desenho é a classe `ControleDoDesenho` (`src/assinatura/traco.ts`, 13 casos de teste), fora do React porque o `PanResponder` vive fora da renderização. O PNG vai para um arquivo do cache, sobe por `PUT /arquivos/{id}` (`tipo=assinatura`), vira a do perfil por `PUT /me/assinatura` e o arquivo local é apagado; a primeira assinatura mostra o "+N pontos". **Além do plano:** o cadastro aparece no lugar do aviso "cadastre pela web" também na janela da assinatura e na tela de assinaturas faltando da APR (`CadastrarAssinatura`); `JanelaDeAssinatura` ganhou `semAssinatura` (o pedido inicial da ausência não é assinado) e `faltaNosCampos` (o botão não fica desativado: o toque mostra o que falta). O `403 assinatura_pendente` já levava ao cadastro pelo `useAcao` (recarrega o `GET /me`) |
| 16 | 19/10/2026 | O Perfil virou um índice: dados (só leitura), "Minha assinatura" com "Refazer", e linhas para **Minhas ausências**, **OS que encerrei** (`GET /me/historico`, com o PDF), **Preferências de e-mail** (`PUT /me/emails`, as obrigatórias travadas) e **Trocar a senha**, mais o anonimato no ranking e o Sair; cada assunto tem a sua tela, no cabeçalho da pilha. **Avisos:** lista de `GET /alertas` (Não lidos / Todos, 20 por página, "puxar para atualizar"); tocar marca como lido (`PATCH /alertas/{id}`, só os do próprio destinatário) e, se o aviso tem tela no app, leva a ela (`destinoDoAvisoNoApp`: a OS, as assinaturas da APR, as ausências; o resto só existe na web); o contador da aba se atualiza a cada minuto. **Ausência:** pedir (técnico) ou registrar a própria assinando (supervisor titular), com a data digitada como `dd/mm/aaaa` (sem seletor nativo, como a execução esquecida); acompanhar, linha do tempo, cancelar o pedido, confirmar o que o supervisor aprovou, recusar as datas, pedir o fim antecipado e confirmar o retorno; o supervisor titular também altera o retorno e encerra a que registrou para si. As regras são puras e testadas (`src/ausencia/regras.ts`, 26 casos). **Foi para `shared/`:** o aviso (`shared/api/alertas.ts`: o tipo e o rótulo, a referência e o "urgente"), o período digitado (`ausencia-periodo.ts`), o rótulo e o detalhe de cada ato da ausência e o `ExecucaoDoHistorico`; a web importa de lá (`tsc` e ESLint sem erros) |
| 18 e 19 (pendência 4) | 19/10/2026 | **Feito:** o banco SQLite (`expo-sqlite`, `synqos.db`) com as tabelas da cópia (`os`, `aprs`, `execucoes`, `locais`, `atividades`, `modelos_apr`, `usuarios`, cada linha como o JSON do `POST /sync/pull`), as da fila (`fila_eventos`, `fila_arquivos`), os `eventos_recusados` e o `meta`, com migração por `PRAGMA user_version`. **Tudo em `mobile/src/offline/`, sem depender do React Native** (o SQLite entra por `Primitivas`; os testes usam o `node:sqlite`): `banco.ts` (uma operação de cada vez, transação), `esquema.ts`, `fila.ts`, `copia.ts`, `projecao.ts`, `leitura.ts`, `sincronizar.ts`, `envio.ts`; a parte nativa é `banco-nativo.ts`, `arquivos-nativos.ts`, `app.ts` (as instâncias) e `SincronizacaoProvider.tsx`. **Escrita:** `enviarEvento` e `enviarArquivo` (agora em `@/offline/app`) gravam na fila antes de enviar; com sinal o envio é em seguida (a resposta, os pontos e as recusas chegam à tela como antes; o evento recusado ou adiado vira `ErroDeEvento` e **não** fica na fila nem entre os recusados, porque a pessoa está na tela e corrige); sem sinal devolve `naFila: true`. Ao voltar o sinal, o que ficou guardado sobe **antes** do evento novo (a ordem é a das ações); um registro anterior da mesma OS ainda esperando deixa o novo guardado. A foto e o PDF vão para a pasta de documentos do app (não para o cache) e sobem antes dos eventos; a assinatura do perfil não passa pela fila. **Leitura:** `lerDeOndeDer` lê da `api` e cai para a cópia local quando não há sinal, quando ainda há registro na fila ou quando a `api` não responde; `leitura.ts` devolve **as mesmas respostas da `api`** (lista com busca, ordem e contagem por status, detalhe, escolha do modelo, modelo sem o eliminatório, equipe e execuções abertas), e o `conferir:offline` as compara com as da `api` de verdade. A `projecao.ts` aplica os eventos pendentes sobre a cópia (idempotente: se a cópia já traz o efeito, nada muda) e recalcula o status da OS pela mesma regra da `api`. **APR sem sinal (D1):** o aparelho não valida (só o servidor sabe o que bloqueia); `apr_concluida` vai com `assinatura_presencial: true` (os presentes assinam por este aparelho), a APR aparece "aguardando validação" e a execução já pode começar; sem a evidência dos reprovados. **Sincronizador:** os arquivos sobem primeiro; os eventos, um a um, em ordem de `ocorrido_em`; o confirmado sai; o adiado (`pendente`) espera e segura só os seguintes **da mesma OS**; o recusado vai para os `eventos_recusados` (tela "Registros recusados" no perfil); o evento pendente por mais de 7 dias também vai para os recusados, para não travar a fila para sempre; sem sinal, 5xx, sessão vencida ou assinatura por cadastrar param a passada e deixam a fila como está. **Cópia:** o snapshot troca a cópia inteira, mas **nunca apaga uma OS com evento pendente** (nem as APRs, o local e o modelo dela); outra pessoa no aparelho recebe a cópia só dela, e a fila é de cada pessoa (D5). **Quando sincroniza:** ao abrir o app, quando o NetInfo diz que o sinal voltou, ao voltar para a frente (no máximo a cada 30 s), de minuto em minuto enquanto houver pendência e no botão "Sincronizar" do perfil (que também mostra os pendentes e a hora da cópia). O NetInfo passou a conferir a conexão com o `GET /saude` da própria `api`, e as consultas rodam mesmo "sem conexão" (`networkMode: "always"`), porque caem para a cópia. **Na `api`:** a D1 (a `execucao_iniciada` da fila, amparada por uma APR do próprio técnico que o servidor bloqueou, é aplicada, sem esperar assinaturas que não existem, e gera um alerta `bloqueio` ao supervisor; online continua recusada com `apr_invalida`) e a `equipe` no snapshot (o detalhe offline mostra o nome dela); sem migração. `montarPayload` passou a levar o `resultado` que o servidor deu ao validar (a `api` só o confere), para a projeção mostrar a APR bloqueada enquanto o evento espera. **Fica para a pendência 5:** abrir o app e entrar sem sinal (hoje o `GET /me` falha sem sinal se o app abriu offline), o "Sem conexão — N registros pendentes" no cabeçalho, o Sair recusado com fila e o hash da senha; **para a 6:** o envio com o app fechado (`expo-background-task`). **O que foi conferido (sem aparelho):** `tsc` estrito e ESLint do `mobile` e da `web`, `tsc` da `api` e seus testes (25 em `eventos.test.ts`, com o caso da D1), 191 testes do `mobile` (50 novos: esquema, fila, cópia, projeção, leitura e sincronizador, num SQLite de verdade), `expo-doctor` (20/20), o pacote Android do Metro (`expo export`) e `pnpm conferir:offline` contra a `api` local em memória. **Não conferido:** o banco abrindo no aparelho, a câmera e o seletor de PDF sem sinal, o NetInfo no modo avião de verdade, a pasta de documentos do app |
| 17 | 19/10/2026 | **Pontos** é uma aba com três seções (Minha pontuação, Ranking, Conquistas): a patente com a barra até a próxima, os pontos, a posição, as últimas conquistas e o extrato por temporada (com "Ver mais"); o ranking de pessoas e de equipes por temporada ou geral, com a própria linha em destaque; as conquistas obtidas primeiro e, nas que faltam, o progresso. A janela "Parabéns!" (conquista e nova patente) abre quando o `GET /me` diz que há aviso e grava `POST /gamificacao/avisos/vistos` ao fechar. O "+N pontos" já vinha das etapas 12 a 15. **Vitória:** botão flutuante em todas as telas de campo e painel de conversa, com as três sugestões fixas da tela (sem IA), as respostas locais (saudação, agradecimento, "fique triste"), a mensagem à `api` e a figurinha da reação (as 10 animações e quadros, copiados de `web/public/vitoria/`, 4,5 MB). As regras são as do `shared/vitoria/` (as mesmas da web). **Mudou:** o React Native não entrega o corpo aos poucos, então a resposta SSE é lida inteira (`lerEventosSse`), o que não muda nada para quem usa, porque a `api` já a manda de uma vez. O "Me leve lá" leva à tela equivalente do app (OS, APR, execução, lista, perfil, Pontos na seção certa); o que só existe na web abre no navegador se `EXPO_PUBLIC_WEB_URL` estiver definida, senão a resposta fica só em texto. O "mostrar na tela" (piscar o elemento) só navega. **O que foi conferido (sem aparelho):** `tsc` estrito e ESLint do `mobile` e da `web`, 141 testes, o pacote Android do Metro (`expo export`), `expo-doctor` (20/20) e `pnpm conferir:perfil` contra a `api` local em memória (assinatura enviada e gravada, avisos de três contas, e-mails, anonimato, senha, ausência pedida e cancelada, gamificação, SSE da Vitória). **Não conferido:** as telas rodando num aparelho ou emulador (o desenho com o dedo, o PNG gerado pelo SVG nativo, o WebP animado das figurinhas, o teclado do chat, o layout das telas novas) |
| 18 e 19 (pendência 5) | 19/10/2026 | **Feito:** o login e a abertura do app sem sinal, o aviso de pendentes e o Sair recusado com fila. **Login com sinal:** `credenciais.ts` (puro e testado, sem React Native) guarda no `expo-secure-store` um registro por pessoa (`usuarioId`, e-mail, sal, hash, iterações, `confirmadoEm`), nunca a senha; a derivação é PBKDF2-HMAC-SHA256 com 30 mil iterações (`derivar-senha.ts`, `@noble/hashes` em JavaScript puro, a **única dependência nova, sem módulo nativo**, e assíncrona para a tela não congelar; guardada com as iterações do próprio registro, para poder subir depois). Não se guarda hash de senha provisória. O hash é gravado em segundo plano, sem segurar a entrada. O último `GET /me` vai para a tabela `meta` do SQLite (`offline/identidade.ts`, uma entrada por pessoa). **Sem sinal:** (a) com a sessão aberta, `criarCarregadorDoEu` (`sessao/eu.ts`, puro e testado) usa o último `GET /me` se tiver menos de 7 dias, com o tempo do servidor encurtado para 8 s quando há cópia (sem cópia, o normal); (b) sem sessão, `entrar` cai para `credenciais.verificar` quando o login dá falta de rede (ou o aparelho já sabe que está sem sinal, sem esperar os 30 s) e abre em **modo local**: sem token, `cliente` recusa as chamadas autenticadas como `ErroDeRede` sem sair do aparelho (`modoLocal`), a conexão do app inteiro vale "offline" (`conexaoDoAparelho`) e as telas leem da cópia. Quando o sinal volta, a `SessaoProvider` refaz o login com a senha digitada (só na memória; se o app for fechado antes, a pessoa entra de novo) e a sincronização roda; se a `api` recusar (senha trocada na web), volta à entrada com a mensagem e a fila fica. **Decisões fora do plano:** (1) a janela de 7 dias conta desde a **última confirmação da conta pelo servidor** (login ou `GET /me` com sinal), não só desde o login: o plano dizia "desde o último login online", mas quem usa o app todo dia perderia o acesso sem sinal no 8º dia sem nenhum motivo de segurança (o limite existe para cercar quanto tempo um desativado ainda abre o app); (2) o registro vencido some do armazenamento na gravação seguinte; (3) a conta que o servidor recusa (renovação recusada, conta desativada, cadastro recusado) é esquecida (hash e `GET /me`), a fila não; (4) a senha trocada no app (`trocar-senha` e `senha`) regrava o hash na hora, sem segurar a tela; (5) a D5 vira "um registro por pessoa", não "apaga o da anterior": quem saiu com a fila vazia continua podendo voltar, e a fila de cada um é dele. **Aviso e Sair:** a `FaixaDeSincronizacao` (dentro da `Tela`, então em toda tela de campo, inclusive as da pilha, que não têm o cabeçalho das abas) e o indicador do cabeçalho ("Sem conexão" / "Sincronizado hh:mm" / "Online"), com os textos em `offline/faixa.ts` (puro e testado); só para quem tem fila (`aplicavel`: técnico de equipe com a conta pronta). `sair()` devolve o motivo em vez de lançar erro: com registro na fila, o Perfil abre "Ainda não dá para sair" com "Sincronizar agora" (não só o botão desativado) e a abertura com erro mostra o mesmo texto; o Sair da `api` revogada (`revogarSessaoLocal`) não é recusado. **O que foi conferido (sem aparelho):** `tsc` estrito e ESLint do `mobile`, 227 testes (36 novos: janela, derivação igual à do `node:crypto`, credenciais, o `GET /me` guardado, o carregador, o cliente em modo local, a faixa e o indicador), `expo-doctor` (20/20), o pacote Android do Metro (resolve o `@noble/hashes`) e `pnpm conferir:sem-sinal` contra a `api` local. **Não conferido:** as telas rodando num aparelho ou emulador, o modo avião de verdade e o tempo da derivação no Hermes (no Node 30 mil iterações levam ~160 ms; o custo foi escolhido sem medir no aparelho, e o número está em `ITERACOES_DA_SENHA`) |
| 19 (pendência 6) | 19/10/2026 | **Feito:** o envio da fila com o app fechado. **Peças:** `offline/segundo-plano.ts` (puro e testado, a regra da passada), `offline/segundo-plano-nativo.ts` (define a tarefa do `expo-task-manager`, registra e retira no `expo-background-task`) e `mobile/index.ts` (a entrada nova do app, que carrega a tarefa antes do Expo Router, porque com o app fechado nenhuma tela existe para defini-la; `main` do `package.json` passou de `expo-router/entry` para `index.ts`). **Dependências novas:** `expo-background-task` e `expo-task-manager` (o plugin do `expo-background-task` é só do iOS, então não entrou no `app.config.ts`). **A passada:** com o app na frente, não faz nada (a `SincronizacaoProvider` cuida; assim as duas não concorrem pelos tokens); sem tokens (saiu, ou entrou sem sinal), nada; a pessoa vem do app, se ele estava vivo, ou do último `GET /me` guardado no SQLite (o registro é regravado a cada `GET /me` com sinal, e o login e a renovação são da mesma pessoa que o `GET /me` lê); só o técnico de equipe tem fila; fila vazia não gasta rede nem baixa a cópia; senão chama o `sincronizar` de sempre (a fila, depois a cópia, para quem abrir o app sem sinal não ver a OS como estava antes). Sem sinal, a fila fica como está e a tarefa devolve `Failed` (o Android repete no próximo intervalo; para o trabalho periódico isso não cancela nada). **Registro:** o intervalo é 15 minutos (o mínimo do Android; o real varia com a bateria) e a rede ligada é exigida pelo próprio módulo. `registerTaskAsync` do Android usa `CANCEL_AND_REENQUEUE`, ou seja, **cada registro reinicia a contagem**: por isso a `SincronizacaoProvider` só registra se a tarefa ainda não existe (`isTaskRegisteredAsync`) e só retira no `sem-sessao`. **No perfil:** a linha "Enviado com o app fechado às hh:mm (N registros)" ou "Tentativa com o app fechado às hh:mm, sem conseguir enviar", gravada na tabela `meta` (só as passadas que mexeram na fila; as sem nada a fazer não apagam a última). **Decisão fora do plano:** a tarefa não usa o NetInfo (que só vive com o app aberto); o WorkManager já só a chama com rede, e se a `api` não responder o cliente cai em `ErroDeRede`. **Risco que ficou:** se o app vivo em segundo plano e a tarefa rodarem em runtimes diferentes ao mesmo tempo, a renovação do token pode correr em dobro; a guarda é a de não rodar com o app na frente, e o envio em si é idempotente. **O que foi conferido (sem aparelho):** `tsc` estrito e ESLint do `mobile`, 237 testes (10 novos: app na frente, sem sessão, sem pessoa, sem fila, fila vazia, a pessoa pelo `GET /me`, a ordem de envio com a cópia baixada, o app vivo, o sem sinal e o reenvio sem duplicar, o registro e o texto do perfil), `expo-doctor` (20/20) e o pacote Android do Metro (o nome da tarefa está no bundle). **Não conferido:** o Android acordando o app fechado de verdade (WorkManager, a economia de bateria do fabricante, que pode adiar ou barrar), o tempo que a passada leva e o `AppState` no processo sem tela (conferido no código do React Native: sem atividade em primeiro plano ele vale `background`, e a tarefa depende disso). |
| 20 (pendência 7) | 19/10/2026 | **Feito: o Dockerfile que gera o APK.** **Peças:** `mobile/Dockerfile` (contexto na raiz, por causa do `shared/`; `node:24-bookworm-slim` em `linux/amd64`, JDK 17, command-line tools do Android, pnpm; as versões do SDK, do Build Tools e do NDK vêm de `node_modules/react-native/gradle/libs.versions.toml`, e o que o `sdkmanager` não achar o Gradle baixa), `mobile/docker/gerar-apk.sh` (valida o endereço da `api`, escolhe a chave, `expo prebuild`, `gradlew assembleRelease`, confere com o `apksigner` e mostra a impressão digital), `mobile/Dockerfile.dockerignore` (só `mobile/` e `shared/`; sem `.env`, `.keystore` nem `android/`), `mobile/plugins/assinatura-android.js` (plugin do Expo: o `release` do Gradle lê `SYNQOS_KEYSTORE`, `SYNQOS_KEYSTORE_SENHA` e `SYNQOS_CHAVE_ALIAS` do ambiente; sem elas nada muda; falha alto se o template do Expo mudar), `scripts/gerar-apk.ts` + `scripts/apk-comando.ts` (`pnpm apk`: monta e roda o `docker build`; `--simular` só mostra), `app.config.ts` (`APP_VERSION_CODE` vira o `versionCode`) e `.gitattributes` (LF no script e no Dockerfile). **Decisões fora do plano:** (1) o APK sai **no `docker build`**, num estágio `saida` (`FROM scratch`) exportado com `--output type=local`, e não num `docker run` com volume: assim a chave e a senha entram como **segredos do BuildKit** (`--secret`), que não ficam na imagem; (2) sem a chave da empresa, o build gera uma **chave descartável de demonstração** com aviso no log (cada build gera outra: instalar por cima de um APK anterior exige desinstalar), em vez de falhar, para a demo não depender de um arquivo; a chave da empresa se gera uma vez com o `keytool` e fica fora do repositório; (3) o endereço da `api` é **obrigatório** e `http://` é recusado sem `APP_PERMITIR_HTTP=true`, para o APK de produção não sair apontando para o `localhost`; (4) arquiteturas padrão `arm64-v8a,armeabi-v7a,x86_64` (`--arquiteturas` reduz). **O que foi conferido (sem Docker, que não existe nesta máquina):** `tsc` estrito e ESLint do `mobile`, 245 testes (8 novos: o comando do docker, as recusas, o plugin sobre o trecho do template e sua idempotência), `pnpm apk --simular`, e o `expo prebuild` real com o plugin (o `build.gradle` gerado tem a chave de release e o `versionCode` de `APP_VERSION_CODE`; o projeto foi apagado depois) e a leitura das versões do SDK no arquivo do React Native (37, 37.0.0, NDK 27.1.12297006). **Não conferido:** o `docker build` inteiro (a imagem, o download do SDK, o Gradle, o R8 do release e o `apksigner`) e a instalação do APK num aparelho; o nome do pacote do `platforms;android-37` no `sdkmanager` (se diferir, o Gradle baixa a plataforma sozinho). Quem tiver Docker deve rodar `pnpm apk --simular` e depois o build de verdade e conferir o `synq-os.apk`. |
| 20 (pendência 8) | 19/10/2026 | **Feito: a conquista de sincronização offline.** Só na `api` (o app não mudou: já manda a fila por `POST /eventos`). **Peças:** `evento_campo.offline` (migração `0037_sincronizacao_offline`; a `api` preenche pela regra dos 60 s, o aparelho não diz nada), o critério `sincronizacoes_offline` em `dominio/conquistas.ts` (conta OS distintas), a conferência ao aplicar cada evento da fila em `processarEventos` e a conquista "Sem sinal, sem problema" (`seed/sincronizacao-offline-dados.ts` e `-imagens.ts`). **Decisão fora do plano:** o troféu vale **0 ponto**, porque a regra 2.2 de [gameficacao.md](../base/funcionalidades/gameficacao.md) diz que sincronizar não pontua; o admin pode mudar no cadastro. A migração marca os eventos antigos e dá o troféu a quem já tinha trabalhado sem sinal. **Conferido:** `tsc`, 924 testes da `api` (5 novos) e `pnpm db:test`. **Não conferido:** o aparelho real enviando a fila. Detalhes na seção 14 do gameficacao.md. |

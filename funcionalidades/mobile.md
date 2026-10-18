# App Android (`mobile`) — plano de implementação em 20 etapas

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
| 1 | Preparação: decisões D1 a D6 e ajuste da `api` para a D1 | Fundação | 1 | [ ] |
| 2 | Esqueleto do projeto Expo | Fundação | 1 | [ ] |
| 3 | Código compartilhado com a web (`shared/`) | Fundação | 1 | [ ] |
| 4 | Cliente da `api` e sessão | Fundação | 1 | [ ] |
| 5 | Login, primeiro acesso e situação da conta | Fundação | 1 | [ ] |
| 6 | Casca do app: navegação, componentes, formulários e conexão | Fundação | 1 | [ ] |
| 7 | Assinatura do perfil | Campo online | 3 | [ ] |
| 8 | Lista das OS da equipe | Campo online | 1 | [ ] |
| 9 | Detalhe da OS | Campo online | 1 | [ ] |
| 10 | Câmera, fotos, PDFs e envio de arquivos | Campo online | 2 | [ ] |
| 11 | APR: modelo, participantes e riscos | Campo online | 2 | [ ] |
| 12 | APR: checklist, validação e evidências | Campo online | 2 | [ ] |
| 13 | Assinatura e recusa da APR | Campo online | 2 | [ ] |
| 14 | Execução: iniciar, pausar, suspender, interromper e cancelar | Campo online | 2 | [ ] |
| 15 | Encerramento em dois passos e checklist de inspeção | Campo online | 2 | [ ] |
| 16 | Perfil, histórico, avisos e ausência | Campo online | 3 | [ ] |
| 17 | Gamificação e Vitória | Campo online | 3 | [ ] |
| 18 | Banco local, cópia da equipe e login sem sinal | Offline | 4 e 5 | [ ] |
| 19 | Fila, sincronização e envio em segundo plano | Offline | 4, 5 e 6 | [ ] |
| 20 | APK, conquista offline e roteiro da demo | Entrega | 7 e 8 | [ ] |

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
| | | |

# Funcionalidades — situação em 13/10/2026

> Registro de duas análises feitas em 13/10/2026: o estado das funcionalidades essenciais (o que a especificação exige para a demo) e o das funcionalidades extras (ideias do time e dos mentores, fora do MVP). Para cada uma, diz o que está pronto, o que falta e o que vale fazer primeiro.
>
> Fontes: [especificação](base/.design/especificacao.md), [DesignDoc](DesignDoc.md), [pontos a validar](base/.design/pontos-a-validar.md), [resumo da Reunião 2](base/reunioes/correcoes-reuniao-2-resumo.md), a [transcrição da Reunião 2](base/reunioes/Transcricao_Reuniao2.md) e o registro da [entrega de 13/10](Entrega-2026-10-13.md).

## Resumo

- A `api` e a `web` cobrem o fluxo inteiro **online**: ler a OS → APR → executar → PDF, com painel, alertas, indicadores e auditoria.
- O que falta das essenciais é o **app `mobile`** (Android), e com ele o **modo offline**. A especificação exige os dois no critério de sucesso da demo.
- Das extras, as três ligadas ao fluxo já estavam prontas (OS de apoio, assinatura no perfil, equipe automática). As demais não tinham começado.
- **Decisão de 13/10/2026:** antes do app, implementar duas extras: a **evidência em PDF** e o **catálogo de serviço com os materiais** (seção 3).
- **Decisão de 14/10/2026:** o catálogo ganha a **conferência de materiais na APR**: o item obrigatório exige a foto do item, e sem ela a APR é bloqueada. O controle de estoque foi descartado (seção 4).

---

## 1. Funcionalidades essenciais

### 1.1 Estado por fatia da especificação

Na ordem de implementação da especificação.

| Fatia | Situação |
|---|---|
| Plataforma | **Pronta.** Monorepo, Dockerfiles, `docker-compose`, migrações, buckets privados, fila de tarefas e modo local sem Supabase (`pnpm dev:local`) |
| Usuário e Equipe | **Pronta.** Login pelo e-mail institucional, troca de senha no primeiro acesso, perfis `tecnico` e `admin`, supervisor apontado pela equipe, cadastro de técnico pelo supervisor com liberação do admin, Campo de treino, assinatura no perfil e auditoria |
| Integração SAP | **Pronta com o simulador**, a planilha e o PDF da OS. Falta o contrato da API real (questão 43, do Iago). A digitalização pela câmera ainda é só protótipo |
| Modelo de APR | **Pronta.** 8 modelos da carga inicial, versões imutáveis, editor, tabela de atividades e arquivamento |
| Eventos | **Pronta na `api`.** `POST /eventos` idempotente, `POST /sync/pull` (snapshot da equipe) e tolerância à fila offline. Hoje só a web usa |
| APR | **Pronta na web.** Checklist inteiro, validação no servidor (`POST /aprs/avaliar`), evidência pedida só depois e APR bloqueada registrada na validação |
| Execução | **Pronta na web.** Pausa com motivo, suspender, interromper por risco, cancelar por engano, assinaturas e PDF de 2 páginas |
| Impedimento | **Pronta.** OS pendente, alerta no painel e por e-mail, reprogramação e OS de apoio |
| Painel | **Pronta.** Quadro, detalhe da OS, ciência, 4 dashboards (com o tempo de execução), exportação para baixa no SAP e busca global |
| **App mobile e modo offline** | **Não iniciados.** A pasta [`mobile/`](mobile/) só tem o README |

Validação registrada na entrega de 13/10: 366 testes da `api`, `tsc`, `eslint` e `next build` sem erros.

### 1.2 Lista "Funcionalidades essenciais" do DesignDoc

| Funcionalidade | Situação |
|---|---|
| Validar a permissão de executar a OS depois da análise da APR | **Pronta** (`api` e web) |
| Documentação comprobatória do obstáculo (imagem, PDF…) por item reprovado | Era **parcial**: só foto ou texto. O PDF entra nesta rodada (seção 3) |
| Sincronização automática e manual dos dados offline | **Só na `api`.** Falta o cliente: o app com a fila local |
| Token temporário guardado no aparelho para o login offline | **Não feito.** Depende do app |
| Ler a equipe definida na OS (atribuição automática) | **Pronta.** A equipe sai do centro de trabalho da OS |

### 1.3 As essenciais estão prontas?

**No navegador, sim.** O caminho ler OS → APR → executar → PDF funciona de ponta a ponta.

**Pelo critério da especificação, não.** A seção "Sucesso" pede esse caminho "no app Android e no navegador" e, como contingência, "num Android em modo avião". Essa parte está em 0%.

### 1.4 Próxima funcionalidade essencial: o app mobile, começando pelo modo online

Por quê:

1. **É a única fatia sem código** e faz parte do critério de sucesso. Sem o app não há demo de campo, nem online nem sem sinal.
2. **A `api` já está pronta para ele.** O envio idempotente, o snapshot da equipe, a regra dos 60 s para a fila offline e o envio da fila por usuário desativado estão feitos e testados. O app é basicamente um cliente.
3. **É o maior risco de prazo**, como a própria especificação diz. O contrato dos eventos é a decisão mais difícil de desfazer, e um cliente de verdade, com fila, o prova enquanto ainda não existe aparelho com fila pendente.
4. **As outras frentes dependem de terceiros:** a API real do SAP espera o contrato do Iago, a leitura do PDF real espera um exemplo com texto e a regra da OS sem atividade espera uma decisão do time.

Ordem sugerida:

1. Esqueleto React Native para Android, login pelo e-mail e lista e detalhe das OS da equipe. Primeira escolha: Expo (recomendado: câmera, SQLite, armazenamento seguro e APK gerado localmente) ou React Native puro.
2. APR e execução online, com os mesmos `POST /aprs/avaliar` e `POST /eventos` da web, câmera e assinatura nativas. As telas `/app/*` da web são a referência de layout.
3. Modo offline: fila em SQLite, `POST /sync/pull`, login de contingência e o aviso "N registros pendentes".
4. Dockerfile que gera o APK.

### 1.5 Pendências pequenas, antes ou em paralelo

- **Decidir o modelo da APR para OS sem atividade.** Hoje o técnico escolhe o modelo, e o time já considerou isso errado. Se o app nascer assim, repete o problema. Precisa estar decidido antes da etapa 2 do app.
- **Documentação desatualizada.**
  - O [README](README.md) ainda diz que as telas "não são módulos funcionais conectados" e que a arquitetura "não está implementada".
  - Também diz que o cadastro pelo supervisor e o Campo de treino estão "planejados", e os dois já foram feitos.
  - A seção "Situação" da [especificação](base/.design/especificacao.md) diz que só a `web` tem código.
- **Carga de demonstração:** o `popularDemo` quebra entre meia-noite e 2h. Só importa se a demo for preparada nesse horário.

---

## 2. Funcionalidades extras

Ideias do [DesignDoc](DesignDoc.md) ("Prioridades" e "Extras") e sugestões da Reunião 2. Nenhuma é exigida pela especificação: a questão 45 e o resumo da Reunião 2 as deixam fora do MVP, guardadas para a apresentação final.

### 2.1 O que está pronto

| Ideia | Origem | Situação |
|---|---|---|
| OS de apoio | DesignDoc (prioridades) | **Pronta** |
| Assinatura cadastrada no perfil (rubrica ou por extenso) | DesignDoc (prioridades) | **Pronta.** Desenhada no perfil, confirmada a cada uso e impressa no PDF. Não há certificado digital (ICP-Brasil); falta o Iago dizer se a assinatura desenhada vale para auditoria (questão 38) |
| Equipe atribuída automaticamente | DesignDoc (essenciais) | **Pronta.** A equipe sai do centro de trabalho da OS |
| Evidência em PDF, além de foto ou texto | DesignDoc (essenciais) | Não feita na análise (adiada na questão 46). **Implementada nesta rodada** (seção 3) |
| Catálogo de serviço com os materiais | DesignDoc (prioridades) | Não feito na análise: os materiais chegavam só como texto na descrição da OS. **Implementado nesta rodada** (seção 3) |
| Escaneamento de OS e APR antigas | DesignDoc (prioridades) | **Não feito.** A "Digitalização" da tela de importação só abre a câmera: não lê o texto nem grava |
| Intervalo entre ciclos das preventivas | DesignDoc (prioridades) | **Não feito.** Só existe o indicador mensal (preventivas encerradas e atrasadas, com ou sem justificativa). O plano e o item de manutenção já ficam gravados na OS |
| Chatbot de consulta | Iago, na Reunião 2 | **Não feito.** Os exemplos dele ("o que eu executei em maio", "tudo o que a equipe X executou em 2025") já se respondem por filtro, em "Meus resultados" e na exportação do dashboard de OS |
| Gamificação | Time, na Reunião 2 | **Feita em 13/10/2026** (`api` e web): pontos por tarefa, patentes e ranking por temporada, conquistas e anonimato; as regras estão no [gameficacao.md](gameficacao.md) e o contrato na [especificação](base/.design/especificacao.md#gamificação). O app a recebe quando existir |
| API de funcionários para cadastro rápido | DesignDoc (extras) | **Não feita.** As contas são criadas uma a uma, pelo admin ou pelo supervisor |

### 2.2 Vale a pena fazer antes do app?

**A recomendação da análise foi não**, por três motivos:

1. **Já estava decidido.** A questão 45 e o resumo da Reunião 2 deixam essas ideias fora do MVP, e o app faz parte do critério de sucesso.
2. **Metade depende de algo que o time não tem:**
   - catálogo: a lista de materiais por serviço, e o Iago disse que os códigos do plano vão mudar;
   - escaneamento: leitura de texto em imagem (OCR), e os exemplos de OS são só imagem;
   - API de funcionários: não existe sistema de RH nem contrato;
   - assinatura certificada: a resposta da questão 38.
3. **O app é o maior risco de prazo.** Cada semana em extras sai do tempo dele.

O time decidiu, mesmo assim, implementar já as duas da seção 3.

### 2.3 Depois do app, as que valem

- **Chatbot: a melhor escolha.** É a única pedida pelo cliente e roda sobre a web pronta. Antes, decidir quem fornece a IA: no protótipo, mandar dados fictícios a um serviço externo não tem problema, mas no piloto a empresa precisa aprovar (LGPD). O chatbot deve consultar pelas mesmas rotas da `api`, com o token de quem pergunta: herda as permissões, e o técnico não descobre por ele o que é eliminatório.
- **Intervalo das preventivas: em segundo lugar.** Os dados já existem (plano, item e datas de encerramento); caberia como seção do dashboard de OS. O risco é a mudança nos códigos do plano quebrar o agrupamento.
- **Gamificação: feita em 13/10/2026, com o cuidado que a análise pedia.** Premiar a quantidade de OS empurraria a equipe a apressar a APR, o contrário do que o sistema protege. A regra central é que a segurança nunca custa pontos: APR bloqueada e execução interrompida por risco valem o mesmo que as outras, nenhuma regra olha a resposta de um item (o técnico continua sem saber o que é eliminatório) e a APR do mesmo serviço não soma de novo a cada tentativa.

A ordem só se inverteria se a próxima apresentação aos mentores caísse antes de o app ter algo para mostrar: aí o chatbot seria a vitrine mais rápida.

---

## 3. Extras implementadas nesta rodada

### 3.1 Evidência em PDF

**Estado:** em implementação.

### 3.2 Catálogo de serviço com os materiais

**Estado:** em implementação.

---

## 4. Conferência de materiais na APR

**Data:** 14/10/2026. **Estado:** implementada na `api`, na web e no Campo de treino. Fica registrada só aqui, não na especificação.

### 4.1 De onde veio e o que se decidiu

A ideia inicial era um controle de "empréstimo": o admin cadastraria quantas unidades de cada equipamento a empresa tem, o técnico escolheria o que levaria depois da APR, e o sistema validaria se ainda havia saldo. A conversa reduziu o escopo a três funções e **descartou o controle de estoque**:

1. **Registrar os materiais por atividade.** Já existia (catálogo de serviço, seção 3.2); ganhou o indicador de item obrigatório.
2. **Mostrar os materiais recomendados na OS.** Já existia (cartão "Materiais e ferramentas" do detalhe da OS); ganhou o selo "Obrigatório".
3. **Validar se o técnico levou tudo.** É a parte nova: a conferência na revisão da APR.

Por que o estoque ficou de fora:

- **A foto vale mais que o saldo.** Como a foto do item em mãos libera o técnico mesmo com o estoque zerado, o saldo nunca barraria quem tem o item, e só quem está sem ele seria barrado, o que a foto já faz.
- **Offline.** Sem saldo em tempo real não há o que conferir: a lista vai no snapshot e a foto sobe pela fila de arquivos.
- **Sem virar almoxarifado.** Contar quantas unidades a empresa tem, quem as retirou e a devolução é trabalho do SAP e de um almoxarifado, não do D.A.P.R.O.M.

O sistema passa a dizer **quais itens o serviço pede e quais precisam de prova**, e não quantos a empresa tem. O "cadastro por entidade" que se pensou é o banco de dados (`material`, `atividade_material`, `apr_material`), e não um cadastro de cada unidade.

### 4.2 Como funciona

- **Admin.** No editor do serviço (Catálogo › Serviços), cada item da lista tem a caixa "Obrigatório". Mudar só isso entra na auditoria (`atividade.materiais`, com o antes e o depois).
- **Técnico, antes de sair.** O detalhe da OS lista os materiais, com o selo "Obrigatório" e o aviso de que eles exigem foto na APR.
- **Técnico, na APR.** Depois de responder o checklist, a revisão traz o cartão "Materiais do serviço": para cada item, "Levei" ou "Não levei"; há o botão "Levei os itens opcionais". No item obrigatório, ao marcar "Levei" o técnico envia a foto do item (a foto só vale para aquele item). O técnico sabe quais itens são obrigatórios; isso não é como o item eliminatório da APR, que ele não vê. "Concluir e validar" só libera quando todos os itens foram respondidos e todo obrigatório levado tem a foto.
- **Bloqueio.** O item obrigatório **não levado, ou levado sem a foto, bloqueia a APR** (também se nem veio na conferência). O bloqueio segue o caminho do item reprovado: a APR fica registrada como bloqueada na validação, a OS fica pendente, o supervisor recebe o alerta no painel e o e-mail (que lista os materiais sem comprovação). Não há evidência a completar: o técnico vê o que faltou e refaz a APR quando estiver com o item. O bloqueio é na APR, não na execução.
- **Os demais itens** só são conferidos ("levei" ou "não levei"), sem foto e sem bloquear.
- **Quem decide é o servidor.** O resultado é recalculado a partir da lista atual do serviço; o que o aparelho diz sobre `resultado` não vale.
- **OS sem atividade, ou serviço sem item obrigatório:** nada muda. A conferência só aparece quando a OS tem uma lista.
- **Offline.** `atividades[].materiais` do snapshot já leva `obrigatorio`. Da fila offline, o item que o admin tirou da lista enquanto o aparelho estava sem sinal é ignorado em vez de recusar a APR; online, é recusado.
- **Histórico.** O detalhe da OS (painel e técnico) e o alerta de bloqueio mostram a conferência, com as fotos e o que faltou.

### 4.3 O que mudou no código

- **Banco.** Migração `0018_apr_materiais`: coluna `atividade_material.obrigatorio` e tabela `apr_material` (por APR e material: `obrigatorio` como estava na hora, `levou`, a foto e a posição). O material que já foi conferido numa APR não é excluído (`409 material_em_uso`): desative-o.
- **API.** `PUT /catalogo/servicos/{codigo}` aceita `obrigatorio` por item. `POST /aprs/avaliar` e o evento `apr_concluida` aceitam `materiais: [{material_id, levou, foto?}]` (a foto sobe antes, com `PUT /arquivos/{id}` e `tipo=foto`). `POST /aprs/avaliar` devolve `materiais_faltando`. Os erros novos são `material_invalido`, `material_repetido`, `foto_sem_material` e `arquivo_ausente` (o evento fica pendente). A foto é lida por `GET /arquivos/{id}/url`, com a regra de equipe das demais evidências. Código em `api/src/dominio/apr-materiais.ts`.
- **Web.** Editor do serviço, selo e aviso no detalhe da OS, cartão `ConferenciaDeMateriais` na revisão, tela de impedimento com os materiais, histórico e alerta de bloqueio.
- **Campo de treino.** A API fictícia espelha a regra; a "Vestimenta antichama" da OS guiada é obrigatória, e o passo "Revise e valide" do tutorial explica a conferência.
- **Carga de demonstração.** O detector de gases e o respirador são obrigatórios nas listas fictícias; as APRs da demonstração fazem a conferência, e uma OS nova ("Aferição de manômetro padrão") está pendente por material sem comprovação.

### 4.4 O que ficou de fora

- **Estoque, saldo e devolução**, pelas razões da seção 4.1.
- **Pesquisar e levar um material fora da lista.** Estava na ideia inicial; a lista final de três funções não o inclui. Dá para acrescentar depois (e o que o técnico leva a mais diria ao admin o que o serviço usa de verdade).
- **Os materiais no PDF da OS.** O PDF continua com a página da APR e a da OS, sem a conferência.
- **Cadastro de cada unidade** (patrimônio, série, validade da calibração): só faria sentido para o instrumento calibrável.

### 4.5 Pontos em aberto

- **Pontos da gamificação.** A APR bloqueada por material pontua como qualquer APR bloqueada (a pontuação não olha a conferência). Não se mexeu na gamificação; se a regra precisar mudar, discutir antes e registrar no [gameficacao.md](gameficacao.md).
- **Lista real de materiais.** Os itens obrigatórios dependem da lista que a ES Gás vai passar por serviço (questão 65 da especificação); até lá, o catálogo real não tem nenhum item obrigatório e nada bloqueia.

### 4.6 Como foi verificado

- `api`: `tsc` e a suíte de testes, com o novo [apr-materiais.test.ts](api/test/apr-materiais.test.ts) (conferência, bloqueio, alerta e e-mail, offline, leitura da foto e catálogo).
- Web: `tsc`, `eslint` e `web/scripts/verificar-treino.mts` (a API fictícia, sem navegador).
- Sem teste no navegador: as telas foram conferidas por código, tipos e lint.

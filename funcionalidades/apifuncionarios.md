  # API de funcionários — decisões de 14/10/2026

> Registro do desenho da API de funcionários: o registro geral dos funcionários da empresa, que o SYNQ OS consulta para cadastrar usuários e para saber de desligamentos. A API de RH é simulada, com uma tela própria, para mostrar como o fluxo final funcionaria dentro da empresa. Este documento reúne o objetivo, as decisões, o contrato, as mudanças no cadastro, o desligamento, a tela do simulador, a proposta de dados e rotas e a ordem de implementação.
>
> **Situação:** implementado em 14/10/2026 (`api` e `web`). As diferenças entre o que se decidiu e o que ficou estão na seção 13.
>
> Fontes: a conversa de 14/10/2026; a extra "API de funcionários" em [funcionalidades.md](funcionalidades.md) (seção 3.3); as seções Usuário e Equipe e Cadastro pelo supervisor da [especificação](base/.design/especificacao.md); o simulador do SAP, que serve de modelo (ver também [apiSAP.md](apiSAP.md)).

## Resumo

- **Só funcionário da empresa vira usuário.** O admin ou o supervisor informa o e-mail institucional e a matrícula. O SYNQ OS consulta o registro e copia o nome, o cargo e o registro profissional. O cadastro é recusado se a matrícula não estiver no registro, se o e-mail não for o dela ou se o funcionário estiver desligado ou afastado.
- **O registro é a fonte dos dados pessoais.** No SYNQ OS, nome, e-mail, cargo e registro profissional deixam de ser digitados ou editados. O SYNQ OS decide só o perfil, a equipe, a liberação, se a conta está ativa e a senha.
- **O desligamento vale em tempo real.** O registro avisa o SYNQ OS no momento do desligamento, e a conta é desativada em segundos. Uma vez por dia, uma leitura completa atualiza os dados e pega desligamentos cujo aviso não chegou.
- **Com o registro fora do ar, o cadastro para.** É melhor recusar do que deixar entrar alguém que não foi conferido.
- **É simulado, de propósito.** O registro serve para mostrar como o fluxo final funcionaria dentro da empresa. O SYNQ OS fala com ele por um cliente HTTP, com endereço e token configuráveis, como faz com o SAP.
- **A tela do simulador** fica em `/simulador/funcionarios`, só para o admin. Tem contador, criação manual e aleatória, tabela com seleção, ações em massa, "ver mais", editar e excluir.

---

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Onde fica a tela do simulador | Na web atual, fora do menu do SYNQ OS: `/simulador/funcionarios`, ao lado das ordens do SAP ([apiSAP.md](apiSAP.md)). Só para admin logado, com visual de sistema da empresa. |
| 2 | Que campos o registro tem | Os da seção 2.1, sem CPF: o SYNQ OS não usa CPF e ele chama atenção na LGPD, mesmo fictício. |
| 3 | O desligamento afeta o SYNQ OS? | Sim, em tempo real, pelo aviso do registro, mais uma leitura completa por dia (seção 5). |
| 4 | Nome, cargo e CREA ficam travados no SYNQ OS? | Sim, e o e-mail também. Só mudam pelo registro: pelo botão "Atualizar do registro" e pela leitura diária. |
| 5 | Quais ações em massa | Excluir, mudar o setor e mudar a situação. |
| 6 | O supervisor pode cadastrar alguém de outro setor? | Não. Ele só cadastra quem é de um setor cuja equipe ele supervisiona. |
| 7 | O que fazer com os usuários que já existem | Uma carga única cria no registro um funcionário para cada usuário atual (seção 7). |
| — | Onde ficam os dados do simulador | Numa tabela própria no banco, não na memória (seção 6.1). |
| — | E se o registro estiver fora do ar? | O cadastro fica bloqueado (`503`). |

**Mudança em relação ao diagnóstico:** lá, trocar o e-mail no SYNQ OS exigiria conferir com o registro. Ficou mais simples: o e-mail não é mais editado no SYNQ OS e sempre vem do registro.

## 2. O registro de funcionários

### 2.1 Campos

| Campo | Exemplo | Observação |
|---|---|---|
| Matrícula | `100231` | Única. Não muda depois de criada, porque é o vínculo com o SYNQ OS. |
| Nome completo | Ana Paula Ribeiro | |
| E-mail institucional | `ana.ribeiro@empresa.com.br` | Único, em minúsculas. É o login no SYNQ OS. |
| Cargo | Eletricista | Vira o `cargo` do SYNQ OS, impresso sob a assinatura na OS. |
| Setor | `SERV_ESP` · Serviços Especiais | Código do centro de trabalho e nome. Casa com `equipe.centro_trabalho`. |
| Registro profissional | CREA ES-050003/D | Opcional. |
| Situação | ativo, afastado ou desligado | Seção 2.2. |
| Data de admissão | 12/03/2018 | |
| Data de nascimento | 04/07/1990 | |
| Telefone corporativo | (27) 3200-1234 | |
| Gestor imediato | matrícula de outro funcionário | Sem chave estrangeira. A tela mostra o nome. |
| Lotação | Vila Velha/ES | |

Na tabela da tela aparecem nome, e-mail, matrícula e setor. O resto fica no "ver mais".

### 2.2 Situações e o efeito no SYNQ OS

| Situação no registro | Cadastro novo | Conta que já existe |
|---|---|---|
| ativo | permitido | nada muda |
| afastado | recusado (`409 funcionario_afastado`) | Nada muda. O afastamento é temporário (férias, licença), e tirar e devolver o acesso automaticamente criaria idas e vindas sem ganho de segurança. |
| desligado | recusado (`409 funcionario_desligado`) | A conta é desativada na hora (seção 5). |
| fora do registro (a matrícula sumiu) | recusado (`404 funcionario_nao_encontrado`) | Tratada como desligada. |

**Regra geral: o automático só tira acesso; quem dá acesso é sempre uma pessoa.** Se o funcionário voltar a ficar ativo no registro (readmissão), a conta não é reativada sozinha. O admin reativa no SYNQ OS, e só consegue se o registro disser que a pessoa está ativa.

### 2.3 Setores e cargos

O simulador tem uma lista fixa de setores:

- os três centros de trabalho das equipes de demonstração: `SERV_ESP`, `INSTRUM` e `LAB_QUI`;
- alguns sem equipe no SYNQ OS, por exemplo Manutenção Elétrica, Manutenção Mecânica e Administrativo. Eles servem para mostrar o caso "sem equipe correspondente".

Cada setor tem os seus cargos (Eletricista, Mecânico, Instrumentista, Técnico em Gás, Técnico em Instrumentação, Químico, Engenheiro Mecânico, Técnico de Segurança e outros). O gerador aleatório sorteia o cargo entre os do setor. No cadastro manual, o cargo é um texto livre com essas sugestões.

## 3. Contrato

É o que o SYNQ OS usa do registro. O contrato segue o formato do contrato do SAP (`snake_case`, paginação por `proxima_pagina`).

**Consulta.** O SYNQ OS chama o registro com `Authorization: Bearer {RH_API_TOKEN}`:

`GET {RH_API_URL}/funcionarios/{matricula}` → `200` funcionário, ou `404`
`GET {RH_API_URL}/funcionarios` `?pagina&tamanho` → `200` `{funcionarios[], proxima_pagina?}`. É a leitura diária.

Formato do funcionário: `{matricula, nome, email, cargo, centro_trabalho, setor, registro_profissional, situacao, data_admissao, data_nascimento, telefone, gestor_matricula, lotacao}`.

**Aviso.** O registro chama o SYNQ OS com `Authorization: Bearer {RH_AVISO_TOKEN}`:

`POST {SYNQ OS}/rh/avisos` `{matriculas: ["100231", ...]}` → `202`

- **O aviso não traz decisão, só a lista de matrículas a conferir.** O SYNQ OS consulta cada matrícula no registro e age pelo que a consulta responder. Assim, um aviso falso não desativa ninguém.
- **O simulador avisa quando um funcionário passa a desligado**, seja pela edição, seja por uma ação em massa.

## 4. Cadastro no SYNQ OS

### 4.1 Fluxo em duas etapas

1. **Consultar.** O admin ou o supervisor informa a matrícula e o e-mail, e a web chama `GET /rh/funcionarios/{matricula}?email=`. A resposta é uma prévia com nome, cargo, setor, CREA, situação, a equipe sugerida e se a pessoa já tem conta.
2. **Confirmar.** O admin escolhe o perfil, confirma ou troca a equipe (que já vem preenchida pelo setor) e define a senha inicial; a web chama `POST /usuarios`. O supervisor não escolhe nada disso: o perfil é sempre técnico e a equipe é a do setor.

**No `POST`, a `api` consulta o registro de novo.** Ela não confia na prévia: os dados gravados são sempre os da consulta feita no momento do cadastro.

### 4.2 Respostas de erro

| Caso | Resposta |
|---|---|
| Matrícula fora do registro | `404 funcionario_nao_encontrado` "Matrícula não encontrada no registro de funcionários" |
| E-mail diferente do e-mail da matrícula | `422 email_nao_confere`. A mensagem não revela qual é o e-mail certo. |
| Funcionário afastado ou desligado | `409 funcionario_afastado` ou `409 funcionario_desligado` |
| Matrícula que já tem conta | `409 matricula_duplicada`, como hoje |
| Supervisor tentando cadastrar alguém de setor sem equipe dele | `403 fora_da_supervisao` "Este funcionário é do setor X, que você não supervisiona" |
| Registro fora do ar ou não configurado | `503 registro_indisponivel` |

### 4.3 O que muda nas regras atuais

- **`POST /usuarios`:** o corpo passa a ser `{matricula, email, perfil?, equipe_id?, senha_inicial}`. Saem `nome`, `cargo` e `registro_profissional`.
- **`PATCH /usuarios/{id}`:** saem `nome`, `email`, `cargo` e `registro_profissional`. O admin altera só o perfil, a equipe e se a conta está ativa. Para reativar (`ativo: true`), a `api` consulta o registro; se a pessoa estiver desligada, responde `409 funcionario_desligado`.
- **Supervisor:** hoje ele edita o nome, o cargo e o registro do técnico pendente que cadastrou. Isso acaba, porque esses dados vêm do registro. Ele continua podendo cancelar o cadastro pendente.
- **Rota nova `POST /usuarios/{id}/atualizar-do-registro` (só admin):** copia do registro o nome, o e-mail, o cargo e o registro profissional. Trocar o e-mail troca também o login, como o `PATCH` faz hoje. Se o registro disser que a pessoa está desligada, a conta é desativada.
- **Não muda:** perfis, equipes, a liberação dos pendentes, a senha provisória e o Campo de treino. O app também não muda, porque não tem cadastro, e o modo treino não simula cadastro.

## 5. Desligamento em tempo real e leitura diária

### 5.1 O aviso

1. No simulador, um funcionário passa a desligado (pela edição ou por uma ação em massa).
2. O simulador chama `POST /rh/avisos` com as matrículas.
3. O SYNQ OS responde `202` e, para cada matrícula que tem conta, enfileira uma tarefa `conferencia_rh`, cuja referência é o id do usuário. Matrícula sem conta é ignorada.
4. O executor de tarefas, que roda a cada 5 segundos, consulta o registro e aplica o resultado (seção 5.3). Se o registro estiver fora do ar, a tarefa tenta de novo depois de 1, 5, 15 e 15 minutos, como as outras tarefas.

### 5.2 A leitura diária

- **Quando:** uma vez por dia, às `RH_LEITURA_HORA` horas (padrão: 3h, no horário de São Paulo, o fuso que a `api` já usa).
- **O que lê:** o registro inteiro, página por página, e confere todos os usuários do SYNQ OS pela matrícula. Lê tudo, e não só os alterados, para pegar também quem sumiu do registro.
- **"Ler agora":** o admin pode pedir uma leitura fora de hora com `POST /rh/leituras`. É útil na demonstração.
- **Histórico:** cada leitura é gravada na tabela `leitura_rh`. A tabela também garante uma leitura por dia, mesmo que a `api` reinicie. `GET /rh/sincronizacao` devolve a última leitura, quando aconteceu e o resultado (conferidos, atualizados, desativados e erro).
- **Falha:** tenta de novo como as outras tarefas. Se as tentativas acabarem, a falha fica no histórico com o erro e aparece no cartão de sincronização. Nesta etapa não há alerta no sino.
- **Trava de segurança:** se uma leitura for desativar mais da metade dos usuários ativos, ela não aplica nada e termina com erro. Isso protege contra um registro vazio ou mal configurado.

### 5.3 O que a conferência faz com cada usuário

O aviso e a leitura diária fazem a mesma conferência, uma pessoa por vez:

- **Dados:** atualiza o nome, o e-mail (e o login junto), o cargo e o registro profissional, se mudaram.
- **Situação:** grava a situação no registro e quando ela foi conferida (`usuario.situacao_registro` e `usuario.registro_conferido_em`).
- **Desligado ou fora do registro, com a conta liberada e ativa:** desativa a conta, do mesmo jeito que a desativação pelo admin.
  - A `api` passa a recusar a pessoa na hora (`401 acesso_revogado`).
  - O app ainda envia a fila offline pendente e, depois disso, a sessão é revogada. É a regra atual de `POST /eventos`.
- **Desligado ou fora do registro, com a conta pendente de liberação:** a conta vira recusada, com o motivo "Desligado no registro de funcionários".
- **Afastado:** só grava a situação.
- **Último admin ativo:** a conferência nunca desativa o último admin ativo. Nesse caso, grava a situação e deixa a decisão para uma pessoa.
- **Auditoria:** tudo entra na auditoria com o ator "Registro de funcionários". Para isso, a auditoria passa a aceitar um ator de sistema (`ator_id` nulo).
- **Equipe cujo supervisor foi desligado:** os alertas passam a ir para os admins, como já acontece com supervisor desativado (`destinatariosDaEquipe`).

### 5.4 Na tela de usuários do SYNQ OS

- O selo "Desligado no registro" ou "Afastado" aparece na tabela e no perfil.
- O admin vê um cartão "Registro de funcionários" com a última leitura e o botão "Ler agora".

## 6. O simulador

### 6.1 Onde ficam os dados

Ficam na tabela `funcionario_simulado`, no banco do SYNQ OS, criada por migração e separada das tabelas do SYNQ OS.

Guardar na memória, como o simulador do SAP faz hoje, não serve. No ambiente publicado, os usuários do SYNQ OS ficam no Postgres: um reinício apagaria o registro, e os usuários perderiam o vínculo com ele. A tabela existe em todos os ambientes e fica vazia quando `RH_SIMULADO=false`.

### 6.2 Rotas do simulador

As rotas só existem com `RH_SIMULADO=true` e ficam em `/rh-simulado`.

**Contrato** (com o token `RH_API_TOKEN`): `GET /rh-simulado/funcionarios` e `GET /rh-simulado/funcionarios/{matricula}`, no formato da seção 3.

**Gestão** (com o admin logado no SYNQ OS; servem à tela):

| Rota | O que faz |
|---|---|
| `GET /rh-simulado/gestao/funcionarios` `?busca&pagina&tamanho` | Lista com `total` e, em cada funcionário, `conta_no_synq_os` (perfil, equipe e se está ativa) ou `null`. |
| `GET /rh-simulado/gestao/catalogo` | Setores, cargos por setor e a próxima matrícula livre. |
| `POST /rh-simulado/gestao/funcionarios` | Cria um funcionário (manual) → `201`. |
| `POST /rh-simulado/gestao/funcionarios/aleatorios` `{lotes: [{quantidade, centro_trabalho?, cargo?, situacao?}]}` | Gera em lotes → `201` `{criados}`. No máximo 200 por envio. |
| `PATCH /rh-simulado/gestao/funcionarios/{matricula}` | Edita. A matrícula não muda. Passar para desligado dispara o aviso. |
| `DELETE /rh-simulado/gestao/funcionarios/{matricula}` | Exclui (seção 6.3). |
| `POST /rh-simulado/gestao/funcionarios/em-massa` `{matriculas[] ou todos_da_busca, acao, valor?}` | `acao`: `excluir`, `mudar_setor` ou `mudar_situacao`. Devolve `{afetados, recusados: [{matricula, motivo}]}`. |

**Aviso de saída:** quando um funcionário passa a desligado, o simulador chama `{RH_AVISO_URL}`. O padrão é a própria `api`, em `/rh/avisos`. Se o envio falhar, o simulador só registra no log, e a leitura diária cobre o que faltou.

### 6.3 Regras do simulador

- **Matrícula:** não muda depois de criada. A tela sugere a próxima livre: a maior matrícula numérica mais um, começando em `100001`.
- **E-mail:** único. No gerador aleatório, segue o padrão `nome.sobrenome@empresa.com.br` (já existe `emailDoNome`), com número quando houver nomes iguais (`ana.ribeiro2@...`).
- **Excluir:** só vale para quem não tem conta no SYNQ OS. Quem tem conta deve ser desligado, não excluído, como numa empresa de verdade; a resposta diz "Desligue o funcionário em vez de excluir". Na exclusão em massa, os que podem ser excluídos são excluídos e os demais voltam na lista de recusados.
- **Gerador:**
  - nomes e sobrenomes brasileiros sorteados de uma lista fixa;
  - cargo coerente com o setor, e CREA só nos cargos de engenharia;
  - datas plausíveis: admissão nos últimos 20 anos e idade entre 20 e 60 anos;
  - situação "ativo", a não ser que o lote peça outra;
  - o sorteio é injetável, para que os testes sejam reproduzíveis.

### 6.4 A tela

A tela fica em `/simulador/funcionarios`, na web, fora da casca do SYNQ OS. Tem cabeçalho próprio ("Sistemas da empresa · simulados"), com abas Funcionários e Ordens do SAP, e um link de volta ao SYNQ OS. Só o admin acessa.

- **Contador:** total de funcionários, com a divisão por situação.
- **"Novo funcionário"** (e não "novo usuário", para não confundir com os usuários do SYNQ OS): abre um menu com duas opções, e cada uma abre uma janela.
  - **Manual:** todos os campos. A matrícula vem sugerida, e setor e cargo são escolhidos em listas.
  - **Aleatório:** linhas de quantidade, setor, cargo e situação, com o botão "Adicionar linha". Assim, "10 mecânicos e 5 eletricistas" sai num envio só.
- **Busca** por nome, e-mail ou matrícula, e paginação.
- **Tabela:** caixa de seleção, nome completo (com os selos Afastado, Desligado e "No SYNQ OS"), e-mail, matrícula, setor, "Ver mais" e o menu de três pontos (Editar e Excluir).
- **"Selecionar todos"**, no cabeçalho da tabela, marca a página. Uma faixa oferece "Selecionar os N da busca".
- **Barra de ações em massa:** aparece quando há seleção, com Mudar setor, Mudar situação e Excluir. A confirmação informa quantos dos selecionados têm conta no SYNQ OS e o que vai acontecer com eles; desligar desativa a conta na hora.
- **"Ver mais":** janela com todos os campos e, se houver, a conta no SYNQ OS.
- **Cartão "Sincronização com o SYNQ OS":** mostra a última leitura diária e tem o botão "Ler agora", que chama `POST /rh/leituras`.

**Componentes compartilhados:** a tabela com seleção, a barra de ações em massa, o botão com menu de criação e a janela "ver mais" são feitos aqui e reaproveitados na tela do SAP ([apiSAP.md](apiSAP.md)).

**Ponte da web (`app/api/[...caminho]`):** hoje ela bloqueia todo o `/sap-simulado`. Passa a liberar só o `/gestao` de `/rh-simulado` e de `/sap-simulado`, que exige admin logado. As rotas do contrato continuam bloqueadas.

## 7. Carga inicial e usuários existentes

- **Modo local (`pnpm dev:local`) e demonstração (`pnpm demo:popular`):** cada usuário criado ganha o seu funcionário no registro, com a mesma matrícula, nome, e-mail e cargo, o setor da equipe e a situação ativo. Além deles, a carga cria uns 30 funcionários aleatórios sem conta, para demonstrar o cadastro.
- **Banco publicado:** um script de carga única cria no registro um funcionário para cada usuário existente, com a situação ativo. **Ele precisa rodar antes de a conferência ser ligada.** Sem isso, a primeira leitura diária trataria todo mundo como fora do registro. A trava da seção 5.2 impede o estrago, mas a leitura falharia todos os dias.

## 8. Dados (proposta)

**`funcionario_simulado`:** `matricula` (chave primária), `nome`, `email` (único, em minúsculas), `cargo`, `centro_trabalho`, `setor`, `registro_profissional`, `situacao` (`ativo` · `afastado` · `desligado`), `data_admissao`, `data_nascimento`, `telefone`, `gestor_matricula`, `lotacao`, `criado_em` e `alterado_em`.

**`usuario`, colunas novas:**

- `situacao_registro`: `ativo`, `afastado`, `desligado` ou `fora_do_registro`. Fica nula até a primeira conferência.
- `registro_conferido_em`.

**`leitura_rh`:** `id`, `origem` (`agendada` ou `manual`), `usuario_id` (quem pediu; nulo na agendada), `iniciada_em`, `concluida_em`, `conferidos`, `atualizados`, `desativados` e `erro`.

**`tarefa`, tipos novos:** `leitura_rh` e `conferencia_rh`.

**`auditoria`:** `ator_id` passa a aceitar nulo, para o ator de sistema ("Registro de funcionários"). Entra também a entidade nova `rh`, para a leitura pedida pelo admin.

**Configuração (`config.ts`):**

| Variável | O que é |
|---|---|
| `RH_SIMULADO` | Liga o simulador. |
| `RH_API_URL` | Endereço do registro. |
| `RH_API_TOKEN` | Token que o SYNQ OS usa para ler o registro. |
| `RH_AVISO_TOKEN` | Token que o registro usa para avisar o SYNQ OS. |
| `RH_AVISO_URL` | Para onde o simulador manda os avisos; só usada pelo simulador. |
| `RH_LEITURA_HORA` | Hora da leitura diária; padrão 3. |

Com `RH_SIMULADO=true`, endereços e tokens ganham valores padrão, como acontece com o SAP. No `docker-compose.yml`, `RH_SIMULADO` vem ligado por padrão. Sem registro configurado, o cadastro responde `503`.

**`Deps`:** ganha `rh: ClienteRh`, com `obterFuncionario(matricula)` e `listarFuncionarios({pagina, tamanho})`. A versão HTTP (`ClienteRhHttp`) segue a do SAP; os testes usam uma versão em memória.

## 9. Rotas do SYNQ OS (proposta)

| Rota | Quem chama | O que faz |
|---|---|---|
| `GET /rh/funcionarios/{matricula}` `?email=` | admin, supervisor | Prévia do cadastro (seção 4.1). |
| `POST /usuarios` | admin, supervisor | Corpo novo (seção 4.3). |
| `PATCH /usuarios/{id}` | admin | Sem os dados pessoais. Reativar consulta o registro. |
| `POST /usuarios/{id}/atualizar-do-registro` | admin | Copia os dados do registro. |
| `POST /rh/avisos` | o registro (com token) | `202`. Enfileira as conferências. |
| `POST /rh/leituras` | admin | `202` `{leitura_id}` ("Ler agora"). |
| `GET /rh/sincronizacao` | admin | Última leitura e resultado. |

## 10. Testes

- **Simulador:** contrato e paginação; criação manual; gerador (quantidade, filtros, e-mail e matrícula únicos, limite de 200); edição com matrícula fixa; exclusão recusada para quem tem conta; ações em massa com recusados; aviso disparado ao desligar.
- **Cadastro:** cada resposta da seção 4.2; a `api` consulta o registro de novo no `POST`; a equipe sugerida pelo setor; a regra de setor do supervisor; o `PATCH` sem os dados pessoais; a reativação recusada para desligado.
- **Desligamento:**
  - o aviso desativa a conta, e o pendente vira recusado;
  - um aviso falso não muda nada;
  - a leitura diária atualiza os dados e o login;
  - quem está fora do registro é desativado;
  - a trava de metade dos usuários;
  - o último admin é preservado;
  - uma leitura por dia, mesmo com reinício;
  - a auditoria com ator de sistema.
- **Testes que já existem:** cerca de 30 chamadas a `POST /usuarios` (em `usuarios`, `liberacao` e `auditoria`) passam a cadastrar o funcionário no registro em memória antes de criar o usuário. O ajudante `criarUsuario` (`test/ajuda.ts`) grava direto no banco e não muda.

## 11. Ordem de implementação

1. **Simulador na `api`:** tabela, catálogo, gerador, contrato, rotas de gestão e carga no modo local e na demonstração, com testes.
2. **Tela do simulador,** com os componentes compartilhados.
3. **Cadastro lendo o registro**, na `api` e na web: consulta, `POST` e `PATCH` novos, "Atualizar do registro", formulário em duas etapas e ajuste dos testes existentes.
4. **Desligamento:** aviso, conferência, leitura diária, "Ler agora", cartão de sincronização, selos e as travas de segurança, com testes.
5. **Carga única no banco publicado,** antes de ligar o passo 4 em produção.
6. **Documentação:**
   - na especificação: Usuário e Equipe, Cadastro pelo supervisor, as variáveis da Plataforma e a lista de ações da auditoria;
   - no [funcionalidades.md](funcionalidades.md): seções 3.3 e 3.4, onde hoje se lê "não existe sistema de RH";
   - no `api/README.md`.

## 12. Riscos e pontos em aberto

- **LGPD:** o registro usa apenas dados fictícios. O SYNQ OS só copia nome, e-mail, cargo e CREA.
- **Fora do escopo:**
  - alerta no sino quando a leitura diária falha;
  - mudar a equipe no SYNQ OS quando o setor muda no registro (a equipe é decisão do SYNQ OS; o setor só a sugere no cadastro);
  - reativar a conta automaticamente na readmissão.

## 13. Como ficou a implementação

O que foi feito segue as seções acima. Estes pontos, que o desenho deixava abertos ou que mudaram ao implementar, valem daqui em diante:

- **Prévia do cadastro:** `GET /rh/funcionarios/{matricula}` exige o parâmetro `email` (sem ele, `422`). Devolve `{funcionario, equipe_sugerida, conta_existente}`; quem já tem conta volta como `conta_existente: true` (a tela avisa), e não como `409`. As demais recusas são as da seção 4.2, na ordem: `404`, `422`, `409` (afastado e desligado) e `403` (supervisor).
- **Equipe no `POST /usuarios`:** o supervisor ignora `equipe_id` e cadastra na equipe do setor. O admin, sem `equipe_id` no corpo, cadastra na equipe do setor (se houver); com `null`, sem equipe.
- **`PATCH /usuarios/{id}`:** só o admin; campos que não existem mais (nome, e-mail, cargo, registro profissional) são recusados com `422`, e o supervisor recebe `403`. Reativar também grava a situação `ativo` e a hora da conferência. Quem sumiu do registro conta como desligado na reativação.
- **Aviso:** `POST /rh/avisos` responde `202` `{enfileiradas}`, aceita até 1000 matrículas, ignora quem não tem conta e não enfileira de novo uma conferência que já espera para a mesma pessoa. Sem `RH_AVISO_TOKEN` configurado, ninguém consegue avisar.
- **Leitura diária:** a `leitura_rh` ganhou a coluna `dia` (data de São Paulo), com índice único nas leituras agendadas: é o que garante uma por dia mesmo com reinício. O executor confere a cada minuto se já é hora (`RH_LEITURA_HORA`) e, se o dia ainda não tem leitura, cria a leitura e a tarefa na mesma transação. A leitura registra o erro a cada tentativa que falha; `GET /rh/sincronizacao` traz a `situacao` (`concluida`, `falhou`, `tentando_de_novo` ou `em_andamento`). A trava da metade não tenta de novo: termina com `concluida_em` e o erro.
- **Auditoria:** as ações da conferência entram com o ator "Registro de funcionários" (`ator_id` nulo): `usuario.atualizar_do_registro`, `usuario.desativar`, `usuario.recusar`, `usuario.situacao_registro` (a situação mudou sem efeito no acesso, como virar afastado) e `usuario.conferencia_bloqueada` (o último admin, ou um e-mail do registro que já é de outra conta). "Atualizar do registro" feito pelo admin entra com o nome dele, e o "Ler agora", como `rh.leitura`.
- **Simulador:** o aviso é enviado depois de gravar a mudança e só quando alguém passa a desligado de verdade (repetir o desligamento, afastar ou reativar não avisa). A exclusão de quem tem conta responde `409` `funcionario_com_conta`. A edição recusa a matrícula (`422`).
- **Ponte da web:** além de `/sap-simulado`, bloqueia o contrato de `/rh-simulado` e o `/rh/avisos`; libera só o `/gestao` dos dois simuladores.
- **Tela:** o cabeçalho "Sistemas da empresa · simulados" tem as abas Funcionários e Ordens do SAP. A tabela, a barra de ações em massa, o botão com menu de criação e a janela "ver mais" estão em `web/src/components/simulador` e são os mesmos da tela do SAP. O cartão de sincronização é o mesmo da tela de usuários do admin.
- **Carga:** `pnpm rh:carga-inicial` (`api/scripts/carregar-registro-rh.ts`) para o banco publicado; no modo local e na demonstração a carga é automática.
- **Testes:** `api/test/rh.test.ts` (cadastro, desligamento e leitura diária), `api/test/rh-simulado.test.ts` (contrato, gestão, gerador e carga), além dos testes de usuários, liberação e auditoria, que passaram a cadastrar o funcionário no registro em memória antes do `POST /usuarios`.

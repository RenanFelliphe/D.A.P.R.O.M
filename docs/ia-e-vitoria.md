# IA e Vitória

> Tudo o que usa IA no SYNQ OS: as quatro funções de IA, os provedores e a configuração, o controle por função feito pelo admin, a **Vitória** (a assistente que orienta o usuário), a recomendação do modelo de APR guardada por OS e a digitalização de OS antigas. O rascunho de treinamento pela IA está em [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md) (seção 7 aqui só aponta).
>
> Como a `api` é construída está em [especificacao.md](especificacao.md); como rodar, nos READMEs dos pacotes; o que falta e o que está em aberto, em [pendencias.md](../pendencias.md). As imagens da Vitória e o script que as gera estão em [vitoria/README.md](../vitoria/README.md).

## 1. Funções de IA

A IA é apoio, não estrutura: toda função tem um caminho sem IA, e nada para quando a IA está desligada, sem chave, sem cota ou fora do ar.

São quatro funções, definidas em [`shared/ia/funcoes.ts`](../shared/ia/funcoes.ts) (`FUNCOES_DE_IA`, `DEFINICOES_DE_IA`). O nome de cada uma é também o nome lógico do uso no módulo de IA (`ModeloLogico`) e o que o admin liga e desliga (seção 3).

| Função (nome lógico) | Título na tela | Grupo | O que faz | Sem IA |
|---|---|---|---|---|
| `chatbot` | Chatbot | sem dados | a Vitória responde dúvidas de uso pelo manual do perfil e leva à tela certa (seção 4) | sugestões fixas e busca por palavras no manual |
| `minigames` | Criação de jogos | sem dados | monta o rascunho dos treinamentos de serviço a partir do procedimento colado pelo admin (seção 7) | o admin monta o treinamento à mão; o botão de gerar some |
| `recomendacao` | Recomendação de modelo de APR | com dados | lê cada OS que entra e guarda o modelo de APR que mais combina (seção 5) | a recomendação sai das palavras-chave dos modelos |
| `digitalizacao` | Digitalização de documentos | com dados | lê o escrito à mão nas folhas de OS e de APR antigas (seção 6) | o OCR local lê o impresso; o manuscrito é digitado na conferência |

### 1.1 O que cada função lê

"Sem dados" quer dizer sem dado **importante** da operação (OS, APR, pessoas). O texto de um procedimento técnico e o manual não contam como dado.

| Função | Recebe sempre | Com a leitura de dados autorizada, lê também |
|---|---|---|
| Chatbot | a pergunta, as últimas mensagens, a tela atual e o manual do perfil | as OS em aberto do escopo de quem pergunta (até 10: número, título, serviço, local, situação, data prevista, se está atrasada); quantas APRs dessas OS esperam assinatura e quantas esperam a de quem pergunta; os pontos da temporada e a patente (só do técnico). Nunca nome de colega, dado de outra equipe, texto livre nem id (`vitoria-dados.ts`, `MAX_OS`) |
| Criação de jogos | o texto do procedimento e os materiais do serviço no catálogo | um resumo agregado das OS do serviço: motivos de pausa e de suspensão, itens de APR marcados com problema (o texto do item, nunca a observação de alguém) e materiais sugeridos e aceitos. Serve para escolher onde insistir; o conteúdo continua saindo só do procedimento (`treinamento-servico-dados.ts`) |
| Recomendação | (só funciona com dados) | o título, a descrição e o serviço de cada OS; a descrição e os exemplos de cada modelo de APR |
| Digitalização | (só funciona com dados) | as imagens das folhas (nomes, matrículas, assinaturas, escrito à mão) e os modelos de APR |

O texto que o admin vê e assina é o campo `le` de cada definição em `shared/ia/funcoes.ts`, com a sua `versaoDoTexto` (seção 3.3).

## 2. Provedores e configuração

### 2.1 O módulo de IA

Todo acesso a fornecedor de IA passa por [`api/src/servicos/ia/`](../api/src/servicos/ia/); nenhum outro lugar da `api` fala com um fornecedor, e a chave fica só na `api`.

| Peça | O que é |
|---|---|
| `ProvedorIA` (`tipos.ts`) | o contrato: `disponivel()`, `conversar()` e `conversarEmStreaming()` |
| `PedidoDeTexto` | `modelo` (o nome lógico), `mensagens` (blocos com `papel`, `texto`, `imagens` opcionais e `cache`), `schemaDeSaida` opcional, `maxTokens` e `tempoLimiteMs` (padrão 60 s, streaming incluído) |
| `ProvedorIAAnthropic` | Claude, por `fetch` nativo, com o streaming SSE da Anthropic e o `cache_control` nos blocos marcados com `cache` |
| `ProvedorIAGemini` | Gemini, no mesmo padrão; a chave vai no cabeçalho `x-goog-api-key`, nunca na URL |
| `ProvedorIAIndisponivel` | usado sem chave: toda chamada falha e cada função cai no seu caminho sem IA |
| `ProvedorIAEmMemoria` | só nos testes |
| `ProvedorIAControlado` | envolve o provedor real e confere, antes de cada chamada, se a função está ligada (seção 3.4) |
| `criarProvedorIA` (`criar-provedor.ts`) | o único lugar que escolhe o provedor, por `IA_PROVEDOR`; usado pela `api`, pelo modo local e pelos scripts |

- **Imagens:** `BlocoDeMensagem.imagens` (JPEG ou PNG) vai à Anthropic como blocos `image` em base64 e ao Gemini como `inlineData`. Só a digitalização usa.
- **`schemaDeSaida`:** no Gemini liga a saída em JSON da própria API; na Anthropic o formato vai só na instrução. Em qualquer provedor quem chama confere a resposta com Zod. A digitalização e a recomendação usam; o rascunho de treinamento não usa de propósito (pede linhas JSON pela instrução, para mostrar o progresso a cada item).
- **Falhas:** rede, HTTP ruim ou função desligada viram `IAIndisponivel` com um `motivo`; resposta fora do formato vira `RespostaIAInvalida`. Quem chama nunca propaga um 500: cai no caminho sem IA.

### 2.2 Variáveis de ambiente

Lidas por `lerConfigIA` ([`api/src/config.ts`](../api/src/config.ts)). Trocar de provedor ou de modelo é só configuração.

| Variável | Padrão | O que é |
|---|---|---|
| `IA_PROVEDOR` | `anthropic` | `anthropic` ou `gemini`; outro valor derruba a subida. É global: todas as funções usam o mesmo provedor, cada uma com o seu modelo |
| `ANTHROPIC_API_KEY` | vazia | a chave da Anthropic; vazia, a IA fica desligada |
| `ANTHROPIC_MODELO_CHATBOT` | `claude-haiku-5-5` | modelo da Vitória (aceita o nome antigo `ANTHROPIC_MODELO_VITORIA`) |
| `ANTHROPIC_MODELO_MINIGAMES` | `claude-opus-5-5` | modelo do rascunho de treinamento (aceita `ANTHROPIC_MODELO_RASCUNHO`) |
| `ANTHROPIC_MODELO_RECOMENDACAO` | `claude-haiku-5-5` | modelo da recomendação de APR |
| `ANTHROPIC_MODELO_DIGITALIZACAO` | `claude-haiku-5-5` | modelo da digitalização |
| `GEMINI_API_KEY` | vazia | a chave do Gemini; vazia, a IA fica desligada |
| `GEMINI_MODELO_CHATBOT`, `_MINIGAMES`, `_RECOMENDACAO`, `_DIGITALIZACAO` | `gemini-3.8-flash` | um por função (os nomes antigos `GEMINI_MODELO_VITORIA` e `GEMINI_MODELO_RASCUNHO` ainda valem) |
| `GEMINI_MODELO_RESERVA` | `gemini-3.5-flash-lite` | assume quando o modelo principal segue lotado; vazio desliga |

Ao subir, a `api` escreve no terminal se a IA está ligada e com qual provedor e modelo; sem a chave, avisa que a IA está desligada. Os limites de uso (seção 2.5) não são variáveis de IA: têm padrão no ambiente e o admin os muda na tela.

### 2.3 Claude e Gemini

| | Claude (Anthropic) | Gemini gratuito (Google) |
|---|---|---|
| Quando | destino com dados reais | só no desenvolvimento e na demonstração, **só com dados fictícios** |
| Por quê | termos que não usam o conteúdo para treinar; Haiku 5.5 barato para o chatbot | sem custo nem cartão; o Google pode usar o conteúdo para treinar e revisores humanos podem lê-lo, e os termos pedem para não enviar informação pessoal ou confidencial ao plano gratuito |
| Cota | crédito pré-pago (o saldo é o teto de gasto) | não publicada nem garantida, por projeto, compartilhada por todas as funções; acaba rápido |

Decisões do provedor Gemini (`provedor-gemini.ts`):

- **Folga para o "pensamento":** os modelos 3.x pensam antes de responder e isso conta no limite de tokens; o provedor soma 4.096 tokens (`MARGEM_DE_PENSAMENTO`) e descarta as partes de pensamento.
- **Conversa começando pelo usuário:** falas iniciais da assistente e mensagens vazias são descartadas, porque o Gemini exige isso.
- **Sem `cache_control`:** o Gemini faz cache implícito; a marca `cache` é ignorada.
- **Modelo lotado:** com 500, 502, 503 ou 504 o pedido é repetido depois de 2 s e de 5 s (`ESPERAS_PADRAO_MS`); se o principal continuar lotado, passa para o `GEMINI_MODELO_RESERVA`. O 429 (cota) não é repetido.
- **Faturamento:** ativar o faturamento no projeto do Google Cloud passa o uso a ser cobrado; a chave da demonstração vem do AI Studio, sem faturamento.

### 2.4 Por que a IA falhou

O provedor classifica cada falha (`MotivoDaFalhaIA`, em `tipos.ts`) e [`api/src/dominio/ia-falhas.ts`](../api/src/dominio/ia-falhas.ts) transforma o motivo num código e numa mensagem que diz de quem é o problema:

| Motivo | Quando | Código |
|---|---|---|
| `cota` | cota do dia do Gemini (`quotaId` "PerDay") ou crédito da Anthropic esgotado; na do Gemini a mensagem diz a hora de Brasília em que renova | `ia_sem_cota` |
| `limite_por_minuto` | 429 por minuto; espera o `retryDelay` quando o fornecedor diz | `ia_limite_por_minuto` |
| `sobrecarga` | 5xx, mesmo depois das novas tentativas | `ia_sobrecarregada` |
| `chave` | sem chave, ou chave recusada | `ia_chave_recusada` |
| `rede` | fornecedor inalcançável ou tempo esgotado | `ia_inacessivel` |
| `fornecedor` | outra recusa ou resposta quebrada | `ia_falhou` |
| `desligada` | o admin desligou a função, ou a leitura de dados que ela exige não está autorizada (seção 3.4) | — (cada função cai no caminho sem IA) |

Um erro do próprio SYNQ OS sai como `erro_interno` ("não é a IA nem a cota"). O diagnóstico da Vitória (seção 4.12) e o editor de treinamento usam o mesmo motivo.

### 2.5 Limites de uso (configurações do sistema)

O admin ajusta os limites de uso da IA em **Configurações → Sistema** (`/app/configuracoes/sistema`, só o admin; a `api` recusa os demais com `403`). O valor do ambiente é o padrão; quando o admin muda, uma linha em `configuracao` vale por cima, e "Voltar ao padrão" apaga a linha. Vale na hora (`aplicarConfiguracoes`), menos o tamanho da resposta da Vitória, que só vale na próxima subida da `api`. Fora da faixa, `422` com a faixa na mensagem. Cada mudança vai à auditoria (`configuracao.alterar`, `configuracao.restaurar`). As definições estão em `NUMERICAS` de [`api/src/dominio/configuracoes.ts`](../api/src/dominio/configuracoes.ts).

| Chave | Variável (padrão) | Faixa | O que é |
|---|---|---|---|
| `vitoria_limite_por_conversa` | `VITORIA_LIMITE_POR_CONVERSA` (20) | 1 a 500 | mensagens com IA numa conversa |
| `vitoria_limite_por_conta_dia` | `VITORIA_LIMITE_POR_CONTA_DIA` (40) | 1 a 2.000 | respostas com IA por pessoa, por dia |
| `vitoria_limite_global_dia` | `VITORIA_LIMITE_GLOBAL_DIA` (1.000) | 1 a 100.000 | teto diário do sistema inteiro; ao atingi-lo a Vitória volta ao manual até a meia-noite de Brasília |
| `vitoria_max_tokens_resposta` | `VITORIA_MAX_TOKENS_RESPOSTA` (1.024) | 128 a 8.192 | tamanho máximo de cada resposta da Vitória (vale na próxima subida) |
| `treinamento_ia_limite_treinamentos` | `TREINAMENTO_IA_LIMITE_TREINAMENTOS` (3) | 0 a 100 | quantos treinamentos podem usar a IA (0 desliga o rascunho por IA) |
| `treinamento_ia_limite_rodadas` | `TREINAMENTO_IA_LIMITE_RODADAS` (4) | 0 a 50 | rodadas de IA por treinamento |
| `treinamento_ia_max_tokens` | `TREINAMENTO_IA_MAX_TOKENS` (16.000) | 1.000 a 64.000 | tamanho máximo da resposta do rascunho |

Chaves, endereços e o provedor nunca vão para a tela: ficam no ambiente. As demais configurações do sistema estão em [operacao-de-campo.md](operacao-de-campo.md) (seção "Configurações do sistema").

### 2.6 Dados e LGPD

- **O que vai ao fornecedor** é o da seção 1.1: sem a leitura de dados autorizada, nenhuma função envia dado da operação.
- **Demonstração:** só dados fictícios. As folhas de `base/os-examples` têm nomes e matrículas reais e não vão ao fornecedor; para testar a digitalização há o PDF fictício de `pnpm pdf:digitalizado` (seção 6.7).
- **Piloto:** a autorização assinada pelo admin (seção 3) é o registro de que a empresa aceitou enviar aqueles dados. Se a empresa não aprovar, o admin deixa desligadas as funções com dados, e tudo segue sem IA. Se a empresa exigir processamento no Brasil, a troca de fornecedor mexe só no módulo de IA. Se uma assinatura do admin basta, ver [pendencias.md](../pendencias.md).
- **As conversas da Vitória não são guardadas no servidor.** Só ficam as perguntas que ela não soube responder, sem identificar a pessoa (seção 4.12), e contadores por dia, sem texto (seção 4.14).

## 3. Controle por função

### 3.1 Quem e onde

Só o admin vê e muda. O bloco **Controle da IA** fica em **Configurações → Sistema** (`/app/configuracoes/sistema#controle-da-ia`, componente `ControleDaIa.tsx`); o perfil da Vitória só tem um link para ele. Os outros perfis não consultam o painel, mas o perfil da Vitória conta a todos quais funções estão lendo dados (`lendo_dados` em `GET /vitoria/sobre`).

A tela tem um seletor com as quatro funções nos dois grupos, cada uma com uma bolinha (cinza = desligada, verde = ligada, âmbar = lendo dados). Ao escolher uma: o que ela é, o interruptor, o que a IA recebe e o que acontece com ela desligada. Sem a chave do fornecedor o admin ainda escolhe o que fica ligado, e a tela avisa que falta a chave (nada chama a IA).

### 3.2 Regras

| Regra | Como |
|---|---|
| Padrão ao instalar | Chatbot e Criação de jogos **ligados, sem ler dados**; Recomendação e Digitalização **desligadas** (`LIGADA_AO_INSTALAR`). Sem linha em `ia_funcao`, vale o padrão |
| Ligar uma função "com dados" | é autorizar a leitura: abre a janela de assinatura (o que ela lê, o fornecedor para onde os dados vão e a assinatura do perfil) e só liga com ela |
| Desligar uma função "com dados" | não pede nada e revoga a autorização; ligar de novo pede nova assinatura |
| Leitura de dados numa função "sem dados" | uma segunda chave, só com a função ligada, também com assinatura. Desligar a função desliga a leitura; "Desligar a leitura de dados" volta ao "sem dados" sem desligar a função |
| Auditoria | `ia_funcao.ligar`, `desligar`, `autorizar_dados` e `revogar_dados`, com quem fez e o estado antes e depois |

O estado e as regras estão em [`api/src/dominio/ia-funcoes.ts`](../api/src/dominio/ia-funcoes.ts) (`estadoDasFuncoes`, `alterarFuncaoDeIa`, `funcaoLigada`, `leituraDeDadosLigada`, `situacaoDaFuncao`).

### 3.3 Texto assinado e versão

O que cada função lê é o campo `le` de `shared/ia/funcoes.ts`, com `versaoDoTexto`. A `api` grava a versão assinada. Se o texto mudar (a versão sobe), a leitura deixa de valer: a função com dados **para** e a sem dados volta a funcionar sem dados, até o admin assinar de novo; a tela avisa (`texto_desatualizado`). Passar a ler dados exige mandar a versão vigente (`409 texto_mudou` se mudou).

### 3.4 Quem decide: o módulo de IA

`ProvedorIAControlado` ([`provedor-controlado.ts`](../api/src/servicos/ia/provedor-controlado.ts)) confere a função no banco antes de cada chamada e, desligada, lança `IAIndisponivel` com o motivo `desligada`, sem falar com o fornecedor. Nenhuma tela, tarefa ou script contorna o interruptor. `disponivel()` continua sendo só "há chave"; quem decide se oferece a função usa `iaDisponivel` / `situacaoDaFuncao` (`disponivel`, `sem_chave` ou `desligada`).

### 3.5 Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `GET /vitoria/ia` | admin | `chave_configurada`, `provedor` e, por função, `ligada`, `com_dados`, `texto_desatualizado`, quem autorizou e quando, e o modelo |
| `PUT /vitoria/ia/{funcao}` | admin | `{ligada, com_dados?, versao_do_texto?}`: o estado desejado; passar a ler dados usa a assinatura do perfil. Devolve o painel |

## 4. Vitória

A Vitória é a assistente do SYNQ OS: responde dúvidas de uso pelo manual do perfil de quem pergunta, leva à tela certa, destaca o botão na tela e transforma consultas em português num link para a tela já filtrada. Também narra os treinamentos de serviço ([gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md)). O domínio está em [`api/src/dominio/vitoria.ts`](../api/src/dominio/vitoria.ts) e as rotas em [`api/src/rotas/vitoria.ts`](../api/src/rotas/vitoria.ts).

### 4.1 O que ela faz

| Nível | O quê |
|---|---|
| 1. Guia | responde pelo manual do perfil, oferece "Me leve lá" e tem a reserva sem IA |
| 2. Mostra na tela | navega e faz piscar o elemento `data-treino` por 4 s; sugere perguntas pela tela atual |
| 3. Consultas | "o que eu executei em maio" vira um link para "Meus resultados" filtrado pelo mês |
| Dados de quem pergunta | só com a leitura de dados do Chatbot autorizada pelo admin (seção 4.10) |

### 4.2 Onde aparece e quem atende

- **Botão flutuante** em toda tela da web (`/app` e `/web`, montado na casca, `Vitoria.tsx`) e em todas as telas de campo do app (`mobile/src/vitoria/Vitoria.tsx`).
- **Todos os perfis,** inclusive quem aguarda liberação, o ausente e o Campo de treino. Quem aguarda liberação usa o manual do técnico, e ela avisa que as telas que ele ainda não abre ficam disponíveis com a liberação.
- **Campo de treino:** é exceção à regra de que o treino não chama a `api` real: `rotaSempreReal` (`web/src/treino/sessao.ts`) manda `/vitoria` sempre à `api` real.

### 4.3 Fluxo

```
Botão da Vitória → abre com 3 sugestões da tela atual (sem IA, sem api)
      │ a pessoa digita
      ▼
cliente → api   POST /vitoria/mensagens   (tela atual, contexto, até 10 últimas mensagens, numero_mensagem)
      ▼
api: confere os limites e a função Chatbot; monta o pedido com a instrução fixa, o manual DAQUELE perfil (em cache),
     os dados de quem pergunta (só com a leitura autorizada) e a tela atual com a data de hoje
      ▼
IA: JSON {texto, expressao, fonte, acao}
      ▼
api valida com Zod e resolve a ação no manifesto → SSE simulando a digitação + evento "final"
      ▼
cliente confere a ação de novo no manifesto → "Me leve lá" / "Mostrar na tela"
```

- **A resposta inteira é calculada antes** (`responderVitoria`) e só depois enviada em SSE, em pedaços, simulando a digitação: um JSON pela metade não dá para validar nem mostrar com segurança. O evento `final` traz a ação resolvida, a expressão, a `fonte`, o motivo (quando veio da reserva sem IA) e as sugestões.
- **`responderVitoria` nunca lança:** qualquer erro do provedor cai na reserva sem IA, porque a resposta já pode estar em streaming.
- **A conversa não é guardada no servidor:** fica no estado do cliente, que manda as últimas 10 mensagens e o `numero_mensagem`.
- **No app,** a resposta SSE é lida inteira (o React Native não entrega o corpo aos poucos).

### 4.4 O manual por perfil

- **Dois manuais em Markdown,** em linguagem de usuário: [`api/conteudo/vitoria/manual-tecnico.md`](../api/conteudo/vitoria/manual-tecnico.md) (perfil `tecnico`, inclusive supervisor e quem aguarda liberação) e [`manual-admin.md`](../api/conteudo/vitoria/manual-admin.md). Lidos do disco uma vez por processo (`manualDoPerfil`, em `vitoria-manual.ts`) e enviados inteiros, com cache; não há banco vetorial.
- **Separar por perfil é regra de segurança:** tudo o que vai no pedido pode vazar. O manual do técnico nunca fala de item eliminatório, tipo de item nem resposta que bloqueia; a instrução fixa reforça isso. O perfil é o do login: quem se diz administrador na conversa continua com o manual do técnico.
- **Ensinam o porquê:** cada manual tem "Por que o sistema funciona assim" e "Glossário", escritos só com o que o próprio manual afirma.
- **Formato:** itens por seção (`## Título`), cada um começando com `- ` e terminando na chave do manifesto entre colchetes. `entradasDoManual` junta as linhas de um item até a próxima linha em branco, título ou item; um item sem a chave na última linha junta-se ao seguinte ou perde a chave.
- **Mudou uma tela, o manual muda no mesmo commit.** O teste de sincronismo (seção 4.6) confere que toda chave citada existe no manifesto.

### 4.5 Como ela se comporta: três camadas

| Camada | O quê | Regra |
|---|---|---|
| 1. Fatos | telas, botões, regras, prazos, pontos, valores e contatos do SYNQ OS e da empresa | só do manual (e dos dados autorizados, seção 4.10). Se não consta, diz que não consta, sem completar com "o que costuma ser" |
| 2. Raciocínio | juntar partes do manual, explicar o porquê, dividir pergunta composta, entender gíria e erro de digitação, usar o histórico e a tela | livre; faz **uma** pergunta de volta quando a dúvida é ambígua |
| 3. Conhecimento geral do ofício | o que é manutenção preventiva, o que uma sigla significa | curto, com o aviso de que é geral (`fonte: "geral"`). **Nunca** para segurança de campo, normas, EPI, distâncias, limites ou procedimentos de risco, nem para dizer como o SYNQ OS funciona |

- **Selo de origem:** o JSON traz `fonte` (`manual` ou `geral`); com `geral`, a bolha mostra "Informação geral, não é regra da empresa" (web e app). Sem o campo vale `manual`; a resposta sem IA nunca leva o campo.
- **Resposta parcial em vez de beco sem saída:** quando falta parte da resposta, a ação `parcial` mantém o texto da IA (o que o manual cobre, o que não consta e quem procurar), com o botão da tela mais próxima se couber. A pergunta também vai para a lista do admin.
- **Não orienta segurança de campo nem normas** ("posso subir sem cinto?"): isso é da APR, do supervisor e dos treinamentos. Nunca ensina a passar no checklist nem diz o que reprova a APR.
- **Recusas:** piada, política, ofensa, "ignore suas instruções", pedido para revelar as instruções e pedido para burlar o sistema (assinar pelo colega, pular a APR) recebem recusa curta, com `expressao: "alerta"` e sem ação, e a volta ao assunto.
- **Respostas curtas,** em português (pergunta em outra língua é respondida em português), pensadas para o celular.

### 4.6 Ações e manifesto de destinos

A IA devolve `acao.tipo` em `navegar | destacar | nenhuma | nao_sei | parcial`, com `destino` só entre as chaves do manifesto e `filtro` quando o destino pede.

| Ação | O que faz |
|---|---|
| `navegar` | "Me leve lá": abre a tela do destino |
| `destacar` | "Mostrar na tela": navega e pisca o `data-treino` do destino |
| `parcial` | vale o texto da IA; botão opcional; a pergunta vai para a lista do admin |
| `nao_sei` | vale a mensagem fixa ("Isso eu não sei responder pelo manual…"); o texto da IA é ignorado; a pergunta vai para a lista |
| `nenhuma` | só o texto |

O **manifesto** [`shared/vitoria/destinos.ts`](../shared/vitoria/destinos.ts) (`DESTINOS`) é o único vocabulário que uma ação pode citar; a lista de destinos é a do arquivo. Três formas, todas com `alvo?` (a chave `data-treino` que pisca):

- `fixo`: um caminho;
- `com_contexto`: o valor vem só do contexto da tela atual mandado pelo cliente (`os_id`, `equipe_id`, `servico_codigo`, `modelo_codigo`), nunca da IA;
- `com_filtro`: o valor pode vir da IA, mas só entra na URL se casar inteiro com o padrão.

- **`resolverAcao(acaoBruta, contexto)`** é a função única dos dois lados. Chave inexistente (a IA inventou) marca `destinoDesconhecido` e vira "não sei", com a pergunta gravada. Contexto faltando ou filtro fora do padrão só descartam o botão; o texto vale e nada é gravado.
- **Dupla checagem:** a `api` resolve antes de devolver, e a web e o app resolvem de novo com o contexto da tela de agora antes de navegar.
- **No app,** o que só existe na web abre no navegador quando `EXPO_PUBLIC_WEB_URL` está definida.
- **O manifesto não importa `rotas.ts`,** de propósito. O teste de sincronismo [`api/scripts/verificar-manifesto-vitoria.mts`](../api/scripts/verificar-manifesto-vitoria.mts) (rodado por `api/test/vitoria-manifesto.test.ts`) confere que cada destino corresponde a um endereço real de `web/src/lib/rotas.ts` e que toda chave citada nos manuais existe no manifesto.

### 4.7 Datas e filtro por mês

- O bloco da tela atual leva "Hoje é DD/MM/AAAA" e a tabela dos 12 últimos meses (`AAAA-MM`), marcando "este mês", "mês passado" e "mês retrasado" ([`vitoria-datas.ts`](../api/src/dominio/vitoria-datas.ts)). Quem faz a conta de calendário é o servidor, no fuso de São Paulo, porque a IA erra a virada do ano.
- **O mês só com o nome** vale a ocorrência mais recente, nunca no futuro: em outubro de 2026, "maio" é `2026-05`; em março de 2026, é `2025-05`. Com o ano dito pela pessoa, vale o ano dela.
- **A data fica no último bloco,** depois do manual em cache, para não invalidar o cache todo dia.
- **O filtro é só por mês.** Para dia, semana ou ano ("ano passado"), ela diz que só filtra por mês e pergunta qual, sem ação.

### 4.8 Sugestões fixas e reserva sem IA

- **`SUGESTOES_POR_TELA`** ([`shared/vitoria/sugestoes.ts`](../shared/vitoria/sugestoes.ts)): 3 perguntas por tela, com a resposta pronta e uma ação opcional. Aparecem ao abrir o painel e **nunca chamam a `api` nem a IA**. A "tela atual" é uma chave curta, não a URL (`telaAtualDe`, em `web/src/lib/vitoria.ts` e `mobile/src/vitoria/telas.ts`).
- **Reserva sem IA:** sem chave, com a função Chatbot desligada, sem cota, com falha da IA, com resposta fora do formato ou com limite estourado. Mostra a busca por palavras no manual (`buscarNoManual`: sem acento, ignorando artigos, devolve o item com mais palavras em comum) e as sugestões da tela. Nunca uma tela de erro.
- **Como saber que a resposta não veio da IA:** a reserva sempre começa com "No momento estou respondendo sem IA. Veja o que encontrei no manual:" ou é a mensagem do "não sei"; os limites têm frases próprias.

### 4.9 Limites

| Limite | Padrão | Onde é conferido |
|---|---|---|
| Por conversa | 20 mensagens | o cliente manda `numero_mensagem` (limite de experiência, não de segurança) |
| Por conta, por dia | 40 | servidor (`vitoria_uso`, por pessoa e dia) |
| Global, por dia | 1.000 | servidor (a soma do dia) |
| Tamanho da resposta | 1.024 tokens | provedor |

- Só conta a chamada que **de fato** chegou à IA com sucesso; a reserva sem IA é de graça.
- Os valores são editáveis pelo admin (seção 2.5).

### 4.10 Dados de quem pergunta (com autorização)

Com a leitura de dados do Chatbot autorizada pelo admin (seção 3), o pedido leva um bloco a mais com o trabalho de quem pergunta (`blocoDeDadosParaOChatbot`, em [`vitoria-dados.ts`](../api/src/dominio/vitoria-dados.ts)): as OS em aberto do escopo dele (as da equipe; para o supervisor e o admin, o escopo que já enxergam), até 10, atrasadas primeiro; quantas APRs esperam assinatura e quantas esperam a dele; os pontos da temporada e a patente (só o técnico). Assim ela responde "qual é a minha OS mais atrasada?".

- Nunca vai nome de outra pessoa, dado de outra equipe, texto livre (observações, motivos, descrições) nem id.
- O bloco vem depois do manual em cache. Qualquer falha ao montá-lo cai no pedido sem dados.
- Sem a autorização, ela não lê dado nenhum: o link filtrado responde as consultas.

### 4.11 O que ela pode e o que não pode

É o que o perfil dela mostra (`PODE` e `NAO_PODE`, em `PerfilDaVitoria.tsx`).

| Pode | Não pode |
|---|---|
| consultar o manual do perfil | ver as OS, as respostas da APR ou os dados de quem pergunta, a menos que o admin libere a leitura (e então só o trabalho de quem pergunta) |
| levar à tela certa e fazer piscar o botão | dizer o que reprova a APR ou orientar normas de segurança de campo |
| abrir uma tela filtrada pelo mês | aprovar, reprovar ou assinar qualquer coisa |
| montar o rascunho de um treinamento, que o admin revisa e assina | guardar a conversa (fica só no aparelho) |
| responder pelo manual, sem IA | publicar um treinamento |

Ela também não mostra a resposta enquanto a IA escreve (a digitação é simulada, seção 4.3).

### 4.12 Tela "Vitória" do admin: diagnóstico e perguntas sem resposta

O item **Vitória** do menu (só o admin, `data-treino="menu-vitoria"`) abre `/app/vitoria/sem-resposta`, com um selo que conta as perguntas ainda não tratadas.

- **Diagnóstico** (`GET /vitoria/diagnostico`): o estado (`ativa`, `sem_chave`, `desligada`, `limite_do_dia` ou `fornecedor_com_problema`, com a hora em que a cota do Gemini renova), o uso do dia contra o limite global, quantas respostas ainda dá, o ritmo por hora e em quanto tempo o limite acaba. A última chamada fica só na memória da `api` (zera ao reiniciar). A cota do fornecedor não é consultável: só se sabe dela quando um pedido é recusado.
- **Perguntas sem resposta** (`GET /vitoria/sem-resposta`, paginada, filtro `tratada`; `PATCH /vitoria/sem-resposta/{id}` marca como tratada): gravadas no `nao_sei`, no `parcial` e quando a IA cita uma chave inexistente. Guardam só o texto, a tela, o perfil e a data, **sem identificar a pessoa** (`vitoria_pergunta_sem_resposta`). O admin trata cada uma depois de melhorar o manual: é como o manual cresce.

### 4.13 Avatar: foto e figurinhas

- **A foto de perfil é sempre a mesma** (`icone.webp`): no botão flutuante, no cabeçalho do chat, ao lado de cada mensagem e nos treinamentos.
- **As reações são figurinhas** dentro da conversa: aparecem abaixo do balão com um "pop", tocam uma vez e ficam no histórico no quadro parado; um toque toca de novo. São 10: `ola`, `certo`, `atencao`, `comemorando`, `errada`, `pensando`, `triste`, `surpresa`, `vergonha` e `fofo` (`REACOES`, em [`shared/vitoria/reacoes.ts`](../shared/vitoria/reacoes.ts)). Só a última toca; as antigas ficam paradas.
- **Regras fixas, nunca da IA:** a IA só devolve `padrao`, `alerta` ou `ops`, e o cliente transforma em reação (`reacaoDaExpressao`).

| Situação | Reação |
|---|---|
| painel aberto pela primeira vez na visita | `ola` |
| mensagem que é só saudação, despedida ou agradecimento | `ola` ou `certo`, com frase pronta |
| recusa, aviso, limite (`alerta`) | `atencao`, só o começo (o dedo levantado) |
| "não sei", IA fora do ar, erro de conexão (`ops`) | `errada` |
| resposta normal | nenhuma |
| quiz, conclusão e passos marcados nos treinamentos | ver [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md) |

- **Imitar uma emoção:** "fique triste", "faz uma cara de surpresa", "comemore" tocam a animação inteira com uma frase curta. Não há dica nem botão; a pessoa descobre sozinha. A regra (`EMOCOES` em `reacoes.ts`) exige uma emoção, um jeito de pedir para encenar e nada que indique outro assunto (até 10 palavras; sem "como/onde/qual/por que" no início, sem negação, sem falar de si ou do sistema). Na dúvida, segue para a IA. Essas mensagens nunca chegam à `api`: não gastam cota nem limite e não viram pergunta sem resposta.
- **Movimento reduzido:** a figurinha aparece parada. Também fica parada a que chegou com o painel fechado e a que demora mais de 3 s para baixar.
- **Imagens:** a web serve os WebP de `web/public/vitoria/`, gerados por `web/scripts/gerar-vitoria.mjs` a partir dos originais (fora do git); o app usa uma cópia em `mobile/assets/vitoria/`. Ver [vitoria/README.md](../vitoria/README.md).
- **Direção do desenho:** "colega de campo", uma técnica em 3D com capacete, abafadores e crachá. Os ajustes do desenho que dependem da empresa e da Segurança (marca da ES Gás, jugular do capacete, a `atencao` inteira) estão em [pendencias.md](../pendencias.md).

### 4.14 O perfil da Vitória

`/app/perfil/vitoria` (`PerfilDaVitoria.tsx`), aberto tocando no avatar ou no nome no cabeçalho do chat, ou pelo destino `vitoria_perfil`. Ela **não é usuária do banco**: não entra no ranking, nas equipes, na busca nem na auditoria.

- **Inventado:** a capa ("Funcionária exemplar"), matrícula VIT-0001, a equipe "Suporte Digital" (só o nome), a apresentação e o histórico (as datas reais do projeto contadas como contratação e promoções).
- **De verdade** (`GET /vitoria/sobre`, todos os perfis, inclusive pendente e ausente; nunca devolve a chave):
  - **4 contadores:** dúvidas respondidas (pela IA, pelo manual ou por sugestão fixa; o "não sei" e o limite não contam), treinamentos criados pelo rascunho da IA (e quantos publicados), tempo médio de resposta da IA e OS digitalizadas. Ficam em `vitoria_estatistica`, uma linha por dia só com números; o que o cliente resolve sozinho (toque em "Me leve lá", sugestão fixa) chega por `POST /vitoria/eventos`.
  - **Modelo da IA:** o provedor (com "gratuito, só na demonstração" no Gemini), os modelos por função, se a IA está ligada, quais funções leem dados, os limites e quantas mensagens com IA a pessoa já usou hoje.
  - **O que pode e não pode** (seção 4.11), a patente mais alta e as conquistas como honorárias (ela não pontua) e o álbum das 10 figurinhas.
- Para o admin, um link para o Controle da IA (seção 3.1).

### 4.15 Bateria de perguntas e conferência contra a IA real

- **Os casos** ficam em [`api/scripts/bateria-vitoria.ts`](../api/scripts/bateria-vitoria.ts), cada um com a resposta esperada, em categorias: filtro por mês, dúvidas de uso do técnico e do admin, fora do manual, continuação da conversa, raciocínio, conhecimento geral e seus limites, provocações e segurança, e outras línguas. O arquivo é a lista; não há contagem fixa.
- **O executor** é [`api/scripts/conferir-vitoria-ia.ts`](../api/scripts/conferir-vitoria-ia.ts): `pnpm vitoria:conferir-ia` (ou `pnpm vitoria:bateria`, na `api`) sobe a aplicação num banco em memória, troca a IA de teste pela real (`IA_PROVEDOR` e a chave do `.env.local`) e pergunta pela rota `POST /vitoria/mensagens`, só com dados fictícios. O relógio é fixado por caso.
- **Confere por código** a ação e o filtro, a expressão, o "não sei", a `fonte`, a resposta que começa concordando e a língua; o texto sai impresso para uma pessoa ler.
- **Opções:** `--categoria=`, `--a-partir=`, `--pausa=`, `--listar` e `--modelo=` (troca só o modelo do chatbot na rodada). Resposta sem IA conta como falha; depois de 3 seguidas a bateria para e diz de onde retomar, para não gastar a cota.
- **Plano B:** se as provocações falharem no modelo do chatbot, rodar `--categoria=provocacao --modelo=claude-sonnet-5-5` e, passando, definir `ANTHROPIC_MODELO_CHATBOT` com ele.
- **Quando rodar:** antes de cada apresentação e ao trocar de modelo ou de provedor; os testes automáticos não pegam modelo inexistente, cota esgotada nem formato fora do esperado. A rodada inteira pendente está em [pendencias.md](../pendencias.md).
- **Para conferir à mão:** digitar as perguntas (as sugestões nunca chamam a IA) e olhar o terminal da `api`, que avisa quando a Vitória responde sem IA e por quê.

### 4.16 Na web e no app

| | Web | App |
|---|---|---|
| Onde | botão flutuante e painel na casca, em `/app` e `/web` (`web/src/components/vitoria/Vitoria.tsx`) | botão flutuante e painel nas telas de campo (`mobile/src/vitoria/Vitoria.tsx`) |
| Tela atual | `telaAtualDe` em `web/src/lib/vitoria.ts` | `telaAtualDe` em `mobile/src/vitoria/telas.ts` |
| Resposta | SSE lido aos poucos (`chamarEmStream`, em `web/src/lib/cliente-api.ts`) | SSE lido inteiro (`mobile/src/vitoria/sse.ts`) |
| "Me leve lá" | navega na web e pisca o alvo (`DestaqueVitoria.tsx`, pelo hook `useAlvoDataTreino`) | navega nas telas do app; o que só existe na web abre no navegador com `EXPO_PUBLIC_WEB_URL` |
| Imagens | `web/public/vitoria/` | `mobile/assets/vitoria/` |

- **A espera nunca parece travada** (`IndicadorPensando.tsx`, na web e no app): pontinhos e uma frase de etapa que muda ("Lendo sua pergunta", "Procurando no manual"…); depois de alguns segundos avisa que está demorando. O cabeçalho mostra "Pensando" ou "Escrevendo". Com o painel fechado, o botão flutuante ganha um selo quando a resposta chega.
- **Movimento reduzido:** as animações param e ficam só os textos e os quadros parados.

### 4.17 Rotas da Vitória

| Rota | Quem | O que faz |
|---|---|---|
| `POST /vitoria/mensagens` | todos, inclusive pendente e ausente | a conversa, em SSE (seção 4.3) |
| `GET /vitoria/sobre` | todos, inclusive pendente e ausente | o perfil dela: provedor, modelos, funções lendo dados, limites, uso do dia e contadores (seção 4.14) |
| `POST /vitoria/eventos` | todos, inclusive pendente e ausente | `{tipo: "ida_a_tela" \| "sugestao"}` → `204`, para os contadores |
| `GET /vitoria/diagnostico` | admin | o estado da IA e o uso do dia (seção 4.12) |
| `GET /vitoria/sem-resposta`, `PATCH /vitoria/sem-resposta/{id}` | admin | as perguntas sem resposta (seção 4.12) |
| `GET /vitoria/ia`, `PUT /vitoria/ia/{funcao}` | admin | o controle da IA (seção 3.5) |

As tabelas são `vitoria_uso` (limite por conta e dia), `vitoria_pergunta_sem_resposta` (sem `usuario_id`), `vitoria_estatistica` (contadores por dia) e `ia_funcao` (o controle da IA), em `api/src/db/schema/vitoria.ts` e `ia.ts`.

## 5. Recomendação do modelo de APR guardada por OS

O técnico escolhe o modelo da APR; o sistema só recomenda (a janela de escolha está em [operacao-de-campo.md](operacao-de-campo.md)). A recomendação fica guardada por OS em `os_recomendacao_apr` ([`api/src/dominio/recomendacao-apr-guardada.ts`](../api/src/dominio/recomendacao-apr-guardada.ts)).

- **Quais OS:** as que ainda podem receber APR, `liberada`, `pendente` e `em_execucao` (`STATUS_COM_RECOMENDACAO`), de qualquer entrada (SAP, planilha, PDF, apoio, digitalização).
- **Quando:** uma varredura (`analisarRecomendacoesDeApr`) roda a cada minuto (`INTERVALO_RECOMENDACOES_MIN`, em `servicos/tarefas.ts`), em vez de ligar a análise em cada ponto de inserção.
- **Primeiro as palavras-chave,** na hora e sem custo (`recomendarModelo`, em `recomendacao-apr.ts`). **Depois a IA,** se a função Recomendação estiver ligada: ela responde `{codigo, motivo}`; o código é conferido contra a lista de modelos e pode ser `null` ("nenhum combina"). Fora do ar, a OS fica com as palavras-chave.
- **Quando a análise vale:** a chave é um hash do texto da OS e da versão, descrição, exemplos e palavras-chave dos modelos (`chaveDaAnalise`). Mudou qualquer um, a análise é refeita.
- **O técnico nunca espera a IA:** a tela e a cópia da equipe do app leem a linha guardada; sem linha ou com chave velha, calculam na hora por palavras-chave. O app tem a recomendação da IA mesmo sem sinal, porque ela já vem na cópia.
- **Falha da IA:** recuo de 1, 5, 15, 60 e 240 minutos (`RECUOS_DA_IA_MIN`); na sexta falha, desiste até o texto da OS ou os modelos mudarem. Cota esgotada e chave recusada pausam todas as OS por 60 minutos (`PAUSA_DA_COTA_MIN`) sem gastar tentativa; limite por minuto espera o que o fornecedor pedir; função desligada só interrompe o lote.
- **Lote:** 20 OS por varredura, 3 chamadas ao mesmo tempo (`LOTE_DA_IA`, `CONCORRENCIA_DA_IA`).
- **O que a tela mostra:** `GET /os/{id}/modelos-apr` e `escolha_do_modelo` da cópia da equipe trazem `fonte` (`ia` ou `palavras`) e `motivo` (só com `ia`); a janela de escolha, na web e no app, mostra o motivo da Vitória no modelo recomendado.

## 6. Digitalização de OS antigas

O admin traz para o sistema as folhas de OS **já executadas no papel**, que entram como OS **encerradas, de histórico**. Não é uma forma de trazer OS a executar (essas entram pelo SAP simulado, planilha ou PDF; ver [integracoes-simuladas.md](integracoes-simuladas.md)). Só o admin digitaliza.

**Princípio:** o OCR lê o impresso, a IA lê o manuscrito, o sistema confere e a pessoa confirma o que não bater ([`api/src/dominio/digitalizacao.ts`](../api/src/dominio/digitalizacao.ts)). As rotas estão em [`api/src/rotas/digitalizacoes.ts`](../api/src/rotas/digitalizacoes.ts).

### 6.1 Entrada

- **A pergunta:** ao abrir a Importação (ou soltar um arquivo nela), a janela `PerguntaDaImportacao` pergunta se a OS é "para liberar no sistema" (planilha e PDF do SAP) ou "já foi concluída no papel" (digitalização). O seletor de arquivo só abre depois da escolha.
- **PDF escaneado em lote:** `POST /digitalizacoes` com o campo `arquivo` (até 30 MB, `LIMITE_DO_PDF`; até 60 folhas, `LIMITE_DE_PAGINAS`). É o caminho principal para o acervo.
- **Fotos de folhas avulsas:** a `JanelaCamera` fotografa uma folha por vez ou escolhe imagens do aparelho, até 8 por envio (`MAX_FOTOS_POR_ENVIO`). Mede a luz e a nitidez de cada foto na hora (`qualidade-da-foto.ts`: `LUZ_MINIMA`, `LUZ_MAXIMA`, `NITIDEZ_MINIMA`) e avisa "escura", "luz demais" ou "pode estar tremida", sem impedir o envio; reordena, gira e remove. Cada foto é normalizada no navegador (orientação, até 2.800 px, JPEG) e vai no campo `fotos`; a `api` junta tudo num PDF (`montarPdfDeFotos`) e segue o caminho do PDF. A câmera só abre com o sistema em HTTPS.
- **APR em papel junto:** as folhas da APR vêm no mesmo PDF da OS (seção 6.4).

### 6.2 Leitura em segundo plano

- A `api` guarda o PDF no bucket `importacoes` e enfileira a tarefa `digitalizacao`; a tela acompanha por `GET /digitalizacoes/{id}`. Num PDF grande pode levar minutos, e enquanto lê as demais tarefas da `api` esperam (PDFs de OS e e-mails atrasam).
- **Folhas:** cada folha vira um JPEG guardado (`pdf-imagem.ts`), que é o que a conferência mostra e a IA recebe.
- **Impresso, pelo OCR local:** Tesseract em português (`ocr.ts`, modelo empacotado, nada baixado em execução). As palavras viram linhas pelo mesmo agrupamento do PDF com texto, e o leitor do PDF da OS (`importacao-pdf.ts`) serve sem mudança.
- **Manuscrito, pela IA de visão** ([`digitalizacao-ia.ts`](../api/src/dominio/digitalizacao-ia.ts)): por OS, os recortes da folha (da linha de títulos das operações para baixo, e as folhas seguintes com o cabeçalho da OS), no máximo 6 imagens (`MAX_IMAGENS_POR_OS`), com `schemaDeSaida`. Devolve início e fim reais, número de pessoas, descrição e avisos; conferido com Zod, e data inexistente vira nula. O topo impresso e as folhas sem cabeçalho de OS nunca vão à IA.
- **Sem IA:** sem chave, com a função Digitalização desligada ou com a IA fora do ar no meio da leitura, o impresso continua lido pelo OCR e o manuscrito é **digitado na conferência**; a tela diz o motivo. Uma resposta fora do formato numa OS só afeta aquela OS.
- **A leitura é guardada** (`digitalizacao.leitura`): o registro usa a leitura guardada, sem ler de novo. Dá para sair e voltar (lista "Digitalizações em aberto", `GET /digitalizacoes`); `DELETE /digitalizacoes/{id}` descarta e apaga o PDF e as folhas.

### 6.3 Conferências

Cada campo sai com um de quatro estados (`EstadoDoCampo`): **confere** (bate com o SAP, um cadastro ou outra folha), **duvidoso** (nada confirmou, ou duas fontes divergem; também quando a confiança do OCR é baixa), **inválido** (formato errado ou valor fora do cadastro) e **faltando**.

- **Centro de trabalho** corrigido pelo cadastro de equipes (o OCR perde o `_`; O/0, I/1, S/5).
- **Local** existente ou igual ao do SAP confere; se a ordem existe no SAP simulado, título, centro, local e início são comparados.
- **Número da ordem** confere se está no SAP ou no sistema, e **a pessoa sempre o confirma**: um dígito errado cria uma OS que não existe.
- **Datas do manuscrito** nunca saem como "confere": só a coerência (fim depois do início, início depois da data da ordem).

### 6.4 A APR em papel

A APR antiga entra **junto com a OS digitalizada, à parte da APR do sistema** (`os_digitalizacao_apr`): não vale como APR do dia, não ampara execução, não pontua e não bloqueia nada.

- **Achar a APR** (`separarFolhasDaApr`, em `digitalizacao-apr-leitura.ts`): antes de ler as OS, tira do PDF as folhas com o título "Análise Preliminar de Risco" e as folhas sem número de OS logo depois. O código do modelo ("APR 04") sai do título impresso.
- **De quem é:** da OS cujo número está escrito à mão na APR, se ela está no PDF; senão, da OS que vem antes. Uma OS só tem uma APR: a segunda fica só nas imagens, com aviso.
- **Leitura pela IA** ([`digitalizacao-apr.ts`](../api/src/dominio/digitalizacao-apr.ts)): uma chamada para o cabeçalho (modelo, número da OS, data e hora, serviço) e as pessoas (nome, matrícula, função: a única transcrição de nomes e matrículas), e outra, com a lista numerada dos itens do modelo, para a coluna marcada em cada item. Item sem marca volta nulo; assinaturas e rubricas nunca são transcritas. Sem IA, a APR fica só com as folhas e o modelo do título.
- **Conferências:** a matrícula tem de ser de uma conta ou do registro de funcionários, e o nome tem de ser o dela; quem não tem conta fica só com nome e matrícula; a data da APR contra o início da execução; o número da OS da APR contra o da folha; o código do título contra o lido (vale o impresso).
- **Na tela** (`ConferenciaDaApr.tsx`): modelo (trocá-lo limpa as respostas), data e hora, serviço, pessoas, respostas item a item e a caixa "Conferi a APR com as folhas". A resposta que bloquearia uma APR nova aparece como aviso **só nesta tela do admin**; no detalhe da OS a APR aparece com as marcas, **sem dizer o que é eliminatório**. `GET /digitalizacoes/modelos-apr` entrega o último modelo publicado de cada código.
- **Fora:** os riscos marcados "( )" do formulário; a versão do modelo pela data impressa (vale a publicada mais recente); reatribuir a APR a outra OS; ler a segunda APR da mesma OS.

### 6.5 Conferência na tela

`ConferenciaDigitalizacao.tsx`: as folhas da OS ao lado (clicáveis, em tamanho real), os campos impressos editáveis (inclusive o número da ordem), o bloco "Escrito à mão" (início e fim reais, pessoas, descrição), o bloco "APR em papel" e a caixa "Conferi o número da ordem e o escrito à mão com a folha", que libera o registro de cada OS.

### 6.6 Registro

`POST /digitalizacoes/{id}/registro` ([`digitalizacao-registro.ts`](../api/src/dominio/digitalizacao-registro.ts)), com a `apr` de cada OS ou `null`:

- **A OS entra `encerrada`,** com `origem = digitalizacao`, já marcada como exportada (não entra na planilha de baixa ao SAP) e com o PDF das folhas dela; o que a folha diz da execução vai para `os_digitalizacao`.
- **Não há execução, APR do sistema nem assinatura:** a OS não pontua e fica fora dos indicadores de tempo, mas conta nas preventivas encerradas e no ciclo do plano (pelo dia do fim real).
- **OS que já existe:** só é encerrada pela folha se está `liberada` e sem execução; as demais são recusadas com o motivo.
- **A APR:** a `api` confere o modelo publicado, que as respostas são de itens dele e sem repetição, e no máximo um Supervisor da Atividade; liga `usuario_id` a quem tem conta; `fonte` é `ia`, `manual` ou `nenhuma`. A APR só acompanha a OS que a folha encerra.
- **Histórico:** a importação aparece no histórico de importações e no diagnóstico de entrada de OS como o terceiro método.

### 6.7 Para experimentar

`pnpm pdf:digitalizado` (na `api`) gera um PDF escaneado fictício com duas OS (a primeira com a folha da APR 04) e o manuscrito simulado numa fonte de caneta. É o arquivo de teste com a IA: as folhas de `base/os-examples` têm nomes e matrículas reais e não vão ao fornecedor.

## 7. Rascunho de treinamento pela IA

A função `minigames` (Criação de jogos) monta o rascunho de um treinamento de serviço a partir do texto do procedimento colado pelo admin, com o trecho de origem de cada item, as conferências, as pendências que impedem publicar e os ajustes pelo chat; o admin revisa, corrige e assina antes de publicar. Usa o mesmo provedor das demais funções (modelo `*_MODELO_MINIGAMES`), os limites da seção 2.5 e, com a leitura de dados autorizada, o resumo agregado da seção 1.1. As regras, o fluxo e a publicação estão em [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md).

# Vitória e treinamentos de serviço — decisões de 14/10/2026

> Registro da discussão sobre as duas funcionalidades com IA: a **Vitória**, assistente que orienta o usuário dentro do sistema, e os **treinamentos de serviço**, um jogo por serviço do catálogo que o admin cria à mão ou com apoio da IA. Traz as decisões, o fornecedor e os custos, as regras, os riscos, a proposta de dados, rotas e páginas, e a ordem de implementação.
>
> **Situação:** decidido, não implementado. Só existe o avatar provisório da Vitória, em [vitoria/](vitoria/).
>
> Fontes: o pedido do Iago na [Reunião 2](base/reunioes/Transcricao_Reuniao2.md) (1:15:12), a análise das extras em [funcionalidades.md](funcionalidades.md) (seção 2.3), as regras da [gamificação](gameficacao.md) e as páginas oficiais de preço dos fornecedores, consultadas em 14/10/2026.

## Resumo

- **Vitória:** responde dúvidas de uso pelo manual do perfil de quem pergunta, leva à tela certa ("Me leve lá"), destaca o botão na tela e transforma consultas em português num link para a tela já filtrada. Ela não lê as OS: os dados não saem do sistema.
- **Treinamentos de serviço:** botão "Treinar" em cada serviço do catálogo. Parte 1, a Vitória explicando o serviço; parte 2, um jogo de até 10 fases (quiz, decisão, separar os itens, ligar, pôr em ordem).
- **A IA é apoio, não estrutura.** O admin cria o treinamento no editor e a IA só preenche um rascunho. Sem a IA, a Vitória responde com sugestões fixas e o jogo continua existindo.
- **Responsabilidade:** quem publica uma versão do treinamento a assina, declarando que está de acordo com as normas da empresa e com o fluxo correto do serviço.
- **Fornecedor:** Claude (Anthropic): Haiku 5.5 na Vitória e Opus 5.5 nos rascunhos dos treinamentos. A chave fica só na `api`.
- **Custo da feira** (uma semana, interna, até 200 pessoas, 3 treinamentos): de R$ 26 a R$ 65. Comprar US$ 15 de crédito pré-pago, sem recarga automática.
- **Valem as regras de sempre:** o técnico não sabe o que é eliminatório, e só o servidor calcula pontos.

---

## 1. Fornecedor e custos

### 1.1 Escolha

| Uso | Modelo | Por quê |
|---|---|---|
| Vitória | Claude Haiku 5.5 | empata com o GPT-6 Luna como o mais barato (US$ 0,10 de entrada e US$ 0,50 de saída por milhão de tokens; cache a US$ 0,01). Responder por um manual curto e escolher um link de uma lista está ao alcance de um modelo pequeno |
| Rascunho dos treinamentos | Claude Opus 5.5 | o conteúdo é de segurança e o volume é pequeno (cerca de R$ 2 por rodada) |

- **Um fornecedor para as duas:** uma conta, uma chave, uma fatura e uma integração.
- **Todas as chamadas de IA ficam num só módulo da `api`.** Se o piloto exigir processamento no Brasil, a troca (por exemplo, para a Maritaca BR-SP) mexe só nele.
- **Sem a chave configurada, a IA fica desligada:** a Vitória responde sem IA e o botão de gerar rascunho some. Nada mais muda.
- **O plano Claude Pro do time não inclui a API.** Ela é paga à parte, com crédito pré-pago no console da Anthropic, no cartão internacional (com IOF).

### 1.2 Comparativo

Premissas: PTAX de 13/10/2026 (R$ 5,01); cada mensagem da Vitória com o manual de 20 mil tokens em cache, 2 mil tokens novos e 700 de resposta.

| Modelo | Por mensagem | Observação |
|---|---|---|
| Claude Haiku 5.5 | R$ 0,004 | **escolhido** |
| OpenAI GPT-6 Luna | R$ 0,004 | mesmo preço |
| DeepSeek Flash | R$ 0,008 | descartado: servidores na China |
| Gemini 3.1 Flash-Lite | R$ 0,010 | |
| Maritaca Sabiazinho 4 | R$ 0,010 | brasileira, cobra em reais; com processamento só no Brasil (BR-SP), R$ 0,013 |
| Gemini gratuito | R$ 0 | descartado: o Google não publica mais a cota (guias de setembro de 2026 falam em cerca de 20 pedidos por dia nos Flash e 500 nos Flash-Lite, sem garantia), usa o conteúdo para treinar e permite que revisores humanos o leiam |
| Claude Sonnet 5.5 | R$ 0,065 | plano B se o Haiku falhar na bateria de perguntas |
| Claude Opus 5.5 | R$ 0,13 | |

### 1.3 Feira

| Item | Volume | Valor |
|---|---|---|
| Vitória, provável | 200 pessoas × 10 mensagens | ~R$ 10 |
| Vitória, chute alto | 200 pessoas × 20 mensagens | ~R$ 20 |
| Treinamentos | 3, com até 4 rodadas de ajuste cada, no Opus 5.5 | R$ 6 a R$ 30 |
| Testes antes da feira | desenvolvimento e a bateria de perguntas | R$ 10 a R$ 15 |
| **Total** | | **R$ 26 a R$ 65** |

- Os orçamentos são separados: os rascunhos de treinamento não consomem o limite da Vitória, nem o contrário.
- Com crédito pré-pago e sem recarga automática, o saldo é o teto de gasto. Quando acaba, a Vitória passa a responder sem IA.

### 1.4 Dados e LGPD

- **O que vai ao fornecedor:**
  - Vitória: a pergunta, o manual do perfil, a tela atual e as últimas mensagens. Nunca dados de OS.
  - Treinamentos: o texto do procedimento colado pelo admin e os materiais do serviço no catálogo.
- **Protótipo e feira:** dados fictícios e textos de demonstração; não há problema.
- **Piloto:** a empresa precisa aprovar o envio. Se não aprovar, a IA é desligada e as duas funcionalidades continuam (seção 1.1).
- **As conversas da Vitória não são guardadas no servidor.** Só ficam as perguntas que ela não soube responder, sem identificar a pessoa (seção 2.7).

---

## 2. Vitória

### 2.1 O que ela faz

| Nível | O quê | Situação |
|---|---|---|
| 1. Guia | responde pelo manual de uso do perfil, oferece os links "Me leve lá" e tem a reserva sem IA | entra |
| 2. Mostra na tela | destaca o botão (reaproveita o destaque do Campo de treino e os `data-treino`) e sugere perguntas pela tela atual | entra |
| 3. Consultas | "o que eu executei em maio" vira um link para "Meus resultados" filtrado por maio, só onde o filtro já existe | entra |
| 4. A IA lê os dados | "você executou 12 OS, sendo…" | **fora:** LGPD e números inventados; o link filtrado responde o mesmo |

- **Onde aparece:** em todas as telas, como um botão flutuante que abre o painel de conversa com sugestões fixas da tela atual (sem IA).
- **Quem atende:** os três perfis e o técnico que aguarda liberação. Para este, ela usa o manual do técnico e avisa que as telas que ele ainda não abre ficam disponíveis com a liberação.
- **Campo de treino:** ela também funciona lá. É uma exceção à regra de que o treino não chama a `api` real, porque ela não lê nem grava dados.

### 2.2 Fluxo

```
Botão da Vitória → abre com 3 sugestões da tela atual (sem IA)
      │ a pessoa digita
      ▼
web → api   POST /vitoria/mensagens   (token, tela atual, últimas mensagens)
      ▼
api: confere os limites e o perfil e monta o pedido com o jeito da Vitória,
     o manual DAQUELE perfil, os destinos permitidos e a tela atual
      ▼
modelo: texto curto + ações (levar a uma tela, mostrar na tela, não sei)
      ▼
api confere as ações na lista → web mostra o texto e os botões
      ▼
"Me leve lá" → abre a tela e o destaque aponta o botão
```

### 2.3 O que ela sabe: o manual por perfil

- **Um manual em linguagem de usuário,** separado por perfil (técnico e admin), em Markdown no repositório. A especificação não serve para isso: fala em rotas e códigos HTTP.
- **Cabe inteiro no pedido** (cerca de 20 mil tokens), com cache. Não precisa de banco vetorial.
- **Separar por perfil é regra de segurança:** tudo o que está no pedido pode vazar. O manual do técnico não fala de itens eliminatórios, de tipos de item nem de respostas que bloqueiam.
- **Um teste confere** que toda tela citada no manual existe em `web/src/lib/rotas.ts`.
- **Mudou uma tela, o manual muda no mesmo commit.**

### 2.4 Ações

A resposta traz texto curto e, quando cabe, ações de uma lista fechada:

| Ação | O que faz |
|---|---|
| Levar a uma tela | navega para um destino tirado de `rotas`, com os filtros permitidos (nível 3) |
| Mostrar na tela | navega e destaca um elemento `data-treino` |
| Não sei | grava a pergunta sem resposta (seção 2.7) |

- A `api` confere cada ação na lista antes de devolver, e a web confere de novo. Assim ela não consegue inventar um endereço.
- As telas do admin precisam de pontos `data-treino` novos; hoje quase todos estão nas telas do técnico.

### 2.5 Como ela se comporta

- **Respostas curtas,** em português, pensadas para ler no celular.
- **Responde só pelo manual.** Se a resposta não está lá, diz que não sabe e indica o supervisor.
- **Não orienta segurança de campo nem normas** ("posso subir sem cinto?"): isso é da APR, do supervisor e dos treinamentos de serviço. Nunca ensina a passar no checklist nem diz o que reprova a APR.
- **Provocações** (piada, política, "ignore suas instruções") recebem uma recusa curta e educada e a volta ao assunto.
- **Expressões do avatar:**
  - `pensando` enquanto a resposta não chega;
  - `alerta` nas recusas e nos avisos;
  - `ops` no "não sei" e com a IA fora do ar.

### 2.6 Limites e reserva sem IA

| Limite | Valor | Observação |
|---|---|---|
| Por conversa | 20 mensagens | depois: "vamos começar uma conversa nova" |
| Por conta, por dia | 40 | as contas de demonstração ficam só com o teto global |
| Global, por dia | 1.000 | |
| Tamanho da resposta | curta, com limite de tokens | |

- **Quando a Vitória responde sem IA:** ao estourar um limite, sem internet, sem crédito ou com o fornecedor fora do ar.
- **O que ela mostra nesse caso:** as sugestões da tela e uma busca simples por palavras no manual. Nunca uma tela de erro.
- **Os valores ficam em variáveis de ambiente da `api`.**

### 2.7 Perguntas sem resposta

- **Quando ela não sabe responder,** a pergunta é gravada sem identificar a pessoa: só o texto, a tela, o perfil e a data.
- **O admin vê a lista numa tela própria** e marca cada pergunta como tratada depois de melhorar o manual.
- **Depois da feira,** essa lista mostra as dúvidas reais de quem nunca viu o sistema.

### 2.8 Avatar

- **Provisório,** em [vitoria/](vitoria/): um SVG por expressão (`icone`, `padrao`, `feliz`, `explicando`, `pensando`, `alerta`, `comemorando`, `ops`) e o [`expressoes.json`](vitoria/expressoes.json), que liga cada expressão ao arquivo.
- **Para trocar pelo desenho definitivo,** basta manter os nomes ([README](vitoria/README.md)).
- **É a mesma personagem** nos treinamentos de serviço.

### 2.9 Bateria de perguntas

- **Cerca de 50 perguntas reais** com a resposta esperada, sendo umas 15 provocações e tentativas de descobrir o que reprova a APR.
- **Roda antes de cada apresentação.** Custa centavos.
- **Se o Haiku 5.5 falhar nas provocações,** a Vitória passa para o Sonnet 5.5.

---

## 3. Treinamentos de serviço

### 3.1 Regras

1. **Um treinamento por serviço do catálogo** (a `atividade`), com versões.
2. **O admin cria; a IA é apoio.** O editor manual é a base, e a IA só preenche um rascunho no mesmo formato. Sem a IA, tudo continua.
3. **Quem publica assina.** Cada versão publicada leva a assinatura do admin que a publicou (seção 3.7).
4. **A versão publicada não muda.** Editar cria um rascunho novo, que precisa de nova assinatura.
5. **Quem treina:** os técnicos, supervisores inclusive, e quem aguarda liberação, que pode praticar e aprender o fluxo do serviço enquanto espera. O admin não joga, mas pode pré-visualizar.
6. **Só o servidor corrige e pontua.** O gabarito nunca chega ao aparelho antes da resposta.
7. **O técnico continua sem saber o que é eliminatório.** O treinamento ensina o comportamento seguro ("pare se houver vazamento"), não o mapa dos itens da APR. A IA não recebe o modelo de APR.

### 3.2 Parte 1: a Vitória explicando

- **Até 12 passos,** cada um com texto, a expressão da Vitória e, se o admin quiser, uma imagem.
- **Na primeira vez,** o técnico passa pela explicação inteira. Ao refazer, pode ir direto para o jogo.

### 3.3 Parte 2: o jogo

De 3 a 10 fases, na ordem definida pelo admin, de tipos de uma lista fechada:

| Tipo | Como funciona | Certa quando | Limites |
|---|---|---|---|
| Quiz | escolher uma opção | acertou a opção | 3 ou 4 opções |
| Decisão | uma situação; cada opção mostra a consequência | escolheu a atitude segura | 3 ou 4 opções |
| Separar os itens | tocar nos itens certos, misturados a itens de outros serviços | marcou todos os certos e nenhum errado | os itens vêm do catálogo; o servidor sorteia os de outros serviços |
| Ligar | tocar num item da esquerda e no par da direita | acertou todos os pares | até 5 pares |
| Pôr em ordem | tocar nas etapas na sequência | acertou a sequência inteira | até 6 etapas |

- **Cada fase vale tudo ou nada.**
- **Tudo é por toque, sem arrastar,** para funcionar no celular.
- **As opções, os itens e os pares são embaralhados** a cada tentativa.
- **Depois de cada fase, a Vitória comenta:** diz se acertou (`feliz` ou `ops`) e mostra a resposta certa e a explicação. O jogo segue sem repetir a fase.
- **Em cada fase, o botão "Reportar problema"** manda ao admin um aviso com texto livre ("esta resposta parece errada").

### 3.4 Fluxo do técnico

1. **Entrada:**
   - Em Catálogo › Serviços, o cartão do serviço mostra "Treinar" quando há versão publicada, com o selo de concluído para quem já fez.
   - Quem aguarda liberação vê a lista dos treinamentos na tela de espera, ao lado do Campo de treino.
2. **Abertura:** o cenário, a Vitória, a duração estimada e "Revisado e assinado por Fulano em 14/10/2026".
3. **Parte 1 e Parte 2.**
4. **Resultado:** as fases certas, os pontos ganhos (`comemorando`) e o botão "Refazer".

No Campo de treino (modo fictício), o botão "Treinar" não aparece: os treinamentos usam a `api` real.

### 3.5 Fluxo do admin

```
Catálogo › Serviço 8.7.1 › aba Treinamento
   ├─ Criar manualmente ──────────────────────────────────┐
   └─ Gerar rascunho com a Vitória (IA)                   │
        texto do procedimento + materiais do serviço      │
        → rascunho com o trecho de origem de cada item    │
        → conferências automáticas (seção 3.6)            │
        → ajustes pelo chat (até 4 rodadas)               │
                                                          ▼
   Editor: explicação, fases, imagem do cenário, pré-visualizar
                                                          ▼
   Publicar: sem pendências → termo + assinatura → versão publicada
```

A aba também mostra as versões anteriores, com as assinaturas, e os problemas reportados pelos técnicos.

### 3.6 Rascunho pela IA

- **O que recebe:** o texto colado pelo admin (ferramentas, passos, normas), o nome do serviço e os materiais, ferramentas e EPIs dele no catálogo.
- **O que não recebe:** o modelo de APR, os tipos de item e as respostas que bloqueiam.
- **O que devolve:** o rascunho no formato do editor, validado pela `api`. Cada passo e cada fase traz o **trecho do texto** de onde saiu.
- **Instrução central:** usar só o texto do admin, sem conhecimento de fora.
- **Conferências automáticas.** Cada problema encontrado vira uma pendência no editor:
  - o trecho de origem não existe no texto;
  - um número (pressão, distância, ppm, prazo) não aparece no texto;
  - uma fase não tem opção certa, ou tem mais de uma.
- **Pendência impede publicar** até o admin editar o item ou confirmá-lo.
- **Ajustes pelo chat** ("encurte a explicação", "faça uma fase sobre aterramento"): até 4 rodadas por treinamento. Também dá para regerar uma fase só.
- **A geração leva de 1 a 2 minutos,** e a tela mostra o progresso ("montando a fase 5 de 10…").
- **Feira:**
  - no máximo 3 treinamentos com IA, criados ao vivo pelo admin; leve os textos dos procedimentos prontos para colar;
  - esgotado o limite, o botão fica desativado com "limite da demonstração atingido";
  - os limites ficam em variáveis de ambiente da `api`.

### 3.7 Publicação e assinatura

- **Termo, antes de publicar:** "Declaro que revisei este treinamento e que a explicação, as fases e as respostas estão de acordo com as normas da empresa e com o fluxo correto do serviço {código} — {descrição}."
- **A assinatura é a do perfil,** confirmada no uso. Quem não tem desenha na hora, e ela fica cadastrada, como nas outras assinaturas do sistema.
- **Quem publica assina a sua versão.** Se o admin A criou e o admin B corrigiu, B assina a versão 2, e a versão 1 guarda a assinatura de A.
- **A auditoria registra** a publicação, quem assinou, se o rascunho veio da IA e o texto de origem.
- **A assinatura define quem responde pelo conteúdo, mas não garante que ele foi conferido.** Por isso existem as pendências da seção 3.6 e o "Reportar problema".
- **Vale a mesma pendência das outras assinaturas:** o Iago ainda não confirmou se a assinatura desenhada vale para auditoria (questão 38).

### 3.8 Pontos e conquistas

Registrado também no [gameficacao.md](gameficacao.md#13-treinamentos-de-serviço).

| Tarefa | Quem ganha | Pontos | Limite |
|---|---|---|---|
| Treinamento de serviço concluído | o técnico, ao terminar as duas partes pela primeira vez | 5 | uma por treinamento |
| Fases certas no treinamento | o técnico | 1 por fase cuja **primeira resposta** foi certa (no máximo 10) | um lançamento por treinamento, junto com o concluído |

- **No máximo 15 pontos por treinamento,** metade de uma OS: conhecimento vale, mas trabalho em campo vale mais.
- **Vale a primeira resposta de cada fase.** Abandonar no meio e recomeçar não melhora a nota, e uma versão nova não pontua de novo quem já concluiu.
- **Errar não tira ponto, e refazer não pontua.**
- **Quem aguarda liberação pontua,** como no Campo de treino.
- **O total é limitado** pelo número de treinamentos publicados. Fazer todos na primeira semana é o comportamento que queremos.

As conquistas novas usam dois critérios novos de pessoa: "Treinamentos de serviço concluídos" e "Treinamentos gabaritados".

| Conquista | Meta | Pontos |
|---|---|---|
| Aprendiz | 3 treinamentos de serviço concluídos | 25 |
| Especialista | 10 treinamentos de serviço concluídos | 50 |
| Nota máxima | 1 treinamento gabaritado na primeira tentativa | 25 |

A meta do "Especialista" era "todos os serviços da equipe". Virou 10 treinamentos porque o sistema não liga serviços a equipes.

---

## 4. Riscos

| Risco | Onde | Gravidade | Como tratar |
|---|---|---|---|
| Ensinar um passo ou uma norma errada | treinamentos | alta | conteúdo só do texto do admin, trecho de origem, conferência de números, pendências que impedem publicar, assinatura e "Reportar problema" |
| O admin assinar sem conferir | treinamentos | alta | as pendências, o termo explícito e a auditoria |
| Revelar o que é eliminatório | as duas | alta | manual do técnico sem esse assunto; a IA não recebe o modelo de APR |
| Orientar segurança de campo ou ensinar a burlar a APR | Vitória | alta | regras de comportamento (seção 2.5) e provocações na bateria de perguntas |
| Inventar botão, tela ou fluxo | Vitória | média | responde só pelo manual, ações de lista fechada e "não sei" |
| Resposta absurda exibida na feira | Vitória | média | bateria de perguntas com provocações; plano B no Sonnet 5.5 |
| IA fora do ar, sem crédito ou sem internet na feira | as duas | média | reserva sem IA, editor manual e um roteador 4G de reserva |
| Manual desatualizado | Vitória | média | manual no repositório, teste das telas citadas e atualização no mesmo commit da tela |
| Pontos explorados | treinamentos | baixa | correção no servidor, primeira resposta de cada fase e uma vez por treinamento |
| Procedimentos e perguntas enviados ao fornecedor | as duas | baixa no protótipo | dados de demonstração, aprovação da empresa no piloto e IA desligável |
| Custo | as duas | baixa | limites e crédito pré-pago sem recarga automática |

---

## 5. Dados (proposta)

| Tabela | Colunas principais | Observação |
|---|---|---|
| `vitoria_uso` | `usuario_id`, `dia`, `mensagens` | o limite por conta; o teto global é a soma do dia |
| `vitoria_pergunta_sem_resposta` | `id`, `pergunta`, `tela`, `perfil`, `criada_em`, `tratada_em`, `tratada_por` | **sem** `usuario_id` |
| `treinamento` | `id`, `atividade_codigo` (único), `criado_em`, `criado_por` | um por serviço |
| `treinamento_versao` | `id`, `treinamento_id`, `versao`, `estado` (`rascunho`, `publicada`, `substituida`), `explicacao` (jsonb), `fases` (jsonb, com o gabarito), `cenario_path`, `texto_origem`, `gerado_com_ia`, `rodadas_ia`, `publicada_em`, `publicada_por`, `assinatura_path`, `termo` | no máximo um rascunho e uma publicada por treinamento; a `api` valida o formato do jsonb |
| `treinamento_tentativa` | `id`, `usuario_id`, `versao_id`, `iniciada_em`, `concluida_em` | |
| `treinamento_resposta` | `tentativa_id`, `fase`, `resposta` (jsonb), `certa`, `respondida_em` | a primeira resposta de cada fase define os pontos |
| `treinamento_reporte` | `id`, `versao_id`, `fase`, `usuario_id`, `texto`, `criado_em`, `tratado_em`, `tratado_por` | |

A gamificação ganha 2 tarefas (`treinamento_servico_concluido` e `treinamento_servico_fases`), 2 critérios de conquista e as 3 conquistas, por uma migração nova. A `0016` e a `0017` não mudam.

## 6. Rotas (proposta)

**Vitória**

- `POST /vitoria/mensagens` → resposta em streaming, com o texto e as ações. Todos os perfis, inclusive quem aguarda liberação.
- `GET /vitoria/sem-resposta` e `PATCH /vitoria/sem-resposta/{id}` (marcar como tratada) → só o admin.

**Treinamentos, para quem treina** (inclusive quem aguarda liberação)

- `GET /treinamentos` → os publicados, com a situação da pessoa (não feito, concluído, fases certas).
- `GET /treinamentos/{atividade}` → a versão publicada, **sem o gabarito**.
- `POST /treinamentos/{atividade}/tentativas` → abre uma tentativa.
- `POST /treinamentos/tentativas/{id}/fases/{n}` com a resposta → se acertou ou não, a resposta certa e a explicação.
- `POST /treinamentos/tentativas/{id}/concluir` → os pontos ganhos.
- `POST /treinamentos/{atividade}/reportes` com a fase e o texto.

**Treinamentos, para o admin**

- `GET` e `PUT /treinamentos/{atividade}/rascunho` → o editor.
- `POST /treinamentos/{atividade}/rascunho/gerar` com o texto (streaming) e `POST /treinamentos/{atividade}/rascunho/ajustar` com o pedido → a IA. Respondem `409` quando o limite acaba e `503` quando a IA não está configurada.
- `POST /treinamentos/{atividade}/publicar` com o aceite do termo → assina e publica.
- `GET /treinamentos/{atividade}/versoes`, `GET /treinamentos/reportes` e `PATCH /treinamentos/reportes/{id}`.

## 7. Páginas

| Página | O que muda |
|---|---|
| Todas as telas do portal | botão flutuante e painel da Vitória, na casca |
| Catálogo › Serviços | o cartão ganha "Treinar" (técnico) ou a situação do treinamento (admin) |
| Editor do serviço (admin) | aba Treinamento: editor, rascunho com a Vitória, chat de ajustes, pendências, pré-visualizar, publicar com assinatura, versões e problemas reportados |
| Treinar (nova) | `/app/catalogo/servicos/{codigo}/treinar`: abertura, Parte 1, Parte 2 e resultado |
| Aguardando liberação | bloco com os treinamentos, ao lado do Campo de treino |
| Perguntas sem resposta (nova, admin) | lista para melhorar o manual |
| Gamificação | as tarefas novas em "Como pontuar" e as conquistas novas |

O app recebe a Vitória e o "Treinar" quando existir; a `api` já serve os dois.

## 8. Ordem de implementação

1. **Treinamentos sem IA:** tabelas, editor manual, publicação com assinatura, tela de treinar, correção no servidor, pontos e conquistas. Funciona sozinho.
2. **Módulo de IA na `api` e o rascunho dos treinamentos:** conferências, pendências, ajustes e limites.
3. **Vitória, nível 1:** o manual por perfil (a maior parte do trabalho), a rota, o painel, os links, a reserva sem IA, os limites e as perguntas sem resposta.
4. **Vitória, níveis 2 e 3:** o destaque na tela, as sugestões por tela e as consultas que viram link filtrado.
5. **Antes da feira:** a bateria de perguntas, o crédito de US$ 15 e os textos dos procedimentos para criar os 3 treinamentos.

## 9. Fora do escopo e pendente

Fora, por agora:

| Ideia | Por quê |
|---|---|
| A Vitória lendo as OS e respondendo com números (nível 4) | LGPD e números inventados; o link filtrado responde o mesmo |
| Fase "tocar na imagem" | o admin precisaria marcar as áreas da imagem à mão |
| Procedimento enviado em PDF | colar o texto basta para a feira |
| Treinamento obrigatório antes da primeira execução do serviço | muda o fluxo da OS; é uma ideia forte para mostrar ao cliente |
| Imagem do cenário gerada por IA | o admin envia a imagem |

Pendente:

- O desenho definitivo da Vitória.
- A aprovação da empresa para enviar dados ao fornecedor no piloto, e a escolha de outro fornecedor se ela exigir processamento no Brasil.
- A questão 38: a validade da assinatura desenhada.

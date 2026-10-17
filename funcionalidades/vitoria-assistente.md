# Vitória, assistente de ajuda, e módulo de IA genérico — implementação de 16/10/2026 (Fases 2 e 3, em modo sem IA)

> O assistente de ajuda que aparece em toda tela do sistema (seção 2 do [vitoria.md](vitoria.md)), níveis 1 a 3: responde dúvidas de uso pelo manual do perfil de quem pergunta, oferece "Me leve lá" e "mostrar na tela" por uma lista fechada de destinos, e interpreta consultas simples ("o que eu executei em maio") como um link já filtrado. Junto, o módulo de IA genérico da seção 1, construído para a Vitória usar primeiro e os treinamentos (rascunho) e a digitalização reaproveitarem depois — nenhuma dessas duas pontas de IA entra nesta rodada.
>
> **Situação:** implementado na `api` e na `web` em 16/10/2026, **em modo sem IA**: a licença da Anthropic ainda não foi comprada, então toda resposta hoje vem do fallback (sugestões fixas + busca por palavra-chave no manual). Ligar a IA de verdade é só preencher `ANTHROPIC_API_KEY` — nenhum código muda. O nível 4 (a IA lendo as OS) está fora de escopo por decisão (LGPD e números inventados); a bateria de perguntas da seção 2.9 e o plano B no Sonnet 5.5 esperam a chave.
>
> Fontes: [vitoria.md](vitoria.md) (seções 1 e 2), já decidido; o código em `api/src/servicos/ia/`, `api/src/db/schema/vitoria.ts`, `api/src/dominio/vitoria*.ts`, `api/src/rotas/vitoria.ts`, `shared/vitoria/` e `web/src/components/vitoria/`.

## Resumo

- **Manifesto de destinos (`shared/vitoria/destinos.ts`):** um `Record<chave, Destino>` com três formas — `fixo`, `com_contexto` (parâmetro só do contexto da tela atual que o cliente manda, nunca da IA) e `com_filtro` (valor validado por regex antes de entrar na URL). É o único vocabulário que uma ação "navegar"/"destacar" pode citar; a `api` valida antes de devolver e a web confere de novo antes de navegar.
- **Diretório `shared/` na raiz:** novo, importado por caminho relativo pelos dois lados (sem symlink, sem pacote interno). Guarda também `sugestoes.ts`, as 3 sugestões fixas por tela (pergunta + resposta + ação, já prontas, sem IA), usadas tanto para abrir o painel quanto pelo fallback da `api`.
- **Teste de sincronismo** (`api/scripts/verificar-manifesto-vitoria.mts`, chamado por `api/test/vitoria-manifesto.test.ts`): confere que cada destino do manifesto corresponde a um endereço real de `rotas.ts` e que toda chave citada nos manuais existe no manifesto.
- **Manuais por perfil** (`api/conteudo/vitoria/manual-tecnico.md` e `manual-admin.md`): conteúdo real, por seção de tela, cada item terminando na chave do manifesto. O manual do técnico nunca cita item eliminatório, tipo de item ou resposta que bloqueia — reforçado também pela instrução de comportamento fixa no domínio, para não depender de quem edita o `.md`.
- **Domínio** (`api/src/dominio/vitoria.ts`): monta o pedido à IA (instrução + manual cacheado + tela atual + até 10 últimas mensagens vindas do cliente — a conversa não é guardada no servidor), valida a ação contra o manifesto, aplica os 3 limites (`vitoria_uso`) e tem um fallback completo sem IA. Nunca lança: qualquer falha cai no fallback.
- **Rotas:** `POST /vitoria/mensagens` (streaming SSE, todos os perfis, inclusive pendente e ausente), `GET`/`PATCH /vitoria/sem-resposta` (só admin).
- **Web:** botão flutuante + painel (`web/src/components/vitoria/Vitoria.tsx`) na casca única, presente em `/app` e `/web`, inclusive o Campo de treino; destaque simples de "mostrar na tela" (`DestaqueVitoria.tsx`, reaproveitando a medição extraída de `TutorialDirecionado.tsx` para um hook, `useAlvoDataTreino`); avatar compartilhado (`components/vitoria/Avatar.tsx`, reexportado por `AvatarVitoria.tsx` dos treinamentos, sem quebrar nada); streaming no cliente via `chamarEmStream` (`cliente-api.ts`); tela nova `/app/vitoria/sem-resposta` (admin).

## 1. Módulo de IA genérico (`api/src/servicos/ia/`)

Já estava pronto quando esta fase começou (Fase 2 do plano), com `ProvedorIA` (`disponivel()`, `conversar()`, `conversarEmStreaming()`), `ProvedorIAAnthropic` (fetch nativo, streaming SSE do protocolo da Anthropic), `ProvedorIAIndisponivel` (produção, sem chave) e `ProvedorIAEmMemoria` (testes). `Config.ia`/`Config.vitoria` e `Deps.ia` também já existiam. Esta fase só **usou** o módulo: nenhuma mudança nele.

## 2. Manifesto de destinos (`shared/vitoria/destinos.ts`)

- `DestinoFixo` (`caminho`), `DestinoComContexto` (`campo` + `modelo` com `{campo}`) e `DestinoComFiltro` (`campo` + `padrao` regex + `modelo`); todos com `alvo?` opcional (a chave `data-treino` a piscar em "mostrar na tela").
- `resolverAcao(acaoBruta, contexto)` é a função única usada pelos dois lados: resolve a URL e devolve `destinoDesconhecido: true` só quando a chave citada não existe (hallucinação da IA); contexto faltando ou filtro fora do padrão apenas descarta a ação, sem marcar erro.
- **Decisão:** o manifesto **não importa** `rotas.ts` (poderia, já que é TS puro sem React) — de propósito, para as duas fontes poderem divergir e o teste de sincronismo ter o que pegar. A alternativa (importar `rotas.ts` direto) eliminaria a necessidade do teste, mas tornaria a checagem tautológica.
- `AcaoResolvida` carrega também `destino` (a chave) e `valor` (o filtro já validado, quando houver): é o que permite a web **recomputar** a ação com o próprio contexto antes de navegar (a "dupla checagem" da especificação não é só confiar na URL pronta que a api mandou).
- 37 destinos cobrindo as telas dos dois perfis (quadro, OS, APR, execução, perfil, equipe, busca, dashboards, catálogo, gamificação, Campo de treino, aguardando, modelos de APR, importação, auditoria, simuladores, editor de treinamento e a própria tela de perguntas sem resposta).

## 3. Sugestões fixas (`shared/vitoria/sugestoes.ts`)

- `SUGESTOES_POR_TELA`: 3 perguntas por tela, cada uma já com a resposta pronta e uma ação opcional (só chaves do manifesto). Usadas em dois lugares: a web mostra na abertura do painel **sem chamar a `api`** (zero latência, de verdade sem IA), e o domínio as inclui na resposta do fallback para o cliente oferecer alternativas.
- **Decisão:** a "tela atual" que o cliente manda não é a URL inteira, é uma chave curta (`web/src/lib/vitoria.ts`, `telaAtualDe`) que mapeia o `pathname` para uma destas chaves (ou `"padrao"` quando não reconhece), com o contexto (`os_id`, `equipe_id`, etc.) extraído junto. Isso mantém o mesmo vocabulário entre manifesto, manuais e sugestões.

## 4. Manuais por perfil (`api/conteudo/vitoria/`)

- `manual-tecnico.md` (perfil `tecnico`, inclusive supervisor e pendente) e `manual-admin.md`, carregados e cacheados em `api/src/dominio/vitoria-manual.ts` (`manualDoPerfil`, lido do disco uma vez por processo).
- Cada manual é uma lista de itens por seção (`## Título`), cada item começando com `- ` e terminando na chave do manifesto entre colchetes; o Markdown pode quebrar o item em várias linhas (como o próprio editor faz ao formatar o parágrafo), e `entradasDoManual` junta as linhas de um mesmo item até a próxima linha em branco, título ou item — **cuidado para quem for editar:** um item sem a chave na última linha junta ou perde a chave.
- `buscarNoManual(perfil, pergunta)`: busca por palavra (sem acento, minúsculo, ignorando artigos e conectivos comuns), conta quantas palavras da pergunta aparecem no item e devolve o de mais pontos (ou `null`). É o motor do fallback sem IA.

## 5. Domínio (`api/src/dominio/vitoria.ts`)

- `montarPedido`: 3 blocos de sistema (instrução de comportamento fixa, manual cacheado com `cache: true`, e a tela atual + contexto, variável a cada pedido) + até 10 últimas mensagens do histórico vindas do cliente + a mensagem nova.
- A instrução de comportamento fixa pede JSON puro `{texto, expressao, acao}`, com `acao.tipo` em `navegar | destacar | nenhuma | nao_sei` e `destino` só entre as chaves listadas no próprio pedido. `interpretarRespostaIA` extrai o primeiro `{...}` do texto (tolera o modelo embrulhar em ```` ```json ````) e valida com Zod; falhou, cai no fallback.
- **3 limites** (`vitoria_uso`, por `usuario_id` + `dia`): por conversa (o cliente manda `numero_mensagem`, já que a conversa não fica no servidor — é um limite de UX, não de segurança: quem mentir o número só engana a própria sessão), por conta/dia e global/dia (a soma de `mensagens` de todas as contas naquele dia, sem uma linha de total separada). Só uma chamada que **de fato** chamou a IA com sucesso incrementa o contador; o fallback é de graça.
- **Pergunta sem resposta:** gravada quando o modelo diz `nao_sei` ou quando cita uma chave que não existe no manifesto (`destinoDesconhecido`); **não** gravada quando uma ação válida só não resolveu por faltar contexto (ex.: pediu a APR da OS fora da tela da OS) — nesse caso o texto continua valendo, só sem o botão.
- `responderVitoria` nunca lança: qualquer erro do provedor de IA (inclusive algo inesperado, não só `IAIndisponivel`) cai no fallback, porque por essa altura a resposta já pode estar em streaming, sem mais como virar um erro HTTP.
- **Expressões escolhidas pelo domínio** (a IA só sugere `padrao`/`alerta`/`ops`, e o servidor pode sobrepor): `ops` em "não sei" e no fallback sem achar nada; `alerta` nos limites; `padrao` no resto. `feliz`/`explicando`/`comemorando` ficam só para a saudação inicial (decidida no cliente) e para os treinamentos de serviço.

## 6. Rotas (`api/src/rotas/vitoria.ts`)

- `POST /vitoria/mensagens` (`permitirPendente: true`, `permitirAusente: true`): calcula a resposta inteira primeiro (`responderVitoria`, sem streaming de verdade da IA) e depois usa `streamSSE` (`hono/streaming`) só para **simular a digitação**, mandando o texto em pedaços de ~20 caracteres, com um evento `final` ao fim trazendo a ação resolvida, a expressão, o motivo (quando veio do fallback) e as sugestões.
  - **Decisão:** não usar `conversarEmStreaming` do provedor (token a token de verdade) porque a resposta precisa ser um JSON estruturado (`{texto, acao}`), e fatiar um JSON parcial não dá para validar nem mostrar com segurança. A "sensação" de streaming fica só na entrega ao cliente.
- `GET`/`PATCH /vitoria/sem-resposta` (só admin): paginada, filtro `tratada`, no mesmo padrão de `GET /treinamentos/reportes`.

## 7. Web (`web/src/components/vitoria/`, `web/src/lib/vitoria.ts`, `web/src/hooks/useAlvoDataTreino.ts`)

- **`Vitoria.tsx`:** botão flutuante + painel, montado uma vez na `Casca` (cobre `/app` e `/web`, inclusive o Campo de treino). Guarda a conversa só no estado do componente (nunca no servidor); ao enviar, manda as últimas 10 mensagens e `numero_mensagem` calculado pelo próprio array local.
- **Dupla checagem antes de navegar:** o botão "Me leve lá"/"Mostrar na tela" não confia direto na `url` que veio da `api` — chama `resolverAcao` de novo, no cliente, com `destino`/`valor` que vieram prontos e o **próprio contexto atual** da tela (que pode já ter mudado desde a resposta). Só navega se resolver de novo.
- **`useAlvoDataTreino` (`web/src/hooks/useAlvoDataTreino.ts`):** a lógica de achar/medir/acompanhar um `data-treino` (requestAnimationFrame + `MutationObserver` + listeners de scroll/resize), extraída de `TutorialDirecionado.tsx` sem mudar o comportamento dele (só uma função editada: ele agora chama o hook). `DestaqueVitoria.tsx` é um componente novo e bem mais simples sobre o mesmo hook: pisca um retângulo por 4 segundos e some sozinho, sem balão nem roteiro (produto diferente do tutorial).
- **Avatar compartilhado (`components/vitoria/Avatar.tsx`):** o mesmo componente que já existia em `components/web/treinamento-servico/AvatarVitoria.tsx`, movido para um lugar comum; o arquivo antigo virou um reexport de uma linha (`export { Avatar as AvatarVitoria } from "..."`), então nada que já usava `AvatarVitoria` precisou mudar. Ganhou a expressão `"icone"` (só o botão flutuante), que os treinamentos nunca usavam.
- **`chamarEmStream` (`web/src/lib/cliente-api.ts`):** função nova, lê a resposta como SSE (sem buffer, o proxy já repassa `Response.body` como stream); `chamar()` não foi tocado.
- **`telaAtualDe(pathname)` (`web/src/lib/vitoria.ts`):** de um caminho para a chave de tela (a mesma de `sugestoes.ts`) e o contexto (`os_id`, `equipe_id`, `servico_codigo`, `modelo_codigo`), por uma lista de regras ordenadas (mais específica primeiro).
- **Campo de treino:** `web/src/treino/sessao.ts` (`rotaSempreReal`) ganhou `/vitoria` inteiro na lista do que sempre vai para a `api` real, mesmo com o cookie de treino ligado — ela só consulta, nunca lê nem grava dado de campo.
- **`data-treino` novos** nas telas do admin que não tinham: os itens do menu lateral que abrem em dropdown (`GrupoMenu`) ganharam `data-treino` (faltava: `menu-dashboard`, `menu-catalogo`, `menu-gamificacao`, `menu-apr`, `menu-usuarios`, `menu-auditoria`); a aba Importação da seção Ordem de Serviço ganhou `menu-importacao` (`AbaDaSecao.chave`, renderizado em `AbasSecao.tsx`).
- **Tela nova `/app/vitoria/sem-resposta`** (`ListaPerguntasSemResposta.tsx` + `BotaoTratarPergunta.tsx`): lista paginada no padrão visual de `TabelaAuditoria.tsx`, com filtro Todas/Pendentes/Tratadas e "Marcar como tratada".
  - **Decisão:** não entrou no menu lateral (ficou só alcançável pela URL direta ou por uma ação da própria Vitória) para não aumentar mais a lista de itens do admin nesta rodada; é uma tela de uso ocasional (depois da feira, para revisar o manual).

## 8. Decisões tomadas nesta implementação

O `vitoria.md` deixava vários detalhes de desenho em aberto; ficaram assim:

- **"Tela atual" é uma chave curta, não a URL.** Compartilhada entre o manifesto de destinos, as sugestões fixas e o `data-treino`; `web/src/lib/vitoria.ts` faz a tradução do `pathname` real.
- **O streaming da rota é só de entrega**, não de geração: a resposta da IA (ou do fallback) é calculada inteira antes, e o SSE só fatia o texto para a sensação de digitação. Evita o problema de validar um JSON estruturado pela metade.
- **Limite por conversa é informado pelo cliente** (`numero_mensagem`), já que a conversa não é guardada no servidor; é um limite de experiência (evitar uma conversa infinita), não de custo — os limites de custo de verdade (conta/dia e global/dia) são sempre conferidos no servidor, contra `vitoria_uso`.
- **Ação com contexto faltando é descartada, não vira "não sei".** Só a chave inexistente no manifesto (hallucinação) vira "não sei" e é registrada como pergunta sem resposta.
- **`AcaoResolvida` carrega `destino` e `valor`** (além da `url` pronta) para a web poder validar de novo com o próprio contexto, em vez de só confiar na string que veio da `api`.
- **O manifesto não importa `rotas.ts`**, por decisão: mantém as duas fontes independentes para o teste de sincronismo ter sentido (ver seção 2).
- **Expressões do avatar na conversa restritas a `padrao`/`alerta`/`ops`**; `feliz` é só o cumprimento inicial (decidido no cliente, sem IA).
- **A página de perguntas sem resposta não entrou no menu lateral** (seção 7).

## 9. Testes

- `api/test/vitoria-manifesto.test.ts`: roda `scripts/verificar-manifesto-vitoria.mts` como processo filho.
- `api/test/vitoria-mensagens.test.ts` (15 casos): fallback sem IA por padrão (`IAIndisponivel` por fila vazia e por `falhar = true`), ação com chave inválida (vira "não sei" + grava pergunta sem resposta), ação `com_contexto` sem campo (descartada, sem virar "não sei"), ação `com_contexto` resolvida de verdade, ação `com_filtro` válida e inválida, os 3 limites, pendente e ausente conseguindo usar, admin usando o próprio manual, e a pergunta genuinamente sem match gravada sem `usuario_id`.
- `api/test/vitoria-sem-resposta.test.ts` (3 casos): só admin lista e trata; listar, paginar, filtrar e marcar como tratada; pergunta inexistente é 404.
- `api/scripts/verificar-manifesto-vitoria.mts` também corrigiu, ao ser escrito, um destino esquecido (`preventivas`) e um bug no parser de entradas do manual (itens de várias linhas perdiam a chave quando ela ficava numa linha de continuação) — os dois só apareceram depois que o teste de sincronismo rodou de verdade.

## 10. O que ficou de fora e pontos em aberto

- **A bateria de ~50 perguntas (seção 2.9) e o plano B no Sonnet 5.5:** só fazem sentido com a licença da Anthropic comprada.
- **O nível 4** (a IA lendo as OS e respondendo com números): fora de escopo por decisão (LGPD e números inventados; o link filtrado já resolve o mesmo caso de uso).
- **O rascunho de treinamento por IA** (seção 3.6 do vitoria.md): o módulo de IA genérico já existe; falta só ligar essa ponta, quando a licença existir.
- **A digitalização de OS antigas** (seção 10 do vitoria.md): fora desta rodada, como já estava decidido.
- **Aprovação da empresa para enviar dados ao fornecedor de IA no piloto** (LGPD): não bloqueia o protótipo/feira, que seguem sem a chave configurada.

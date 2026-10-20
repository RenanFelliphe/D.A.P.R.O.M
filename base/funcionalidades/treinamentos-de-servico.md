# Treinamentos de serviço — implementação de 16/10/2026 (Fase 1, sem IA)

> O jogo por serviço do catálogo (seção 3 do [vitoria.md](vitoria.md)): o admin cria manualmente uma explicação em passos (narrada pela Vitória) e um jogo de 3 a 10 fases, publica com termo e assinatura, e o técnico (inclusive quem aguarda liberação) joga e pontua. Esta rodada é 100% sem IA: nenhuma rota, coluna ou botão de geração por IA entra agora — é a Fase 1 do plano de implementação da Vitória, que funciona sozinha (seção 8 do vitoria.md).
>
> **Situação:** implementado na `api` e na `web` em 16/10/2026. As seções 1 a 9 descrevem os 5 tipos originais; os minijogos, o "1 de cada", o fim do limite de fases e a troca do "Separar os itens" pelo Selecione com os materiais do serviço estão nas seções 10 e 11. O rascunho pela IA (seção 3.6 do vitoria.md) entrou em 17/10/2026, sobre este editor: o que foi feito está na seção 3.9 do [vitoria.md](vitoria.md), e o resumo, na seção 7 abaixo. As telas da `web` foram refeitas do zero em 18/10/2026 (seção 8): a seção 4 descreve as de 16/10 e fica como histórico. O ranking de cada treinamento entrou no mesmo dia (seção 9), e também os 6 minijogos e o "Ver ranking" no cartão (seção 10). A nota do treinamento (acertos, tempo e fases), a navegação entre as fases e o ranking pela melhor nota estão na seção 12. As melhorias de 20/10/2026 (caça-palavras na diagonal, mais opções no Selecione, Termo com casas escolhidas, confirmações, tempo do jogo todo, serviços em duas seções e o Campo de treino que abria em localhost) estão na seção 13.
>
> Fontes: [vitoria.md](vitoria.md) (seção 3) e [gameficacao.md](gameficacao.md) (seção 13), já decididos; o código em `api/src/db/schema/treinamento-servico.ts`, `api/src/dominio/treinamento-servico*.ts`, `api/src/rotas/treinamentos.ts` e `web/src/components/web/treinamento-servico/`.

## Resumo

- **Nomenclatura:** tudo usa o prefixo/sufixo `treinamento_servico` / `treinamento-servico` (tabelas, arquivos, rotas), nunca `treinamento` sozinho, para não colidir com o Campo de treino (tutorial fictício, outra funcionalidade, intocado).
- **Um treinamento por serviço do catálogo** (a `atividade`), versionado como o modelo de APR: rascunho → publicada → substituída. Editar sempre cria um rascunho novo; a versão publicada não muda.
- **Parte 1 (explicação):** até 12 passos, cada um com texto, a reação da Vitória ao mostrar o passo (a foto é a mesma; só `pensando`, `alerta`, `comemorando` e `ops` animam, seção 2.8 do [vitoria.md](vitoria.md)) e uma imagem opcional.
- **Parte 2 (jogo):** 3 a 10 fases para publicar (0 a 10 em rascunho), dos 5 tipos da especificação — quiz, decisão, separar os itens, ligar, pôr em ordem — e, desde 18/10/2026, também dos 6 minijogos (seção 10), todas por toque (sem arrastar). O gabarito nunca chega ao cliente antes da resposta; o embaralhamento é gerado uma vez por tentativa e guardado (`apresentacao`), sem revelar a resposta certa.
- **Publicação:** termo fixo ("Declaro que revisei este treinamento...") + assinatura, no mesmo padrão de `PUT /me/assinatura`/`AssinaturaCanvas` já usado nas APRs.
- **Pontuação:** 5 pontos por treinamento concluído (primeira vez) + 1 ponto por fase certa na primeira resposta (até 10), no máximo 15 por treinamento; refazer não pontua, abandonar e recomeçar não melhora a nota. Quem aguarda liberação pontua, como no Campo de treino. O admin não joga, só pré-visualiza (nunca pontua).
- **3 conquistas novas:** Aprendiz (3 concluídos, 25 pts), Especialista (10 concluídos, 50 pts) e Nota máxima (1 gabaritado na primeira tentativa já aberta daquele treinamento, 25 pts).

## 1. Banco (migração `0027_treinamentos_de_servico`)

- `treinamento_servico` (um por `atividade_codigo`), `treinamento_servico_versao` (`explicacao` e `fases` em jsonb, validados pela `api`; índices parciais únicos garantem no máximo um rascunho e uma publicada por treinamento), `treinamento_servico_tentativa` (`apresentacao` jsonb com o embaralhamento, sem gabarito; índice parcial único em `(usuario_id, treinamento_id) where pontuada` garante "uma vez por treinamento" no próprio banco), `treinamento_servico_resposta` (PK composta `tentativa_id, fase`; `onConflictDoNothing` faz "vale a primeira resposta" ser automático) e `treinamento_servico_reporte`.
- `treinamento_servico_tentativa.iniciada_em` usa `defaultNow()` (o relógio do banco), não `deps.agora()`: é o que dá a cada tentativa um instante estritamente crescente mesmo com o relógio de teste parado, necessário para "a primeira tentativa já aberta" (decide a conquista Nota máxima) funcionar com segurança.
- `regra_pontuacao` ganha `treinamento_servico_concluido` (5 pts) e `treinamento_servico_fases` (1 pt/fase); `conquista` ganha as 3 conquistas novas (critérios `treinamentos_servico_concluidos` e `treinamentos_gabaritados`). Os dados das 3 conquistas ficam em `api/src/db/seed/treinamento-servico-dados.ts` (não dentro de `CONQUISTAS_DA_CARGA`, que é o retrato fechado da migração `0016`), e as imagens dos troféus são geradas e gravadas pela subida da `api` (`treinamento-servico-imagens.ts`, reaproveitando os desenhos de `imagens-gamificacao.ts`). As migrações `0016`/`0017` não mudam.
- `auditoria` ganha a entidade `"treinamento"`; `armazenamento` ganha o bucket `treinamentos` (cenário e imagens dos passos) e `arquivos` o tipo de envio `treinamento_imagem`.

## 2. Domínio

- `treinamento-servico-esquema.ts` (Zod): o formato de cada tipo de fase e `validarConteudo` (índice da opção certa dentro do intervalo, material não repetido), `validarPublicavel` (1-12 passos, 3-10 fases) e `validarFasesContraCatalogo` (os `material_ids` de "separar os itens" existem e estão ativos).
- `treinamento-servico.ts`: o CRUD do rascunho do admin, a publicação, a leitura para quem joga (sem gabarito), a abertura da tentativa (embaralha e sorteia os itens errados de outro serviço), a correção de cada fase (compara contra o gabarito privado da versão) e a conclusão (pontua só na primeira vez).
- O embaralhamento guarda, por fase, uma **permutação** (a posição mostrada → o índice original no gabarito) ou, em "separar os itens", o pool de itens certos + errados já com nome; nunca o campo que diz qual é a resposta certa. O jogador recebe só isso; a correção decodifica a resposta de volta pela permutação guardada.
- `conquistas.ts` ganhou `treinamentosGabaritados` em `DadosDaPessoa`: uma tentativa só conta como "gabaritada" se (a) pontuou, (b) acertou todas as fases na primeira resposta e (c) é a primeira tentativa já aberta daquele treinamento pela pessoa — abandonar a primeira e gabaritar a segunda não conta (testado).

## 3. Rotas (`api/src/rotas/treinamentos.ts`)

Quem treina (`permitirPendente: true`): `GET /treinamentos`, `GET /treinamentos/{atividade}` (sem gabarito), `POST /treinamentos/{atividade}/tentativas`, `POST /treinamentos/tentativas/{id}/fases/{n}`, `POST /treinamentos/tentativas/{id}/concluir`, `POST /treinamentos/{atividade}/reportes`. As rotas de responder e concluir aceitam qualquer perfil autenticado (não só técnico), porque também atendem a pré-visualização do admin; a posse da tentativa é conferida no domínio, não pelo perfil.

Admin: `GET`/`PUT /treinamentos/{atividade}/rascunho`, `POST /treinamentos/{atividade}/publicar` (termo + assinatura), `GET /treinamentos/{atividade}/versoes`, `POST /treinamentos/{atividade}/rascunho/pre-visualizar/tentativas`, `GET /treinamentos/reportes`, `PATCH /treinamentos/reportes/{id}`.

**Cuidado de rota:** como o código do serviço aceita pontos e barras (`:atividade{.+}`), ele casa com qualquer caminho sob `/treinamentos/`. As rotas com sufixo fixo (`/rascunho`, `/versoes`, `/reportes`, e a pré-visualização que também termina em `/tentativas`) precisam ser registradas **antes** da rota "nua" `GET /treinamentos/{atividade}` e da `POST /treinamentos/{atividade}/tentativas`, senão a última citada engoliria a primeira.

## 4. Web

- `CartaoServico.tsx` ganhou as abas "Materiais" (como já era) e "Treinamento" (`AbaTreinamento.tsx`): "Treinar"/"Jogar de novo" com o selo de concluído para o técnico, a situação (publicado/rascunho) e o link do editor para o admin. A página de serviços busca `GET /treinamentos` uma vez e repassa por código.
- Editor do admin em `/app/catalogo/servicos/{codigo}/treinamento` (`EditorTreinamentoServico.tsx` + `EditorFase.tsx`, um sub-editor por tipo de fase): explicação, fases, cenário, pré-visualizar (reaproveita o motor do jogo, `pontua={false}`), publicar (termo + `AssinaturaCanvas`), versões e reportes.
- Jogador em `/app/catalogo/servicos/{codigo}/treinar` (`JogoTreinamentoServico.tsx`, o motor comum entre jogo de verdade e pré-visualização): abertura, Parte 1 com `AvatarVitoria.tsx` (a foto de perfil, e `FigurinhaVitoria` no lugar dela quando há reação), Parte 2 com `FaseJogavel.tsx` (os 5 tipos, tudo por toque) e o resultado (`PontosGanhos`, já existente na gamificação).
- Bloco "Treinamentos de serviço" na tela de "Aguardando liberação" (`TreinamentosDeServicoAguardando.tsx`), ao lado do Campo de treino.
- **Atualizado em 17/10/2026:** o avatar provisório (SVGs e `expressoes.json`) foi substituído pelo desenho definitivo: uma foto de perfil e 10 animações em `web/public/vitoria/` (seção 2.8 do [vitoria.md](vitoria.md)). O feedback de cada fase mostra a figurinha `certo` ou `errada`, e o resultado mostra a `comemorando`.
- "Como pontuar" da gamificação já reflete as 2 regras novas sozinho: a tela itera `GET /gamificacao/regras` por grupo, sem lista fixa na web.

## 5. Decisões tomadas nesta implementação

O `vitoria.md` deixava os detalhes de representação de dados em aberto; ficaram assim:

- **Campos em snake_case** nos jsonb de fase (`material_ids`, `quantidade_errados`, `imagem_path`), no padrão do resto da API (`esquemaItem` do modelo de APR).
- **"Decisão"** mostra as opções sem a consequência antes de responder; depois, revela a consequência da escolhida e a da certa (a UI não precisa expor todas de uma vez).
- **"Separar os itens"** exige 2 ou mais materiais certos (não 1), para a tela sempre ter o que separar de verdade.
- **Duração estimada** da abertura é uma conta simples (meio minuto por passo de explicação + 45 segundos por fase), sem fórmula definida na especificação.
- **Rotas de responder/concluir fase** aceitam qualquer perfil autenticado (não restringem a técnico), para servir também a pré-visualização do admin sem duplicar rota.

## 6. Testes

`api/test/treinamento-servico.test.ts` (15 casos): os 5 tipos de fase (certo/errado, gabarito nunca exposto antes da resposta, vale a primeira resposta), o embaralhamento, os itens errados sorteados de outro serviço, a pontuação (primeira conclusão, idempotência, refazer não pontua, abandonar não conta como gabarito), quem aguarda liberação jogando e pontuando, as 3 conquistas, o admin pré-visualizando sem pontuar, as permissões e a auditoria da publicação. `api/test/treinamento.test.ts` (Campo de treino) não foi tocado.

A migração também obrigou a atualizar `api/test/gamificacao-conquistas.test.ts` (a carga inicial passou de 23 para 26 conquistas e de 14 para 16 regras, pelas 3 conquistas e 2 regras novas).

## 7. O que ficou de fora e pontos em aberto

- **Rascunho por IA, conferências automáticas e ajustes por chat** (seção 3.6 do vitoria.md): **feitos em 17/10/2026** (seção 3.9 do [vitoria.md](vitoria.md)). O que muda neste editor: o painel "Rascunho com a Vitória (IA)" no topo; o trecho de origem, as pendências e "Confirmar como está" em cada item da IA; "Regerar esta fase com a Vitória"; e o "Publicar" desativado enquanto houver pendência (`422 pendencias_abertas` na `api`). A auditoria da publicação passou a registrar `gerado_com_ia` e o texto de origem, e editar um treinamento publicado passou a partir da versão publicada, em vez de um rascunho vazio.
- **Imagem do cenário gerada por IA:** fora de escopo (o admin envia a imagem).
- **Procedimento em PDF:** fora de escopo; o admin edita direto no editor.
- **Questão 38** (validade da assinatura desenhada para auditoria): vale para a publicação do treinamento do mesmo jeito que já vale para a APR.

## 8. Telas refeitas (18/10/2026)

> O pedido: as telas de criar e de jogar estavam numa página só, com a estrutura, o estilo e a responsividade quebrados, sem uma passagem clara da explicação para o jogo e sem uma escolha clara entre criar com a IA ou à mão. Foram refeitas do zero na `web`, em páginas separadas, com o jogo numa janela. A `api` não mudou.

### 8.1 As páginas do admin

Todas em `/app/catalogo/servicos/{codigo}/treinamento`, com o caminho, o título e a situação (no ar, rascunho em edição) no topo.

| Endereço | O que tem |
|---|---|
| `/treinamento` | **Visão geral:** o caminho até publicar (Conteúdo, Validação, Teste e Publicação), com a situação e o atalho de cada etapa; ao lado, a versão no ar, os problemas em aberto e a Vitória. Sem nada criado, leva a Criar. |
| `/treinamento/criar` | **A escolha:** "Gerar com a Vitória (IA)", para validar depois, ou "Criar manualmente". Sem a IA configurada ou com o limite da demonstração esgotado, a primeira fica desativada com o motivo. |
| `/treinamento/gerar` | **Gerar com a Vitória:** como escrever o procedimento (o que o serviço usa, os passos na ordem, os cuidados, os números exatos), o exemplo logo abaixo, com "Usar este exemplo", o texto e o botão. Na espera, a Vitória pensando sem parar, a frase do momento, a barra, as etapas e o tempo. Pronto, ela comemora e a Revisão abre sozinha. |
| `/treinamento/explicacao` | **Aba Explicação:** a imagem do cenário e os passos; a reação de cada passo é escolhida pelas figurinhas da Vitória; no computador, a prévia do passo em edição fica ao lado. |
| `/treinamento/fases` | **Aba Fases do jogo:** uma fase aberta por vez; a fase nova começa pela escolha do tipo, num cartão com o que cada um pede; "separar os itens" mostra o nome dos materiais (antes, o id), os do serviço primeiro. |
| `/treinamento/revisao` | **Aba Revisão (a validação):** o treinamento como o técnico vai ver, com a resposta certa marcada; nos itens da Vitória, o trecho de origem, as pendências, "Confirmar como está" (grava na hora), "Editar" (leva ao item no editor) e "Regerar com a Vitória"; o filtro "Com pendência"; os ajustes pelo chat; "Testar o jogo" e "Ir para a publicação". |
| `/treinamento/publicar` | **Publicar:** os requisitos, com o atalho para resolver cada um, o que vai ao ar, o termo e "Assinar e publicar". Publicado, a Vitória comemora. |
| `/treinamento/versoes` | **Aba Versões:** a linha do tempo, com quem assinou cada publicação. |
| `/treinamento/problemas` | **Aba Problemas:** os reportes deste serviço, com "Marcar como tratado" (`PATCH /treinamentos/reportes/{id}`, que já existia na `api` e não tinha tela). |

- **As abas** ficam no grupo de rotas `(painel)`; Criar, Gerar e Publicar são telas de fluxo, sem abas, com o "Voltar".
- **A barra do rascunho,** fixa no pé da Explicação e das Fases (no celular, acima da barra de navegação): tudo salvo, alterações não salvas ou o erro; "Descartar", "Testar o jogo", "Salvar" e o próximo passo (Fases do jogo, depois Revisão), que salva antes de seguir. Sair da página com alteração não salva pede a confirmação do navegador.
- **Conferência antes de salvar:** a web aponta os campos vazios item por item (`problemasDoConteudo`), em vez de mandar e receber o `422` do rascunho inteiro.
- **Nenhuma versão nova por acaso:** `GET .../rascunho` cria o rascunho quando não há um. A visão geral, as versões, os problemas e a publicação olham as versões antes e só abrem o rascunho se ele já existir; só as abas de edição, Criar e Gerar o criam. Antes, abrir o editor de um treinamento publicado já criava a versão seguinte.

### 8.2 O jogo numa janela

- **A janela** (`JanelaDoJogo`, sobre a `<dialog>` nativa) ocupa a tela inteira no celular. A trilha do topo mostra a Parte 1 como uma barra e a Parte 2 com um ponto por fase, verde ou vermelho depois de respondida.
- **As etapas:** capa, explicação, a passagem "Agora é a sua vez!" (a tentativa só é aberta nela), as fases e o resultado.
- **A Vitória em todas:** acena na capa; em cada passo, a reação escolhida pelo admin e o texto aparecendo aos poucos, como fala (um toque mostra tudo); o dedo levantado na passagem ("vale a primeira resposta"); a instrução de cada tipo de fase; `certo` ou `errada`, com a explicação, no retorno; e a comemoração no resultado.
- **As fases:** escolher e depois confirmar (antes, tocar numa opção já respondia, e um toque errado custava a fase). Depois da correção, a seleção fica colorida (certa, errada, faltou marcar), e a decisão mostra a consequência. No "ligar", cada par ganha uma cor e um número dos dois lados; tocar num par já feito o desfaz.
- **O resultado:** a nota num anel, confete, os pontos (ou por que não houve), cada fase com o tipo, "Jogar de novo" e "Rever a explicação".
- **Sair no meio** pede confirmação: as respostas já dadas continuam valendo.
- **Onde abre:** o "Treinar" do cartão do catálogo e da tela de espera abre a janela direto; `/treinar` virou a capa do treinamento (o destino dos avisos e da Vitória), com o mesmo botão; o admin testa na mesma janela, sem pontuar e sem reportar.

### 8.3 Decisões

- **Publicar usa a assinatura do perfil,** na `JanelaDeAssinatura` das outras ações assinadas ([assinaturas.md](assinaturas.md)); antes, a assinatura era desenhada a cada publicação. A `api` não mudou: recebe o id da assinatura do perfil, como os outros atos.
- **O aviso de problema reportado** leva à aba Problemas (`shared/notificacoes/avisos.ts` e o detalhe do aviso).
- **O resultado sempre usa `comemorando`** (seção 2.8.2 do [vitoria.md](vitoria.md)); muda só a frase, conforme a nota.
- **A espera da IA usa `pensando` em loop:** as figurinhas tocam uma vez só, então ela recomeça a cada 5 s (`VitoriaEmLoop`); com "reduzir movimento", fica o quadro parado.
- **Ícones novos** no sprite: `up`, `link`, `pencil`, `trash`, `sparkle`, `flag` e `eye`.
- **O manual do admin e o do técnico da Vitória** e as sugestões da tela do editor descrevem as telas novas.

### 8.4 Código e conferência

- `web/src/components/web/treinamento-servico/`: `jogo/` (a janela e as telas do jogo, o reporte e o botão "Treinar"), `editor/` (uma tela por arquivo, `useRascunho`, `useRascunhoIA`, a barra e a origem da Vitória), `vitoria/` (a cena com o balão, o texto falado e o loop), a capa e a aba do cartão.
- As rotas em `web/src/app/app/(portal)/catalogo/servicos/[codigo]/treinamento/` (`layout.tsx`, `(painel)/`, `criar/`, `gerar/` e `publicar/`); as leituras do servidor em `web/src/lib/treinamento-servico-servidor.ts` e o exemplo de procedimento em `treinamento-servico-exemplo.ts`.
- Os estilos em `web/src/styles/treinamento-servico.css` (prefixo `ts-`), com os pontos de quebra do sistema (1023, 767, 640 e 479 px) e sem animação com "reduzir movimento".
- Saíram `EditorTreinamentoServico`, `JogoTreinamentoServico`, `FaseJogavel`, `PainelRascunhoIA`, `MetaIADoItem`, `TreinarServico`, `ImagemDoTreinamento`, `AvatarVitoria` e a página única do editor.
- Conferido com `tsc` e `eslint` da `web`, `tsc` da `api` e os testes `vitoria-manifesto`, `vitoria-mensagens`, `treinamento-servico` e `avisos-e-emails`. A conferência visual (navegador, celular) ainda não foi feita.

### 8.5 Segunda rodada: o jogo mais interativo e o cartão do catálogo (18/10/2026)

**O jogo:**
- **O topo virou placar:** gradiente, a trilha (a Parte 1 em segmentos, um por passo; a Parte 2 com um ponto por fase), as fases certas (estrela) e a sequência de acertos (o fogo, a partir de 2 seguidas), o alto-falante e o fechar.
- **"3, 2, 1, Valendo!"** ao começar o jogo, enquanto o servidor embaralha as fases, e uma abertura rápida de cada fase ("Fase 3 · Decisão"; "Última fase!"), que um toque pula.
- **O retorno de cada fase sobe do rodapé:** verde ou vermelho, com a figurinha da Vitória, estrelinhas estourando no acerto, tremor no erro, a explicação e "Continuar". A instrução da Vitória fica no topo antes da resposta.
- **Quiz e decisão em blocos coloridos** (A azul, B laranja, C verde, D roxo), no quiz em duas colunas; "separar os itens" em cartões com o contador de marcados; no "ligar", a curva colorida de cada par desenhada entre as colunas; no "pôr em ordem", a próxima vaga piscando.
- **Explicação:** o número do passo enorme e clarinho atrás da Vitória, a foto balançando enquanto ela "fala", o selo "Atenção" nos cuidados, e a troca de passo pelas setas do teclado ou deslizando o dedo.
- **Resultado:** três estrelas (todas certas: 3; ao menos 60%: 2; alguma: 1) acendendo uma a uma, a nota contando no anel e mais confete na nota máxima.
- **Som e vibração:** sons curtos sintetizados no navegador (`web/src/lib/sons-do-jogo.ts`, sem arquivos para baixar), com o alto-falante para desligar (a escolha fica no aparelho) e uma vibração curta no celular no acerto e no erro.
- **Teclado:** 1 a 4 ou A a D escolhem, Enter confirma e segue, as setas trocam o passo; as dicas aparecem só onde há teclado.
- **Celular deitado** (altura até 560 px): a janela ocupa a tela, o topo encolhe, a trilha perde os rótulos e a instrução some, para sobrar espaço para a fase. Com "reduzir movimento", nada disso se mexe: sem contagem, sem abertura, as linhas do "ligar" e as estrelas já aparecem prontas.
- O CSS do jogo passou para `web/src/styles/treinamento-jogo.css`; os efeitos (som, teclado, contagem, abertura, estrelas) estão em `jogo/efeitos.tsx`.

**O cartão do serviço no catálogo:** saíram as abas Materiais e Treinamento. Ficam o código e a descrição e, só quando existem, "Ver materiais" (a lista abre no próprio cartão) e "Jogar treinamento" (a janela do jogo); sem materiais nem treinamento, nenhum dos dois. Com treinamento publicado, o cartãozinho da Vitória fica à vista (com o selo de concluído e as fases certas). Para o admin, que não joga, o segundo botão é "Abrir treinamento" e, sem treinamento, "Criar treinamento" (a única entrada para criar um); "Editar lista" continua no topo do cartão. O editor da lista agora se ajusta à largura do cartão (consulta de contêiner), e não à da janela: antes, no computador, as quatro colunas ficavam espremidas dentro do cartão.

**Responsividade das telas antigas desse cenário:** o balão do tutorial do Campo de treino com altura limitada (celular deitado) e acima da barra inferior; o botão "Roteiro" sem ficar por cima do botão da Vitória; a faixa do treino cabendo em 320 px; os botões da tela de espera ocupando a linha no celular; e as abas das seções (Gamificação, treinamento e as outras) rolando de lado no tablet, em vez de quebrar o rótulo em duas linhas.

## 9. Ranking do treinamento (18/10/2026)

> O pedido: ao concluir o jogo, mostrar a pontuação da pessoa e o ranking geral daquele treinamento, com todo mundo que já fez. Sem migração: o ranking sai das tentativas que já são gravadas.

### 9.1 Como funciona

- **Quem entra:** quem já concluiu o treinamento. Conta a **primeira conclusão** (a tentativa que pontuou), como nos pontos: jogar de novo não muda a posição, senão bastaria decorar as respostas e refazer.
- **A nota:** as fases certas de primeira divididas pelas fases da versão jogada (o aproveitamento, de 0 a 100%). Assim, quem jogou uma versão com mais ou menos fases fica na mesma escala.
- **Empate:** quem acertou mais fases e, depois, quem concluiu primeiro (a mesma regra do ranking da gamificação, "quem chegou primeiro").
- **Quem aparece:** técnicos ativos, inclusive quem aguarda liberação (eles treinam e pontuam). Quem foi recusado ou desativado sai. O admin não joga e não aparece, mas vê o ranking.
- **Anônimo:** o mesmo da gamificação. Quem marcou "Aparecer como anônimo no ranking" aparece como "Participante anônimo" para os outros; a própria pessoa e o admin veem o nome.

### 9.2 Onde aparece

- **No resultado do jogo,** logo abaixo dos pontos: "Você está em Nº", as dez primeiras posições (medalha nas três primeiras, a equipe, a barra do aproveitamento, as fases certas e o %) e, se a pessoa estiver mais abaixo, a linha dela no fim, depois de "⋯". A linha da pessoa fica em destaque. Ao jogar de novo, uma nota avisa que no ranking fica a primeira conclusão.
- **Na capa do treinamento** (`/treinar`), abaixo das três partes: o mesmo ranking, para quem ainda vai jogar e para o admin.
- **No teste do admin** não há ranking (o rascunho não tem ranking e o teste não pontua).

### 9.3 Código e conferência

- `api`: `GET /treinamentos/{atividade}/ranking?limite=` (padrão 10, até 100), aberto a qualquer perfil autenticado, inclusive quem aguarda liberação; registrada antes da rota "nua" `GET /treinamentos/{atividade}` (seção 3). Devolve `participantes`, `linhas` e `minha` (a linha de quem pede, mesmo fora das primeiras; nula para quem não concluiu e para o admin). O domínio fica em `api/src/dominio/treinamento-servico-ranking.ts` e reaproveita `mascararPessoa` do ranking da gamificação.
- `web`: `RankingDoTreinamento.tsx` (o bloco, usado nos dois lugares), `JanelaDoJogo` lê o ranking depois de concluir (`carregarRanking`, que só o jogo de verdade passa; o resultado não espera por ele) e a página `/treinar` lê junto com o resto. Estilos em `treinamento-servico.css` (`ts-ranking`).
- O manual do técnico da Vitória ganhou o ranking.
- Conferido com o teste novo em `api/test/treinamento-servico.test.ts` (ordem, primeira conclusão valendo, anônimo, pendente, recusado, admin, limite e 404), `tsc` da `api` e da `web` e `eslint` da `web`. A conferência visual ainda não foi feita.

## 10. Minijogos e "Ver ranking" (18/10/2026)

Os tipos de fase passaram de 5 para 11, e todos são tratados como minijogos, no mesmo nível (sem separação entre "clássicos" e novos). Cada um tem uma frase curta do que é o jogo ("Descubra a resposta certa para a pergunta", "Descubra a palavra secreta pelas cores das letras"...), que aparece embaixo do nome na escolha do tipo, na lista lateral do editor, no plano das fases e na abertura de cada fase no jogo. Cada tipo tem a sua cor, o seu ícone e o seu jeito de mostrar as peças, para quem joga reconhecer o tipo assim que a fase abre: a cor pinta o selo do tipo, a abertura "Fase N", o fundo da tela, a lista da passagem para o jogo, o resultado e os ícones do editor.

### 10.1 Os tipos novos

| Tipo | Como funciona | Certa quando | Limites | Visual |
|---|---|---|---|---|
| Verdadeiro ou falso | uma afirmação; duas cartas, "Verdadeiro" e "Falso" | escolheu a carta certa | afirmação até 400 caracteres | rosa; a afirmação numa placa com aspas e duas cartas grandes (verde e vermelha) |
| Caça-palavras | tocar na primeira e na última letra de cada palavra; o jogo reconhece a palavra na hora | achou todas | 2 a 5 palavras de 3 a 12 letras, uma palavra só cada; só na horizontal (esquerda→direita) ou na vertical (cima→baixo), nunca na diagonal; grade de 8 a 12 (desde 20/10/2026, também na diagonal, se cruzando, numa grade de 10 a 14: seção 13) | verde-limão; papel quadriculado e a lista com as palavras riscadas ao achar |
| Memória | virar duas cartas por vez e formar os pares (termo e o que corresponde) | formou todos os pares errando no máximo uma vez por par | 2 a 5 pares (4 a 10 cartas), cada carta até 80 caracteres | roxo; mesa de feltro e cartas que viram em 3D |
| Selecione | marcar tudo o que atende ao pedido (várias certas) | marcou todas as certas e nenhuma errada | 3 a 12 opções, 1 a 8 certas e ao menos uma errada | verde-esmeralda; prancheta com caixas de marcar |
| Desembaralhe | uma palavra com as letras embaralhadas e a dica dela; tocar nas letras na ordem | formou a palavra | banco de 10 palavras (3 a 14 letras, com o acento), cada uma com a sua dica; cada partida sorteia uma | dourado; peças de letra de madeira e as casas da palavra |
| Termo | digitar palavras inteiras; cada letra fica verde (lugar certo), amarela (em outro lugar) ou cinza (não tem, já contadas as vezes que aparece) | acertou a palavra dentro das tentativas | banco de 10 palavras de 4 a 7 letras (dica opcional); cada partida sorteia uma; tentativas = letras + 1; sem acento ("mao" vale para "mão"); não confere se o palpite existe | grafite; tabuleiro escuro, casas que viram uma a uma e teclado na tela pintado |

- **No caça-palavras,** o admin escolhe o que quem joga vê: as palavras (a pista, se houver, vai embaixo) ou só as pistas (a palavra fica escondida, com o número de letras). A grade não tem acento nem cedilha ("Inspeção" vira INSPECAO). Se o preenchimento formar a palavra de novo em outro lugar, achar lá também vale.
- **Na memória,** o termo aparece em negrito e o correspondente em itálico, para ver qual lado do par cada carta é.
- **Tudo continua por toque.** No computador também pelo teclado: V/F no verdadeiro ou falso, 1 a 9 no selecione, digitar as letras (e Backspace) no desembaralhe e no Termo.

### 10.2 Como o servidor corrige

- A grade do caça-palavras, a mesa da memória e as letras do desembaralhe são sorteadas na abertura da tentativa e gravadas na `apresentacao`, como o embaralhamento dos outros tipos; a correção usa só o que foi gravado.
- **Caça-palavras:** a resposta são as marcações (início e fim de cada uma); o servidor lê as letras na grade gravada. **Memória:** a resposta são as jogadas na ordem; o servidor refaz a partida, conta os erros e recusa jogada impossível (`422`). **Termo:** a resposta são os palpites; o servidor confere o tamanho de cada um e o limite de tentativas (`422` fora disso) e se algum é a palavra.
- **O que vai ao jogo antes da resposta:** nos três jogos com retorno imediato (caça-palavras, memória e Termo), o jogo precisa saber na hora se a marcação é uma palavra, se as duas cartas são par e a cor de cada letra. Por isso vão, respectivamente, a impressão de cada palavra (`chaveDaPalavra`), o grupo de cada carta (um número sorteado, não o índice do par) e a palavra do Termo codificada (`codificarTermo`). Não é segredo de verdade (quem abrir a resposta da rede consegue decodificar); a nota que vale é sempre a do servidor.
- As regras que valem dos dois lados (letras da grade, peças do desembaralhe, linha entre duas células, cores do Termo) ficam em `shared/treinamento-servico/jogos.ts`. A regra que cruza campos de uma fase virou `problemaDaFase` (`treinamento-servico-esquema.ts`), usada ao salvar e também na geração pela IA, que descarta a fase incoerente em vez de gravar um rascunho que o editor recusaria.
- **IA:** o formato pedido à Vitória ganhou os 6 tipos. Palavra do caça-palavras, do desembaralhe e do Termo que não aparece no texto do procedimento vira a pendência `palavra_fora_do_texto`; palavra com espaço ou número é tirada, com pendência.
- Sem migração: as fases e a apresentação já são jsonb.

### 10.3 Jogar de novo: palavra sorteada e opções embaralhadas

- **Desembaralhe e Termo guardam um banco de 10 palavras** (`palavras`, cada uma com a sua dica). Cada tentativa sorteia uma e grava qual saiu na apresentação (`sorteada`); a correção usa a sorteada. O rascunho aceita de 1 a 10, para salvar no meio do caminho; **publicar exige as 10** (`422 palavras_insuficientes`; na tela, o requisito "Desembaralhe e Termo com 10 palavras" aparece quando há uma dessas fases). Palavra repetida no banco é recusada. A IA é pedida a montar as 10; o que faltar vira a pendência `palavras_insuficientes`.
- **Toda fase com opções vem numa ordem nova a cada tentativa**, e a tentativa é aberta a cada "Começar o jogo", "Jogar de novo" ou recarga da página: as opções do quiz, da decisão e do selecione, os itens de separar, os dois lados do ligar, as etapas do pôr em ordem, as cartas da memória, a grade do caça-palavras e as letras do desembaralhe. As opções **nunca saem na ordem em que o admin escreveu** (`permutacaoDesordenada`): no pôr em ordem ela é a resposta, e no quiz, na decisão e no selecione a certa costuma vir primeiro. No ligar, a direita nunca fica na mesma ordem da esquerda (os pares não ficam um em frente ao outro).

### 10.4 Gerar com a Vitória: as fases do jogo

Logo abaixo do card do texto do procedimento, o card "Fases do jogo": quantas fases (ao menos 3, começa em 5; o máximo saiu na seção 11) e o tipo de cada uma, na ordem, ou "A Vitória escolhe" (ex.: 7 fases, todas quiz). "Todas como" preenche o plano inteiro de uma vez. Embaixo de cada fase, a frase do minijogo escolhido. "Separar os itens" só aparece com 2 ou mais materiais do serviço no catálogo.

- O plano vai na geração (`POST /treinamentos/{atividade}/rascunho/gerar`, campo `plano`: ao menos 3 minijogos ou `null`) e entra no pedido à IA, que vale mais que "varie os tipos". Antes de chamar a IA, a `api` recusa plano com tipo inexistente ou fora de 3 a 10 fases, e "separar os itens" sem materiais (`422 plano_sem_materiais`).
- Depois, confere o que voltou: fase de outro tipo ganha a pendência `fora_do_plano` ("O plano pedia Quiz nesta fase, e a Vitória montou Decisão"), o que passar do número pedido fica de fora, e fase a menos vai no resumo.
- Componente: `PlanoDoJogo.tsx`. Os ajustes pelo chat e a fase regerada não usam o plano.

### 10.5 "Ver ranking" no cartão do serviço

Ao lado de "Jogar treinamento" (e de "Abrir treinamento", para o admin), "Ver ranking" abre numa janela o ranking daquele treinamento (seção 9), sem precisar jogar. Busca ao abrir (`GET /treinamentos/{atividade}/ranking`). Componente: `BotaoVerRanking.tsx`.

### 10.6 Código e conferência

- `api`: `treinamento-servico-esquema.ts` (os 6 esquemas, `problemaDaFase`, as respostas), `treinamento-servico-jogos.ts` (grade, memória, letras), `treinamento-servico.ts` (apresentação e correção), `treinamento-servico-ia.ts` (formato e conversão).
- `web`: `lib/treinamento-servico.ts` (tipos, limites, `TIPOS_DE_FASE` com a frase de cada minijogo), `EditorFase.tsx` e `GabaritoDaFase.tsx` (um editor e um gabarito por tipo), `FaseDoJogo.tsx` (os 6 jogos), `Icon.tsx` (6 ícones: `vf`, `caca`, `cartas`, `checks`, `embaralhar`, `termo`) e `styles/treinamento-minijogos.css` (a identidade de cada tipo e os minijogos).
- Testes: `api/test/treinamento-servico-jogos.test.ts` (grade sempre com todas as palavras, só em linha reta, 5 palavras de 12 letras; memória refeita; letras nunca já na ordem; cores do Termo com letra repetida) e 2 casos novos em `treinamento-servico.test.ts` (nada do gabarito antes da resposta, certo e errado em cada tipo, gabarito depois da resposta, regras que recusam o rascunho). Depois, casos para o sorteio do banco e o embaralhamento a cada tentativa, a publicação exigindo as 10 palavras e o plano das fases na geração (`treinamento-servico-ia.test.ts`). Os 37 testes dos treinamentos passam; `tsc` da `api` e da `web` e `eslint` da `web` limpos. A conferência visual ainda não foi feita.

## 11. Selecione com os materiais do serviço, "1 de cada" e sem limite de fases (18/10/2026)

### 11.1 O "Separar os itens" virou o Selecione com os materiais do serviço

Os dois eram o mesmo jogo (marcar todas as opções certas), e o Selecione é mais amplo. Ficaram 10 minijogos.

- **No editor,** o Selecione tem a caixa **"Montar com os materiais do serviço"**. Marcada, as opções escritas dão lugar ao seletor de materiais (os do serviço primeiro, os outros pela busca no catálogo): o admin marca os certos (de 1 a 10) e quantos itens de outros serviços o sistema sorteia a cada partida (de 1 a 10). Desmarcar e marcar de novo não perde nem as opções escritas nem os materiais.
- **No jogo,** é o mesmo Selecione: os materiais certos e os intrusos sorteados, embaralhados, e quem joga marca todos os certos.
- **Dados:** a fase `selecione` ganhou `materiais: { material_ids, quantidade_errados }` (com ele, `opcoes` fica vazia). A apresentação guarda os itens sorteados já com nome, como fazia o Separar. A `api` confere os materiais contra o catálogo (existem e estão ativos), como antes.
- **Migração `0033_selecione_com_materiais`** (só dados): cada fase `separar_itens` gravada vira um `selecione` com `materiais` (mesmos materiais, mesma quantidade de intrusos, mesma posição e a mesma meta da IA), e as tentativas abertas também convertem a apresentação, para continuarem corrigindo. Testada sobre dados no formato antigo (`treinamento-servico.test.ts`).
- **IA:** o formato pedido trocou o `separar_itens` pelo Selecione com `materiais`; se a IA ainda mandar o tipo antigo, ele é convertido. No plano das fases, há o pedido "Selecione com os materiais do serviço" (`selecione_materiais`), recusado (`422 plano_sem_materiais`) quando o serviço não tem material no catálogo.

### 11.2 Sem limite de fases e "1 de cada"

- **O jogo não tem mais limite de fases:** para publicar, continuam sendo ao menos 3. A `api` guarda só um teto técnico de 50 fases (`TETO_DE_FASES`), que não aparece nas telas e protege o servidor e a geração de um pedido gigante. A pontuação não muda: o concluído vale 5 e contam até 10 fases certas.
- **"1 de cada":** uma fase de cada minijogo (10), em ordem aleatória (cada toque sorteia outra ordem). Fica na escolha do minijogo do editor (acrescenta as 10 fases em branco) e no plano das fases da geração com a Vitória (monta o plano com as 10).

### 11.3 Código e conferência

- `api`: `treinamento-servico-esquema.ts` (`materiais` no Selecione, `TETO_DE_FASES`), `treinamento-servico.ts` (apresentação e correção do Selecione com materiais), `treinamento-servico-ia.ts` (formato, conversão do tipo antigo e o pedido `selecione_materiais` no plano) e `db/migrations/0033_selecione_com_materiais.sql`.
- `web`: `EditorFase.tsx` (`EditorSelecione` com a caixa e `MateriaisDoServico`), `GabaritoDaFase.tsx`, `EditorDasFases.tsx` e `PlanoDoJogo.tsx` ("1 de cada"), `lib/treinamento-servico.ts` (`umDeCada`, `PedidoDoPlano`).
- Os 39 testes dos treinamentos passam (inclusive a migração sobre dados antigos, 12 fases publicadas e o plano com materiais); `tsc` da `api` e da `web` e `eslint` da `web` limpos. A conferência visual ainda não foi feita.

## 12. A nota do treinamento e a navegação entre as fases (18/10/2026)

As regras de negócio "Pontuação e navegação dos treinamentos gamificados" (18/10/2026), com quatro decisões tomadas com o usuário no mesmo dia:

1. **A fórmula é a nota do treinamento,** que ordena o ranking dele. A gamificação geral (patentes, ranking geral) **não muda**: 5 pontos pelo concluído e 1 por fase certa (até 10), só na primeira conclusão. Uma nota de até 10.000 por treinamento atropelaria as OS e as patentes.
2. **A resposta confirmada fica travada:** voltar a uma fase confirmada mostra a resposta e a correção; responder de novo devolve a correção gravada.
3. **A fase só começada conta ao finalizar:** o que a pessoa fez numa fase sem confirmar (ex.: 2 de 4 palavras) é guardado enquanto ela joga e corrigido ao finalizar.
4. **No ranking do treinamento vale a melhor nota** de cada pessoa. Jogar de novo pode subir a posição, mas não dá pontos na gamificação.

### 12.1 A nota

- **Base da fase:** 10 × acertos ÷ respostas certas possíveis. Por minijogo:

| Minijogo | Respostas possíveis | Acertos |
|---|---|---|
| Quiz, decisão, verdadeiro ou falso | 1 | a opção certa |
| Termo | 1 | acertar a palavra dentro das tentativas |
| Selecione | as opções certas | as certas marcadas, menos as erradas marcadas (senão marcar tudo daria 10) |
| Ligar | os pares | os pares certos |
| Pôr em ordem | as etapas | as etapas na posição certa |
| Caça-palavras | as palavras | as palavras achadas |
| Desembaralhe | as letras | as letras na casa certa |
| Memória | os pares | os pares formados, menos 1 por erro além do limite (1 por par) |

- **Multiplicador do tempo:** até 10 s, 1,0×; até 20 s, 0,9×; até 30 s, 0,8×; até 40 s, 0,7×; até 50 s, 0,6×; até 60 s, 0,5×; depois, 0,4×. Pontos da fase = base × multiplicador (duas casas).
- **Nota:** a soma dos pontos das fases × (total de fases × 10), arredondada. Fase sem resposta vale zero, mas conta no total. A nota máxima é 100 × fases² (ex.: 5 fases, 2.500).
- **"Fase certa"** (estrelas, gamificação e a conquista Nota máxima) é a que teve todos os acertos possíveis.
- As contas ficam em `shared/treinamento-servico/nota.ts`, usadas pela `api` (que calcula e grava) e pela web (que mostra).

### 12.2 O tempo de cada fase

- **Pelo relógio do servidor.** A tentativa guarda o cronômetro (`tempos`): os milissegundos de cada fase, a fase em que a pessoa está e o último evento. Ao entrar numa fase (`POST /treinamentos/tentativas/{id}/fases/{n}/entrar`), o cronômetro da anterior pausa e o desta continua de onde parou; ao responder, a fase para de contar.
- **Pular o aviso não zera o tempo:** se o jogo responder ou guardar progresso numa fase sem ter avisado a entrada, o tempo desde o último evento vai para ela.
- O cronômetro na tela (ao lado do tipo da fase, com o multiplicador de agora e a cor esquentando) é só para quem joga acompanhar; vale o do servidor.

### 12.3 Voltar, avançar e finalizar

- Em toda fase: **Voltar** (menos na primeira), **Avançar** (mesmo sem responder) e **Confirmar**; na última, Avançar vira **Finalizar**. Depois da correção, o painel tem Voltar e Continuar (ou Finalizar).
- **Finalizar com fase pendente** pede confirmação ("Faltam 2 fases sem confirmar. O que você já fez nelas conta; o resto vale zero.").
- **O progresso** de cada fase vai ao servidor um instante depois de a pessoa parar de mexer (`PUT .../fases/{n}/progresso`) e na troca de fase. Ao voltar a uma fase, ela aparece como estava (a seleção, as palavras achadas, as cartas formadas, as letras postas, os palpites).
- **Sem duplicidade:** a resposta de cada fase é uma linha só (a chave é a tentativa e a fase); concluir de novo devolve o mesmo resultado; a gamificação continua com um lançamento por treinamento.
- **Na trilha do topo,** a fase com parte dos acertos fica amarela, e a que tem resposta em andamento, clara.

### 12.4 O resultado e o ranking

- O anel mostra a nota (contando) sobre a nota máxima, com a conta embaixo; cada fase mostra os pontos, os acertos, o tempo e o multiplicador, e se foi corrigida sem confirmar. Ao jogar de novo: "Nova melhor nota!" ou "Sua melhor nota continua X".
- O ranking do treinamento mostra a nota de cada um (a barra é a nota ÷ a máxima); no empate, quem chegou primeiro.
- A capa, a passagem para o jogo e a capa do jogo explicam a nota ("acertar rápido vale mais").

### 12.5 Banco e código

- **Migração `0034_nota_do_treinamento`:** na tentativa, `tempos`, `progresso` e `nota`; na resposta, `acertos`, `possiveis`, `tempo_ms`, `pontos` e `confirmada`. Também troca o `check` das fases certas (era até 10; o jogo não tem mais limite de fases, seção 11).
- **Migração `0035_nota_das_tentativas_antigas`** (só dados): dá nota às tentativas de antes (fase certa = 10 pontos; o tempo não era registrado, então 1,0×) e repete a conversão da `0033`, que é idempotente: a `0033` foi gerada vazia e preenchida logo depois, e se o servidor de desenvolvimento a aplicou nesse intervalo, o banco dele ficou sem a conversão do antigo "Separar os itens".
- `api`: `treinamento-servico.ts` (correção com acertos, cronômetro, entrar, progresso, responder e concluir), `treinamento-servico-ranking.ts` (melhor nota) e as rotas novas em `treinamentos.ts`.
- `web`: `JanelaDoJogo.tsx` (navegação, fila das chamadas, progresso), `FaseDoJogo.tsx` (cronômetro, rodapé com Voltar e Avançar, cada minijogo começando da resposta guardada), `ResultadoDoJogo.tsx` e `RankingDoTreinamento.tsx`.
- Testes: um caso da nota (tempo por faixas, o cronômetro pausando e continuando entre visitas, acerto parcial ao finalizar, resposta travada, tempo cobrado sem o aviso de entrada, melhor nota anterior, gamificação só na primeira) e um da `0035`; os de antes ajustados (resposta travada e ranking pela melhor nota). `tsc` da `api` e da `web` e `eslint` da `web` limpos. A conferência visual ainda não foi feita.

## 13. Melhorias nos minijogos, confirmações, tempo do jogo e serviços em duas seções (20/10/2026)

Pedidos de ajuste depois de jogar a demonstração.

### 13.1 Minijogos

| Minijogo | O que mudou |
|---|---|
| Caça-palavras | As palavras ficam na linha (→), na coluna (↓) ou numa das diagonais (↘ e ↗), sempre lidas da esquerda para a direita (na coluna, de cima para baixo). Cada palavra cruza outra na mesma letra sempre que algum lugar permite (só palavra de outra direção, e nunca inteira por cima de outra) e vai, de preferência, na direção menos usada até ali, para a grade misturar linha, coluna e diagonal. A grade cresceu: 3 a mais que a maior palavra, entre 10 e 14 (era 2 a mais, entre 8 e 12). Marcar do fim para o começo continua valendo. |
| Selecione | Mais opções: de 3 a 16 escritas (era 12), de 1 a 10 certas (era 8); com os materiais do serviço, até 15 itens de outros serviços (era 10). A fase nova no editor já vem com 8 opções em branco (3 certas), o Selecione com materiais começa com 6 intrusos (eram 3), e a Vitória é pedida a montar de 8 a 14 opções (de 2 a 8 certas, ao menos 3 erradas) ou de 5 a 10 intrusos. Treinamentos já publicados não mudam até o admin editar. |
| Termo | A linha da vez tem uma casa escolhida (amarela): a letra digitada entra nela, e a escolha pula para a próxima casa vazia. Tocar numa casa (ou as setas ← e →) escolhe onde escrever, para montar a palavra fora de ordem; Backspace apaga a da casa escolhida (ou a anterior, se ela estiver vazia). Enviar com casa vazia sacode a linha e leva a escolha para a primeira vazia. |
| Verdadeiro ou falso | Escolhida uma carta, a outra fica em cinza (ainda dá para trocar até confirmar). |
| Desembaralhe | A letra já posta continua no monte, em cinza (antes quase sumia), para ver o que ainda falta usar. |

- **Sem migração:** a regra da linha reta (`celulasEntre`, em `shared/treinamento-servico/jogos.ts`) passou a aceitar as diagonais, o que só amplia: as grades gravadas nas tentativas abertas (só linha e coluna) continuam corrigindo igual.

### 13.2 Confirmações

Toda ação que avança sem concluir ou desfaz o que a pessoa já fez pede confirmação numa caixa por cima do jogo (a mesma de "Sair do treinamento?"; o foco começa em desistir e Esc fecha a caixa):

- **Avançar sem confirmar a fase** ("Avançar sem confirmar?"): explica que o progresso fica guardado e que dá para voltar; sem nada feito, que a fase vale zero se não voltar. Depois da correção, "Continuar" segue sem perguntar.
- **Recomeçar uma fase:** "Recomeçar" do Pôr em ordem e do Desembaralhe e "Desfazer tudo" do Ligar ("Recomeçar esta fase?"). "Desfazer a última" e "Apagar a última" não perguntam.
- **Recomeçar o jogo todo:** "Jogar de novo" e "Rever a explicação" no resultado (inclusive o Enter), que abrem uma partida nova.
- **Como antes:** finalizar com fase pendente e sair no meio.

### 13.3 Tempo do jogo todo e "Ver ranking" no resultado

- **O placar do topo ganhou o tempo do jogo todo,** de "Começar o jogo" até finalizar (para no resultado). É o relógio do navegador, só para quem joga acompanhar; a nota continua usando o tempo de cada fase, contado pelo servidor (seção 12.2). No celular estreito, o avatar do topo sai durante o jogo para caber o placar.
- **O resultado mostra o tempo total** embaixo da conta da nota e tem o botão **"Ver ranking"** no rodapé (só o ícone no celular), que rola até o ranking do treinamento e leva o foco para ele. No teste do admin, que não tem ranking, o botão não aparece.

### 13.4 Serviços em duas seções

- A aba Serviços do catálogo mostra **"Com treinamento"** (serviços com treinamento publicado, os que têm minijogos) e, depois, **"Outros serviços"**. Rascunho não conta.
- A `api` (`GET /catalogo/servicos`) passou a listar primeiro os serviços com treinamento publicado e depois os outros, cada grupo pelo código, para a paginação respeitar os grupos: a página que tem os dois mostra as duas seções. Sem nenhum treinamento publicado (ou no Campo de treino, cuja API fictícia não tem treinamentos), a lista aparece como antes, sem seções.

### 13.5 Campo de treino abrindo em localhost

- **Causa:** as rotas `/app/treino/entrar` e `/app/treino/sair` montavam o redirecionamento com `new URL("/app/lista", req.url)`. Atrás do proxy da hospedagem, o `req.url` de uma rota do servidor traz o endereço interno do Next (`http://localhost:3000`), e o navegador era mandado para lá.
- **Correção:** as duas rotas redirecionam com o caminho relativo (`Location: /app/lista?treino=...`, `web/src/lib/redirecionar.ts`), e o navegador fica no domínio em que está. O `proxy.ts` não tinha o problema: o Next já torna relativo o redirecionamento que ele devolve para o mesmo endereço.

### 13.6 Código e conferência

- `shared/treinamento-servico/jogos.ts` (`celulasEntre` com as diagonais); `api`: `treinamento-servico-jogos.ts` (`montarGrade`, `ladoDaGrade`), `treinamento-servico-esquema.ts` e `treinamento-servico-ia.ts` (limites e pedido do Selecione), `catalogo.ts` (ordem da lista); manuais da Vitória (técnico e admin).
- `web`: `jogo/confirmacao.tsx` (a caixa e o pedido de confirmação), `JanelaDoJogo.tsx` (confirmações, tempo do jogo), `FaseDoJogo.tsx` (Termo, verdadeiro ou falso, recomeçar), `ResultadoDoJogo.tsx` (tempo total e "Ver ranking"), `efeitos.tsx` (atalhos parados com a caixa aberta), `lib/treinamento-servico.ts` (limites e textos), `catalogo/(secao)/servicos/page.tsx` (as duas seções), `app/treino/entrar` e `sair` e `lib/redirecionar.ts`; estilos em `treinamento-minijogos.css`, `treinamento-jogo.css` e `management.css`.
- Testes: a grade com diagonais e cruzamentos (em 200 grades, alguma palavra na diagonal e cruzamento em mais de 150), as células na diagonal nos dois sentidos e a linha torta recusada, 5 palavras de 12 letras numa grade de 14, o limite novo de certas do Selecione e a ordem do catálogo (publicado primeiro; rascunho não conta). Os 56 testes de catálogo e treinamentos passam; `tsc` da `api` e da `web` e `eslint` da `web` limpos. A conferência visual ainda não foi feita, nem a do Campo de treino no domínio oficial (depende do deploy).

### 13.7 O rodapé do cartão do serviço

Pedido no mesmo dia, depois da seção 13.4:

```
[ Equipes do serviço ] [ Ver materiais ]
[           Jogar treinamento          ]
```

- **"Ver materiais" sempre aparece**, no lugar onde ficava "Sugerir lista", e não muda de lugar ao abrir: os dois botões de cima ficam em duas colunas fixas, o texto continua "Ver materiais" (só a seta vira; "Ocultar materiais", mais largo, empurrava o botão para outra linha) e o painel aparece entre as duas linhas, em cima do botão do treinamento. Ele traz a lista (ou "Nenhum material na lista deste serviço ainda.") e, embaixo, **"Sugerir lista" e "Contestar lista"** (esta só com materiais; nenhum dos dois para o admin nem no Campo de treino).
- **"Jogar treinamento"** ocupa a linha de baixo inteira (só com treinamento publicado). Para o admin, no mesmo lugar, "Abrir treinamento" ou "Criar treinamento".
- **"Ver ranking"** saiu do rodapé e foi para o cartãozinho da Vitória, à direita, que só aparece com treinamento publicado.
- No Campo de treino, sem "Equipes do serviço", "Ver materiais" ocupa a primeira linha sozinho.
- Código: `CartaoServico.tsx`, `TreinamentoNoCartao.tsx` (a ação à direita) e `management.css` (`cartao-servico-treinar`, `cartao-servico-colaborar`). `tsc` e `eslint` da `web` limpos; a conferência visual ainda não foi feita.

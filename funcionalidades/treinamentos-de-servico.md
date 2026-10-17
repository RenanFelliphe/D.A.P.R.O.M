# Treinamentos de serviço — implementação de 16/10/2026 (Fase 1, sem IA)

> O jogo por serviço do catálogo (seção 3 do [vitoria.md](vitoria.md)): o admin cria manualmente uma explicação em passos (narrada pela Vitória) e um jogo de 3 a 10 fases, publica com termo e assinatura, e o técnico (inclusive quem aguarda liberação) joga e pontua. Esta rodada é 100% sem IA: nenhuma rota, coluna ou botão de geração por IA entra agora — é a Fase 1 do plano de implementação da Vitória, que funciona sozinha (seção 8 do vitoria.md).
>
> **Situação:** implementado na `api` e na `web` em 16/10/2026. A Fase 2 (módulo de IA) e a Fase 3 (Vitória assistente) não entraram nesta rodada; o rascunho por IA dos treinamentos (seção 3.6 do vitoria.md) depende delas.
>
> Fontes: [vitoria.md](vitoria.md) (seção 3) e [gameficacao.md](gameficacao.md) (seção 13), já decididos; o código em `api/src/db/schema/treinamento-servico.ts`, `api/src/dominio/treinamento-servico*.ts`, `api/src/rotas/treinamentos.ts` e `web/src/components/web/treinamento-servico/`.

## Resumo

- **Nomenclatura:** tudo usa o prefixo/sufixo `treinamento_servico` / `treinamento-servico` (tabelas, arquivos, rotas), nunca `treinamento` sozinho, para não colidir com o Campo de treino (tutorial fictício, outra funcionalidade, intocado).
- **Um treinamento por serviço do catálogo** (a `atividade`), versionado como o modelo de APR: rascunho → publicada → substituída. Editar sempre cria um rascunho novo; a versão publicada não muda.
- **Parte 1 (explicação):** até 12 passos, cada um com texto, a expressão da Vitória (reaproveita o avatar provisório de `vitoria/`) e uma imagem opcional.
- **Parte 2 (jogo):** 3 a 10 fases para publicar (0 a 10 em rascunho), dos 5 tipos da especificação — quiz, decisão, separar os itens, ligar, pôr em ordem —, todas por toque (sem arrastar). O gabarito nunca chega ao cliente antes da resposta; o embaralhamento é gerado uma vez por tentativa e guardado (`apresentacao`), sem revelar a resposta certa.
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
- Jogador em `/app/catalogo/servicos/{codigo}/treinar` (`JogoTreinamentoServico.tsx`, o motor comum entre jogo de verdade e pré-visualização): abertura, Parte 1 com `AvatarVitoria.tsx` (resolve sempre por `expressoes.json`, nunca pelo nome do arquivo), Parte 2 com `FaseJogavel.tsx` (os 5 tipos, tudo por toque) e o resultado (`PontosGanhos`, já existente na gamificação).
- Bloco "Treinamentos de serviço" na tela de "Aguardando liberação" (`TreinamentosDeServicoAguardando.tsx`), ao lado do Campo de treino.
- O avatar provisório foi copiado de `vitoria/` para `web/public/vitoria/` (SVGs + `expressoes.json`).
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

- **Rascunho por IA, conferências automáticas e ajustes por chat** (seção 3.6 do vitoria.md): esperam o módulo de IA genérico (Fase 2) e a licença da Anthropic.
- **Imagem do cenário gerada por IA:** fora de escopo (o admin envia a imagem).
- **Procedimento em PDF:** fora de escopo; o admin edita direto no editor.
- **Questão 38** (validade da assinatura desenhada para auditoria): vale para a publicação do treinamento do mesmo jeito que já vale para a APR.

# Sugestão e contestação de materiais — plano de 19/10/2026

> Qualquer funcionário que não seja administrador pode **sugerir uma lista de materiais** para um serviço (corrigindo a atual ou propondo uma do zero) e **contestar a lista recomendada**. Quem valida é o supervisor da equipe que mais faz o serviço. Aceita, a lista passa a ser a do serviço e todas as equipes que o fazem são avisadas.
>
> **Situação:** implementado em 19/10/2026 na `api` (com testes), na `web` e no app (`tsc`, `eslint` e testes passam; **falta ver as telas no navegador e no aparelho**). Veja a seção 14.
>
> Fontes: a conversa de 19/10/2026 e [materiais-recomendados.md](materiais-recomendados.md), que define a lista como recomendação, só para consulta.

## 1. Resumo

- **Hoje** só o admin monta a lista de cada serviço (Catálogo › Serviços). Quem faz o serviço no campo sabe o que falta ou sobra, mas não tem como dizer.
- **Sugestão:** a pessoa, no detalhe da OS ou no catálogo, monta uma lista (a partir da atual, ou do zero) e a envia. Motivo opcional.
- **Contestação:** a pessoa diz que a lista recomendada está errada. O **motivo é obrigatório**; a lista nova é **opcional**.
- **Quem avalia:** o supervisor da equipe que **mais faz o serviço**. No empate, a equipe com **mais pontos**. O admin também pode avaliar qualquer uma.
- **Se aceita:** a lista entra no serviço (`atividade_material`) e aparece em "Materiais recomendados" onde o serviço aparecer. **Todos os membros das equipes que fazem o serviço recebem um aviso.**
- **Pontos:** o autor ganha **30** quando a sugestão (ou a contestação) é aceita; o avaliador ganha **3** por avaliar, aceitando ou recusando.
- **A equipe responsável vira "quase dona" do serviço:** o catálogo mostra as equipes que o fazem, com a responsável em destaque, e é ela quem recebe as sugestões e as contestações.

## 2. Por que

- **A lista só vale se for boa.** O técnico é quem vê no campo o que o serviço pede de verdade; o admin está longe disso.
- **O supervisor conhece o serviço.** Tirar o admin da avaliação evita a fila e põe a decisão em quem responde pelo trabalho.
- **Colaborar rende pontos**, mas só quando a contribuição vale (aceita). Pontuar o envio premiaria enviar muito, não enviar bem.
- **Contestar é diferente de sugerir.** Quem contesta pode não saber a lista certa; obrigar a lista travaria a crítica. O motivo, porém, é obrigatório: sem ele o supervisor não tem o que avaliar.

## 3. Quem faz o quê

| Quem | Envia | Avalia | Retira |
|---|---|---|---|
| Técnico (qualquer equipe) | sim | só se for supervisor da equipe responsável | a própria, enquanto pendente |
| Supervisor (ou representante no comando) | sim | as da equipe responsável que ele supervisiona, **menos as próprias** | a própria |
| Administrador | **não** (edita a lista direto no catálogo) | todas | — |

- O supervisor ausente é substituído pelo representante (mesma regra do resto do sistema: `equipesSupervisionadas`).
- **Quem não pode avaliar a própria:** se o autor é o supervisor da equipe responsável, o aviso vai para os administradores (e só eles avaliam).
- **Uma pendente por pessoa e serviço.** Para enviar outra, a pessoa retira a anterior ou espera a avaliação.

## 4. Equipe responsável

- **Quem faz o serviço:** as equipes com OS dele (`os.codigo_atividade`), sem contar as canceladas e as devolvidas ao SAP.
- **A responsável:** a de **mais OS**; no empate, a de **mais pontos gerais** (a soma de tudo o que a equipe já recebeu, `lancamento_equipe`); se ainda empatar, a ordem alfabética (para a escolha não variar).
- **Serviço sem nenhuma OS:** nenhuma equipe responde; o admin avalia.
- **A equipe é gravada no envio** (`sugestao_materiais.equipe_responsavel_id`). Se o ranking mudar depois, a sugestão continua com quem a recebeu.
- **Onde aparece:** o cartão do serviço no catálogo ganha "Equipes do serviço" (a lista ordenada, a responsável marcada com o supervisor dela), e a tela de sugerir diz para quem a sugestão vai.

## 5. Sugestão

- **Ponto de partida:** a lista atual do serviço (editável) ou uma lista vazia. A pessoa adiciona, remove e muda quantidades.
- **Itens do catálogo, ou "Não achei":** a pessoa escolhe um material do catálogo ou digita o item (descrição, unidade, categoria). O item digitado que for **igual a um material do catálogo** (mesma descrição e unidade, sem diferenciar maiúsculas) já vira o material. Os demais ficam como digitados até o supervisor ligá-los a um material existente ou cadastrá-los, ao aceitar. Assim o catálogo não se enche de "Chave inglesa", "chave inglesa 12" e "Chave Inglesa".
- **Lista igual à atual:** recusada (`sem_mudanca`).
- **Motivo:** opcional ("por que mudar").
- **A tela de avaliação mostra a diferença:** `+` adicionado, `−` removido, `~` quantidade ou observação alterada, mais os que ficam iguais. O cálculo é um só (`shared/api/sugestao-materiais.ts`, `diferencaDeListas`), usado pela `api`, pela web e pelo app.

## 6. Contestação

- **Motivo obrigatório** (mínimo de 10 caracteres). **Lista opcional.**
- **Recebe quem recebe a sugestão:** a equipe que mais faz o serviço.
- **Aceitar uma contestação com lista:** aplica a lista, como numa sugestão. **Sem lista:** o avaliador precisa informar a lista que passa a valer (`lista_obrigatoria`); se concorda mas não sabe a lista, o caminho é falar com a pessoa ou recusar com o motivo.

## 7. Avaliação

- **Aceitar:** a lista da proposta passa a ser a do serviço. O avaliador pode **ajustar antes** (mudar itens, quantidades, ligar os itens digitados); a sugestão ajustada conta como **aceita** e fica marcada "com ajustes".
- **Recusar:** o **motivo é obrigatório** (mínimo de 10 caracteres) e chega ao autor.
- **A lista pode ter mudado desde o envio** (o admin editou, ou outra sugestão foi aceita): a tela diz "a lista mudou desde o envio" e mostra a lista base e a de agora. A diferença é sempre calculada sobre a lista **de agora**.
- **Várias pendentes para o mesmo serviço** são permitidas (de pessoas diferentes); aceitar uma deixa as outras desatualizadas, e o avaliador decide sobre cada uma.
- **Aceitar é atômico:** a lista, a marca da sugestão, os pontos e os avisos entram numa transação só. Duas pessoas aceitando ao mesmo tempo: só uma vence (`sugestao_ja_avaliada`).
- **Auditoria:** `sugestao_materiais.aceitar`, `sugestao_materiais.recusar` e, quando a lista muda, `atividade.materiais` (com a lista de antes e a de depois).

## 8. Avisos

| Aviso | Quem recebe | E-mail |
|---|---|---|
| `sugestao_materiais_nova` | quem avalia (supervisor ou representante da equipe responsável; sem ninguém, os administradores) | sim, categoria **Equipe** |
| `contestacao_materiais_nova` | o mesmo | sim, categoria **Equipe** |
| `sugestao_materiais_aceita` | o autor, com os pontos que ganhou e a resposta | sim, categoria **Equipe** |
| `sugestao_materiais_recusada` | o autor, com o motivo | sim, categoria **Equipe** |
| `materiais_atualizados` | **todos os membros e supervisores das equipes que fazem o serviço**, menos quem mudou a lista e o autor | **só no sino** (avisa muita gente) |

- **O `materiais_atualizados` sai de qualquer mudança da lista:** sugestão aceita **ou** edição do admin no catálogo. Salvar a mesma lista não avisa ninguém. O texto traz o resumo da mudança ("+ Detector; − Fita; ~ Luva (2 par → 3 par)").
- **Novas colunas em `alerta`:** `sugestao_materiais_id` (alvo `sugestao`) e `atividade_codigo` (alvo `servico`). O `CHECK` `alerta_alvo` exige exatamente as colunas do alvo, como nos demais avisos.
- **Para onde o aviso leva:** a sugestão (`/app/catalogo/servicos/{codigo}/materiais/sugestoes/{id}`) ou o serviço no catálogo (`/app/catalogo?busca={codigo}`). No app, `/materiais/{id}`.

## 9. API

Tudo em `/sugestoes-materiais` ([`rotas/sugestoes-materiais.ts`](../../api/src/rotas/sugestoes-materiais.ts)); tipos em [`shared/api/sugestao-materiais.ts`](../../shared/api/sugestao-materiais.ts). Chaves em snake_case.

| Rota | O que faz |
|---|---|
| `GET /sugestoes-materiais/equipes?atividade=` | As equipes que fazem o serviço (`equipe_id`, `nome`, `os_total`, `pontos`, `supervisor_nome`, `responsavel`), da que mais faz para a que menos faz. Todo perfil lê. |
| `GET /sugestoes-materiais/resumo` | `{para_avaliar}`: o número do selo de quem avalia. |
| `GET /sugestoes-materiais?escopo=&atividade=&estado=&pagina=&tamanho=` | `escopo=minhas` (as que a pessoa enviou), `avaliar` (as pendentes que ela pode avaliar; o admin vê todas) ou `servico` (o histórico de um serviço, pede `atividade`). Cada linha traz `posso_avaliar` e `posso_retirar`. |
| `POST /sugestoes-materiais` | `{atividade, tipo: "sugestao"\|"contestacao", motivo?, lista?: [{material_id? \| descricao+unidade+categoria?, quantidade?, observacao?}]}`. Devolve a sugestão. |
| `GET /sugestoes-materiais/{id}` | A sugestão inteira: `itens`, `lista_base`, `lista_atual`, `desatualizada`, `resposta`, `ajustada`. |
| `POST /sugestoes-materiais/{id}/aceitar` | `{resolucoes?: [{ordem, material_id? \| criar_material}], lista?, resposta?}`. `resolucoes` liga cada item digitado; `lista` troca a proposta (ajuste) ou dá a lista de uma contestação sem lista. Devolve a sugestão, `lista_mudou` e os pontos do avaliador (`pontos_ganhos`, `ganhos`). |
| `POST /sugestoes-materiais/{id}/recusar` | `{resposta}` (obrigatória). |
| `POST /sugestoes-materiais/{id}/retirar` | O autor retira a pendente. |

**Erros que a tela trata (422/409):** `motivo_obrigatorio`, `lista_obrigatoria`, `sem_mudanca`, `material_repetido`, `material_inexistente`, `material_inativo`, `item_invalido`, `item_sem_material`, `resposta_obrigatoria`, `sugestao_pendente`, `sugestao_ja_avaliada`; e `material_em_sugestao` na exclusão de material do catálogo.

## 10. Web

Tudo em `/app/catalogo`, o mesmo para todos os perfis (a seção Catálogo de serviço já é de todos).

- **Cartão do serviço** (Catálogo › Serviços): botões "Sugerir lista" e "Contestar lista" (não aparecem para o admin), "Equipes do serviço" (janela com a lista e a responsável em destaque) e o selo da equipe responsável.
- **Detalhe da OS:** o cartão "Materiais recomendados" ganha "Sugerir lista" e "Contestar".
- **Sugerir lista** (`/app/catalogo/servicos/{codigo}/materiais/sugerir?tipo=`): em etapas (a lista; o motivo; a revisão com a diferença) e diz para qual equipe a sugestão vai.
- **Avaliar** (`/app/catalogo/servicos/{codigo}/materiais/sugestoes/{id}`): o autor, o motivo, a diferença, a lista base e a de agora; "Aceitar", "Ajustar e aceitar" (editor da lista) e "Recusar" (motivo). O autor vê o estado e pode retirar.
- **Aba "Sugestões"** (`/app/catalogo/sugestoes`): "Minhas" e, para quem avalia, "Para avaliar", com o selo do número.
- **Alertas:** o sino e a tela de alertas levam à sugestão.

## 11. App (Android)

- **Detalhe da OS:** "Sugerir lista" e "Contestar" no cartão de materiais (só com sinal; a sugestão **não** entra na fila offline: é uma ação de colaboração, sem urgência).
- **Telas:** `/materiais` (Minhas e Para avaliar), `/materiais/nova` (enviar) e `/materiais/{id}` (detalhe e avaliação).
- **Perfil:** uma linha "Sugestões de materiais" com o selo.
- **Avisos:** o aviso leva à sugestão.

## 12. Pontos e carga inicial

| Tarefa | Quem | Pontos | Limite |
|---|---|---|---|
| `sugestao_materiais_aceita` — "Sugestão de materiais aceita" | o autor, quando o supervisor aceita (com ou sem ajuste) | **30** | uma por pessoa e serviço a cada 30 dias (as aceitas dentro do prazo atualizam a lista, mas só a primeira pontua) |
| `sugestao_materiais_avaliada` — "Sugestão de materiais avaliada" | o avaliador, ao aceitar ou recusar | **3** | uma por sugestão |

- **30 é mais que uma OS média** (cerca de 29): é o que "pontuar bastante" pede. O admin ajusta o valor no cadastro das regras.
- **Enviar não pontua.** Entrou na lista "O que não pontua" ([gameficacao.md](gameficacao.md), seção 2.2).
- **O limite de 30 dias** impede fatiar uma mudança em cinco sugestões. A chave do lançamento é `sugestao_materiais:{codigo}:{id}`, e a conferência olha o extrato da pessoa.
- **Quem recusa também ganha:** o ponto é por responder, para a fila do supervisor não parar.
- **Admin não pontua** (regra geral): se um administrador avalia, nada é lançado.
- **Migração `0039_sugestao_de_materiais`:** tabelas `sugestao_materiais` e `sugestao_materiais_item`, colunas novas em `alerta`, `CHECK` de `alerta`, `auditoria` e `regra_pontuacao` refeitos, e a carga das duas tarefas.

## 13. O que ficou de fora

- **Conquista de colaboração** (por exemplo, "5 sugestões aceitas"): pede um critério novo e a imagem do troféu. Fica para depois; as regras acima já dão os pontos.
- **Sugestão offline:** não entra na fila do app. Sem sinal, o botão avisa.
- **Reatribuir uma sugestão a outra equipe** quando o ranking muda: a sugestão fica com a equipe de quando foi enviada; o admin avalia qualquer uma.
- **Comentários e conversa** entre o autor e o supervisor: a resposta da avaliação cobre o essencial.
- **E-mail do `materiais_atualizados`:** só no sino; avisa muita gente.

## 14. O que foi feito

- **Banco e `api`:** migração `0039`, domínio [`sugestao-materiais.ts`](../../api/src/dominio/sugestao-materiais.ts), rotas, os 5 avisos novos, as 2 regras de pontuação e o aviso de lista atualizada também na edição do admin. Testes em [`sugestao-materiais.test.ts`](../../api/test/sugestao-materiais.test.ts) (23 casos).
- **Web:** a aba Sugestões, o assistente em etapas, a tela de avaliação, as equipes do serviço (janela) e os botões no cartão do serviço e no detalhe da OS. Fora do Campo de treino. Estilos em `web/src/styles/sugestao-materiais.css`.
- **App:** telas `/materiais`, `/materiais/nova` e `/materiais/{id}` (pasta `mobile/src/materiais/`), botões no cartão de materiais do detalhe da OS e linha com selo no perfil. Só online. 23 testes de lógica pura em `mobile/test/sugestao-materiais.test.ts`; `typecheck`, `lint` e os 268 testes do app passam.
- **Testes:** `api` 24 casos novos (equipes, envio, avaliação, pontos, avisos, e-mail); a suíte inteira da `api` passa.

## 15. Pontos em aberto

- **Item "cadastrar como novo" tirado no ajuste:** se quem avalia marca "Cadastrar como novo" num item digitado e depois o tira no "Ajustar e aceitar", a `api` ainda cria o material (as `resolucoes` valem antes da `lista`). É raro; o material fica no catálogo, sem uso, e o admin pode excluí-lo.
- **Ver numa tela real:** o layout dos botões e janelas, o teclado nos campos longos e o botão voltar do Android no assistente do app; e um serviço com `/` no código (como `8.7.2/8.7.3`) na rota `/materiais/nova`.
- **A equipe responsável conta todas as OS do serviço, de qualquer data.** Se a operação preferir só o último ano, é uma condição a mais em `equipesDoServico`.
- **Valores:** 30 e 3 são sugestões; o admin pode mudá-los sem código.

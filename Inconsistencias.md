# Inconsistências encontradas

> Resultado da varredura de 11/10/2026, que comparou o código (`web` e `api`), o banco, `base/` (OS e APR de exemplo), a especificação e os demais documentos. Nada abaixo foi corrigido: a lista serve para validar item a item e decidir o que entra.
>
> **Como a varredura foi feita:** o banco foi comparado com a especificação por script (colunas, tipos, nulidade, chaves e valores permitidos); o código `web` e os documentos foram auditados por leitura, em duas passadas independentes. Os itens marcados com ✔ foram conferidos de novo à mão depois da auditoria; os demais vêm só da auditoria e ainda precisam de conferência.
>
> **Status de todos os itens:** a validar.

## Resumo

| Área | Resultado |
|---|---|
| Banco × especificação | Coerentes. As 157 colunas das tabelas da especificação batem com o banco (tipo, nulidade e chave estrangeira), e os valores permitidos também. Lacunas só na especificação (seção 1). |
| Documentos | 3 links quebrados, 2 documentos com a stack antiga, 2 contradições entre questões e vários textos desatualizados (seção 2). |
| Código `web` | Ainda reflete o protótipo antigo, e não as decisões recentes. Há 1 bug real, independente das decisões (seção 3). |
| Builds e testes | `eslint`, `tsc` e `next build` do `web` passam; `tsc`, `drizzle-kit check` e `db:test` da `api` passam. |

**Gravidade:** **alta** contradiz uma decisão ou é um erro de funcionamento; **média** deixa o leitor ou o usuário com informação errada; **baixa** é acabamento.

---

## 1. Especificação (`base/.design/especificacao.md`)

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| E1 | Alta | linha 312 ✔ | `POST /modelos-apr/{codigo}/versoes` recebe `itens: [{secao, grupo, …}]`, mas `grupo` não existe mais em `item_modelo_apr`, e o corpo não tem lista de riscos. | `{titulo, pae?, riscos: [{classificacao, nome, ordem}], itens: [{secao, risco_ordem?, ordem, texto, …}]}`. |
| E2 | Média | contrato `GET /ordens` (linha ~206) | Não traz `plano_manutencao`, `item_manutencao`, `data_ordem` nem `criado_por_sap`, que o texto e as tabelas dizem vir do SAP. O contrato usa `criado_por` e `criada_em`, e a coluna se chama `criado_por_sap`. | Acrescentar os campos ao contrato e alinhar os nomes. |
| E3 | Média | linhas ~219, ~220, ~440 e diagrama ~455 | Não dizem o que acontece com uma OS já `encerrada` no sistema quando o SAP dá a baixa. O texto "cancelada ou encerrada no SAP vira `cancelada`" sugere que a baixa normal cancelaria a OS. O diagrama só tem `encerrada --> [*]`. | Dizer que `encerrada` nunca muda; `cancelada` só para ordem cancelada no SAP. |
| E4 | Média | linhas 141–142 ✔ | `POST` e `PATCH /usuarios` não aceitam `cargo` nem `registro_profissional`, que existem na tabela e saem sob a assinatura no PDF. | Incluir nos dois payloads (e em `GET /me`, se couber). |
| E5 | Média | linha 81 | Diz que a `api` aplica as migrações "sob trava de sessão". O README do banco diz que ainda é preciso confirmar se o migrador do Drizzle trava. | Marcar "a confirmar" em um dos dois. |
| E6 | Média | seção "Protótipo" | Incompleta. Faltam as diferenças do `web`: não há etapa de marcar riscos; a entrada e a lista tratam o offline como cenário principal; "Offline/Sincronizado" na barra superior. Também diz que "Ninguém trabalha sozinho" está "na tela de nova APR", mas está na dica do item 3 do checklist. | Completar a lista (ver seção 3). |
| E7 | Baixa | descrição do PDF, página 1 | Diz "todos os itens com a resposta". Não diz que as medidas dos riscos não marcados saem em branco nem que a marcação "( )" é reproduzida. | Acrescentar a regra. |
| E8 | Baixa | linhas ~229, ~638–644 e tabela de perfis | Resolvida em parte pela nova estrutura de perfis (12/10/2026): o analista deixou de existir e os textos passam a citar "supervisor da equipe ou admin". A tabela ainda não cobre "marcar local como crítico" nem "marcar alerta como lido". | Incluir as duas ações na tabela de perfis. |
| E9 | Baixa | diagrama ER da APR | Liga `evidencia` a `apr`; no banco a ligação é com `apr_resposta` (chave composta `apr_id` + `item_id`). | Alinhar ao `api/db/README.md`. |
| E10 | Baixa | "Fontes" | Lista só `Exemplos_de_OS1.pdf`; a OS 4019821, usada no texto, está em `Exemplos_de_OS2.pdf`. | Listar também o `Exemplos_de_OS2.pdf`. |
| E11 | Média | linha ~302 | Apresenta `VERSÃO 04 DATA: 24/07/2026` como o valor que "o próprio documento traz". Nas planilhas só as APR 01, 02, 03 e 07 são v4 de 24/07; APR 04, 05 e 06 são v3 (07/07 e 01/07/2026); APR 09 é v2. Os nomes dos arquivos dizem "REV 03", e a APR 09 diz "REV 01", o que não bate com a versão interna. | Dizer "por exemplo, a APR 03" e registrar a diferença entre nome e conteúdo. |
| E12 | Alta | linha 348 ✔ | "APR 04 tem coluna NA". Nas planilhas, a coluna existe nas APR 04 e 05, em nenhuma outra. | "APR 04 e 05". Corrigido na especificação com a carga inicial. |
| E13 | Baixa | suposições 3 e 4 | A suposição 4 cita as questões 3 e 52, mas não a 58, que a ajusta. A suposição 3 ("NA") não cita a 61 (APR 06). | Citar 58 e 61. |
| E14 | Baixa | seção "Protótipo" | Diz "versões v3 e v4". O `web` mostra v3 (APR 01, 02, 07), v4 (APR 03) e v1 (APR 09). Em papel: v4 para 01, 02, 03 e 07, e v2 para a 09. | "v1, v3 e v4 em vez de v2 e v4". |
| E15 | Média | Situação (linha 8), README e `pontos-a-validar` | Dizem que só o `web` tem código ou que a `api` não existe. A `api` já tem o schema, 21 tabelas e 2 migrações. | "Hoje `web` (telas simuladas) e `api` (só o banco) têm código." |
| E16 | Baixa | cabeçalhos de data | "Revisado em 10/10/2026" na especificação e "Atualizado em 10/10/2026" no `pontos-a-validar` não refletem as mudanças de 11/10 (questões 55 a 62, schema novo). | Atualizar as datas. |
| E17 | Média | `especificacao.md`, Modelo de APR, linha ~303 (carga das atividades) | Fala só do campo "Plano de manutenção e operação (SAP)" das APR 02 e 03. O campo também traz códigos nas APR 01 e 06, e a APR 07 tem um texto ali. As faixas (`8.7.2/ 8.7.3/ 8.7.4/ 8.7.7/ 8.7.8`) são vários códigos num item só. A APR 06 repete 27 códigos das APR 01, 02 e 03, e o código é a chave da atividade. | Corrigido na especificação com a carga inicial (listas de 01, 02, 03, 06 e 07; faixa vira um código por linha; o repetido fica com o primeiro modelo). Falta decidir, na questão 3, se a APR 06 deve se somar à APR 03 nessas atividades. |
| E18 | Baixa | APR 07 e APR 09 (planilhas) | Trazem o bloco "Instruções importantes para a atividade" (APR 07: 3 regras, como "Não usar o celular enquanto dirigir, regra de ouro Nº 02"; APR 09: só o título). Nem o schema nem a especificação têm onde guardá-lo, e o PDF da APR não o reproduz. | Decidir se vira campo do modelo (`modelo_apr.instrucoes`) e sai no app e no PDF, ou se fica de fora. |
| E19 | Baixa | PAE das 8 planilhas | O PAE não é igual em todos os arquivos: na APR 04 "São Mateus" e o telefone dele ficam em células deslocadas; a APR 06 diz "Coordenação SMS" e "Lider e apoio as Vítimas" onde as outras dizem "Gerência SS" e "Líderes de apoio as Vítimas"; as APR 04 e 05 trocam a ordem de Polyanna e Kamilla. O banco guarda o PAE de cada modelo como a planilha traz (`modelo_apr.pae`). | Confirmar com o Mario qual é o PAE vigente e se ele deve ser único para todos os modelos (uma tabela própria em vez de um bloco por modelo). |
| E20 | Baixa | textos das planilhas | Há erros de digitação que a carga leva sem corrigir ("veiculo", "suciente", "trevessias", "construçãode", "Veícular"/"Veicular", "ferramentasmanuais"), para o texto ficar igual ao papel. | O admin corrige no editor, a pedido da Segurança do Trabalho, o que cria a versão seguinte de cada modelo. |

## 2. Documentos

### Links e referências quebradas

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| D1 | Alta | `especificacao.md` (Fontes), `pontos-a-validar.md` linha 5 e `correcoes-reuniao-2-resumo.md` linha 3 ✔ | Apontam para `Transcrição_Reuniao2.docx`. O arquivo real é `base/reunioes/Transcricao_Reuniao2.md` (sem acento, extensão `.md`). | Trocar para `../reunioes/Transcricao_Reuniao2.md` (no resumo, só `Transcricao_Reuniao2.md`). |
| D2 | Alta | `correcoes-reuniao-2-resumo.md` linha 3 | O link `[especificação](especificacao.md)` aponta para `base/reunioes/especificacao.md`, que não existe. | `../.design/especificacao.md`. |
| D3 | Alta | `pontos-a-validar.md` linha 5 | O link para `correcoes-reuniao-2-resumo.md` resolve para `base/.design/`, mas o arquivo está em `base/reunioes/`. | `../reunioes/correcoes-reuniao-2-resumo.md`. |
| D4 | Baixa | `contexto-sessao-2026-10-10.md` | Aponta para arquivos que não existem mais: `apr-om-digital.md`, `apr-om-digital-resumo.md`, `fluxo-solucao.md`, `../../src/index.html`, `styles.css`, `app.js`, `Desafio.md` e os SVG de fluxograma. | Faixa de "registro histórico" no topo. |
| D5 | Baixa | `contexto-sessao-2026-10-10.md` | Sem aviso de que está superado: fala em "nenhuma linha de código", Expo/Vite/Edge Functions, offline-first, "uma APR cobre várias OS", `apr_os` e `encarregado`. | A mesma faixa de aviso: "vale a `especificacao.md`". |

### Stack e decisões antigas

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| D6 | Alta | `DesignDoc.md` linha 78 ✔ e `correcoes-reuniao-2-resumo.md` linha 28 | "Web em .NET 10 … mono repo separado em /backend, /frontend e /mobile". Contradiz a decisão atual (`api`, `web` em Next.js e `mobile`). | No DesignDoc, trocar a stack. Na ata, manter o texto e acrescentar "superado em 10/10: ver `pontos-a-validar.md`". |
| D7 | Média | `correcoes-reuniao-2-resumo.md` linha 3 | Diz que tudo "já está aplicado na especificação, no DesignDoc e no protótipo em `src/`". O DesignDoc ainda tem a stack antiga, e `src/` foi removido (o protótipo agora está em `web/`). | Tirar o DesignDoc da frase e trocar `src/` por `web/`. |
| D8 | Média | `correcoes-reuniao-2-resumo.md` linha 11 | "O modelo sai do código do plano de manutenção da OS". Pela questão 58, o código é opcional, e o técnico escolhe o modelo quando não há mapeamento. | Ajustar a frase. |
| D9 | Baixa | `DesignDoc.md` linhas 63–64 | Lista "sincronização automática e manual dos dados offline" e "token temporário para login offline" como funcionalidades essenciais. Pela decisão atual, o offline é contingência. A especificação usa hash salgado da senha e janela de 7 dias, não "token". | Reclassificar como recurso adicional. |
| D10 | Baixa | `DesignDoc.md` linhas 36 e 40–41 | Separa "Painel Pessoal" e "Painel de gestão (web)" sem dizer que web e app atendem todos os perfis. | Acrescentar a regra. |
| D11 | Baixa | `especificacao.md` e `pontos-a-validar.md` | Usam "back-end" genérico onde `api` seria mais consistente. | Opcional. |

### Questões (`pontos-a-validar.md` e `Questoes.md`)

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| D12 | Alta | `pontos-a-validar.md`, questão 52 ✔ | A recomendação diz que a OS com atividade sem modelo "não é levada ao aplicativo e aparece como ignorada". Contradiz a questão 58, a especificação e a suposição "52 e 58": a OS entra sempre. A 52 também continua marcada "(nova)" sem apontar a 58. | Reescrever a recomendação e acrescentar "ajustada pela 58". |
| D13 | Alta | `pontos-a-validar.md`, questão 9 (linha ~123) ✔ | "Só a APR 04 tem a coluna NA". Veja E12. | "APR 04 e 05". |
| D14 | Média | `pontos-a-validar.md`, seção 1 e "Situação em números" | A tabela-resumo não lista as questões 55 a 62. "Todas as demais (seção 1)" as omite. | Acrescentar as linhas 55–62, com impacto e quem decide. |
| D15 | Média | `pontos-a-validar.md`, seção 3 (impacto 🟡) | As questões 55 a 62 estão todas sob "impacto na demo (🟡)", mas a 58 e a 59 são 🔴, e a 60 e a 62 são 🟢. As questões 55 e 56 não têm impacto nem "quem decide". | Mover para as seções certas ou renomear a seção 3. |
| D16 | Média | `pontos-a-validar.md` | "As 47–54 são novas": hoje as novas vão até 62. | "47–62". |
| D17 | Baixa | `pontos-a-validar.md`, questão 18 | "O app invalida a senha antiga no próximo sync". A especificação diz "no próximo login online". | Alinhar. |
| D18 | Baixa | `pontos-a-validar.md`, questão 55 | Recomenda a lista de alertas de supervisor e admin no app (o analista deixou de existir); a suposição 55 da especificação só fala das telas de campo. | Alinhar. |
| D19 | Baixa | `pontos-a-validar.md`, questão 62 | O título fala de "horário e assinatura por executante", mas o conteúdo só trata de horário. O `Questoes.md` traz também a pergunta sobre homem-hora. | Alinhar título e pergunta. |
| D20 | Baixa | `Questoes.md` × `pontos-a-validar.md`, questões 59 e 60 | O `Questoes.md` tem perguntas extras ("Marcar nenhum risco é permitido?", "Há um limite de participantes?") que o `pontos-a-validar.md` não tem. | Copiar para o `pontos-a-validar.md`. |

### READMEs

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| D21 | Média | `README.md` linha 98 | "`api/ # Backend (ainda não iniciado)`". | "Banco (schema e migrações) pronto; rotas ainda não." |
| D22 | Média | `web/README.md` linhas 10–14 ✔ | Manda usar `npm install` e `npm run dev`; o `web` usa `pnpm` (há `pnpm-lock.yaml`), e o README da raiz usa `pnpm`. | Usar `pnpm` nos dois. |
| D23 | Média | `README.md` linha 5 | "Experiência móvel para equipes operacionais com um painel web para gestão" sugere app para o campo e web para a gestão. | "App e web atendem todos os perfis; o perfil define o que cada um faz." |
| D24 | Baixa | `README.md` linha 18 e "Regras de negócio centrais" | Dizem que o modelo "é selecionado a partir do tipo/código da atividade", sem citar a escolha manual (questão 58), e não citam a regra de marcar riscos. | Acrescentar as duas regras. |
| D25 | Baixa | `README.md` linha 72 | A `api` é responsável por "sincronização". | "Eventos de campo (canal único de escrita) e, no modo offline, a sincronização." |
| D26 | Baixa | `README.md` linhas 26–30 | Chama a área do técnico de "referência Android". O `web/README.md` diz que a interface mobile foi removida e as telas foram adaptadas ao desktop. | Ajustar o texto. |
| D27 | Baixa | `README.md` | Não lista `Questoes.md`, `Inconsistencias.md` nem `api/db/README.md` na estrutura nem na documentação de referência, e a seção "Executar" só cobre o `web`. | Acrescentar. |
| D28 | Baixa | `web/README.md` linha 35 | "CSS reorganizado em seções (tokens, base, casca…)" descreve um CSS único. Hoje são 7 arquivos em `web/src/styles`. | "CSS dividido em `src/styles` (ver Estilos)". |
| D29 | Baixa | `web/README.md` linha 27 | "As 10 telas do técnico ganharam topbar + menu lateral", mas a entrada é uma tela dividida, sem menu (9 telas com menu). | Corrigir a contagem. |

---

## 3. Código `web`

O `web` é a migração integral do protótipo antigo: as três fases pediam "migrar sem funcionalidade nova". Por isso a maior parte dos itens abaixo vem do protótipo e não é regressão. Alinhar o `web` às decisões novas (online primeiro, riscos marcados, campos da OS, permissões por perfil) é trabalho novo.

### Bug independente das decisões

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| W1 | Alta | `lib/checklist.ts`, `state/checklist.tsx`, `components/app/checklist/RevisaoApr.tsx` ✔ | **A APR pode ser validada com perguntas em branco.** Pela grade dá para saltar e responder só a última; "Concluir e validar" só é bloqueado por falta de evidência. Pergunta sem resposta não conta como reprovada, então a APR sai "aprovada". A especificação exige a APR respondida por inteiro (Decisão-chave 5). | Desabilitar "Concluir e validar" e listar as perguntas sem resposta enquanto `respondidas < total`. |

### Divergências das decisões recentes

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| W2 | Alta | `nova-apr/page.tsx`, `data/nova-apr-app.ts`, `data/checklist.ts`, `pdf/PdfPaginaApr.tsx` | Não existe a etapa de marcar riscos. As 9 medidas são perguntadas sempre, planas, sem classificação nem risco. O PDF não mostra os riscos marcados. | Etapa de riscos agrupados por classificação; filtrar as medidas pelos riscos marcados. |
| W3 | Alta | `web/modelos/TabelaPerguntas.tsx`, `data/modelos.ts` | O editor de modelos só tem #, Pergunta, Seção, Resposta crítica e Tipo. Falta Classificação/Risco, Evidência (foto ou texto) e "Permite NA". | Acrescentar as colunas. |
| W4 | Alta | `data/checklist.ts`, `data/bloqueio.ts`, `data/alertas.ts` | O texto dos itens não é o da APR 03 real. A planilha tem 11 itens de verificação, com "físicas" e "psicológicas" separadas; o mock tem 9 verificações e 9 medidas inventadas, e itens que não existem na APR (EPI completo, "atividade em dupla", "equipamentos elétricos… gás"). O impedimento é o item 11, não o 9. O item fundido "físicas e psicológicas" recebe evidência só em texto, mas a regra de texto vale só para a condição psicológica. | Reproduzir os 11 itens e as medidas reais do xlsx; separar o item psicológico (`evidencia: texto`). |
| W5 | Alta | `data/checklist.ts`, `PerguntaCard.tsx`, `lib/checklist.ts` | A resposta "NA" não existe: `Resposta = "sim" \| "nao"`, e `rotuloResposta` trata tudo que não é "sim" como "Não". Falta `permite_na`. | Acrescentar `na` e `permite_na`, com observação obrigatória. |
| W6 | Alta | `app/entrar/page.tsx`, `EntrarHero.tsx`, `ListaOsFiltravel.tsx`, `shell/Barras.tsx`, `TecnicoShell.tsx`, `MenuLateral.tsx`, `ExecucaoScreen.tsx`, `BloqueioScreen.tsx` | O app apresenta o offline como modo principal: aviso "acesso offline liberado" como estado padrão no login; "Funciona sem sinal"; "Sem sinal desde 08:12" fixo na lista; barra superior com "Offline" como estado inicial; "Fila e sincronização" no menu principal (contador 6 fixo); encerrar leva a "aguardando envio até a próxima sincronização"; "Entra na fila e sobe na próxima sincronização". | Estado padrão "Conectado"; fila e login offline só como contingência (aviso quando não há sinal). |
| W7 | Alta | `data/usuarios.ts`, `GestaoShell.tsx`, `TecnicoShell.tsx`, `lib/telas.ts` | O vocabulário de perfis separa técnico (app) de gestão (web). O menu de gestão é o mesmo para qualquer perfil, e `perfil` em `telas.ts` só troca o nome exibido. O técnico sempre vê "Painel de gestão", e o gestor vê "Área do técnico" mesmo sem poder aplicar APR. | Filtrar menu e atalhos pela matriz de permissões. |
| W8 | Alta | `data/detalhe.ts`, `data/detalhe-app.ts`, `data/importacao.ts`, `data/pdf.ts` | Faltam campos da OS: plano e item de manutenção (a OS 4031187 é preventiva e não os mostra), status do SAP (códigos como "LIB CAPC NOAP SCDM"), "criado por", data da ordem. O criador no PDF é "Helena Duarte" em vez de um código SAP. "Colunas lidas" não lista nenhum desses. | Acrescentar os campos aos dados e às telas, com plano e item só nas preventivas. |
| W9 | Alta | `ExecucaoScreen.tsx`, `data/pdf.ts` | Não há formulário de inspeção na execução (leituras e conformidades), embora a OS 4031187 seja preventiva. | Bloco de leituras e conformidades na execução e no PDF, mesmo que fictício. |
| W10 | Alta | `ModeloAprCard.tsx`, `AprExigidaCard.tsx`, `AtividadeModelo.tsx`, `data/modelos.ts` | O modelo vem do "tipo de atividade" (Z01/Z02), mas esse campo é só exibição. Não existe seletor de modelo na Nova APR para OS sem atividade mapeada, nem a marca "sem modelo / provisório" na tabela de atividades. | Renomear para "Atividade (plano de manutenção) → modelo", com seletor e marca. |
| W11 | Alta | `ExportacaoSap.tsx`, `state/exportacao.tsx`, `data/indicadores.ts` | A exportação para o SAP não tem as 3 abas (`Encerradas`, `Sem ordem SAP`, `Impedimentos`) nem as colunas previstas; só lista as encerradas. | Mostrar as 3 abas com contagens e a prévia das colunas. |
| W12 | Alta | `web/detalhe/AssinaturasOs.tsx` ✔, `data/pdf.ts` | A ciência do supervisor não tem ação: o texto é "Pendente · assina no painel", sem botão "Ciente". | Botão "Ciente" para o supervisor da equipe, com "Ciente em dd/mm hh:mm". |
| W13 | Alta | `ExecucaoScreen.tsx`, `BloqueioScreen.tsx`, `FormInterrupcao.tsx` | Encerrar a OS e registrar o impedimento não validam nada: descrição e assinaturas já vêm preenchidas, e o impedimento não exige motivo nem foto. | Desabilitar os botões e mostrar "Descrição, foto e assinaturas de todos são obrigatórias" enquanto faltar algo. |

### Telas e dados

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| W14 | Média | `detalhe/page.tsx`, `AprExigidaCard.tsx`, `data/os-app.ts` | A OS 4031187 aparece "Liberada" no detalhe, mas tem APR anterior negativa e status Pendente na lista. | Badge "Pendente" no detalhe. |
| W15 | Média | `ParticipanteRow.tsx`, `AprovadaScreen.tsx`, `data/aprovada.ts` | A seleção de participantes não tem efeito (`defaultChecked`): as assinaturas são sempre Carlos e Diego, e o número de pessoas é 2 fixo. | Guardar os participantes no estado e derivar assinaturas e número de pessoas. |
| W16 | Média | `PdfPaginaApr.tsx`, `data/pdf.ts` | A página 1 do PDF (APR) não tem descrição do serviço, data do documento, observações por item, observação geral, PAE nem os riscos marcados. | Acrescentar os blocos. |
| W17 | Média | `data/pdf.ts` | A página 2 do PDF não tem plano e item, status do SAP, cargo e registro profissional sob a assinatura, nem o formulário de inspeção. Há "Executante 3 · Sem terceiro executante", que sugere limite de 3. | Acrescentar, e listar quantos executantes houver. |
| W18 | Média | `TabelaUsuarios.tsx`, `data/usuarios.ts`, `lib/telas.ts`, `perfil/page.tsx` | Cargo e registro profissional (CREA) do usuário não aparecem em lugar nenhum. | Colunas e campos de cargo e CREA, usados nas assinaturas do PDF. |
| W19 | Média | `data/importacao.ts`, `ArquivoProcessado.tsx` | A importação mostra só 2 dos 4 motivos de "ignoradas". Faltam "Status SAP diferente de liberada" e "Reprogramada no sistema", o aviso "Atividade sem modelo de APR", a faixa "Falha na leitura do SAP" e o erro "Colunas obrigatórias ausentes". | Acrescentar. |
| W20 | Média | `TempoExecucao.tsx` | O indicador de tempo só existe por equipe e diz "por preventiva encerrada". A especificação pede por equipe, técnico e OS, de todas as execuções encerradas. | Seletor de visão; trocar "preventiva" por "execução encerrada". |
| W21 | Média | `data/alertas.ts` | A nota "atraso conta como justificado no indicador do mês" aparece em OS corretivas, e o indicador é só de preventivas. | Tirar a nota nas corretivas. |
| W22 | Média | `data/os-app.ts`, `BloqueioScreen.tsx` | A OS pendente da lista abre a tela de impedimento, sem caminho para uma APR nova (Decisão-chave 8). | Levar ao detalhe da OS com "Iniciar APR", ou "Fazer nova APR" na tela. |
| W23 | Média | `AlertasScreen.tsx` | O cabeçalho diz "avisos também enviados por e-mail", mas o e-mail vale só para impedimentos. | "E-mail apenas para impedimentos." |
| W24 | Média | `FaixaAlertas.tsx` | O texto "3 alertas não lidos" é fixo e não acompanha o contador do sino. | Derivar do estado. |
| W25 | Média | `DetalheAlerta.tsx`, `data/quadro.ts` | "Abrir OS" leva sempre ao detalhe da OS 4031187, mesmo nos alertas e cartões de outras OS. | Rota com parâmetro, ou aviso de demonstração. |
| W26 | Média | `AlertasDaOs.tsx`, `data/detalhe.ts` | O detalhe da OS 4031187 diz "Nenhum alerta", mas registra uma APR bloqueada com supervisor avisado. | Listar o alerta já lido. |
| W27 | Média | `data/alertas.ts` | A OS de apoio de exemplo tem número SAP (4031301) e equipe "externa". A especificação diz que a OS de apoio não tem número SAP e é aberta para uma equipe cadastrada. | Mostrar sem número SAP e com equipe da lista. |
| W28 | Média | `web/quadro/*`, `DetalheCabecalho.tsx` | Faltam no quadro: destaque "Execução aberta há N h" (mais de 12 h), marcar local como crítico, cancelar OS de apoio e a faixa "Falha na leitura do SAP". "Histórico do local" é só um aviso. | Acrescentar ao mock. |
| W29 | Média | `shell/Barras.tsx` ✔ | O campo de busca por número da ordem não faz nada. | Ligar ao detalhe, ao menos para a OS conhecida. |
| W30 | Média | `EditorModelo.tsx`, `web/modelos/page.tsx` | Apresenta a atualização "na próxima sincronização" como caminho normal. | "APRs novas usam a v5; no modo offline, na próxima sincronização." |
| W31 | Média | `data/modelos.ts` | O editor diz "10 itens eliminatórios", mas a tabela tem 9. | Calcular a contagem a partir dos itens. |
| W32 | Média | `data/checklist.ts`, `data/modelos.ts` | O tipo de item usa dois vocabulários (`elim`/`alerta` e `elim`/`alt`); a especificação usa `eliminatorio` e `alerta`. | Um só tipo, com os valores da especificação. |
| W33 | Média | `data/checklist.ts`, `data/modelos.ts` | A v5 apresenta como "novo" um item que a v4 já cobre ("Plano de emergência do cliente conhecido pela equipe"). | Escolher outro item novo. |
| W34 | Média | `data/os-app.ts`, `data/quadro.ts`, `data/bloqueio.ts` | Os dados fictícios não usam os números e nomes dos exemplos reais: OS 4023470 (nota 10006463, local "VILA VELHA/REDE VILA VELHA"), preventiva 4019821 (PROT_CAT, Plano 10573, Item 10603, equipamento "10002381 - RETIFICADOR - RET-12-001"). Nenhuma OS usa PROT_CAT, e a inspeção de proteção catódica está em Serviços Especiais. | Usar os números, o código de local completo e a equipe Proteção Catódica. |
| W35 | Média | `detalhe/page.tsx`, `data/os-app.ts` | Prioridades fora do padrão do SAP ("Prioridade muito alta", "alta", "média"); o SAP usa "Muito alto", "Alto". | Usar o texto do SAP. |
| W36 | Média | `data/sincronizacao.ts` | A fila de sincronização é fixa (5 arquivos, lista constante) e não recebe as ações feitas no fluxo. | Derivar da ação ou assumir que é só demonstração. |

### Acabamento

| # | Gravidade | Onde | Inconsistência | Correção sugerida |
|---|---|---|---|---|
| W37 | Baixa | `IniciarChecklist.tsx`, `AprAprovada.tsx`, `PdfPaginaApr.tsx`, `EditorModelo.tsx`, `TabelaUsuarios.tsx`, `LinhasIgnoradas.tsx` | Contagens fixas ("18 itens", "19 perguntas", "52 usuários", "7 linhas") em vez de derivadas dos dados. Os números batem hoje. A OS 4031187, "ERP Serra" e os horários também estão digitados em vários arquivos. | Derivar dos dados. |
| W38 | Baixa | `ListaOsFiltravel.tsx`, `data/detalhe.ts` | "Sem sinal desde 08:12" e "após 4h26": de 08:12 a 12:40 são 4h28. | Corrigir. |
| W39 | Baixa | `data/alertas.ts`, `AprsDaOs.tsx`, `data/pdf.ts` | Marcelo Dias e Helena Duarte não existem em `data/usuarios.ts`. O equipamento "VLV-ERP01-012" não segue o formato do SAP. | Usar usuários e equipamentos cadastrados. |
| W40 | Baixa | `FormInterrupcao.tsx` | A interrupção da OS 4031187 (corrosão de válvulas) vem com a foto "caixa de válvula alagada · 09:14" já anexada. | Foto coerente com a OS. |
| W41 | Baixa | `AtalhosChecklist.tsx` | "Rascunho salvo no aparelho": no app é SQLite, na web é o navegador. | "Salvo neste aparelho/navegador". |
| W42 | Baixa | `NotasBloqueio.tsx`, `data/detalhe.ts` | Textos de contingência sem o contexto ("assim que houver sinal", "no celular da equipe na próxima sincronização"). "Baixada no aparelho" é um evento que não existe no contrato de eventos. | Ajustar os textos. |
| W43 | Baixa | `AtalhosChecklist.tsx`, `state/checklist.tsx`, `lib/checklist.ts` | Atalhos de demonstração ("ir à pergunta 9", "responder o resto") estão na tela de produção. | Esconder atrás de uma flag de demonstração. |
| W44 | Baixa | `data/` e `lib/` | Tipos e dados duplicados: `PerguntaApr`/`perguntasApr03` (checklist e modelos), `ParticipanteApr` (detalhe e nova-apr), `fotosExecucao` (execução e detalhe), `equipes` (indicadores e usuários), `DadoSap`/`CampoSap`, `geraAlerta` e `rotuloResposta` (lib e PDF). Carlos e Diego aparecem digitados em 6 arquivos. | Consolidar. |
| W45 | Baixa | `lib/telas.ts` ✔ | `Tela.titulo` e `Tela.area` nunca são lidos. `/app`, `/web` e `/doc` não têm página e dão 404 (nenhum link aponta para tela inexistente). | Remover os campos; redirecionar as raízes, se quiser. |
| W46 | Baixa | `lib/telas.ts` | `PerfilWeb = "sup" \| "ana" \| "luc" \| "adm"` usa abreviações e nome de pessoa; a especificação usa só `tecnico` e `admin` (o supervisor é o técnico que a equipe aponta, não um perfil; analista e Segurança deixaram de ser perfis em 12/10/2026). | Usar os valores da especificação. |
| W47 | Baixa | `data/quadro.ts`, `CabecalhoIndicadores.tsx` | Os filtros oferecem só 2 ou 3 das 5 equipes. O técnico que supervisiona uma só equipe não precisaria do filtro "Equipe"; com várias, sim. | Alinhar com as permissões. |

---

## 4. O que foi conferido e está coerente

- **Banco × especificação:** colunas, tipos, nulidade, chaves estrangeiras e valores permitidos (perfis, status da OS, resultados da execução, tipos de alerta, os 8 tipos de evento, resposta sim/não/NA, tipo e evidência de item) batem. Os índices citados na especificação existem no banco.
- **Estrutura:** 21 tabelas, 2 migrações, 8 modelos de APR (APR 01 a 07 e 09), janela de login offline de 7 dias, e os volumes de OS (cerca de 390 por mês, de 200 a 409, e 900) batem com as transcrições.
- **Especificação por dentro:** `POST /eventos` é o único canal de escrita em todas as seções; `POST /sync/pull` é só do modo offline; as âncoras internas e os números das Decisões-chave citadas existem; os 8 tipos de evento batem com os payloads e com os diagramas.
- **`web`:** status da OS e colunas do quadro; contagens do quadro, da lista, dos indicadores, da importação e dos usuários fecham; tempos e pausas coincidem entre app, painel, PDF e fila; regras de evidência do checklist (observação e foto, só texto no item de condição pessoal, alerta que não bloqueia); impedimento e reprogramação com justificativa obrigatória; os 4 tipos de alerta; PDF com 2 páginas; importação que nunca reabre OS encerrada.
- **READMEs:** o da raiz descreve corretamente as oito planilhas, as rotas e a arquitetura; `api/README.md` e `mobile/README.md` estão de acordo com a decisão "online primeiro".

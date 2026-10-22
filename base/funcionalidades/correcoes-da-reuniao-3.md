# Correções da Reunião 3 — implementação de 18/10/2026

> O que a [Reunião 3](../base/reunioes/Transcricao_Reuniao3.md) levantou e o time decidiu em 18/10/2026 (as decisões estão no [resumo](../base/reunioes/correcoes-reuniao-3-resumo.md), com a numeração dos itens usada aqui) e o que foi implementado na `api` e na `web`. **De fora, a pedido: a digitalização (item 15), que será feita à parte.** O app `mobile` ainda não existe e herda estas regras (a `api` é quem as aplica).
>
> Os itens 4 (assinatura com validade jurídica), 17 (login corporativo) e 18 (sincronização em segundo plano) dependem de contas e de um app que ainda não existem; o que foi feito e o que ficou registrado está na seção 7.

## 1. Resumo do que mudou

| Item | O que passou a valer |
|---|---|
| 1 | Todos assinam a APR, cada um na própria conta, **só no começo**; a execução só começa quando todos assinaram. Quem não concorda recusa (direito de recusa) e sai da APR. No offline (contingência), a assinatura no aparelho do responsável continua, marcada como presencial. |
| 2 | No fim, assina o responsável e, por último, o supervisor (mesmo que tenha participado do serviço), depois de ler o relatório da execução. Só então a OS está concluída. A ciência de antes virou essa assinatura. |
| 3 | A APR exige ao menos 2 participantes (sem máximo). Ausente e desligado não entram. |
| 5 | Pausar, Suspender, Interromper por risco e Encerrar passam a ter regras e telas próprias (a tabela está na seção 3). |
| 6 | Motivo obrigatório na pausa: almoço, aguardando (o que ou quem), descanso, condição climática, enfermidade, lesão ou outro (com descrição). |
| 7 | Motivo obrigatório ao suspender: enfermidade, lesão, fim de expediente, condição climática, falta de material ou equipamento ou outro (com descrição). |
| 8 | Lesão e enfermidade (na pausa e na suspensão) avisam o supervisor na hora, no sino e por e-mail (obrigatório, como o impedimento), e constam no relatório. |
| 9 | O tempo para no clique em "Encerrar OS", depois de uma confirmação. A descrição, as fotos, o checklist e a assinatura do responsável vêm depois e não entram no tempo. |
| 10 | Descrição e fotos do encerramento passam a ser opcionais. Sem descrição, o PDF e a planilha de baixa trazem "Executado conforme a OS, sem ocorrências". A foto da interrupção continua obrigatória. |
| 11 | A localização (GPS) é gravada em cinco momentos: início, pausa, suspensão, interrupção e encerramento. Sem GPS o serviço não é bloqueado ("sem localização"). |
| 12 | O cronômetro não depende do app aberto (já era assim: o tempo é calculado a partir do início). |
| 13 | Relatório da execução, à parte do PDF, para o supervisor e o admin. |
| 14 | O PDF da OS reproduz a folha da OS do SAP e a APR como são, sem nada a mais. |
| 16 | Validação com mensagem de erro clara nos formulários (seção 6). |

## 2. Assinaturas (itens 1, 2 e 3)

**A APR.** Depois de validada (`POST /aprs/avaliar`), a APR aprovada é registrada (`apr_concluida`) **sem assinaturas**. Cada participante recebe o aviso "APR aguardando a sua assinatura" no sino, vê a faixa na lista de OS e assina na própria conta (`apr_assinada`, com a assinatura do perfil); a `api` copia a imagem para a APR, com a hora. Só a APR de hoje se assina. A execução só começa quando todos os participantes que ficaram na APR assinaram (`apr_sem_assinaturas` até lá).

**O direito de recusa** (`apr_recusada`, com motivo obrigatório): o participante sai da APR (não conta como participante, não assina, fica registrado com o motivo) e o supervisor recebe o aviso `direito_de_recusa` (sino e e-mail obrigatório). Se restarem menos de 2 participantes, ou se quem recusou foi o responsável, a APR não serve mais: é preciso uma APR nova. Só vale antes de a execução começar e para quem ainda não assinou.

**O modo offline** (contingência, só quando o app existir): `apr_concluida` com `assinatura_presencial: true` copia as assinaturas dos perfis na hora, marcadas como presenciais (`assinada_em` de cada um, se vier). O `execucao_iniciada` que chega da fila antes de uma assinatura de outro aparelho fica pendente em vez de recusado.

**O encerramento.** Dois passos (seção 4): o clique em "Encerrar OS" e, depois, o preenchimento com a assinatura do **responsável** (`encerramento_assinado`; só o responsável pela execução assina). A OS passa por `encerrando` (aguarda o responsável) e `aguardando_supervisor` (aguarda o supervisor) até a assinatura final do supervisor (`POST /os/{id}/ciencia`), quando passa a `encerrada` (concluída), o PDF é gerado e a OS entra na planilha de baixa do SAP. O supervisor da equipe da OS (ou o representante que está no comando) assina; quem participou do serviço também pode, e não existe mais o bloqueio `ciencia_propria`.

**Pontuação.** A APR pontua quando todos assinaram; a execução, quando o responsável assina o encerramento; o supervisor, quando assina no prazo de 72 h (como a ciência já pontuava).

**Mínimo de 2 participantes** (`participantes_insuficientes`), também em `POST /aprs/avaliar`. O participante desligado ou sem acesso é recusado (`participante_inativo`), como o ausente já era.

## 3. As quatro ações da execução (item 5)

| Botão | Quando usar | O que acontece |
|---|---|---|
| Pausar | Parada curta; a equipe volta ao mesmo serviço no mesmo dia | Pede o motivo (obrigatório) e grava a localização. Só o tempo líquido para; "Continuar" retoma com a mesma APR |
| Suspender | O serviço não continua hoje | Pede o motivo (obrigatório) e grava a localização. Encerra esta execução; a OS fica pendente e a retomada pede APR nova |
| Interromper por risco | Apareceu um risco ou impedimento | Pede motivo, ao menos 1 foto e assinatura, e grava a localização; a OS fica pendente e o supervisor é avisado |
| Encerrar | O serviço terminou | Pede a confirmação; o tempo para e a localização é gravada; segue para o preenchimento e a assinatura do responsável e, por último, a do supervisor |

## 4. Contrato da `api`

Todos os eventos entram por `POST /eventos` (o canal único de escrita de campo, `{ eventos: [{ id, tipo, os_id, payload, ocorrido_em }] }`). As chaves das respostas são `snake_case`. `latitude` e `longitude` vêm juntas (as duas, ou nenhuma = sem localização).

### 4.1 Eventos

| Evento (`tipo`) | `payload` | Recusas (`codigo`) |
|---|---|---|
| `apr_concluida` | como antes, com `participantes` (≥ 2) e o novo `assinatura_presencial` (padrão `false`) | `participantes_insuficientes`, `participante_inativo` e as de antes |
| `apr_assinada` | `{ apr_id, assinada_em? }` — o participante que age assina com a assinatura do perfil | `fora_da_apr`, `apr_bloqueada`, `apr_recusada_por_voce`, `apr_vencida`, `assinatura_ausente`; `apr_ausente` (pendente) |
| `apr_recusada` | `{ apr_id, motivo, recusada_em? }` | `motivo_obrigatorio`, `ja_assinou`, `apr_ja_usada`, `fora_da_apr`, `apr_bloqueada` |
| `execucao_iniciada` | `{ id, apr_id, inicio, numero_pessoas?, latitude?, longitude? }` | `apr_sem_assinaturas` (a mensagem diz quem falta), `apr_sem_participantes`, e as de antes |
| `pausa_iniciada` | `{ id, execucao_id, inicio, motivo, complemento?, latitude?, longitude? }`; `motivo` ∈ `almoco`, `aguardando`, `descanso`, `clima`, `enfermidade`, `lesao`, `outro`; `complemento` obrigatório em `aguardando` e `outro` | `motivo_obrigatorio`, `complemento_obrigatorio` |
| `pausa_encerrada` | como antes | |
| `execucao_suspensa` | `{ execucao_id, fim, motivo, complemento?, latitude?, longitude? }`; `motivo` ∈ `enfermidade`, `lesao`, `fim_expediente`, `clima`, `falta_material`, `outro`; `complemento` obrigatório em `outro` | `motivo_obrigatorio`, `complemento_obrigatorio` |
| `execucao_interrompida` | `{ execucao_id, fim, motivo, evidencias (≥ 1 foto), latitude?, longitude? }` (assina com o perfil) | como antes |
| `execucao_encerrada` | `{ execucao_id, fim, latitude?, longitude? }` — o clique em "Encerrar OS": o tempo para aqui | |
| `encerramento_assinado` | `{ execucao_id, assinada_em?, descricao_atividade?, dados_inspecao?, evidencias? }` — o preenchimento e a assinatura do responsável; descrição e fotos opcionais | `execucao_nao_encerrada`, `checklist_incompleto`, `observacao_obrigatoria` |
| `execucao_cancelada` | como antes | |

A resposta de `POST /eventos` traz `os: [{ id, status }]` com o status novo das OS afetadas.

### 4.2 Leituras

- **`GET /os/{id}`**: o `status` pode ser `encerrando` e `aguardando_supervisor`. Em `execucoes[]` entram `suspensao_motivo`, `suspensao_complemento`, `encerramento_assinado_em` (nulo na `encerrada` = a OS está `encerrando`), `localizacao_inicio` e `localizacao_fim` (`{ latitude, longitude }` ou `null`); em `pausas[]`, `complemento` e `localizacao`. Em `aprs[].participantes[]`, `assinatura_path` e `assinada_em` (nulos enquanto não assinou), `assinatura_presencial`, `recusou_em` e `recusa_motivo`. A linha do tempo ganhou "assinou a APR", "recusou a APR", "encerramento assinado" e a assinatura final do supervisor.
- **`GET /os`** (quadro): `contagem_por_status` e `?status=` aceitam os dois status novos.
- **`GET /me/aprs-para-assinar`** → `{ aprs: [{ apr_id, os_id, numero_ordem, titulo, local_codigo, concluida_em, preenchida_por, preenchida_por_nome, funcao }] }`: as APRs aprovadas de hoje que esperam a assinatura de quem pergunta.
- **`POST /os/{id}/ciencia`** (a assinatura final do supervisor) → `{ ciencia_em, status, pontos_ganhos, ganhos }`; só com a OS em `aguardando_supervisor` (`os_nao_aguardando_supervisor`; `ciencia_ja_dada`).
- **`GET /os/{id}/pdf`**: o PDF da OS (a APR e a folha do SAP, como o papel); só existe depois da assinatura final do supervisor.
- **`GET /os/{id}/relatorio-execucao`**: o relatório da execução, em PDF, gerado na hora; só o supervisor da equipe e o admin (`403` para os demais, `404` fora do escopo, `409 os_sem_execucao` sem execução finalizada).
- **Modelos de APR**: `participantes_com_assinatura` (a folha tem a coluna "Assinatura" na tabela de participantes) vem em cada versão e é aceito ao criar a versão (`POST /modelos-apr/{codigo}/versoes`) e ao editar o rascunho.
- **Indicadores**: a pausa por motivo (`GET /indicadores/tempo`, dashboards) traz os sete motivos mais `sem_motivo`; a pendência `sem_ciencia` (hoje no topo do dashboard de OS; a aba Geral saiu em 21/10/2026) conta as OS `aguardando_supervisor`.
- **Avisos** (sino e e-mail): `apr_para_assinar` (só no sino), `direito_de_recusa` e `lesao_ou_enfermidade` (e-mail obrigatório, categoria Segurança), `os_para_assinar` (o supervisor, categoria OS). O `os_ciencia` (executor avisado) agora diz "assinatura final do supervisor".

### 4.3 Estados da OS depois da execução

```text
em_execucao ── Encerrar OS ──▶ encerrando ── responsável assina ──▶ aguardando_supervisor ── supervisor assina ──▶ encerrada
```

`encerrando` e `aguardando_supervisor` não aceitam APR nem execução nova. A tela do técnico que encerrou leva o responsável de volta ao preenchimento enquanto a OS está `encerrando`.

## 5. PDF e relatório (itens 13 e 14)

Os detalhes ficam no código ([`pdf-paginas.ts`](../api/src/servicos/pdf-paginas.ts) e [`relatorio-execucao.ts`](../api/src/servicos/relatorio-execucao.ts)); a decisão está no resumo da reunião. O PDF da OS tem a(s) página(s) da APR (a coluna "Assinatura" dos participantes só aparece nos modelos que a têm: APR 04, 05 e 06) e as duas folhas da OS do SAP; o que o SYNQ OS acrescenta ao papel (tempos, pausas, localização, fotos, PDFs anexados, checklist de inspeção, assinaturas da APR com a hora) está no relatório.

## 6. Validação nos formulários (item 16)

O Mario reclamou que, quando o sistema não deixa salvar, não diz por quê: o botão ficava desativado e um "Falta: …" em letra pequena passava despercebido. Nos formulários que esta rodada criou ou tocou, a `web` passou a usar **React Hook Form com Zod** (dependências novas: `react-hook-form`, `@hookform/resolvers`, `zod`):

- o botão de enviar **não fica desativado** por campo faltando (só enquanto envia);
- ao tentar enviar com erro, a mensagem aparece junto do campo, em português, e o foco vai para o primeiro campo com erro;
- o erro devolvido pela `api` aparece num aviso visível acima do botão.

A base é [`Field.tsx`](../web/src/components/ui/Field.tsx) (aceita `erro`, com `role="alert"` e `aria-describedby`) e [`useFormulario.tsx`](../web/src/components/ui/useFormulario.tsx). Aplicado em: as janelas de motivo da pausa e da suspensão e a de recusa da APR, o encerramento, a interrupção por risco, a nova APR (mínimo de 2 participantes), o início da execução, a suspensão da execução esquecida, a revisão da APR, a evidência dos itens reprovados, a assinatura (`JanelaDeAssinatura`) e a janela do relatório com a assinatura do supervisor. Os textos "Falta:" desapareceram.

**A varredura nos demais formulários foi feita em 19/10/2026 (pendência 13 do [pendencias.md](../../pendencias.md)).** Entraram, com o mesmo padrão (erro em vermelho abaixo de cada campo, foco no primeiro, botão ativo): usuários e equipes; modelos de APR (novo modelo, orientação) e atividades; materiais (cadastro e edição na linha) e a lista de materiais do serviço; OS de apoio e reprogramação; devolver, cancelar e reservar a OS; as ações da ausência (pedir, registrar, aprovar, prorrogar, fim antecipado, recusa de cadastro); o ciclo da preventiva, o intervalo do resultado da importação e o representante da equipe; patentes, conquistas e a pontuação das tarefas; o simulador de funcionários e de ordens (cadastro e criação em lotes); o login e as trocas de senha; o texto do procedimento do treinamento e o "Reportar problema". Peças novas na base:

- `CampoDeCelula` (em `Field.tsx`): o erro em vermelho dentro da célula de uma tabela editável, para as linhas que não podem ser um `<form>` (o botão Salvar dispara o envio).
- `validar` (em `useFormulario`) e a propriedade `validar` da `JanelaDeAssinatura`: a janela confere os campos antes de assinar, e a mensagem fica junto de cada campo (a propriedade `incompleto` e o "Preencha os campos acima" saíram).
- [`lib/validacao.ts`](../../web/src/lib/validacao.ts): o dia que existe, a data opcional, o inteiro dentro de um intervalo e a troca de senha; `conferirPeriodo` (no período da ausência) e `regraDaImagem` (nas imagens das patentes e conquistas) levam a mensagem ao campo certo.

**Ficaram como estão, de propósito:** os conversadores (a Vitória, o pedido de ajuste do treinamento), as conferências de importação e de digitalização (o admin revisa linha a linha e a tela já conta o que bloqueia), as confirmações em massa do simulador (só têm listas com valor sempre válido) e os filtros.

## 7. O que ficou de fora ou registrado

| Item | Situação |
|---|---|
| 4 — assinatura com validade jurídica | O protótipo mostra o fluxo com a assinatura desenhada. A integração com o ZapSign (a empresa o usa), token ou gov.br precisa de conta e credenciais que o projeto não tem; continua ligada à questão 38. |
| 15 — digitalização e a pergunta antes da importação | **Fora desta rodada, a pedido**: será feita à parte. |
| 16 — varredura completa dos formulários | Feita nos formulários tocados; o resto fica para a próxima rodada (seção 6). |
| 17 — login corporativo (conta Microsoft com segundo fator) | Não feito: depende do acesso ao diretório da empresa. O registro de funcionários simulado continua garantindo que só funcionário tenha conta. |
| 18 — sincronização em segundo plano | Depende do app `mobile`, que ainda não existe; o plano está em [mobile/README.md](../mobile/README.md). |

**Em aberto (perguntas ao cliente):** a devolução pelo supervisor em vez de assinar; "Houve desvio?" e "Tempo parada" na folha do SAP (hoje em branco, como no papel); mais de 3 executantes (hoje os extras seguem em novas linhas de blocos iguais); equipe com só 1 pessoa disponível (não executa, pela regra dos 2 participantes). Estão em [Questoes.md](../Questoes.md).

**Decisões desta implementação que a reunião não fechou:**

- O relatório da execução mostra o ponto como coordenadas e link do mapa (no PDF) e mapa embutido (na tela do detalhe), ao lado do endereço da OS. A distância até o endereço não é calculada: exigiria converter o endereço em coordenadas por um serviço externo.
- No PDF da OS, o logotipo da empresa não é reproduzido: a caixa do logo leva "SYNQ OS". "Houve desvio?", "Tempo parada" e "Solicitante da Manutenção" ficam em branco, como no papel.
- Na lesão e na enfermidade, o complemento ("o que aconteceu") é opcional; nos motivos "Aguardando" e "Outro" é obrigatório.
- O representante que está no comando assina por último no lugar do supervisor ausente e vê o relatório, como já acontecia com a ciência.
- A migração `0032` preenche o que já existia: as assinaturas antigas da APR viram "presencial" e as execuções encerradas antes ganham `encerramento_assinado_em` (para não voltarem a `encerrando`). Marca também, nos modelos já publicados, quais têm a coluna "Assinatura" (só APR 04, 05 e 06).
- O Campo de treino tem uma API fictícia própria: nela os colegas assinam a APR sozinhos poucos segundos depois, e um supervisor fictício assina por último 45 s depois do encerramento; não há pontuação, sino nem e-mail.

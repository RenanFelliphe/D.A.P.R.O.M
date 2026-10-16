# Checklist de inspeção das preventivas — plano de 15/10/2026

> Plano para o checklist de inspeção das OS preventivas: uma lista de perguntas definida junto com o ciclo da preventiva e preenchida pelo técnico no encerramento de cada OS dela. Traz também a mudança na gamificação que veio na mesma conversa: a preventiva concluída vale o dobro da corretiva.
>
> **Situação:** implementado em 15/10/2026 (`api` e web), com as diferenças da seção 10. A migração é a `0023_checklist_de_inspecao`.
>
> Fontes: a conversa de 15/10/2026; a questão 57 do [Questoes.md](Questoes.md); o ciclo das preventivas (seção 3.2 do [funcionalidades.md](funcionalidades.md)); o código em [`preventivas.ts`](api/src/db/schema/preventivas.ts), [`EditorDoCiclo.tsx`](web/src/components/web/preventivas/EditorDoCiclo.tsx), [`eventos-execucao.ts`](api/src/dominio/eventos-execucao.ts) e [`pdf-paginas.ts`](api/src/servicos/pdf-paginas.ts).

## Resumo

- **Cada preventiva tem o seu checklist.** Ele é definido no mesmo lugar do ciclo dela, o editor do ciclo, por quem já define o intervalo: o admin e o supervisor da equipe.
- **O checklist é uma lista de perguntas,** mostrada ao técnico como caixas de marcar no encerramento.
- **O encerramento pede o checklist.** Toda OS da preventiva só é encerrada com ele preenchido.
- **Item não marcado não bloqueia.** Ele pede uma observação e avisa o supervisor no sino.
- **O que foi respondido não muda depois.** A execução guarda as perguntas como estavam, junto com as respostas.
- **Gamificação:** preencher o checklist não dá bônus, mas a preventiva concluída passa a valer o dobro da corretiva.

---

## 1. O que é

- **De onde vem:** a página 2 da OS 4019821 (preventiva, inspeção funcional de retificador) traz um "Checklist de Inspeção Técnica" (questão 57). A OS corretiva 4023470 não tem nada parecido.
- **O que o sistema faz:** guarda as perguntas da preventiva e, a cada OS dela, pede que o técnico marque cada uma.
- **O que fica de fora:** as leituras com valor e unidade do exemplo do retificador (tensão, horímetro) e as opções como "Operante / Não operante". Cada pergunta é uma caixa de marcar. A leitura com valor pode entrar no texto da observação.

## 2. Onde é definido

- **A preventiva é o plano de manutenção do SAP** (`plano_preventiva`: plano e item). Toda OS preventiva com o mesmo plano e item é um ciclo dele.
- **O checklist fica no plano,** ao lado do intervalo. Assim, toda OS daquele plano e item pede as mesmas perguntas, e um retificador num local tem o seu checklist, independente do retificador de outro local.
- **Quem edita:** o admin e o supervisor da equipe, as mesmas pessoas que editam o ciclo hoje.
- **Onde:** no editor do ciclo (`EditorDoCiclo`), aberto pelo botão "OS preventivas" do quadro. Ele ganha a seção "Checklist de inspeção":
  - adicionar, editar, remover e reordenar perguntas;
  - texto de até 300 caracteres por pergunta;
  - no máximo 50 perguntas por plano.
- **Plano sem checklist:** o encerramento da OS continua como hoje, sem o checklist.
- **Auditoria:** a mudança no checklist entra como `plano_preventiva.checklist`, com o antes e o depois.

## 3. Como o técnico preenche

- **Antes de sair.** O detalhe da OS preventiva mostra o cartão "Checklist de inspeção", com as perguntas, para o técnico saber o que vai verificar.
- **No encerramento.** A tela de encerramento ganha a etapa "Checklist de inspeção", antes da descrição, das fotos e das assinaturas:
  - cada pergunta é uma caixa de marcar;
  - o item não marcado pede uma observação, de até 500 caracteres;
  - o item marcado aceita uma observação opcional;
  - "Encerrar" só é liberado quando todo item não marcado tem observação.
- **Só no encerramento.** A interrupção por risco, a suspensão e o cancelamento por engano não pedem o checklist.
- **Item não marcado.** Não bloqueia o encerramento. A OS encerra normalmente, e o supervisor da equipe recebe o alerta `inspecao_com_pendencia` no sino, com os itens e as observações.
- **Quem decide é o servidor.** O encerramento de uma OS cujo plano tem checklist é recusado sem as respostas de todos os itens (`checklist_incompleto`) ou com item não marcado sem observação (`observacao_obrigatoria`).
- **Pergunta mudada durante o serviço.** O servidor confere as respostas com o checklist atual do plano. A pergunta nova que o aparelho não conhecia é recusada online. Da fila offline, o encerramento é aceito com o que veio, e a pergunta que faltou fica registrada como "não respondida".

## 4. O que fica registrado

- **Na execução:** `execucao.dados_inspecao` ganha estrutura fixa: `{ itens: [{ pergunta, marcado, observacao }] }`. A pergunta é copiada como estava, então mudar o checklist depois não altera as execuções antigas.
- **No detalhe da OS:** o histórico da execução mostra o checklist, com os itens não marcados em destaque.
- **No PDF:** a página da OS troca os pares de campo e valor pela lista "Checklist de inspeção", com "☑" ou "☐", a pergunta e a observação.
- **No alerta:** `inspecao_com_pendencia` leva a OS, o plano e os itens não marcados.

## 5. Gamificação

Decidido em 15/10/2026, a ser registrado no [gameficacao.md](gameficacao.md) (seções 2.1, 2.2, 11 e 12) quando for implementado:

- **Preencher o checklist não dá bônus.** Como ele é obrigatório para encerrar, o bônus pontuaria o encerramento duas vezes. A linha "Formulário de inspeção da preventiva" da seção 2.2 muda o motivo para esse.
- **A preventiva concluída vale o dobro da corretiva,** para incentivar as preventivas:
  - entra a tarefa nova **"Preventiva concluída"** (`preventiva_concluida`), no grupo "Bônus da OS", com 10 pontos, o mesmo valor da "Execução concluída";
  - ganha quem tem a "Execução concluída" numa OS preventiva, inclusive quem interrompeu por risco (a segurança nunca custa pontos);
  - limite de uma por pessoa, por OS;
  - é uma tarefa própria, e não um multiplicador, para o admin poder ajustar o valor como os demais. Se ele mudar a "Execução concluída", precisa mudar esta também para manter o dobro.
- **O que não dobra:** a APR completa e os demais bônus valem o mesmo na preventiva e na corretiva.
- **O "Preventiva em dia" continua,** somado a esta.
- **A migração** inclui `preventiva_concluida` no `CHECK` de `regra_pontuacao.codigo` e na carga das tarefas.
- **O histórico:** a nova tarefa não é lançada para as preventivas já encerradas, como as outras tarefas acrescentadas depois.
- **Efeito nas patentes:** as preventivas sobem a pontuação. Os limites das patentes já estão na lista de revisão do fim da primeira temporada real.

## 6. O que muda no código

### 6.1 Banco

Uma migração nova:

- tabela `plano_preventiva_pergunta`: `id`, `plano_id`, `texto`, `posicao`, `criada_em`;
- `inspecao_com_pendencia` no `CHECK` de `alerta.tipo`;
- `preventiva_concluida` no `CHECK` de `regra_pontuacao.codigo`, com a linha da carga.

### 6.2 API

- **`GET /preventivas/{id}` e `PUT /preventivas/{id}`:** trazem e aceitam o `checklist` (`[{ id?, texto }]`, na ordem).
- **`GET /os/{id}`:** a OS preventiva traz o `checklist_inspecao` do plano.
- **Evento `execucao_encerrada`:** o `dados_inspecao` passa a ter o formato da seção 4, com as respostas por `pergunta_id`; o servidor copia o texto.
- **`POST /sync/pull`:** cada OS preventiva leva o checklist do plano.
- **Alerta:** `inspecao_com_pendencia`, criado no encerramento, para o supervisor da equipe (ou os admins, se a equipe não tiver supervisor).
- **Pontuação:** a regra `preventiva_concluida` em [`pontuacao.ts`](api/src/dominio/pontuacao.ts) e em [`regras-de-pontuacao.ts`](api/src/dominio/regras-de-pontuacao.ts).
- **PDF:** a lista da seção 4 em [`pdf-paginas.ts`](api/src/servicos/pdf-paginas.ts).
- **Testes:** o checklist no plano, o encerramento com e sem checklist, a recusa, a fila offline, o alerta, o PDF e a nova tarefa.

### 6.3 Web

- **[`EditorDoCiclo.tsx`](web/src/components/web/preventivas/EditorDoCiclo.tsx):** a seção "Checklist de inspeção".
- **Detalhe da OS:** o cartão "Checklist de inspeção" e o checklist no histórico da execução.
- **[`ExecucaoScreen.tsx`](web/src/components/app/execucao/ExecucaoScreen.tsx):** a etapa do checklist no encerramento.
- **Alertas:** o tipo novo em [`tipos.ts`](web/src/components/web/alertas/tipos.ts) e no `DetalheAlerta`.
- **Gamificação:** a tarefa nova aparece sozinha na página "Como pontuar", que lê o catálogo da `api`.

### 6.4 Campo de treino

- Sem mudança nesta etapa: a OS guiada do treino é corretiva.

### 6.5 Carga de demonstração

- Os planos fictícios ganham checklists, um deles a partir do exemplo do retificador da OS 4019821.
- As preventivas encerradas da demonstração trazem o checklist preenchido, uma delas com item não marcado e o alerta.

## 7. Documentação

- **[funcionalidades.md](funcionalidades.md):** o item do formulário de inspeção passa a apontar para este arquivo.
- **Questão 57** ([Questoes.md](Questoes.md) e [pontos-a-validar.md](base/.design/pontos-a-validar.md)): o "Adotado por enquanto" passa a ser este checklist, e a pergunta ao Iago fica para conferir se ele cobre o uso real.
- **[gameficacao.md](gameficacao.md):** a seção 5 deste plano.
- **[api/README.md](api/README.md):** as rotas e o evento.

## 8. Ordem de implementação

1. Migração e `api`: checklist no plano, encerramento, alerta, PDF e pontuação, com os testes.
2. Web: editor do ciclo, detalhe da OS e encerramento.
3. Carga de demonstração.
4. Documentação.

## 9. Pontos em aberto

- **O uso real.** O exemplo da OS 4019821 tem leituras com valor e opções além de sim ou não. Se a operação precisar delas estruturadas, a pergunta ganha um tipo (caixa, número com unidade, opções). Até lá, o valor vai na observação.
- **Plano sem item.** A OS preventiva que só traz o plano usa o checklist do plano sem item, como o ciclo já faz.

## 10. Como ficou a implementação

O que saiu diferente do plano, ou que o plano não detalhava:

- **Código novo:** `api/src/dominio/checklist-inspecao.ts` (leitura e gravação do checklist, busca do checklist de uma OS pela chave plano + item); na web, `lib/checklist-inspecao.ts`, `ChecklistDeInspecao` (encerramento), `ChecklistDaOsCard` (cartão do detalhe), `ChecklistDaExecucao` (histórico da execução) e `EditorDoChecklist` (editor do ciclo).
- **`GET /preventivas`** traz só `total_perguntas` em cada plano; o `checklist` (`[{id, texto}]`) vem no detalhe (`GET /preventivas/{id}`, `PUT`, `GET /os/{id}/preventiva`). O editor do ciclo busca o detalhe ao abrir.
- **`PUT /preventivas/{id}`:** o `checklist` é a lista inteira, na ordem. Quem tem `id` mantém a pergunta, quem não tem é criada e quem ficou de fora é removida. Um `id` que não é do plano é recusado com `422` `pergunta_invalida`.
- **Pergunta sem resposta:** `marcado: null` na execução é a pergunta "não respondida" (só da fila offline). Não gera alerta; só o item `marcado: false` gera.
- **Resposta a pergunta que já foi removida** é ignorada.
- **A `observacao_obrigatoria` vale também offline** (o aparelho já a exige). A `checklist_incompleto` só vale online.
- **Plano sem checklist:** o `dados_inspecao` segue como veio. O PDF ainda imprime esse formato antigo como pares de campo e valor.
- **PDF:** a fonte do PDF não tem "☑" e "☐", então a caixa sai como "[X]" (marcado), "[  ]" (não marcado) e "[?]" (não respondida).
- **Alerta `inspecao_com_pendencia`:** o texto traz a OS, o plano e o item e cada item não marcado com a observação. O alerta não leva `plano_preventiva_id` (o `CHECK` do alerta de ciclo continua só para o próximo e o vencido).
- **Encerramento:** o botão "Marcar todos" marca tudo de uma vez. "Encerrar OS" só é liberado com a observação de todo item não marcado.
- **Detalhe da OS:** o cartão aparece para o técnico e na aba Resumo da gestão; o histórico da execução (aba APRs e execuções) mostra o checklist com os itens não marcados em destaque.
- **Carga de demonstração:** o plano 10573/10603 (retificador) tem 6 perguntas, a partir do exemplo da OS 4019821, e o plano das válvulas tem 4, com um item não marcado e o alerta.
- **Testes:** `api/test/checklist-inspecao.test.ts` e os ajustes de `gamificacao-pontuacao`, `gamificacao-conquistas`, `painel` e `demo`.

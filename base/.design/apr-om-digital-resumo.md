# APR e OS digitais — Resumo

> Versão curta de [apr-om-digital.md](apr-om-digital.md). Para tabelas, rotas e diagramas, consulte o documento completo.

## Problema

A OS é impressa, preenchida à mão em campo com a APR grampeada e depois escaneada e anexada no SAP pelo Iago. São cerca de **390 OS por mês** (variando de ~200 a 409), com **4 a 5 pessoas** envolvidas. Os documentos voltam sujos ou ilegíveis, a auditoria é difícil e **nada impede que um serviço comece sem a APR**.

## Solução

App **Android nativo que funciona offline** para o técnico e **painel web** para supervisores e analistas.

1. O analista **importa na web a planilha exportada do SAP**. Também é possível criar uma OS manualmente.
2. Com sinal, o técnico **sincroniza** e baixa as OS da equipe.
3. Em campo, sem precisar de sinal, preenche a **APR em sequência**. Uma única APR cobre várias OS do mesmo local no mesmo dia.
4. Se a APR passar, ele **executa** a OS e registra fotos, descrição, horários e assinatura.
5. Quando volta o sinal, o servidor **gera o PDF** e o painel web é atualizado.
6. A web **exporta uma planilha das OS encerradas** para o Iago dar baixa no SAP. O sistema nunca escreve no SAP.

## Regras principais

- **Sem APR aprovada, a execução não começa.** Uma APR bloqueada não pode ser alterada; para tentar de novo, é preciso uma APR nova.
- **O bloqueio é definido por item:** cada pergunta é **eliminatória** (bloqueia na hora) ou **alerta** (só fica registrada). Por exemplo, "Existe impedimento?" bloqueia no Sim; "iluminação auxiliar" é só alerta.
- **Quando bloqueia ou alguém interrompe a execução,** observação e foto são obrigatórias, a OS fica **Bloqueada** e o supervisor recebe um aviso no painel e por e-mail. Ele pode **reprogramar** a OS ou abrir uma **OS de apoio** para outra equipe.
- **Offline total:** o login funciona sem sinal por até 7 dias e todas as ações de campo ficam numa fila. Reenviar a fila nunca duplica registros.
- **Conflito:** o campo é dono da execução e a web é dona do planejamento. Nada feito em campo é descartado; em caso de conflito, o supervisor recebe um alerta.
- **Modelos de APR versionados:** a segurança do trabalho edita na web e cada publicação cria uma versão nova. APRs antigas continuam apontando para a versão que usaram.

## Status da OS

`liberada` → `em_execucao` → `encerrada`, ou `bloqueada` → (reprogramada) → `liberada`.

## Stack

React Native (Expo) com SQLite no celular · React na web · Supabase (Postgres, Auth, Storage, Edge Functions).

## Partes do trabalho (em ordem)

| # | Parte | Entrega |
|---|---|---|
| 1 | Usuário e Equipe | perfis, equipes, login offline |
| 2 | Importação SAP | OS a partir da planilha ou criada manualmente |
| 3 | Modelo de APR | os 8 modelos de `base/` cadastrados (o editor fica por último) |
| 4 | Sincronização | baixar os dados da equipe e enviar a fila offline — **maior risco de prazo** |
| 5 | APR | checklist sequencial com bloqueio |
| 6 | Execução | fotos, assinatura, interrupção e PDF |
| 7 | Impedimento | alerta, reprogramação e OS de apoio |
| 8 | Painel | quadro, histórico, criticidade, indicadores e exportação SAP |

## Fora da demo

API do SAP (não existe) · MFA/SSO · vínculo entre aparelho e usuário · push notification · iOS.

## A confirmar com Iago e Mario

1. Quais itens da APR são eliminatórios. A proposta é: itens de verificação 1 a 9 bloqueiam no Não, e "impedimento" bloqueia no Sim.
2. As colunas da planilha exportada do SAP, que dependem do relatório que o Iago vai enviar.
3. A lista de locais críticos. A proposta é: PR, ERP, ERS, autorizações, Vale e Suzano.

## Sucesso

Na demo, o caminho importar → sincronizar → APR → executar → PDF funciona num Android em modo avião. Num piloto, 100% das OS de uma equipe são encerradas com APR feita antes da execução e sem nenhum papel.

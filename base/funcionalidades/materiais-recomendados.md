# Materiais recomendados — plano de 15/10/2026

> Plano para trocar a conferência de materiais da APR, que exige foto do item obrigatório e bloqueia a APR sem ela, por uma lista de materiais recomendados, só para consulta.
>
> **Situação:** implementado em 15/10/2026 (api, web, campo de treino e carga de demonstração). A conferência com foto e o bloqueio por material saíram do código.
>
> Fontes: a conversa de 15/10/2026 e a seção 4 do [funcionalidades.md](funcionalidades.md). O texto abaixo descreve o plano e o que foi feito; os arquivos `apr-materiais.ts`, `apr-materiais.test.ts`, `ConferenciaDeMateriais.tsx` e `MateriaisDaApr.tsx` foram removidos.

## Resumo

- **A obrigatoriedade sai.** O selo "Obrigatório", a foto do item e o bloqueio da APR por material deixam de existir.
- **A conferência sai da APR.** O técnico não responde mais "Levei" ou "Não levei".
- **A lista continua, como recomendação.** O detalhe da OS e a revisão da APR mostram os "Materiais recomendados" do serviço, só para consulta.
- **O catálogo de serviço continua igual.** O admin monta a lista de cada serviço, com a quantidade, como hoje, só sem a caixa "Obrigatório".
- **O histórico não precisa ser preservado.** O ambiente é de desenvolvimento, então as conferências já gravadas são apagadas junto com a tabela.

---

## 1. Por que mudou

- **A conferência nasceu com a atribuição automática do modelo.** Quando o serviço da OS definia a APR, dava para saber de antemão o que o técnico precisava levar.
- **Hoje o técnico escolhe o modelo** porque a situação no local varia (seção 5 do [funcionalidades.md](funcionalidades.md)). O mesmo vale para as ferramentas: um item útil na maioria dos casos pode não servir naquele.
- **Exigir a foto barraria o serviço sem ganho de segurança.** O técnico ficaria impedido de trabalhar por não levar uma ferramenta de que não precisava.
- **Uma resposta que ninguém confere vira clique automático.** Por isso a conferência sem foto também sai, e não só o bloqueio.

## 2. Como fica

- **Admin.** No editor do serviço (Catálogo › Serviços), a lista de cada serviço perde a caixa "Obrigatório". O resto continua igual: material, ferramenta ou EPI, e a quantidade.
- **Detalhe da OS.** O cartão "Materiais e ferramentas" passa a se chamar "Materiais recomendados" e perde o selo e o aviso de que o item exige foto.
- **APR.** A revisão mostra o cartão "Materiais recomendados", só para leitura, como lembrete antes de validar. Ele não pede resposta e não muda o "Concluir e validar".
- **Bloqueio.** A APR só bloqueia por item eliminatório reprovado, como era antes da conferência.
- **E-mail e alerta de bloqueio.** Deixam de listar os materiais sem comprovação.
- **Troca do modelo da APR.** Não muda nada, porque a lista é do serviço da OS.

## 3. O que muda no código

### 3.1 Banco

Uma migração nova (a próxima numeração, sem alterar as já geradas):

- remove a tabela `apr_material`;
- remove a coluna `atividade_material.obrigatorio`.

### 3.2 API

- **`POST /aprs/avaliar` e o evento `apr_concluida`:** deixam de aceitar `materiais`. A resposta perde o `materiais_faltando`.
- **Erros que saem:** `material_invalido`, `material_repetido`, `foto_sem_material` e o `arquivo_ausente` da foto do material.
- **`PUT /catalogo/servicos/{codigo}`:** deixa de aceitar `obrigatorio`. A auditoria `atividade.materiais` continua, sem esse campo.
- **`409 material_em_uso`:** sai, porque nenhuma APR guarda mais o material. O material pode ser excluído quando não estiver na lista de nenhum serviço.
- **Leitura da foto (`GET /arquivos/{id}/url`):** perde o caso da foto do material.
- **`POST /sync/pull`:** o `atividades[].materiais` perde o `obrigatorio`.
- **Sai:** [`apr-materiais.ts`](api/src/dominio/apr-materiais.ts) e o teste [`apr-materiais.test.ts`](api/test/apr-materiais.test.ts). Os casos de material em [`eventos.test.ts`](api/test/eventos.test.ts) e [`modelos-apr.test.ts`](api/test/modelos-apr.test.ts) são revistos.
- **A conferir:** `catalogo.ts`, `eventos-apr.ts`, `rotas/arquivos.ts`, `rotas/modelos-apr.ts` e `sap-simulado.ts`, que hoje citam a conferência ou o `obrigatorio`.

### 3.3 Web

- **Sai:** [`ConferenciaDeMateriais.tsx`](web/src/components/app/checklist/ConferenciaDeMateriais.tsx) e [`MateriaisDaApr.tsx`](web/src/components/ui/MateriaisDaApr.tsx) (o histórico da conferência no detalhe e no alerta).
- **[`RevisaoApr.tsx`](web/src/components/app/checklist/RevisaoApr.tsx):** troca a conferência pelo cartão "Materiais recomendados", só para leitura.
- **[`MateriaisCard.tsx`](web/src/components/app/detalhe/MateriaisCard.tsx):** novo título, sem selo e sem aviso.
- **[`EditorDoServico.tsx`](web/src/components/web/catalogo/EditorDoServico.tsx) e [`ListaDoServico.tsx`](web/src/components/web/catalogo/ListaDoServico.tsx):** sem a caixa "Obrigatório".
- **[`ChecklistScreen.tsx`](web/src/components/app/checklist/ChecklistScreen.tsx) e [`lib/apr.ts`](web/src/lib/apr.ts):** o envio da APR perde `materiais`, e a troca do modelo deixa de guardar a conferência.
- **Tela de impedimento e alerta de bloqueio:** sem os materiais.

### 3.4 Campo de treino

- A API fictícia ([`api-ficticia.ts`](web/src/treino/api-ficticia.ts)) segue a mesma regra: sem conferência e sem bloqueio por material.
- A "Vestimenta antichama" da OS guiada continua na lista, como recomendação.
- O passo "Revise e valide" do tutorial deixa de explicar a conferência.
- [`verificar-treino.mts`](web/scripts/verificar-treino.mts) e [`testar-fluxo-apr.mts`](web/scripts/testar-fluxo-apr.mts) são ajustados.

### 3.5 Carga de demonstração

- O detector de gases e o respirador deixam de ser obrigatórios nas listas fictícias ([`catalogo-demo.ts`](api/src/db/seed/catalogo-demo.ts)).
- As APRs da demonstração ([`demo.ts`](api/src/db/seed/demo.ts)) deixam de fazer a conferência.
- A OS "Aferição de manômetro padrão", hoje pendente por material sem comprovação, vira liberada.

## 4. Documentação

- **[funcionalidades.md](funcionalidades.md):** a seção 4 encolhe para um parágrafo que aponta para este arquivo; o resumo e a seção 3 deixam de falar em conferência.
- **[api/README.md](api/README.md):** já não citava a conferência (seção 7.2 do funcionalidades.md); confere-se que nada sobrou.
- **[gameficacao.md](gameficacao.md):** nada muda. A pontuação nunca olhou a conferência.
- **Questão 65** ([pontos-a-validar.md](base/.design/pontos-a-validar.md)): a lista real da ES Gás continua útil, agora como recomendação, e deixa de travar o bloqueio.

## 5. Ordem de implementação

1. Migração e `api`, com os testes.
2. Web: APR, detalhe da OS e catálogo.
3. Campo de treino e scripts de conferência.
4. Carga de demonstração.
5. Documentação.

## 6. O que foi feito

- **Banco:** migração `0024_materiais_recomendados` (remove `apr_material` e `atividade_material.obrigatorio`).
- **API:** sem `materiais` no `POST /aprs/avaliar` e no `apr_concluida` (quem ainda manda o campo, como um aparelho antigo, não é recusado: ele é ignorado), sem `materiais_faltando`, sem `obrigatorio` no catálogo e no snapshot, sem o caso da foto do material em `GET /arquivos/{id}/url`, e o `409 material_em_uso` só vale para o material que está na lista de algum serviço. O e-mail e o alerta de bloqueio listam só os itens reprovados. O detalhe da OS não traz mais `materiais` nas APRs. A suíte da `api` passa (607 testes), com um caso novo em `eventos.test.ts` para o campo antigo.
- **Web:** novo [`MateriaisRecomendados.tsx`](web/src/components/app/checklist/MateriaisRecomendados.tsx) na revisão; cartão "Materiais recomendados" no detalhe da OS; editor e lista do serviço sem "Obrigatório"; telas de impedimento, histórico e alerta sem os materiais; rascunho da APR sem `materiais` (o que ficou salvo no navegador é ignorado); estilos da conferência removidos.
- **Campo de treino:** a API fictícia, os dados e o passo "Revise e valide" seguem a mesma regra; a "Vestimenta antichama" continua na lista da OS guiada. `verificar-treino.mts` confere que não há conferência nem bloqueio por material (21 verificações passam); `testar-fluxo-apr.mts` e `testar-troca-de-modelo.mts` foram ajustados.
- **Demonstração:** nenhum item obrigatório, APRs sem conferência, e a OS "Aferição de manômetro padrão" ficou liberada.

## 7. O que ficou de fora

- **Estoque, saldo e devolução.** A ideia inicial era um controle de empréstimo, com o saldo de cada equipamento. Foi descartada: contar unidades, quem retirou e a devolução é trabalho do SAP e do almoxarifado, não do SYNQ OS.
- **Pesquisar e levar um material fora da lista**, e o **cadastro de cada unidade** (patrimônio, série, validade da calibração).
- **Os materiais no PDF da OS.**

## 8. Pontos em aberto

- Nenhum. Se a operação pedir de novo um item indispensável, ele volta como item do checklist da APR do modelo, que é onde a Segurança do Trabalho define o que bloqueia.

## 9. Depois deste plano (19/10/2026)

A lista deixou de ser só do admin: qualquer funcionário sugere uma lista ou contesta a recomendada, e o supervisor da equipe que mais faz o serviço decide. Veja [sugestao-de-materiais.md](sugestao-de-materiais.md).

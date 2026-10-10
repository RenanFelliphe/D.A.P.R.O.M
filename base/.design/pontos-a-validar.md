# Pontos a validar — APR e OS digitais

> Questões que a [especificação](apr-om-digital.md) e o [fluxo](fluxo-solucao.md) ainda não respondem. Cada uma traz uma recomendação para não travar o desenvolvimento: se ninguém discordar, ela vale.

**Impacto**
- 🔴 **Schema**: muda tabelas ou o contrato de sincronização. Decidir antes de travar o schema (dias 1–2).
- 🟡 **MVP**: muda uma tela ou regra da demo. Decidir antes de implementar a fatia.
- 🟢 **Depois**: não afeta a demo.

**Quem decide**: **Time** (nós) ou **Iago/Mario** (operação e segurança do trabalho).

## Resumo

| # | Questão | Impacto | Quem decide |
|---|---|---|---|
| 1 | APR bloqueada bloqueia todas as OS cobertas? | 🔴 | Iago/Mario |
| 2 | Interrupção numa OS para as demais OS da mesma APR? | 🔴 | Iago/Mario |
| 3 | Uma OS pode exigir mais de um modelo de APR? | 🔴 | Iago/Mario |
| 4 | Pull por cursor ou snapshot completo no MVP? | 🔴 | Time |
| 5 | Como uma OS cancelada no SAP sai do sistema? | 🔴 | Iago |
| 6 | Como desfazer uma execução iniciada por engano? | 🔴 | Time + Iago |
| 7 | Execução iniciada e nunca encerrada | 🟡 | Time |
| 8 | Validade da APR: dia do calendário ou janela de horas? | 🟡 | Iago/Mario |
| 9 | Resposta "NA" em item eliminatório | 🟡 | Mario |
| 10 | Quem pode ser encarregado e executor? | 🟡 | Iago/Mario |
| 11 | Quem assina o encerramento numa dupla? | 🟡 | Iago |
| 12 | OS manual e OS de apoio: como entram no SAP? | 🟡 | Iago |
| 13 | Exportar também OS bloqueadas para o SAP? | 🟡 | Iago |
| 14 | Reimportação muda a data de uma OS já reprogramada | 🟡 | Time |
| 15 | PDF por OS ou por APR? | 🟡 | Iago |
| 16 | Limite e compressão de fotos | 🟡 | Time |
| 17 | Relógio do aparelho errado | 🟢 | Time |
| 18 | Esqueci a senha / troca de senha com login offline | 🟢 | Time |
| 19 | Local manual que depois chega do SAP com outro código | 🟢 | Time |
| 20 | Quais alertas também vão por e-mail? | 🟢 | Iago |
| 21 | Analista pode reprogramar? | 🟢 | Iago |

## Questões

### 1. APR bloqueada bloqueia todas as OS cobertas? 🔴

**Contexto:** uma APR cobre várias OS do mesmo local, modelo e dia. A especificação foi corrigida para que o bloqueio leve **todas** as OS cobertas a `bloqueada`, com a tabela `apr_os` registrando quais são.

**Opções:**
- (a) Bloqueia todas.
- (b) O técnico escolhe quais OS o impedimento afeta.

**Recomendação:** (a). O impedimento é do local (rede sem bloqueio, caixa alagada), então afeta todas. É a regra já adotada; falta só confirmar.

### 2. Interrupção numa OS para as demais OS da mesma APR? 🔴

**Contexto:** a APR foi aprovada para 3 OS. Na primeira aparece um risco e o técnico interrompe. A especificação não diz se as outras 2 continuam liberadas para execução com a mesma APR.

**Opções:**
- (a) Só a OS interrompida fica `bloqueada`; as outras seguem.
- (b) A interrupção invalida a APR e bloqueia todas as OS cobertas ainda não encerradas.
- (c) O técnico escolhe.

**Recomendação:** (b). Se surgiu risco no local, a análise de risco do dia deixou de valer. Isso exige um campo de invalidação na `apr` ou uma regra derivada ("APR com execução interrompida não cobre novas execuções").

### 3. Uma OS pode exigir mais de um modelo de APR? 🔴

**Contexto:** `os.modelo_apr_codigo` guarda um modelo só. Na prática uma manutenção pode exigir a APR 03 (operação/manutenção) e também a APR 06 (altura e espaço confinado).

**Opções:**
- (a) Um modelo por OS. Se precisar de outro, a web troca o modelo.
- (b) Lista de modelos por OS. A execução só libera com todas as APRs aprovadas.

**Recomendação:** (a) no MVP, mas confirmar com o Mario se o caso existe. Se existir, (b) muda `os`, `apr_os` e a regra de início da execução, e precisa ser decidido antes do schema.

### 4. Pull por cursor ou snapshot completo no MVP? 🔴

**Contexto:** a especificação define pull incremental por cursor (`os.atualizada_em`). O snapshot completo (baixar tudo da equipe a cada sync) é mais simples e suficiente para o volume atual (~390 OS por mês somando todas as equipes).

**Opções:**
- (a) Cursor desde o início.
- (b) Snapshot no MVP e cursor depois. O contrato `POST /sync/pull` mantém o `cursor?` opcional, então a troca não quebra o app.

**Recomendação:** (b). Menos risco no maior risco de prazo do projeto. O cuidado é que o snapshot não pode apagar do aparelho uma OS que ainda tem evento local pendente.

### 5. Como uma OS cancelada no SAP sai do sistema? 🔴

**Contexto:** a importação só cria e atualiza. Se o SAP cancelar ou encerrar uma ordem por outro caminho, ela continua `liberada` no app e no painel para sempre.

**Opções:**
- (a) A planilha traz o status SAP, e uma ordem cancelada vira um novo status `cancelada`.
- (b) A web ganha a ação "Cancelar OS" (com justificativa).
- (c) Ordem ausente da nova importação é considerada cancelada.

**Recomendação:** (b) no MVP e (a) quando o export do Iago mostrar a coluna de status. (c) é perigoso, porque uma importação parcial cancelaria ordens válidas. Qualquer opção acrescenta `cancelada` ao ciclo de status.

### 6. Como desfazer uma execução iniciada por engano? 🔴

**Contexto:** o técnico toca "Iniciar execução" na OS errada. A especificação não tem cancelamento: a OS fica `em_execucao` e o único caminho é interromper, o que gera alerta de bloqueio falso.

**Opções:**
- (a) Novo evento `execucao_cancelada`, permitido só sem fotos e em até N minutos; a OS volta a `liberada`.
- (b) Sem desfazer; interromper com o motivo "iniciada por engano".

**Recomendação:** (a). É um evento a mais no contrato de sync, por isso é 🔴. Se ficar para depois, (b) funciona na demo.

### 7. Execução iniciada e nunca encerrada 🟡

**Contexto:** o técnico esquece de encerrar ou o aparelho quebra. A OS fica `em_execucao` indefinidamente.

**Recomendação:** o painel destaca execuções abertas há mais de 12 h, e o supervisor resolve com o técnico. Não criar encerramento automático, porque ele forjaria um registro de campo.

### 8. Validade da APR: dia do calendário ou janela de horas? 🟡

**Contexto:** a APR vale "no mesmo dia". Um serviço noturno que começa às 22h e termina às 2h cruza a meia-noite, e a segunda OS da madrugada exigiria uma APR nova.

**Opções:**
- (a) Dia do calendário.
- (b) Janela fixa (por exemplo, 12 h desde a conclusão).
- (c) Turno.

**Recomendação:** (b), mas é decisão da segurança do trabalho.

### 9. Resposta "NA" em item eliminatório 🟡

**Contexto:** a APR 04 tem coluna NA (`permite_na`). A especificação não diz se NA num item eliminatório conta como bloqueio, passa ou exige justificativa.

**Recomendação:** NA passa, mas exige observação, e só é oferecido nos itens marcados com `permite_na`. Confirmar com o Mario.

### 10. Quem pode ser encarregado e executor? 🟡

**Contexto:** o encarregado da APR é escolhido no app entre os usuários da equipe. Não está definido:
- se qualquer técnico pode ser encarregado ou só alguns;
- se um usuário de outra equipe (apoio, terceirizado) pode participar;
- se o técnico logado precisa ser um dos participantes.

**Recomendação:**
- Qualquer usuário ativo da equipe pode ser encarregado.
- O técnico logado é obrigatoriamente participante.
- Participantes de fora da equipe ficam para depois. Para entrar, eles teriam de ser baixados no pull.

### 11. Quem assina o encerramento numa dupla? 🟡

**Contexto:** `execucao.assinatura_path` guarda uma assinatura só, a do executor. Na APR todos os participantes assinam. Não está claro se o encerramento exige a assinatura dos dois nem se o cliente assina (conversão de clientes, APR 05).

**Recomendação:** no MVP, uma assinatura (a do executor). Perguntar ao Iago se o papel atual tem assinatura do cliente. Se tiver, é um campo a mais, mas não muda o fluxo.

### 12. OS manual e OS de apoio: como entram no SAP? 🟡

**Contexto:** uma OS manual não tem `numero_ordem`. Na exportação o Iago não tem onde dar baixa.

**Opções:**
- (a) A exportação inclui essas OS numa aba separada, e o Iago cria a ordem no SAP depois.
- (b) A OS manual exige que a ordem seja aberta no SAP antes, e o número é preenchido em seguida.
- (c) Ficam fora da exportação.

**Recomendação:** (a). Perguntar ao Iago qual é o procedimento hoje para corretivas urgentes.

### 13. Exportar também OS bloqueadas para o SAP? 🟡

**Contexto:** a exportação traz só as `encerrada`. Pode ser que o SAP também precise registrar o impedimento (atraso justificado), sobretudo para as preventivas.

**Recomendação:** perguntar ao Iago. Se precisar, é uma segunda aba "Impedimentos" com o motivo e a justificativa.

### 14. Reimportação muda a data de uma OS já reprogramada 🟡

**Contexto:** o supervisor reprogramou a OS para dia 20 na web. Depois o SAP reimporta a mesma ordem com a data original, dia 15. Pela Decisão-chave 8, a importação atualiza as colunas de planejamento e, com isso, desfaz a reprogramação.

**Opções:**
- (a) A importação não sobrescreve a data de uma OS com reprogramação registrada.
- (b) O SAP sempre vence.

**Recomendação:** (a), com a linha contando em `ignoradas` e o motivo "reprogramada no sistema".

### 15. PDF por OS ou por APR? 🟡

**Contexto:** com uma APR cobrindo 3 OS, cada PDF de OS repete a APR inteira. Isso é o que a especificação define, mas convém confirmar como o Iago anexa no SAP: um anexo por ordem é o esperado.

**Recomendação:** um PDF por OS, repetindo a APR. Confirmar com o Iago.

### 16. Limite e compressão de fotos 🟡

**Contexto:** fotos de câmera têm de 3 a 8 MB. Com várias fotos por OS e sincronização no 4G, o envio fica lento e o aparelho enche.

**Recomendação:**
- Comprimir no app para ~1600 px e qualidade 70% (~300 KB).
- Mínimo de 1 e máximo de 10 fotos por execução.
- Apagar do aparelho após a confirmação do envio.

### 17. Relógio do aparelho errado 🟢

**Contexto:** `ocorrido_em` usa o relógio do aparelho, que pode estar errado ou ter sido alterado. O PDF e a auditoria mostram esse horário.

**Recomendação:** guardar os dois horários (já existe `recebido_em`), e o painel sinaliza quando `ocorrido_em` for posterior a `recebido_em` ou anterior à data de download da OS.

### 18. Esqueci a senha / troca de senha com login offline 🟢

**Contexto:** a senha é conferida localmente por 7 dias. Se ela for trocada na web, o aparelho continua aceitando a antiga até o próximo login online. Esquecer a senha em campo, sem sinal, impede o trabalho.

**Recomendação:** aceitar no MVP. No próximo sync com sinal, o app invalida a senha antiga. O reset de senha é sempre online, pela web.

### 19. Local manual que depois chega do SAP com outro código 🟢

**Contexto:** o analista cadastra um local à mão para uma corretiva urgente. Depois o mesmo local chega pelo SAP com outro código e vira um segundo registro, o que divide o histórico.

**Recomendação:** aceitar a duplicidade no MVP. Mais tarde, criar uma ação "mesclar locais" na web.

### 20. Quais alertas também vão por e-mail? 🟢

**Contexto:** a especificação define e-mail só para `bloqueio`. Os alertas `conflito_planejamento`, `execucao_duplicada` e `apoio_encerrado` ficam só no painel.

**Recomendação:** manter assim e perguntar ao Iago se o `apoio_encerrado` merece e-mail, já que é ele que destrava a reprogramação.

### 21. Analista pode reprogramar? 🟢

**Contexto:** pelos perfis definidos, só o supervisor reprograma e cria OS de apoio, e só na própria equipe. O analista vê tudo, mas não age. Se o supervisor estiver de férias, ninguém destrava as OS bloqueadas.

**Recomendação:** o analista pode reprogramar e criar OS de apoio para qualquer equipe.

## Já decidido nesta revisão

Registrado na [especificação](apr-om-digital.md) como correção ou suposição adotada:

- **Vínculo APR ↔ OS:** a tabela `apr_os` registra as OS que cada APR cobre, e o evento `apr_concluida` leva a lista `os_ids`.
- **Equipe sem supervisor:** o alerta vai para cada analista ativo.
- **Cadastro de locais:** `POST /locais`, usado na criação de OS manual.
- **Encarregado ≠ supervisor:** a função de campo na APR passa a se chamar `encarregado`. O `supervisor` é só o perfil de gestão na web.
- **Fim da OS de apoio:** encerrar a OS de apoio gera o alerta `apoio_encerrado`, e a OS original continua `bloqueada` até ser reprogramada manualmente.

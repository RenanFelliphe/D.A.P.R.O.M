# Pontos a validar — APR e OS digitais

> Questões que a [especificação](especificacao.md) ainda não responde. Cada uma traz uma recomendação para não travar o desenvolvimento: se ninguém discordar, ela vale.
>
> **Atualizado em 10/10/2026**, depois da Reunião 2 ([transcrição](../reunioes/Transcrição_Reuniao2.docx)) e das decisões do time ([correcoes-reuniao-2-resumo.md](correcoes-reuniao-2-resumo.md)).
>
> **Todas as questões abertas seguem com a recomendação adotada** na [especificação](especificacao.md) (seção "Suposições adotadas"), para a implementação não esperar. Elas continuam listadas aqui para a confirmação com o Iago, o Mario e o time; se a resposta for outra, o ajuste é restrito ao que a especificação cita. As questões 22–46 estavam só no [contexto da sessão](../contexto/contexto-sessao-2026-10-10.md) e entram aqui; as 47–54 são novas.

**Impacto**
- 🔴 **Schema**: muda tabelas ou o contrato de sincronização. Decidir antes de travar o schema.
- 🟡 **MVP**: muda uma tela ou regra da demo. Decidir antes de implementar a fatia.
- 🟢 **Depois**: não afeta a demo.

**Quem decide**: **Time** (nós) ou **Iago/Mario** (operação e segurança do trabalho).

## Situação em números

| Situação | Questões |
|---|---|
| Respondidas ou sem objeto | 1, 2, 11, 15, 23, 30, 31, 32, 34, 37 (protótipo), 42 |
| Adotadas com a recomendação, a confirmar | todas as demais (seção 1), mais 45 e 51 (seção 6) |

## 1. Adotadas com a recomendação, a confirmar

| # | Questão | Impacto | Quem decide | O que mudou |
|---|---|---|---|---|
| 3 | Uma OS pode exigir mais de um modelo de APR? | 🔴 | Iago/Mario | continua aberta; o modelo agora vem do tipo de atividade |
| 4 | Pull por cursor ou snapshot completo no MVP? | 🔴 | Time | passa a carregar o histórico de APRs da OS pendente |
| 5 | Como uma OS cancelada no SAP sai do sistema? | 🔴 | Iago | com a API simulada, o status pode vir da API |
| 6 | Como desfazer uma execução iniciada por engano? | 🔴 | Time + Iago | continua; existe pausar, mas não cancelar |
| 24 | Técnico sem e-mail e o Supabase Auth | 🔴 | Time | o Supabase Auth foi confirmado, então a questão vale |
| 29 | A OS só executa depois de liberada no SAP | 🔴 | Iago | com a API, o status vem de lá |
| 43 | Contrato da API real do SAP | 🔴 | Iago | **reformulada**: a API existe; falta o contrato |
| 7 | Execução iniciada e nunca encerrada | 🟡 | Time | agora há cronômetro e atividades de vários dias |
| 8 | Validade da APR | 🟡 | Iago/Mario | **reformulada**: por sessão de execução |
| 9 | Resposta "NA" em item eliminatório | 🟡 | Mario | igual |
| 10 | Quem pode ser participante da APR | 🟡 | Iago/Mario | **reduzida**: o líder é quem preenche; restam os de fora da equipe |
| 12 | OS manual e de apoio: como entram no SAP | 🟡 | Iago | igual |
| 13 | Exportar também as OS pendentes | 🟡 | Iago | "bloqueada" virou "pendente" |
| 14 | Reimportação desfaz a reprogramação | 🟡 | Time | reprogramar agora é opcional |
| 16 | Limite e compressão de fotos | 🟡 | Time | igual |
| 22 | OS de apoio para outra equipe | 🟡 | Time | igual |
| 25 | PDF gerado fora da sincronização | 🟡 | Time | o PDF passa a ser do back-end Node |
| 27 | Justificar a interrupção à pessoa solicitante | 🟡 | Iago | **rebaixada de 🔴**: o solicitante costuma ficar em branco |
| 28 | Contatos de emergência e observações gerais na APR | 🟡 | Mario | igual |
| 33 | APR 09 (almoxarifado) é do módulo MM | 🟡 | Iago | igual |
| 35 | Celular em área classificada | 🟡 | Mario | igual |
| 36 | Terceiros usam o app? | 🟡 | Iago | igual |
| 39 | Atraso conta do início ou do fim programado | 🟡 | Time | igual |
| 40 | Colunas da planilha de saída para a baixa no SAP | 🟡 | Time + Iago | ligada à 51 |
| 44 | Painel pessoal do funcionário | 🟡 | Time | protótipo já tem Perfil e histórico |
| 46 | Evidência em PDF além da foto | 🟡 | Time | evidência é foto **ou texto**, por item |
| **47** | PDF tem 3 vagas de executante; a APR pode ter 10 pessoas | 🟡 | Iago | nova |
| **48** | Preventiva pendente do ciclo anterior × OS nova do mês | 🟡 | Iago | nova |
| **49** | Ciência do supervisor: quando e onde assina | 🟡 | Iago | nova |
| **50** | Quais itens aceitam justificativa em texto no lugar de foto | 🟡 | Mario | nova |
| **52** | Tabela real de tipo de atividade → modelo de APR | 🟡 | Iago | nova |
| **53** | Pausa exige motivo? | 🟡 | Time + Iago | nova |
| **54** | API simulada do SAP: contrato e base fictícia | 🟡 | Time | nova |
| 17 | Relógio do aparelho errado | 🟢 | Time | agora afeta também o cronômetro |
| 18 | Esqueci a senha / senha offline | 🟢 | Time | o reset passa a ser do Supabase Auth |
| 19 | Local manual que depois chega do SAP | 🟢 | Time | igual |
| 20 | Quais alertas vão por e-mail | 🟢 | Iago | o envio passa a ser do back-end Node |
| 21 | Analista pode reprogramar | 🟢 | Iago | menos urgente: reprogramar é opcional |
| 26 | Volume: ~390 ou ~900 OS por mês | 🟢 | Iago | igual |
| 38 | Assinatura desenhada vale para auditoria | 🟢 | Iago | o Iago perguntou por "rubrica ou assinatura digital" |
| 41 | Aparelhos do piloto | 🟢 | Time | igual |

## 2. Detalhe das adotadas com impacto no schema (🔴)

### 3. Uma OS pode exigir mais de um modelo de APR?

**Contexto:** hoje o modelo vem do tipo de atividade da OS (questão 52), um por OS. Na prática uma manutenção pode exigir a APR 03 e também a APR 06 (altura e espaço confinado). A reunião disse que "cada tipo de atividade tem um tipo de APR" (37:22), sem tratar o caso de dois.
**Opções:** (a) um modelo por OS; (b) lista de modelos por OS, e a execução só libera com todas aprovadas.
**Recomendação:** (a) no MVP. Confirmar com o Mario se o caso existe. Se existir, (b) muda `os` e a regra de início da execução.

### 4. Pull por cursor ou snapshot completo no MVP?

**Contexto:** o volume atual comporta o snapshot, e o contrato mantém `cursor?` opcional. Novo: o snapshot precisa levar também o **histórico de APRs** das OS pendentes e não pode apagar do aparelho uma OS com evento local pendente.
**Recomendação:** snapshot no MVP, cursor depois.

### 5. Como uma OS cancelada no SAP sai do sistema?

**Contexto:** a leitura só cria e atualiza. Uma ordem cancelada no SAP continuaria liberada no app.
**Opções:** (a) o status do SAP vem na API (ou na planilha) e vira `cancelada`; (b) ação "Cancelar OS" na web, com justificativa; (c) ordem ausente é considerada cancelada.
**Recomendação:** (a), já que a API simulada pode devolver o status; (b) como plano B. (c) é perigoso: uma leitura parcial cancelaria ordens válidas.

### 6. Como desfazer uma execução iniciada por engano?

**Contexto:** não há cancelamento. Agora existem Pausar e "Interromper por risco", mas nenhum dos dois serve para o toque na OS errada.
**Opções:** (a) evento `execucao_cancelada`, só sem fotos e em até N minutos; (b) sem desfazer, interrompendo com o motivo "iniciada por engano".
**Recomendação:** (a). Para a demo, (b) funciona.

### 24. Técnico sem e-mail e o Supabase Auth

**Contexto:** o Supabase Auth exige e-mail e a decisão de usá-lo está tomada. `POST /usuarios` não tem senha.
**Recomendação:** login por matrícula, com e-mail interno gerado e senha inicial definida pelo administrador, trocada no 1º acesso.

### 29. A OS só executa depois de liberada no SAP

**Contexto:** na Reunião 1 a OS só podia ser executada depois de liberada pelo analista no SAP. A importação marca tudo como `liberada`. O Iago citou o status "liberada e impressa" (55:44).
**Recomendação:** ler o status do SAP e só levar ao aplicativo as OS liberadas; as demais ficam de fora com o motivo registrado.

### 43. Contrato da API real do SAP

**Contexto:** o time decidiu simular a API com dados fictícios, no mesmo contrato da real, e trocar só o endereço e as credenciais. Falta o contrato: campos, autenticação, paginação, e **quem chama quem** (nosso back-end consulta, ou o SAP envia). Na Reunião 1 a API não existia; na 2 o time disse que existe, e o Iago não contrariou.
**Recomendação:** o back-end consulta a API, com um adaptador. Pedir ao Iago o contrato e a planilha de 2025 que ele prometeu (45:21).

## 3. Detalhe das adotadas com impacto na demo (🟡)

### 7. Execução iniciada e nunca encerrada

**Contexto:** o técnico esquece de encerrar ou o aparelho quebra. Agora também há atividades de vários dias, com troca de executor (15:54–16:13), e cronômetro.
**Recomendação:** o técnico pausa ao fim do expediente; o painel destaca execuções sem registro há mais de 12 h. Nada de encerramento automático, que forjaria um registro de campo.

### 8. Validade da APR

**Contexto:** "sempre que alguém chega para executar, o primeiro documento é a APR" (16:44), e as respostas são refeitas toda vez (34:40). Então a pergunta deixou de ser dia ou janela de horas.
**Recomendação:** a APR vale para uma **sessão de execução**. Pausa curta (café, almoço) não exige APR nova; retomar depois de interrupção por risco, em outro dia ou por outra pessoa exige. Confirmar com o Iago e o Mario.

### 9. Resposta "NA" em item eliminatório

**Contexto:** a APR 04 tem coluna NA. O Iago disse que as respostas são sim ou não (34:58); entre os modelos conferidos, só a APR 04 tem a coluna NA.
**Recomendação:** NA passa, mas exige observação, e só aparece nos itens com `permite_na`. Confirmar com o Mario.

### 10. Quem pode ser participante da APR

**Contexto:** já respondido: quem preenche a APR é o líder (22:22), e os participantes vêm da **equipe da OS** (DesignDoc). Falta: o técnico logado precisa ser participante? Alguém de fora da equipe (apoio, terceiro) pode participar?
**Recomendação:** o técnico logado é sempre participante; participantes de fora da equipe ficam para depois.

### 12. OS manual e OS de apoio: como entram no SAP?

**Contexto:** uma OS manual não tem `numero_ordem`; o Iago não teria onde dar baixa.
**Opções:** (a) aba separada na exportação, e o Iago cria a ordem depois; (b) a ordem é aberta no SAP antes; (c) ficam fora.
**Recomendação:** (a). Perguntar ao Iago qual é o procedimento hoje para corretivas urgentes.

### 13. Exportar também as OS pendentes?

**Contexto:** a exportação traz só as encerradas. O SAP pode precisar registrar o impedimento (atraso justificado).
**Recomendação:** perguntar ao Iago. Se precisar, uma segunda aba "Impedimentos", com o motivo e as evidências.

### 14. A reimportação desfaz a reprogramação?

**Contexto:** o supervisor reprogramou a OS para o dia 20; depois o SAP traz a data original. Reprogramar agora é opcional, mas o conflito continua possível.
**Recomendação:** a leitura não sobrescreve a data de uma OS com reprogramação registrada; a linha conta em `ignoradas` com o motivo "reprogramada no sistema".

### 16. Limite e compressão de fotos

**Recomendação:** comprimir no app para ~1600 px e qualidade 70% (~300 KB); mínimo de 1 e máximo de 10 fotos por execução; apagar do aparelho após a confirmação do envio.

### 22. OS de apoio para outra equipe

**Contexto:** o supervisor cria a OS de apoio "para outra equipe", mas o perfil dele só age na própria. O Iago elogiou o vínculo (43:17) porque a equipe que calibra não é a que resolve o problema.
**Recomendação:** permitir OS de apoio para qualquer equipe.

### 25. PDF gerado fora da sincronização

**Contexto:** o diagrama gera o PDF dentro do envio da fila, mas a especificação prevê nova tentativa automática. O PDF é gerado pelo back-end Node.
**Recomendação:** gerar de forma assíncrona (fila ou gatilho), fora da sincronização.

### 27. Justificar a interrupção à pessoa solicitante

**Contexto:** na Reunião 1 a interrupção também seria justificada ao solicitante. Na 2 o Iago disse que o campo "solicitante" costuma ficar em branco (59:12).
**Recomendação:** campo opcional na OS; o PDF mostra o solicitante quando existir. Não bloqueia nada.

### 28, 33, 35, 36, 39, 40, 44, 46 (sem mudança relevante)

| # | Recomendação |
|---|---|
| 28 | Acrescentar contatos de emergência e observações gerais ao modelo e ao PDF, se o Mario confirmar |
| 33 | Perguntar ao Iago se OS do módulo MM entram no export de manutenção; senão, a APR 09 fica sem OS |
| 35 | Registrar o risco de fagulha; o Mario diz se o aparelho precisa ser intrinsecamente seguro |
| 36 | Terceiros fora do app no MVP |
| 39 | Atraso pela data de fim programado quando existir; senão, a de início |
| 40 | Pedir ao Iago um exemplo da planilha de saída, junto com o export de entrada (ligada à 51) |
| 44 | Já existe a tela Perfil e histórico no protótipo, com as OS do próprio técnico; exige baixar também as encerradas dele no pull |
| 46 | Evidência é foto **ou texto**, por item; anexar PDF fica para depois |

### 47. O PDF tem 3 vagas de executante, mas a APR pode ter 10 pessoas (nova)

**Contexto:** o Iago disse que ninguém executa com mais de 3 (1:00:02), mas citou uma movimentação de carga com 10 pessoas na APR (22:22).
**Recomendação:** o PDF lista todos os presentes; as 3 vagas são do papel, não do sistema.

### 48. Preventiva pendente do ciclo anterior × OS nova do mês (nova)

**Contexto:** o Mario propôs fechar a OS pendente e vinculá-la à nova (13:38–13:54); o Iago disse que a ordem não deve ser encerrada, para não gerar redundância (13:01). A transcrição não deixa claro quem cedeu.
**Recomendação:** sem vínculo automático; o histórico por local e equipamento mostra as duas. Nenhum usuário fecha a OS de outro.

### 49. Ciência do supervisor: quando e onde assina (nova)

**Contexto:** o supervisor assina só para ciência de que foi executado (1:02:38).
**Recomendação:** na web, com um botão "Ciente" depois do encerramento; não segura o PDF.

### 50. Quais itens aceitam justificativa em texto no lugar de foto (nova)

**Contexto:** condição psicológica não se comprova com foto; o direito de recusa permite não executar e justificar depois (21:22–22:05). Hoje só o item 1 do protótipo é assim.
**Recomendação:** campo no item do modelo, definido pela Segurança do Trabalho.

### 52. Tabela real de tipo de atividade → modelo de APR (nova)

**Contexto:** o modelo é definido pelo tipo de atividade (1:12:15). O Iago consegue gerar a tabela no SAP, mas ela ainda não foi aprovada e os códigos vão mudar (1:10:47–1:11:30).
**Recomendação:** tabela editável no sistema (já está no protótipo, com exemplos fictícios). Uma OS com tipo de atividade sem modelo mapeado não é levada ao aplicativo e aparece na leitura como ignorada, com o motivo.

### 53. Pausa exige motivo? (nova)

**Contexto:** a pausa serve para saber, por exemplo, quanto tempo de almoço a pessoa leva (24:35–25:11).
**Recomendação:** motivo opcional, escolhido numa lista curta (almoço, descanso, outro); o tempo de pausa entra nos indicadores.

### 54. API simulada do SAP: contrato e base fictícia (nova)

**Contexto:** a API simulada nasce no back-end, com o mesmo contrato da real. A base fictícia deveria sair da planilha de OS de 2025 do Iago, mais cerca de 50 usuários fictícios; ela ainda não chegou.
**Recomendação:** começar pelo PDF de exemplo da OS 4023470 e trocar quando a planilha chegar.

## 4. Adotadas de baixo impacto (🟢)

| # | Recomendação |
|---|---|
| 17 | Guardar `ocorrido_em` e `recebido_em`; o painel sinaliza quando `ocorrido_em` for posterior ao recebimento. Vale também para o cronômetro |
| 18 | Aceitar no MVP: o app invalida a senha antiga no próximo sync com sinal. O reset é sempre online, pelo Supabase Auth |
| 19 | Aceitar a duplicidade no MVP; depois, ação "mesclar locais" |
| 20 | E-mail só para bloqueio; perguntar ao Iago se `apoio_encerrado` também merece e-mail. O envio é do back-end Node |
| 21 | O analista pode reprogramar e criar OS de apoio para qualquer equipe |
| 26 | Confirmar com o Iago se o volume é ~390 ou ~900 OS por mês |
| 38 | Confirmar com o Iago se a rubrica desenhada vale para auditoria; ele sugeriu "rubrica ou assinatura digital" (26:13) |
| 41 | Definir antes do piloto quem fornece os aparelhos e a versão mínima do Android |

## 5. Respondidas ou sem objeto

| # | Questão | Resposta | Fonte |
|---|---|---|---|
| 1 | APR bloqueada bloqueia todas as OS cobertas? | **Sem objeto:** a APR cobre uma OS só | 28:09–28:26 |
| 2 | A interrupção afeta as demais OS da APR? | **Sem objeto:** idem | 28:09–28:26 |
| 11 | Quem assina o encerramento numa dupla? | **Todos os executantes**, ao fim da atividade; o supervisor dá ciência (ver 49) | 59:25–1:00:08 |
| 15 | PDF por OS ou por APR? | **Um PDF por OS**, em 2 páginas: a APR e a OS | 53:48 |
| 23 | `os.modelo_apr_codigo` obrigatório × `equipe.modelo_apr_codigo` opcional | **O modelo vem do tipo de atividade** (ver 52), não da equipe | 1:12:15 |
| 30 | Status "Pendente" e "Imprimida" | **"Pendente"** é a OS com APR negativa; "impressa" é do SAP e não se usa | 9:06–15:30 |
| 31 | Designar a OS a um usuário, com aceite | **A OS é designada à equipe** | 40:55–41:17 |
| 32 | Não existe APR 08 | **"Só existem esses 8"**; falta só saber se a numeração pula o 08 de propósito | 1:10:05–1:10:20 |
| 34 | "Parâmetros exóticos" (respostas que não são Sim/Não) | **As respostas são sim ou não** | 34:58–35:23 |
| 37 | Dados reais num Supabase fora do ambiente corporativo | **No protótipo, só dados fictícios**; o aval da empresa fica para o piloto | 1:28–1:56 |
| 42 | "APR 1 - 1 OS" × uma APR para várias OS | **1:1**, confirmado pelos mentores | 28:09–28:26 |

## 6. Antes adiadas, agora adotadas

| # | Questão | Por quê |
|---|---|---|
| 45 | Catálogo de serviço, escaneamento de papéis antigos, intervalo das preventivas: entram no MVP? | **Adotado: ficam fora do MVP**, junto com o chatbot e a gamificação; o time escolhe depois quais ideias guardar para a apresentação final |
| 51 | O encerramento da OS atualiza o status no SAP? (o Iago descreve o status mudando para encerrada, 25:27–25:43) | **Adotado: a baixa segue por planilha**, com as colunas da aba `Encerradas`; o Iago confirma se o SAP espera outra coisa |

## 7. Já decidido

Registrado na [especificação](especificacao.md) como correção ou suposição adotada:

- **Equipe sem supervisor:** o alerta vai para cada analista ativo.
- **Cadastro de locais:** `POST /locais`, usado na criação de OS manual.
- **Fim da OS de apoio:** encerrar a OS de apoio gera o alerta `apoio_encerrado`.

Decidido em 10/10/2026 (já refletido na especificação):

- **APR 1:1 com a OS:** a tabela `apr_os` sai; o evento `apr_concluida` leva `os_id`.
- **Papel de campo:** "responsável" (líder que preenche a APR) no lugar de "encarregado".
- **Checklist:** preenchido por inteiro e validado no fim; evidência por item reprovado.
- **Retomada:** a OS com APR negativa fica pendente, e qualquer pessoa da equipe pode fazer uma APR nova, sem esperar reprogramação.
- **Fonte das OS:** API do SAP simulada, com dados fictícios, e planilha como alternativa.
- **Stack:** web em .NET, mobile em React Native, back-end em Node, banco, autenticação e armazenamento no Supabase; PDF e e-mail no back-end Node (premissa a confirmar).

## 8. Insumos prometidos na Reunião 2

| Quem | O quê | Liga com |
|---|---|---|
| Iago | Planilha do SAP com o pacote de OS de 2025 | 43, 54 |
| Iago | Documento de arquitetura (SharePoint e Power Apps) | — |
| Iago | Tabela de tipos de manutenção × APR (ainda não aprovada) | 52 |
| Mario | Tabela de equipes | 54 |
| Marcos | Novo desafio sobre APR por tipo de ordem | 52 |

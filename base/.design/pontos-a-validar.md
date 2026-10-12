# Pontos a validar — APR e OS digitais

> Questões que a [especificação](especificacao.md) ainda não responde. Cada uma traz uma recomendação para não travar o desenvolvimento: se ninguém discordar, ela vale.
>
> **Atualizado em 12/10/2026** (perfis: só `tecnico` e `admin`; questões 63 e 64), a partir do que foi atualizado em 10/10/2026, depois da Reunião 2 ([transcrição](../reunioes/Transcrição_Reuniao2.docx)) e das decisões do time ([correcoes-reuniao-2-resumo.md](correcoes-reuniao-2-resumo.md)).
>
> **Todas as questões abertas seguem com a recomendação adotada** na [especificação](especificacao.md) (seção "Suposições adotadas"), para a implementação não esperar. Elas continuam listadas aqui para a confirmação com o Iago, o Mario e o time; se a resposta for outra, o ajuste é restrito ao que a especificação cita. As questões 22–46 estavam só no [contexto da sessão](../contexto/contexto-sessao-2026-10-10.md) e entram aqui; as 47–54 são novas.

**Impacto**
- 🔴 **Schema**: muda tabelas ou o contrato de eventos de campo. Decidir antes de travar o schema.
- 🟡 **MVP**: muda uma tela ou regra da demo. Decidir antes de implementar a fatia.
- 🟢 **Depois**: não afeta a demo.

**Quem decide**: **Time** (nós) ou **Iago/Mario** (operação e segurança do trabalho).

## Situação em números

| Situação | Questões |
|---|---|
| Respondidas ou sem objeto | 1, 2, 11, 15, 19, 23, 30, 31, 32, 34, 37 (protótipo), 42 |
| Adotadas com a recomendação, a confirmar | todas as demais (seção 1), mais 45 e 51 (seção 6) |

## 1. Adotadas com a recomendação, a confirmar

| # | Questão | Impacto | Quem decide | O que mudou |
|---|---|---|---|---|
| 3 | Uma OS pode exigir mais de um modelo de APR? | 🔴 | Iago/Mario | continua aberta; o modelo agora vem do tipo de atividade |
| 4 | Pull por cursor ou snapshot completo no MVP? | 🔴 | Time | passa a carregar o histórico de APRs da OS pendente |
| 5 | Como uma OS cancelada no SAP sai do sistema? | 🔴 | Iago | com a API simulada, o status pode vir da API |
| 6 | Como desfazer uma execução iniciada por engano? | 🔴 | Time + Iago | continua; existe pausar, mas não cancelar |
| 24 | Técnico sem e-mail e o Supabase Auth | ✅ | Time | **resolvida em 11/10:** todos têm e-mail institucional e ele é o login |
| 29 | A OS só executa depois de liberada no SAP | 🔴 | Iago | com a API, o status vem de lá |
| 43 | Contrato da API real do SAP | 🔴 | Iago | **reformulada**: a API existe; falta o contrato |
| 7 | Execução iniciada e nunca encerrada | 🟡 | Time | agora há cronômetro e atividades de vários dias |
| 8 | Validade da APR | 🟡 | Iago/Mario | **reformulada**: por sessão de execução |
| 9 | Resposta "NA" em item eliminatório | 🟡 | Mario | igual |
| 10 | Quem pode ser participante da APR | 🟡 | Iago/Mario | **reduzida**: o líder é quem preenche; restam os de fora da equipe |
| 12 | OS de apoio: como entra no SAP | 🟡 | Iago | igual |
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
| **63** | Importação de OS pelo supervisor (adiada) | 🟡 | Time | nova |
| **64** | Cadastro pelo supervisor, liberação pelo admin e treinamento (decidida em 12/10/2026) | 🟡 | Time + Iago | decidida |
| 17 | Relógio do aparelho errado | 🟢 | Time | agora afeta também o cronômetro |
| 18 | Esqueci a senha / senha offline | 🟢 | Time | o reset passa a ser do Supabase Auth |
| 20 | Quais alertas vão por e-mail | 🟢 | Iago | o envio passa a ser do back-end Node |
| 21 | Supervisor e admin podem reprogramar | 🟢 | Iago | menos urgente: reprogramar é opcional; o analista deixou de existir (12/10) |
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
**Recomendação:** (a) para a OS lida do SAP, já que a API simulada pode devolver o status; (b) só para a OS de apoio, que não existe no SAP e por isso não tem status lá. (c) é perigoso: uma leitura parcial cancelaria ordens válidas.

### 6. Como desfazer uma execução iniciada por engano?

**Contexto:** não há cancelamento. Agora existem Pausar e "Interromper por risco", mas nenhum dos dois serve para o toque na OS errada.
**Opções:** (a) evento `execucao_cancelada`, só sem fotos e em até N minutos; (b) sem desfazer, interrompendo com o motivo "iniciada por engano".
**Recomendação:** (a). Para a demo, (b) funciona.

### 24. Técnico sem e-mail e o Supabase Auth

**Contexto:** o Supabase Auth exige e-mail e a decisão de usá-lo está tomada. `POST /usuarios` não tem senha.
**Decisão (11/10):** o sistema é só de funcionários, e todos têm e-mail institucional (primeiro nome e um sobrenome). O e-mail é o login e o destino dos alertas, e a conta no Supabase Auth usa o mesmo e-mail. A matrícula continua no cadastro como identificação definitiva (PDF e SAP). A senha inicial é definida pelo administrador e trocada no 1º acesso.
**A validar com a empresa:** o domínio do e-mail e se há homônimos (dois `joao.silva`), caso em que o e-mail cadastrado é o que a empresa já usa, não um gerado por regra.

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

### 12. OS de apoio: como entra no SAP?

**Contexto:** uma OS de apoio não tem `numero_ordem`; o Iago não teria onde dar baixa.
**Opções:** (a) aba separada na exportação, e o Iago cria a ordem depois; (b) a ordem é aberta no SAP antes; (c) fica fora.
**Recomendação:** (a). Perguntar ao Iago qual é o procedimento hoje para abrir no SAP uma ordem de apoio.

### 13. Exportar também as OS pendentes?

**Contexto:** a exportação traz só as encerradas. O SAP pode precisar registrar o impedimento (atraso justificado).
**Recomendação:** perguntar ao Iago. Se precisar, uma segunda aba "Impedimentos", com o motivo e as evidências.

### 14. A reimportação desfaz a reprogramação?

**Contexto:** o supervisor reprogramou a OS para o dia 20; depois o SAP traz a data original. Reprogramar agora é opcional, mas o conflito continua possível.
**Recomendação:** a leitura não sobrescreve a data de uma OS com reprogramação registrada; a linha conta em `ignoradas` com o motivo "reprogramada no sistema".

### 16. Limite e compressão de fotos

**Recomendação:** comprimir no app para ~1600 px e qualidade 70% (~300 KB); mínimo de 1 e máximo de 10 fotos por execução; apagar do aparelho após a confirmação do envio.

### 22. OS de apoio para outra equipe

**Contexto:** o supervisor cria a OS de apoio "para outra equipe", mas a gestão dele vale só para a equipe que supervisiona. O Iago elogiou o vínculo (43:17) porque a equipe que calibra não é a que resolve o problema.
**Recomendação:** permitir OS de apoio para qualquer equipe, aberta pelo supervisor da equipe da OS pendente ou pelo admin (o analista deixou de existir).

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

### 55. Quais telas de gestão o app oferece? (nova)

**Contexto:** web e app atendem todos os perfis. As telas de campo (OS da equipe, APR, execução, perfil) existem nos dois, e as de gestão (quadro, alertas, importação, indicadores, modelos, usuários) existem hoje só na web.
**Recomendação:** o app oferece as telas de campo e a lista de alertas de quem é supervisor (técnico que supervisiona) ou admin; o resto fica na web até alguém pedir. Decidir depois da demo.

### 56. Quem mais pode aplicar APR e executar OS? (nova)

**Contexto:** só existem os perfis `tecnico` e `admin`, e o supervisor não é perfil: é o técnico que a equipe aponta em `equipe.supervisor_id` (decisão de 12/10/2026). Todo supervisor é também técnico e aplica APR e executa OS, inclusive no modo offline. O admin é só gerenciamento da plataforma e não executa.
**Recomendação:** manter assim; confirmar com o Iago se algum gestor puro (sem executar) precisaria de um terceiro perfil. Se sim, seria um perfil novo, sem mudar o schema.

### 57. Formulário de inspeção das OS preventivas (nova)

**Contexto:** a página 2 da OS 4019821 (preventiva) traz um "Checklist de Inspeção Técnica" com leituras por semana (horímetro, hora da coleta, tensão de entrada, de saída e de shunt, técnico) e conformidades por componente ("Conforme / Não conforme", "Operante", "Executado / Não necessário / Aguardando parada", "Íntegra / Comprometida / Sinais de umidade"), além de "Observações Gerais / Requisições de Ação Corretiva". Vem do texto longo da OS no SAP. A corretiva 4023470 não tem nada disso. Nenhuma fatia da especificação capturava esses dados.
**Recomendação:** guardar o preenchimento em `execucao.dados_inspecao` (JSON) e definir com o Iago a estrutura do formulário por atividade; o texto do SAP (`os.descricao`) segue sendo exibido. Impacto 🟡.

### 58. Como ligar a OS ao modelo de APR (nova, ajusta a 52)

**Contexto:** a especificação supunha um código de atividade (`8.7.1`) vindo do SAP. Nos exemplos não vem: a corretiva 4023470 não tem plano, e a preventiva 4019821 traz Plano 10573, Item 10603 e o título "1.2 - Inspeção Funcional de Retificador", que não consta em nenhuma lista das APR (a APR 02 lista "8.1.2 - Inspeção Elétrica no Retificador"; a APR 03, "8.2.1 - Leitura Retificador"). As listas das APR 02 e 03 misturam códigos numéricos, faixas ("8.7.2/ 8.7.3/ 8.7.4/…") e nomes sem código ("CLB - Calibração PSV", "BOMBA EXTERNA – PÁTIO"). Nas abas ocultas há ainda uma lista de atividades da ES Gás por APR, sem código. O Iago disse que o plano está em revisão e os códigos vão mudar.
**Recomendação:** `os.codigo_atividade` passa a ser opcional; a OS entra sempre; o técnico escolhe o modelo quando não há mapeamento. Confirmar com o Iago qual campo do SAP identifica a atividade (plano, item, título ou tipo). Impacto 🔴 (já refletido no schema).

### 59. Medidas preventivas: todas ou só as dos riscos marcados? (nova)

**Contexto:** a especificação dizia que a marcação "( )" do risco não vira item e que todas as medidas são respondidas. Nas APR 03 preenchidas dos exemplos, a equipe marca os riscos que existem e responde Sim/Não só às medidas deles; as dos riscos sem marca ficam em branco.
**Recomendação:** o risco vira entidade do modelo, a marcação é gravada na APR e só as medidas dos riscos marcados são exigidas. Reduz o preenchimento e mantém o PDF fiel ao papel. Impacto 🔴 (já refletido no schema).

### 60. Participantes das APR 04, 05 e 09 (nova)

**Contexto:** as APR 01 a 03 e 06 têm "Supervisor da Atividade" e até 9 executores, com nome e matrícula. As APR 04 e 05 têm uma coluna "Função da atividade" e cerca de 40 linhas; a APR 09 tem 3 linhas, também com "Função". Pelo texto das instruções, o supervisor é destacado entre os nomes.
**Recomendação:** manter `responsavel` e `executor`; a função de trabalho (soldador, etc.) fica fora do MVP. Impacto 🟢.

### 61. Item condicional da APR 06 (nova)

**Contexto:** o item 11 da APR 06 ("Em caso de espaço confinado foi realizado o teste de explosividade") só se aplica a espaço confinado, e a APR 06 não tem coluna NA.
**Recomendação:** marcar esse item com `permite_na` na carga inicial. Impacto 🟡.

### 62. Horário e assinatura por executante (nova)

**Contexto:** a página 2 da OS tem três blocos "Executante", cada um com Data, Hora (Início) e Hora (Fim) próprios. Nos exemplos todos coincidem com a execução.
**Recomendação:** um início e um fim por execução; horário individual fica fora do MVP. Impacto 🟢.

### 63. Importação de OS pelo supervisor (adiada)

**Contexto:** cogitou-se deixar o supervisor importar OS (arquivo, API ou digitalização) para a própria equipe. Em 12/10/2026 foi adiada.
**Recomendação:** manter a importação só do admin; reavaliar depois do piloto, se o admin virar gargalo. Impacto 🟡.

### 64. Cadastro pelo supervisor, liberação pelo admin e treinamento (decidida em 12/10/2026)

**Contexto:** (1) o supervisor cadastra técnicos só na própria equipe; o usuário nasce pendente, só tem acesso geral depois que o admin libera (ou recusa, com motivo), e o cadastro registra quem criou e quem liberou; (2) tela de treinamento com dados fictícios no primeiro login, só para técnicos, que pode ser pulada ou feita depois e fica no menu; a API bloqueia dados reais até a liberação.
**Decidido em 12/10/2026 (pronto na API; a web acompanha):**
- **Como o admin fica sabendo dos pendentes:** lista filtrada com contagem (`GET /usuarios?liberacao=pendente`, campo `total`). Sem alerta novo e sem e-mail.
- **Recusado:** o admin recusa com motivo obrigatório (a conta fica inativa e a sessão é revogada); o recusado não entra (`403 acesso_recusado` no login, com o motivo). O admin pode excluí-lo, e então e-mail e matrícula podem ser cadastrados de novo. O supervisor da equipe vê o motivo.
- **O que o supervisor-cadastrante vê e edita enquanto o usuário está pendente:** vê os pendentes e recusados das equipes dele; só nos pendentes que ele criou edita nome, cargo e registro profissional e pode cancelar o cadastro. Não altera e-mail, matrícula, equipe, perfil nem ativo.
- **Senha inicial:** gerada e entregue como no cadastro pelo admin (a pessoa troca no primeiro acesso); o supervisor não redefine senha.
- **Pendente e o treinamento:** o pendente pode entrar, trocar a senha e fazer o Campo de treino com dados fictícios enquanto aguarda; a API recusa tudo o mais (`403 aguardando_liberacao`).
- **Supervisor que deixa de supervisionar a equipe:** nada automático; só o admin trata os pendentes dele.
- **Usuários existentes e os criados pelo admin:** ficam/nascem `liberado`.
**Ainda em aberto:** nada desta questão; a importação de OS pelo supervisor segue adiada (questão 63).
**Detalhes:** [Cadastro pelo supervisor, liberação e treinamento](especificacao.md#cadastro-pelo-supervisor-liberação-e-treinamento). Impacto 🟡.

## 4. Adotadas de baixo impacto (🟢)

| # | Recomendação |
|---|---|
| 17 | Guardar `ocorrido_em` e `recebido_em`; o painel sinaliza quando `ocorrido_em` for posterior ao recebimento. Vale também para o cronômetro |
| 18 | Aceitar no MVP: o app invalida a senha antiga no próximo sync com sinal. O reset é sempre online, pelo Supabase Auth |
| 20 | E-mail só para bloqueio; perguntar ao Iago se `apoio_encerrado` também merece e-mail. O envio é do back-end Node |
| 21 | O supervisor da equipe e o admin podem reprogramar e criar OS de apoio para qualquer equipe |
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
| 19 | Local que depois chega do SAP com outro código | **Sem objeto:** os locais vêm só do SAP, pelo código da ordem; o sistema não cadastra local | — |
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

- **Equipe sem supervisor:** o alerta vai para cada admin ativo (era o analista, que deixou de existir em 12/10/2026).
- **Fim da OS de apoio:** encerrar a OS de apoio gera o alerta `apoio_encerrado`.

Decidido em 10/10/2026 (já refletido na especificação):

- **APR 1:1 com a OS:** a tabela `apr_os` sai; o evento `apr_concluida` leva `os_id`.
- **Papel de campo:** "responsável" (líder que preenche a APR) no lugar de "encarregado".
- **Checklist:** preenchido por inteiro e validado no fim; evidência por item reprovado.
- **Retomada:** a OS com APR negativa fica pendente, e qualquer pessoa da equipe pode fazer uma APR nova, sem esperar reprogramação.
- **Fonte das OS:** API do SAP simulada, com dados fictícios, e planilha como alternativa.
- **Stack:** `web` em Next.js (React e TypeScript), `mobile` em React Native, `api` em Node, banco, autenticação e armazenamento no Supabase; PDF e e-mail na `api` (premissa a confirmar). O monorepo usa as pastas `api`, `web` e `mobile`.
- **Online primeiro:** o sistema é online; o modo offline é um recurso adicional de contingência para o campo sem sinal. Web e app atendem todos os perfis, e o perfil, não a plataforma, define o que cada pessoa faz. Corrige o entendimento anterior de app offline-first e web só de gestão.

Decidido em 11/10/2026 (já refletido na especificação):

- **Sem OS manual:** a criação manual de OS foi retirada por decisão posterior do time; toda OS vem do SAP (API simulada ou planilha), e só a OS de apoio nasce no sistema, sempre ligada a uma OS de origem. O cadastro de locais saiu junto: os locais vêm só do SAP.

Decidido em 12/10/2026 (já refletido na especificação):

- **Dois perfis:** só `tecnico` e `admin`. O analista deixou de existir: importação de OS (arquivo, API e digitalização), leitura e exportação SAP, cancelamento de OS de apoio, modelos de APR, critério de bloqueio, usuários e equipes são do admin.
- **Segurança do Trabalho não é perfil e não usa o sistema:** ela só define o critério de bloqueio da APR; o admin o cadastra no editor.
- **Supervisor não é perfil:** é o técnico que `equipe.supervisor_id` aponta. Faz tudo o que o técnico faz e mais a gestão da(s) equipe(s) que supervisiona (quadro, alertas, indicadores, ciência, reprogramar, OS de apoio). O admin não executa OS.
- **Alertas:** OS de equipe sem supervisor e falha de importação vão aos admins ativos; a Segurança "em leitura" some.
- **Cadastro pelo supervisor com liberação pelo admin:** pronto na API (questão 64). O Campo de treino (tela de treinamento no primeiro login, só técnicos) está em construção.

## 8. Insumos prometidos na Reunião 2

| Quem | O quê | Liga com |
|---|---|---|
| Iago | Planilha do SAP com o pacote de OS de 2025 | 43, 54 |
| Iago | Documento de arquitetura (SharePoint e Power Apps) | — |
| Iago | Tabela de tipos de manutenção × APR (ainda não aprovada) | 52 |
| Mario | Tabela de equipes | 54 |
| Marcos | Novo desafio sobre APR por tipo de ordem | 52 |

# Questões em aberto

> Dúvidas que surgiram ao conferir o banco de dados com as OS e as APR de exemplo (`base/os-examples/` e `base/apr-examples/`). Cada uma traz o que os documentos mostram, a pergunta, a solução que o banco já adota e quem pode responder. Se a resposta for outra, o ajuste fica restrito ao que está citado.
>
> O detalhamento de cada questão e as demais questões do projeto estão em [pontos-a-validar.md](base/.design/pontos-a-validar.md) (os números abaixo são os mesmos).

| # | Questão | Quem responde | Impacto |
|---|---|---|---|
| 57 | Como é o formulário de inspeção das OS preventivas? | Iago | 🟡 MVP |
| 58 | Como ligar a OS ao modelo de APR? | Iago (respondida em 14/10/2026) | 🔴 Schema |
| 59 | Só as medidas dos riscos marcados são respondidas? | Mario | 🔴 Schema |
| 60 | Qual é a "função da atividade" nas APR 04, 05 e 09? | Mario | 🟢 Depois |
| 61 | O item de espaço confinado da APR 06 aceita "NA"? | Mario | 🟡 MVP |
| 62 | O horário de início e fim vale por executante? | Iago | 🟢 Depois |
| 67 | Quem responde pela equipe quando o supervisor está ausente? | Iago (respondida em 16/10/2026) | 🟡 MVP |
| 68 | Qual servidor de e-mail (SMTP) o SYNQ OS usa para os avisos? | Empresa (TI), pelo Iago | 🟡 MVP |
| 69 | O supervisor pode devolver a OS ao responsável em vez de assinar? | Time | 🟡 MVP |
| 70 | O SYNQ OS preenche "Houve desvio?" e "Tempo parada" na folha do SAP? | Iago | 🟡 MVP |
| 71 | O que fazer com mais de 3 executantes na folha do SAP? | Time | 🟢 Depois |
| 72 | O que a equipe com só 1 pessoa disponível faz, com o mínimo de 2 participantes? | Time | 🟡 MVP |

**Impacto:** 🔴 muda tabelas ou contratos; 🟡 muda uma tela ou regra da demonstração; 🟢 não afeta a demonstração.

## 57. Como é o formulário de inspeção das OS preventivas?

**O que os documentos mostram:** a página 2 da OS 4019821 (preventiva, inspeção funcional de retificador) traz um "Checklist de Inspeção Técnica":

- leituras por semana (Sem 1 a Sem 5): data, horímetro, hora da coleta, tensão de entrada (Vac), tensão de saída (Vcc), tensão de shunt (mV) e técnico/inspetor;
- conformidade por componente: "Conforme / Não conforme" (vandalismo, limpeza, insetos, cabos, fusíveis, DPS), "Operante / Não operante" (display), "Funcional / Não funcional" (telemetria), "Executado / Não necessário / Aguardando parada" (reaperto de bornes) e "Íntegra / Comprometida / Sinais de umidade" (fixação do gabinete);
- um campo de observações por item e o quadro "Observações Gerais / Requisições de Ação Corretiva".

A OS corretiva 4023470 não tem nada disso. O texto parece vir da descrição longa da OS no SAP.

**Pergunta:** o sistema deve capturar esse formulário de forma estruturada (campos, valores e unidades)? Quais atividades têm formulário, e quem define os campos de cada uma?

**Adotado por enquanto:** o checklist de inspeção de [inspecao-preventivas.md](inspecao-preventivas.md): cada plano de preventiva tem a sua lista de perguntas (caixas de marcar), definida no editor do ciclo e preenchida no encerramento de cada OS dela; o preenchimento fica em `execucao.dados_inspecao` e o texto do SAP continua aparecendo na OS. As leituras com valor e unidade (horímetro, tensões) vão na observação. **Para o Iago:** conferir se esse checklist cobre o uso real ou se a pergunta precisa de tipo (número com unidade, opções).

## 58. Como ligar a OS ao modelo de APR?

**O que os documentos mostram:** a especificação supunha um código de atividade do SAP (como `8.7.1`) que escolheria o modelo. Nos exemplos ele não vem:

- a OS corretiva 4023470 ("DCV Desobstrução de caixa de valvula") não tem plano de manutenção;
- a OS preventiva 4019821 traz Plano de Manutenção `10573`, Item `10603` e o título "1.2 - Inspeção Funcional de Retificador", que não aparece em nenhuma lista das APR. A APR 02 lista "8.1.2 - Inspeção Elétrica no Retificador" e a APR 03 lista "8.2.1 - Leitura Retificador";
- as listas "Plano de manutenção e operação (SAP)" das APR 02 e 03 misturam códigos numéricos, faixas ("8.7.2/ 8.7.3/ 8.7.4/ 8.7.7/ 8.7.8") e nomes sem código ("CLB - Calibração PSV", "BOMBA EXTERNA – PÁTIO");
- as abas ocultas das planilhas listam atividades da ES Gás por APR (por exemplo, "Lavagem de Estação", "roçagem"), também sem código;
- o Iago comentou na Reunião 2 que o plano de manutenção está em revisão e os códigos vão mudar.

**Pergunta:** qual informação do SAP identifica a atividade de uma OS (plano, item, título, tipo de atividade)? Corretivas sem plano têm outra forma de indicar o modelo? Quando a nova tabela de tipos de manutenção × APR sai?

**Resposta do Iago (14/10/2026):** hoje o gasista escolhe a APR pelo serviço. As preventivas têm nome padrão, mas as corretivas não têm código padronizado, e o mesmo serviço pode pedir APRs diferentes conforme a situação no local (remover marimbondo com ou sem trabalho em altura).

**Decidido em 14/10/2026:** não há atribuição automática do modelo. A cada APR, o técnico escolhe entre os modelos publicados, e o sistema só orienta: mostra a descrição e os exemplos de cada modelo e recomenda o que mais combina com a OS, pelas palavras-chave achadas no título, no serviço do catálogo e na descrição. A recomendação nunca é aplicada sozinha. A ligação atividade → modelo saiu do banco (migração `0021`). A OS continua entrando sempre; `os.codigo_atividade` segue opcional e aponta só o serviço do catálogo (a lista de materiais); o plano e o item de manutenção ficam guardados na OS. Isso substitui o que estava adotado: o modelo vinha da atividade e, quando a OS não tinha atividade com modelo, o técnico o escolhia ao iniciar a APR.

## 59. Só as medidas dos riscos marcados são respondidas?

**O que os documentos mostram:** nas duas APR 03 preenchidas (OS 4023470 e OS 4019821), a equipe marca "( )" os riscos que existem na atividade (por exemplo, Veicular, Insolação, Insetos e animais) e responde Sim/Não só às medidas desses riscos. As medidas dos riscos sem marca (Áreas molhadas, Trabalho noturno, Roçagem, Pintura) ficam em branco. A especificação anterior dizia que todas as medidas são respondidas.

**Pergunta:** é isso mesmo, ou a Segurança do Trabalho espera que todas as medidas tenham resposta? Marcar nenhum risco é permitido?

**Adotado por enquanto:** o risco é parte do modelo, a equipe marca os que existem, e só as medidas desses riscos são exigidas. O PDF reproduz a marcação como no papel.

## 60. Qual é a "função da atividade" nas APR 04, 05 e 09?

**O que os documentos mostram:** as APR 01, 02, 03 e 06 têm uma linha de "Supervisor da Atividade" e até 9 de "Executor da Atividade", com nome e matrícula (ou assinatura). A APR 04 e a 05 têm as colunas Ord., Nome, "Função da atividade" e Assinatura, com cerca de 40 linhas. A APR 09 tem 3 linhas, com "Executor da atividade" e "Função na atividade". As instruções pedem para destacar o supervisor entre os nomes.

**Pergunta:** "Função da atividade" é o cargo ou o papel de trabalho (por exemplo, soldador, operador)? Há um limite de participantes por APR? Nesses modelos continua existindo um supervisor da atividade?

**Adotado por enquanto:** cada participante é `responsavel` (exatamente um) ou `executor`, sem limite de pessoas. A função de trabalho fica fora do MVP.

## 61. O item de espaço confinado da APR 06 aceita "NA"?

**O que os documentos mostram:** o item 11 da APR 06 é "Em caso de espaço confinado foi realizado o teste de explosividade". Só se aplica quando a atividade é em espaço confinado, mas a APR 06 não tem coluna NA (só as APR 04 e 05 têm). A APR 06 cobre trabalho em altura e espaço confinado.

**Pergunta:** quando a atividade é só em altura, como o item 11 é preenchido hoje? Deve ganhar a opção "NA"? O mesmo vale para outros itens condicionais?

**Adotado por enquanto:** esse item passa a aceitar "NA", com observação obrigatória.

## 62. O horário de início e fim vale por executante?

**O que os documentos mostram:** a página 2 da OS tem três blocos "Executante", cada um com Data, Hora (Início) e Hora (Fim). Na OS 4023470, os dois executantes registraram 11:09 a 12:18, os mesmos horários da linha da operação no SAP. A linha da operação também tem "N Pes", "Durac." e "HH" (homem-hora).

**Pergunta:** um executante pode chegar ou sair em horário diferente dos outros? O SAP precisa receber o homem-hora de cada pessoa, ou basta o total e o número de pessoas?

**Adotado por enquanto:** um início e um fim para a execução inteira, mais o número de pessoas. O horário individual fica fora do MVP.

## 67. Quem responde pela equipe quando o supervisor está ausente?

**Contexto:** o time decidiu, em 15/10/2026, criar o usuário ausente ([ausencia.md](ausencia.md)): ele continua ativo, mas só visualiza, e só o supervisor da equipe registra, aprova e encerra a ausência dos membros. Cada equipe tem um supervisor só (`equipe.supervisor_id`), e o supervisor também pode ficar ausente.

**Pergunta:** quando o supervisor sai de férias ou de licença, quem responde pela equipe hoje? Alguém da equipe vira supervisor substituto, a gerência assume ou é outra forma? E quem aprova a ausência de quem está numa equipe sem supervisor?

**Resposta do Iago (16/10/2026):** quando o supervisor entra de férias ou se ausenta, ele designa um responsável para assinar e encerrar as ordens por ele.

**Adotado (feito em 16/10/2026, [representante.md](representante.md)):** como não dá para designar alguém de fora do sistema, toda equipe tem um representante, um membro dela, escolhido pelo sistema (o técnico mais antigo) até o supervisor ou o admin designar outro. Ele assume a supervisão quando o supervisor registra uma ausência ou passa 3 dias sem usar o sistema, e a devolve quando ele volta. A equipe sem supervisor foi resolvida em 17/10/2026 ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md), seção 5.4): o representante assume até o admin escolher um supervisor, e os administradores são avisados. Para o Iago confirmar: se 3 dias corridos bastam, ou se fim de semana e feriado devem ser descontados.

## 68. Qual servidor de e-mail (SMTP) o SYNQ OS usa para os avisos?

**Contexto:** desde 17/10/2026 todo aviso do sino pode sair também por e-mail, conforme as categorias que cada pessoa deixa ligadas no perfil, e de manhã sai um resumo diário ([avisos-e-emails.md](funcionalidades/avisos-e-emails.md)). O código está pronto e testado; sem um servidor de e-mail configurado, os avisos ficam só no sino e nenhum e-mail sai.

**Pergunta:** a empresa libera uma conta num servidor de e-mail (SMTP) para o SYNQ OS enviar? Para configurar, é preciso:

1. o endereço do servidor, a porta e o tipo de conexão (587 com STARTTLS ou 465 com TLS direto);
2. o usuário e a senha da conta que envia;
3. o endereço do remetente (por exemplo, `synqos@empresa.com.br`), aceito pelo servidor;
4. o SPF e o DKIM do domínio do remetente, para os e-mails não caírem no spam;
5. o endereço público da web, que vira a base dos links dos e-mails.

Também vale confirmar se a empresa aceita o que vai nos e-mails: nome, matrícula, número e título da OS, local e motivo da ausência, sempre para o e-mail institucional.

**Adotado por enquanto:** os avisos ficam só no sino. Com a resposta, basta preencher `SMTP_URL`, `EMAIL_REMETENTE` e `PAINEL_URL` e conferir com `pnpm --dir api email:testar -- seu.email@empresa.com.br` (seção 6 do [avisos-e-emails.md](funcionalidades/avisos-e-emails.md)).

## 69. O supervisor pode devolver a OS ao responsável em vez de assinar?

**Contexto:** na Reunião 3 (17/10/2026), o time decidiu que o supervisor lê o relatório da execução e assina por último, e só então a OS está concluída ([correcoes-da-reuniao-3.md](funcionalidades/correcoes-da-reuniao-3.md)). Se a leitura mostrar um problema, hoje o supervisor só tem a assinatura.

**Pergunta:** o supervisor deve poder devolver a OS ao responsável, com um motivo, em vez de assinar? Na prática, isso é mandar refazer o serviço, o que pede regras próprias (a OS voltaria para o encerramento, a execução já terminou, o tempo já parou).

**Adotado por enquanto:** não existe devolução: o supervisor assina.

## 70. O SYNQ OS preenche "Houve desvio?" e "Tempo parada" na folha do SAP?

**O que os documentos mostram:** a folha da OS do SAP tem os campos "Houve desvio?" (com a justificativa do desvio) e "Tempo parada" ([`base/os-examples`](base/os-examples/)). O SYNQ OS já sabe de interrupções, suspensões e pausas, com motivo e horário.

**Pergunta:** esses campos devem ser preenchidos pelo SYNQ OS (por exemplo, com a interrupção ou a suspensão, ou com o tempo pausado) ou ficam em branco, como no papel? O que o SAP espera neles?

**Adotado por enquanto:** os dois ficam em branco no PDF, como no papel; as pausas, suspensões e interrupções estão no relatório da execução.

## 71. O que fazer com mais de 3 executantes na folha do SAP?

**O que os documentos mostram:** a página 2 da OS tem três blocos de executante, e a APR não limita o número de participantes (o mínimo é 2, sem máximo, desde a Reunião 3).

**Pergunta:** quando a equipe tem mais de 3 executantes, o SAP aceita mais blocos ou só os 3? Quem não cabe nos 3 entra em outra folha ou fica só na APR?

**Adotado por enquanto:** os executantes extras seguem em novas linhas de blocos iguais.

## 72. O que a equipe com só 1 pessoa disponível faz, com o mínimo de 2 participantes?

**Contexto:** desde 18/10/2026 a APR exige ao menos 2 participantes (ninguém trabalha sozinho), e os participantes vêm da equipe da OS (Reunião 2). Ausente e desligado não entram.

**Pergunta:** quando só uma pessoa da equipe está disponível (as outras ausentes, de folga ou desligadas), como o serviço é feito? A equipe pode chamar alguém de outra equipe (a regra de hoje é só a equipe da OS e a do técnico que preenche, ver a questão 10) ou a OS espera?

**Adotado por enquanto:** a APR é recusada com a mensagem de que faltam participantes (`participantes_insuficientes`), e a OS espera até haver a segunda pessoa.

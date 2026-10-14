# Digitalização de OS antigas — discussão de 14/10/2026

> Registro da discussão sobre a digitalização das OS antigas: as folhas que já foram a campo, preenchidas à mão, e que hoje ficam no arquivo em papel ou escaneadas. Traz o objetivo, o que a folha tem, o fluxo proposto, a leitura pela IA, as conferências, os custos, os dados e a LGPD, os riscos e o que ainda precisa ser decidido.
>
> **Situação:** em discussão; nada implementado. Hoje a Digitalização da tela de Importação só abre a câmera e captura a foto ([`JanelaCamera.tsx`](web/src/components/web/importacao/JanelaCamera.tsx)), e o PDF escaneado é recusado (`pdf_sem_texto`).
>
> Fontes: a conversa de 14/10/2026; as prioridades do [DesignDoc](DesignDoc.md) ("Escaneamento das OS e APR antigas"); o processo em papel descrito na [Reunião 1](base/reunioes/Transcricao_Reuniao1.md); as folhas de `base/os-examples`; a leitura do PDF da OS ([`importacao-pdf.ts`](api/src/dominio/importacao-pdf.ts)) e a sua conferência ([`ConferenciaPdf.tsx`](web/src/components/web/importacao/ConferenciaPdf.tsx)); o fornecedor e os custos de IA do [chatbot.md](chatbot.md).

## Resumo

- **O objetivo é trazer as OS antigas para o sistema**, as que já foram executadas no papel. Elas entram como OS encerradas, de histórico, e não como liberadas, como diz o protótipo.
- **A folha tem uma parte impressa pelo SAP e uma manuscrita.** A impressa ("Rótulo:Valor") é a mesma que a leitura do PDF já interpreta. A manuscrita traz a execução e a APR inteira.
- **Quem lê as folhas é uma IA de visão**, que lê letra de mão muito melhor que um leitor de texto comum (OCR). Ela erra com convicção, por isso **a IA lê, o sistema confere e a pessoa confirma o que não bater**.
- **As conferências usam o que o sistema já tem:** o SAP simulado, o registro de funcionários, o modelo da APR e a coerência das datas.
- **Sem a IA, o fluxo continua:** um OCR local lê a parte impressa e o admin digita a manuscrita.
- **Custo estimado:** de R$ 0,03 a R$ 1,05 por OS, conforme o modelo, e metade disso em lote.
- **Em aberto:** a pontuação das OS antigas, o modelo de IA, os dados de teste e como a OS antiga entra no histórico (seção 13).

---

## 1. Objetivo

- **De onde vem:** o DesignDoc lista entre as prioridades o "Escaneamento das OS e APR antigas para o sistema". Pela Reunião 1, as OS eram impressas, separadas por equipe, preenchidas em campo e depois escaneadas pelo Iago, que as anexava no SAP ao encerrar.
- **Para que serve:** o histórico por local e equipamento passa a incluir o que foi feito antes do sistema, e o arquivo em papel deixa de ser a única fonte.
- **O que não é:** uma nova forma de trazer OS a executar. As OS novas já chegam pela API, pela planilha ou pelo PDF. Confirmado na conversa de 14/10/2026.
- **O protótipo precisa mudar:** o passo a passo da janela da câmera diz que "a OS entra como liberada".

## 2. A folha

Conferido nas folhas de `base/os-examples` (OS 4019821 e 4023470, escaneadas em scanner, de 200 a 600 dpi):

| Parte | O que traz | Como é escrito |
|---|---|---|
| Cabeçalho e campos da OS | número da ordem, datas da ordem e de impressão, centro de trabalho, tipo de atividade, status, local de instalação, equipamento, plano e item de manutenção, datas programadas, prioridade e descrição | impresso pelo SAP, no formato "Rótulo:Valor" |
| Operações | data e hora de início e de fim reais da execução | à mão, na linha abaixo da operação |
| APR | número da OS, local, data, hora e serviço; supervisor e executores, com matrícula; um "✓" por item, na coluna da resposta | à mão, sobre o formulário impresso da APR |
| Assinaturas | de quem participou | à mão |

- **Uma OS tem várias folhas:** a OS mostra "Folha 1/3", e a APR vem junto. A leitura do PDF já junta as folhas pelo número da ordem no cabeçalho.
- **As folhas de exemplo têm nomes e matrículas reais** (seção 10).

## 3. Fluxo proposto

1. **Entrada:** fotos pela câmera (celular) ou arquivo (imagem ou PDF escaneado), com todas as folhas da OS e da APR.
2. **Preparo no aparelho:** checagem de qualidade, cantos ajustáveis e recorte de cada folha (seção 4).
3. **Leitura na `api`:** as folhas vão para a IA, que devolve os campos num formato fixo (seção 5). A leitura é guardada.
4. **Conferências:** o sistema compara o que foi lido com o SAP, o registro de funcionários, o modelo da APR e as datas (seção 6).
5. **Conferência na tela:** uma caixa por campo, com o estado e a folha ao lado; a pessoa corrige o que não bater (seção 7).
6. **Importar:** a OS entra como encerrada, de histórico, com as folhas anexadas (seção 8).

Só o admin digitaliza, como nas demais importações.

## 4. Captura

- **Qualidade antes da leitura.** A tela da câmera mede tremido e luz no próprio quadro e só libera a captura (ou captura sozinha) quando a imagem está estável. O aviso "foto tremida" aparece na hora, e não depois de uma leitura ruim.
- **Bordas automáticas, sempre ajustáveis.** A detecção dos cantos falha com folha branca sobre mesa clara ou com papel dobrado; a pessoa arrasta os 4 cantos antes do recorte, como no CamScanner. Para os cantos e o alinhamento, o OpenCV.js, carregado só nesta tela.
- **Resolução total.** Hoje o protótipo tira um quadro do vídeo a 1920×1080, pouco para a letra miúda de uma A4 (cerca de 165 dpi). Onde der, a foto vem com a resolução total do sensor; senão, pela câmera nativa do aparelho (o `<input capture>` que já existe), com foco automático e HDR.
- **O filtro de realce é só para o arquivo.** A IA recebe a folha recortada, em cores: o realce em preto e branco apaga caneta azul fraca.
- **Várias folhas** em sequência, antes de mandar ler.
- **O PDF escaneado também entra.** O que hoje é recusado com `pdf_sem_texto` passa pela mesma leitura, sem o recorte (a folha do scanner já é plana). Para as OS antigas, deve ser o maior volume.

## 5. Leitura

### 5.1 Pela IA

- **Fornecedor:** o mesmo da Vitória, o Claude (Anthropic), no mesmo módulo da `api` ([chatbot.md](chatbot.md), seção 1.1). A chave fica só na `api`.
- **O que a IA lê bem nestas folhas:** a parte impressa, as datas e horas escritas à mão, a letra de forma e em que coluna está o "✓" de cada linha da APR. Ela também tolera foto um pouco torta ou com sombra.
- **Onde ela erra:**
  - **nome em letra cursiva:** pode completar com um nome plausível, mas errado;
  - **dígitos** (matrícula, número da OS): um dígito trocado, sem sinal de dúvida;
  - **a confiança que ela mesma informa não é confiável:** o "confere" sai das conferências do sistema (seção 6), não da IA.
- **Saída num formato fixo (JSON):** os campos da OS no contrato do SAP (os mesmos de `importacao-pdf.ts`), a execução, os participantes e as respostas da APR. Em cada campo, o texto como está escrito, o valor entendido e se é impresso ou à mão. O que estiver ilegível volta vazio, sem palpite.
- **A leitura é guardada.** A IA custa e não responde igual duas vezes; o registro usa a leitura guardada, em vez de reler como faz o PDF.
- **Em lote:** para um acervo grande, as folhas sobem de uma vez e a leitura roda em segundo plano, pela metade do preço (seção 9). O admin confere depois.

### 5.2 Sem a IA

- Sem chave, sem crédito ou sem a aprovação da empresa, o fluxo é o mesmo: um OCR local (Tesseract, em português, na `api`) lê a parte impressa, e o admin digita a manuscrita na conferência.
- O OCR local devolve as palavras com a posição, o mesmo formato que [`pdf-texto.ts`](api/src/servicos/pdf-texto.ts) monta a partir do PDF; a leitura pelos rótulos de `importacao-pdf.ts` serve sem mudança.

## 6. Conferências e diagnóstico

| Conferência | Como |
|---|---|
| Número da OS | o impresso no cabeçalho, o escrito à mão na APR e o do SAP simulado têm que bater |
| Parte impressa | se a ordem existe no SAP simulado, cada campo lido é comparado com o de lá |
| Cadastros | centro de trabalho, local, equipamento e tipo são listas fechadas: "PR0T_CAT" vira "PROT_CAT" sozinho; nos campos só de números, O vira 0, I vira 1 e S vira 5 |
| Participantes | matrícula e nome têm que formar um par do registro de funcionários; se um dígito diverge e o nome bate, o sistema sugere a correção |
| Datas e horas | a data e a hora da APR batem com o início da execução (num dos exemplos, a APR de 17/05/2026 às 11:09 e a execução de 17/05/26, das 11:09 às 12:18); o fim vem depois do início, e a execução depois da data da ordem |
| APR | o formulário corresponde a um dos 8 modelos (que saíram dessas folhas); cada linha é um item do modelo; a linha com duas marcas, ou com nenhuma, fica duvidosa |

Cada campo sai com um de quatro estados:

- **Confere:** bate com o SAP, com um cadastro ou com outra folha.
- **Duvidoso:** nada confirmou a leitura, ou duas fontes divergem.
- **Inválido:** o formato está errado ou o valor não existe no cadastro.
- **Faltando:** não foi lido.

O número da ordem a pessoa sempre confirma: um dígito errado cria uma OS que não existe no SAP.

## 7. A tela de conferência

- **Reaproveita a conferência do PDF** ([`ConferenciaPdf.tsx`](web/src/components/web/importacao/ConferenciaPdf.tsx)): os campos, os obrigatórios que faltaram, o que foi deduzido, se a OS já existe e a equipe do centro de trabalho.
- **Acrescenta:** o estado de cada campo; a folha ao lado, ampliável; os campos da execução e dos participantes; e a APR, item a item, com a resposta lida.
- **"Importar"** só fica disponível quando não sobra campo obrigatório inválido ou faltando. Os duvidosos ficam destacados.

## 8. O que entra no sistema

Proposta para discutir (seção 13):

- **A OS entra encerrada**, com a origem nova `digitalizacao` (em `os.origem` e em `importacao.origem`).
- **A execução**, com as datas e horas lidas e os participantes. Quem tem conta no sistema fica ligado a ela; quem não tem fica com nome e matrícula.
- **A APR em papel**, com as respostas lidas e a versão do modelo correspondente, marcada como em papel.
- **As folhas**, recortadas e realçadas, num PDF guardado no bucket `importacoes`, e o PDF da OS aponta para elas.
- **As assinaturas** ficam na imagem; não há assinatura digital.

## 9. Custos

Premissas:

- preços de hoje por milhão de tokens: Opus 5.5, US$ 4 de entrada e US$ 20 de saída; Sonnet 5.5, US$ 2 e US$ 10; Haiku 5.5, US$ 0,10 e US$ 0,50;
- cerca de 4.800 tokens por folha em alta resolução (2.576 px no lado maior) e 4 folhas por OS;
- 3 mil tokens de instruções e 6 mil de saída (o formato fixo e o raciocínio);
- PTAX de 13/10/2026 (R$ 5,01).

| Modelo | Por OS | Por 1.000 OS | Em lote (metade) |
|---|---|---|---|
| Opus 5.5 | ~R$ 1,05 | ~R$ 1.050 | ~R$ 525 |
| Sonnet 5.5 | ~R$ 0,52 | ~R$ 520 | ~R$ 260 |
| Haiku 5.5 | ~R$ 0,03 | ~R$ 26 | ~R$ 13 |

- São estimativas: o número real sai da contagem de tokens nas folhas de teste.
- O Haiku 5.5 pode receber a imagem em resolução menor, o que muda o custo e o acerto.
- Na feira, com poucas folhas, o gasto é de centavos. O tamanho do acervo ainda não é conhecido (cerca de 390 OS encerradas por mês, pela Reunião 1).

## 10. Dados e LGPD

- **Seria a primeira funcionalidade a enviar dados de OS e dados pessoais ao fornecedor:** nomes, matrículas e assinaturas. A Vitória nunca envia dados de OS ([chatbot.md](chatbot.md), seção 1.4).
- **Protótipo e feira:** só folhas fictícias.
- **Piloto:** entra na mesma aprovação da empresa que já está pendente para a IA. Sem ela, vale a leitura sem IA (seção 5.2).
- **As folhas de `base/os-examples` têm nomes e matrículas reais.** Para testar com a IA, imprimir OS fictícias (o gerador em [`api/scripts/gerar-pdf-os.ts`](api/scripts/gerar-pdf-os.ts) faz a folha), preencher à mão e fotografar.

## 11. Riscos

| Risco | Efeito | Como reduzir |
|---|---|---|
| A IA lê um valor plausível, mas errado | dado falso no histórico | as conferências da seção 6; o estado "duvidoso"; o número da ordem sempre confirmado |
| Foto de celular pior que as folhas de scanner | leitura ruim | qualidade checada na captura; o PDF escaneado como entrada principal do acervo |
| Ordem antiga que não existe no SAP simulado | a parte impressa fica sem conferência | estado "duvidoso" nos campos impressos; na demonstração, carregar no simulador as ordens das folhas de teste |
| Custo do acervo | gasto alto com o modelo mais caro | leitura em lote; teste dos modelos mais baratos |
| A empresa não aprova o envio | sem IA no piloto | a leitura sem IA (seção 5.2) |

## 12. Ordem de implementação (proposta)

1. **Teste da leitura**, antes de qualquer tela: folhas fictícias preenchidas à mão, a IA lendo para o formato fixo, e a medida do acerto campo a campo e do custo. Primeiro com o Opus 5.5, como referência; depois com o Sonnet 5.5 e o Haiku 5.5.
2. **Leitura na `api`** do PDF escaneado e das imagens, com as conferências e a leitura guardada.
3. **Tela de conferência**, a partir da do PDF.
4. **Importação** da OS encerrada, com a execução, a APR em papel e as folhas.
5. **Câmera:** qualidade, cantos, recorte, realce e várias folhas.
6. **Leitura sem IA**, com o OCR local.

## 13. Pontos em aberto

| # | Questão | Proposta |
|---|---|---|
| 1 | A OS antiga pontua na gamificação? | não: distorceria o ranking da temporada ([gameficacao.md](gameficacao.md)) |
| 2 | Que modelo de IA usar? | decidir depois do teste (seção 12, passo 1), pelo acerto e pelo custo |
| 3 | Com que folhas testar? | fictícias, preenchidas à mão |
| 4 | Como registrar a APR em papel com resposta bloqueante, se o serviço foi feito? | como está no papel, com um aviso, sem bloquear nada |
| 5 | A OS antiga entra nos indicadores (tempo de execução, preventivas, APR)? | entra no histórico por local e equipamento; nos indicadores, com o filtro "em papel" |
| 6 | Participante sem conta no sistema, ou já desligado | fica com nome e matrícula, sem conta |
| 7 | A OS já existe no sistema (importada antes)? | se ainda não tem execução, a digitalização a encerra com a execução em papel; se já tem, a folha é recusada |
| 8 | Até quando vai o acervo, e quem vai digitalizá-lo? | perguntar ao Iago |

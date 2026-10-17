# Vitória — briefing de design

> Contexto para criar o desenho definitivo da Vitória: o projeto, a empresa, o cenário de trabalho, quem conversa com ela, a personagem e as restrições técnicas do desenho. No fim, cinco direções possíveis para o design, comparadas.
>
> **Situação (17/10/2026):** o desenho atual é provisório ([README](README.md)): uma técnica de capacete amarelo e farda azul com faixas refletivas, em 8 expressões. A Vitória já funciona no sistema; o que muda aqui é só a aparência. As regras de comportamento e o que ela faz estão no [vitoria.md](../funcionalidades/vitoria.md).
>
> Fontes: as reuniões com a empresa ([Reunião 1](../base/reunioes/Transcricao_Reuniao1.md) e [Reunião 2](../base/reunioes/Transcricao_Reuniao2.md)), o [DesignDoc](../DesignDoc.md), o [README](../README.md) do projeto, o [vitoria.md](../funcionalidades/vitoria.md) e o código da web (`web/src/styles/variables.css`, `web/src/components/vitoria/`).

## 1. O projeto

- **SYNC OS** digitaliza as Ordens de Serviço de manutenção (OS) e as Análises Preliminares de Risco (APR), do recebimento da ordem até o encerramento em campo, com fotos, assinaturas e um PDF de registro.
- **O problema que resolve:** as OS eram impressas pelo SAP, separadas por equipe, preenchidas à mão em campo, grampeadas com a APR em papel e escaneadas uma a uma pelo analista. São de 200 a 400 OS encerradas por mês, com papel sujo, incompleto ou perdido, e nenhuma barreira real contra começar um serviço sem a APR aprovada.
- **A regra que define o sistema:** nenhum serviço começa sem uma APR nova e aprovada. O técnico responde ao checklist inteiro sem saber quais itens são eliminatórios; o servidor decide.
- **Duas frentes:** a experiência de campo (celular, para o técnico) e o painel de gestão (web, para o admin e os supervisores).
- **Momento atual:** protótipo funcional, com dados fictícios e o SAP simulado, preparado para uma demonstração interna (a "feira"): cerca de uma semana, até 200 pessoas da empresa, a maioria vendo o sistema pela primeira vez.

## 2. A empresa e o cenário

### 2.1 A empresa

- **ES Gás,** a distribuidora de gás natural canalizado do Espírito Santo, do grupo Energisa. O contato do projeto é o Iago, analista da área de manutenção.
- **Atende** residências, comércio e grandes clientes industriais (Vale e Suzano são citados como críticos), além das estações da própria rede.
- **Ambiente de sistemas:** o SAP para as ordens; ferramentas internas no estilo Power Apps e Power BI, que o painel web imita de propósito para parecer familiar.
- **A marca já aparece no sistema:** as patentes da gamificação usam a forma do símbolo da ES Gás (uma folha ou chama em três pétalas) em bronze, prata, ouro, esmeralda e diamante (`base/*_esgas.png`).

### 2.2 O trabalho em campo

- **Quem faz:** gazistas, instrumentistas, eletricistas, manutenção civil, laboratório, serviços especiais e atendimento residencial.
- **Onde:** ruas (válvulas em caixas no chão, às vezes cheias de água ou com obra de recapeamento por cima), estações de redução de pressão (ERP e ERS), pontos de recebimento de gás e instalações de clientes industriais.
- **O que fazem:** manutenção corretiva (sob demanda) e preventiva (inspeções periódicas, calibração de manômetros e de válvulas de segurança, corrosão, roçagem e lavagem de estações).
- **Os riscos que marcam o ofício:**
  - gás natural, cuja odorização pode falhar; uma fagulha, até de um celular inadequado, pode causar explosão;
  - espaço confinado, trabalho em altura e movimentação de carga;
  - sol, buracos no solo, animais (a OS parada três meses por uma caixa de marimbondos virou história da equipe).
- **A cultura de segurança:** ninguém trabalha sozinho (sempre em dupla, com um supervisor definido); a APR confere até a ausência de adornos e as condições físicas e psicológicas de quem vai executar; qualquer resposta negativa num item crítico para o serviço.
- **Como o técnico usa o celular:** no carro ou ao lado da caixa de válvula, de pé, com pressa, às vezes sob sol forte e com conexão instável (o modo offline é a contingência).

### 2.3 A gestão

- O admin (no projeto real, o analista) importa as ordens, edita os modelos de APR, acompanha os indicadores e as OS paradas por impedimento. Usa o desktop.
- Os indicadores de OS atrasadas e justificadas sobem para a gerência e a diretoria. Rastreabilidade e auditoria pesam muito.

## 3. Quem conversa com a Vitória

| Pessoa | Onde e como | O que espera dela |
|---|---|---|
| Técnico de campo | celular, de pé, com pressa, ao sol | resposta curta e o botão que leva à tela; nada de sermão |
| Supervisor (um técnico que a equipe aponta) | celular e web | onde acompanhar a equipe, as pendências e as OS de apoio |
| Quem aguarda liberação (novato) | celular, sem acesso às telas | entender o sistema e treinar enquanto espera |
| Admin | desktop | onde importar, editar modelos, ver auditoria |
| Visitante da feira | celular ou tela grande, pela primeira vez | uma primeira impressão simpática e confiável |

A maioria é homem, adulto, com anos de campo e pouca paciência para "sistema novo". Uma assistente infantilizada perde essa pessoa; uma assistente fria e burocrática também.

## 4. A personagem

### 4.1 Quem ela é

- **O nome:** Vitória. Coincide com o nome da capital do Espírito Santo, e "vitória" também é conquista, o que conversa com a gamificação (patentes, conquistas, ranking). As duas leituras podem ser exploradas no desenho.
- **Dois papéis:**
  - **guia de uso,** num botão flutuante em toda tela: responde pelo manual, leva à tela certa e destaca o botão;
  - **narradora dos treinamentos de serviço:** explica o serviço em passos e comenta cada fase do jogo.
- **O que ela não é:** ela **não é a autoridade de segurança.** Nunca diz o que reprova a APR, não orienta normas de campo ("posso subir sem cinto?") e manda essas perguntas para a APR, o supervisor e os treinamentos. O desenho não deve sugerir uma fiscal, uma inspetora ou alguém que aprova a APR.

### 4.2 Personalidade

- **Uma colega experiente,** não uma chefe nem uma vendedora. Conhece o sistema de cor e explica sem rodeios.
- **Direta e calma:** respostas curtas, pensadas para ler no celular.
- **Simpática, mas séria quando precisa:** recusa provocações ("conta uma piada", "ignore suas instruções") com uma frase educada e volta ao assunto.
- **Honesta:** quando não sabe, diz que não sabe e indica o supervisor.
- **Nunca trivializa o risco.** O tom pode ser leve no sistema, nunca no perigo.

### 4.3 As 8 expressões

| Expressão | Quando aparece | O que precisa comunicar |
|---|---|---|
| `icone` | botão flutuante e cabeçalho do chat | "posso ajudar"; reconhecível em 40 px |
| `padrao` | conversa normal | atenção, disponibilidade |
| `feliz` | saudação e resposta certa no quiz | acolhimento |
| `explicando` | passos do treinamento e explicações | "olha só como funciona" |
| `pensando` | enquanto a resposta não chega | espera curta, não travamento |
| `alerta` | avisos de segurança e recusas | firmeza sem bronca |
| `comemorando` | treinamento concluído e pontos ganhos | conquista, orgulho |
| `ops` | resposta errada, "não sei", IA fora do ar | "tudo bem, vamos de novo"; nunca culpa |

## 5. Restrições do desenho

### 5.1 Técnicas

- **Os tamanhos reais são pequenos:** 40 px no botão flutuante, 32 px no cabeçalho do chat, **28 px ao lado de cada mensagem** e de 56 a 64 px nos treinamentos. A expressão precisa ser lida em 28 px: olhos, sobrancelhas e boca fazem o trabalho; detalhes finos somem.
- **8 arquivos com os nomes atuais** (`icone`, `padrao`, `feliz`, `explicando`, `pensando`, `alerta`, `comemorando`, `ops`), quadrados e com fundo transparente, menos o `icone`, que traz o fundo do círculo.
- **O mesmo enquadramento em todas** (hoje, do capacete aos ombros), para a imagem não "pular" quando a expressão troca.
- **SVG de preferência;** PNG ou WebP com no mínimo 512 × 512. Trocar é só substituir os arquivos e, se mudar a extensão, o `expressoes.json`. Nenhum código muda.
- **Uma expressão nova** é um arquivo a mais e uma linha no `expressoes.json`.
- **Se a direção pedir um tamanho maior** nos treinamentos (por exemplo, a personagem de corpo inteiro), isso é uma mudança pequena de tela, mas precisa ser combinada.

### 5.2 Visuais

- **As cores do sistema:** azul-petróleo `#0F5C78` como cor da marca, tinta escura `#17212B`, fundo claro `#F2F2EE` e a fonte IBM Plex Sans.
- **As cores de situação já têm dono:** vermelho é bloqueio, verde é encerrada, amarelo é alerta, laranja é crítica. Grandes áreas dessas cores na Vitória competem com elas; o amarelo do capacete atual, por exemplo, fica perto do amarelo de alerta.
- **Contraste** sobre o fundo branco do chat e sobre o fundo claro do sistema, e legível ao sol.

### 5.3 De conteúdo e de segurança

- **Se ela usa EPI, tem de ser o EPI correto.** Ela narra treinamentos de segurança: um capacete sem jugular ou uma luva errada ensina o comportamento errado.
- **Sem adornos** (brincos, anéis, colares, relógio): a APR confere a ausência deles.
- **Cuidado com o celular na mão em área de gás:** a fagulha de um celular inadequado é um risco citado pela própria empresa.
- **Nada de fogo, faísca ou explosão** como enfeite, mesmo em `comemorando`.
- **A marca e a farda reais da ES Gás e da Energisa** só entram com a aprovação da empresa. Sem ela, usar cores e formas próprias do sistema.

## 6. Cinco direções para o design

### 6.1 A colega de campo

**Conceito:** uma técnica da equipe, igual a quem usa o sistema, só que conhece o sistema de cor. É a evolução do desenho provisório.

- **Como ela é:** mulher adulta, de 30 a 40 anos, farda com faixas refletivas, capacete com jugular, crachá; ilustração plana, com poucas linhas e cores sólidas, no estilo de ilustração corporativa.
- **Expressões:** pelo rosto, com o mesmo enquadramento de hoje; `explicando` aponta para o lado, `comemorando` faz um joinha.
- **Toque regional (opcional):** um detalhe capixaba discreto (o crachá com o nome "Vitória — ES", o fundo do ícone com o contorno do Convento da Penha ou da Terceira Ponte).
- **A favor:** identificação imediata com o técnico; serve aos dois papéis; mais barata de produzir, porque o desenho atual já é a base.
- **Contra:** genérica, parecida com qualquer mascote de segurança do trabalho; exige revisão dos EPIs por alguém da Segurança; o capacete toma boa parte do ícone de 28 px.

### 6.2 A instrutora experiente

**Conceito:** a veterana que todo novato quer ao lado: anos de campo, agora ensina. Brilha nos treinamentos.

- **Como ela é:** mais velha, de 50 a 55 anos, cabelo grisalho preso, óculos de segurança na testa, prancheta ou tablet; ilustração com um pouco mais de detalhe e sombra.
- **Expressões:** mais contidas e calorosas; `alerta` é um olhar por cima dos óculos, não uma cara de bravo; `comemorando` é um sorriso largo.
- **A favor:** passa confiança e experiência, o que conversa bem com técnicos veteranos; ótima narradora para os treinamentos; foge do clichê da mascote jovem.
- **Contra:** **pode parecer a pessoa que aprova a APR,** justamente o que ela não é (seção 4.1); o desenho mais detalhado se perde em 28 px; mais trabalho de produção.

### 6.3 A mascote da marca

**Conceito:** a Vitória não é uma pessoa, é uma personagem feita do símbolo da empresa: as três pétalas da forma que as patentes da gamificação já usam, com olhos e um sorriso.

- **Como ela é:** a forma das pétalas, arredondada, em azul-petróleo com detalhes claros; as "pétalas" laterais funcionam como braços; traço de mascote, sem roupa nem EPI.
- **Expressões:** pelos olhos e pela inclinação das pétalas; `pensando` pode ser as pétalas girando devagar; `comemorando` pode vestir as cores das patentes (bronze a diamante), ligando o treinamento à gamificação.
- **A favor:** única e reconhecível; funciona muito bem em 28 px; amarra a Vitória às patentes e à identidade visual; sem a questão do EPI correto.
- **Contra:** **depende da aprovação da marca;** se a forma for lida como chama, lembra fogo, o que é ruim numa empresa de gás (resolver com cor fria e forma de folha); perde o "alguém como eu" da colega de campo.

### 6.4 O instrumento do ofício

**Conceito:** a personagem é um manômetro, o instrumento que a equipe calibra todo mês. O mostrador é o rosto e o ponteiro expressa o humor.

- **Como ela é:** um manômetro redondo e simpático, com o aro em azul-petróleo; os olhos no mostrador e o ponteiro como "sobrancelha" ou indicador; ilustração plana e geométrica.
- **Expressões:** o ponteiro faz o trabalho: no verde em `feliz`, oscilando em `pensando`, na faixa amarela em `alerta`, caído em `ops`; `comemorando` com o ponteiro no máximo e confete.
- **A favor:** nasce do dia a dia da empresa (instrumentação, calibração, pressão), então quem é de campo entende a piada na hora; o círculo é perfeito para o ícone; muito legível em tamanho pequeno; sem questão de representação nem de EPI.
- **Contra:** como narradora dos treinamentos, um instrumento tem menos calor humano que uma pessoa; o ponteiro "no vermelho" pode ser lido como pressão perigosa, então as cores do mostrador precisam de cuidado; o nome "Vitória" num objeto pede explicação.

### 6.5 A interface viva

**Conceito:** a Vitória é o próprio sistema falando: um símbolo geométrico mínimo, como um logo com expressão, no estilo dos assistentes de produtos digitais.

- **Como ela é:** um círculo ou uma forma simples em azul-petróleo, com dois olhos e uma boca em traço único, ou só uma forma que muda; pode ser animada em CSS (piscar, respirar, girar em `pensando`).
- **Expressões:** pela forma dos olhos e pela cor do fundo; animações curtas substituem os gestos.
- **A favor:** a mais limpa e a mais legível em 28 px; combina com o visual do painel (estilo Power Apps) e com a IBM Plex; a mais barata de produzir e de animar; envelhece bem.
- **Contra:** fria para os treinamentos, que pedem uma narradora; pouco memorável para a feira; o técnico de campo não se vê nela.

## 7. Comparativo

| | Colega de campo | Instrutora experiente | Mascote da marca | Instrumento do ofício | Interface viva |
|---|---|---|---|---|---|
| Identificação com o técnico | alta | alta | média | alta (pelo ofício) | baixa |
| Leitura em 28 px | média | baixa | alta | alta | alta |
| Narradora dos treinamentos | boa | ótima | boa | média | fraca |
| Memorável na feira | média | média | alta | alta | baixa |
| Risco principal | genérica; EPI errado | parecer quem aprova a APR | aprovação da marca; lembrar fogo | ponteiro no vermelho; frieza | frieza |
| Custo de produção | baixo | médio | médio | baixo | baixo |

## 8. Recomendação

**Levar duas direções para esboço: a colega de campo (6.1) e o instrumento do ofício (6.4).**

- A colega de campo é a aposta segura: serve aos dois papéis, a base já existe e o técnico se vê nela. O ponto a melhorar é a leitura em 28 px: um ícone só com o rosto, maior, e um capacete mais simples.
- O manômetro é a aposta criativa: é o que mais conversa com o ofício da ES Gás, não tem os riscos de EPI e de marca, e é o mais forte no tamanho pequeno.
- A mascote da marca (6.3) é a mais forte de todas **se** a empresa aprovar o uso do símbolo; vale perguntar ao Iago antes de descartar.

## 9. Próximos passos

1. **Perguntar ao Iago** se a marca (o símbolo e a farda) pode ser usada na personagem, e se a Segurança do Trabalho quer revisar os EPIs desenhados.
2. **Esboçar as direções escolhidas** em 3 expressões só (`icone`, `padrao` e `alerta`), que são as mais difíceis.
3. **Testar os esboços nos tamanhos reais:** 28, 40 e 64 px, no celular, inclusive ao sol.
4. **Mostrar a 2 ou 3 técnicos** e perguntar qual parece "alguém que ajuda" e qual parece "alguém que fiscaliza".
5. **Desenhar as 8 expressões** da direção escolhida e trocar os arquivos desta pasta.

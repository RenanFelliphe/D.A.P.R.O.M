# web

Versão web do SYNQ OS, em **Next.js 16 (App Router) + React 19 + TypeScript**, com os formulários validados por React Hook Form e Zod. É responsiva: funciona do desktop ao navegador do celular (pontos de quebra em 1279, 1023, 767 e 479 px, em [`responsivo.css`](src/styles/responsivo.css)). O app Android ([`mobile`](../mobile/README.md)) é outra aplicação, com o modo offline. Há dois perfis, técnico e admin; supervisor não é perfil, é o técnico que a equipe aponta como supervisor (`equipes_supervisionadas` de `GET /me`). O técnico usa a área de campo (`/app`); o supervisor usa também o painel de gestão (`/web`) das equipes que supervisiona; o admin é só gestão (`/web`) e não executa OS. Os dados vêm da [`api`](../api/README.md); o `web` nunca fala com o Supabase.

## Executar

A `api` precisa estar no ar. Para desenvolver sem Supabase, use o modo local dela (banco, autenticação e arquivos em memória, SAP simulado e usuários de exemplo):

```bash
cd api && pnpm install && pnpm dev:local     # http://localhost:3333
cd web && pnpm install && pnpm dev           # http://localhost:3000, abre na tela de entrada
```

O login é pelo e-mail institucional. Usuários do modo local (senha `synqos123`):

- `tiago.tecnico@empresa.com.br` e `tais.tecnica@empresa.com.br`: técnicos, Serviços Especiais;
- `tomas.tecnico@empresa.com.br`: técnico, Instrumentação;
- `sandra.supervisora@empresa.com.br` e `saulo.supervisor@empresa.com.br`: técnicos que supervisionam equipes;
- `admin@empresa.com.br`: admin.

Os dados somem quando a `api` reinicia. Quem não tem conta pode pedir uma em "Ainda não tem uma conta? Solicite", na tela de entrada.

```bash
pnpm build       # build de produção
pnpm lint
```

Variáveis de ambiente (só do servidor do `web`): `API_URL` (padrão `http://localhost:3333`) e, opcionalmente, `COOKIE_SEGURO` (`true`/`false`; padrão: acompanha o protocolo da requisição, ligado quando ela chega por HTTPS, direto ou pelo `x-forwarded-proto` do proxy). Aberto pelo IP da rede em HTTP (um celular na demonstração), o login e os ids das fotos, assinaturas e eventos funcionam; câmera ao vivo e GPS o navegador só libera em HTTPS. Com Docker, ver o [`docker-compose.yml`](../docker-compose.yml) da raiz.

## Como o `web` fala com a `api`

- **Sessão:** o login (`/app/entrar`) chama `POST /auth/login` por uma ação do servidor e guarda os tokens em cookies `httpOnly` (`synqos_at`, `synqos_rt`): o JavaScript do navegador nunca vê o token. O [`proxy.ts`](src/proxy.ts) manda quem não tem sessão para a entrada e renova o token que está para vencer. Senha provisória leva a "Defina sua senha"; liberado sem assinatura, a "Cadastre sua assinatura" (`/app/assinatura`), antes de qualquer outra tela (`403 assinatura_pendente` da `api`).
- **Componentes de servidor** leem dados com `api()` de [`src/lib/api.ts`](src/lib/api.ts) (junta o token do cookie). **Componentes de cliente** (formulários, cronômetro, fotos) usam [`src/lib/cliente-api.ts`](src/lib/cliente-api.ts): `chamar`, `enviarArquivo` (fotos comprimidas a ~1600 px, assinaturas) e `enviarEvento` (APR e execução, pelo único canal de escrita de campo, `POST /eventos`). Essas chamadas vão por `/api/*`, um handler ([`src/app/api/[...caminho]`](src/app/api/%5B...caminho%5D/route.ts)) que junta o token e repassa para a `api`, que autoriza.
- **Rascunho da APR:** fica no `localStorage` do navegador, por OS (com os ids das fotos já enviadas), até a APR ser concluída.
- O modo offline (fila local, sincronização) e o selo "Online" são do app `mobile`; no `web` não há selo de conexão, porque só se acessa pela internet.

## Rotas

| Rota | Tela | Quem |
|---|---|---|
| `/app/entrar` · `/app/trocar-senha` · `/app/assinatura` | Entrada, "Defina sua senha" e "Cadastre sua assinatura" (a primeira coisa depois da liberação) | todos |
| `/app/entrar/solicitar` | "Solicitar uma conta": nome, e-mail e, se quiser, a equipe; avisa os administradores e quem responde pela equipe ([solicitacao-de-conta.md](../base/funcionalidades/solicitacao-de-conta.md)) | quem não tem conta |
| `/app/lista` · `/app/os/[id]` | Quadro de OS (kanban por status, KPIs, filtros, ordenação) e detalhe da OS: **a mesma tela e o mesmo endereço para todos**. Admin e supervisor veem "Ordem de Serviço" (abas Quadro e Importação, faixa de alertas, ciência e PDF nos cartões; no detalhe, abas Resumo, APRs e execuções e Histórico, alertas, PDF, ciência, baixa no SAP; só o admin escolhe a equipe, marca local crítico e cancela OS de apoio). O técnico vê "OS da equipe" e, no detalhe, instruções, APR exigida e as ações de campo; o supervisor, por ser técnico, tem as ações de campo na lateral da visão de supervisão. No quadro, admin e supervisor têm o botão **OS preventivas** (com o selo das vencidas e próximas), que abre a janela com a contagem regressiva até o próximo ciclo de cada preventiva, o histórico de ciclos e a definição do intervalo (`?preventivas=1` abre a janela; é o atalho dos alertas de ciclo). O detalhe da OS preventiva tem o cartão "Ciclo da preventiva" | admin, supervisor, técnico |
| `/app/os/[id]/apr` · `…/apr/checklist` · `…/apr/aprovada` · `…/apr/bloqueio` | Nova APR, checklist, assinaturas e resultado. A Nova APR abre a janela "Escolha o modelo da APR" (`GET /os/{id}/modelos-apr`), com todos os modelos publicados: título, descrição dos serviços que atende, o que foi encontrado na OS e "Selecionar" (os exemplos de serviço da orientação não aparecem). O recomendado vem sozinho no topo, sob o título "Opção recomendada", com o aviso para conferir se é esse mesmo (a recomendação vem da leitura da OS, não da avaliação do local), e os demais em cartões de duas colunas, sob "Outros modelos de APR"; sem recomendação, um aviso diz que nenhum modelo se destacou ou que mais de um combina. O modelo pode ser trocado na etapa 1 ("Trocar modelo") e no checklist ("Trocar o modelo") enquanto a APR não foi registrada como bloqueada: o técnico confere os riscos (os de mesmo nome já vêm marcados) e vê quantas respostas continuam e quantas perguntas ficam em branco (regras em `trocarModelo` e `riscosEquivalentes`, de [`src/lib/apr.ts`](src/lib/apr.ts)). A janela não usa a `<dialog>` nativa ([`JanelaSobreposta`](src/components/ui/JanelaSobreposta.tsx)), para o tutorial do Campo de treino continuar clicável por cima dela. O checklist trata todas as perguntas do mesmo jeito (sem selo de eliminatória, sem aviso de alerta e sem pedir evidência); ao concluir, `POST /aprs/avaliar` diz o resultado e só então aparecem os itens reprovados, com a evidência de cada um (observação e, conforme o item, foto ou PDF; foto e PDF a mais são sempre aceitos). A APR que reprova já fica registrada ao validar; descartar o rascunho não a apaga | técnico (inclusive o supervisor); o admin vai para `/web` |
| `/app/os/[id]/execucao` | Execução: iniciar (número de pessoas e localização), pausar e suspender com motivo, interromper por risco (motivo, ao menos 1 foto e assinatura), cancelar por engano e encerrar em dois passos ("Encerrar OS" para o tempo; depois a descrição, as fotos e até 5 PDFs, todos opcionais, o checklist de inspeção da preventiva e a assinatura do responsável). Os outros participantes acompanham e agem: pausar, interromper e suspender por saúde valem na hora; encerrar e suspender por outro motivo viram um pedido de 2 minutos ao responsável ([execucao-compartilhada.md](../base/funcionalidades/execucao-compartilhada.md)) | participantes da APR (técnico, inclusive o supervisor); o admin vai para o quadro |
| `/app/os/[id]/conferencia` | Conferência da execução: o que a equipe registrou sem sinal em aparelhos diferentes, lado a lado; ciência no resumo ou, com divergência, a escolha do responsável e a assinatura dos demais | participantes e supervisor da equipe |
| `/app/perfil` · `/app/perfil/[id]` · `/app/equipes/[id]` · `/app/busca` | Perfil (dados, assinatura, troca de senha, minhas ausências, preferências de e-mail, conferências a fazer e a pontuação; quem executa OS vê também as que encerrou nos últimos 60 dias), perfil de outra pessoa, perfil da equipe (com o representante, que o supervisor ou o admin pode trocar) e busca global: telas únicas para todos | admin, supervisor, técnico |
| `/doc/os/[id]` | PDF da OS executada, dentro do painel | admin, supervisor |
| `/web/os/importacao` | Ordem de Serviço, aba Importação: métodos de entrada (Sincronização pela API; Importação de arquivo: a planilha .xlsx entra direto, e o PDF da OS gerado pelo SAP é lido e conferido campo a campo, ao lado do PDF, antes de registrar; Digitalização de OS antigas, já executadas no papel: o PDF escaneado em lote ou as folhas avulsas pela câmera, com a APR em papel junto da OS; o OCR lê o impresso, a IA lê o manuscrito e o admin confere antes de registrar como histórico, e as em aberto ficam em "Digitalizações em aberto"), o intervalo das preventivas (as que entraram sem intervalo entre ciclos, com o campo para definir; a conferência do PDF e o resultado da importação também têm o campo), o que é lido da planilha e do PDF e o histórico | admin |
| `/web/alertas` | Alertas, reprogramação e OS de apoio | supervisor (os das suas equipes), admin |
| `/app/dashboard/equipes` | Dashboard de equipes e usuários: resumo (equipes, técnicos, execuções, tempo líquido e total médio); em Equipes, a situação das preventivas e o tempo por equipe lado a lado (a barra dividida em líquido e pausa, com a tabela dos números) e uma linha por equipe (execuções, APRs, bloqueios, interrupções); em Técnicos, o tempo e uma linha por técnico; e, só para o admin, o estado do cadastro | admin; supervisor (equipe e técnicos); técnico ("Minha equipe": só a equipe, nada por pessoa) |
| `/app/dashboard/os` | Dashboard de OS (a abertura do Dashboard para o admin): começa pelo que precisa de atenção (OS pendentes, preventivas atrasadas sem justificativa, execuções abertas há mais de 12 h, assinaturas do supervisor, baixa no SAP e alertas, com atalhos); o **mapa de calor** (o destaque: onde as OS foram executadas, pelo GPS, com a lista das áreas mais movimentadas e o filtro de situação, por padrão todas); Preventivas (o ciclo dos planos e as programadas no período); resultados do período (OS encerradas por dia/semana/mês com a comparação, tempo de execução e interrupções por risco); para o admin, a entrada de OS (as três formas de entrada e dois gráficos: OS registradas e saúde da sincronização) e a planilha de baixa no SAP | admin; supervisor e técnico (a própria equipe; as interrupções sem o nome de quem executou para o técnico) |
| `/app/dashboard/apr` | Dashboard de APR: APRs respondidas e bloqueadas, alertas, APRs por dia/semana/mês, itens que mais bloqueiam, alertas mais registrados e APRs por modelo e por equipe. Os alertas e os itens que mais bloqueiam dizem o que é eliminatório e o que é alerta: só o admin os vê | admin; supervisor e técnico (a própria equipe) |
| `/app/dashboard/meus` | Dashboard, aba Meus resultados (a abertura do Dashboard para quem executa OS): o que a própria pessoa fez no período (OS encerradas por dia e tipo, APRs preenchidas e bloqueadas, tempo das execuções com pausas por motivo e as que mais pausaram, interrupções, locais onde mais trabalhou); sem comparar com colegas | supervisor e técnico (o admin não executa OS e vai ao dashboard de OS) |
| `/web/apr/modelos` | APR, aba Modelos: um cartão por modelo (versão em uso, rascunho e APRs), totais e modelos excluídos com "Restaurar" | admin edita; o supervisor lê |
| `/web/apr/modelos/novo` | Novo modelo: código, título, revisão e data do documento, em branco ou copiado de outro modelo; nasce rascunho | admin |
| `/web/apr/modelos/[codigo]` | Um modelo: versões, editor do rascunho ou versão em leitura, "Orientação para o técnico" (descrição dos serviços que o modelo atende, exemplos e palavras-chave com que o sistema recomenda o modelo; o admin edita, e vale na hora para todas as versões, sem publicar), "Onde é usado" (as APRs respondidas, aprovadas e bloqueadas) e "Excluir modelo" | admin edita; o supervisor lê (o uso, só o admin) |
| `/web/apr/atividades` | APR, aba Atividades: a tabela de atividades (código, descrição e provisório), o serviço que a OS traz do SAP, com busca. Ela não escolhe o modelo: o técnico escolhe a cada APR | admin edita; o supervisor lê |
| `/app/gamificacao` · `/app/gamificacao/minha` · `/ranking` · `/conquistas` · `/patentes` · `/pontos` | Seção Gamificação, a mesma para todos os perfis (`/app/gamificacao` sozinho abre Minha pontuação; o admin, que não joga, vai para o Ranking). **Minha pontuação** (técnico, supervisor incluso): a patente da temporada com a barra até a próxima, os pontos da temporada e os gerais, a maior patente, as posições, as últimas conquistas e o extrato com filtro por temporada. **Ranking** (`?tipo=pessoas\|equipes`, `?temporada=<codigo>\|geral`): a própria linha em destaque e quem está anônimo como "Participante anônimo". **Conquistas**: as obtidas coloridas, com a data, e as que faltam em cinza, com o progresso, a raridade e os pontos. **Patentes**: a escada, com a imagem das pessoas e a das equipes de cada patente e "você está aqui". **Como pontuar**: as tarefas, as regras do jogo e o que não pontua. O admin cria (com as duas imagens), edita, troca cada imagem, desativa e exclui patentes e conquistas e muda o valor de cada tarefa, ali mesmo (a `api` recusa os demais com `403`). A barra superior mostra o selo da patente e os pontos da temporada (técnico, fora do Campo de treino); o perfil, a equipe e as telas de APR, execução, ciência e ciclo das preventivas mostram a gamificação e o "+N pontos" | todos (Minha pontuação: técnico) |
| `/app/catalogo/servicos` · `/app/catalogo/materiais` | Catálogo de serviço: cada serviço (a atividade da OS) com os materiais, ferramentas e EPIs e a quantidade por execução (filtros: busca, "só sem materiais" e um material vindo da aba Materiais); o cadastro de materiais (busca, categoria e situação). O admin edita a lista no próprio cartão do serviço e cadastra, edita, desativa e exclui materiais. O detalhe da OS mostra a lista do serviço no cartão "Materiais e ferramentas". `/app/catalogo` sozinho leva aos serviços | admin edita; técnico e supervisor consultam |
| `/app/catalogo/sugestoes` · `/app/catalogo/servicos/{codigo}/materiais/sugerir` · `/app/catalogo/servicos/{codigo}/materiais/sugestoes/{id}` | Sugestão e contestação da lista de materiais ([sugestao-de-materiais.md](../base/funcionalidades/sugestao-de-materiais.md)): a aba Sugestões ("Minhas" e, para quem avalia, "Para avaliar" com o selo), o assistente em etapas (a lista, o motivo, a revisão com a diferença) e a tela de avaliação (aceitar, ajustar e aceitar, recusar). O cartão do serviço e o detalhe da OS ganham "Sugerir lista", "Contestar lista" e "Equipes do serviço" | todos enviam, menos o admin; avalia o supervisor da equipe responsável e o admin |
| `/app/usuarios` | Equipes e usuários (admin), Minha equipe com cadastro (supervisor) ou Minha equipe só para consulta (técnico: o perfil da própria equipe, sem nada por pessoa), no mesmo endereço. Admin: no topo o painel "Pendentes de liberação" (quem cadastrou, Liberar, Recusar com motivo obrigatório), filtro "Acesso" e selo com a contagem no item do menu; recusados mostram o motivo e só podem ser excluídos. Supervisor ("Minha equipe"): técnicos das equipes que ele supervisiona com o selo de acesso (Pendente, Liberado, Recusado + motivo), "Novo técnico" (nasce pendente; mostra a senha provisória uma vez), editar nome, cargo e registro e "Cancelar cadastro" dos pendentes que ele criou. Os dois veem o painel "Pedidos de conta" (os pedidos da tela de entrada que podem atender; cadastrar a pessoa atende o pedido) | admin, supervisor |
| `/web/auditoria` | Auditoria: quem fez o quê e quando nas telas de gestão (cadastros, modelos de APR, atividades, importações, OS de apoio, baixa no SAP), com filtros por texto, tipo e período e os detalhes do que mudou; só lê, a trilha não se altera | admin |
| `/app/aguardando` | "Seu acesso está aguardando liberação": quem cadastrou, atalho para o Campo de treino, "Verificar liberação" e conferência automática a cada 30 s | técnico pendente |
| `/app/treino` | Campo de treino: a escolha da modalidade (ver a seção abaixo) | técnico (inclusive o pendente) |
| `/app/catalogo/servicos/[codigo]/treinar` | Capa do treinamento de um serviço e a janela do jogo: a explicação da Vitória e as fases (verdadeiro ou falso, caça-palavras, memória, selecione e desembaralhe), com tempo e pontos por minijogo e o ranking do serviço ([treinamentos-de-servico.md](../base/funcionalidades/treinamentos-de-servico.md)) | técnico (inclusive o pendente) |
| `/app/catalogo/servicos/[codigo]/treinamento` · `…/criar` · `…/gerar` · `…/explicacao` · `…/fases` · `…/revisao` · `…/publicar` · `…/validar` · `…/versoes` · `…/problemas` · `…/indisponivel` | Criar e manter o treinamento de um serviço, em etapas: o rascunho à mão ou pela IA ("Gerar rascunho com a Vitória"), a explicação, as fases, a revisão, o envio para validação (ou a publicação direta do admin, com justificativa), as versões e os problemas que os técnicos reportaram | admin; supervisor de equipe que já faz o serviço |
| `/app/validacoes` | "Validações": a fila de tudo o que espera a decisão ou a assinatura do supervisor (OS para assinar, treinamentos, sugestões de materiais, conferências e pedidos de ausência), com filtro `?tipo=`; cada item abre na tela onde a decisão já existia ([validacoes.md](../base/funcionalidades/validacoes.md)). Os treinamentos seguem [validacao-de-treinamento.md](../base/funcionalidades/validacao-de-treinamento.md) | supervisor |
| `/app/treinamentos/validar` | Só redireciona para `/app/validacoes?tipo=treinamento` (o endereço antigo, que os avisos já enviados trazem) | supervisor |
| `/app/perfil/vitoria` | Perfil da Vitória (o que ela faz e se lê dados) e, só para o admin, o diagnóstico da IA e o **Controle da IA**: liga e desliga o chatbot, a criação de jogos, a recomendação de modelo de APR e a digitalização, e autoriza com a assinatura a leitura de dados reais ([controle-da-ia.md](../base/funcionalidades/controle-da-ia.md)). A própria Vitória é o botão flutuante de todas as telas da casca | todos (o controle, admin) |
| `/app/vitoria/sem-resposta` | As perguntas que a Vitória não soube responder, para o admin tratar | admin |
| `/simulador/ordens` · `/simulador/funcionarios` | Os sistemas simulados, fora da casca do SYNQ OS: as ordens do SAP e o registro de funcionários (CRUD, criação aleatória em lotes e ações em massa). Só existem com `SAP_SIMULADO` e `RH_SIMULADO` na `api` | admin |

`/app/dashboard` abre a primeira aba da pessoa (Meus resultados; o admin, OS); `/` leva ao início do papel (o quadro de OS para todos; o técnico pendente, à tela de espera), `/web/os` ao quadro, `/web/apr` aos modelos e `/app/dashboard` ao dashboard geral. Os cinco dashboards têm o mesmo filtro na URL (`?periodo=7d|30d|90d|12m|AAAA-MM`, 30 dias se ausente, e `?equipe_id=`), que acompanha a troca de aba. Os endereços antigos `/os/[id]` (links de e-mails e planilhas antigos), `/web/quadro`, `/web/os/quadro`, `/web/os/[id]`, `/web/perfil[/id]`, `/web/equipes/[id]`, `/web/busca`, `/web/minha-equipe`, `/web/usuarios`, `/web/importacao`, `/web/modelos`, `/web/os/diagnostico`, `/web/apr/diagnostico` e `/web/indicadores[/…]` redirecionam (em [`next.config.ts`](next.config.ts)). Os endereços ficam em [`src/lib/rotas.ts`](src/lib/rotas.ts).

Excluir um modelo que já foi publicado o **arquiva**: ele some das listas, das APRs novas e da cópia offline, mas as versões ficam, porque APRs, PDFs e a APR offline que ainda vai chegar apontam para elas. A orientação fica guardada e volta com o modelo restaurado. Modelo que nunca foi publicado é apagado de vez, com a orientação.

### Liberação de técnicos cadastrados por supervisor

O supervisor cadastra técnicos nas equipes dele; o usuário nasce `liberacao: "pendente"` e só ganha o acesso geral quando um admin libera (`POST /usuarios/{id}/liberar`); recusar (`/recusar`, com `motivo`) impede a entrada e o motivo aparece no login (`403 acesso_recusado`). Regras no web:

- **Pendente fora do treino**: a casca única (`Casca`, servidor) redireciona todo `/app/*` para `/app/aguardando`, exceto `/app/aguardando`, `/app/treino` (a página de escolha; as rotas `treino/entrar|sair|estado` são handlers sem casca), `/app/trocar-senha`, `/app/entrar` e `/app/perfil/vitoria` (o perfil da Vitória, que abre pelo chat; a Vitória atende o pendente). **Sem laço**: a tela de espera está na lista de liberadas e só lê o `/me` real (`lib/situacao-real.ts`, ignora o treino), que a `api` permite ao pendente. O endereço pedido vem do `proxy.ts` (`x-synqos-endereco`); sem ele a casca não redireciona. O menu mostra só "Campo de treino" e "Aguardando liberação", sem busca global.
- **Pendente no treino** (cookie `treino`): menu completo (o tutorial aponta para ele) mais "Aguardando liberação"; a `api` fictícia atende tudo. Ao concluir o tutorial, "Ver situação do meu acesso" no lugar de "Ir ao sistema" (sair do treino cai na tela de espera).
- **Rede de segurança**: `403 aguardando_liberacao` vindo de `chamarApi` (servidor) redireciona para `/app/aguardando`; `chamar` (navegador) faz o mesmo e devolve uma mensagem amigável. `403 acesso_recusado` volta à entrada. Com a sessão ainda aberta e `liberacao: "recusado"`, a casca mostra uma tela com o motivo e o botão Sair.
- **Login**: `403 acesso_recusado` mostra a mensagem da `api` (com o motivo). Quem entra pendente vai à tela de espera (`inicioDoUsuario`).
- A tela de espera mostra "quem cadastrou/quando" se `/me` trouxer `criado_por_nome` e `criado_em` (campos opcionais). O painel do admin usa `criado_por_nome`/`criado_por_id` e `criado_em`.

### Campo de treino

Um ensaio da área de campo com dados fictícios, para o técnico aprender antes de mexer no sistema real (inclusive quem aguarda liberação). Fica separado no fim do menu e tem cor própria (violeta), para nunca ser confundido com o real.

- **Entrar e sair:** `/app/treino` mostra a escolha da modalidade. `treino/entrar` liga o cookie `treino=1` e `treino/sair` o desliga; os dois são handlers sem casca.
- **Modalidades:** **Direcionado**, um passo a passo com balões na tela, da lista de OS à APR, às assinaturas, à execução, ao encerramento e ao bloqueio ([`passos.ts`](src/components/treino/passos.ts)), ou **Livre**, para explorar sozinho.
- **A `api` real não é chamada:** com o cookie e um usuário `tecnico`, a ponte `/api/*` responde pela API fictícia ([`src/treino/api-ficticia.ts`](src/treino/api-ficticia.ts)), com a mesma forma das respostas reais, sobre um estado em memória por usuário ([`armazem.ts`](src/treino/armazem.ts)). As regras dos eventos repetem as da `api`; os colegas fictícios assinam a APR sozinhos e o supervisor fictício dá a assinatura final. Não há fila offline, sino, e-mail nem pontos, e o endereço que o campo não usa responde `404 indisponivel_no_treino`.
- **O que é real:** só o estado do treinamento (`nao_iniciado`, `concluido` ou `pulado`), gravado na `api` real por `treino/estado` (`PUT /me/treinamento`). Concluir pontua uma vez por conta.

## Estrutura

```text
src/
├── proxy.ts                  # porteiro: sessão, renovação do token
├── app/
│   ├── layout.tsx            # fontes, sprite de ícones e avisos (toast)
│   ├── api/[...caminho]/     # ponte do navegador para a api (junta o token; no Campo de treino, responde pela API fictícia)
│   ├── app/                  # entrada, pedido de conta, troca de senha, assinatura, Campo de treino e as telas compartilhadas e de campo ((portal): quadro, detalhe da OS, APR, execução, conferência, perfil, equipe, busca, Dashboard, Equipes e usuários, catálogo, treinamentos, gamificação e Vitória)
│   ├── web/                  # telas só de gestão (APR, auditoria, alertas, importação)
│   ├── doc/                  # PDF da OS dentro do painel
│   └── simulador/            # telas dos sistemas simulados (SAP e registro de funcionários), fora da casca
├── components/
│   ├── shell/                # Shell, MenuLateral, Barras e a Casca única (lê o usuário e monta o menu por papel: admin só gestão, técnico só campo, supervisor os dois juntos; o Campo de treino fica separado no fim e o perfil, no menu do usuário da barra superior)
│   ├── ui/                   # peças compartilhadas: Icon, Badge, Button, Notice, Field, Interruptor, MenuAcoes, JanelaSobreposta, AssinaturaCanvas, AdicionarFoto, AnexarPdf, DocumentosAnexados, ImagemArquivo, AtualizacaoAutomatica e useFormulario (React Hook Form + Zod)
│   ├── app/                  # componentes da área do técnico, por tela
│   ├── web/                  # componentes do painel, por tela
│   ├── aguardando/           # tela de espera da liberação e acesso recusado
│   ├── ausencia/             # ausências: faixa, cartões, formulário e janela de assinatura
│   ├── busca/ · perfil/      # busca global e perfis de pessoa e de equipe
│   ├── representacao/        # representante da equipe e a faixa de quem está no comando
│   ├── treino/               # Campo de treino: selo, faixa, boas-vindas, modalidades e tutorial
│   ├── vitoria/              # a Vitória (botão e conversa), o perfil dela, o diagnóstico e o Controle da IA
│   ├── simulador/            # peças das telas dos simuladores
│   └── erro/                 # carregando, erro e "não encontrado"
├── lib/                      # api, cliente-api, rotas, tipos, formatar, sessão, validação e as regras de cada assunto (APR, execução, pedidos, conferência, ausência, treinamentos, Vitória)
├── treino/                   # API fictícia do Campo de treino e o estado em memória
├── hooks/                    # ganchos de tela compartilhados
├── state/                    # avisos (toast), assinatura do perfil e rascunho da APR
├── data/                     # tipos e rótulos usados pelas telas do painel
└── styles/                   # CSS agrupado por função (não por página), importado por globals.css
```

### Estilos

`src/styles` agrupa o CSS por função, e `globals.css` apenas importa os arquivos. A ordem dos imports é a ordem da cascata:

| Arquivo | Conteúdo |
|---|---|
| `variables.css` | variáveis de design: cores, fontes e medidas |
| `base.css` | reset, tipografia, ícones, casca (barra superior e menu lateral) e utilitários de layout |
| `components.css` | componentes reutilizáveis: botões, formulários, avisos/selos/toast, cartões e painéis, fotos e assinaturas, tabelas e PDF |
| `auth.css` | tela de entrada |
| `os.css` | lista de OS, quadro de gestão, detalhe da OS e execução |
| `apr.css` | etapas, checklist e resultado da APR |
| `management.css` | painel de gestão: alertas, importação de OS, indicadores e modelos de APR |
| `busca.css` | busca global e perfis |
| `gamificacao.css` | selos de patente, pontuação, ranking, conquistas, patentes e o "+N pontos" |
| `ausencia.css` | faixa de quem está ausente e cartões das ausências |
| `treino.css` | Campo de treino (cor própria, violeta) |
| `vitoria.css` | a Vitória: botão flutuante, conversa e o destaque de "mostrar na tela" |
| `treinamento-servico.css` | treinamentos de serviço: capa e telas de criação |
| `sugestao-materiais.css` | sugestão e contestação de materiais |
| `conferencia.css` | conferência da execução |
| `treinamento-jogo.css` · `treinamento-minijogos.css` | a janela do jogo e os cinco minijogos |
| `simulador.css` | telas dos simuladores |
| `responsivo.css` | pontos de quebra (1279, 1023, 767 e 479 px), por último para valer sobre os demais |

As páginas são componentes de servidor que leem a `api` e compõem os componentes de cada tela.

## Referência

O protótipo HTML original (`index.html`, `styles.css` e `app.js`, com a casca de apresentação em celular/navegador) foi removido depois da migração e continua no histórico do git. Especificação e regras de negócio: [`../base/.design/especificacao.md`](../base/.design/especificacao.md).

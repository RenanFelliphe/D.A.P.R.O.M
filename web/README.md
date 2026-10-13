# web

Versão web do D.A.P.R.O.M, em **Next.js 16 (App Router) + React 19 + TypeScript**, só para desktop. Há dois perfis, técnico e admin; supervisor não é perfil, é o técnico que a equipe aponta como supervisor (`equipes_supervisionadas` de `GET /me`). O técnico usa a área de campo (`/app`); o supervisor usa também o painel de gestão (`/web`) das equipes que supervisiona; o admin é só gestão (`/web`) e não executa OS. Os dados vêm da [`api`](../api/README.md); o `web` nunca fala com o Supabase.

## Executar

A `api` precisa estar no ar. Para desenvolver sem Supabase, use o modo local dela (banco, autenticação e arquivos em memória, SAP simulado e usuários de exemplo):

```bash
cd api && pnpm install && pnpm dev:local     # http://localhost:3333
cd web && pnpm install && pnpm dev           # http://localhost:3000, abre na tela de entrada
```

Usuários do modo local (senha `daprom123`): `tec1`, `tec2` (técnicos, Serviços Especiais), `tec3` (técnico, Instrumentação), `sup1`, `sup2` (técnicos que supervisionam equipes), `adm` (admin). Os dados somem quando a `api` reinicia.

```bash
pnpm build       # build de produção
pnpm lint
```

Variáveis de ambiente (só do servidor do `web`): `API_URL` (padrão `http://localhost:3333`) e, opcionalmente, `COOKIE_SEGURO` (`true`/`false`; padrão: acompanha o protocolo da requisição, ligado quando ela chega por HTTPS, direto ou pelo `x-forwarded-proto` do proxy). Aberto pelo IP da rede em HTTP (um celular na demonstração), o login e os ids das fotos, assinaturas e eventos funcionam; câmera ao vivo e GPS o navegador só libera em HTTPS. Com Docker, ver o [`docker-compose.yml`](../docker-compose.yml) da raiz.

## Como o `web` fala com a `api`

- **Sessão:** o login (`/app/entrar`) chama `POST /auth/login` por uma ação do servidor e guarda os tokens em cookies `httpOnly` (`daprom_at`, `daprom_rt`): o JavaScript do navegador nunca vê o token. O [`proxy.ts`](src/proxy.ts) manda quem não tem sessão para a entrada e renova o token que está para vencer. Senha provisória leva a "Defina sua senha".
- **Componentes de servidor** leem dados com `api()` de [`src/lib/api.ts`](src/lib/api.ts) (junta o token do cookie). **Componentes de cliente** (formulários, cronômetro, fotos) usam [`src/lib/cliente-api.ts`](src/lib/cliente-api.ts): `chamar`, `enviarArquivo` (fotos comprimidas a ~1600 px, assinaturas) e `enviarEvento` (APR e execução, pelo único canal de escrita de campo, `POST /eventos`). Essas chamadas vão por `/api/*`, um handler ([`src/app/api/[...caminho]`](src/app/api/%5B...caminho%5D/route.ts)) que junta o token e repassa para a `api`, que autoriza.
- **Rascunho da APR:** fica no `localStorage` do navegador, por OS (com os ids das fotos já enviadas), até a APR ser concluída.
- O modo offline (fila local, sincronização) é do app `mobile`; no `web` o indicador do topo é sempre "Online".

## Rotas

| Rota | Tela | Quem |
|---|---|---|
| `/app/entrar` · `/app/trocar-senha` | Entrada e "Defina sua senha" | todos |
| `/app/lista` · `/app/os/[id]` | Quadro de OS (kanban por status, KPIs, filtros, ordenação) e detalhe da OS: **a mesma tela e o mesmo endereço para todos**. Admin e supervisor veem "Ordem de Serviço" (abas Quadro e Importação, faixa de alertas, ciência e PDF nos cartões; no detalhe, abas Resumo, APRs e execuções e Histórico, alertas, PDF, ciência, baixa no SAP; só o admin escolhe a equipe, marca local crítico e cancela OS de apoio). O técnico vê "OS da equipe" e, no detalhe, instruções, APR exigida e as ações de campo; o supervisor, por ser técnico, tem as ações de campo na lateral da visão de supervisão | admin, supervisor, técnico |
| `/app/os/[id]/apr` · `…/apr/checklist` · `…/apr/aprovada` · `…/apr/bloqueio` | Nova APR, checklist, assinaturas e resultado. O checklist trata todas as perguntas do mesmo jeito (sem selo de eliminatória, sem aviso de alerta e sem pedir evidência); ao concluir, `POST /aprs/avaliar` diz o resultado e só então aparecem os itens reprovados, com a evidência de cada um. A APR que reprova já fica registrada ao validar; descartar o rascunho não a apaga | técnico (inclusive o supervisor); o admin vai para `/web` |
| `/app/os/[id]/execucao` | Execução (iniciar, pausar, suspender, interromper, encerrar) | técnico (inclusive o supervisor); o admin vai para o quadro |
| `/app/perfil` · `/app/perfil/[id]` · `/app/equipes/[id]` · `/app/busca` | Perfil (dados, assinatura, troca de senha; quem executa OS vê também as que encerrou nos últimos 60 dias), perfil de outra pessoa, perfil da equipe e busca global: telas únicas para todos | admin, supervisor, técnico |
| `/doc/os/[id]` | PDF da OS executada, dentro do painel | admin, supervisor |
| `/web/os/importacao` | Ordem de Serviço, aba Importação: métodos de entrada (Sincronização pela API; Importação de arquivo: a planilha .xlsx entra direto, e o PDF da OS gerado pelo SAP é lido e conferido campo a campo, ao lado do PDF, antes de registrar; Digitalização pela câmera — só admin, ainda em desenvolvimento), o que é lido da planilha e do PDF e o histórico | admin |
| `/web/alertas` | Alertas, reprogramação e OS de apoio | supervisor (os das suas equipes), admin |
| `/app/dashboard/geral` | Dashboard, aba Geral: a carteira de OS de agora, o resumo do período (OS encerradas, APRs e bloqueios, tempo, interrupções), o que precisa de atenção (com atalhos) e os resultados do período | admin; supervisor e técnico (a própria equipe; o técnico sem as pendências de gestão) |
| `/app/dashboard/equipes` | Dashboard de equipes e usuários: situação das preventivas por equipe, uma linha por equipe e por técnico (execuções, APRs, bloqueios, interrupções), o tempo de execução (pausa média, parte do tempo em pausa, execuções com pausa, tempo total médio; tempo por equipe e por técnico, com a barra dividida em líquido e pausa e a tabela com os números; pausas por motivo) e, só para o admin, o estado do cadastro | admin; supervisor (equipe e técnicos); técnico ("Minha equipe": só a equipe, nada por pessoa) |
| `/app/dashboard/os` | Dashboard de OS: carteira de agora, programadas e encerradas no período (por tipo e por dia/semana/mês), preventivas, tempo (total, líquido, pausa média, parte em pausa, pausas por motivo e as OS com mais pausa), interrupções por risco e locais; para o admin, a entrada de OS (métodos, sincronização, linhas ignoradas) e a planilha de baixa no SAP | admin; supervisor e técnico (a própria equipe; as interrupções e as OS com mais pausa sem o nome de quem executou para o técnico) |
| `/app/dashboard/apr` | Dashboard de APR: APRs respondidas e bloqueadas, alertas, APRs com modelo escolhido pelo técnico, APRs por dia/semana/mês, itens que mais bloqueiam, alertas mais registrados e APRs por modelo e por equipe. Os alertas e os itens que mais bloqueiam dizem o que é eliminatório e o que é alerta: só o admin os vê | admin; supervisor e técnico (a própria equipe) |
| `/app/dashboard/meus` | Dashboard, aba Meus resultados: o que a própria pessoa fez no período (OS encerradas por dia e tipo, APRs preenchidas e bloqueadas, tempo das execuções com pausas por motivo e as que mais pausaram, interrupções, locais onde mais trabalhou); sem comparar com colegas | supervisor e técnico (o admin não executa OS e volta ao Geral) |
| `/web/apr/modelos` | APR, aba Modelos: um cartão por modelo (versão em uso, rascunho, atividades e APRs), totais e modelos excluídos com "Restaurar" | admin edita; o supervisor lê |
| `/web/apr/modelos/novo` | Novo modelo: código, título, revisão e data do documento, em branco ou copiado de outro modelo; nasce rascunho | admin |
| `/web/apr/modelos/[codigo]` | Um modelo: versões, editor do rascunho ou versão em leitura, "Onde é usado" (atividades, OS abertas, APRs) e "Excluir modelo" | admin edita; o supervisor lê (o uso, só o admin) |
| `/web/apr/atividades` | APR, aba Atividades: a tabela atividade → modelo, que liga cada OS ao modelo, com filtro por modelo e "só sem modelo" | admin edita; o supervisor lê |
| `/app/usuarios` | Equipes e usuários (admin), Minha equipe com cadastro (supervisor) ou Minha equipe só para consulta (técnico: o perfil da própria equipe, sem nada por pessoa), no mesmo endereço. Admin: no topo o painel "Pendentes de liberação" (quem cadastrou, Liberar, Recusar com motivo obrigatório), filtro "Acesso" e selo com a contagem no item do menu; recusados mostram o motivo e só podem ser excluídos. Supervisor ("Minha equipe"): técnicos das equipes que ele supervisiona com o selo de acesso (Pendente, Liberado, Recusado + motivo), "Novo técnico" (nasce pendente; mostra a senha provisória uma vez), editar nome, cargo e registro e "Cancelar cadastro" dos pendentes que ele criou | admin, supervisor |
| `/web/auditoria` | Auditoria: quem fez o quê e quando nas telas de gestão (cadastros, modelos de APR, atividades, importações, OS de apoio, baixa no SAP), com filtros por texto, tipo e período e os detalhes do que mudou; só lê, a trilha não se altera | admin |
| `/app/aguardando` | "Seu acesso está aguardando liberação": quem cadastrou, atalho para o Campo de treino, "Verificar liberação" e conferência automática a cada 30 s | técnico pendente |

`/` leva ao início do papel (o quadro de OS para todos; o técnico pendente, à tela de espera), `/web/os` ao quadro, `/web/apr` aos modelos e `/app/dashboard` ao dashboard geral. Os quatro dashboards têm o mesmo filtro na URL (`?periodo=7d|30d|90d|12m|AAAA-MM`, 30 dias se ausente, e `?equipe_id=`), que acompanha a troca de aba. Os endereços antigos `/web/quadro`, `/web/os/quadro`, `/web/os/[id]`, `/web/perfil`, `/web/equipes/[id]`, `/web/busca`, `/web/minha-equipe`, `/web/importacao`, `/web/modelos`, `/web/os/diagnostico`, `/web/apr/diagnostico`, `/app/dashboard/dashboard` e `/app/dashboard/diagnostico-*` redirecionam (em `next.config.ts`). Os endereços ficam em [`src/lib/rotas.ts`](src/lib/rotas.ts).

Excluir um modelo que já foi publicado o **arquiva**: ele some das listas, das APRs novas e da cópia offline, mas as versões ficam, porque APRs, PDFs e a APR offline que ainda vai chegar apontam para elas. As atividades dele passam para o modelo escolhido na exclusão ou ficam sem modelo (o técnico escolhe ao abrir a APR). Modelo que nunca foi publicado é apagado de vez.

### Liberação de técnicos cadastrados por supervisor

O supervisor cadastra técnicos nas equipes dele; o usuário nasce `liberacao: "pendente"` e só ganha o acesso geral quando um admin libera (`POST /usuarios/{id}/liberar`); recusar (`/recusar`, com `motivo`) impede a entrada e o motivo aparece no login (`403 acesso_recusado`). Regras no web:

- **Pendente fora do treino**: a casca única (`Casca`, servidor) redireciona todo `/app/*` para `/app/aguardando`, exceto `/app/aguardando`, `/app/treino` (a página de escolha; as rotas `treino/entrar|sair` são handlers sem casca), `/app/trocar-senha` e `/app/entrar`. **Sem laço**: a tela de espera está na lista de liberadas e só lê o `/me` real (`lib/situacao-real.ts`, ignora o treino), que a `api` permite ao pendente. O endereço pedido vem do `proxy.ts` (`x-daprom-endereco`); sem ele a casca não redireciona. O menu mostra só "Campo de treino" e "Aguardando liberação", sem busca global.
- **Pendente no treino** (cookie `treino`): menu completo (o tutorial aponta para ele) mais "Aguardando liberação"; a `api` fictícia atende tudo. Ao concluir o tutorial, "Ver situação do meu acesso" no lugar de "Ir ao sistema" (sair do treino cai na tela de espera).
- **Rede de segurança**: `403 aguardando_liberacao` vindo de `chamarApi` (servidor) redireciona para `/app/aguardando`; `chamar` (navegador) faz o mesmo e devolve uma mensagem amigável. `403 acesso_recusado` volta à entrada. Com a sessão ainda aberta e `liberacao: "recusado"`, a casca mostra uma tela com o motivo e o botão Sair.
- **Login**: `403 acesso_recusado` mostra a mensagem da `api` (com o motivo). Quem entra pendente vai à tela de espera (`inicioDoUsuario`).
- A tela de espera mostra "quem cadastrou/quando" se `/me` trouxer `criado_por_nome` e `criado_em` (campos opcionais). O painel do admin usa `criado_por_nome`/`criado_por_id` e `criado_em`.

## Estrutura

```text
src/
├── proxy.ts                  # porteiro: sessão, renovação do token
├── app/
│   ├── layout.tsx            # fontes, sprite de ícones e avisos (toast)
│   ├── api/[...caminho]/     # ponte do navegador para a api (junta o token)
│   ├── app/                  # entrada, troca de senha e as telas compartilhadas e de campo ((portal): quadro, detalhe da OS, perfil, equipe, busca, Dashboard, Equipes e usuários, APR, execução)
│   ├── web/                  # telas só de gestão (APR, auditoria, alertas, importação)
│   └── doc/                  # PDF da OS dentro do painel
├── components/
│   ├── shell/                # Shell, MenuLateral, Barras e a Casca única (lê o usuário e monta o menu por papel: admin só gestão, técnico só campo, supervisor os dois juntos; o Campo de treino fica separado no fim e o perfil, no menu do usuário da barra superior)
│   ├── ui/                   # peças compartilhadas: Icon, Badge, Button, Notice, Field, AssinaturaCanvas, AdicionarFoto, ImagemArquivo
│   ├── app/                  # componentes da área do técnico, por tela
│   └── web/                  # componentes do painel, por tela
├── lib/                      # api, cliente-api, rotas, tipos, formatar, sessão, regras da APR
├── state/                    # avisos (toast) e rascunho da APR
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

As páginas são componentes de servidor que leem a `api` e compõem os componentes de cada tela.

## Referência

O protótipo HTML original (`index.html`, `styles.css` e `app.js`, com a casca de apresentação em celular/navegador) foi removido depois da migração e continua no histórico do git. Especificação e regras de negócio: [`../base/.design/especificacao.md`](../base/.design/especificacao.md).

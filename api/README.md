# api

Backend do D.A.P.R.O.M (regras de negócio, autorização, integração com o SAP, eventos de campo (online e fila offline), geração de PDF e e-mail). Node + TypeScript, [Hono](https://hono.dev) para as rotas, [Drizzle](https://orm.drizzle.team) sobre Postgres (Supabase) e [zod](https://zod.dev) para validar a entrada.

Ver a [especificação](../base/.design/especificacao.md) para escopo, contratos e decisões técnicas, e o [banco](db/README.md) para o schema.

## Como rodar

```bash
cd api
pnpm install
pnpm typecheck
pnpm test        # roda tudo num Postgres embutido (PGlite), sem Supabase
pnpm dev         # precisa das variáveis abaixo e de um Supabase (nuvem ou local)
pnpm dev:local   # sem Supabase: banco em memória (PGlite), auth e arquivos em memória, SAP simulado e usuários de exemplo
```

**Modo local (`pnpm dev:local`, [`src/local.ts`](src/local.ts)):** a `api` inteira num só processo, para desenvolver o `web` e o `mobile`. Cria as equipes Serviços Especiais, Instrumentação e Laboratório Químico e um usuário por perfil, todos com a senha `daprom123` (`adm`, `ana`, `seg`, `sup1`, `sup2`, `tec1`, `tec2`, `tec3`), lê as 11 OS das fixtures pelo simulador do SAP e serve as fotos em `/arquivos-locais`. Tudo some quando o processo termina; nunca é para produção.

Variáveis de ambiente (todas lidas em [`src/config.ts`](src/config.ts)): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SAP_API_URL`, `SAP_API_TOKEN`, `SAP_SIMULADO` (`true` liga o simulador em `/sap-simulado`), `SAP_LEITURA_INTERVALO_MIN` (padrão 15), `SMTP_URL`, `EMAIL_REMETENTE`, `PAINEL_URL`, `PORT` (padrão 3333). Com `SAP_SIMULADO=true`, aponte `SAP_API_URL` para `http://localhost:3333/sap-simulado` e `SAP_API_TOKEN` para o token que o simulador exige.

Na subida ([`src/servidor.ts`](src/servidor.ts)) a `api` aplica as migrações sob trava de sessão do Postgres, carrega os dados iniciais, inicia o executor de tarefas e só então abre a porta; `GET /saude` responde depois disso.

## Docker

[`Dockerfile`](Dockerfile): imagem única, sem etapa de build (o TypeScript roda com o `tsx`, dependência de produção). Copia `src`, `db/migrations` e `fixtures` (o simulador do SAP importa o JSON em tempo de execução); a porta vem de `PORT` e o `HEALTHCHECK` consulta `GET /saude`, que só responde depois das migrações. Para subir `api` e `web` juntos, use o [`docker-compose.yml`](../docker-compose.yml) da raiz com o `.env` copiado de [`.env.example`](../.env.example).

## Teste com Supabase real

O que não dá para provar com as versões em memória: Auth, Storage e Postgres de verdade. Roteiro com um projeto Supabase de teste (dados só fictícios):

1. **Projeto Supabase** (supabase.com, plano gratuito). Em *Project Settings*: a URL do projeto (`SUPABASE_URL`), a chave `service_role` (*API Keys*; `SUPABASE_SERVICE_ROLE_KEY`) e a string de conexão do Postgres (*Database › Connection string*; `DATABASE_URL`). Use a conexão **Session pooler** (porta 5432 do pooler) ou a direta, nunca a Transaction pooler (6543): as migrações usam trava de sessão (`pg_advisory_lock`). A conexão direta é só IPv6; sem IPv6, use o Session pooler.
2. **`.env` na raiz** (copie de `.env.example`) com essas três variáveis. `SUPABASE_JWT_SECRET` só é preciso se o projeto usa o segredo legado (HS256); com chaves assimétricas a `api` confere o token pelo JWKS do projeto.
3. **Subir a `api`**: `cd api && pnpm dev` (lê o `.env` da raiz). Ela aplica as migrações, carrega os 8 modelos de APR, cria os 4 buckets privados (`fotos`, `assinaturas`, `pdfs`, `importacoes`) e abre a porta; `curl localhost:3333/saude` deve dar `{"banco":"ok"}`. Com `SAP_SIMULADO=true` e `SAP_API_URL=http://localhost:3333/sap-simulado`, as OS do simulador entram em até 15 minutos (ou pelo botão "Ler agora").
4. **Primeiro admin**: `pnpm admin:criar -- --matricula adm --nome "Administrador" --senha "senha-inicial-123"` (a conta nasce com senha provisória).
5. **Subir o `web`**: `cd web && pnpm dev`, entrar em http://localhost:3000 com `adm` (será pedida a senha nova) e, em *Equipes e usuários*, criar a equipe (centro de trabalho `SERV_ESP`, o das OS do simulador), um supervisor (com e-mail), dois técnicos e um analista.
6. **Roteiro de conferência**: o técnico faz a APR aprovada → executa (pausa, foto, assinaturas) → encerra; no Supabase, conferir as linhas em `evento_campo`, `apr`, `execucao` e os arquivos nos buckets; o supervisor dá ciência; o analista exporta a planilha; repetir com uma APR bloqueada e ver o alerta (e o e-mail, se `SMTP_URL` estiver configurado).
7. **Docker**: com o `.env` preenchido, `docker compose up --build` (api em 3333, web em 3000) e repetir o roteiro. Com um Supabase local (`supabase start`), use `host.docker.internal` nas URLs do `.env`.

## Dados de demonstração

`pnpm demo:popular` (com a `api` já iniciada uma vez e o `.env` apontando para o banco) cria dados **fictícios** para testar os fluxos: equipes, usuários (`sup2`, `tec3`, `tec4`, `tec5`, e os que faltarem), locais (alguns críticos, de clientes como Vale e Suzano) e 30 OS em todos os estados: liberadas (algumas atrasadas, uma reprogramada), em execução (uma em pausa), pendentes (APR bloqueada com fotos, bloqueada por condição pessoal, suspensa, interrompida por risco com OS de apoio), encerradas com e sem ciência (com PDF), uma execução esquecida há mais de 12 h, uma OS cancelada e OS manuais. Tudo passa pelas regras da `api` (`processarEventos`), com a hora de cada evento no passado. Não duplica: se já houver OS `5100xxx`, não faz nada. O código está em [`src/db/seed/demo.ts`](src/db/seed/demo.ts) e é coberto por `test/demo.test.ts`.

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/app.ts` | monta a aplicação; cada fatia da especificação é um módulo em `src/rotas/` |
| `src/http/` | convenções comuns: erros, validação, paginação, resposta em snake_case, autenticação e perfis |
| `src/dominio/` | regras de negócio por assunto (eventos de campo, status da OS, alertas, painel, modelos) |
| `src/servicos/` | o que fala com o mundo de fora, atrás de interfaces: Supabase Auth, Storage, SMTP, API do SAP; PDF; executor de tarefas |
| `src/db/` | schema, conexão e carga inicial |
| `test/` | testes por fatia; `ajuda.ts` monta o ambiente (PGlite + serviços em memória) |

## Convenções (valem para todas as rotas)

- **Autenticação:** `Authorization: Bearer <JWT do Supabase>`; sem token válido é `401`, perfil sem permissão é `403`. Com a senha inicial só `/me` e `/auth/trocar-senha` respondem (`403` `senha_provisoria`). Usuário desativado recebe `401` `acesso_revogado`, exceto em `PUT /arquivos/{id}` e `POST /eventos`, para a fila offline pendente subir; depois do envio a conta é revogada.
- **JSON em snake_case**, erros `{erro: {codigo, mensagem}}` (`422` `validacao` para campo inválido), listas `{<nome>: [...], pagina, tamanho, total}` com `?pagina=1&tamanho=50` (máximo 200). Datas `AAAA-MM-DD`, instantes ISO 8601; "dia" é em `America/Sao_Paulo`.
- **Arquivos:** `PUT /arquivos/{id}` (multipart `arquivo`, `tipo` = `foto` ou `assinatura`) com o id gerado no cliente; reenviar o mesmo id e conteúdo não tem efeito, conteúdo diferente é `409`. Os eventos referenciam o arquivo pelo id (`arquivo_id`, ou o próprio `id` da evidência).
- **Só `POST /eventos` escreve APR e execução.** Resposta sempre `200`: `{confirmados, alertas, aprs, os, rejeitados: [{id, codigo, mensagem}], pendentes: [{id, codigo, mensagem}]}`. `rejeitados` não adianta reenviar; `pendentes` (arquivo ou evento anterior ainda não chegou) ficam na fila do cliente. Evento que vem da fila offline (chegou mais de 60 s depois de `ocorrido_em`) é aplicado mesmo quando conflita com o que mudou no servidor, e vira `alerta`; online, o mesmo conflito é recusado.

## Rotas por fatia

| Fatia | Rotas | Módulo |
|---|---|---|
| Plataforma | `GET /saude`, `PUT /arquivos/{id}`, `GET /arquivos/{id}/url` | `saude`, `arquivos` |
| Usuário e Equipe | `POST /auth/login`, `/auth/refresh`, `/auth/trocar-senha`, `GET /me`, `PUT /me/assinatura`, `GET /me/historico` (execuções que o usuário encerrou nos últimos 60 dias), `GET /me/execucoes-abertas`, `/usuarios` (criar, editar, listar, `redefinir-senha`), `/equipes` | `auth`, `me`, `usuarios`, `equipes` |
| Integração SAP | `POST /sap/leituras`, `POST/GET /importacoes`, `POST /os`, `/locais`, simulador `/sap-simulado/*` | `sap`, `sap-simulado` |
| Modelo de APR | `/modelos-apr`, `/modelos-apr/{codigo}/versoes/...`, `/atividades` | `modelos-apr` |
| Eventos, APR e Execução | `POST /eventos`, `POST /sync/pull` | `eventos` |
| Impedimento | `POST /os/{id}/reprogramar`, `POST /os/{id}/cancelar`, `GET/PATCH /alertas` | `impedimento` |
| Painel | `GET /os`, `GET /os/{id}`, `GET /os/{id}/aprs`, `POST /os/{id}/ciencia`, `/indicadores`, `/indicadores/tempo`, `/historico`, `POST /exportacoes/sap` | `painel` |
| PDF | `GET /os/{id}/pdf` | `pdf` |

Tarefas em segundo plano (`pdf_os`, `email_alerta`, `leitura_sap`) rodam num laço do próprio processo ([`src/servicos/tarefas.ts`](src/servicos/tarefas.ts)), com nova tentativa em 1, 5 e 15 minutos e `falhou` depois de 5.

## Onde a implementação difere da especificação

- `POST /modelos-apr/{codigo}/versoes` recebe `riscos[]` e itens com `risco_ordem` no lugar de `grupo` (o schema tem a entidade risco); todos os campos são opcionais e, se omitidos, copiam a versão anterior. Há também `GET`, `PUT` e `DELETE` de versão para o editor.
- `os` ganhou `cancelada_em`, `cancelada_por` e `justificativa_cancelamento` (migração `0002`), para guardar a justificativa do cancelamento da OS manual.
- `POST /eventos` devolve `rejeitados` e `pendentes` além dos campos da especificação.
- `GET /usuarios` e `GET /equipes` servem a todos os perfis (a lista de participantes da APR precisa dos colegas); só o admin vê e-mail e usuários desativados.

## Não coberto

- Execução contra o Supabase real (Auth e Storage foram escritos pela API REST e só testados com versões em memória) e contra um Postgres fora do PGlite.
- As imagens Docker não foram construídas nem executadas (sem Docker na máquina de desenvolvimento): o que foi verificado é a instalação só com dependências de produção e a importação da aplicação nesse conjunto de arquivos.
- Modo offline do lado do app (o `POST /sync/pull` já existe).

# api

Backend do SYNQ OS: regras de negócio, autorização, banco, eventos de campo (online e fila offline), PDF, e-mail, tarefas em segundo plano, IA e os dois simuladores (SAP e registro de funcionários). Atende a `web` e o app `mobile`; os contratos que os dois usam ficam em [`shared/api`](../shared/api). Node + TypeScript, [Hono](https://hono.dev) nas rotas, [Drizzle](https://orm.drizzle.team) sobre Postgres (Supabase) e [zod](https://zod.dev) na entrada.

Como a `api` é construída (arquitetura, convenções HTTP, travas da conta, modelo de dados, máquinas de estado, eventos, contratos, tarefas, segurança e a **referência de rotas**) está em [docs/especificacao.md](../docs/especificacao.md). Este arquivo diz como rodar.

## Como rodar

```bash
cd api
pnpm install
pnpm typecheck
pnpm test             # tudo num Postgres embutido (PGlite), com Auth e Storage em memória; não toca no Supabase
pnpm dev              # em watch, com o .env da raiz; usa o Supabase configurado (ver "Banco de desenvolvimento")
pnpm dev:local        # sem Supabase: banco, auth e arquivos em memória, SAP e registro de funcionários simulados, contas de exemplo
pnpm dev:local:demo   # o mesmo, já com a demonstração inteira (OS em todos os estados, alertas, gamificação, mapa de calor)
```

**Modo local** ([`src/local.ts`](src/local.ts)): a `api` inteira num só processo, para desenvolver a `web` e o `mobile`. Cria as equipes Serviços Especiais, Instrumentação e Laboratório Químico, uma conta por papel (as contas e a senha estão no [README da raiz](../README.md)) e as lista ao subir. Lê as OS das fixtures pelo simulador do SAP, cria um catálogo de serviço fictício ([`src/db/seed/catalogo-demo.ts`](src/db/seed/catalogo-demo.ts)) e serve fotos e PDFs em `/arquivos-locais`. Tudo some quando o processo termina; nunca é para produção. Nenhuma OS vem executada: dashboards e mapa de calor ficam vazios até alguém executar uma. Com `dev:local:demo`, a subida carrega antes a demonstração (as OS 5100xxx, ver "Dados de demonstração").

**Subida** ([`src/servidor.ts`](src/servidor.ts)): aplica as migrações sob trava de sessão do Postgres (`migrarComTrava`, em [`src/db/conexao.ts`](src/db/conexao.ts)), carrega os dados iniciais, garante os buckets e as imagens da carga, inicia o executor de tarefas e só então abre a porta. `GET /saude` responde depois disso; migração que falha impede a subida. Detalhes em [docs/especificacao.md](../docs/especificacao.md), seção 3.5.

## Variáveis de ambiente

Todas lidas e validadas em [`src/config.ts`](src/config.ts); o modelo para preencher é o [`.env.example`](../.env.example) da raiz (a `api` lê `../.env` e `../.env.local`; o `.env.local` vence). A tabela por grupo está em [docs/especificacao.md](../docs/especificacao.md), seção 3.6. O que importa para rodar:

| Variável | Observação |
|---|---|
| `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | obrigatórias fora do modo local; `SUPABASE_JWT_SECRET` só no segredo legado (HS256) |
| `SAP_SIMULADO` | `true` liga o simulador em `/sap-simulado`. Ligado, `SAP_API_URL` e `SAP_API_TOKEN` têm padrão (`http://127.0.0.1:<PORT>/sap-simulado` e `token-de-desenvolvimento`) e podem ficar vazios |
| `RH_SIMULADO` | `true` liga o registro de funcionários simulado em `/rh-simulado`. Ligado, `RH_API_URL`, `RH_API_TOKEN`, `RH_AVISO_TOKEN` e `RH_AVISO_URL` também têm padrão. **Sem registro configurado, criar ou reativar usuário responde `503 registro_indisponivel`** ([`src/dominio/rh.ts`](src/dominio/rh.ts)) |
| `SMTP_URL`, `EMAIL_REMETENTE`, `PAINEL_URL`, `EMAIL_RESUMO_HORA` | e-mail; ver "Servidor de e-mail" |
| `IA_PROVEDOR`, `ANTHROPIC_API_KEY` ou `GEMINI_API_KEY`, `*_MODELO_*` | IA; sem a chave do provedor, nada chama a IA. Ver [docs/ia-e-vitoria.md](../docs/ia-e-vitoria.md), seção 2 |
| `PUSH_LIGADO`, `EXPO_PUSH_URL`, `EXPO_ACCESS_TOKEN` | notificação push do app (serviço da Expo; `PUSH_LIGADO=false` desliga; a chave só se a conta da Expo exige). Ver [docs/pessoas-e-equipes.md](../docs/pessoas-e-equipes.md), seção 8.6 |
| `CLIMA_API_URL`, `CLIMA_API_CHAVE` | previsão do tempo (Open-Meteo; a chave só existe no plano pago) |
| `PORT` | padrão 3333 |

O [`docker-compose.yml`](../docker-compose.yml) liga `SAP_SIMULADO` e `RH_SIMULADO` por padrão; o `pnpm dev` não: ponha os dois no `.env`. Parte dos valores (cidade padrão, horários das rotinas, limites da IA) o admin muda em `/app/configuracoes`, e o valor gravado vence o do ambiente.

## Banco de desenvolvimento

> **O banco de desenvolvimento é um projeto Supabase real e COMPARTILHADO**, não um banco local descartável. O `pnpm dev`, em watch, aplica as migrações pendentes nele assim que o arquivo aparece. Por isso: **nunca edite uma migração já gerada** (nem o `meta/`); corrigir é sempre uma migração nova. Scripts que criam dados (`conferir:*` do `mobile`, `testar-fluxo-apr` da `web`) rodam contra o modo local, nunca contra ele.

O schema, em TypeScript ([`src/db/schema/`](src/db/schema)), é a fonte da verdade; as migrações em [`db/migrations/`](db/migrations) são geradas dele.

```bash
pnpm db:generate --name=descricao            # depois de mudar o schema: gera a próxima migração
pnpm db:generate --custom --name=descricao   # migração vazia para SQL escrito à mão (gatilhos, funções, passos de dados)
pnpm db:check                                # confere a consistência das migrações
pnpm db:test                                 # aplica tudo num PGlite e roda os casos do schema e da carga inicial
pnpm db:gerar-seed                           # relê base/apr-examples e regrava src/db/seed/modelos-apr.json
```

Para mudar o banco: edite o schema, rode `db:generate --name=...` e `db:test`. Passos de dados podem ser acrescentados ao fim da migração recém-gerada, antes de ela ser aplicada em qualquer banco. A `api` aplica as pendentes na subida, sob `pg_advisory_lock`: duas instâncias subindo juntas não colidem. Diagrama de entidades, convenções, o que o banco garante e a carga inicial: [docs/especificacao.md](../docs/especificacao.md), seções 4.1 a 4.7.

## Roteiro com o Supabase

O que as versões em memória não provam: Auth, Storage e Postgres de verdade. Com um projeto Supabase de teste (só dados fictícios):

1. **Projeto** (supabase.com, plano gratuito). Em *Project Settings*: a URL (`SUPABASE_URL`), a chave `service_role` (`SUPABASE_SERVICE_ROLE_KEY`) e a string de conexão (`DATABASE_URL`). Use a conexão direta ou o **Session pooler** (porta 5432), nunca o *Transaction pooler* (6543): as migrações usam trava de sessão. A conexão direta é só IPv6; sem IPv6, use o Session pooler.
2. **`.env` na raiz** (copie de `.env.example`) com essas três variáveis, mais `SAP_SIMULADO=true` e `RH_SIMULADO=true` (sem o registro, o passo 5 dá `503 registro_indisponivel`). `SUPABASE_JWT_SECRET` só se o projeto usa o segredo legado.
3. **Subir:** `pnpm dev`. Ela aplica as migrações, carrega os 8 modelos de APR, cria os buckets privados (`fotos`, `assinaturas`, `pdfs`, `importacoes`, `documentos`, `gamificacao`, `treinamentos`) e abre a porta; `curl localhost:3333/saude` deve dar `{"banco":"ok"}`. Com o SAP simulado, a primeira leitura sai na subida e as seguintes a cada `SAP_LEITURA_INTERVALO_MIN` minutos (ou "Ler agora").
4. **Primeiro admin:** `pnpm admin:criar -- --email admin@empresa.com.br --matricula adm --nome "Administrador" --senha "senha-inicial-123"` (nasce com senha provisória). Banco que ainda tem usuários do tempo do login por matrícula: `pnpm usuarios:migrar-emails` (mostra o que mudaria) e depois `pnpm usuarios:migrar-emails -- --aplicar`. Banco com usuários anteriores ao registro simulado: `pnpm rh:carga-inicial` **antes** da primeira leitura diária (cria o funcionário de cada usuário; pode rodar de novo sem duplicar).
5. **Subir a `web`** (`cd web && pnpm dev`), entrar com o admin e, em *Equipes e usuários*, criar a equipe (centro de trabalho `SERV_ESP`, o das OS do simulador) e dois técnicos, um deles supervisor da equipe.
6. **Conferir:** APR aprovada → cada participante assina na própria conta → executa (pausa com motivo, foto) → "Encerrar OS" → quem encerrou preenche e assina → o supervisor assina por último (só então sai o PDF) → o admin exporta a planilha. No Supabase, conferir `evento_campo`, `apr`, `apr_participante`, `execucao` e os buckets. Repetir com uma APR bloqueada e ver o alerta (e o e-mail, com SMTP).
7. **Docker:** `docker compose up --build` na raiz (api em 3333, web em 3000) e repetir o roteiro. Com Supabase local (`supabase start`), use `host.docker.internal` nas URLs do `.env`.

## Servidor de e-mail

Sem `SMTP_URL` tudo funciona e os avisos ficam só no sino; a `api` sobe e avisa no log. Para ligar, preencha no `.env` (ou `.env.local`):

| Variável | O que é |
|---|---|
| `SMTP_URL` | `smtp://usuario:senha@servidor:587` (STARTTLS) ou `smtps://usuario:senha@servidor:465`; caracteres especiais do usuário ou da senha vão codificados (`@` vira `%40`) |
| `EMAIL_REMETENTE` | por exemplo `"SYNQ OS <synqos@empresa.com.br>"` (padrão `synqos@localhost`) |
| `PAINEL_URL` | endereço público da web, base dos links dos e-mails (padrão `http://localhost:3000`) |
| `EMAIL_RESUMO_HORA` | hora de São Paulo a partir da qual sai o resumo diário (padrão 7) |

Depois, confira ([`scripts/testar-email.ts`](scripts/testar-email.ts); lê só essas variáveis, não precisa do banco):

```bash
pnpm email:testar -- --so-conectar              # só conecta e autentica
pnpm email:testar -- fulano@empresa.com.br      # conecta, autentica e envia um e-mail no modelo dos avisos
```

Se o teste chega, os avisos e o resumo diário também chegam. Categorias, conteúdo e regras do envio: [docs/pessoas-e-equipes.md](../docs/pessoas-e-equipes.md), seção 8.

## Dados de demonstração

`pnpm demo:popular` (com a `api` já iniciada uma vez no banco do `.env`) cria dados **fictícios** pelas regras da `api` (`processarEventos`, com a hora de cada evento no passado): equipes, usuários, locais (alguns críticos) e as OS 5100xxx em todos os estados (liberadas, atrasadas, reprogramada, em execução e em pausa, pendentes por bloqueio, suspensa, interrompida com OS de apoio, `encerrando`, aguardando o supervisor, encerradas com PDF, execução esquecida, OS de apoio cancelada, corretiva urgente). Não duplica: com OS 5100xxx no banco, não faz nada. Código em [`src/db/seed/demo.ts`](src/db/seed/demo.ts).

**Elenco.** Cada papel da demonstração (`ELENCO_FICTICIO`) tem uma conta fictícia; na apresentação, passe as contas reais de quem apresenta como `papel=matrícula` (a conta precisa existir e estar na equipe do papel; o papel que faltar segue fictício). Com elenco, nenhuma ausência é inventada.

| Papel | Conta fictícia | Equipe |
|---|---|---|
| `sup1`, `sup2`, `sup3` | Sandra Supervisora, Saulo Supervisor, Laura Supervisora | `SERV_ESP`, `INSTRUM`, `LAB_QUI` |
| `tec1`, `tec2`, `tec5`, `tec7`, `tec8` | Tiago, Taís, Tadeu, Júlia e Nuno | `SERV_ESP` |
| `tec3`, `tec4` | Tomás e Tânia | `INSTRUM` |
| `tec6` | Lucas | `LAB_QUI` |
| `adm` | Ana Administradora | — |

```bash
pnpm demo:popular sup1=1001 tec1=1002 adm=admin
```

Também: `pnpm demo:espalhar-gps` (corrige o GPS das execuções 5100xxx gravadas pelo seed antigo, perto do local de cada OS) e `pnpm demo:mais-os-mapa-calor` (OS 5200xxx já encerradas, com GPS, inseridas direto no banco só para o mapa de calor; idempotente). Cada usuário da demonstração e do modo local ganha o seu funcionário no registro simulado (mesma matrícula, nome, e-mail e cargo), e sem elenco entram uns 30 funcionários sem conta, para demonstrar o cadastro.

## Outros scripts

| Comando | O que faz |
|---|---|
| `pnpm pdf:exemplo` | grava `ordens-exemplo.pdf`: OS no layout impresso pelo SAP, com texto, para testar a importação por PDF |
| `pnpm pdf:digitalizado` | gera um PDF escaneado fictício para testar a digitalização de OS antigas |
| `pnpm vitoria:conferir-ia` / `pnpm vitoria:bateria` | confere a chamada real da IA da Vitória / roda a bateria de perguntas |
| `pnpm treinamento:conferir-ia` | confere o rascunho de treinamento pela IA real |

## Docker

[`Dockerfile`](Dockerfile): imagem única, sem etapa de build (o TypeScript roda com o `tsx`, dependência de produção). O contexto é a **raiz** do repositório (`docker build -f api/Dockerfile .`): copia `src`, `db/migrations`, `fixtures` (o simulador do SAP lê o JSON em tempo de execução), `conteudo` (os manuais da Vitória) e o `shared` (em `/app/shared`, para os caminhos relativos valerem). A porta vem de `PORT` e o `HEALTHCHECK` consulta `GET /saude`. Para subir `api` e `web` juntas, o [`docker-compose.yml`](../docker-compose.yml) da raiz, com o `.env` copiado de `.env.example`.

## Hospedagem

| Ambiente | Situação |
|---|---|
| Coolify (do mentor da maratona) | hospedagem **oficial** até o fim da maratona; `api` e `web` sobem pelos Dockerfiles |
| Render (https://d-a-p-r-o-m.onrender.com) | hospedagem anterior; continua de pé e pode voltar. O plano dorme sem uso e leva cerca de 80 s para acordar na primeira requisição |

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/app.ts` | monta a aplicação; cada área é um módulo em `src/rotas/` |
| `src/http/` | convenções comuns: erros, validação, paginação, snake_case, autenticação e perfis |
| `src/dominio/` | regras de negócio por assunto |
| `src/servicos/` | o que fala com fora, atrás de interfaces: Supabase Auth e Storage, SMTP, SAP, RH, IA, clima, OCR, PDF, executor de tarefas |
| `src/db/` | schema, conexão e carga inicial (`seed/`) |
| `db/migrations/` | migrações geradas pelo `drizzle-kit` |
| `db/tests/` | casos do schema e da carga inicial (`pnpm db:test`) |
| `scripts/` | os comandos `admin:criar`, `demo:*`, `email:testar`, `pdf:*` e as conferências da IA |
| `conteudo/vitoria/` | manuais da Vitória por perfil (conteúdo do chatbot) |
| `fixtures/` | ordens de exemplo do SAP simulado |
| `test/` | testes por área; `ajuda.ts` monta o ambiente (PGlite + serviços em memória) |

## Não coberto

- Os testes automáticos rodam só com PGlite e as versões em memória de Auth e Storage; o Supabase real é usado no desenvolvimento, sem testes automáticos contra ele.
- A imagem Docker não foi construída nem executada na máquina de desenvolvimento (sem Docker); o que foi verificado é a instalação só com dependências de produção e a importação da aplicação.

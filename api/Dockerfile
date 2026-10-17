# API do D.A.P.R.O.M (Node + TypeScript). A porta é a variável PORT (padrão 3333).
#
# O contexto do build é a RAIZ do repositório, não `api/`: a Vitória importa `shared/vitoria`, que fica fora de `api/`.
#   docker build -f api/Dockerfile .
# A `api` fica em /app/api e o `shared` em /app/shared, para os caminhos relativos (`../../../shared`) continuarem valendo.
#
# O TypeScript roda direto com o tsx (dependência de produção): não há etapa de build.
# Na subida a api aplica as migrações (db/migrations) e carrega os dados iniciais antes de abrir a porta.
FROM node:24-slim

ENV NODE_ENV=production \
    PORT=3333

RUN npm install --global pnpm@11.21.0

WORKDIR /app/api

# Dependências primeiro, para o cache de camadas sobreviver a mudanças só no código.
COPY api/package.json api/pnpm-lock.yaml api/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY api/tsconfig.json ./
COPY api/src ./src
# Lidos em tempo de execução: as migrações (migrador do Drizzle), as ordens do SAP simulado e os manuais da Vitória.
COPY api/db/migrations ./db/migrations
COPY api/fixtures ./fixtures
COPY api/conteudo ./conteudo
COPY shared /app/shared

USER node
EXPOSE 3333

# `GET /saude` só responde depois das migrações; a hospedagem e o compose usam este resultado.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "src/servidor.ts"]
